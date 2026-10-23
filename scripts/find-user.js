const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      teacherProfile: {
        select: {
          id: true,
          its: true
        }
      }
    }
  });

  console.log(`Total users in DB: ${allUsers.length}`);
  
  const matches = allUsers.filter(u => {
    const s = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
    return s.includes('burhan') || s.includes('kundli') || s.includes('tailor');
  });

  console.log('\nMatching users for burhan/kundli/tailor:');
  console.log(JSON.stringify(matches, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
