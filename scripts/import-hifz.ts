import { google } from "googleapis";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const sheets = google.sheets("v4");

interface HifzSheetRow {
  srNo: number;
  its: string;
  studentName: string;
  darajah: string;
  sanah: string;
  currentJuz: number;
  currentSafah: number;
  totalJadeedPages: number;
  pendingAjza: string;
  weakAjza: string;
  murajaatMarks: number;
  juzhaliMarks: number;
  jadeedMarks: number;
  totalMarks: number;
  performancePercent: number;
  email1: string;
  email2: string;
}

async function getSheetData(sheetId: string, gid?: string): Promise<string[][]> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_SHEETS_API_KEY environment variable is not set");
  }

  let range = "Sheet1!A:Z";
  if (gid) {
    const metadata = await sheets.spreadsheets.get({
      auth: apiKey,
      spreadsheetId: sheetId,
      fields: "sheets.properties",
    });
    const sheet = metadata.data.sheets?.find((s) => String(s.properties?.sheetId) === gid);
    if (sheet?.properties?.title) {
      range = `${sheet.properties.title}!A:Z`;
    }
  }

  const response = await sheets.spreadsheets.values.get({
    auth: apiKey,
    spreadsheetId: sheetId,
    range,
  });
  return response.data.values || [];
}

function parseSheetRows(rows: string[][]): HifzSheetRow[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());

  const srNoIdx = headers.findIndex((h) => ["sr.no", "srno", "sr no", "serial", "#"].includes(h));
  const itsIdx = headers.findIndex((h) => ["its", "its id", "itsid"].includes(h));
  const nameIdx = headers.findIndex((h) => ["name", "student name", "studentname"].includes(h));
  const darajahIdx = headers.findIndex((h) => ["dar", "darajah", "grade", "الصف"].includes(h));
  const sanahIdx = headers.findIndex((h) => ["sanah", "year", "section", "القسم"].includes(h));
  const currentJuzIdx = headers.findIndex((h) => ["current juz", "currentjuz", "juz", "الجزء الحالي"].includes(h));
  const currentSafahIdx = headers.findIndex((h) => ["current safah", "currentsafah", "safah", "page", "الصفحة الحالية"].includes(h));
  const totalJadeedPagesIdx = headers.findIndex((h) => ["total jadeed pages", "totaljadeedpages", "jadeed pages", "الصفحات الجديدة"].includes(h));
  const pendingAjzaIdx = headers.findIndex((h) => ["pending ajza", "pendingajza", "pending", "المعلقة"].includes(h));
  const weakAjzaIdx = headers.findIndex((h) => ["weak ajza", "weakajza", "weak", "الضعيفة"].includes(h));
  const murajaatMarksIdx = headers.findIndex((h) => ["murajaat marks (20)", "murajaat marks", "murajaat", "المراجعة"].includes(h));
  const juzhaliMarksIdx = headers.findIndex((h) => ["juzhali marks(20)", "juzhali marks (20)", "juzhali marks", "juzhali", "الحفظ"].includes(h));
  const jadeedMarksIdx = headers.findIndex((h) => ["jadeed marks (10)", "jadeed marks", "jadeed", "الجديد"].includes(h));
  const totalMarksIdx = headers.findIndex((h) => ["total (50)", "total", "المجموع"].includes(h));
  const performanceIdx = headers.findIndex((h) => ["overall performance %", "overall performance", "performance", "الأداء العام"].includes(h));
  const email1Idx = headers.findIndex((h) => ["email id 1", "email1", "email", "البريد الإلكتروني"].includes(h));
  const email2Idx = headers.findIndex((h) => ["email id 2", "email2"].includes(h));

  console.log("Headers found:", {
    srNo: srNoIdx,
    its: itsIdx,
    name: nameIdx,
    darajah: darajahIdx,
    sanah: sanahIdx,
    currentJuz: currentJuzIdx,
    currentSafah: currentSafahIdx,
    totalJadeedPages: totalJadeedPagesIdx,
    pendingAjza: pendingAjzaIdx,
    weakAjza: weakAjzaIdx,
    murajaatMarks: murajaatMarksIdx,
    juzhaliMarks: juzhaliMarksIdx,
    jadeedMarks: jadeedMarksIdx,
    totalMarks: totalMarksIdx,
    performance: performanceIdx,
    email1: email1Idx,
    email2: email2Idx,
  });

  return rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== "")).map((row) => {
    const currentJuzStr = (row[currentJuzIdx] || "0").trim();
    const currentJuz = currentJuzStr === "CLEARANCE" ? 30 : parseInt(currentJuzStr, 10) || 0;

    return {
      srNo: parseInt(row[srNoIdx] || "0", 10) || 0,
      its: (row[itsIdx] || "").trim(),
      studentName: (row[nameIdx] || "").trim(),
      darajah: (row[darajahIdx] || "").trim(),
      sanah: (row[sanahIdx] || "").trim(),
      currentJuz,
      currentSafah: parseInt(row[currentSafahIdx] || "0", 10) || 0,
      totalJadeedPages: parseInt(row[totalJadeedPagesIdx] || "0", 10) || 0,
      pendingAjza: (row[pendingAjzaIdx] || "").trim(),
      weakAjza: (row[weakAjzaIdx] || "").trim(),
      murajaatMarks: parseFloat(row[murajaatMarksIdx] || "0") || 0,
      juzhaliMarks: parseFloat(row[juzhaliMarksIdx] || "0") || 0,
      jadeedMarks: parseFloat(row[jadeedMarksIdx] || "0") || 0,
      totalMarks: parseFloat(row[totalMarksIdx] || "0") || 0,
      performancePercent: parseFloat(row[performanceIdx] || "0") || 0,
      email1: (row[email1Idx] || "").trim(),
      email2: (row[email2Idx] || "").trim(),
    };
  });
}

