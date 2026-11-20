import "../env";
import prisma from "../lib/prisma";
import { reconcileAttendanceFromScanLogs } from "../lib/attendance-scan-reconcile";

/**
 * Apply every Hikvision punch that is already stored in Supabase
 * (`biometric_scan_logs`) and still needs to become attendance.
 *
 * This is the no-bridge sync path: nothing here touches the school LAN. The
 * terminals push their punches to the cloud endpoint, the cloud stores them in
 * Supabase, and this job (also run automatically by the server every 2 minutes)
 * turns them into attendance.
 *
 * Usage:
 *   npm run attendance:reconcile -w server            # today (IST)
 *   npm run attendance:reconcile -w server 2026-11-19 # a specific IST day
 */
async function main() {
  const dateArg = process.argv[2];
  const result = await reconcileAttendanceFromScanLogs(dateArg || new Date());
  console.log(`📥 Supabase scan ledger — ${result.date}`);
  console.log(`   Punches considered : ${result.logsConsidered}`);
  console.log(`   Replayed           : ${result.replayed}`);
  console.log(`   Matched            : ${result.matched}`);
  console.log(`   Still unmatched    : ${result.stillUnmatched}`);
  console.log(`   Failed             : ${result.failed}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FATAL", e);
    await prisma.$disconnect();
    process.exit(1);
  });
