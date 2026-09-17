const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const usersWithAvatar = await prisma.user.count({
    where: { avatarUrl: { not: null } }
  });
  const teachersWithPhoto = await prisma.teacherProfile.count({
    where: { photoUrl: { not: null } }
  });
  const totalUsers = await prisma.user.count();
  const totalStudents = await prisma.studentProfile.count();
  const totalTeachers = await prisma.teacherProfile.count();
  const totalParents = await prisma.parentProfile.count();

  console.log({
    totalUsers,
    totalStudents,
    totalTeachers,
    totalParents,
    usersWithAvatar,
    teachersWithPhoto
  });

  const sampleUsers = await prisma.user.findMany({
    take: 10,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      avatarUrl: true,
      studentProfile: { select: { studentId: true, its: true } },
      teacherProfile: { select: { employeeId: true, its: true, photoUrl: true } }
    }
  });
  console.log("Sample Users:", JSON.stringify(sampleUsers, null, 2));
}

main().finally(() => prisma.$disconnect());
