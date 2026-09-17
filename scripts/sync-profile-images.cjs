const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();
const prisma = new PrismaClient();

const repoRoot = path.resolve(__dirname, "..");
const talabatDir = [
  path.join(repoRoot, "public", "uploads", "Talabat"),
  path.join(repoRoot, "public", "uploads", "talabat"),
].find((d) => fs.existsSync(d)) || path.join(repoRoot, "public", "uploads", "Talabat");

const teachersDir = [
  path.join(repoRoot, "public", "uploads", "teachers"),
  path.join(repoRoot, "public", "uploads", "Teachers"),
].find((d) => fs.existsSync(d)) || path.join(repoRoot, "public", "uploads", "teachers");

async function main() {
  console.log("📸 Starting profile images restoration...");

  const talabatFiles = fs.existsSync(talabatDir) ? fs.readdirSync(talabatDir) : [];
  const teacherFiles = fs.existsSync(teachersDir) ? fs.readdirSync(teachersDir) : [];
  const talabatFolderName = path.basename(talabatDir);
  const teacherFolderName = path.basename(teachersDir);

  console.log(`Found ${talabatFiles.length} files in ${talabatFolderName}`);
  console.log(`Found ${teacherFiles.length} files in ${teacherFolderName}`);

  const users = await prisma.user.findMany({
    include: {
      studentProfile: true,
      teacherProfile: true,
      parentProfile: true,
    },
  });

  console.log(`Total users in DB: ${users.length}`);

  let updatedTeachers = 0;
  let updatedStudents = 0;

  for (const user of users) {
    if (user.role === "TEACHER" && user.teacherProfile) {
      const its = user.teacherProfile.its || user.teacherProfile.employeeId;
      let photoUrl = null;

      if (its && its !== "-" && !its.startsWith("BIOMETRIC-")) {
        const match = teacherFiles.find((f) => {
          const parsed = path.parse(f).name.toLowerCase();
          return parsed === its.toLowerCase() || parsed.startsWith(its.toLowerCase());
        });
        if (match) {
          photoUrl = `/uploads/${teacherFolderName}/${match}`;
        }
      }

      await prisma.teacherProfile.update({
        where: { id: user.teacherProfile.id },
        data: { photoUrl },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: photoUrl },
      });

      if (photoUrl) updatedTeachers++;
    } else if (user.role === "STUDENT" && user.studentProfile) {
      const its = user.studentProfile.its || user.studentProfile.studentId;
      let photoUrl = null;

      if (its) {
        const match = talabatFiles.find((f) => {
          const parsed = path.parse(f).name.toLowerCase();
          return parsed === its.toLowerCase() || parsed.startsWith(its.toLowerCase());
        });
        if (match) {
          photoUrl = `/uploads/${talabatFolderName}/${match}`;
        }
      }

      if (!photoUrl) {
        const numMatch = user.email.match(/\d+/);
        if (numMatch) {
          const match = talabatFiles.find((f) => {
            const parsed = path.parse(f).name.toLowerCase();
            return parsed === numMatch[0].toLowerCase() || parsed.startsWith(numMatch[0].toLowerCase());
          });
          if (match) photoUrl = `/uploads/${talabatFolderName}/${match}`;
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: photoUrl },
      });

      if (photoUrl) updatedStudents++;
    }
  }

  console.log(`\n✅ Profile sync completed:`);
  console.log(`- Teachers with restored photos: ${updatedTeachers}`);
  console.log(`- Students (Talabat) with restored photos: ${updatedStudents}`);
}

main()
  .catch((err) => {
    console.error("❌ Error syncing profile images:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
