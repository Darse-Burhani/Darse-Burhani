import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await hash("password123", 12);

  // Create a single admin user for initial access
  const admin = await prisma.user.upsert({
    where: { email: "admin@darseburhani.edu" },
    update: {},
    create: {
      email: "admin@darseburhani.edu",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`  Admin: ${admin.email}`);

  // Default biometric scan event — ONE event carrying BOTH the Talabat
  // timer and the faculty timer. Admin can edit both in
  // Admin → Attendance Schedule.
  const window = await prisma.biometricScanWindow.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Tilawat al Dua",
      startTime: "07:00",
      endTime: "12:30",
      graceMinutes: 10,
      enabled: true,
      facultyStartTime: "07:30",
      facultyEndTime: "08:45",
      facultyLateEndTime: "08:45",
      facultyEnabled: true,
    },
  });
  console.log(`  Scan window: ${window.name} ${window.startTime}–${window.endTime} (${window.graceMinutes} min grace)`);

  console.log("\nSeeding complete!");
  console.log("\nLogin Credentials:");
  console.log("  Email: admin@darseburhani.edu");
  console.log("  Password: password123");
  console.log("\nCreate teachers, students, and parents via the Admin dashboard.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
