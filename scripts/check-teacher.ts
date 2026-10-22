import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tailor = await prisma.teacherProfile.findFirst({
    where: { its: "40444603" },
    include: { user: true },
  });

  const manpur = await prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { user: { lastName: { contains: "Manpur", mode: "insensitive" } } },
        { user: { email: { contains: "manpurwala", mode: "insensitive" } } },
      ],
    },
    include: { user: true },
  });

  const tailorCount = tailor
    ? await prisma.timetableSlot.count({ where: { teacherId: tailor.id } })
    : 0;

  console.log("=== Faculty Periods Status ===");
  console.log(`Mustafa Tailor (ITS: ${tailor?.its}, Email: ${tailor?.user?.email}): ${tailorCount} periods assigned.`);
  console.log(`Mustafa Manpurwala exists in DB: ${manpur ? "YES (ERROR)" : "NO (CLEAN)"}`);

  await prisma.$disconnect();
}

main().catch(console.error);
