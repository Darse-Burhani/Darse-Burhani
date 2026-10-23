const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EXPECTED_COUNTS = {
  'Burhanddin Sir Kundli': 28,
  'Mulla Aliasgar bhai Husainali bhai Khandwala': 22,
  'Mulla Husain bhai Mulla Fakhruddin Habib': 21,
  'Mulla Husain bhai Shaikh Asgarali bhai Kanchwala': 24,
  'Mulla Juzer bhai Abbas bhai Bundiwala': 9,
  'Mulla Taher bhai Shaikh Muslim bhai Shakir': 25,
  'Mustafa Tailor': 14,
  'Shaikh Juzer bhai Shaikh Taher bhai Presswala': 22,
  'Shaikh Kumail bhai Shaikh Mustafa bhai Raj': 20,
  'Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali': 21,
  'Shaikh Qutbuddin bhai Zainuddin bhai Ezzy': 16,
  'Shaikh Shabbir bhai Mohsinali bhai Shakir': 18,
};

async function main() {
  console.log('=== Current DB Timetable Slots by Teacher ===');
  const allSlots = await prisma.timetableSlot.findMany({
    include: {
      teacher: {
        include: { user: true }
      }
    }
  });

  console.log(`Total slots in DB: ${allSlots.length}`);

  const countsByTeacherName = {};
  for (const s of allSlots) {
    const tName = s.teacherName || (s.teacher?.user ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}` : 'Unassigned');
    countsByTeacherName[tName] = (countsByTeacherName[tName] || 0) + 1;
  }

  for (const [name, exp] of Object.entries(EXPECTED_COUNTS)) {
    const actual = countsByTeacherName[name] || 0;
    const match = actual === exp ? '✓ MATCH' : `✗ MISMATCH (expected ${exp}, got ${actual})`;
    console.log(`- ${name}: ${match}`);
  }

  // Also check if any teacher has teacherId null
  const nullTeacher = allSlots.filter(s => !s.teacherId);
  console.log(`Slots with null teacherId: ${nullTeacher.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
