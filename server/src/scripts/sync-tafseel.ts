import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUBJECT_ALIAS_MAP: Record<string, string[]> = {
  'Tamreen': ['Tamreen'],
  'Quran Kareem': ['Dirasat Uloom il-Quran', 'Quran', 'Quran Hifz'],
  'English': ['English'],
  'Sciences': ['Science', 'Physics', 'Chemistry', 'Biology'],
  'Fiqh': ['Kitab al-Taharat', 'Mukhtasar al-Asar', 'Daim al-Islam', 'Kitab al-Iqtisar'],
  'Adab': ['Qasaid', 'Insha', 'Tadreeb'],
  'Akhbaar': ['Sharhal akhbar', 'Muntaza al-Akhbar', 'Hist/Civ'],
  'Hikmat': ['Raudat Hidayat', 'Risalah A', 'Risalah B'],
  'Al-Lisān al-ʿArabī': ['Lisan Arabi', 'Al-Lisān al-ʿArabī', 'Tamreen'],
};

export async function importTafseelCurriculum() {
  console.log('--- Starting Tafseel & Takhteet Ingestion for Darajah 1, 2, 3, 4 ---');

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminId = adminUser ? adminUser.id : 'system-admin';

  // 1. Fetch classes 1A-4B
  const classes = await prisma.class.findMany({
    where: { name: { in: ['1 A', '1 B', '2 A', '2 B', '3 A', '3 B', '4 A', '4 B'] } },
    include: { teacher: { include: { user: true } } },
  });
  const classMap = new Map<string, any>();
  classes.forEach((c) => classMap.set(c.name, c));

  // 2. Fetch timetable slots for teacher-subject mappings
  const slots = await prisma.timetableSlot.findMany({
    where: { className: { in: ['1 A', '1 B', '2 A', '2 B', '3 A', '3 B', '4 A', '4 B'] }, isBreak: false },
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
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
    console.log(`Read ${rows.length} rows from Tafseel ${d}.xlsx`);

    for (const r of rows) {
      const clsNum = String(r.Class || d).trim();
      const rawGender = String(r.Gender || 'M').trim().toUpperCase();
      const section = rawGender === 'F' ? 'B' : 'A';
      const className = `${clsNum} ${section}`;
      const cls = classMap.get(className);
      if (!cls) continue;

      const subject = String(r.Subject || '').trim();
      const bookName = String(r.BookName || '').trim();
      const zikr = String(r.Zikr || '').trim();
      const level = String(r.Level || '').trim();
      const pages = String(r.Pages || '').trim();
      const ibarat = String(r['Ibarat/Chapter'] || '').trim();

      // Resolve Teacher
      let matchedTeacherId: string | null = null;
      let matchedTeacherName: string = '';

      // Direct match
      const direct = slotMap.get(`${className}::${subject.toLowerCase()}`);
      if (direct && direct.teacherId) {
        matchedTeacherId = direct.teacherId;
        matchedTeacherName = direct.teacherName || '';
      } else {
        // Alias match
        const aliases = SUBJECT_ALIAS_MAP[subject] || [];
        for (const alias of aliases) {
          const found = slotMap.get(`${className}::${alias.toLowerCase()}`);
          if (found && found.teacherId) {
            matchedTeacherId = found.teacherId;
            matchedTeacherName = found.teacherName || '';
            break;
          }
        }
      }

      // Fallback to class teacher
      if (!matchedTeacherId) {
        matchedTeacherId = cls.teacherId;
        matchedTeacherName = `${cls.teacher?.user?.firstName || ''} ${cls.teacher?.user?.lastName || ''}`.trim();
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
        subject: subject || cls.subject || 'General',
        title: title.slice(0, 500),
        description: descParts.join(' | ') || null,
        academicYear: cls.academicYear || '1448 H',
        status: 'PENDING',
        progress: 0,
        assignedById: adminId,
      });

      classCounts[className] = (classCounts[className] || 0) + 1;
      teacherCounts[matchedTeacherName] = (teacherCounts[matchedTeacherName] || 0) + 1;
    }
  }

  console.log(`Total Takhteet portions prepared: ${recordsToInsert.length}`);

  // Delete existing old takhteet plans and progress logs
  console.log('Clearing old Takhteet plans and progress logs...');
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
    console.log(`Inserted ${inserted} / ${recordsToInsert.length} portions...`);
  }

  console.log('✓ Ingestion complete!');
  console.log('Portions per Class:', classCounts);
  console.log('Portions per Teacher:', teacherCounts);

  return {
    total: inserted,
    classCounts,
    teacherCounts,
  };
}

if (process.argv[1]?.endsWith('sync-tafseel.ts') || process.argv[1]?.endsWith('sync-tafseel.js')) {
  importTafseelCurriculum()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
    });
}

