const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Fix Burhanddin Kundli - update ITS if not set
  const kundliProfile = await prisma.teacherProfile.findFirst({
    where: { user: { email: 'burhanuddin.kundli@darseburhani.com' } },
    include: { user: true }
  });
  if (kundliProfile) {
    console.log('Kundli found:', kundliProfile.id, '| ITS:', kundliProfile.its, '| User:', kundliProfile.user.firstName, kundliProfile.user.lastName);
    // Also fix firstName / lastName to match PDF exactly
    await prisma.user.update({
      where: { id: kundliProfile.userId },
      data: {
        firstName: 'Burhanddin',
        lastName: 'Sir Kundli',
      }
    });
    console.log('Updated Kundli user name to: Burhanddin Sir Kundli');
  } else {
    console.log('Kundli NOT found in DB!');
  }

  // Fix Habib - update teacherName in timetable_slots to match TEACHER_NAME_MAP
  const habibProfile = await prisma.teacherProfile.findFirst({
    where: { its: '30384792' },
    include: { user: true }
  });
  if (habibProfile) {
    console.log('Habib found:', habibProfile.id, '| ITS:', habibProfile.its, '| User:', habibProfile.user.firstName, habibProfile.user.lastName);
    // Update user name to exact canonical
    await prisma.user.update({
      where: { id: habibProfile.userId },
      data: {
        firstName: 'Mulla Husain bhai Mulla Fakhruddin',
        lastName: 'Habib',
      }
    });
    // Update timetable slots teacherName
    const updated = await prisma.timetableSlot.updateMany({
      where: { teacherId: habibProfile.id },
      data: { teacherName: 'Mulla Husain bhai Mulla Fakhruddin Habib' }
    });
    console.log('Updated Habib slots teacherName:', updated.count);
  }

  // Fix Ezzy - update teacherName in timetable_slots
  const ezzyProfile = await prisma.teacherProfile.findFirst({
    where: { its: '20359538' },
    include: { user: true }
  });
  if (ezzyProfile) {
    console.log('Ezzy found:', ezzyProfile.id, '| ITS:', ezzyProfile.its, '| User:', ezzyProfile.user.firstName, ezzyProfile.user.lastName);
    const updated = await prisma.timetableSlot.updateMany({
      where: { teacherId: ezzyProfile.id },
      data: { teacherName: 'Shaikh Qutbuddin bhai Zainuddin bhai Ezzy' }
    });
    console.log('Updated Ezzy slots teacherName:', updated.count);
  }

  // Verify final counts
  const slots = await prisma.timetableSlot.findMany({ select: { teacherName: true } });
  const counts = {};
  for (const s of slots) counts[s.teacherName] = (counts[s.teacherName] || 0) + 1;
  console.log('\nFinal teacherName counts:');
  console.log(JSON.stringify(counts, null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);
