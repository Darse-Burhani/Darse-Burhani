/**
 * Push one day's attendance roster to the online Google Sheet log.
 *
 * Usage:
 *   npx tsx server/src/scripts/sync-attendance-sheet.ts [--date YYYY-MM-DD]
 * Defaults to today (UTC). Requires GOOGLE_ATTENDANCE_SPREADSHEET_ID +
 * service-account credentials in .env (see lib/google-attendance-sync.ts).
 */
import "../env";
import prisma from "../lib/prisma";
import { syncDailyAttendanceToSheet } from "../lib/google-attendance-sync";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

async function main() {
  const dateStr = arg("--date");
  const target = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  if (Number.isNaN(target.getTime())) throw new Error(`Invalid --date (expected YYYY-MM-DD), got "${dateStr}"`);

  console.log(`Syncing attendance for ${target.toISOString().slice(0, 10)} to Google Sheet...`);
  const r = await syncDailyAttendanceToSheet(target);
  console.log(`Done: ${r.rowsSynced} rows → tab '${r.tabTitle}'`);
  console.log(`Open: ${r.url}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Sheet sync failed:", e?.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
