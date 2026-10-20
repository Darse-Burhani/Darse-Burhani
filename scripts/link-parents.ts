import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PARENT_PASSWORD = "parent5253";

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getEmailName(email: string): string {
  if (!email) return "";
  return email.split("@")[0].trim();
}

async function getOrCreateParentUser(
  emailRaw: string,
  relationType: string,
  watan?: string | null,
  city?: string | null
): Promise<{ userId: string; parentProfileId: string }> {
  const email = emailRaw.toLowerCase().trim();
  const emailName = getEmailName(email);
  const passwordHash = await bcrypt.hash(PARENT_PASSWORD, 10);

  // Check if User already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { parentProfile: true },
  });

  if (existingUser) {
    let parentProfileId = existingUser.parentProfile?.id;
    if (!parentProfileId) {
      const newProfile = await prisma.parentProfile.create({
        data: {
          userId: existingUser.id,
          relationType,
          watan: watan || null,
          city: city || null,
        },
      });
      parentProfileId = newProfile.id;
    }
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        firstName: emailName,
        lastName: "",
        role: "PARENT",
        plainPassword: PARENT_PASSWORD,
        isActive: true,
      },
    });
    return { userId: existingUser.id, parentProfileId };
  }

  // Create new User and ParentProfile
  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      plainPassword: PARENT_PASSWORD,
      firstName: emailName,
      lastName: "",
      role: "PARENT",
      isActive: true,
      parentProfile: {
        create: {
          relationType,
          watan: watan || null,
          city: city || null,
        },
      },
    },
    include: { parentProfile: true },
  });

  return { userId: newUser.id, parentProfileId: newUser.parentProfile!.id };
}

async function main() {
  console.log("=========================================================");
  console.log("  LINKING TALABAT TO PARENTS (EMAIL NAME ONLY)           ");
  console.log("  Password standard: parent5253                          ");
  console.log("=========================================================\n");

  const students = await prisma.studentProfile.findMany({
    include: { user: true },
    orderBy: { its: "asc" },
  });

  console.log(`Found ${students.length} Talabat students to process.\n`);

  let fatherUsersCreated = 0;
  let motherUsersCreated = 0;
  let sharedUsersCreated = 0;
  let linksCreated = 0;
  let studentsUpdated = 0;

  for (const student of students) {
    const fEmail = student.fatherEmail?.toLowerCase().trim() || null;
    const mEmail = student.motherEmail?.toLowerCase().trim() || null;

    const fatherEmailName = fEmail ? getEmailName(fEmail) : "";
    const motherEmailName = mEmail ? getEmailName(mEmail) : "";

    // 1. Update StudentProfile with email name only
    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        fatherName: fatherEmailName || student.fatherName,
        motherName: motherEmailName || student.motherName,
      },
    });
    studentsUpdated++;

    // 2. Link Parents
    if (fEmail && mEmail && fEmail === mEmail) {
      // Shared Parent Account
      const { parentProfileId } = await getOrCreateParentUser(
        fEmail,
        "FATHER & MOTHER",
        student.watan,
        student.residentCity
      );

      await prisma.parentStudentLink.upsert({
        where: {
          parentId_studentId: {
            parentId: parentProfileId,
            studentId: student.id,
          },
        },
        create: {
          parentId: parentProfileId,
          studentId: student.id,
          relationship: "FATHER & MOTHER",
        },
        update: {
          relationship: "FATHER & MOTHER",
        },
      });

      sharedUsersCreated++;
      linksCreated++;
    } else {
      // Separate accounts for Father and Mother
      if (fEmail) {
        const { parentProfileId: fatherProfileId } = await getOrCreateParentUser(
          fEmail,
          "Father",
          student.watan,
          student.residentCity
        );

        await prisma.parentStudentLink.upsert({
          where: {
            parentId_studentId: {
              parentId: fatherProfileId,
              studentId: student.id,
            },
          },
          create: {
            parentId: fatherProfileId,
            studentId: student.id,
            relationship: "FATHER",
          },
          update: {
            relationship: "FATHER",
          },
        });
        fatherUsersCreated++;
        linksCreated++;
      }

      if (mEmail) {
        const { parentProfileId: motherProfileId } = await getOrCreateParentUser(
          mEmail,
          "Mother",
          student.watan,
          student.residentCity
        );

        await prisma.parentStudentLink.upsert({
          where: {
            parentId_studentId: {
              parentId: motherProfileId,
              studentId: student.id,
            },
          },
          create: {
            parentId: motherProfileId,
            studentId: student.id,
            relationship: "MOTHER",
          },
          update: {
            relationship: "MOTHER",
          },
        });
        motherUsersCreated++;
        linksCreated++;
      }
    }
  }

  console.log("=== LINKING SUMMARY ===");
  console.log(`Students processed & updated: ${studentsUpdated}`);
  console.log(`Parent-Student Links created/verified: ${linksCreated}`);

  const totalParents = await prisma.user.count({ where: { role: "PARENT" } });
  const totalParentProfiles = await prisma.parentProfile.count();
  const totalLinks = await prisma.parentStudentLink.count();

  console.log(`Total Parent User Accounts: ${totalParents}`);
  console.log(`Total Parent Profiles: ${totalParentProfiles}`);
  console.log(`Total Active Links: ${totalLinks}`);

  // Fetch sample parents
  const sampleParents = await prisma.parentProfile.findMany({
    take: 5,
    include: {
      user: { select: { email: true, firstName: true, lastName: true, role: true } },
      studentLinks: {
        include: {
          student: {
            select: {
              its: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  console.log("\n=== SAMPLE LINKED PARENT ACCOUNTS ===");
  console.log(JSON.stringify(sampleParents, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
