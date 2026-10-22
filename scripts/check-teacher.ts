import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tailor = await prisma.teacherProfile.findFirst({
    where: { employeeId: "EMP-MUSTAFA-TAILOR" },
    include: { user: true },
  });

  const manpur = await prisma.teacherProfile.findFirst({
    where: { its: "40444603" },
    include: { user: true },
  });

  const manpurCount = manpur
    ? await prisma.timetableSlot.count({ where: { teacherId: manpur.id } })
    : 0;
  const tailorCount = tailor
    ? await prisma.timetableSlot.count({ where: { teacherId: tailor.id } })
    : 0;

  console.log("=== Faculty Periods Status ===");
  console.log(`Mustafa bhai Moiz bhai Manpurwala (ITS: 40444603): ${manpurCount} periods assigned.`);
  console.log(`Mustafa Tailor (EMP: EMP-MUSTAFA-TAILOR): ${tailorCount} periods assigned.`);

  await prisma.$disconnect();
}

main().catch(console.error);
