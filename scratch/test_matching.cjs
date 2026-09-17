const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();
const prisma = new PrismaClient();

const repoRoot = path.resolve(__dirname, "..");
const talabatDir = path.join(repoRoot, "public", "uploads", "Talabat");
const teachersDir = path.join(repoRoot, "public", "uploads", "teachers");

async function main() {
  const talabatFiles = fs.existsSync(talabatDir) ? fs.readdirSync(talabatDir) : [];
  const teacherFiles = fs.existsSync(teachersDir) ? fs.readdirSync(teachersDir) : [];

  console.log(`Talabat files count: ${talabatFiles.length}`);
  console.log(`Teacher files count: ${teacherFiles.length}`);

  const students = await prisma.studentProfile.findMany({
    select: {
      id: true,
      studentId: true,
      its: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } }
    }
  });

  const teachers = await prisma.teacherProfile.findMany({
    select: {
      id: true,
      employeeId: true,
      its: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } }
    }
  });

  let matchedStudents = 0;
  let unmatchedStudents = [];
  for (const s of students) {
    const its = s.its || s.studentId;
    const match = talabatFiles.find(f => {
      const name = path.parse(f).name.toLowerCase();
      return name === its?.toLowerCase() || (its && name.startsWith(its.toLowerCase()));
    });
    if (match) {
      matchedStudents++;
    } else {
      unmatchedStudents.push({ its, name: `${s.user.firstName} ${s.user.lastName}` });
    }
  }

  let matchedTeachers = 0;
  let unmatchedTeachers = [];
  for (const t of teachers) {
    const its = t.its || t.employeeId;
    const match = teacherFiles.find(f => {
      const name = path.parse(f).name.toLowerCase();
      return name === its?.toLowerCase() || (its && name.startsWith(its.toLowerCase()));
    });
    if (match) {
      matchedTeachers++;
    } else {
      unmatchedTeachers.push({ its, name: `${t.user.firstName} ${t.user.lastName}` });
    }
  }

  console.log(`Students matched: ${matchedStudents} / ${students.length}`);
  console.log(`Teachers matched: ${matchedTeachers} / ${teachers.length}`);
  if (unmatchedStudents.length > 0) {
    console.log(`First 5 unmatched students:`, unmatchedStudents.slice(0, 5));
  }
  if (unmatchedTeachers.length > 0) {
    console.log(`First 5 unmatched teachers:`, unmatchedTeachers.slice(0, 5));
  }
}

main().finally(() => prisma.$disconnect());
