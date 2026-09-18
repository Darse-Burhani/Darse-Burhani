/**
 * Makhtabat Books Standalone Import Script
 * Uses @prisma/client directly to avoid @sentry/node dependency.
 * Run from server/ directory: npx tsx src/scripts/import_makhtabat_standalone.ts
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

// ── Genre → Barcode Prefix Mapping ──
// Same genre = same numeric prefix; different genre = different prefix
// Format: {PREFIX}-{0001..9999}
// Art=09, Atlas=11, Biography=10, Commerce=16, Geography=17, GK=15
const GENRE_META: Record<
  string,
  {
    code: string;
    rack: string;
    shelf: string;
    color: string;
    standardName: string;
  }
> = {
  Art: { code: "09", rack: "A", shelf: "1", color: "#ec4899", standardName: "Art" },
  Arts: { code: "09", rack: "A", shelf: "1", color: "#ec4899", standardName: "Art" },
  Atlas: { code: "11", rack: "B", shelf: "1", color: "#3b82f6", standardName: "Atlas" },
  Biography: { code: "10", rack: "C", shelf: "1", color: "#f59e0b", standardName: "Biography" },
  Commerce: { code: "16", rack: "D", shelf: "1", color: "#10b981", standardName: "Commerce" },
  Geography: { code: "17", rack: "E", shelf: "1", color: "#06b6d4", standardName: "Geography" },
  GK: { code: "15", rack: "F", shelf: "1", color: "#8b5cf6", standardName: "General Knowledge (GK)" },
  "General Knowledge": { code: "15", rack: "F", shelf: "1", color: "#8b5cf6", standardName: "General Knowledge (GK)" },
};

const FALLBACK_META = {
  code: "99",
  rack: "G",
  shelf: "1",
  color: "#6b7280",
};

async function main() {
  const jsonPath = path.resolve("d:/Darse Burhani/public/makhtabat_extracted.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`ERROR: Could not find extracted JSON at ${jsonPath}`);
    console.error("Please ensure python extraction step ran successfully first.");
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const books: Array<{ row: number; title: string; genre: string }> = JSON.parse(rawData);
  console.log(`Loaded ${books.length} books from JSON.`);

  // Get all existing barcodes to prevent collision
  const existingRecords = await prisma.libraryBook.findMany({
    select: { barcode: true, title: true, id: true },
  });
  const existingBarcodes = new Set<string>(
    existingRecords.map((b: any) => b.barcode).filter(Boolean) as string[]
  );
  const existingTitles = new Map<string, string>(
    existingRecords.map((b: any) => [b.title.toLowerCase().trim(), b.id])
  );
  console.log(`Found ${existingRecords.length} existing books in database.`);

  // Track per-genre sequential counter
  const genreCounters: Record<string, number> = {};

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const book of books) {
    const rawGenre = book.genre.trim();
    const genreMeta = GENRE_META[rawGenre] ?? {
      ...FALLBACK_META,
      standardName: rawGenre || "General",
    };

    const code = genreMeta.code;
    genreCounters[code] = genreCounters[code] ?? 1;

    // Generate unique barcode with genre prefix
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

    if (existingId) {
      // Update existing — only fill in missing fields, preserve manual data
      await prisma.libraryBook.update({
        where: { id: existingId },
        data: {
          category: genreMeta.standardName,
          barcode: barcode, // always update barcode to match genre schema
          rackNumber: genreMeta.rack,
          shelfNumber: genreMeta.shelf,
          locationColor: genreMeta.color,
        },
      });
      updatedCount++;
    } else {
      // New book from Makhtabat
      await prisma.libraryBook.create({
        data: {
          title: book.title.trim(),
          category: genreMeta.standardName,
          barcode,
          rackNumber: genreMeta.rack,
          shelfNumber: genreMeta.shelf,
          locationColor: genreMeta.color,
          status: "AVAILABLE",
          totalCopies: 1,
          availableCopies: 1,
          notes: `Makhtabat Collection — ${rawGenre}`,
        },
      });
      insertedCount++;
    }
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`✅ Newly Inserted: ${insertedCount}`);
  console.log(`🔄 Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`📚 Total Books in Library: ${await prisma.libraryBook.count()}`);

  // Summary by genre
  const summary = await prisma.libraryBook.groupBy({
    by: ["category"],
    _count: true,
    orderBy: { category: "asc" },
  });
  console.log("\nBooks by Genre:");
  for (const s of summary) {
    console.log(`  ${s.category.padEnd(30)} → ${s._count} books`);
  }

  // Show first barcode per genre as sample
  console.log("\nSample Barcodes (one per genre):");
  const seenGenres = new Set<string>();
  const allBooks = await prisma.libraryBook.findMany({
    select: { title: true, category: true, barcode: true, rackNumber: true, shelfNumber: true },
    orderBy: [{ category: "asc" }, { barcode: "asc" }],
  });
  for (const b of allBooks) {
    if (!seenGenres.has(b.category)) {
      seenGenres.add(b.category);
      console.log(
        `  [${b.barcode?.padEnd(8)}] ${b.category.padEnd(30)} | Rack ${b.rackNumber} Shelf ${b.shelfNumber} | "${b.title}"`
      );
    }
  }
}

main()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nImport error:", err);
    process.exit(1);
  });
