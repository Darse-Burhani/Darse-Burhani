/**
 * One-time DB repair: replace every legacy "Mustafa ... Manpurwala" teacher
 * with the canonical "Mustafa Tailor" profile and CLEAR all profile pictures,
 * per academy display policy. Safe to run multiple times.
 *
 * Usage:  node scripts/fix-mustafa-tailor-db.js   (uses DATABASE_URL from .env)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Rename every user whose name/email carries "Manpurwala"
  const legacyUsers = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Manpur', mode: 'insensitive' } },
        { lastName: { contains: 'Manpur', mode: 'insensitive' } },
        { email: { contains: 'manpurwala', mode: 'insensitive' } },
      ],
    },
  });

  for (const u of legacyUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        firstName: 'Mustafa',
        lastName: 'Tailor',
        avatarUrl: null,
        isActive: true,
      },
    });
    console.log(`- Renamed user ${u.id} ("${u.firstName} ${u.lastName}") -> Mustafa Tailor, avatar cleared`);

    const profile = await prisma.teacherProfile.findFirst({ where: { userId: u.id } });
    if (profile) {
      await prisma.teacherProfile.update({
        where: { id: profile.id },
        data: { its: '40444603', photoUrl: null },
      });
      const slots = await prisma.timetableSlot.updateMany({
        where: { teacherId: profile.id },
        data: { teacherName: 'Mustafa Tailor' },
      });
      console.log(`  profile updated | ${slots.count} timetable slots renamed`);
    }
  }

  // 2. Any slot text still carrying the legacy alias
  const slotFix = await prisma.timetableSlot.updateMany({
    where: { teacherName: { contains: 'Manpur', mode: 'insensitive' } },
    data: { teacherName: 'Mustafa Tailor' },
  });
  console.log(`- Slot names cleaned: ${slotFix.count}`);

  // 3. Canonical Mustafa Tailor must have no profile picture anywhere
  const profilePicClear = await prisma.teacherProfile.updateMany({
    where: { its: '40444603' },
    data: { photoUrl: null },
  });
  const tailorUsers = await prisma.user.updateMany({
    where: {
      OR: [
        { firstName: { contains: 'Mustafa' }, lastName: { contains: 'Tailor' } },
        { email: 'mustafa.tailor@mahadalzahra.com' },
      ],
    },
    data: { avatarUrl: null },
  });
  console.log(`- Mustafa Tailor profile pictures cleared: profiles=${profilePicClear.count}, users=${tailorUsers.count}`);

  console.log('\\nDone. Manpurwala is now Mustafa Tailor with no profile picture.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
