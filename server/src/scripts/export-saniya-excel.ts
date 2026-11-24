import fs from "fs";
import path from "path";
import {
  generateTilawatSaniyaAlifExcel,
  generateTilawatSaniyaBaExcel,
} from "../lib/tilawat-saniya-excel";

async function main() {
  console.log("==================================================================");
  console.log(" Generating Tilawat al Dua Attendance Registers (24 Sept - 24 Nov 2026)");
  console.log("==================================================================");

  // 1. Darajah Saniya Alif (Class 2 A)
  console.log("\n▶ Processing Darajah Saniya Alif (Class 2 A)...");
  const alifResult = await generateTilawatSaniyaAlifExcel();
  const alifPath = path.resolve(process.cwd(), "Tilawat_Dua_Attendance_Darajah_Saniya_Alif_24Sept_24Nov.xlsx");
  fs.writeFileSync(alifPath, alifResult.buffer);

  console.log(`✅ SUCCESS: Saniya Alif Excel generated!`);
  console.log(`   Path: ${alifPath}`);
  console.log(`   Size: ${(alifResult.buffer.length / 1024).toFixed(2)} KB`);
  console.log(`   Talabat: ${alifResult.stats.studentCount} | Present: ${alifResult.stats.totalPresent} | Late: ${alifResult.stats.totalLate} | Absent: ${alifResult.stats.totalAbsent} | Leave: ${alifResult.stats.totalLeave} | Rate: ${alifResult.stats.avgAttendanceRate}%`);

  // 2. Darajah Saniya Ba (Class 2 B)
  console.log("\n▶ Processing Darajah Saniya Ba (Class 2 B)...");
  const baResult = await generateTilawatSaniyaBaExcel();
  const baPath = path.resolve(process.cwd(), "Tilawat_Dua_Attendance_Darajah_Saniya_Ba_24Sept_24Nov.xlsx");
  fs.writeFileSync(baPath, baResult.buffer);

  console.log(`✅ SUCCESS: Saniya Ba Excel generated!`);
  console.log(`   Path: ${baPath}`);
  console.log(`   Size: ${(baResult.buffer.length / 1024).toFixed(2)} KB`);
  console.log(`   Talabat: ${baResult.stats.studentCount} | Present: ${baResult.stats.totalPresent} | Late: ${baResult.stats.totalLate} | Absent: ${baResult.stats.totalAbsent} | Leave: ${baResult.stats.totalLeave} | Rate: ${baResult.stats.avgAttendanceRate}%`);

  console.log("\n==================================================================");
  console.log(" All Excel reports generated successfully!");
  console.log("==================================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Error generating Excel report:", err);
  process.exit(1);
});
