import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking current student points...");
  const studentsWithPoints = await prisma.studentProfile.count({
    where: {
      OR: [
        { currentPoints: { not: 0 } },
        { totalPoints: { not: 0 } },
      ],
    },
  });

  console.log(`Found ${studentsWithPoints} student profiles with non-zero points.`);

  const updateResult = await prisma.studentProfile.updateMany({
    data: {
      currentPoints: 0,
      totalPoints: 0,
    },
  });
  console.log(`Reset points to 0 on ${updateResult.count} student profiles.`);

  // Delete all existing point logs so no previous points or history display
  const deletedLogs = await prisma.pointLog.deleteMany({});
  console.log(`Deleted ${deletedLogs.count} point log entries.`);

  console.log("All talabat points successfully set to 0!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
