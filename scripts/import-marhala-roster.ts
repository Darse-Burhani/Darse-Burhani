/**
 * Import marhala-wise talabat roster from public/Marhala wise.xlsx
 * (sheet "RABIULAWWAL 4 ", columns Sr.no | ITS | Name | Marhala).
 *
 * Creates one HifzMarhalaAssignment per student (upsert on
 * @@unique([studentId, academicYear])) with facultyId left NULL so the
 * muhafiz can be assigned later from Admin → Hifz Marhala.
 * Re-runs never wipe an already-assigned muhafiz (batched queries).
 *
 * Usage: npx tsx scripts/import-marhala-roster.ts [academicYear]
 *   academicYear defaults to 2026-2027.
 */
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "public", "Marhala wise.xlsx");
const SHEET = "RABIULAWWAL 4 ";

const EXCEL_TO_ENUM: Record<string, string> = {
  M1: "MARHALA_1",
  M2: "MARHALA_2",
  M3: "MARHALA_3",
  M4: "MARHALA_4",
  M5: "MARHALA_5",
  M6: "MARHALA_6",
  M7: "MARHALA_7",
  M8: "MARHALA_8",
};

async function main() {
  const academicYear = (process.argv[2] || "2026-2027").trim();

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true, deletedAt: null },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No active ADMIN user found — cannot set assignedById.");

  const wb = XLSX.readFile(SRC);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet ${JSON.stringify(SHEET)} not found. Sheets: ${wb.SheetNames.join(", ")}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const data = rows.slice(1).filter((r) => r && r.length > 0);

  // Batch 1: all students + existing assignments (2 queries total).
  const profiles = await prisma.studentProfile.findMany({ select: { id: true, its: true } });
  const byIts = new Map(profiles.map((s) => [String(s.its), s.id]));
  const existing = await prisma.hifzMarhalaAssignment.findMany({
    where: { academicYear },
    select: { id: true, studentId: true, marhala: true },
  });
  const existingByStudent = new Map(existing.map((a) => [a.studentId, a]));

  const toCreate: { studentId: string; marhala: string }[] = [];
  const toMove: { id: string; marhala: string }[] = [];
  const perMarhala: Record<string, number> = {};
  const missingIts: { its: string; name: string; marhala: string }[] = [];
  const unknownMarhala: { its: string; name: string; marhala: string }[] = [];
  let alreadyOk = 0;

  for (const r of data) {
    const its = String(r[1] ?? "").trim();
    const name = String(r[2] ?? "").trim();
    const marhalaRaw = String(r[3] ?? "").trim().toUpperCase();
    const marhala = EXCEL_TO_ENUM[marhalaRaw];
    if (!its) continue;
    if (!marhala) {
      unknownMarhala.push({ its, name, marhala: marhalaRaw });
      continue;
    }
    const studentId = byIts.get(its);
    if (!studentId) {
      missingIts.push({ its, name, marhala: marhalaRaw });
      continue;
    }
    const prev = existingByStudent.get(studentId);
    if (!prev) toCreate.push({ studentId, marhala });
    else if (prev.marhala !== marhala) toMove.push({ id: prev.id, marhala });
    else alreadyOk++;
    perMarhala[marhalaRaw] = (perMarhala[marhalaRaw] || 0) + 1;
  }

  // Batch 2: single createMany + per-row marhala moves (moves preserve muhafiz).
  if (toCreate.length > 0) {
    await prisma.hifzMarhalaAssignment.createMany({
      data: toCreate.map((c) => ({
        studentId: c.studentId,
        marhala: c.marhala as never,
        facultyId: null,
        academicYear,
        assignedById: admin.id,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }
  for (const m of toMove) {
    await prisma.hifzMarhalaAssignment.update({ where: { id: m.id }, data: { marhala: m.marhala as never } });
  }

  console.log(`Academic year: ${academicYear} (assignedBy ${admin.email})`);
  console.log(`Created: ${toCreate.length}, marhala corrected: ${toMove.length}, already correct: ${alreadyOk}`);
  console.log("Per marhala:", JSON.stringify(perMarhala));
  console.log(`Missing ITS (no student): ${missingIts.length}`, missingIts.slice(0, 20));
  console.log(`Unknown marhala values: ${unknownMarhala.length}`, unknownMarhala.slice(0, 20));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
