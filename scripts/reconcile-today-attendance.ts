import prisma from "../server/src/lib/prisma";
import { syncDailyAttendanceToSheet } from "../server/src/lib/google-attendance-sync";

async function main() {
  const dayStart = new Date("2026-11-02T00:00:00+05:30");
  const dayEnd = new Date("2026-11-02T23:59:59+05:30");

  console.log("=== Sorting & Reconciling Today Attendance (2026-11-02) ===");

  // 1. Talabat (Students)
  // Window: 07:35 - 07:50 (on-time -> PRESENT), 07:50 - 08:30 (LATE), no scan -> ABSENT
  const registries = await prisma.attendanceRegistry.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
    include: { student: { include: { user: true } } },
  });

  let stuPresent = 0, stuLate = 0, stuAbsent = 0;
  for (const reg of registries) {
    let newStatus = "ABSENT";
    let remarks = reg.remarks;
    let source = reg.source;

    if (reg.checkInTime) {
      const d = new Date(reg.checkInTime);
      // IST is UTC+5:30
      const totalMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
      if (totalMinutes <= (7 * 60 + 50)) {
        newStatus = "PRESENT";
        remarks = `On-time biometric check-in at ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`;
      } else {
        newStatus = "LATE";
        remarks = `Late biometric check-in at ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} (after 07:50)`;
      }
      source = "BIOMETRIC";
    } else {
      newStatus = "ABSENT";
      remarks = "Auto-marked absent (no device scan recorded)";
      source = "AUTO_ABSENT";
    }

    if (newStatus === "PRESENT") stuPresent++;
    else if (newStatus === "LATE") stuLate++;
    else stuAbsent++;

    await prisma.attendanceRegistry.update({
      where: { id: reg.id },
      data: { status: newStatus, remarks, source },
    });

    await prisma.attendanceRecord.updateMany({
      where: { studentId: reg.studentId, date: { gte: dayStart, lt: dayEnd } },
      data: {
        status: newStatus as any,
        source: (source === "BIOMETRIC" ? "BIOMETRIC" : "AUTO_ABSENT") as any,
        verificationMethod: source === "BIOMETRIC" ? "BIOMETRIC" : "AUTO_SYSTEM",
        justification: newStatus === "ABSENT" ? "No biometric scan recorded" : null,
      },
    });
  }

  // 2. Faculty (Teachers)
  // Window: 07:35 - 08:03 (on-time -> PRESENT), 08:03 - 08:30 (LATE), no scan -> ABSENT
  const teacherRecords = await prisma.teacherAttendanceRecord.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
    include: { teacher: { include: { user: true } } },
  });

  let facPresent = 0, facLate = 0, facAbsent = 0;
  for (const tr of teacherRecords) {
    let newStatus = "ABSENT";
    let notes = tr.notes;

    if (tr.checkInTime) {
      const d = new Date(tr.checkInTime);
      const totalMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
      if (totalMinutes <= (8 * 60 + 3)) {
        newStatus = "PRESENT";
        notes = `On-time biometric check-in at ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`;
      } else {
        newStatus = "LATE";
        notes = `Late biometric check-in at ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} (after 08:03)`;
      }
    } else {
      newStatus = "ABSENT";
      notes = "Auto-marked absent (no scan inside faculty window)";
    }

    if (newStatus === "PRESENT") facPresent++;
    else if (newStatus === "LATE") facLate++;
    else facAbsent++;

    await prisma.teacherAttendanceRecord.update({
      where: { id: tr.id },
      data: { status: newStatus as any, notes },
    });
  }

  console.log("=== Reconciliation Complete ===");
  console.log("Talabat Results:", { total: registries.length, present: stuPresent, late: stuLate, absent: stuAbsent });
  console.log("Faculty Results:", { total: teacherRecords.length, present: facPresent, late: facLate, absent: facAbsent });

  // 3. Trigger Google Sheet Sync
  try {
    console.log("Syncing reconciled records to Google Sheets...");
    const sheetRes = await syncDailyAttendanceToSheet(dayStart);
    console.log("Google Sheets sync result:", sheetRes);
  } catch (err: any) {
    console.warn("Google Sheets sync note:", err?.message || err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });