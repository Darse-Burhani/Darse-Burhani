const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Connecting to DB:", process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : "undefined");
    const count = await prisma.user.count();
    console.log("User count in DB:", count);
    const firstUser = await prisma.user.findFirst({ select: { id: true, email: true, role: true } });
    console.log("First user:", firstUser);
  } catch (err) {
    console.error("Database connection error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
