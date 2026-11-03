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
import { syncGateRegistryToClassAttendance } from "../lib/attendance-scheduler";
import { syncDailyAttendanceToSheet } from "../lib/google-attendance-sync";

async function main() {
  console.log("================================================================================");
  console.log("           PROPER ATTENDANCE POLLING & SYNCHRONIZATION FOR ALL USERS            ");
  console.log("================================================================================");

  const now = new Date();
  const { calendarDayUTC, timeFormatted12 } = getISTDetails(now);
  const targetDate = calendarDayUTC; // 2026-11-03T00:00:00.000Z
  const startOfTodayIST = getStartOfTodayIST();
  const endOfTodayIST = new Date(startOfTodayIST.getTime() + 24 * 60 * 60 * 1000 - 1);
  const istDateString = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

  console.log(`📅 Target Date (IST): ${istDateString} | Current Time: ${timeFormatted12}`);
  console.log(`🕒 Normalized DB Date: ${targetDate.toISOString()}`);
  console.log(`🕒 Terminal Polling Range: ${startOfTodayIST.toISOString()} → ${now.toISOString()}\n`);

  // 1. Fetch and Poll all configured biometric devices
  const devices = await prisma.biometricDevice.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`📡 Discovered ${devices.length} biometric terminal(s) in system.`);

  let totalScansFetched = 0;
  let totalScansProcessed = 0;

  for (const dev of devices) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`👉 Connecting to Terminal: "${dev.name}" (${dev.host}:${dev.port}) [Enabled: ${dev.enabled}]`);
    const conn = toConnection(dev);

    try {
      const info = await getDeviceInfo(conn);
      console.log(`   ✅ Device Online: ${info.model} | Serial: ${info.serialNumber} | FW: ${info.firmwareVersion}`);

      // Query raw ACS events for today
      const { events } = await getAcsEvents(conn, startOfTodayIST, now);
      const attendanceEvents = events.filter(isAttendanceEvent);
      console.log(`   📊 Today's ACS Events: ${events.length} total (${attendanceEvents.length} attendance events)`);

      // Poll device with force=true to ensure full lookback from start of today
      console.log(`   🔄 Executing live pollDevice()...`);
      const pollRes = await pollDevice(dev.id, true, startOfTodayIST, now);
      console.log(`   ✅ Poll Completed: Fetched=${pollRes.scansFetched}, Processed=${pollRes.scansProcessed}`);

      totalScansFetched += pollRes.scansFetched;
      totalScansProcessed += pollRes.scansProcessed;
    } catch (err: any) {
      console.error(`   ❌ Failed polling device ${dev.host}:`, err?.message || err);
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🎯 Hardware Terminal Summary: Fetched ${totalScansFetched} scans, Processed ${totalScansProcessed} events`);
  console.log(`================================================================================`);

  // 2. Propagate all gate check-ins to class attendance records
  console.log(`\n🔄 Propagating Gate Registry Check-Ins to all student enrolled classes...`);
  await syncGateRegistryToClassAttendance(now);
  console.log(`✅ Gate Registry propagation finished.`);

  // 3. Sync Approved Student Leaves for Today (considering granted dates if modified by admin)
  console.log(`\n🔄 Syncing active approved student leave requests for today...`);
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
        },
      },
    },
  });

  for (const leave of activeStudentLeaves) {
    const s = leave.student;
    const leaveStatus = leave.type === "MEDICAL" ? "MEDICAL" : "ON_LEAVE";

    // Update AttendanceRegistry
    await prisma.attendanceRegistry.upsert({
      where: { studentId_date: { studentId: s.id, date: targetDate } },
      create: {
        studentId: s.id,
        date: targetDate,
        status: leaveStatus,
        source: "PORTAL",
        remarks: `[Leave Approved] ${leave.reason || ""}`,
        leaveId: leave.id,
        recordedById: leave.approvedById || "admin-leave-sync",
      },
      update: {
        status: leaveStatus,
        source: "PORTAL",
        remarks: `[Leave Approved] ${leave.reason || ""}`,
        leaveId: leave.id,
      },
    });

    // Update all enrolled classes
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
          source: "PORTAL",
          verificationMethod: "LEAVE_PORTAL",
          justification: `[Leave Approved] ${leave.reason || ""}`,
          justificationStatus: "APPROVED",
          recordedById: leave.approvedById || "admin-leave-sync",
        },
        update: {
          status: leaveStatus,
          source: "PORTAL",
          justification: `[Leave Approved] ${leave.reason || ""}`,
          justificationStatus: "APPROVED",
        },
      });
    }
  }
  console.log(`✅ Synced ${activeStudentLeaves.length} student approved leave(s).`);

  // 4. Audit & Display Attendance for Students (Talabat)
  console.log(`\n================================================================================`);
  console.log(`                     STUDENT (TALABAT) ATTENDANCE AUDIT                         `);
  console.log(`================================================================================`);

  const allStudents = await prisma.studentProfile.findMany({
    include: {
      user: true,
      classEnrollments: { where: { isActive: true }, include: { class: true } },
    },
    orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
  });

  const registriesToday = await prisma.attendanceRegistry.findMany({
    where: { date: targetDate },
  });
  const regMap = new Map(registriesToday.map((r) => [r.studentId, r]));

  let stuPresent = 0;
  let stuLate = 0;
  let stuLeave = 0;
  let stuMedical = 0;
  let stuAbsent = 0;
  let stuUnrecorded = 0;

  console.log(`Total Registered Students: ${allStudents.length}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(
    `| ${"ITS / ID".padEnd(12)} | ${"Student Name".padEnd(26)} | ${"Darajah".padEnd(10)} | ${"Status".padEnd(10)} | ${"Check-In".padEnd(10)} |`
  );
  console.log(`--------------------------------------------------------------------------------`);

  for (const s of allStudents) {
    const reg = regMap.get(s.id);
    const its = s.its || s.studentId || "-";
    const name = `${s.user.firstName} ${s.user.lastName}`.trim().slice(0, 26);
    const darajah = (s.grade ? `${s.grade}${s.section ? " " + s.section : ""}` : "Unassigned").slice(0, 10);
    const status = reg ? reg.status : "UNRECORDED";
    const checkIn = reg?.checkInTime
      ? new Date(reg.checkInTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
      : "-";

    if (status === "PRESENT") stuPresent++;
    else if (status === "LATE") stuLate++;
    else if (status === "ON_LEAVE") stuLeave++;
    else if (status === "MEDICAL") stuMedical++;
    else if (status === "ABSENT") stuAbsent++;
    else stuUnrecorded++;

    console.log(
      `| ${its.padEnd(12)} | ${name.padEnd(26)} | ${darajah.padEnd(10)} | ${status.padEnd(10)} | ${checkIn.padEnd(10)} |`
    );
  }

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 Student Summary: Present=${stuPresent} | Late=${stuLate} | On Leave=${stuLeave} | Medical=${stuMedical} | Absent=${stuAbsent} | Unrecorded=${stuUnrecorded}`);

  // 5. Audit & Display Attendance for Faculty (Asaatizah)
  console.log(`\n================================================================================`);
  console.log(`                     FACULTY (ASAATIZAH) ATTENDANCE AUDIT                       `);
  console.log(`================================================================================`);

  const allTeachers = await prisma.teacherProfile.findMany({
    include: { user: true },
    orderBy: { user: { firstName: "asc" } },
  });

  const teacherRecordsToday = await prisma.teacherAttendanceRecord.findMany({
    where: { date: targetDate },
  });
  const teaMap = new Map(teacherRecordsToday.map((t) => [t.teacherId, t]));

  let teaPresent = 0;
  let teaLate = 0;
  let teaLeave = 0;
  let teaMedical = 0;
  let teaAbsent = 0;
  let teaUnrecorded = 0;

  console.log(`Total Registered Faculty: ${allTeachers.length}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(
    `| ${"ITS / EMP".padEnd(12)} | ${"Faculty Name".padEnd(26)} | ${"Department".padEnd(14)} | ${"Status".padEnd(10)} | ${"Check-In".padEnd(10)} |`
  );
  console.log(`--------------------------------------------------------------------------------`);

  for (const t of allTeachers) {
    const rec = teaMap.get(t.id);
    const its = t.its || t.employeeId || "-";
    const name = `${t.user.firstName} ${t.user.lastName}`.trim().slice(0, 26);
    const dept = (t.department || "General").slice(0, 14);
    const status = rec ? rec.status : "UNRECORDED";
    const checkIn = rec?.checkInTime
      ? new Date(rec.checkInTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
      : "-";

    if (status === "PRESENT") teaPresent++;
    else if (status === "LATE") teaLate++;
    else if (status === "ON_LEAVE") teaLeave++;
    else if (status === "MEDICAL") teaMedical++;
    else if (status === "ABSENT") teaAbsent++;
    else teaUnrecorded++;

    console.log(
      `| ${its.padEnd(12)} | ${name.padEnd(26)} | ${dept.padEnd(14)} | ${status.padEnd(10)} | ${checkIn.padEnd(10)} |`
    );
  }

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 Faculty Summary: Present=${teaPresent} | Late=${teaLate} | On Leave=${teaLeave} | Medical=${teaMedical} | Absent=${teaAbsent} | Unrecorded=${teaUnrecorded}`);

  // 6. Google Sheet Sync if configured
  if (process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID) {
    console.log(`\n================================================================================`);
    console.log(`🔄 Syncing live attendance log to Google Sheets...`);
    try {
      const sheetRes = await syncDailyAttendanceToSheet(targetDate);
      console.log(`✅ Google Sheet Synced: ${sheetRes.rowsSynced} row(s) to "${sheetRes.tabTitle}"`);
      console.log(`   URL: ${sheetRes.url}`);
    } catch (sheetErr: any) {
      console.warn(`⚠️ Google Sheet sync notice:`, sheetErr?.message || sheetErr);
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🏁 ATTENDANCE POLLING & AUDIT COMPLETE!`);
  console.log(`================================================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR during attendance poll:", err);
    process.exit(1);
  });
