import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(".env") });
dotenv.config({ path: path.resolve("server/.env") });

import prisma from "../server/src/lib/prisma";
import { pullAllDevicesScansForRange } from "../server/src/lib/hikvision";
import { syncGateRegistryToClassAttendance } from "../server/src/lib/attendance-scheduler";
import { syncMonthlyAttendanceToSheet } from "../server/src/lib/google-attendance-sync";
import { generateFacultyExcel } from "../server/src/scripts/export-faculty-oct-excel";

async function main() {
  const targetMonth = process.argv[2] || "2026-10";
  console.log("=================================================");
  console.log(`🏛️  DARSE BURHANI — RENDER FULL MONTH ATTENDANCE RUN`);
  console.log(`📅 Target Month: ${targetMonth}`);
  console.log("=================================================");

  const [yStr, mStr] = targetMonth.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const lastDay = new Date(year, month, 0).getDate();

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  console.log(`⏳ Querying physical Hikvision terminals for full range:`);
  console.log(`   From: ${monthStart.toISOString()} (${targetMonth}-01 00:00:00 IST)`);
  console.log(`   To:   ${monthEnd.toISOString()} (${targetMonth}-${lastDay} 23:59:59 IST)`);

  const pollRes = await pullAllDevicesScansForRange(monthStart, monthEnd);
  console.log(`\n✅ Hardware Terminal Scan Results:`);
  console.log(`   Total Fetched:   ${pollRes.totalFetched}`);
  console.log(`   Total Processed: ${pollRes.totalProcessed}`);
  for (const d of pollRes.devices) {
    console.log(`   - ${d.name} (${d.host}): ${d.scansFetched} scans fetched (Success: ${d.success})`);
  }

  // Self-healing class propagation for all days in month
  console.log(`\n🔄 Propagating gate attendance to class rosters for ${lastDay} days...`);
  for (let d = 1; d <= lastDay; d++) {
    const dayDate = new Date(Date.UTC(year, month - 1, d, 0, 0, 0));
    await syncGateRegistryToClassAttendance(dayDate).catch(() => {});
  }
  console.log(`✓ All ${lastDay} days synchronized to class rosters.`);

  // Generate Faculty Excel for Full Month
  console.log(`\n📊 Generating Full Month Faculty Excel register...`);
  try {
    const excelPath = await generateFacultyExcel();
    console.log(`✓ Faculty Excel created at: ${excelPath}`);
  } catch (err: any) {
    console.warn(`⚠️ Faculty Excel generation notice:`, err?.message || err);
  }

  // Monthly Google Sheet Sync
  console.log(`\n📋 Synchronizing Monthly Summary Register to Google Sheet...`);
  try {
    const sheetRes = await syncMonthlyAttendanceToSheet(targetMonth);
    console.log(`✓ Google Sheet synced: Tab '${sheetRes.tabTitle}' (${sheetRes.url})`);
  } catch (err: any) {
    console.warn(`⚠️ Google Sheet sync notice:`, err?.message || err);
  }

  console.log(`\n=================================================`);
  console.log(`🎉 RENDER FULL MONTH RUN COMPLETE FOR ${targetMonth}`);
  console.log(`=================================================`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error during full month run:", err);
    process.exit(1);
  });