async function main() {
  const sheetId = "1gTVaHyE5QAFa8Z3YT371TcPVOB-bA3H3N_up3GG2EvE";
  const gid = "564764691";

  console.log("Fetching data from Google Sheets...");
  const rows = await getSheetData(sheetId, gid);
  console.log(`Fetched ${rows.length} rows`);

  const parsedData = parseSheetRows(rows);
  console.log(`Parsed ${parsedData.length} students`);

  // Find any teacher profile for teacherId
  const teacherProfile = await prisma.teacherProfile.findFirst({
    include: { user: true },
  });

  if (!teacherProfile) {
    console.error("No teacher profile found!");
    return;
  }

  console.log(`Using teacher: ${teacherProfile.user.firstName} ${teacherProfile.user.lastName}`);

  const defaultPassword = await bcrypt.hash("student123", 10);
  let studentsCreated = 0;
  let reportsCreated = 0;
  let partsImported = 0;
  let partsUpdated = 0;

  for (const rowData of parsedData) {
    if (!rowData.studentName || !rowData.its) {
      console.log(`Skipping row - no name or ITS: ${JSON.stringify(rowData)}`);
      continue;
    }

    console.log(`Processing: ${rowData.studentName} (ITS: ${rowData.its})`);

    // Try to find student by ITS number
    let student = await prisma.studentProfile.findFirst({
      where: { studentId: rowData.its },
    });

    // If not found, create new student
    if (!student) {
      try {
        const nameParts = rowData.studentName.split(" ");
        const firstName = nameParts[0] || rowData.studentName;
        const lastName = nameParts.slice(1).join(" ") || "";

        const user = await prisma.user.create({
          data: {
            email: rowData.email1 || `${rowData.its}@student.sis.edu`,
            passwordHash: defaultPassword,
            firstName,
            lastName,
            role: "STUDENT",
          },
        });

        student = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            studentId: rowData.its,
            grade: rowData.darajah || "M4",
            section: rowData.sanah || "",
          },
        });

        studentsCreated++;
        console.log(`  Created student: ${rowData.studentName}`);
      } catch (error: any) {
        console.error(`  Failed to create student: ${error.message}`);
        continue;
      }
    }

    // Find or create hifz report
    let report = await prisma.hifzReport.findFirst({
      where: {
        studentId: student.id,
        academicYear: "2025-2026",
      },
      include: { parts: true },
    });

    if (!report) {
      report = await prisma.hifzReport.create({
        data: {
          studentId: student.id,
          teacherId: teacherProfile.id,
          academicYear: "2025-2026",
          semester: "1",
        },
        include: { parts: true },
      });
      reportsCreated++;
      console.log(`  Created report for: ${rowData.studentName}`);
    }

    // Calculate progress
    const progress = rowData.currentJuz > 0 ? Math.round((rowData.currentJuz / 30) * 100) : 0;

    // Determine status
    let status = "NOT_STARTED";
    if (rowData.currentJuz >= 30) status = "COMPLETED";
    else if (rowData.currentJuz > 0) status = "IN_PROGRESS";
    if (rowData.weakAjza && rowData.weakAjza !== "0" && rowData.weakAjza !== "-") status = "WEAK";

    // Parse pending and weak counts
    const parseCount = (str: string) => {
      if (!str || str === "-" || str === "0") return 0;
      return str.includes(",") ? str.split(",").length : parseInt(str) || 0;
    };

    const partData: any = {
      status,
      progress,
      currentPage: rowData.currentSafah,
      totalPages: 20,
      firmProgress: rowData.totalJadeedPages,
      firmTarget: 10,
      sentencesMemorized: rowData.totalJadeedPages,
      sentencePercentage: rowData.performancePercent,
      reviewCount: rowData.murajaatMarks,
      targetReviews: 20,
      isMemorized: rowData.currentJuz >= 30,
      isWeak: status === "WEAK",
      isAbandoned: false,
      isReviewed: rowData.murajaatMarks > 0,
      murajaatMarks: rowData.murajaatMarks,
      juzhaliMarks: rowData.juzhaliMarks,
      jadeedMarks: rowData.jadeedMarks,
      totalMarks: rowData.totalMarks,
      performancePercent: rowData.performancePercent,
      pendingAjza: parseCount(rowData.pendingAjza),
      notes: `ITS: ${rowData.its} | Darajah: ${rowData.darajah} | Sanah: ${rowData.sanah} | Email: ${rowData.email1}`,
    };

    // Find existing part or create new one
    const existingPart = report.parts.find((p: any) => p.partNumber === rowData.currentJuz);

    if (existingPart) {
      await prisma.hifzPart.update({
        where: { id: existingPart.id },
        data: partData,
      });
      partsUpdated++;
    } else if (rowData.currentJuz > 0 && rowData.currentJuz <= 30) {
      await prisma.hifzPart.create({
        data: {
          reportId: report.id,
          partNumber: rowData.currentJuz,
          ...partData,
        },
      });
      partsImported++;
    }

    // Update report timestamp
    await prisma.hifzReport.update({
      where: { id: report.id },
      data: { updatedAt: new Date() },
    });
  }

  console.log("\n=== Import Complete ===");
  console.log(`Students created: ${studentsCreated}`);
  console.log(`Reports created: ${reportsCreated}`);
  console.log(`Parts imported: ${partsImported}`);
  console.log(`Parts updated: ${partsUpdated}`);
  console.log(`Total students processed: ${parsedData.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
