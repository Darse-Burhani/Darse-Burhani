/**
 * Import the talabat roster from "Darse Burhani Profile.xlsx".
 *
 * Why this script exists instead of scripts/import-talabat.ts:
 *   - import-talabat.ts is hardcoded to rows 2..31 (one grade) and reads a
 *     source workbook ("Darse Burhani (Rabea).xlsx") that was never committed,
 *     because .gitignore excludes *.xlsx.
 *   - It also maps columns by fixed letter, but that workbook's layout differs
 *     from the Profile workbook (e.g. it reads bloodGroup from column O, which
 *     in the Profile workbook holds "Mother Email"). Blind reuse would have
 *     written email addresses into the bloodGroup column.
 *   - This script maps columns BY HEADER NAME, so a reordered workbook degrades
 *     safely (the column is skipped) rather than silently corrupting fields.
 *
 * Each student is enrolled in the "General Attendance" class (the app's own
 * catch-all class, created by server/src/lib/attendance-scheduler.ts). Without
 * an enrollment, biometric scan sync can resolve the student but finds no
 * classId, so the AttendanceRecord is never written — only the registry row.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const SRC = path.join(repoRoot, "public", "uploads", "Talabat", "Darse Burhani Profile.xlsx");
// Must match the on-disk folder basename: express serves /uploads from
// public/uploads and paths are case-sensitive on Linux (Render).
const PHOTO_DIR = path.join(repoRoot, "public", "uploads", "Talabat");
const PHOTO_URL_BASE = "/uploads/Talabat";
const CLASS_NAME = "General Attendance";

interface RosterRow {
  its: string;
  nameEn: string;
  nameAr: string;
  std: string;
  div: string;
  idNo: string;
  hafizYear: string;
  maqamAr: string;
  maqam: string;
  watanAr: string;
  watan: string;
  fatherEmail: string;
  motherEmail: string;
  masool: string;
  age?: number;
  bloodGroup: string;
  dobGregorian?: Date;
  dobHijri: string;
}

/** Map header text -> column index, matching on NAME so a reordered sheet is safe. */
function buildColumnMap(header: string[]): Record<string, number> {
  const find = (re: RegExp) => header.findIndex((h) => re.test(String(h).trim()));
  return {
    its: find(/^ITS$/i),
    nameEn: find(/^FULL NAME ENG$/i),
    nameAr: find(/^FULL NAME ARABIC$/i),
    std: find(/^STD$/i),
    div: find(/^Div$/i),
    idNo: find(/^ID NO\.?$/i),
    hafizYear: find(/HAFIZ YEAR/i),
    maqamAr: find(/^MAQAM$/i),           // first MAQAM column is Arabic
    maqam: -1,                            // resolved below (second MAQAM)
    watanAr: find(/^WATAN$/i),            // first WATAN column is Arabic
    watan: -1,                            // resolved below (second WATAN)
    fatherEmail: find(/Father email/i),
    motherEmail: find(/Mother Email/i),
    masool: find(/^Masool$/i),
    age: find(/Gregorian Age/i),
    bloodGroup: find(/Blood Group/i),
    dobGregorian: find(/Dob Gregorian/i),
    dobHijri: find(/Dob Hijri/i),
  };
}

/** Excel serial (days since 1899-12-30) -> Date. Non-numeric input -> undefined. */
function excelSerialToDate(serial: number): Date | undefined {
  if (!serial || !isFinite(serial)) return undefined;
  return new Date(Math.round((serial - 25569) * 86400000));
}

function parseDateCell(v: unknown): Date | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  const n = Number(v);
  if (isFinite(n) && String(v).trim() !== "") return excelSerialToDate(n);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Derive a school email; drop the honorific "bhai". */
function emailFor(nameEn: string): string {
  const parts = nameEn.split(" ").filter(Boolean).filter((p) => !/^bhai$/i.test(p));
  const name = slug(parts[0] || nameEn);
  const middle = parts.length > 2 ? slug(parts[parts.length - 2]) : "";
  const surname = slug(parts[parts.length - 1] || nameEn);
  return `${[name, middle, surname].filter(Boolean).join(".")}@darseburhani.edu`;
}

function cell(row: unknown[], idx: number): string {
  if (idx < 0) return "";
  const v = row[idx];
  return v == null ? "" : String(v).trim();
}

