import "../env";
import prisma from "../lib/prisma";
import { reconcileAllHistoricalAttendanceStrict } from "../lib/attendance-scan-reconcile";

/**
 * Strict Schedule Reconciler for ALL Historical Records.
 *
 * Runs across every date in the database, evaluating students and faculty
 * strictly against institutional schedule windows (Tilawat al Dua / Period schedules):
 * - On-Time Punch (<= cutoff + grace): PRESENT (Green)
 * - Late Punch (> cutoff + grace): LATE (Yellow)
 * - No Punch (and no approved leave/medical/holiday): ABSENT (Red)
 */
async function main() {
  console.log("⚡ Starting strict historical attendance reconciliation across all dates...");
  const start = Date.now();
  const res = await reconcileAllHistoricalAttendanceStrict();
  const duration = ((Date.now() - start) / 1000).toFixed(1);

  console.log("✅ Reconciliation complete!");
  console.log(`   Dates processed         : ${res.datesProcessed} (${res.dates[0] || "N/A"} -> ${res.dates[res.dates.length - 1] || "N/A"})`);
  console.log(`   Scan logs considered    : ${res.totalLogsConsidered}`);
  console.log(`   Scan logs replayed      : ${res.totalLogsReplayed}`);
  console.log(`   Student records updated : ${res.totalStudentsUpdated}`);
  console.log(`   Teacher records updated : ${res.totalTeachersUpdated}`);
  console.log(`   Time elapsed            : ${duration}s`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FATAL", e);
    await prisma.$disconnect();
    process.exit(1);
  });
