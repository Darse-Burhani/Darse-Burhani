/**
 * Full Makhtabat Books Import — All 452 books with proper genre barcodes
 * Handles ALL genres discovered: Art, Atlas, Biography, Commerce, Fiction,
 * GK, Geography, History, Linguistic, Management, Math, PT, Psychology,
 * Quiz, Science, Self help, Space, Travel
 *
 * Run: npx tsx src/scripts/import_makhtabat_full.ts  (from server/ dir)
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

// ── Genre → Barcode Prefix + Shelf Metadata ──
// Same genre = same numeric prefix. Different genre = different prefix.
// Format: {PREFIX}-{0001..9999}
const GENRE_META: Record<string, {
  code: string; rack: string; shelf: string; color: string; standardName: string;
}> = {
  "Art":          { code: "09", rack: "A", shelf: "1", color: "#ec4899", standardName: "Art" },
  "Arts":         { code: "09", rack: "A", shelf: "1", color: "#ec4899", standardName: "Art" },
  "Atlas":        { code: "11", rack: "B", shelf: "1", color: "#3b82f6", standardName: "Atlas" },
  "Biography":    { code: "10", rack: "C", shelf: "1", color: "#f59e0b", standardName: "Biography" },
  "Commerce":     { code: "16", rack: "D", shelf: "1", color: "#10b981", standardName: "Commerce" },
  "Fiction":      { code: "02", rack: "H", shelf: "1", color: "#f43f5e", standardName: "Fiction" },
  "GK":           { code: "15", rack: "F", shelf: "1", color: "#8b5cf6", standardName: "General Knowledge (GK)" },
  "General Knowledge": { code: "15", rack: "F", shelf: "1", color: "#8b5cf6", standardName: "General Knowledge (GK)" },
  "Geography":    { code: "17", rack: "E", shelf: "1", color: "#06b6d4", standardName: "Geography" },
  "History":      { code: "05", rack: "I", shelf: "1", color: "#a16207", standardName: "History" },
  "Linguistic":   { code: "08", rack: "J", shelf: "1", color: "#0ea5e9", standardName: "Linguistics" },
  "Management":   { code: "18", rack: "K", shelf: "1", color: "#14b8a6", standardName: "Management" },
  "Math":         { code: "07", rack: "L", shelf: "1", color: "#6366f1", standardName: "Mathematics" },
  "Maths":        { code: "07", rack: "L", shelf: "1", color: "#6366f1", standardName: "Mathematics" },
  "Mathematics":  { code: "07", rack: "L", shelf: "1", color: "#6366f1", standardName: "Mathematics" },
  "PT":           { code: "19", rack: "M", shelf: "1", color: "#22c55e", standardName: "Physical Training" },
  "Psychology":   { code: "20", rack: "N", shelf: "1", color: "#c084fc", standardName: "Psychology" },
  "Quiz":         { code: "21", rack: "O", shelf: "1", color: "#fb923c", standardName: "Quiz & Trivia" },
  "Science":      { code: "04", rack: "P", shelf: "1", color: "#38bdf8", standardName: "Science" },
  "Self help":    { code: "13", rack: "Q", shelf: "1", color: "#fbbf24", standardName: "Self-Help" },
  "Self-Help":    { code: "13", rack: "Q", shelf: "1", color: "#fbbf24", standardName: "Self-Help" },
  "Space":        { code: "22", rack: "R", shelf: "1", color: "#818cf8", standardName: "Space & Astronomy" },
  "Travel":       { code: "23", rack: "S", shelf: "1", color: "#34d399", standardName: "Travel" },
};

const FALLBACK_META = { code: "99", rack: "Z", shelf: "1", color: "#6b7280" };

async function main() {
  const jsonPath = path.resolve("d:/Darse Burhani/public/excel_books_all.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("ERROR: excel_books_all.json not found. Run analyze_excel.py first.");
    process.exit(1);
  }

  const books: Array<{ excel_row: number; title: string; genre: string }> = JSON.parse(
    fs.readFileSync(jsonPath, "utf-8")
  );
  console.log(`Loaded ${books.length} books from Excel JSON.`);

  // Fetch all existing records for dedup checks
  const existingRecords = await prisma.libraryBook.findMany({
    select: { id: true, barcode: true, title: true },
  });
  const existingBarcodes = new Set<string>(
    existingRecords.map((b: any) => b.barcode).filter(Boolean) as string[]
  );
  // Map normalized title -> id
  const existingTitles = new Map<string, string>(
    existingRecords.map((b: any) => [b.title.toLowerCase().trim(), b.id])
  );
  console.log(`Found ${existingRecords.length} existing books in database.`);

  // Find DB books already imported from makhtabat to track what's missing
  const dbTitles = new Set(existingRecords.map((b: any) => b.title.toLowerCase().trim()));
  const missingFromDB = books.filter((b: any) => !dbTitles.has(b.title.toLowerCase().trim()));
  console.log(`Books NOT yet in DB: ${missingFromDB.length}`);
  console.log(`Books already in DB: ${books.length - missingFromDB.length}`);
  console.log();

  // Per-genre sequence counters — start from existing max to avoid barcode collision
  const genreCounters: Record<string, number> = {};

  // Pre-seed counters from existing barcodes
  for (const barcode of existingBarcodes) {
    if (!barcode) continue;
    const match = barcode.match(/^(\d+)-(\d+)$/);
    if (match) {
      const code = match[1];
      const seq = parseInt(match[2], 10);
      genreCounters[code] = Math.max(genreCounters[code] ?? 0, seq + 1);
    }
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const book of books) {
    const rawGenre = book.genre.trim();
    const meta = GENRE_META[rawGenre] ?? {
      ...FALLBACK_META,
      standardName: rawGenre || "General",
    };

    const code = meta.code;
    genreCounters[code] = genreCounters[code] ?? 1;

    // Generate a unique barcode with genre prefix
    let seq = genreCounters[code];
    let barcode = `${code}-${String(seq).padStart(4, "0")}`;
    while (existingBarcodes.has(barcode)) {
      seq++;
      barcode = `${code}-${String(seq).padStart(4, "0")}`;
    }
    genreCounters[code] = seq + 1;
    existingBarcodes.add(barcode);

    const titleKey = book.title.trim().toLowerCase();
    const existingId = existingTitles.get(titleKey);

    // "inserted" is a sentinel meaning we already handled it in THIS run — skip
    if (existingId && existingId !== "inserted") {
      // Update genre/barcode/location for a real pre-existing DB record
      try {
        await prisma.libraryBook.update({
          where: { id: existingId },
          data: {
            category: meta.standardName,
            rackNumber: meta.rack,
            shelfNumber: meta.shelf,
            locationColor: meta.color,
          },
        });
        updatedCount++;
      } catch {
        // Record may have been deleted between fetch and update — treat as new
        await prisma.libraryBook.create({
          data: {
            title: book.title.trim(),
            category: meta.standardName,
            barcode,
            rackNumber: meta.rack,
            shelfNumber: meta.shelf,
            locationColor: meta.color,
            status: "AVAILABLE",
            totalCopies: 1,
            availableCopies: 1,
            notes: `Makhtabat Collection — ${rawGenre}`,
          },
        });
        insertedCount++;
      }
      existingTitles.set(titleKey, "inserted");
    } else if (!existingId) {
      // Brand new book
      await prisma.libraryBook.create({
        data: {
          title: book.title.trim(),
          category: meta.standardName,
          barcode,
          rackNumber: meta.rack,
          shelfNumber: meta.shelf,
          locationColor: meta.color,
          status: "AVAILABLE",
          totalCopies: 1,
          availableCopies: 1,
          notes: `Makhtabat Collection — ${rawGenre}`,
        },
      });
      insertedCount++;
      existingTitles.set(titleKey, "inserted");
    }
    // else: existingId === "inserted" → duplicate title in Excel, skip silently
  }

  console.log("=== FULL IMPORT COMPLETE ===");
  console.log(`✅ Newly Inserted: ${insertedCount}`);
  console.log(`🔄 Updated (genre/shelf): ${updatedCount}`);
  console.log(`📚 Total Books in Library: ${await prisma.libraryBook.count()}`);

  // Final genre summary
  const summary = await prisma.libraryBook.groupBy({
    by: ["category"],
    _count: true,
    orderBy: { category: "asc" },
  });
  console.log("\nFinal Books by Genre in Database:");
  for (const s of summary) {
    console.log(`  ${s.category.padEnd(32)} → ${s._count} books`);
  }

  // One sample barcode per genre
  console.log("\nSample Barcodes (one per genre):");
  const allBooks = await prisma.libraryBook.findMany({
    select: { title: true, category: true, barcode: true, rackNumber: true, shelfNumber: true },
    orderBy: [{ category: "asc" }, { barcode: "asc" }],
  });
  const seenGenres = new Set<string>();
  for (const b of allBooks) {
    if (!seenGenres.has(b.category)) {
      seenGenres.add(b.category);
      console.log(
        `  [${(b.barcode ?? "N/A").padEnd(9)}] ${b.category.padEnd(32)} Rack ${b.rackNumber} | "${b.title}"`
      );
    }
  }
}

main()
  .then(() => { console.log("\nDone!"); process.exit(0); })
  .catch((err) => { console.error("\nError:", err); process.exit(1); });
