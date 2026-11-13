import prisma from "../lib/prisma.js";

async function main() {
  const g4 = await prisma.studentProfile.findMany({
    where: {
      OR: [
        { grade: "4" },
        { grade: "Darajah 4" },
        { grade: "Grade 4" },
        { grade: "Rabea" },
        { grade: "Darajah Rabea" },
      ],
    },
    include: {
      user: true,
      talabatProfile1447: true,
    },
    orderBy: {
      user: { firstName: "asc" },
    },
  });

  console.log(`Grade 4 students count: ${g4.length}`);
  g4.forEach((s, i) => {
    console.log(`${i + 1}. "${s.user.firstName} ${s.user.lastName}" (ID: ${s.id}, ITS: ${s.its}, Grade: ${s.grade})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

