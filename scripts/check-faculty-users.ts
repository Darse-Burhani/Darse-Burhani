import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: "Burhan", mode: "insensitive" } },
        { lastName: { contains: "Burhan", mode: "insensitive" } },
        { firstName: { contains: "Kundli", mode: "insensitive" } },
        { lastName: { contains: "Kundli", mode: "insensitive" } },
        { firstName: { contains: "Tailor", mode: "insensitive" } },
        { lastName: { contains: "Tailor", mode: "insensitive" } },
        { email: { contains: "kundli", mode: "insensitive" } },
        { email: { contains: "tailor", mode: "insensitive" } },
        { role: "TEACHER" },
      ],
    },
    include: { teacherProfile: true },
    orderBy: { firstName: "asc" },
  });

  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    const slotCount = u.teacherProfile
      ? await prisma.timetableSlot.count({ where: { teacherId: u.teacherProfile.id } })
      : 0;
    console.log(
      `- [${u.role}] ${u.firstName} ${u.lastName} (ITS: ${u.teacherProfile?.its || "N/A"}) | Email: ${u.email} | TeacherProfileId: ${u.teacherProfile?.id || "None"} | Slots: ${slotCount}`
    );
  }

  await prisma.$disconnect();
}

main().catch(console.error);
