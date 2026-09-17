import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check for admin users
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    include: { teacherProfile: true },
  });
  console.log("Admin users:", JSON.stringify(admins, null, 2));

  // Check for any teacher profiles
  const teachers = await prisma.teacherProfile.findMany();
  console.log("Teacher profiles:", teachers.length);

  await prisma.$disconnect();
}

main().catch(console.error);
