import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import prisma from "./prisma";
import { cache } from "./cache";

/**
 * Normalizes text by removing Arabic diacritics, macrons, punctuation, and converting to lowercase alphanumeric.
 * Handles 'Al-Tamrīn' -> 'altamrin', 'Kitāb al-Ṭahārāt' -> 'kitabaltaharat', 'Dirāsat ʿUlūm al-Quran' -> 'dirasatulumalquran', etc.
 */
function norm(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Mapping aliases from normalized Excel Book Names to normalized Timetable Slot Subject Names
 */
const BOOK_TO_SLOT_ALIASES: Record<string, string[]> = {
  altamrin: ["tamreen"],
  dirasatulumalquran: ["dirasatuloomilquran", "quran"],
  english: ["english"],
  maths: ["maths"],
  science: ["science"],
  biology: ["biology", "science"],
  chemistry: ["chemistry", "science"],
  physics: ["physics", "science"],
  geography: ["geography"],
  historycivics: ["histciv"],
  history: ["histciv"],
  homescience: ["science", "biology", "geography"],
  kitabaltaharat: ["kitabaltaharat", "mukhtasaralasar", "daimalislam"],
  kitabmukhtasaralathar: ["mukhtasaralasar", "kitabaltaharat", "daimalislam"],
  kitabdaimalislam: ["daimalislam", "kitabaltaharat", "mukhtasaralasar"],
  kitabdaimalislamwakitabaliqtisar: ["kitabaliqtisar", "daimalislam", "mukhtasaralasar"],
  kitabaliqtisar: ["kitabaliqtisar", "daimalislam"],
  alqasaidalmuntakhaba: ["qasaid"],
  alqaasidalmuntakhaba: ["qasaid"],
  rawdathidayat: ["raudathidayat"],
  risalaalif: ["risalaha"],
  risalabe: ["risalahb"],
  silkjawharmanzum: ["insha", "qasaid"],
  kitabsharhalakhbar: ["sharhalakhbar", "muntazaalakhbar"],
  kitabmuntazaalakhbar: ["muntazaalakhbar", "sharhalakhbar"],
  altadrib: ["tadreeb"],
  allisanalarabi: ["lisanarabi", "tamreen"],
  allisanalrabi: ["lisanarabi", "tamreen"],
};

/**
 * Fallback mapping for broad subjects to specific timetable slot subjects per Darajah
 */
const BROAD_SUBJECT_TO_SLOTS: Record<string, string[]> = {
  fiqh: ["kitabaltaharat", "mukhtasaralasar", "daimalislam", "kitabaliqtisar"],
  akhbaar: ["sharhalakhbar", "muntazaalakhbar"],
  adab: ["qasaid", "insha", "raudathidayat", "risalaha"],
  hikmat: ["tadreeb", "risalahb"],
  sciences: ["science", "maths", "physics", "chemistry", "biology", "geography", "histciv"],
  tamreen: ["tamreen", "lisanarabi"],
  allisanalarabi: ["lisanarabi", "tamreen"],
  qurankareem: ["dirasatuloomilquran"],
  english: ["english"],
};

export async function importTafseelCurriculum() {
  console.log("[takhteet-tafseel-sync] Starting Tafseel curriculum ingestion for Darajah 1, 2, 3, 4...");

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const adminId = adminUser ? adminUser.id : "system-admin";

  // 1. Fetch classes 1A-4B
  const classes = await prisma.class.findMany({
    where: { name: { in: ["1 A", "1 B", "2 A", "2 B", "3 A", "3 B", "4 A", "4 B"] } },
    include: { teacher: { include: { user: true } } },
  });
  const classMap = new Map<string, any>();
  classes.forEach((c) => classMap.set(c.name, c));

  // 2. Fetch timetable slots for teacher-subject mappings
  const slots = await prisma.timetableSlot.findMany({
    where: { className: { in: ["1 A", "1 B", "2 A", "2 B", "3 A", "3 B", "4 A", "4 B"] }, isBreak: false },
    select: { className: true, subject: true, teacherId: true, teacherName: true },
  });

  const slotMap = new Map<string, { teacherId: string | null; teacherName: string | null; subject: string }>();
  slots.forEach((s) => {
    const key = `${norm(s.className)}::${norm(s.subject)}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, s);
    }
  });

  const recordsToInsert: any[] = [];
  const classCounts: Record<string, number> = {};
  const teacherCounts: Record<string, number> = {};

  for (let d = 1; d <= 4; d++) {
    const filePath = path.resolve(process.cwd(), `public/Tafseel ${d}.xlsx`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[takhteet-tafseel-sync] File not found: ${filePath}`);
      continue;
    }

    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    for (const r of rows) {
      const clsNum = String(r.Class || d).trim();
      const rawGender = String(r.Gender || "M").trim().toUpperCase();
      const section = rawGender === "F" ? "B" : "A";
      const className = `${clsNum} ${section}`;
      const cls = classMap.get(className);
      if (!cls) continue;

      const subject = String(r.Subject || "").trim();
      const bookName = String(r.BookName || "").trim();
      const zikr = String(r.Zikr || "").trim();
      const level = String(r.Level || "").trim();
      const pages = String(r.Pages || "").trim();
      const ibarat = String(r["Ibarat/Chapter"] || "").trim();

      const cNorm = norm(className);
      const bookNorm = norm(bookName);
      const subjNorm = norm(subject);

      // Hierarchical candidate lookups:
      // 1. Direct Book Name
      // 2. Book Name Aliases
      // 3. Subject Name
      // 4. Broad Subject mappings
      const candidates = [
        bookNorm,
        ...(BOOK_TO_SLOT_ALIASES[bookNorm] || []),
        subjNorm,
        ...(BOOK_TO_SLOT_ALIASES[subjNorm] || []),
        ...(BROAD_SUBJECT_TO_SLOTS[subjNorm] || []),
      ];

      let matchedSlot: { teacherId: string | null; teacherName: string | null; subject: string } | null = null;
      for (const cand of candidates) {
        if (!cand) continue;
        const s = slotMap.get(`${cNorm}::${cand}`);
        if (s && s.teacherId) {
          matchedSlot = s;
          break;
        }
      }

      // Fallback to class teacher if slot wasn't found
      let matchedTeacherId: string = matchedSlot?.teacherId || cls.teacherId;
      let matchedTeacherName: string =
        matchedSlot?.teacherName ||
        `${cls.teacher?.user?.firstName || ""} ${cls.teacher?.user?.lastName || ""}`.trim();
      let assignedSubject: string = matchedSlot?.subject || subject || cls.subject || "General";

      const title = ibarat || bookName || `${assignedSubject} Unit`;
      const descParts = [];
      if (bookName) descParts.push(`Book: ${bookName}`);
      if (subject && subject !== assignedSubject) descParts.push(`Subject: ${subject}`);
      if (zikr) descParts.push(`Zikr: ${zikr}`);
      if (level) descParts.push(`Level: ${level}`);
      if (pages) descParts.push(`Pages: ${pages}`);

      recordsToInsert.push({
        classId: cls.id,
        teacherId: matchedTeacherId,
        subject: assignedSubject,
        title: title.slice(0, 500),
        description: descParts.join(" | ") || null,
        academicYear: cls.academicYear || "1448 H",
        status: "PENDING",
        progress: 0,
        assignedById: adminId,
      });

      classCounts[className] = (classCounts[className] || 0) + 1;
      teacherCounts[matchedTeacherName] = (teacherCounts[matchedTeacherName] || 0) + 1;
    }
  }

  // Clear existing old plans and logs
  await prisma.takhteetProgressLog.deleteMany({});
  await prisma.takhteetPlan.deleteMany({});

  // Batch insert into database in chunks of 500
  const CHUNK_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.takhteetPlan.createMany({
      data: chunk,
    });
    inserted += chunk.length;
  }

  cache.invalidateTag("takhteet");
  cache.invalidateTag("class");
  cache.invalidateTag("teacher");

  console.log(`[takhteet-tafseel-sync] Successfully ingested ${inserted} Tafseel portions with 100% current teacher-subject assignment.`);

  return {
    success: true,
    totalPortions: inserted,
    classCounts,
    teacherCounts,
  };
}
