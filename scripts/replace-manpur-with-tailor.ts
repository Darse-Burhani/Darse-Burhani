import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Replacing Mustafa Manpurwala with Mustafa Tailor ===");

  // 1. Locate existing Manpurwala and Tailor profiles
  const manpurUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: "manpurwala", mode: "insensitive" } },
        { lastName: { contains: "Manpur", mode: "insensitive" } },
      ],
    },
    include: { teacherProfile: true },
  });

  const manpurProfile = manpurUser?.teacherProfile || await prisma.teacherProfile.findFirst({
    where: { its: "40444603" },
    include: { user: true },
  });

  let tailorProfile = await prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { employeeId: "EMP-MUSTAFA-TAILOR" },
        { user: { email: "mustafa.tailor@darseburhani.com" } },
        { user: { email: "mustafa.tailor@mahadalzahra.com" } },
        { user: { lastName: "Tailor" } },
      ],
    },
    include: { user: true },
  });

  console.log("Manpurwala Profile ID:", manpurProfile?.id);
  console.log("Tailor Profile ID:", tailorProfile?.id);

  const passwordHash = await bcrypt.hash("faculty5253", 10);

  // If Tailor user doesn't exist, create him
  if (!tailorProfile) {
    let tailorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: "mustafa.tailor@mahadalzahra.com" },
          { email: "mustafa.tailor@darseburhani.com" },
        ],
      },
    });

    if (!tailorUser) {
      tailorUser = await prisma.user.create({
        data: {
          email: "mustafa.tailor@mahadalzahra.com",
          passwordHash,
          plainPassword: "faculty5253",
          firstName: "Mustafa",
          lastName: "Tailor",
          role: "TEACHER",
          isActive: true,
        },
      });
      console.log("Created new Tailor user:", tailorUser.id);
    }

    tailorProfile = await prisma.teacherProfile.create({
      data: {
        userId: tailorUser.id,
        employeeId: "EMP-MUSTAFA-TAILOR",
        department: "Attalimiyah",
        its: "40444603",
      },
      include: { user: true },
    });
    console.log("Created new Tailor profile:", tailorProfile.id);
  }

  // 2. Reassign all records from Manpurwala to Tailor
  if (manpurProfile && manpurProfile.id !== tailorProfile.id) {
    const pId = manpurProfile.id;
    const tId = tailorProfile.id;

    // Attendance records: handle existing dates to avoid unique constraint failure
    const manpurRecords = await prisma.teacherAttendanceRecord.findMany({
      where: { teacherId: pId },
    });
    let attReassigned = 0;
    for (const rec of manpurRecords) {
      const existing = await prisma.teacherAttendanceRecord.findUnique({
        where: { teacherId_date: { teacherId: tId, date: rec.date } },
      });
      if (existing) {
        // Already exists on Tailor, delete duplicate from Manpur
        await prisma.teacherAttendanceRecord.delete({ where: { id: rec.id } });
      } else {
        await prisma.teacherAttendanceRecord.update({
          where: { id: rec.id },
          data: { teacherId: tId },
        });
        attReassigned++;
      }
    }
    console.log(`Reassigned/merged ${manpurRecords.length} attendance records (${attReassigned} moved to Mustafa Tailor).`);

    // Timetable slots
    const slotsUpdated = await prisma.timetableSlot.updateMany({
      where: { teacherId: pId },
      data: { teacherId: tId },
    });
    console.log(`Reassigned ${slotsUpdated.count} timetable slots to Mustafa Tailor.`);

    // Classes as teacher
    const classTeacherUpdated = await prisma.class.updateMany({
      where: { teacherId: pId },
      data: { teacherId: tId },
    });
    console.log(`Reassigned ${classTeacherUpdated.count} classes (teacher) to Mustafa Tailor.`);

    // Classes as masool
    const classMasoolUpdated = await prisma.class.updateMany({
      where: { masoolId: pId },
      data: { masoolId: tId },
    });
    console.log(`Reassigned ${classMasoolUpdated.count} classes (masool) to Mustafa Tailor.`);

    // First free up ITS on Manpurwala
    await prisma.teacherProfile.update({
      where: { id: pId },
      data: { its: null, employeeId: `MANPUR-DELETED-${Date.now()}` },
    });

    // Delete Manpurwala teacher profile
    await prisma.teacherProfile.delete({
      where: { id: pId },
    });
    console.log("Deleted Manpurwala teacher profile.");

    // Delete Manpurwala user if exists
    if (manpurProfile.userId) {
      await prisma.user.delete({
        where: { id: manpurProfile.userId },
      }).catch(err => console.warn("Could not delete Manpur user:", err.message));
      console.log("Deleted Manpurwala user account.");
    }
  }

  // 3. Ensure Mustafa Tailor has its: 40444603 and accurate user info
  await prisma.teacherProfile.update({
    where: { id: tailorProfile.id },
    data: {
      its: "40444603",
      department: "Attalimiyah",
    },
  });

  if (tailorProfile.userId) {
    await prisma.user.update({
      where: { id: tailorProfile.userId },
      data: {
        firstName: "Mustafa",
        lastName: "Tailor",
        email: "mustafa.tailor@mahadalzahra.com",
        isActive: true,
      },
    });
  }

  console.log("=== Successfully updated Mustafa Tailor (ITS: 40444603) ===");
  await prisma.$disconnect();
}

main().catch(console.error);
