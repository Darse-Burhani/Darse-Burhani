import prisma from "../server/src/lib/prisma";

async function main() {
  const existing = await prisma.talabatProfile1447.findMany({
    where: {
      OR: [
        { fatherPhotoUrl: { not: null } },
        { motherPhotoUrl: { not: null } },
      ],
    },
    select: {
      id: true,
      studentId: true,
      name: true,
      fatherPhotoUrl: true,
      motherPhotoUrl: true,
    },
  });

  console.log(`Found ${existing.length} yearly profiles with parent images:`);
  for (const p of existing) {
    console.log(`- Profile ${p.id} (${p.name || p.studentId}): father=${Boolean(p.fatherPhotoUrl)}, mother=${Boolean(p.motherPhotoUrl)}`);
  }

  const result = await prisma.talabatProfile1447.updateMany({
    data: {
      fatherPhotoUrl: null,
      motherPhotoUrl: null,
    },
  });

  console.log(`Successfully reset parent images in talabatProfile1447. Rows affected: ${result.count}`);

  // Also clear parent avatars that might have been synced to parent user accounts
  const parentUsers = await prisma.user.findMany({
    where: {
      role: "PARENT",
      avatarUrl: { not: null },
    },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });

  console.log(`Found ${parentUsers.length} parent users with avatars.`);
  if (parentUsers.length > 0) {
    const parentReset = await prisma.user.updateMany({
      where: { role: "PARENT" },
      data: { avatarUrl: null },
    });
    console.log(`Reset ${parentReset.count} parent user avatars.`);
  }
}

main()
  .catch((err) => {
    console.error("Error clearing parent photos:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
