import "../server/src/env.ts";
import { PrismaClient } from "@prisma/client";

async function syncDb(name: string, url: string) {
  console.log(`\n========================================`);
  console.log(`Syncing plain passwords on: ${name}`);
  console.log(`========================================`);

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    // 1. Students
    const studentRes = await prisma.user.updateMany({
      where: {
        role: "STUDENT",
        plainPassword: null,
      },
      data: {
        plainPassword: "student123",
      },
    });
    console.log(`✓ Updated ${studentRes.count} student accounts with plainPassword: "student123"`);

    // 2. Teachers
    const teacherRes = await prisma.user.updateMany({
      where: {
        role: "TEACHER",
        plainPassword: null,
      },
      data: {
        plainPassword: "515253",
      },
    });
    console.log(`✓ Updated ${teacherRes.count} teacher accounts with plainPassword: "515253"`);

    // 3. Parents
    const parentRes = await prisma.user.updateMany({
      where: {
        role: "PARENT",
        plainPassword: null,
      },
      data: {
        plainPassword: "parent5253",
      },
    });
    console.log(`✓ Updated ${parentRes.count} parent accounts with plainPassword: "parent5253"`);

    // 4. Admin
    const adminRes = await prisma.user.updateMany({
      where: {
        role: "ADMIN",
        plainPassword: null,
      },
      data: {
        plainPassword: "Password@123",
      },
    });
    console.log(`✓ Updated ${adminRes.count} admin accounts with plainPassword: "Password@123"`);
  } catch (err: any) {
    console.error(`Error syncing on ${name}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const cloudUrl = process.env.DATABASE_URL;
  const localUrl = process.env.LOCAL_DATABASE_URL || "postgresql://darseburhani:darseburhani@localhost:5432/darseburhani?schema=public";

  if (cloudUrl) {
    await syncDb("Render Cloud Database", cloudUrl);
  }
  if (localUrl) {
    await syncDb("Local Database", localUrl);
  }
  console.log("\nAll user accounts successfully populated with their institutional passwords!");
}

main();

