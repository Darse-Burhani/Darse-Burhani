import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const NEW_PASSWORD = "515253";

async function main() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", email: { endsWith: "@darseburhani.edu" } },
    select: { id: true, email: true, firstName: true },
  });

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);

  let updated = 0;
  for (const s of students) {
    await prisma.user.update({ where: { id: s.id }, data: { passwordHash } });
    updated++;
    console.log(`  Reset: ${s.firstName} (${s.email})`);
  }

  console.log("\n=== Password Reset Complete ===");
  console.log(`Talabat accounts reset: ${updated}`);
  console.log(`New default password: ${NEW_PASSWORD}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Reset error:", e);
  await prisma.$disconnect();
  process.exit(1);
});