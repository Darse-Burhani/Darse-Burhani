import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check for any teacher profiles
  const teachers = await prisma.teacherProfile.findMany({
    include: { user: true },
  });
  console.log("Teacher profiles:", JSON.stringify(teachers, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
