import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const classes = await prisma.class.findMany({
    include: {
      masool: { include: { user: true } },
      teacher: { include: { user: true } },
      _count: { select: { enrollments: true, timetableSlots: true } }
    },
    orderBy: [{ academicYear: "asc" }, { grade: "asc" }, { section: "asc" }]
  });
  console.log("=== CLASSES ===");
  console.table(classes.map(c => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    section: c.section,
    academicYear: c.academicYear,
    teacher: c.teacher?.user?.firstName + " " + c.teacher?.user?.lastName,
    masool: c.masool?.user ? (c.masool.user.firstName + " " + c.masool.user.lastName) : "NONE",
    students: c._count.enrollments,
    slots: c._count.timetableSlots
  })));

  const studentsByGrade = await prisma.studentProfile.groupBy({
    by: ["grade", "section"],
    _count: { _all: true },
    orderBy: [{ grade: "asc" }, { section: "asc" }]
  });
  console.log("=== STUDENTS BY GRADE/SECTION IN DB ===");
  console.table(studentsByGrade);

  const parentCount = await prisma.user.count({ where: { role: "PARENT" } });
  const parentProfileCount = await prisma.parentProfile.count();
  const linkCount = await prisma.parentStudentLink.count();
  const totalStudents = await prisma.studentProfile.count();
  const studentsWithLinks = await prisma.studentProfile.count({ where: { parentLinks: { some: {} } } });
  console.log("=== PARENT STATS ===");
  console.log({ parentCount, parentProfileCount, linkCount, totalStudents, studentsWithLinks });

  const slotCount = await prisma.timetableSlot.count();
  console.log("=== TIMETABLE SLOTS TOTAL ===", slotCount);

  // Check slots per class name
  const slotsByClass = await prisma.timetableSlot.groupBy({
    by: ["className"],
    _count: { _all: true }
  });
  console.log("=== SLOTS BY CLASS NAME ===");
  console.table(slotsByClass);

  const slotsWithoutTeacher = await prisma.timetableSlot.count({ where: { teacherId: null } });
  const slotsWithoutClass = await prisma.timetableSlot.count({ where: { classId: null } });
  console.log({ slotsWithoutTeacher, slotsWithoutClass });

  const students = await prisma.studentProfile.findMany({
    include: { parentLinks: true, user: true }
  });
  let linked = 0;
  let unlinked = 0;
  let withFatherEmail = 0;
  let withMotherEmail = 0;
  let withoutAnyEmail = 0;
  const unlinkedStudents: any[] = [];
  for (const s of students) {
    if (s.parentLinks.length > 0) linked++;
    else {
      unlinked++;
      unlinkedStudents.push({
        name: s.user.firstName + " " + s.user.lastName,
        studentId: s.studentId,
        its: s.its,
        grade: s.grade,
        section: s.section,
        fEmail: s.fatherEmail,
        mEmail: s.motherEmail,
      });
    }
    if (s.fatherEmail) withFatherEmail++;
    if (s.motherEmail) withMotherEmail++;
    if (!s.fatherEmail && !s.motherEmail) withoutAnyEmail++;
  }
  console.log("=== PARENT LINK DETAILS ===", {
    total: students.length,
    linked,
    unlinked,
    withFatherEmail,
    withMotherEmail,
    withoutAnyEmail,
  });
  if (unlinkedStudents.length > 0) {
    console.log("Sample unlinked:", unlinkedStudents.slice(0, 10));
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
