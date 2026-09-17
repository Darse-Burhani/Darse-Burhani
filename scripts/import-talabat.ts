import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const SRC = path.join(repoRoot, "public", "uploads", "Talabat", "Darse Burhani (Rabea).xlsx");
const PHOTO_DIR = path.join(repoRoot, "public", "uploads", "talabat");

interface Student {
  row: number;          // excel row (2..31)
  its: string;
  nameEn: string;
  nameAr: string;
  std: string;
  div: string;
  trNo: string;
  hafizYear: string;
  maqamAr: string;
  maqam: string;
  watanAr: string;
  watan: string;
  ageGregorian?: number;
  ageHijri?: number;
  bloodGroup: string;
  dobGregorian?: Date;
  dobHijri: string;
  photoSource?: string; // xl/media/<file>
}

const EMU_PER_PT = 12700;
const HEADER_H = 62.4 * EMU_PER_PT;        // row 1 header
const DATA_H = 115.05 * EMU_PER_PT;        // data rows (2-31)

function excelSerialToDate(serial: number): Date | undefined {
  if (!serial || !isFinite(serial)) return undefined;
  // Excel serial: days since 1899-12-30. 25569 == 1970-01-01
  return new Date(Math.round((serial - 25569) * 86400000));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emailFor(nameEn: string): string {
  const parts = nameEn.split(" ").filter(Boolean).filter((p) => !/^bhai$/i.test(p));
  const name = slug(parts[0] || nameEn);
  const middle = parts.length > 2 ? slug(parts[parts.length - 2]) : "";
  const surname = slug(parts[parts.length - 1] || nameEn);
  return `${[name, middle, surname].filter(Boolean).join(".")}@darseburhani.edu`;
}

function decode(input: string[]): string {
  let s = input.join("");
  const xml = s.replace(/_x000D_/g, "");
  return xml;
}

function rowOfAnchor(anchor: string): number {
  const row = parseInt((anchor.match(/<xdr:row>(\d+)<\/xdr:row>/) || [])[1] ?? "0", 10);
  const rowOff = parseInt((anchor.match(/<xdr:rowOff>(\d+)<\/xdr:rowOff>/) || [])[1] ?? "0", 10);
  const imgH = 1548000;
  const top = HEADER_H + (row - 1) * DATA_H + rowOff;
  const center = top + imgH / 2;
  return 2 + Math.floor((center - HEADER_H) / DATA_H);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source xlsx not found at", SRC);
    process.exit(1);
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(SRC));
  const ssXml = await zip.file("xl/sharedStrings.xml")!.async("string");
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const drawXml = await zip.file("xl/drawings/drawing1.xml")!.async("string");
  const drawRels = await zip.file("xl/drawings/_rels/drawing1.xml.rels")!.async("string");

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
  for (const m of drawRels.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relMap.set(m[1], m[2].split("/").pop()!);
  }

  // drawing anchors -> (row, media file)
  const anchors: { row: number; file: string }[] = [];
  for (const m of drawXml.matchAll(/<xdr:(?:oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g)) {
    const a = m[1];
    const rid = (a.match(/r:embed="([^"]+)"/) || [])[1];
    if (!rid || !relMap.has(rid)) continue;
    anchors.push({ row: rowOfAnchor(a), file: relMap.get(rid)! });
  }

  // students
  const students: Student[] = [];
  for (let r = 2; r <= 31; r++) {
    const row = rows.get(r);
    if (!row) continue;
    const d = row.D || "";
    const its = (row.C || "").trim();
    if (!d || !its) continue;
    students.push({
      row: r,
      its,
      nameEn: d.trim(),
      nameAr: (row.E || "").trim(),
      std: (row.F || "").trim(),
      div: (row.G || "").trim(),
      trNo: (row.H || "").trim(),
      hafizYear: (row.I || "").trim(),
      maqamAr: (row.J || "").trim(),
      maqam: (row.K || "").trim(),
      watanAr: (row.L || "").trim(),
      watan: (row.M || "").trim(),
      bloodGroup: (row.O || "").trim(),
      dobGregorian: excelSerialToDate(parseFloat(row.P || "")),
      dobHijri: (row.Q || "").trim(),
      ageGregorian: row.N ? parseInt(row.N, 10) : undefined,
      ageHijri: row.R ? parseInt(row.R, 10) : undefined,
    });
  }

  // assign photos by computed anchor row
  for (const a of anchors) {
    const st = students.find((s) => s.row === a.row);
    if (st) st.photoSource = a.file;
  }

  console.log(`Parsed ${students.length} students, ${anchors.length} photos`);

  fs.mkdirSync(PHOTO_DIR, { recursive: true });

  const defaultPassword = await bcrypt.hash("student123", 10);
  let created = 0, updated = 0, skipped = 0;

  for (const st of students) {
    const nameParts = st.nameEn.split(" ").filter(Boolean);
    const firstName = nameParts[0] || st.nameEn;
    const lastName = nameParts.slice(1).join(" ") || "";

    // copy photo
    let avatarUrl: string | null = null;
    if (st.photoSource) {
      const ph = zip.file(`xl/media/${st.photoSource}`);
      if (ph) {
        const buf = await ph.async("nodebuffer");
        const outName = `${st.its}.jpg`;
        fs.writeFileSync(path.join(PHOTO_DIR, outName), buf);
        avatarUrl = `/uploads/talabat/${outName}`;
      }
    }

    const email = emailFor(st.nameEn);
    const status = st.hafizYear ? "HAFIZ" : "SANAH";

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
              trNo: st.trNo || null,
              hafizYear: st.hafizYear || null,
              bloodGroup: st.bloodGroup || null,
              dobGregorian: st.dobGregorian || null,
              dobHijri: st.dobHijri || null,
              watan: st.watan || null,
              residentCity: st.maqam || null,
              age: st.ageGregorian ?? null,
              section: st.div || undefined,
              status,
            },
          },
        },
      });
      updated++;
      console.log(`  Updated: ${st.nameEn}`);
      continue;
    }

    const user = await prisma.user.create({
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
            trNo: st.trNo || null,
            hafizYear: st.hafizYear || null,
            bloodGroup: st.bloodGroup || null,
            dobGregorian: st.dobGregorian || null,
            dobHijri: st.dobHijri || null,
            watan: st.watan || null,
            residentCity: st.maqam || null,
            age: st.ageGregorian ?? null,
            status,
          },
        },
      },
    });
    created++;
    console.log(`  Created: ${st.nameEn} (${st.its}) photo=${avatarUrl || "none"}`);
    void user;
  }

  console.log("\n=== Import Complete ===");
  console.log(`Students parsed: ${students.length}`);
  console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`Photos written to: ${PHOTO_DIR}`);
  console.log(`Default password: student123`);
  console.log(`Email format: name.middle.surname@darseburhani.edu`);

  const noPhoto = students.filter((s) => !s.photoSource).map((s) => `${s.nameEn} (its ${s.its})`);
  console.log("\nStudents WITHOUT a photo:");
  noPhoto.forEach((n) => console.log("  -", n));

  await prisma.$disconnect();
}

main()
  .catch(async (e) => {
    console.error("Import error:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(() => decode([]));