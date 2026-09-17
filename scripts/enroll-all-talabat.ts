import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

/**
 * Enroll every talabat into a grade+section class and give each class a daily
 * timetable (Mon–Sat, 07:00–12:30) matching the "Tilawat al Dua" scan window,
 * so a biometric scan inside the window records attendance.
 *
 * Idempotent: safe to re-run — classes are find-or-create, enrollments are
 * upserted as ACTIVE, and identical weekday slots are replaced, never stacked.
 */

const prisma = new PrismaClient();

const ACADEMIC_YEAR = "2025-2026";
const SUBJECT = "Quran Studies";
const START_TIME = "07:00";
const END_TIME = "12:30";
const PERIOD = 1;
const DAYS = [1, 2, 3, 4, 5, 6]; // Monday .. Saturday (JS getDay: 0=Sunday)

const TEACHER_EMAIL = "biometric.system@darseburhani.edu";
const TEACHER_EMPLOYEE_ID = "BIOMETRIC-SYSTEM-001";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function randomPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

async function main() {
  // ── 1. Ensure a teacher exists (classes require a teacher FK) ──
  let teacher = await prisma.teacherProfile.findUnique({
    where: { employeeId: TEACHER_EMPLOYEE_ID },
  });
  let teacherPassword = "";
  if (!teacher) {
    teacherPassword = randomPassword();
    const passwordHash = await bcrypt.hash(teacherPassword, 12);
    const user = await prisma.user.upsert({
      where: { email: TEACHER_EMAIL },
      update: {},
      create: {
        email: TEACHER_EMAIL,
        passwordHash,
        firstName: "Biometric",
        lastName: "System",
        role: "TEACHER",
        isActive: true,
        teacherProfile: { create: { employeeId: TEACHER_EMPLOYEE_ID, department: "Attendance" } },
      },
    });
    const profile = await prisma.teacherProfile.findUnique({ where: { userId: user.id } });
    if (!profile) throw new Error("Failed to create teacher profile");
    teacher = profile;
    console.log(`✓ Created placeholder teacher: ${TEACHER_EMAIL} (password: ${teacherPassword} — change/reassign in Admin → Classes)`);
  } else {
    console.log(`✓ Teacher already exists: ${TEACHER_EMPLOYEE_ID}`);
  }

  // ── 2. Build grade/section classes from the actual student roster ──
  const groups = await prisma.studentProfile.groupBy({
    by: ["grade", "section"],
    _count: { _all: true },
    orderBy: [{ grade: "asc" }, { section: "asc" }],
  });

  console.log(`\nGrade/section groups: ${groups.length}`);
  const classByKey = new Map<string, string>();

  for (const g of groups) {
    const grade = g.grade;
    const section = g.section;
    const key = `${grade}|${section}`;
    const name = `Grade ${grade} ${section}`;

    let cls = await prisma.class.findFirst({ where: { grade, section, academicYear: ACADEMIC_YEAR } });
    if (!cls) {
      cls = await prisma.class.create({
        data: {
          name,
          grade,
          section,
          subject: SUBJECT,
          teacherId: teacher.id,
          academicYear: ACADEMIC_YEAR,
          isActive: true,
        },
      });
      console.log(`  Created class: ${name} (${g._count._all} talabat)`);
    } else {
      console.log(`  Reusing class: ${name}`);
    }
    classByKey.set(key, cls.id);
  }

  // ── 3. Enroll every talabat into their class ──
  const students = await prisma.studentProfile.findMany({
    where: { user: { role: "STUDENT", isActive: true } },
    select: { id: true, grade: true, section: true, user: { select: { firstName: true, lastName: true } } },
  });

  console.log(`\nEnrolling ${students.length} talabat...`);
  let enrolled = 0;
  for (const s of students) {
    const classId = classByKey.get(`${s.grade}|${s.section}`);
    if (!classId) {
      console.warn(`  SKIP ${s.user.firstName} ${s.user.lastName}: no class for grade ${s.grade}${s.section}`);
      continue;
    }
    await prisma.classEnrollment.upsert({
      where: { classId_studentId: { classId, studentId: s.id } },
      update: { isActive: true },
      create: { classId, studentId: s.id, isActive: true },
    });
    enrolled++;
  }
  console.log(`✓ Enrolled: ${enrolled}/${students.length}`);

  // ── 4. Daily timetable slots (Mon–Sat, 07:00–12:30) per class ──
  console.log("\nBuilding timetable slots...");
  let slotTotal = 0;
  for (const [, classId] of classByKey) {
    // Replace only identical period slots (idempotent — other periods untouched)
    await prisma.timetableSlot.deleteMany({
      where: {
        classId,
        dayOfWeek: { in: DAYS },
        period: PERIOD,
        startTime: START_TIME,
        endTime: END_TIME,
        isBreak: false,
      },
    });
    for (const day of DAYS) {
      await prisma.timetableSlot.create({
        data: {
          classId,
          dayOfWeek: day,
          period: PERIOD,
          startTime: START_TIME,
          endTime: END_TIME,
          subject: SUBJECT,
          isBreak: false,
        },
      });
      slotTotal++;
    }
  }
  console.log(`✓ Timetable: ${slotTotal} slots (${DAYS.length} days × ${classByKey.size} classes, ${START_TIME}–${END_TIME})`);

  // ── Summary ──
  const [classCount, enrollmentCount, activeEnrollments, slotCount, studentsWithFp] = await Promise.all([
    prisma.class.count({ where: { isActive: true } }),
    prisma.classEnrollment.count(),
    prisma.classEnrollment.count({ where: { isActive: true } }),
    prisma.timetableSlot.count({ where: { isBreak: false } }),
    prisma.studentProfile.count({ where: { biometricHash: { not: null } } }),
  ]);

  console.log("\n=== Enrollment Complete ===");
  console.log(`Active classes:        ${classCount}`);
  console.log(`Enrollments:           ${enrollmentCount} total, ${activeEnrollments} active`);
  console.log(`Timetable slots:       ${slotCount}`);
  console.log(`Students w/ fingerprint: ${studentsWithFp} (enroll in Admin → Biometric)`);
  console.log(`Scan window:           ${START_TIME}–${END_TIME}, Mon–Sat (+10 min grace)`);
  console.log(`\nScans inside the window now record attendance (PRESENT if within grace, else LATE).`);

  await prisma.$disconnect();
}

main()
  .catch(async (e) => {
    console.error("Enroll-all failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(() => void toMinutes);
