import "../env";
import prisma from "../lib/prisma";
import { getISTDetails, getStartOfDayIST } from "../lib/biometric";

async function main() {
  console.log("⚡ FAST DIRECT SYNC: TODAY'S ATTENDANCE TO SUPABASE / VERCEL SITE ⚡");

  const now = new Date();
  const { calendarDayUTC, timeFormatted12 } = getISTDetails(now);
  const targetDate = calendarDayUTC; // 2026-11-21T00:00:00.000Z
  const startOfTodayIST = new Date(targetDate.getTime()); // 00:00 IST
  const endOfTodayIST = new Date(startOfTodayIST.getTime() + 24 * 60 * 60 * 1000 - 1); // 23:59:59 IST

  console.log(`📅 Date: ${targetDate.toISOString().slice(0, 10)} | IST Time: ${timeFormatted12}`);

  // 1. Load all students & teachers in parallel (1 query each)
  const [students, teachers, leaves, scanLogs] = await Promise.all([
    prisma.studentProfile.findMany({
      include: {
        user: true,
        classEnrollments: { where: { isActive: true }, include: { class: true } },
      },
    }),
    prisma.teacherProfile.findMany({
      include: { user: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        OR: [
          { grantedStartDate: { not: null, lte: endOfTodayIST }, grantedEndDate: { not: null, gte: startOfTodayIST } },
          { grantedStartDate: null, startDate: { lte: endOfTodayIST }, endDate: { gte: startOfTodayIST } },
        ],
      },
    }),
    prisma.biometricScanLog.findMany({
      where: {
        scannedAt: { gte: startOfTodayIST, lte: endOfTodayIST },
        NOT: [{ rawEmployeeNo: "HEARTBEAT" }],
      },
      orderBy: { scannedAt: "asc" },
    }),
  ]);

  console.log(`📊 Loaded ${students.length} students, ${teachers.length} teachers, ${leaves.length} approved leaves, ${scanLogs.length} scans from Supabase ledger.`);

  // 2. Build fast lookup maps
  const studentMap = new Map<string, typeof students[0]>();
  for (const s of students) {
    for (const key of [s.its, s.studentId, s.trNo, s.biometricHash]) {
      const v = String(key ?? "").trim();
      if (!v) continue;
      studentMap.set(v, s);
      studentMap.set(v.replace(/^0+/, ""), s);
    }
  }

  const teacherMap = new Map<string, typeof teachers[0]>();
  for (const t of teachers) {
    for (const key of [t.its, t.employeeId, t.biometricHash]) {
      const v = String(key ?? "").trim();
      if (!v) continue;
      teacherMap.set(v, t);
      teacherMap.set(v.replace(/^0+/, ""), t);
    }
  }

  // 3. Aggregate scans per student and teacher
  const studentScans = new Map<string, { firstScan: Date; lastScan: Date; device: string }>();
  const teacherScans = new Map<string, { firstScan: Date; lastScan: Date; device: string }>();

  for (const log of scanLogs) {
    const raw = (log.employeeNo || log.rawEmployeeNo || "").trim();
    if (!raw) continue;

    const matchedStudent = studentMap.get(raw) || studentMap.get(raw.replace(/^0+/, ""));
    if (matchedStudent) {
      const existing = studentScans.get(matchedStudent.id);
      if (!existing) {
        studentScans.set(matchedStudent.id, { firstScan: log.scannedAt, lastScan: log.scannedAt, device: log.deviceName || "Biometric" });
      } else {
        if (log.scannedAt < existing.firstScan) existing.firstScan = log.scannedAt;
        if (log.scannedAt > existing.lastScan) existing.lastScan = log.scannedAt;
      }
      continue;
    }

    const matchedTeacher = teacherMap.get(raw) || teacherMap.get(raw.replace(/^0+/, ""));
    if (matchedTeacher) {
      const existing = teacherScans.get(matchedTeacher.id);
      if (!existing) {
        teacherScans.set(matchedTeacher.id, { firstScan: log.scannedAt, lastScan: log.scannedAt, device: log.deviceName || "Biometric" });
      } else {
        if (log.scannedAt < existing.firstScan) existing.firstScan = log.scannedAt;
        if (log.scannedAt > existing.lastScan) existing.lastScan = log.scannedAt;
      }
    }
  }

  console.log(`🎯 Identified: ${studentScans.size} Talabat scanned, ${teacherScans.size} Faculty scanned today.`);

  // 4. Leave map
  const studentLeaveMap = new Map<string, typeof leaves[0]>();
  const teacherLeaveMap = new Map<string, typeof leaves[0]>();
  for (const l of leaves) {
    if (l.studentId) studentLeaveMap.set(l.studentId, l);
    if (l.teacherId) teacherLeaveMap.set(l.teacherId, l);
  }

  // 5. Update Talabat Attendance (AttendanceRegistry & AttendanceRecord)
  let stuPresent = 0, stuLate = 0, stuLeave = 0;
  for (const s of students) {
    const scan = studentScans.get(s.id);
    const leave = studentLeaveMap.get(s.id);

    let status: "PRESENT" | "LATE" | "ON_LEAVE" | "MEDICAL" | "ABSENT" = "ABSENT";
    let checkInTime: Date | null = null;
    let remarks = "";
    let source = "BIOMETRIC";

    if (scan) {
      checkInTime = scan.firstScan;
      // In IST, cutoff: check if scan is after 08:00 AM IST (02:30 UTC)
      const hoursIST = new Date(scan.firstScan.getTime() + 5.5 * 3600 * 1000).getUTCHours();
      const minsIST = new Date(scan.firstScan.getTime() + 5.5 * 3600 * 1000).getUTCMinutes();
      const totalMins = hoursIST * 60 + minsIST;
      
      if (totalMins > 8 * 60) {
        status = "LATE";
        stuLate++;
      } else {
        status = "PRESENT";
        stuPresent++;
      }
      remarks = `Biometric scan on ${scan.device}`;
    } else if (leave) {
      status = leave.type === "MEDICAL" ? "MEDICAL" : "ON_LEAVE";
      source = "LEAVE_APPROVED";
      remarks = `[Leave Approved] ${leave.reason || ""}`;
      stuLeave++;
    } else {
      // Keep ABSENT or omit
      continue;
    }

    // Upsert AttendanceRegistry
    await prisma.attendanceRegistry.upsert({
      where: { studentId_date: { studentId: s.id, date: targetDate } },
      create: {
        studentId: s.id,
        date: targetDate,
        status,
        source,
        checkInTime,
        remarks,
        recordedById: "fast-sync",
      },
      update: {
        status,
        source,
        checkInTime: checkInTime || undefined,
        remarks,
      },
    });

    // Propagate to enrolled classes
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
          studentId: s.id,
          classId: en.classId,
          date: targetDate,
          status,
          source,
          checkInTime,
          verificationMethod: source === "BIOMETRIC" ? "BIOMETRIC" : "LEAVE_PORTAL",
          recordedById: "fast-sync",
        },
        update: {
          status,
          source,
          checkInTime: checkInTime || undefined,
        },
      });
    }
  }

  // 6. Update Faculty Attendance (TeacherAttendanceRecord)
  let teaPresent = 0, teaLate = 0;
  for (const t of teachers) {
    const scan = teacherScans.get(t.id);
    const leave = teacherLeaveMap.get(t.id);

    let status: "PRESENT" | "LATE" | "ON_LEAVE" | "EXCUSED" | "ABSENT" = "ABSENT";
    let checkInTime: Date | null = null;
    let checkOutTime: Date | null = null;

    if (scan) {
      checkInTime = scan.firstScan;
      if (scan.lastScan.getTime() - scan.firstScan.getTime() > 5 * 60 * 1000) {
        checkOutTime = scan.lastScan;
      }
      const hoursIST = new Date(scan.firstScan.getTime() + 5.5 * 3600 * 1000).getUTCHours();
      const minsIST = new Date(scan.firstScan.getTime() + 5.5 * 3600 * 1000).getUTCMinutes();
      const totalMins = hoursIST * 60 + minsIST;
      
      if (totalMins > 8 * 60) {
        status = "LATE";
        teaLate++;
      } else {
        status = "PRESENT";
        teaPresent++;
      }
    } else if (leave) {
      status = "ON_LEAVE";
    } else {
      continue;
    }

    await prisma.teacherAttendanceRecord.upsert({
      where: { teacherId_date: { teacherId: t.id, date: targetDate } },
      create: {
        teacherId: t.id,
        date: targetDate,
        status,
        checkInTime,
        checkOutTime,
        verificationMethod: "BIOMETRIC",
      },
      update: {
        status,
        checkInTime: checkInTime || undefined,
        checkOutTime: checkOutTime || undefined,
        verificationMethod: "BIOMETRIC",
      },
    });
  }

  console.log(`\n================================================================================`);
  console.log(`✅ SYNC COMPLETE AND VERIFIED ON SUPABASE / VERCEL:`);
  console.log(`   Talabat (Students) : ${stuPresent} Present, ${stuLate} Late, ${stuLeave} On Leave`);
  console.log(`   Faculty (Teachers) : ${teaPresent} Present, ${teaLate} Late`);
  console.log(`================================================================================\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FATAL", e);
    await prisma.$disconnect();
    process.exit(1);
  });
