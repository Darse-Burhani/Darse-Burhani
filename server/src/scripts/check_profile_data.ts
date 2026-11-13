import prisma from "../lib/prisma.js";

async function main() {
  const students = await prisma.studentProfile.findMany({
    where: {
      OR: [
        { grade: "4" },
        { user: { firstName: { contains: "Cutlarywala" } } },
        { user: { lastName: { contains: "Cutlarywala" } } },
      ],
    },
    include: {
      user: true,
      talabatProfile1447: true,
    },
  });

  console.log(`Found ${students.length} students.`);
  for (const s of students.slice(0, 5)) {
    const km = await prisma.systemSetting.findUnique({
      where: { key: `knowing_myself_${s.id}` },
    });
    console.log(`Student: ${s.user.firstName} ${s.user.lastName}`);
    console.log(`  Profile 1447: ${Boolean(s.talabatProfile1447)}`);
    console.log(`  Knowing Myself: ${Boolean(km)}`);
    if (km) {
      console.log(`  KM sample:`, JSON.stringify(km.value).slice(0, 100));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

