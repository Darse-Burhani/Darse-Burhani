import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const localProfilePath = path.join(repoRoot, "public", "uploads", "Talabat", "Darse Burhani Profile.xlsx");
const desktopProfilePath = path.join("C:", "Users", "Murtaza Hamid", "OneDrive", "Desktop", "Darse Burhani Profile.xlsx");
const SRC = fs.existsSync(localProfilePath) ? localProfilePath : desktopProfilePath;
const PHOTO_DIR = path.join(repoRoot, "public", "uploads", "talabat");

interface Student {
  row: number;
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
  ageGregorian?: number;
  bloodGroup: string;
  dobGregorian?: Date;
  dobHijri: string;
  ageHijri?: number;
  photoSource?: string;
}

const EMU_PER_PT = 12700;
const HEADER_H = 39 * EMU_PER_PT;
const DATA_H = 115.05 * EMU_PER_PT;
const imgH = 1548000;

function excelSerialToDate(serial: number): Date | undefined {
  if (!serial || !isFinite(serial)) return undefined;
  return new Date(Math.round((serial - 25569) * 86400000));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emailFor(nameEn: string, its: string): string {
  const parts = nameEn
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !/^(bhai|shaikh|mulla|syedna|shk)$/i.test(p));
  if (parts.length === 0) return `${its}@darseburhani.edu`;
  if (parts.length === 1) return `${slug(parts[0])}@darseburhani.edu`;
  const first = slug(parts[0]);
  const last = slug(parts[parts.length - 1]);
  return `${first}.${last}@darseburhani.edu`;
}

