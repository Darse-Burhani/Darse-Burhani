import { google } from "googleapis";

const sheets = google.sheets("v4");

export interface HifzSheetRow {
  srNo: number;
  its: string;
  studentName: string;
  darajah: string;
  sanah: string;
  currentJuz: number;
  currentSafah: number;
  totalJadeedPages: number;
  pendingAjza: number;
  weakAjza: number;
  murajaatMarks: number;
  juzhaliMarks: number;
  jadeedMarks: number;
  totalMarks: number;
  performancePercent: number;
  email1: string;
  email2: string;
}

function getAuth() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_SHEETS_API_KEY environment variable is not set");
  }
  return apiKey;
}

export function parseGoogleSheetInput(input: string): { sheetId: string; gid?: string } {
  const trimmed = String(input || "").trim();

  // Match full URL: https://docs.google.com/spreadsheets/d/<ID>/...
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);

  const sheetId = urlMatch ? urlMatch[1] : trimmed;
  const gid = gidMatch ? gidMatch[1] : undefined;

  return { sheetId, gid };
}

export async function getSheetData(rawInput: string, range?: string, gidParam?: string): Promise<string[][]> {
  const apiKey = getAuth();
  const { sheetId, gid: urlGid } = parseGoogleSheetInput(rawInput);
  const effectiveGid = gidParam || urlGid;

  if (!sheetId) {
    throw new Error("Invalid or empty Google Sheet URL or ID");
  }

  // If specific range is given, use it directly
  if (range) {
    const response = await sheets.spreadsheets.values.get({
      auth: apiKey,
      spreadsheetId: sheetId,
      range,
    });
    return response.data.values || [];
  }

  // Fetch spreadsheet metadata to dynamically find the correct tab name
  const metadata = await sheets.spreadsheets.get({
    auth: apiKey,
    spreadsheetId: sheetId,
    fields: "sheets.properties",
  });

  const allSheets = metadata.data.sheets || [];
  if (allSheets.length === 0) {
    throw new Error("The Google Spreadsheet contains no sheets");
  }

  let targetSheet = allSheets[0]; // default to first sheet tab
  if (effectiveGid) {
    const found = allSheets.find((s) => String(s.properties?.sheetId) === String(effectiveGid));
    if (found) targetSheet = found;
  }

  const sheetTitle = targetSheet?.properties?.title || "Sheet1";
  // Wrap sheet title in single quotes in case of spaces, special characters, or Arabic
  const safeRange = `'${sheetTitle.replace(/'/g, "''")}'!A:Z`;

  const response = await sheets.spreadsheets.values.get({
    auth: apiKey,
    spreadsheetId: sheetId,
    range: safeRange,
  });

  return response.data.values || [];
}

export async function getSheetMetadata(rawInput: string) {
  const apiKey = getAuth();
  const { sheetId } = parseGoogleSheetInput(rawInput);
  const response = await sheets.spreadsheets.get({
    auth: apiKey,
    spreadsheetId: sheetId,
    fields: "sheets.properties",
  });
  return response.data.sheets?.map((s) => ({
    id: s.properties?.sheetId,
    title: s.properties?.title,
    index: s.properties?.index,
  })) || [];
}

export function parseSheetRows(rows: string[][]): HifzSheetRow[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  
  // Find column indices based on actual sheet headers
  const srNoIdx = headers.findIndex((h) => ["sr.no", "srno", "sr no", "serial", "#"].includes(h));
  const itsIdx = headers.findIndex((h) => ["its", "its id", "itsid"].includes(h));
  const nameIdx = headers.findIndex((h) => ["name", "student name", "studentname", "اسم الطالب", "الطالب"].includes(h));
  const darajahIdx = headers.findIndex((h) => ["darajah", "grade", "الصف"].includes(h));
  const sanahIdx = headers.findIndex((h) => ["sanah", "year", "section", "القسم"].includes(h));
  const currentJuzIdx = headers.findIndex((h) => ["current juz", "currentjuz", "juz", "الجزء الحالي"].includes(h));
  const currentSafahIdx = headers.findIndex((h) => ["current safah", "currentsafah", "safah", "page", "الصفحة الحالية"].includes(h));
  const totalJadeedPagesIdx = headers.findIndex((h) => ["total jadeed pages", "totaljadeedpages", "jadeed pages", "الصفحات الجديدة"].includes(h));
  const pendingAjzaIdx = headers.findIndex((h) => ["pending ajza", "pendingajza", "pending", "المعلقة"].includes(h));
  const weakAjzaIdx = headers.findIndex((h) => ["weak ajza", "weakajza", "weak", "الضعيفة"].includes(h));
  const murajaatMarksIdx = headers.findIndex((h) => ["murajaat marks (20)", "murajaat marks", "murajaat", "المراجعة"].includes(h));
  const juzhaliMarksIdx = headers.findIndex((h) => ["juzhali marks (20)", "juzhali marks", "juzhali", "الحفظ"].includes(h));
  const jadeedMarksIdx = headers.findIndex((h) => ["jadeed marks (10)", "jadeed marks", "jadeed", "الجديد"].includes(h));
  const totalMarksIdx = headers.findIndex((h) => ["total (50)", "total", "المجموع"].includes(h));
  const performanceIdx = headers.findIndex((h) => ["overall performance %", "overall performance", "performance", "الأداء العام"].includes(h));
  const email1Idx = headers.findIndex((h) => ["email id 1", "email1", "email", "البريد الإلكتروني"].includes(h));
  const email2Idx = headers.findIndex((h) => ["email id 2", "email2"].includes(h));

  return rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== "")).map((row) => {
    const currentJuz = parseInt(row[currentJuzIdx] || "0", 10) || 0;
    
    // Determine status based on current juz
    let status = "NOT_STARTED";
    if (currentJuz >= 30) status = "COMPLETED";
    else if (currentJuz > 0) status = "IN_PROGRESS";

    return {
      srNo: parseInt(row[srNoIdx] || "0", 10) || 0,
      its: (row[itsIdx] || "").trim(),
      studentName: (row[nameIdx] || "").trim(),
      darajah: (row[darajahIdx] || "").trim(),
      sanah: (row[sanahIdx] || "").trim(),
      currentJuz,
      currentSafah: parseInt(row[currentSafahIdx] || "0", 10) || 0,
      totalJadeedPages: parseInt(row[totalJadeedPagesIdx] || "0", 10) || 0,
      pendingAjza: parseInt(row[pendingAjzaIdx] || "0", 10) || 0,
      weakAjza: parseInt(row[weakAjzaIdx] || "0", 10) || 0,
      murajaatMarks: parseInt(row[murajaatMarksIdx] || "0", 10) || 0,
      juzhaliMarks: parseInt(row[juzhaliMarksIdx] || "0", 10) || 0,
      jadeedMarks: parseInt(row[jadeedMarksIdx] || "0", 10) || 0,
      totalMarks: parseInt(row[totalMarksIdx] || "0", 10) || 0,
      performancePercent: parseFloat(row[performanceIdx] || "0") || 0,
      email1: (row[email1Idx] || "").trim(),
      email2: (row[email2Idx] || "").trim(),
    };
  });
}
