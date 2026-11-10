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
import { getISTDetails } from "../lib/biometric";
import { syncDailyAttendanceToSheet } from "../lib/google-attendance-sync";
import { cache } from "../lib/cache";
import { sendPushToUser } from "../lib/push";

async function main() {
  console.log("================================================================================");
  console.log("         COMPREHENSIVE TODAY ATTENDANCE FIX, SYNC & NOTIFICATION DISPATCH       ");
  console.log("================================================================================");

  const now = new Date();
  const { calendarDayUTC, timeFormatted12 } = getISTDetails(now);
  const targetDate = calendarDayUTC; // 2026-11-10T00:00:00.000Z
  const startOfTodayIST = getStartOfTodayIST();
  const endOfTodayIST = new Date(startOfTodayIST.getTime() + 24 * 60 * 60 * 1000 - 1);
  const istDateString = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

  console.log(`📅 Target Date (IST): ${istDateString} | Current Time: ${timeFormatted12}`);
  console.log(`🕒 Normalized DB Date: ${targetDate.toISOString()}`);
  console.log(`🕒 Polling Range: ${startOfTodayIST.toISOString()} → ${now.toISOString()}\n`);

  // 1. Force poll all 3 biometric terminals from the very start of today
  const devices = await prisma.biometricDevice.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`📡 Connecting to ${devices.length} biometric terminal(s)...`);

  for (const dev of devices) {
    console.log(`\n👉 Polling Terminal: "${dev.name}" (${dev.host}:${dev.port})...`);
    try {
      const pollRes = await pollDevice(dev.id, false);
      console.log(`   ✅ Poll Completed: Fetched=${pollRes.scansFetched}, Processed=${pollRes.scansProcessed}`);
    } catch (err: any) {
      console.error(`   ❌ Failed polling device ${dev.host}:`, err?.message || err);
    }
  }

  // 1b. Specifically handle Shaikh Murtaza Jamali (ITS 30387984, enrolled on device as 3038798)
  const murtazaJamali = await prisma.teacherProfile.findFirst({
    where: { its: "30387984" },
    include: { user: true }
  });
  if (murtazaJamali) {
    const jamaliCheckIn = new Date("2026-11-10T02:37:31.000Z"); // 08:07:31 am IST
    await prisma.teacherAttendanceRecord.upsert({
      where: { teacherId_date: { teacherId: murtazaJamali.id, date: targetDate } },
      create: {
        teacherId: murtazaJamali.id,
        date: targetDate,
        status: "LATE",
        checkInTime: jamaliCheckIn,
        verificationMethod: "BIOMETRIC",
      },
      update: {
        status: "LATE",
        checkInTime: jamaliCheckIn,
        verificationMethod: "BIOMETRIC",
      },
    });
    console.log(`✅ Shaikh Murtaza Jamali (30387984) attendance verified & updated to LATE (08:07 am IST).`);
  }

  // 2. Fetch all verified student check-ins from AttendanceRegistry for today
  const verifiedRegistries = await prisma.attendanceRegistry.findMany({
    where: {
      date: targetDate,
      status: { in: ["PRESENT", "LATE"] },
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
  console.log(`\n🎯 Verified Scanned Students in Registry: ${verifiedRegistries.length}`);

  let recordsUpdated = 0;
  let notificationsDispatched = 0;
  let falseAbsenceDeleted = 0;

  for (const reg of verifiedRegistries) {
    const s = reg.student;
    const checkInTime = reg.checkInTime || new Date();
    const timeStrIST = checkInTime.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const status = reg.status; // PRESENT or LATE

    // A. Propagate to ALL enrolled classes for this student
    const enrollments = s.classEnrollments.filter((e) => e.class && e.class.isActive);
    for (const en of enrollments) {
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
          source: "BIOMETRIC",
          verificationMethod: "BIOMETRIC",
          checkInTime,
          recordedById: reg.recordedById || "biometric-hardware-sync",
          justification: null,
          justificationStatus: "NONE",
        },
        update: {
          status,
          source: "BIOMETRIC",
          verificationMethod: "BIOMETRIC",
          checkInTime,
          justification: null,
          justificationStatus: "NONE",
        },
      });
      recordsUpdated++;
    }

    // B. Restore streak days if it was mistakenly wiped
    // Count past consecutive days with PRESENT/LATE
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
    let calculatedStreak = 1; // today is present
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
    }

    // C. Delete false "Absence Logged" notifications created today
    const delRes = await prisma.notification.deleteMany({
      where: {
        userId: s.userId,
        title: "Absence Logged",
        createdAt: { gte: startOfTodayIST },
      },
    });
    falseAbsenceDeleted += delRes.count;

    // D. Dispatch official attendance confirmation notification to student
    const studentTitle = `⚡ Attendance Verified: Marked ${status}`;
    const studentBody = `Your biometric attendance has been recorded and verified as ${status} for today (${istDateString}) at ${timeStrIST} IST.`;
    
    // Check if notification already exists to prevent duplicate flooding
    const existingStudentNotif = await prisma.notification.findFirst({
      where: {
        userId: s.userId,
        title: { startsWith: "⚡ Attendance Verified" },
        createdAt: { gte: startOfTodayIST },
      },
    });

    if (!existingStudentNotif) {
      await prisma.notification.create({
        data: {
          userId: s.userId,
          title: studentTitle,
          body: studentBody,
          type: "SUCCESS",
          link: "/talabat/attendance",
          priority: "HIGH",
        },
      });
      notificationsDispatched++;

      try {
        await sendPushToUser(s.userId, {
          title: studentTitle,
          body: studentBody,
          url: "/talabat/attendance",
        });
      } catch { }
    }

    // E. Dispatch attendance confirmation notification to linked Parents
    const studentFullName = `${s.user.firstName} ${s.user.lastName}`.trim();
    const parentTitle = `⚡ Attendance Verified: ${studentFullName}`;
    const parentBody = `${studentFullName} has been verified and marked ${status} for today (${istDateString}) with biometric check-in at ${timeStrIST} IST.`;

    for (const link of s.parentLinks) {
      const parentUser = link.parent?.user;
      if (!parentUser) continue;

      // Delete any false absence alerts for the parent
      await prisma.notification.deleteMany({
        where: {
          userId: parentUser.id,
          title: { contains: "Absence" },
          createdAt: { gte: startOfTodayIST },
        },
      });

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
        notificationsDispatched++;

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

  console.log(`\n✅ Synced & fixed class attendance records: ${recordsUpdated}`);
  console.log(`🗑️ Removed false "Absence Logged" alerts: ${falseAbsenceDeleted}`);
  console.log(`📬 Dispatched verified attendance notifications: ${notificationsDispatched}`);

  // 3. Process Approved Student Leaves for Today
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

    // Only update if not already scanned PRESENT
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

      for (const en of s.classEnrollments) {
        if (!en.class) continue;
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
            status: leaveStatus,
            source: "LEAVE_APPROVED",
            verificationMethod: "LEAVE_PORTAL",
            justification: `[Leave Approved] ${leave.reason || ""}`,
            justificationStatus: "APPROVED",
            recordedById: leave.reviewerId || "admin-leave-sync",
          },
          update: {
            status: leaveStatus,
            source: "LEAVE_APPROVED",
            justification: `[Leave Approved] ${leave.reason || ""}`,
            justificationStatus: "APPROVED",
          },
        });
      }
      console.log(`  ✅ Student ${s.user.firstName} ${s.user.lastName} marked ${leaveStatus} per approved leave.`);
    }
  }

  // 4. Invalidate all cache across the entire application
  console.log(`\n🧹 Invalidating and clearing in-memory application caches...`);
  cache.clear();
  console.log(`✅ Cache cleared completely.`);

  // 5. Cloud Google Sheets synchronization
  if (process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID) {
    console.log(`\n☁️ Syncing live attendance data to Google Sheets...`);
    try {
      const sheetRes = await syncDailyAttendanceToSheet(targetDate);
      console.log(`✅ Google Sheet Synced: ${sheetRes.rowsSynced} row(s) to "${sheetRes.tabTitle}"`);
      console.log(`   URL: ${sheetRes.url}`);
    } catch (sheetErr: any) {
      console.warn(`⚠️ Google Sheet sync warning:`, sheetErr?.message || sheetErr);
    }
  }

  // 6. Final Status Audit Report
  console.log(`\n================================================================================`);
  console.log(`                     FINAL ATTENDANCE RECONCILIATION AUDIT                      `);
  console.log(`================================================================================`);

  const finalRecords = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { date: targetDate },
    _count: { id: true },
  });
  console.log("📊 AttendanceRecord (Class Level) by Status:", finalRecords);

  const finalRegistries = await prisma.attendanceRegistry.groupBy({
    by: ["status"],
    where: { date: targetDate },
    _count: { id: true },
  });
  console.log("📊 AttendanceRegistry (Gate Level) by Status:", finalRegistries);

  const finalTeachers = await prisma.teacherAttendanceRecord.groupBy({
    by: ["status"],
    where: { date: targetDate },
    _count: { id: true },
  });
  console.log("📊 TeacherAttendanceRecord by Status:", finalTeachers);

  console.log(`\n================================================================================`);
  console.log(`🏁 ATTENDANCE FIX, SYNC & NOTIFICATION COMPLETE!`);
  console.log(`================================================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR in attendance sync:", err);
    process.exit(1);
  });

