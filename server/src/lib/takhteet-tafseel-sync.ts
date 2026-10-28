import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import prisma from "./prisma";
import { cache } from "./cache";

const SUBJECT_ALIAS_MAP: Record<string, string[]> = {
  Tamreen: ["Tamreen"],
  "Quran Kareem": ["Dirasat Uloom il-Quran", "Quran", "Quran Hifz"],
  English: ["English"],
  Sciences: ["Science", "Physics", "Chemistry", "Biology"],
  Fiqh: ["Kitab al-Taharat", "Mukhtasar al-Asar", "Daim al-Islam", "Kitab al-Iqtisar"],
  Adab: ["Qasaid", "Insha", "Tadreeb"],
  Akhbaar: ["Sharhal akhbar", "Muntaza al-Akhbar", "Hist/Civ"],
  Hikmat: ["Raudat Hidayat", "Risalah A", "Risalah B"],
  "Al-Lisān al-ʿArabī": ["Lisan Arabi", "Al-Lisān al-ʿArabī", "Tamreen"],
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

  const slotMap = new Map<string, { teacherId: string | null; teacherName: string | null }>();
  slots.forEach((s) => {
    const key = `${s.className}::${s.subject.toLowerCase().trim()}`;
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

      // Resolve Teacher
      let matchedTeacherId: string | null = null;
      let matchedTeacherName: string = "";

      // Direct match
      const direct = slotMap.get(`${className}::${subject.toLowerCase()}`);
      if (direct && direct.teacherId) {
        matchedTeacherId = direct.teacherId;
        matchedTeacherName = direct.teacherName || "";
      } else {
        // Alias match
        const aliases = SUBJECT_ALIAS_MAP[subject] || [];
        for (const alias of aliases) {
          const found = slotMap.get(`${className}::${alias.toLowerCase()}`);
          if (found && found.teacherId) {
            matchedTeacherId = found.teacherId;
            matchedTeacherName = found.teacherName || "";
            break;
          }
        }
      }

      // Fallback to class teacher
      if (!matchedTeacherId) {
        matchedTeacherId = cls.teacherId;
        matchedTeacherName = `${cls.teacher?.user?.firstName || ""} ${cls.teacher?.user?.lastName || ""}`.trim();
      }

      const title = ibarat || bookName || `${subject} Unit`;
      const descParts = [];
      if (bookName) descParts.push(`Book: ${bookName}`);
      if (zikr) descParts.push(`Zikr: ${zikr}`);
      if (level) descParts.push(`Level: ${level}`);
      if (pages) descParts.push(`Pages: ${pages}`);

      recordsToInsert.push({
        classId: cls.id,
        teacherId: matchedTeacherId,
        subject: subject || cls.subject || "General",
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

  console.log(`[takhteet-tafseel-sync] Successfully ingested ${inserted} Tafseel portions for Darajah 1 to 4.`);

  return {
    success: true,
    totalPortions: inserted,
    classCounts,
    teacherCounts,
  };
}

