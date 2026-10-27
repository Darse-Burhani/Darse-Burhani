import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import prisma from "../server/src/lib/prisma";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(repoRoot, "public", "uploads", "tilawat-dua");
const clientUploadsDir = path.join(repoRoot, "client", "public", "uploads", "tilawat-dua");

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(clientUploadsDir, { recursive: true });

// Minimal valid 2-page PDF
function buildValidPdf(title: string, subtitle: string): Buffer {
  const contentPage1 = `BT
/F1 28 Tf
70 730 Td
(${title}) Tj
/F1 16 Tf
0 -40 Td
(${subtitle}) Tj
/F1 14 Tf
0 -35 Td
(Bismillah ir-Rahman ir-Rahim) Tj
0 -30 Td
(Al-hamdu lillahi Rabbi l-alamin, Ar-Rahmani r-Rahim, Maliki Yawmi d-Din.) Tj
0 -25 Td
(Iyyaka na'budu wa iyyaka nasta'in. Ihdina s-sirata l-mustaqim.) Tj
0 -25 Td
(Sirata l-ladhina an'amta 'alayhim, ghayri l-maghdubi 'alayhim wa la d-dallin.) Tj
0 -45 Td
(Dua al-Sabah: Allahumma inna nas'aluka min khayri ma sa'alaka minhu Nabiyyuka Muhammad...) Tj
0 -30 Td
(Darse Burhani Daily Morning Recitation - Page 1) Tj
ET`;

  const contentPage2 = `BT
/F1 24 Tf
70 730 Td
(Tilawat al-Quran - Surah Al-Fath & Tasbeeh) Tj
/F1 14 Tf
0 -45 Td
(Inna fatahna laka fathan mubina. Li-yaghfira laka Llahu ma taqaddama min dhanbika...) Tj
0 -30 Td
(Wa yutimma ni'matahu 'alayka wa yahdiyaka siratan mustaqima.) Tj
0 -30 Td
(Wa yansuraka Llahu nasran 'aziza.) Tj
0 -50 Td
(Subhan Allah, wal-Hamdu lillah, wa la ilaha illa Llah, wa Llahu Akbar.) Tj
0 -30 Td
(Classroom Presentation Mode - Projector View - Page 2) Tj
ET`;

  const pdfTemplate = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
5 0 obj
<< /Length ${contentPage1.length} >>
stream
${contentPage1}
endstream
endobj
6 0 obj
<< /Length ${contentPage2.length} >>
stream
${contentPage2}
endstream
endobj
7 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000120 00000 n 
0000000236 00000 n 
0000000352 00000 n 
0000000${(400 + contentPage1.length).toString().padStart(3, "0")} 00000 n 
0000000${(460 + contentPage1.length + contentPage2.length).toString().padStart(3, "0")} 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
${520 + contentPage1.length + contentPage2.length}
%%EOF`;

  return Buffer.from(pdfTemplate, "utf-8");
}

async function main() {
  const fileName = "tilawat_daily_sample.pdf";
  const pdfBuffer = buildValidPdf("Tilawat al-Quran & Dua al-Sabah", "Official Daily Morning Spiritual Recitation");

  const filePath = path.join(uploadsDir, fileName);
  const clientFilePath = path.join(clientUploadsDir, fileName);

  fs.writeFileSync(filePath, pdfBuffer);
  fs.writeFileSync(clientFilePath, pdfBuffer);

  console.log(`[Seed] Written PDF to ${filePath} (${pdfBuffer.length} bytes)`);

  // Clear existing sample if any
  await prisma.tilawatDua.deleteMany({
    where: { fileName: "tilawat_daily_sample.pdf" },
  });

  // Mark all existing defaults to false
  await prisma.tilawatDua.updateMany({
    where: { isDailyDefault: true },
    data: { isDailyDefault: false },
  });

  const record = await prisma.tilawatDua.create({
    data: {
      title: "Daily Tilawat Dua & Dua al-Sabah",
      description: "Official Darse Burhani daily recitation: Surah Al-Fatiha, Surah Al-Fath & Dua al-Sabah",
      pdfUrl: `/uploads/tilawat-dua/${fileName}`,
      fileName,
      fileSize: pdfBuffer.length,
      pageCount: 2,
      date: new Date(),
      isActive: true,
      isDailyDefault: true,
      targetAudience: "ALL",
      targetMarhala: null,
      targetClassIds: [],
    },
  });

  console.log(`[Seed] TilawatDua record created successfully with ID: ${record.id}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Seed] Error:", err);
  process.exit(1);
});