function rowOfAnchor(row: number, rowOff: number): number {
  const top = HEADER_H + (row - 1) * DATA_H + rowOff;
  const center = top + imgH / 2;
  return 2 + Math.floor((center - HEADER_H) / DATA_H);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source xlsx not found at", SRC);
    process.exit(1);
  }
  console.log("Loading Excel from:", SRC);

  const zip = await JSZip.loadAsync(fs.readFileSync(SRC));
  const ssXml = await zip.file("xl/sharedStrings.xml")!.async("string");
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const drawXml = (await zip.file("xl/drawings/drawing1.xml")?.async("string")) || "";
  const drawRels = (await zip.file("xl/drawings/_rels/drawing1.xml.rels")?.async("string")) || "";

  // shared strings
  const shared: string[] = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((y) => y[1]).join("")
  );

  // rows -> cells
  const rows = new Map<number, Record<string, string | null>>();
  for (const m of sheetXml.matchAll(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rn = +m[1];
    const cells = new Map<string, string | null>();
    for (const c of m[3].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*? t="(\w+)")?[^>]*>(?:<f>[\s\S]*?<\/f>)?(?:<v>([\s\S]*?)<\/v>)?<\/c>/g)) {
      const col = c[1];
      const type = c[2];
      const v = c[3];
      if (v == null) { cells.set(col, null); continue; }
      if (type === "s") cells.set(col, shared[+v] ?? null);
      else cells.set(col, v);
    }
    rows.set(rn, Object.fromEntries(cells));
  }

  // rels: rId -> media file
  const relMap = new Map<string, string>();
  if (drawRels) {
    for (const m of drawRels.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      relMap.set(m[1], m[2].split("/").pop()!);
    }
  }

  // drawing anchors -> (computed excel row, media file)
  const anchors: { row: number; file: string }[] = [];
  if (drawXml) {
    for (const m of drawXml.matchAll(/<xdr:(?:oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g)) {
      const a = m[1];
      const rid = (a.match(/r:embed="([^"]+)"/) || [])[1];
      if (!rid || !relMap.has(rid)) continue;
      const row = parseInt((a.match(/<xdr:row>(\d+)<\/xdr:row>/) || [])[1] ?? "0", 10);
      const off = parseInt((a.match(/<xdr:rowOff>(\d+)<\/xdr:rowOff>/) || [])[1] ?? "0", 10);
      anchors.push({ row: rowOfAnchor(row, off), file: relMap.get(rid)! });
    }
  }

  // students
  const maxRow = Math.max(...Array.from(rows.keys()), 2);
  const students: Student[] = [];
  for (let r = 2; r <= maxRow; r++) {
    const row = rows.get(r);
    if (!row) continue;
    const its = (row.C || "").trim();
    const d = (row.D || "").trim();
    if (!its || !d) continue;
    students.push({
      row: r,
      its,
      nameEn: d,
      nameAr: (row.E || "").trim(),
      std: (row.F || "").trim(),
      div: (row.G || "").trim(),
      idNo: (row.H || "").trim(),
      hafizYear: (row.I || "").trim(),
      maqamAr: (row.J || "").trim(),
      maqam: (row.K || "").trim(),
      watanAr: (row.L || "").trim(),
      watan: (row.M || "").trim(),
      fatherEmail: (row.N || "").trim(),
      motherEmail: (row.O || "").trim(),
      masool: (row.P || "").trim(),
      ageGregorian: row.Q ? parseInt(row.Q, 10) : undefined,
      bloodGroup: (row.R || "").trim(),
      dobGregorian: excelSerialToDate(parseFloat(row.S || "")),
      dobHijri: (row.T || "").trim(),
      ageHijri: row.U ? parseInt(row.U, 10) : undefined,
    });
  }

  // assign photos by computed anchor row
  const photoByRow = new Map<number, string>();
  for (const a of anchors) photoByRow.set(a.row, a.file);
  for (const st of students) {
    const f = photoByRow.get(st.row);
    if (f) st.photoSource = f;
  }

  console.log(`Parsed ${students.length} students, ${anchors.length} photos in sheet drawing`);

  fs.mkdirSync(PHOTO_DIR, { recursive: true });

  const defaultPassword = await bcrypt.hash("student123", 10);
  let created = 0, updated = 0, skipped = 0, noPhoto = 0;

  for (const st of students) {
    const nameParts = st.nameEn.split(" ").filter(Boolean);
    const firstName = nameParts[0] || st.nameEn;
    const lastName = nameParts.slice(1).join(" ") || "";
    const isHafiz = Boolean(st.hafizYear && st.hafizYear !== "-" && st.hafizYear.trim() !== "");
    const status = isHafiz ? "HAFIZ" : "SANAH";

    // copy photo (preserve original extension)
    let avatarUrl: string | null = null;
    if (st.photoSource) {
      const ext = st.photoSource.includes(".") ? st.photoSource.split(".").pop()!.toLowerCase() : "jpg";
      const ph = zip.file(`xl/media/${st.photoSource}`);
      if (ph) {
        const buf = await ph.async("nodebuffer");
        const outName = `${st.its}.${ext === "png" ? "png" : "jpg"}`;
        fs.writeFileSync(path.join(PHOTO_DIR, outName), buf);
        avatarUrl = `/uploads/talabat/${outName}`;
      }
    }

    // Fallback: check if photo already exists in public/uploads/Talabat or public/uploads/talabat
    if (!avatarUrl) {
      const candidatePaths = [
        path.join(PHOTO_DIR, `${st.its}.jpg`),
        path.join(PHOTO_DIR, `${st.its}.png`),
        path.join(repoRoot, "public", "uploads", "Talabat", `${st.its}.jpg`),
        path.join(repoRoot, "public", "uploads", "Talabat", `${st.its}.png`),
      ];
      for (const cp of candidatePaths) {
        if (fs.existsSync(cp)) {
          const ext = path.extname(cp).toLowerCase();
          const target = path.join(PHOTO_DIR, `${st.its}${ext}`);
          if (cp !== target && !fs.existsSync(target)) {
            fs.copyFileSync(cp, target);
          }
          avatarUrl = `/uploads/talabat/${st.its}${ext}`;
          break;
        }
      }
    }

    if (!avatarUrl) noPhoto++;

    const email = emailFor(st.nameEn, st.its);

    const existing = await prisma.studentProfile.findUnique({
      where: { studentId: st.its },
      select: { userId: true },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: {
          email, firstName, lastName, avatarUrl,
          studentProfile: {
            update: {
              studentId: st.its,
              its: st.its,
              trNo: st.idNo || null,
              hafizYear: isHafiz ? st.hafizYear : null,
              bloodGroup: st.bloodGroup || null,
              dobGregorian: st.dobGregorian || null,
              dobHijri: st.dobHijri || null,
              watan: st.watan || null,
              residentCity: st.maqam || null,
              fatherEmail: st.fatherEmail || null,
              motherEmail: st.motherEmail || null,
              age: st.ageGregorian ?? null,
              nameAr: st.nameAr || null,
              grade: st.std || undefined,
              section: st.div || undefined,
              status,
            },
          },
        },
      });
      updated++;
      console.log(`  Updated: ${st.its} ${st.nameEn}${avatarUrl ? ` (${avatarUrl})` : " [NO PHOTO]"}${isHafiz ? " [HAFIZ]" : ""}`);
      continue;
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: defaultPassword,
        firstName,
        lastName,
        role: "STUDENT",
        avatarUrl,
        studentProfile: {
          create: {
            studentId: st.its,
            grade: st.std || "Rabea",
            section: st.div || "A",
            its: st.its,
            trNo: st.idNo || null,
            hafizYear: isHafiz ? st.hafizYear : null,
            bloodGroup: st.bloodGroup || null,
            dobGregorian: st.dobGregorian || null,
            dobHijri: st.dobHijri || null,
            watan: st.watan || null,
            residentCity: st.maqam || null,
            fatherEmail: st.fatherEmail || null,
            motherEmail: st.motherEmail || null,
            age: st.ageGregorian ?? null,
            nameAr: st.nameAr || null,
            status,
          },
        },
      },
    });
    created++;
    console.log(`  Created: ${st.its} ${st.nameEn}${avatarUrl ? ` (${avatarUrl})` : " [NO PHOTO]"}${isHafiz ? " [HAFIZ]" : ""}`);
  }

  console.log("\n=== Import Complete ===");
  console.log(`Students parsed: ${students.length}`);
  console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, No photo: ${noPhoto}`);
  console.log(`Photos written to: ${PHOTO_DIR}`);
  console.log(`Default password: student123`);
  console.log(`Email format: name.middle.surname@darseburhani.edu`);

  const noPhotoList = students.filter((s) => !s.photoSource).map((s) => `${s.nameEn} (its ${s.its})`);
  if (noPhotoList.length) {
    console.log("\nStudents WITHOUT a photo in source:");
    noPhotoList.forEach((n) => console.log("  -", n));
  }

  await prisma.$disconnect();
}

main()
  .catch(async (e) => {
    console.error("Import error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