/**
 * Photos on disk are named <ITS>.jpg, but a few are .png/.jpeg. Try each
 * extension rather than assuming .jpg, or those students silently lose their
 * avatar. Case matters on Linux (Render), so compare against the real entries.
 */
function buildPhotoIndex(): Map<string, string> {
  const index = new Map<string, string>();
  if (!fs.existsSync(PHOTO_DIR)) return index;
  for (const entry of fs.readdirSync(PHOTO_DIR)) {
    const m = entry.match(/^(\d{6,})\.(jpe?g|png)$/i);
    if (m) index.set(m[1], entry);
  }
  return index;
}

function makePhotoResolver(photoIndex: Map<string, string>) {
  return (its: string): string | null => {
    const file = photoIndex.get(its);
    return file ? `${PHOTO_URL_BASE}/${encodeURIComponent(file)}` : null;
  };
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source workbook not found at", SRC);
    console.error("Recover it with: git cat-file -p 06dbe1ceb8701c40f2e02323ed902053a02b621a > <dest>");
    process.exit(1);
  }

  const wb = XLSX.readFile(SRC, { sheetRows: 0 });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }) as unknown[][];
  const header = (grid[0] || []).map(String);
  const C = buildColumnMap(header);

  // Duplicate header names (two MAQAM / two WATAN columns): index 0 is the
  // Arabic label, the NEXT occurrence is the English transliteration.
  C.maqam = header.findIndex((h, i) => i > C.maqamAr && /^MAQAM$/i.test(String(h).trim()));
  C.watan = header.findIndex((h, i) => i > C.watanAr && /^WATAN$/i.test(String(h).trim()));

  console.log("=== Column map (resolved by header name) ===");
  for (const [k, v] of Object.entries(C)) {
    console.log(`  ${k.padEnd(14)} ${v >= 0 ? `col ${v} = "${header[v]}"` : "NOT FOUND (will be skipped)"}`);
  }
  if (C.its < 0 || C.nameEn < 0) {
    console.error("\nFATAL: workbook is missing the ITS / FULL NAME ENG columns. Aborting.");
    process.exit(1);
  }

  const rows: RosterRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const its = cell(r, C.its);
    const nameEn = cell(r, C.nameEn);
    if (!/^\d{6,}$/.test(its) || !nameEn) continue;
    if (seen.has(its)) {
      console.warn(`  ! duplicate ITS ${its} at row ${i + 1} — kept first, skipped this one`);
      continue;
    }
    seen.add(its);
    const ageRaw = cell(r, C.age);
    rows.push({
      its,
      nameEn,
      nameAr: cell(r, C.nameAr),
      std: cell(r, C.std),
      div: cell(r, C.div),
      idNo: cell(r, C.idNo),
      hafizYear: cell(r, C.hafizYear),
      maqamAr: cell(r, C.maqamAr),
      maqam: cell(r, C.maqam),
      watanAr: cell(r, C.watanAr),
      watan: cell(r, C.watan),
      fatherEmail: cell(r, C.fatherEmail),
      motherEmail: cell(r, C.motherEmail),
      masool: cell(r, C.masool),
      age: /^\d+$/.test(ageRaw) ? parseInt(ageRaw, 10) : undefined,
      bloodGroup: cell(r, C.bloodGroup),
      dobGregorian: parseDateCell(r[C.dobGregorian]),
      dobHijri: cell(r, C.dobHijri),
    });
  }
  console.log(`\nParsed ${rows.length} unique students (from ${grid.length - 1} sheet rows)`);

  // Ensure the catch-all class exists (mirrors attendance-scheduler.ts).
  let fallbackClass = await prisma.class.findFirst({ where: { name: CLASS_NAME, isActive: true } });
  if (!fallbackClass) {
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    let adminTeacher = await prisma.teacherProfile.findFirst();
    if (!adminTeacher && adminUser) {
      adminTeacher = await prisma.teacherProfile.create({
        data: { userId: adminUser.id, employeeId: "EMP-ADMIN", department: "Administration", subjects: ["General"] },
      });
    }
    fallbackClass = await prisma.class.create({
      data: {
        name: CLASS_NAME, grade: "All", section: "A", subject: "General",
        academicYear: "1446-1447", teacherId: adminTeacher?.id || "admin",
      },
    });
    console.log(`Created catch-all class "${CLASS_NAME}" (${fallbackClass.id})`);
  }
  console.log(`Enrollment target class: ${CLASS_NAME} (${fallbackClass.id})`);

  const passwordHash = await bcrypt.hash("student123", 10);
  const resolvePhotoUrl = makePhotoResolver(buildPhotoIndex());
  const usedEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase())
  );

  const stats = { created: 0, updated: 0, enrolled: 0, withPhoto: 0, noPhoto: [] as string[] };

  for (const s of rows) {
    let email = emailFor(s.nameEn);
    if (usedEmails.has(email.toLowerCase())) email = emailFor(s.nameEn).replace("@", `.${s.its}@`);
    usedEmails.add(email.toLowerCase());

    const nameParts = s.nameEn.split(" ").filter(Boolean);
    const firstName = nameParts[0] || s.nameEn;
    const lastName = nameParts.slice(1).join(" ") || "";
    const status = s.hafizYear ? "HAFIZ" : "SANAH";

    const avatarUrl = resolvePhotoUrl(s.its);
    const hasPhoto = Boolean(avatarUrl);
    if (hasPhoto) stats.withPhoto++; else stats.noPhoto.push(`${s.nameEn} (${s.its})`);

    const profileData = {
      studentId: s.its,
      its: s.its,
      // Device fingerprint IS the ITS number — server resolveStudent() and the
      // sync script both try biometricHash first, then its/studentId.
      biometricHash: s.its,
      trNo: s.idNo || null,
      grade: s.std || "1",
      section: s.div || "A",
      nameAr: s.nameAr || null,
      hafizYear: s.hafizYear || null,
      bloodGroup: s.bloodGroup || null,
      dobGregorian: s.dobGregorian ?? null,
      dobHijri: s.dobHijri || null,
      watan: s.watan || null,
      residentCity: s.maqam || null,
      fatherEmail: s.fatherEmail || null,
      motherEmail: s.motherEmail || null,
      age: s.age ?? null,
      status: status as "HAFIZ" | "SANAH",
    };

    await prisma.$transaction(async (tx) => {
      const existing = await tx.studentProfile.findUnique({
        where: { studentId: s.its },
        select: { id: true, userId: true },
      });

      let profileId: string;
      if (existing) {
        profileId = existing.id;
        await tx.user.update({
          where: { id: existing.userId },
          data: { email, firstName, lastName, avatarUrl, role: "STUDENT" },
        });
        await tx.studentProfile.update({ where: { id: profileId }, data: profileData });
        stats.updated++;
      } else {
        const user = await tx.user.create({
          data: {
            email, passwordHash, firstName, lastName, role: "STUDENT", avatarUrl,
            studentProfile: { create: profileData },
          },
          select: { id: true, studentProfile: { select: { id: true } } },
        });
        profileId = user.studentProfile!.id;
        stats.created++;
      }

      // Enrollment is what lets biometric scan sync write an AttendanceRecord:
      // sync-today-scans.mjs resolves classId from an active enrollment, and
      // only falls back to a class whose grade matches student.grade.
      await tx.classEnrollment.upsert({
        where: { classId_studentId: { classId: fallbackClass!.id, studentId: profileId } },
        create: { classId: fallbackClass!.id, studentId: profileId, isActive: true },
        update: { isActive: true },
      });
      stats.enrolled++;
    });
  }

  console.log("\n=== Import Complete ===");
  console.log(`Students parsed : ${rows.length}`);
  console.log(`Created         : ${stats.created}`);
  console.log(`Updated         : ${stats.updated}`);
  console.log(`Enrolled        : ${stats.enrolled} into "${CLASS_NAME}"`);
  console.log(`With photo      : ${stats.withPhoto}`);
  console.log(`Without photo   : ${stats.noPhoto.length}`);
  if (stats.noPhoto.length) {
    console.log("  (avatarUrl left null for these):");
    stats.noPhoto.forEach((n) => console.log(`    - ${n}`));
  }
  console.log("\nDefault student password: student123");
  console.log("Email format: name.middle.surname@darseburhani.edu");
}

main()
  .catch(async (e) => {
    console.error("Import failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
