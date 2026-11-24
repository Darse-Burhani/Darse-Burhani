import fs from "fs";
import path from "path";
import { generateTilawatSaniyaAlifExcel } from "../lib/tilawat-saniya-excel";

async function main() {
  console.log("Starting Tilawat al Dua Attendance Excel generation for Darajah Saniya Alif (24 Sept - 24 Nov 2026)...");
  const result = await generateTilawatSaniyaAlifExcel();

  const outPath = path.resolve(process.cwd(), "Tilawat_Dua_Attendance_Darajah_Saniya_Alif_24Sept_24Nov.xlsx");
  fs.writeFileSync(outPath, result.buffer);

  console.log(`\n======================================================`);
  console.log(` SUCCESS: Excel file generated successfully!`);
  console.log(` Output Path: ${outPath}`);
  console.log(` File Size: ${(result.buffer.length / 1024).toFixed(2)} KB`);
  console.log(`======================================================`);
  console.log(` Summary Statistics:`);
  console.log(` - Total Enrolled Talabat: ${result.stats.studentCount}`);
  console.log(` - Total Calendar Days:    ${result.stats.daysCount} days (24-Sep to 24-Nov)`);
  console.log(` - Present Sessions (P):   ${result.stats.totalPresent}`);
  console.log(` - Late Sessions (L):      ${result.stats.totalLate}`);
  console.log(` - Absent Sessions (A):    ${result.stats.totalAbsent}`);
  console.log(` - Leave Sessions (LV):    ${result.stats.totalLeave}`);
  console.log(` - Average Attendance:     ${result.stats.avgAttendanceRate}%`);
  console.log(`======================================================\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error generating Excel report:", err);
  process.exit(1);
});
