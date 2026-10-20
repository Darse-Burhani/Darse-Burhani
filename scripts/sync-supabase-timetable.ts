import { syncMasterTimetableAndClasses } from "../server/src/lib/timetable-master-sync";
import prisma from "../server/src/lib/prisma";

async function main() {
  console.log("=================================================");
  console.log("  DARSE BURHANI: MASTER TIMETABLE & CLASS SYNC   ");
  console.log("=================================================");
  console.log(`Connecting to database...`);

  const result = await syncMasterTimetableAndClasses(true);

  console.log("\n=================================================");
  console.log(`✓ SYNC COMPLETE!`);
  console.log(`  Classes Verified: ${result.classesCount}`);
  console.log(`  Timetable Slots:  ${result.slotsCount}`);
  console.log(`  Talabat Enrolled: ${result.enrolledCount}`);
  console.log(`  Message:          ${result.message}`);
  console.log("=================================================\n");
}

main()
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
