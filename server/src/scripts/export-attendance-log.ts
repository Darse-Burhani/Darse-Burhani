/**
 * Export the day-wise, event-bifurcated attendance log workbook to the local
 * log directory (server/logs/attendance/excel/). The .xlsx opens directly in
 * Google Sheets via File → Import → Upload.
 *
 * Usage:
 *   npx tsx server/src/scripts/export-attendance-log.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 * Defaults to the last 7 days (max span 14 days).
 */
import "../env";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { generateRangedAttendanceExcel } from "../lib/attendance-excel";
import { ensureAttendanceLocalDir, ATTENDANCE_EXCEL_DIR } from "../lib/attendance-local-log";
import prisma from "../lib/prisma";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

async function main() {
  const toStr = arg("--to");
  const fromStr = arg("--from");
  console.log(`Exporting attendance log${fromStr ? ` from ${fromStr}` : " (last 7 days)"}${toStr ? ` to ${toStr}` : ""}...`);

  const { filename, buffer, stats } = await generateRangedAttendanceExcel({ fromStr, toStr });

  await ensureAttendanceLocalDir();
  const outPath = path.join(ATTENDANCE_EXCEL_DIR, filename);
  await writeFile(outPath, buffer);
  console.log(`Saved: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);

  for (const d of stats.days) {
    console.log(
      `  ${d.date}: talabat P/L/A ${d.studentPresent}/${d.studentLate}/${d.studentAbsent} (of ${d.studentTotal}) | faculty P/L/A ${d.teacherPresent}/${d.teacherLate}/${d.teacherAbsent} (of ${d.teacherTotal})`,
    );
  }
  console.log(`  Event slices: ${stats.eventSlices.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Export failed:", e?.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
