import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import prisma from "../lib/prisma.js";

interface GenreConfig {
  prefix: string;
  rack: string;
  color: string;
}

const GENRE_CONFIG: Record<string, GenreConfig> = {
  Art: { prefix: "ART", rack: "Rack B (Literature & Arts)", color: "Pink" },
  Atlas: { prefix: "ATL", rack: "Rack B (Literature & Arts)", color: "Pink" },
  Biography: { prefix: "BIO", rack: "Rack C (Social Sciences & Growth)", color: "Yellow" },
  Commerce: { prefix: "COM", rack: "Rack C (Social Sciences & Growth)", color: "Orange" },
  Geography: { prefix: "GEO", rack: "Rack A (STEM & Exploration)", color: "Blue" },
  GK: { prefix: "GKN", rack: "Rack C (Social Sciences & Growth)", color: "Light Blue" },
  Linguistic: { prefix: "LIN", rack: "Rack B (Literature & Arts)", color: "Green" },
  Management: { prefix: "MGT", rack: "Rack C (Social Sciences & Growth)", color: "Orange" },
  Math: { prefix: "MTH", rack: "Rack A (STEM & Exploration)", color: "Blue" },
  PT: { prefix: "SPT", rack: "Rack C (Social Sciences & Growth)", color: "Light Blue" },
  Quiz: { prefix: "QIZ", rack: "Rack C (Social Sciences & Growth)", color: "Light Blue" },
  Science: { prefix: "SCI", rack: "Rack A (STEM & Exploration)", color: "Blue" },
  "Self help": { prefix: "SLF", rack: "Rack C (Social Sciences & Growth)", color: "Orange" },
  Space: { prefix: "SPC", rack: "Rack A (STEM & Exploration)", color: "Blue" },
  Travel: { prefix: "TRV", rack: "Rack B (Literature & Arts)", color: "Pink" },
  Fiction: { prefix: "FIC", rack: "Rack B (Literature & Arts)", color: "Green" },
  Psychology: { prefix: "PSY", rack: "Rack C (Social Sciences & Growth)", color: "Yellow" },
  History: { prefix: "HIS", rack: "Rack C (Social Sciences & Growth)", color: "Yellow" },
  Manshoraat: { prefix: "MSH", rack: "Rack M (Fatimi Heritage & Dawat)", color: "Purple" },
  Asfar: { prefix: "ASF", rack: "Rack M (Fatimi Heritage & Dawat)", color: "Purple" },
};

function inferAuthor(title: string, genre: string): string {
  if (genre === "Manshoraat" || genre === "Asfar") return "Maktabat Darse Burhani";
  if (title.includes("Harry Potter")) return "J. K. Rowling";
  if (title.includes("Alex Rider")) return "Anthony Horowitz";
  if (title.includes("John Grisham")) return "John Grisham";
  if (title.includes("Sherlock Holmes") || title.includes("Study in Scarlet") || title.includes("Hound of Baskervilles")) return "Arthur Conan Doyle";
  if (title.includes("Wimpy Kid")) return "Jeff Kinney";
  if (title.includes("Roald Dahl") || title.includes("Charlie And the Great Glass Elevator") || title.includes("The BFG") || title.includes("The Witches") || title.includes("Fantastic Fox")) return "Roald Dahl";
  if (title.includes("Bear Grylls")) return "Bear Grylls";
  if (title.includes("Hardy Boys")) return "Franklin W. Dixon";
  if (title.includes("Nancy Drew")) return "Carolyn Keene";
  if (title.includes("Tintin")) return "Hergé";
  if (title.includes("Horrible Science")) return "Nick Arnold";
  if (title.includes("Horrible Histories")) return "Terry Deary";
  if (title.includes("Horrible Geography")) return "Anita Ganeri";
  if (title.includes("Murderous Maths")) return "Kjartan Poskitt";
  if (title.includes("Hunger Games")) return "Suzanne Collins";
  if (title.includes("Famous Five") || title.includes("Secret Seven")) return "Enid Blyton";
  if (title.includes("Percy Jackson")) return "Rick Riordan";
  if (title.includes("Artemis Fowl")) return "Eoin Colfer";
  if (title.includes("Lee Child") || title.includes("Jack Reacher")) return "Lee Child";
  if (title.includes("Series Of Unfortunate Events")) return "Lemony Snicket";
  if (title.includes("Oxford")) return "Oxford University Press";
  if (title.includes("Collins")) return "Collins UK";
  if (title.includes("National Geographic")) return "National Geographic Kids";
  if (title.includes("Guiness")) return "Guinness World Records";
  return "Library Archive";
}

async function seed() {
  console.log("Starting Library Books Seed...");
  const csvPath = path.join(__dirname, "../data/library_books.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found at:", csvPath);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const lines = fileContent.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("BOOK NAME"));

  console.log(`Parsed ${lines.length} book rows from CSV.`);

  const genreCounts: Record<string, number> = {};
  const booksToInsert: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lastComma = line.lastIndexOf(",");
    if (lastComma === -1) continue;

    let title = line.substring(0, lastComma).trim();
    if (title.startsWith('"') && title.endsWith('"')) {
      title = title.substring(1, title.length - 1).trim();
    }
    let genre = line.substring(lastComma + 1).trim();
    if (genre === "Maths") genre = "Math";

    const cfg = GENRE_CONFIG[genre] || {
      prefix: "GEN",
      rack: "Rack General",
      color: "White",
    };

    genreCounts[cfg.prefix] = (genreCounts[cfg.prefix] || 0) + 1;
    const serial = String(genreCounts[cfg.prefix]).padStart(3, "0");
    const barcode = `DB-${cfg.prefix}-${serial}`;

    const shelfIndex = ((genreCounts[cfg.prefix] - 1) % 5) + 1;
    const shelfNumber = `Shelf ${shelfIndex}`;
    const author = inferAuthor(title, genre);

    booksToInsert.push({
      title,
      category: genre,
      barcode,
      rackNumber: cfg.rack,
      shelfNumber,
      locationColor: cfg.color,
      author,
      publisher: genre === "Manshoraat" || genre === "Asfar" ? "Al-Jamea-tus-Saifiyah" : "Darse Burhani Library",
      status: "AVAILABLE",
      totalCopies: 1,
      availableCopies: 1,
      notes: `Genre: ${genre} | Barcode: ${barcode}`,
    });
  }

  console.log(`Ready to insert ${booksToInsert.length} books into the database...`);

  // Clear existing dummy books if any, or append safely
  let inserted = 0;
  for (const book of booksToInsert) {
    await prisma.libraryBook.upsert({
      where: { barcode: book.barcode },
      update: {
        title: book.title,
        category: book.category,
        rackNumber: book.rackNumber,
        shelfNumber: book.shelfNumber,
        locationColor: book.locationColor,
        author: book.author,
        publisher: book.publisher,
        status: book.status,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
        notes: book.notes,
      },
      create: book,
    });
    inserted++;
    if (inserted % 100 === 0 || inserted === booksToInsert.length) {
      console.log(`Processed ${inserted}/${booksToInsert.length} books...`);
    }
  }

  const totalInDb = await prisma.libraryBook.count();
  console.log(`Successfully seeded ${inserted} books! Total in Database: ${totalInDb}`);
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
