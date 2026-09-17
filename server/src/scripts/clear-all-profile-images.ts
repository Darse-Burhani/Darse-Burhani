/**
 * Script to clear all profile photos & avatars of all faculty and talabat.
 * Run with:
 *   npx tsx server/src/scripts/clear-all-profile-images.ts
 */
import "../env";
import prisma from "../lib/prisma";
import { cache } from "../lib/cache";

async function main() {
  console.log("🧹 Clearing all profile images for faculty and talabat...");

  // 1. Clear photoUrl on TeacherProfile
  const teacherProfileRes = await prisma.teacherProfile.updateMany({
    data: {
      photoUrl: null,
    },
  });
  console.log(`✅ Cleared photoUrl for ${teacherProfileRes.count} teacher profiles.`);

  // 2. Clear avatarUrl on Users (TEACHER, STUDENT, etc.)
  const usersRes = await prisma.user.updateMany({
    where: {
      role: { in: ["TEACHER", "STUDENT", "PARENT"] },
    },
    data: {
      avatarUrl: null,
    },
  });
  console.log(`✅ Cleared avatarUrl for ${usersRes.count} users (Faculty & Talabat).`);

  // 3. Invalidate caches
  try {
    cache.invalidateTag("dashboard");
    cache.invalidateTag("studentprofile");
    cache.invalidateTag("teacherprofile");
    cache.invalidateTag("user");
    cache.clear();
    console.log("✅ Invalidated cache tags.");
  } catch (err) {
    console.warn("Cache invalidation warning:", err);
  }

  console.log("\n✨ All profile images successfully cleared.");
}

main()
  .catch((err) => {
    console.error("❌ Failed to clear profile images:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
