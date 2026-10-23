const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: new Date('2026-10-21T00:00:00Z')
      }
    },
    include: { teacherProfile: true }
  });
  console.log(`Users created recently (${users.length}):`);
  for (const u of users) {
    console.log(`- ID: ${u.id} | Email: ${u.email} | Name: ${u.firstName} ${u.lastName} | Role: ${u.role} | Profile: ${u.teacherProfile?.id} (ITS: ${u.teacherProfile?.its})`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
