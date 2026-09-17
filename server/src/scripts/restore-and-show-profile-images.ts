import "../env";
import prisma from "../lib/prisma";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cache } from "../lib/cache";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

async function main() {
  console.log("🔍 Inspecting Users, Teachers, and Talabat in database...");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      avatarUrl: true,
      studentProfile: {
        select: {
          id: true,
          studentId: true,
        },
      },
      teacherProfile: {
        select: {
          id: true,
          its: true,
          employeeId: true,
          photoUrl: true,
        },
      },
      parentProfile: {
        select: {
          id: true,
        },
      },
    },
  });

  console.log(`Found ${users.length} total users in DB.`);

  // Check upload directories
  const talabatDir = [
    path.join(repoRoot, "public", "uploads", "Talabat"),
    path.join(repoRoot, "public", "uploads", "talabat"),
  ].find((d) => fs.existsSync(d)) || path.join(repoRoot, "public", "uploads", "Talabat");

  const teachersDir = [
    path.join(repoRoot, "public", "uploads", "teachers"),
    path.join(repoRoot, "public", "uploads", "Teachers"),
  ].find((d) => fs.existsSync(d)) || path.join(repoRoot, "public", "uploads", "teachers");

  const talabatFiles = fs.existsSync(talabatDir) ? fs.readdirSync(talabatDir) : [];
  const teacherFiles = fs.existsSync(teachersDir) ? fs.readdirSync(teachersDir) : [];

  const talabatFolderName = path.basename(talabatDir);
  const teacherFolderName = path.basename(teachersDir);

  console.log(`Available Talabat photos in disk (${talabatFolderName}): ${talabatFiles.length}`);
  console.log(`Available Teacher photos in disk (${teacherFolderName}): ${teacherFiles.length}`);

  let updatedTeachers = 0;
  let updatedStudents = 0;
  let updatedParents = 0;
  let updatedAdmins = 0;

  for (const user of users) {
    let resolvedAvatar: string | null = null;

    if (user.role === "TEACHER" && user.teacherProfile) {
      const its = user.teacherProfile.its || user.teacherProfile.employeeId;
      if (its) {
        const match = teacherFiles.find((f) => f.startsWith(its));
        if (match) {
          resolvedAvatar = `/uploads/${teacherFolderName}/${match}`;
        }
      }

      await prisma.teacherProfile.update({
        where: { id: user.teacherProfile.id },
        data: { photoUrl: resolvedAvatar },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: resolvedAvatar },
      });
      if (resolvedAvatar) updatedTeachers++;
    } else if (user.role === "STUDENT" && user.studentProfile) {
      const studentId = user.studentProfile.studentId;
      if (studentId) {
        const match = talabatFiles.find((f) => f.startsWith(studentId));
        if (match) {
          resolvedAvatar = `/uploads/${talabatFolderName}/${match}`;
        }
      }
      if (!resolvedAvatar) {
        const numMatch = user.email.match(/\d+/);
        if (numMatch) {
          const match = talabatFiles.find((f) => f.startsWith(numMatch[0]));
          if (match) resolvedAvatar = `/uploads/${talabatFolderName}/${match}`;
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: resolvedAvatar },
      });
      if (resolvedAvatar) updatedStudents++;
    } else if (user.role === "PARENT") {
      // Keep blank (null) unless actual file uploaded
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: null },
      });
    } else if (user.role === "ADMIN") {
      // Keep blank (null) unless actual file uploaded
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: null },
      });
    }
  }

  console.log(`\n🎉 Profile Images Sync Completed (Only Real Files Linked, No AI Images):`);
  console.log(`- Teachers with real photo: ${updatedTeachers}`);
  console.log(`- Students (Talabat) updated: ${updatedStudents}`);
  console.log(`- Parents updated: ${updatedParents}`);
  console.log(`- Admins updated: ${updatedAdmins}`);

  try {
    cache.invalidateTag("dashboard");
    cache.invalidateTag("studentprofile");
    cache.invalidateTag("teacherprofile");
    cache.invalidateTag("user");
    cache.clear();
    console.log("✅ Caches invalidated.");
  } catch (err) {
    console.warn("Cache note:", err);
  }
}

main()
  .catch((err) => {
    console.error("❌ Error setting profile images:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
