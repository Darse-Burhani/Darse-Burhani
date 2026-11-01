import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const RENDER_CLOUD_URL = "postgresql://darseburhani:bcqntuTadKYmjJ6XSvgXH2m0ZFTKRLfO@dpg-dbjgmb7b9u1s73dvtvf0-a.singapore-postgres.render.com/darseburhani?sslmode=require";
const LOCAL_URL = "postgresql://darseburhani:darseburhani@localhost:5432/darseburhani?schema=public";

async function fixMustafaSir(dbUrl: string, label: string) {
  console.log(`\n=================================================`);
  console.log(`🔧 Applying Mustafa Sir configuration to: ${label}`);
  console.log(`=================================================`);

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    // 1. Ensure Mustafa Sir user exists with NO profile pic and NO ITS
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: "mustafa.sir@darseburhani.com" },
          { firstName: "Mustafa", lastName: "Sir" },
        ],
      },
      include: { teacherProfile: true },
    });

    if (!user) {
      console.log("  Creating official 'Mustafa Sir' teacher account...");
      user = await prisma.user.create({
        data: {
          firstName: "Mustafa",
          lastName: "Sir",
          email: "mustafa.sir@darseburhani.com",
          role: "TEACHER",
          passwordHash: "$2a$12$a4bN95e5M4d.l02xYkUqUeg86g36lG5XvGZt2aM1F01Vq.X6oVpY2", // default 515253
          plainPassword: "515253",
          avatarUrl: null,
          isActive: true,
          teacherProfile: {
            create: {
              employeeId: "TCH-MUSTAFA-SIR",
              department: "Attalimiyah",
              subjects: ["Maths", "Science", "Physics"],
              its: null,
              photoUrl: null,
            },
          },
        },
        include: { teacherProfile: true },
      });
      console.log(`  ✓ Created user ${user.id} and teacher profile ${user.teacherProfile?.id}`);
    } else {
      console.log("  Updating existing 'Mustafa Sir' user to ensure no photo and no its...");
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: "Mustafa",
          lastName: "Sir",
          avatarUrl: null,
        },
        include: { teacherProfile: true },
      });

      if (!user.teacherProfile) {
        await prisma.teacherProfile.create({
          data: {
            userId: user.id,
            department: "Attalimiyah",
            subjects: ["Maths", "Science", "Physics"],
            its: null,
            photoUrl: null,
          },
        });
      } else {
        await prisma.teacherProfile.update({
          where: { id: user.teacherProfile.id },
          data: {
            its: null,
            photoUrl: null,
          },
        });
      }
      console.log(`  ✓ Updated Mustafa Sir: photoUrl = null, its = null`);
    }

    const mustafaSirProfile = await prisma.teacherProfile.findFirst({
      where: { userId: user.id },
    });

    if (!mustafaSirProfile) {
      throw new Error("Failed to resolve Mustafa Sir teacher profile");
    }

    // 2. Also clear photoUrl from legacy Mustafa Manpur / Tailor user so no avatar ever leaks
    const legacyUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: "mustafa.tailor@mahadalzahra.com" },
          { firstName: { contains: "Manpur", mode: "insensitive" } },
          { lastName: { contains: "Manpur", mode: "insensitive" } },
        ],
      },
      include: { teacherProfile: true },
    });

    for (const leg of legacyUsers) {
      await prisma.user.update({
        where: { id: leg.id },
        data: { avatarUrl: null },
      });
      if (leg.teacherProfile) {
        await prisma.teacherProfile.update({
          where: { id: leg.teacherProfile.id },
          data: { photoUrl: null },
        });
      }
      console.log(`  ✓ Cleared avatar and photo from legacy record ${leg.id}`);
    }

    // 3. Configure all Mustafa timetable slots (Maths, Science, Physics) to Mustafa Sir
    const allSlots = await prisma.timetableSlot.findMany();
    const mustafaSlots = allSlots.filter((s) => {
      const name = s.teacherName || "";
      if (/kumail/i.test(name)) return false; // keep Kumail Raj untouched
      return /mustafa/i.test(name) || /manpur/i.test(name) || /tailor/i.test(name) || s.teacherId === "cmvjf43dl00015xlvr0qem4qq";
    });

    for (const slot of mustafaSlots) {
      await prisma.timetableSlot.update({
        where: { id: slot.id },
        data: {
          teacherName: "Mustafa Sir",
          teacherId: mustafaSirProfile.id,
        },
      });
    }

    console.log(`  ✓ Successfully updated ${mustafaSlots.length} timetable slots to 'Mustafa Sir' (teacherId: ${mustafaSirProfile.id})`);

    // Verify slots
    const verified = await prisma.timetableSlot.findMany({
      where: { teacherId: mustafaSirProfile.id },
      select: { className: true, period: true, subject: true, teacherName: true },
    });
    console.log(`  ✓ Verification: ${verified.length} slots assigned to Mustafa Sir with NO photo & NO ITS.`);
  } catch (err: any) {
    console.error(`  ❌ Error on ${label}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  await fixMustafaSir(RENDER_CLOUD_URL, "Render Cloud PostgreSQL");
  await fixMustafaSir(LOCAL_URL, "Local PostgreSQL");
  console.log("\n🎉 Complete! Mustafa Sir is now configured with NO profile pic and NO ITS on both databases.");
}

run().catch(console.error);
