import { google } from "googleapis";

const sheets = google.sheets("v4");

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
