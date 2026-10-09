import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password@123";

async function main() {
  console.log("🚀 Initializing Demo Credentials for Reviewers...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ── 1. ADMIN DEMO ACCOUNT ──
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.demo@darseburhani.edu" },
    update: {
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "ADMIN",
      isActive: true,
      firstName: "Mulla Demo",
      lastName: "Administrator",
      avatarUrl: "/logo.png",
    },
    create: {
      email: "admin.demo@darseburhani.edu",
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "ADMIN",
      isActive: true,
      firstName: "Mulla Demo",
      lastName: "Administrator",
      avatarUrl: "/logo.png",
    },
  });
  console.log(`✅ Admin Demo Ready: ${adminUser.email}`);

  // Also ensure standard admin has known password
  await prisma.user.updateMany({
    where: { email: "admin@darseburhani.edu" },
    data: {
      passwordHash,
      plainPassword: DEMO_PASSWORD,
    },
  });

  // ── 2. FACULTY (TEACHER) DEMO ACCOUNT ──
  const facultyUser = await prisma.user.upsert({
    where: { email: "faculty.demo@darseburhani.edu" },
    update: {
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "TEACHER",
      isActive: true,
      firstName: "Shaikh Demo",
      lastName: "Ustaaz",
      avatarUrl: "/logo.png",
    },
    create: {
      email: "faculty.demo@darseburhani.edu",
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "TEACHER",
      isActive: true,
      firstName: "Shaikh Demo",
      lastName: "Ustaaz",
      avatarUrl: "/logo.png",
    },
  });

  const facultyProfile = await prisma.teacherProfile.upsert({
    where: { userId: facultyUser.id },
    update: {
      employeeId: "50400001",
      its: "50400001",
      roleTitle: "Senior Muhafiz & Faculty",
      department: "Tahfeez al-Quran & Darse Saadat",
      subjects: ["Quran Hifz", "Adab", "Lisan al-Dawat"],
      tEmail: "faculty.demo@darseburhani.edu",
      portfolioEnabled: true,
      photoUrl: "/logo.png",
    },
    create: {
      userId: facultyUser.id,
      employeeId: "50400001",
      its: "50400001",
      roleTitle: "Senior Muhafiz & Faculty",
      department: "Tahfeez al-Quran & Darse Saadat",
      subjects: ["Quran Hifz", "Adab", "Lisan al-Dawat"],
      tEmail: "faculty.demo@darseburhani.edu",
      portfolioEnabled: true,
      photoUrl: "/logo.png",
    },
  });
  console.log(`✅ Faculty Demo Ready: ${facultyUser.email} (ITS: 50400001)`);

  // Ensure demo class exists for this faculty
  let demoClass = await prisma.class.findFirst({
    where: { teacherId: facultyProfile.id },
  });
  if (!demoClass) {
    demoClass = await prisma.class.create({
      data: {
        name: "Darajah 4 — Al-Qism al-Awwal",
        grade: "Darajah 4",
        section: "A",
        subject: "Quran Hifz & Dars",
        teacherId: facultyProfile.id,
        masoolId: facultyProfile.id,
        academicYear: "1446-1447H",
        isActive: true,
      },
    });
  }

  // ── 3. TALABAT (STUDENT) DEMO ACCOUNT ──
  const studentUser = await prisma.user.upsert({
    where: { email: "student.demo@darseburhani.edu" },
    update: {
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "STUDENT",
      isActive: true,
      firstName: "Burhanuddin",
      lastName: "Pehelwan (Demo Student)",
      avatarUrl: "/logo.png",
    },
    create: {
      email: "student.demo@darseburhani.edu",
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "STUDENT",
      isActive: true,
      firstName: "Burhanuddin",
      lastName: "Pehelwan (Demo Student)",
      avatarUrl: "/logo.png",
    },
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {
      studentId: "50400002",
      its: "50400002",
      grade: "Darajah 4",
      section: "A",
      fatherName: "Murtaza bhai Pehelwan",
      motherName: "Fatema bai",
      fatherEmail: "parent.demo@darseburhani.edu",
      fatherPhone: "+91 9876543210",
      watan: "Surat",
      residentCity: "Surat",
      currentPoints: 485,
      totalPoints: 1250,
      streakDays: 14,
      tier: "GOLD",
      walletBalance: 250,
      dobHijri: "15 Rajab 1435H",
      admissionYear: "1444H",
      currentYear: "1446-1447H",
    },
    create: {
      userId: studentUser.id,
      studentId: "50400002",
      its: "50400002",
      grade: "Darajah 4",
      section: "A",
      fatherName: "Murtaza bhai Pehelwan",
      motherName: "Fatema bai",
      fatherEmail: "parent.demo@darseburhani.edu",
      fatherPhone: "+91 9876543210",
      watan: "Surat",
      residentCity: "Surat",
      currentPoints: 485,
      totalPoints: 1250,
      streakDays: 14,
      tier: "GOLD",
      walletBalance: 250,
      dobHijri: "15 Rajab 1435H",
      admissionYear: "1444H",
      currentYear: "1446-1447H",
    },
  });

  // Enroll demo student in demo class
  const existingEnrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId: studentProfile.id,
      classId: demoClass.id,
    },
  });
  if (!existingEnrollment) {
    await prisma.classEnrollment.create({
      data: {
        studentId: studentProfile.id,
        classId: demoClass.id,
      },
    });
  }
  console.log(`✅ Talabat Demo Ready: ${studentUser.email} (ITS: 50400002)`);

  // ── 4. PARENT DEMO ACCOUNT ──
  const parentUser = await prisma.user.upsert({
    where: { email: "parent.demo@darseburhani.edu" },
    update: {
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "PARENT",
      isActive: true,
      firstName: "Murtaza",
      lastName: "Pehelwan (Demo Parent)",
      avatarUrl: "/logo.png",
    },
    create: {
      email: "parent.demo@darseburhani.edu",
      passwordHash,
      plainPassword: DEMO_PASSWORD,
      role: "PARENT",
      isActive: true,
      firstName: "Murtaza",
      lastName: "Pehelwan (Demo Parent)",
      avatarUrl: "/logo.png",
    },
  });

  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {
      phone: "+91 9876543210",
      city: "Surat",
      watan: "Surat",
      its: "50400003",
      relationType: "Father",
      occupation: "Business",
    },
    create: {
      userId: parentUser.id,
      phone: "+91 9876543210",
      city: "Surat",
      watan: "Surat",
      its: "50400003",
      relationType: "Father",
      occupation: "Business",
    },
  });

  // Link Parent to Student
  await prisma.parentStudentLink.upsert({
    where: {
      parentId_studentId: {
        parentId: parentProfile.id,
        studentId: studentProfile.id,
      },
    },
    update: {
      relationship: "Father",
    },
    create: {
      parentId: parentProfile.id,
      studentId: studentProfile.id,
      relationship: "Father",
    },
  });
  console.log(`✅ Parent Demo Ready: ${parentUser.email} (ITS: 50400003)`);

  console.log("\n=======================================================");
  console.log("🎉 ALL DEMO CREDENTIALS CREATED & CONFIGURED SUCCESSFULLY!");
  console.log("=======================================================");
  console.log("Password for all demo accounts: " + DEMO_PASSWORD);
  console.log("-------------------------------------------------------");
  console.log("1. TALABAT (STUDENT) PORTAL (/talabat):");
  console.log("   • Login ID:  50400002  OR  student.demo@darseburhani.edu");
  console.log("   • Password:  " + DEMO_PASSWORD);
  console.log("-------------------------------------------------------");
  console.log("2. PARENT PORTAL (/parent):");
  console.log("   • Login ID:  50400003  OR  parent.demo@darseburhani.edu");
  console.log("   • Password:  " + DEMO_PASSWORD);
  console.log("-------------------------------------------------------");
  console.log("3. FACULTY (TEACHER) PORTAL (/teacher):");
  console.log("   • Login ID:  50400001  OR  faculty.demo@darseburhani.edu");
  console.log("   • Password:  " + DEMO_PASSWORD);
  console.log("-------------------------------------------------------");
  console.log("4. ADMIN PORTAL (/admin):");
  console.log("   • Login ID:  admin.demo@darseburhani.edu  OR  admin@darseburhani.edu");
  console.log("   • Password:  " + DEMO_PASSWORD);
  console.log("=======================================================\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error setting up demo accounts:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
