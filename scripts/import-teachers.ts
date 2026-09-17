import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const prisma = new PrismaClient();

const COMPILED_JSON = path.join(repoRoot, "public", "teachers_compiled.json");
const PHOTO_DIR = path.join(repoRoot, "public", "uploads", "teachers");
const DEFAULT_PASSWORD = "515253";

interface RawTeacher {
  its: string;
  name: string;
  name_ar?: string;
  mobile?: string;
  official_email: string;
  personal_email?: string;
  age?: number | null;
  farig_year?: string;
  khidmat_duration?: string;
  category?: string;
  venue?: string;
  watan?: string;
  photo_file?: string;
  avatar_url?: string | null;
  source?: string;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { firstName: fullName.trim(), lastName: "" };
  }

  // If name begins with honorific title "Shaikh" or "Mulla", include the title with the first name
  // e.g. "Shaikh Shabbir" + "bhai Mohsinali bhai Shakir"
  const firstWord = words[0].toLowerCase();
  if ((firstWord === "shaikh" || firstWord === "mulla") && words.length >= 3) {
    return {
      firstName: words.slice(0, 2).join(" "),
      lastName: words.slice(2).join(" "),
    };
  }

  return {
    firstName: words[0],
    lastName: words.slice(1).join(" "),
  };
}

async function main() {
  console.log("=== Starting Galiakot KGS Teachers Import ===");
  if (!fs.existsSync(COMPILED_JSON)) {
    console.error("Compiled teachers JSON not found at:", COMPILED_JSON);
    process.exit(1);
  }

  const rawData: Record<string, RawTeacher> = JSON.parse(fs.readFileSync(COMPILED_JSON, "utf-8"));
  const teachers = Object.values(rawData);
  console.log(`Loaded ${teachers.length} teachers from ${COMPILED_JSON}`);

  fs.mkdirSync(PHOTO_DIR, { recursive: true });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const t of teachers) {
    try {
      const its = t.its.trim();
      const officialEmail = t.official_email.trim().toLowerCase();
      const personalEmail = t.personal_email?.trim() || null;
      const { firstName, lastName } = splitName(t.name);
      const department = t.category?.trim() || "Attalimiyah";
      const venue = t.venue?.trim() || null;
      const farigYear = t.farig_year?.trim() || null;
      const khidmatDuration = t.khidmat_duration?.trim() || null;
      const mobile = t.mobile?.trim() || null;
      const age = typeof t.age === "number" ? t.age : (t.age ? parseInt(String(t.age), 10) : null);
      const avatarUrl = t.avatar_url || null;

      // 1. Check if user already exists by email or employeeId/its
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: officialEmail },
        include: { teacherProfile: true },
      });

      const existingProfileByIts = await prisma.teacherProfile.findFirst({
        where: {
          OR: [
            { employeeId: its },
            { its: its },
          ],
        },
        include: { user: true },
      });

      const targetUserId = existingUserByEmail?.id || existingProfileByIts?.userId;

      if (targetUserId) {
        // Update existing user & teacher profile
        await prisma.user.update({
          where: { id: targetUserId },
          data: {
            email: officialEmail,
            firstName,
            lastName,
            role: "TEACHER",
            avatarUrl: avatarUrl || existingUserByEmail?.avatarUrl || existingProfileByIts?.user.avatarUrl,
            isActive: true,
            teacherProfile: {
              upsert: {
                create: {
                  employeeId: its,
                  its: its,
                  department,
                  subCategory: department,
                  roleTitle: "Khidmat Guzar",
                  khidmatMauze: venue,
                  farigYear,
                  khidmatYear: khidmatDuration,
                  mobile,
                  tEmail: personalEmail,
                  age,
                  photoUrl: avatarUrl || null,
                  subjects: [],
                  portfolioEnabled: false,
                },
                update: {
                  employeeId: its,
                  its: its,
                  department,
                  subCategory: department,
                  roleTitle: "Khidmat Guzar",
                  khidmatMauze: venue,
                  farigYear,
                  khidmatYear: khidmatDuration,
                  mobile,
                  tEmail: personalEmail,
                  age,
                  photoUrl: avatarUrl || undefined,
                },
              },
            },
          },
        });
        updated++;
        console.log(`[UPDATED] ITS: ${its} | ${t.name} (${officialEmail})`);
      } else {
        // Create brand new User + TeacherProfile
        await prisma.user.create({
          data: {
            email: officialEmail,
            passwordHash,
            firstName,
            lastName,
            role: "TEACHER",
            avatarUrl,
            isActive: true,
            teacherProfile: {
              create: {
                employeeId: its,
                its: its,
                department,
                subCategory: department,
                roleTitle: "Khidmat Guzar",
                khidmatMauze: venue,
                farigYear,
                khidmatYear: khidmatDuration,
                mobile,
                tEmail: personalEmail,
                age,
                photoUrl: avatarUrl,
                subjects: [],
                portfolioEnabled: false,
              },
            },
          },
        });
        created++;
        console.log(`[CREATED] ITS: ${its} | ${t.name} (${officialEmail})`);
      }
    } catch (err) {
      console.error(`[ERROR] Failed importing ITS: ${t.its} (${t.name}):`, err);
      errors++;
    }
  }

  console.log("\n==========================================");
  console.log(`Import Complete!`);
  console.log(`Total: ${teachers.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Default Password: ${DEFAULT_PASSWORD}`);
  console.log("==========================================");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error during teacher import:", e);
  await prisma.$disconnect();
  process.exit(1);
});
