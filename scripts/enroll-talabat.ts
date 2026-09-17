import { PrismaClient } from "@prisma/client";

/**
 * Enroll a talabat (by TR number) into a class and make sure the class has
 * timetable slots so biometric scans produce attendance records.
 *
 * Usage:
 *   npx tsx scripts/enroll-talabat.ts [trNo] [classId] [startTime] [endTime]
 *
 * Defaults: trNo=794, classId=<Quran Studies>, 07:00–12:30, Mon–Sat.
 * Idempotent: safe to run again — it re-activates the enrollment and recreates
 * identical weekday slots (only slots that exactly match the replaced period
 * are removed, so a real multi-period timetable is never wiped).
 */

const prisma = new PrismaClient();

const TR_NO = process.argv[2] || "794";
const CLASS_ID = process.argv[3] || "cms9bw2bt000711l9tlhe0wlu"; // existing "Quran Studies" class
const START_TIME = process.argv[4] || "07:00";
const END_TIME = process.argv[5] || "12:30";
const PERIOD = 1;
const DAYS = [1, 2, 3, 4, 5, 6]; // Monday .. Saturday (JS getDay: 0=Sunday)

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

async function main() {
  if (!/^\d{1,2}:\d{2}$/.test(START_TIME) || !/^\d{1,2}:\d{2}$/.test(END_TIME)) {
    throw new Error(`Invalid time format: "${START_TIME}" / "${END_TIME}" — expected HH:MM`);
  }
  if (toMinutes(END_TIME) <= toMinutes(START_TIME)) {
    throw new Error(`endTime "${END_TIME}" must be later than startTime "${START_TIME}"`);
  }

  const student = await prisma.studentProfile.findFirst({
    where: { trNo: TR_NO },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!student) {
    throw new Error(`No talabat found with trNo="${TR_NO}"`);
  }

  const cls = await prisma.class.findUnique({ where: { id: CLASS_ID } });
  if (!cls) {
    throw new Error(`Class "${CLASS_ID}" not found`);
  }

  console.log(`Talabat: ${student.user.firstName} ${student.user.lastName} (studentId ${student.studentId}, trNo ${student.trNo})`);
  console.log(`Class:   ${cls.name} (${cls.grade}${cls.section} — ${cls.subject}, ${cls.academicYear})`);
  console.log(`Slots:   Mon–Sat ${START_TIME}–${END_TIME}\n`);

  const otherActive = await prisma.classEnrollment.count({
    where: { studentId: student.id, isActive: true, classId: { not: CLASS_ID } },
  });
  if (otherActive > 0) {
    console.log(`Note: this talabat has ${otherActive} other active enrollment(s) — scans may also record attendance for those classes.`);
  }

  await prisma.$transaction(async (tx) => {
    // 1. Ensure an ACTIVE class enrollment exists.
    await tx.classEnrollment.upsert({
      where: { classId_studentId: { classId: CLASS_ID, studentId: student.id } },
      update: { isActive: true },
      create: { classId: CLASS_ID, studentId: student.id, isActive: true },
    });

    // 2. Replace only the identical period slots for those weekdays
    //    (idempotent — other periods/breaks are left untouched).
    const removed = await tx.timetableSlot.deleteMany({
      where: {
        classId: CLASS_ID,
        dayOfWeek: { in: DAYS },
        period: PERIOD,
        startTime: START_TIME,
        endTime: END_TIME,
        isBreak: false,
      },
    });

    for (const day of DAYS) {
      await tx.timetableSlot.create({
        data: {
          classId: CLASS_ID,
          dayOfWeek: day,
          period: PERIOD,
          startTime: START_TIME,
          endTime: END_TIME,
          subject: cls.subject,
          isBreak: false,
        },
      });
    }

    console.log(`✓ Enrollment: ACTIVE (${student.user.firstName} ${student.user.lastName} → ${cls.name})`);
    console.log(`✓ Timetable:  removed ${removed.count} identical slot(s), created ${DAYS.length} slots for Mon–Sat ${START_TIME}–${END_TIME}`);
  });

  console.log(`\nScans by this talabat inside those windows will now create attendance records (PRESENT if within 10 min of ${START_TIME}, else LATE).`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Enroll failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
