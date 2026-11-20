import "../env";
import prisma from "../lib/prisma";
import {
  toConnection,
  getDeviceInfo,
  getAcsEvents,
  pollDevice,
  getStartOfTodayIST,
  isAttendanceEvent,
} from "../lib/hikvision";
import { getISTDetails, getStartOfDayIST } from "../lib/biometric";
import { syncDailyAttendanceToSheet } from "../lib/google-attendance-sync";
import { cache } from "../lib/cache";
import { sendPushToUser } from "../lib/push";

async function main() {
  console.log("================================================================================");
  console.log("   TODAY TALABAT ATTENDANCE RE-POLL, RECONCILIATION & DUAL NOTIFICATION SYNC   ");
  console.log("================================================================================");

  const now = new Date();
  const { calendarDayUTC, timeFormatted12 } = getISTDetails(now);
  const targetDate = calendarDayUTC; // 2026-11-20T00:00:00.000Z
  const startOfTodayIST = getStartOfTodayIST();
  const endOfTodayIST = new Date(startOfTodayIST.getTime() + 24 * 60 * 60 * 1000 - 1);
  const istDateString = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

  console.log(`📅 Target Date (IST): ${istDateString} | Current Time: ${timeFormatted12}`);
  console.log(`🕒 Normalized DB Date: ${targetDate.toISOString()}`);
  console.log(`🕒 Full Day Polling Range: ${startOfTodayIST.toISOString()} → ${now.toISOString()}\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: FORCE-POLL ALL BIOMETRIC TERMINALS ACROSS THE ENTIRE DAY
  // ─────────────────────────────────────────────────────────────────────────────
  const devices = await prisma.biometricDevice.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`📡 Polling ${devices.length} biometric terminal(s) from 00:00 IST to current time...`);

  let totalScansFetched = 0;
  let totalScansProcessed = 0;

  for (const dev of devices) {
    console.log(`\n👉 Polling Terminal: "${dev.name}" (${dev.host}:${dev.port}) [Enabled: ${dev.enabled}]...`);
    try {
      // Force = true to bypass time window guards and process any scans from arrival through departure
      const pollRes = await pollDevice(dev.id, true, startOfTodayIST, now);
      console.log(`   ✅ Poll Result: Fetched=${pollRes.scansFetched}, Processed=${pollRes.scansProcessed}`);
      totalScansFetched += pollRes.scansFetched;
      totalScansProcessed += pollRes.scansProcessed;
    } catch (err: any) {
      console.error(`   ❌ Failed polling device ${dev.host}:`, err?.message || err);
    }
  }

  console.log(`\n🎯 Hardware Poll Total: Fetched ${totalScansFetched} scans, Processed ${totalScansProcessed} events`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: CHECK RAW ACS EVENTS FOR ANY TALABAT SCAN THAT WAS ACKNOWLEDGED BUT NOT MARKED
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n🔍 Checking for any Talabat who scanned on hardware but is missing in AttendanceRegistry...`);

  const allStudents = await prisma.studentProfile.findMany({
    include: {
      user: true,
      classEnrollments: { where: { isActive: true }, include: { class: true } },
      parentLinks: { include: { parent: { include: { user: true } } } },
    },
  });

  // Build lookup maps for students by ITS, studentId, trNo
  const studentByIts = new Map<string, typeof allStudents[0]>();
  for (const s of allStudents) {
    if (s.its) studentByIts.set(s.its.trim(), s);
    if (s.studentId) studentByIts.set(s.studentId.trim(), s);
    if (s.trNo) studentByIts.set(s.trNo.trim(), s);
    // Also without leading zeros or with 8-digits
    const itsDigits = (s.its || s.studentId || "").replace(/\D/g, "");
    if (itsDigits) {
      studentByIts.set(itsDigits, s);
      studentByIts.set(itsDigits.replace(/^0+/, ""), s);
    }
  }

  // Scan terminals directly for any ACS attendance event from today
  const rawScannedStudentIds = new Map<string, { checkInTime: Date; terminal: string }>();

  for (const dev of devices) {
    if (!dev.enabled) continue;
    const conn = toConnection(dev);
    try {
      const { events } = await getAcsEvents(conn, startOfTodayIST, now);
      for (const ev of events) {
        if (!isAttendanceEvent(ev)) continue;
        const rawId = String(ev.employeeNoString ?? ev.name ?? ev.cardNo ?? "").trim();
        if (!rawId) continue;
        const matchedStudent = studentByIts.get(rawId) || studentByIts.get(rawId.replace(/^0+/, ""));
        if (matchedStudent) {
          const scanTime = ev.time ? new Date(ev.time) : new Date();
          const existing = rawScannedStudentIds.get(matchedStudent.id);
          // Keep the earliest scan of the day as check-in
          if (!existing || scanTime < existing.checkInTime) {
            rawScannedStudentIds.set(matchedStudent.id, { checkInTime: scanTime, terminal: dev.name });
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  console.log(`📊 Discovered ${rawScannedStudentIds.size} unique Talabat with raw hardware biometric scans today.`);

  // If any student has a raw hardware scan but is not in AttendanceRegistry as PRESENT/LATE, mark them!
  let recoveredScans = 0;
  for (const [studentId, scanInfo] of rawScannedStudentIds.entries()) {
    const existingReg = await prisma.attendanceRegistry.findUnique({
      where: { studentId_date: { studentId, date: targetDate } },
    });

    if (!existingReg || existingReg.status === "ABSENT") {
      const s = allStudents.find((st) => st.id === studentId);
      const scanIST = scanInfo.checkInTime.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
      console.log(`   ⚡ Recovering unlinked scan: ${s?.user.firstName} ${s?.user.lastName} (ITS: ${s?.its}) at ${scanIST} on ${scanInfo.terminal}`);

      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId, date: targetDate } },
        create: {
          studentId,
          date: targetDate,
          status: "PRESENT",
          source: "BIOMETRIC",
          checkInTime: scanInfo.checkInTime,
          remarks: `Recovered from ${scanInfo.terminal} biometric log`,
          recordedById: "hardware-recovery",
        },
        update: {
          status: "PRESENT",
          source: "BIOMETRIC",
          checkInTime: scanInfo.checkInTime,
          remarks: `Recovered from ${scanInfo.terminal} biometric log`,
        },
      });
      recoveredScans++;
    }
  }

  if (recoveredScans > 0) {
    console.log(`✅ Recovered and marked ${recoveredScans} student(s) who had scanned on terminal.`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: RECONCILE APPROVED STUDENT LEAVES FOR TODAY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n🔄 Syncing active approved student leaves for today...`);
  const activeStudentLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      OR: [
        {
          grantedStartDate: { not: null, lte: endOfTodayIST },
          grantedEndDate: { not: null, gte: startOfTodayIST },
        },
        {
          grantedStartDate: null,
          startDate: { lte: endOfTodayIST },
          endDate: { gte: startOfTodayIST },
        },
      ],
    },
    include: {
      student: {
        include: {
          user: true,
          classEnrollments: { where: { isActive: true }, include: { class: true } },
          parentLinks: { include: { parent: { include: { user: true } } } },
        },
      },
    },
  });

  for (const leave of activeStudentLeaves) {
    const s = leave.student;
    const leaveStatus = leave.type === "MEDICAL" ? "MEDICAL" : "ON_LEAVE";

    // Only update if not already scanned PRESENT/LATE
    const existingReg = await prisma.attendanceRegistry.findUnique({
      where: { studentId_date: { studentId: s.id, date: targetDate } },
    });

    if (!existingReg || existingReg.status === "ABSENT") {
      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: s.id, date: targetDate } },
        create: {
          studentId: s.id,
          date: targetDate,
          status: leaveStatus,
          source: "LEAVE_APPROVED",
          remarks: `[Leave Approved] ${leave.reason || ""}`,
          leaveId: leave.id,
          recordedById: leave.reviewerId || "admin-leave-sync",
        },
        update: {
          status: leaveStatus,
          source: "LEAVE_APPROVED",
          remarks: `[Leave Approved] ${leave.reason || ""}`,
          leaveId: leave.id,
        },
      });
      console.log(`  ✅ Student ${s.user.firstName} ${s.user.lastName} marked ${leaveStatus} per approved leave.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: PROPAGATE ALL VERIFIED REGISTRIES TO CLASS ATTENDANCE RECORDS & FIX MISALIGNMENTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n🔄 Synchronizing Gate Registries to all enrolled classes...`);

  const verifiedRegistries = await prisma.attendanceRegistry.findMany({
    where: {
      date: targetDate,
      status: { in: ["PRESENT", "LATE", "ON_LEAVE", "MEDICAL"] },
    },
    include: {
      student: {
        include: {
          user: true,
          classEnrollments: { where: { isActive: true }, include: { class: true } },
          parentLinks: { include: { parent: { include: { user: true } } } },
        },
      },
    },
  });

  let classRecordsFixed = 0;
  let streaksUpdated = 0;
  const correctedStudents: Array<{ name: string; its: string; darjah: string; status: string; checkIn: string }> = [];

  for (const reg of verifiedRegistries) {
    const s = reg.student;
    const checkInTime = reg.checkInTime || new Date();
    const status = reg.status; // PRESENT, LATE, ON_LEAVE, MEDICAL

    // Check if any class attendance record was marked ABSENT for this student
    const enrollments = s.classEnrollments.filter((e) => e.class && e.class.isActive);
    let wasFixed = false;

    for (const en of enrollments) {
      const existingClassRec = await prisma.attendanceRecord.findUnique({
        where: {
          studentId_classId_date: {
            studentId: s.id,
            classId: en.classId,
            date: targetDate,
          },
        },
      });

      if (!existingClassRec || existingClassRec.status !== status) {
        await prisma.attendanceRecord.upsert({
          where: {
            studentId_classId_date: {
              studentId: s.id,
              classId: en.classId,
              date: targetDate,
            },
          },
          create: {
            student: { connect: { id: s.id } },
            class: { connect: { id: en.classId } },
            date: targetDate,
            status,
            source: reg.source || "BIOMETRIC",
            verificationMethod: reg.source === "BIOMETRIC" ? "BIOMETRIC" : "PORTAL",
            checkInTime,
            recordedById: reg.recordedById || "biometric-sync",
            justification: status === "ON_LEAVE" || status === "MEDICAL" ? reg.remarks : null,
            justificationStatus: status === "ON_LEAVE" || status === "MEDICAL" ? "APPROVED" : "NONE",
          },
          update: {
            status,
            source: reg.source || "BIOMETRIC",
            verificationMethod: reg.source === "BIOMETRIC" ? "BIOMETRIC" : "PORTAL",
            checkInTime,
            justification: status === "ON_LEAVE" || status === "MEDICAL" ? reg.remarks : null,
            justificationStatus: status === "ON_LEAVE" || status === "MEDICAL" ? "APPROVED" : "NONE",
          },
        });
        classRecordsFixed++;
        wasFixed = true;
      }
    }

    if (wasFixed) {
      const timeStrIST = checkInTime.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      correctedStudents.push({
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        its: s.its || s.studentId || "—",
        darjah: s.grade ? `${s.grade}${s.section || ""}` : "—",
        status,
        checkIn: timeStrIST,
      });
    }

    // Recalculate streak days for PRESENT / LATE students
    if (status === "PRESENT" || status === "LATE") {
      const pastRecords = await prisma.attendanceRecord.findMany({
        where: {
          studentId: s.id,
          status: { in: ["PRESENT", "LATE"] },
          date: { lt: targetDate, gte: new Date(targetDate.getTime() - 60 * 86400000) },
        },
        select: { date: true },
        orderBy: { date: "desc" },
      });
      const uniquePastDates = new Set(pastRecords.map((r) => r.date.toISOString().slice(0, 10)));
      let calculatedStreak = 1;
      const checkD = new Date(targetDate.getTime() - 86400000);
      while (uniquePastDates.has(checkD.toISOString().slice(0, 10))) {
        calculatedStreak++;
        checkD.setDate(checkD.getDate() - 1);
      }
      if (s.streakDays !== calculatedStreak) {
        await prisma.studentProfile.update({
          where: { id: s.id },
          data: { streakDays: calculatedStreak },
        });
        streaksUpdated++;
      }
    }
  }

  console.log(`✅ Synchronized class records: ${classRecordsFixed} updated/fixed across active classes.`);
  console.log(`🔥 Streak days maintained/updated for: ${streaksUpdated} students.`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: PURGE FALSE ABSENCE NOTIFICATIONS & DISPATCH ACCURATE VERIFIED NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n📬 Reconciling notifications for both Talabat and Parents...`);

  let purgedAbsenceNotifs = 0;
  let studentNotifsSent = 0;
  let parentNotifsSent = 0;

  for (const reg of verifiedRegistries) {
    const s = reg.student;
    const studentUser = s.user;
    const checkInTime = reg.checkInTime || new Date();
    const timeStrIST = checkInTime.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const status = reg.status; // PRESENT, LATE, ON_LEAVE, MEDICAL
    const studentFullName = `${studentUser.firstName} ${studentUser.lastName}`.trim();

    // 1. Delete ANY erroneous "Absence Logged" notification for this student
    const delStudent = await prisma.notification.deleteMany({
      where: {
        userId: studentUser.id,
        title: { contains: "Absence" },
        createdAt: { gte: startOfTodayIST },
      },
    });
    purgedAbsenceNotifs += delStudent.count;

    // 2. Dispatch verified attendance confirmation notification to student
    const studentTitle = status === "ON_LEAVE" || status === "MEDICAL"
      ? `📋 Leave Approved: Marked ${status}`
      : `⚡ Attendance Verified: Marked ${status}`;
    const studentBody = status === "ON_LEAVE" || status === "MEDICAL"
      ? `Your leave request for today (${istDateString}) has been approved and marked as ${status}.`
      : `Your biometric attendance has been recorded and verified as ${status} for today (${istDateString}) at ${timeStrIST} IST.`;

    const existingStudentNotif = await prisma.notification.findFirst({
      where: {
        userId: studentUser.id,
        title: studentTitle,
        createdAt: { gte: startOfTodayIST },
      },
    });

    if (!existingStudentNotif) {
      await prisma.notification.create({
        data: {
          userId: studentUser.id,
          title: studentTitle,
          body: studentBody,
          type: "SUCCESS",
          link: "/talabat/attendance",
          priority: "HIGH",
        },
      });
      studentNotifsSent++;

      try {
        await sendPushToUser(studentUser.id, {
          title: studentTitle,
          body: studentBody,
          url: "/talabat/attendance",
        });
      } catch { }
    }

    // 3. Reconcile Linked Parents: Delete false absence alerts & dispatch verified confirmation
    for (const link of s.parentLinks) {
      const parentUser = link.parent?.user;
      if (!parentUser) continue;

      // Delete any false absence alerts for the parent
      const delParent = await prisma.notification.deleteMany({
        where: {
          userId: parentUser.id,
          title: { contains: "Absence" },
          createdAt: { gte: startOfTodayIST },
        },
      });
      purgedAbsenceNotifs += delParent.count;

      const parentTitle = status === "ON_LEAVE" || status === "MEDICAL"
        ? `📋 Leave Approved: ${studentFullName}`
        : `⚡ Attendance Verified: ${studentFullName}`;
      const parentBody = status === "ON_LEAVE" || status === "MEDICAL"
        ? `${studentFullName} has been granted official leave (${status}) for today (${istDateString}).`
        : `${studentFullName} has been verified and marked ${status} for today (${istDateString}) with biometric check-in at ${timeStrIST} IST.`;

      const existingParentNotif = await prisma.notification.findFirst({
        where: {
          userId: parentUser.id,
          title: parentTitle,
          createdAt: { gte: startOfTodayIST },
        },
      });

      if (!existingParentNotif) {
        await prisma.notification.create({
          data: {
            userId: parentUser.id,
            title: parentTitle,
            body: parentBody,
            type: "SUCCESS",
            link: "/parent",
            priority: "HIGH",
          },
        });
        parentNotifsSent++;

        try {
          await sendPushToUser(parentUser.id, {
            title: parentTitle,
            body: parentBody,
            url: "/parent",
          });
        } catch { }
      }
    }
  }

  console.log(`🗑️ Removed ${purgedAbsenceNotifs} false absence notification(s) across students and parents.`);
  console.log(`📬 Dispatched ${studentNotifsSent} verified notification(s) to Talabat.`);
  console.log(`📬 Dispatched ${parentNotifsSent} verified notification(s) to Parents.`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: APPLICATION CACHE INVALIDATION & GOOGLE SHEETS RE-SYNC
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n🧹 Invalidating in-memory application caches...`);
  cache.clear();
  console.log(`✅ Cache cleared completely.`);

  if (process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID) {
    console.log(`\n☁️ Synchronizing live attendance log to Google Sheets...`);
    try {
      const sheetRes = await syncDailyAttendanceToSheet(targetDate);
      console.log(`✅ Google Sheet Synced: ${sheetRes.rowsSynced} row(s) to tab "${sheetRes.tabTitle}"`);
      console.log(`   Spreadsheet URL: ${sheetRes.url}`);
    } catch (sheetErr: any) {
      console.warn(`⚠️ Google Sheet sync warning:`, sheetErr?.message || sheetErr);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7: FINAL RECONCILIATION SUMMARY AUDIT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n================================================================================`);
  console.log(`                  FINAL TALABAT ATTENDANCE RECONCILIATION AUDIT                 `);
  console.log(`================================================================================`);

  const finalRegistries = await prisma.attendanceRegistry.groupBy({
    by: ["status"],
    where: { date: targetDate },
    _count: { id: true },
  });
  console.log("📊 AttendanceRegistry (Gate Level) Summary:", finalRegistries);

  const finalClassRecords = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { date: targetDate },
    _count: { id: true },
  });
  console.log("📊 AttendanceRecord (Class Level) Summary:", finalClassRecords);

  // List of truly absent students (no scan and no approved leave)
  const trulyAbsentStudents = await prisma.studentProfile.findMany({
    where: {
      attendanceRegistries: {
        none: {
          date: targetDate,
          status: { in: ["PRESENT", "LATE", "ON_LEAVE", "MEDICAL"] },
        },
      },
    },
    include: { user: true },
    orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
  });

  console.log(`\n📋 Truly Absent Students Today (${trulyAbsentStudents.length} total):`);
  console.log(`--------------------------------------------------------------------------------`);
  for (const s of trulyAbsentStudents) {
    const darjah = s.grade ? `Darajah ${s.grade}${s.section || ""}` : "Unassigned";
    console.log(`  - ${s.user.firstName} ${s.user.lastName} (${darjah} · ITS: ${s.its || s.studentId || "—"})`);
  }

  console.log(`\n================================================================================`);
  console.log(`🏁 ATTENDANCE POLLING, RECONCILIATION & PARENT/TALABAT UPDATE COMPLETED!`);
  console.log(`================================================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR in attendance poll & update:", err);
    process.exit(1);
  });
