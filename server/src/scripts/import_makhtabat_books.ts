import prisma from "../lib/prisma";
import fs from "fs";

// ── Category-to-Barcode-Code Mapping ──
// Each genre gets a unique 2-digit numeric prefix
const GENRE_BARCODE_PREFIXES: Record<string, { code: string; rack: string; shelf: string; color: string; standardName: string }> = {
  "Art": { code: "09", rack: "A", shelf: "1", color: "#ec4899", standardName: "Art" },
  "Arts": { code: "09", rack: "A", shelf: "1", color: "#ec4899", standardName: "Art" },
  "Atlas": { code: "11", rack: "B", shelf: "1", color: "#3b82f6", standardName: "Atlas" },
  "Biography": { code: "10", rack: "C", shelf: "1", color: "#f59e0b", standardName: "Biography" },
  "Commerce": { code: "16", rack: "D", shelf: "1", color: "#10b981", standardName: "Commerce" },
  "Geography": { code: "17", rack: "E", shelf: "1", color: "#06b6d4", standardName: "Geography" },
  "GK": { code: "15", rack: "F", shelf: "1", color: "#8b5cf6", standardName: "General Knowledge (GK)" },
  "General Knowledge": { code: "15", rack: "F", shelf: "1", color: "#8b5cf6", standardName: "General Knowledge (GK)" },
};

async function main() {
  const jsonPath = "d:/Darse Burhani/public/makhtabat_extracted.json";
  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const books: Array<{ row: number; title: string; genre: string }> = JSON.parse(rawData);

  console.log(`Loaded ${books.length} books from JSON.`);

  const genreCounters: Record<string, number> = {};

  const existingBooks = await prisma.libraryBook.findMany({ select: { barcode: true, title: true } });
  const existingBarcodes = new Set(existingBooks.map((b) => b.barcode).filter(Boolean));
  console.log(`Found ${existingBooks.length} existing books in database.`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (const book of books) {
    const rawGenre = book.genre.trim();
    const genreMeta = GENRE_BARCODE_PREFIXES[rawGenre] || {
      code: "99",
      rack: "G",
      shelf: "1",
      color: "#6b7280",
      standardName: rawGenre || "General",
    };

    const code = genreMeta.code;
    if (!genreCounters[code]) {
      genreCounters[code] = 1;
    }

    // Generate barcode: {GENRE_CODE}-{4_DIGIT_SEQ}
    let seq = genreCounters[code];
    let barcode = `${code}-${String(seq).padStart(4, "0")}`;

    // Ensure barcode uniqueness
    while (existingBarcodes.has(barcode)) {
      seq++;
      barcode = `${code}-${String(seq).padStart(4, "0")}`;
    }
    genreCounters[code] = seq + 1;
    existingBarcodes.add(barcode);

    // Upsert book by title
    const existing = await prisma.libraryBook.findFirst({
      where: {
        title: { equals: book.title.trim(), mode: "insensitive" },
      },
    });

    if (existing) {
      await prisma.libraryBook.update({
        where: { id: existing.id },
        data: {
          category: genreMeta.standardName,
          barcode: existing.barcode || barcode,
          rackNumber: existing.rackNumber || genreMeta.rack,
          shelfNumber: existing.shelfNumber || genreMeta.shelf,
          locationColor: existing.locationColor || genreMeta.color,
          status: "AVAILABLE",
          availableCopies: existing.availableCopies || 1,
          totalCopies: existing.totalCopies || 1,
        },
      });
      updatedCount++;
    } else {
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
          notes: `Makhtabat Collection - Row ${book.row} (${rawGenre})`,
        },
      });
      insertedCount++;
    }
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Newly Inserted Books: ${insertedCount}`);
  console.log(`Updated Books: ${updatedCount}`);
  console.log(`Total Books in Library: ${await prisma.libraryBook.count()}`);

  // Summary by Genre
  const summary = await prisma.libraryBook.groupBy({
    by: ["category"],
    _count: true,
  });
  console.log("\nBooks by Genre in Database:");
  for (const s of summary) {
    console.log(` - ${s.category}: ${s._count} books`);
  }

  // Sample barcodes per genre
  const sampleBooks = await prisma.libraryBook.findMany({
    select: { title: true, category: true, barcode: true, rackNumber: true, shelfNumber: true },
    orderBy: { barcode: "asc" },
  });
  console.log("\nSample Barcodes Created (Grouped by Genre):");
  const seenGenres = new Set();
  for (const b of sampleBooks) {
    if (!seenGenres.has(b.category)) {
      seenGenres.add(b.category);
      console.log(` [${b.category}] -> Barcode: ${b.barcode} (Rack ${b.rackNumber}, Shelf ${b.shelfNumber}) | Title: ${b.title}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import error:", err);
    process.exit(1);
  });
