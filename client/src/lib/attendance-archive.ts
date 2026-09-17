/**
 * Attendance Archive — localStorage all-days stacking + weekly individual reports
 * Every day's attendance (Talabat + Faculty) is persisted locally so the whole
 * month can be re-assembled offline. Weekly CSVs are bifurcated with nice theme.
 */

const PREFIX = "attendance-archive-";
const INDEX_KEY = "attendance-archive-index";
const META_KEY = "attendance-archive-meta";

export interface ArchivedDay {
  date: string; // YYYY-MM-DD
  savedAt: string;
  records: any[]; // AttendanceLogRecordItem[]
  summary?: any;
  talabatSummary?: any;
  facultySummary?: any;
  overallSummary?: any;
}

function esc(v: string): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function fmtTimeIST(t: string | null | undefined): string {
  if (!t) return "--";
  try {
    return new Date(t).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "--";
  }
}

function fmtDateIST(d: string): string {
  try {
    return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return d;
  }
}

// ── Index helpers ──
function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeIndex(dates: string[]) {
  const uniq = Array.from(new Set(dates)).sort();
  localStorage.setItem(INDEX_KEY, JSON.stringify(uniq));
}

export function saveDailyArchive(date: string, payload: Omit<ArchivedDay, "date" | "savedAt"> & Partial<ArchivedDay>) {
  try {
    const day: ArchivedDay = {
      date,
      savedAt: new Date().toISOString(),
      records: payload.records || [],
      summary: payload.summary,
      talabatSummary: (payload as any).talabatSummary,
      facultySummary: (payload as any).facultySummary,
      overallSummary: (payload as any).overallSummary,
    };
    localStorage.setItem(`${PREFIX}${date}`, JSON.stringify(day));
    const idx = readIndex();
    if (!idx.includes(date)) {
      idx.push(date);
      writeIndex(idx);
    }
    // also update meta
    const meta = { lastSaved: new Date().toISOString(), totalDays: readIndex().length };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {}
}

export function getDailyArchive(date: string): ArchivedDay | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${date}`);
    if (!raw) return null;
    return JSON.parse(raw) as ArchivedDay;
  } catch {
    return null;
  }
}

export function getAllArchivedDays(): string[] {
  return readIndex();
}

export function getArchivedDataForMonth(month: string): ArchivedDay[] {
  // month = YYYY-MM
  const days = getAllArchivedDays().filter((d) => d.startsWith(month));
  return days.map((d) => getDailyArchive(d)).filter(Boolean) as ArchivedDay[];
}

export function clearArchive(olderThanDays?: number) {
  try {
    if (olderThanDays) {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const idx = readIndex();
      const keep: string[] = [];
      for (const d of idx) {
        if (d < cutoff) localStorage.removeItem(`${PREFIX}${d}`);
        else keep.push(d);
      }
      writeIndex(keep);
    } else {
      const idx = readIndex();
      for (const d of idx) localStorage.removeItem(`${PREFIX}${d}`);
      localStorage.removeItem(INDEX_KEY);
      localStorage.removeItem(META_KEY);
    }
  } catch {}
}

// ── CSV generation ──
function buildBifurcatedCsv(daysData: ArchivedDay[], title: string, rangeLabel: string): string {
  const rows: string[] = [];
  const totalRecords = daysData.reduce((a, d) => a + (d.records?.length || 0), 0);
  const allDates = daysData.map((d) => d.date).sort();
  const from = allDates[0] || rangeLabel;
  const to = allDates[allDates.length - 1] || rangeLabel;

  rows.push(esc(`DARSE BURHANI — ATTENDANCE ARCHIVE (BIFURCATED) — ${title}`));
  rows.push(esc(`Range: ${from} to ${to} | Days: ${daysData.length} | Total Records: ${totalRecords} | Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST — Highlights: Name | ITS | Scan Time | Present/Late/Absent`));
  rows.push("");

  // Summary per day
  rows.push(esc("── SUMMARY PER DAY ──"));
  rows.push([esc("Date"), esc("Talabat Present"), esc("Talabat Late"), esc("Talabat Absent"), esc("Faculty Present"), esc("Faculty Late"), esc("Faculty Absent"), esc("Total")].join(","));
  for (const day of daysData) {
    const t = (day as any).talabatSummary || {};
    const f = (day as any).facultySummary || {};
    const tot = (day.summary?.total ?? day.records?.length ?? 0);
    rows.push([esc(fmtDateIST(day.date)), esc(String(t.present ?? 0)), esc(String(t.late ?? 0)), esc(String(t.absent ?? 0)), esc(String(f.present ?? 0)), esc(String(f.late ?? 0)), esc(String(f.absent ?? 0)), esc(String(tot))].join(","));
  }
  rows.push("");

  const header = [esc("Name"), esc("ITS / Employee ID"), esc("Grade / Department"), esc("Role"), esc("Date"), esc("Scan Time (IST) — Highlighted"), esc("Status — Present/Late/Absent (Highlighted)"), esc("Source"), esc("Remarks")].join(",");

  // TALABAT section — per day
  rows.push(esc("──────── TALABAT (STUDENTS) ────────"));
  rows.push(header);
  for (const day of daysData) {
    const dateLabel = fmtDateIST(day.date);
    const students = day.records.filter((r: any) => r.role === "STUDENT" || r.role === "TALABAT");
    for (const r of students) {
      rows.push([esc(r.name), esc(r.its || r.memberId || ""), esc(r.grade ? `Grade ${r.grade}-${r.section || ""}` : r.designationOrClass || ""), esc("Talabat"), esc(dateLabel), esc(fmtTimeIST(r.checkInTime)), esc(r.status), esc(r.source || ""), esc(r.remarks || "")].join(","));
    }
  }
  rows.push("");

  // FACULTY section
  rows.push(esc("──────── FACULTY (TEACHERS) ────────"));
  rows.push(header);
  for (const day of daysData) {
    const dateLabel = fmtDateIST(day.date);
    const faculty = day.records.filter((r: any) => r.role === "FACULTY");
    for (const r of faculty) {
      rows.push([esc(r.name), esc(r.its || r.memberId || ""), esc(r.section || r.designationOrClass || "Faculty"), esc("Faculty"), esc(dateLabel), esc(fmtTimeIST(r.checkInTime)), esc(r.status), esc(r.source || ""), esc(r.remarks || "")].join(","));
    }
  }

  return "\uFEFF" + rows.join("\r\n");
}

export function generateMonthlyBifurcatedCsv(month: string): { csv: string; filename: string } | null {
  const daysData = getArchivedDataForMonth(month).sort((a, b) => a.date.localeCompare(b.date));
  if (daysData.length === 0) return null;
  const csv = buildBifurcatedCsv(daysData, `MONTHLY ARCHIVE — ${month}`, month);
  return { csv, filename: `Attendance-Monthly-Bifurcated-${month}.csv` };
}

export function generateWeeklyReports(month: string): Array<{ weekLabel: string; csv: string; filename: string; dates: string[] }> {
  const daysData = getArchivedDataForMonth(month).sort((a, b) => a.date.localeCompare(b.date));
  if (daysData.length === 0) return [];

  // Group by week: Week 1 = 1-7, Week 2 = 8-14, Week 3 = 15-21, Week 4 = 22-28, Week 5 = 29-31
  const weeks: Record<string, ArchivedDay[]> = {};
  for (const day of daysData) {
    const d = parseInt(day.date.slice(-2), 10);
    let label = "";
    if (d <= 7) label = "Week-1 (01-07)";
    else if (d <= 14) label = "Week-2 (08-14)";
    else if (d <= 21) label = "Week-3 (15-21)";
    else if (d <= 28) label = "Week-4 (22-28)";
    else label = "Week-5 (29-31)";
    if (!weeks[label]) weeks[label] = [];
    weeks[label].push(day);
  }

  const result: Array<{ weekLabel: string; csv: string; filename: string; dates: string[] }> = [];
  for (const [label, wDays] of Object.entries(weeks)) {
    const csv = buildBifurcatedCsv(wDays, `${month} — ${label}`, label);
    result.push({ weekLabel: label, csv, filename: `Attendance-${month}-${label.replace(/[^A-Za-z0-9-]/g, "")}-bifurcated.csv`, dates: wDays.map((d) => d.date) });
  }
  return result.sort((a, b) => a.weekLabel.localeCompare(b.weekLabel));
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getArchiveStats(): { totalDays: number; earliest?: string; latest?: string } {
  const days = getAllArchivedDays().sort();
  return { totalDays: days.length, earliest: days[0], latest: days[days.length - 1] };
}
