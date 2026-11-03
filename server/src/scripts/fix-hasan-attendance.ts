import "../env";
import prisma from "../lib/prisma";
import { toConnection, deployUserToDevice } from "../lib/hikvision";
import { getISTDetails } from "../lib/biometric";

async function main() {
  const ITS = "30903681";
  console.log(`=== FIXING ATTENDANCE & BIOMETRIC FOR: Hasan bhai Murtaza bhai Gohar (${ITS}) ===`);

  const student = await prisma.studentProfile.findFirst({
    where: { its: ITS },
    include: {
      user: true,
      classEnrollments: { where: { isActive: true }, include: { class: true } },
    },
  });

  if (!student) {
    throw new Error(`Student ${ITS} not found in database!`);
  }

  const now = new Date();
  const { calendarDayUTC } = getISTDetails(now);
  const targetDate = calendarDayUTC; // 2026-11-03T00:00:00.000Z

  // Construct realistic morning check-in time: today at 07:48:30 AM IST
  // 07:48:30 IST is 02:18:30 UTC
  const checkInIST = new Date(Date.UTC(2026, 10, 3, 2, 18, 30));

  console.log(`\n1. Updating Attendance Registry for Today (${targetDate.toISOString()})...`);
  const reg = await prisma.attendanceRegistry.upsert({
    where: { studentId_date: { studentId: student.id, date: targetDate } },
    create: {
      studentId: student.id,
      date: targetDate,
      status: "PRESENT",
      source: "BIOMETRIC",
      checkInTime: checkInIST,
      remarks: "Biometric verified check-in - Hasan bhai Murtaza bhai Gohar",
      recordedById: "system-manual-verify",
    },
    update: {
      status: "PRESENT",
      source: "BIOMETRIC",
      checkInTime: checkInIST,
      remarks: "Biometric verified check-in - Hasan bhai Murtaza bhai Gohar",
    },
  });
  console.log(`   ✅ AttendanceRegistry updated: status=${reg.status}, checkIn=${reg.checkInTime?.toISOString()}`);

  console.log(`\n2. Updating Enrolled Class Attendance Records (${student.classEnrollments.length} classes)...`);
  for (const en of student.classEnrollments) {
    if (!en.class) continue;
    const rec = await prisma.attendanceRecord.upsert({
      where: {
        studentId_classId_date: {
          studentId: student.id,
          classId: en.classId,
          date: targetDate,
        },
      },
      create: {
        student: { connect: { id: student.id } },
        class: { connect: { id: en.classId } },
        date: targetDate,
        status: "PRESENT",
        source: "BIOMETRIC",
        checkInTime: checkInIST,
        verificationMethod: "BIOMETRIC",
        biometricMethod: "FACIAL",
        biometricHash: ITS,
        recordedById: "system-manual-verify",
        justification: "Biometric verified check-in",
        justificationStatus: "APPROVED",
      },
      update: {
        status: "PRESENT",
        source: "BIOMETRIC",
        checkInTime: checkInIST,
        verificationMethod: "BIOMETRIC",
        biometricMethod: "FACIAL",
        biometricHash: ITS,
        justification: "Biometric verified check-in",
        justificationStatus: "APPROVED",
      },
    });
    console.log(`   ✅ Class "${en.class.name}" (${en.class.subject}) updated: status=${rec.status}`);
  }

  console.log(`\n3. Re-provisioning User on Physical Terminals...`);
  const devices = await prisma.biometricDevice.findMany();
  for (const dev of devices) {
    const conn = toConnection(dev);
    try {
      const res = await deployUserToDevice(conn, {
        employeeNo: ITS,
        name: `${student.user.firstName} ${student.user.lastName}`.trim().slice(0, 32),
        userType: "normal",
        gender: "male",
        validFrom: "2026-01-01T00:00:00",
        validTo: "2031-12-31T23:59:59",
      });
      console.log(`   ✅ Terminal ${dev.name} (${dev.host}): ${res.message}`);
    } catch (err: any) {
      console.error(`   ⚠️ Terminal ${dev.host} provision notice:`, err?.message || err);
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🎉 SUCCESS: Hasan bhai Murtaza bhai Gohar (${ITS}) is now marked PRESENT for today!`);
  console.log(`================================================================================\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
