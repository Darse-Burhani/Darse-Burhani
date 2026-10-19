import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PARENT_PASSWORD = "parent5253";

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function extractFatherAndSurname(firstName: string, lastName: string): { fatherName: string; surname: string } {
  const parts = lastName.split(/\s+/).filter(Boolean);
  const filtered = parts.filter((p) => !/^(bhai)$/i.test(p));
  if (filtered.length >= 2) {
    const surname = filtered[filtered.length - 1];
    const fatherParts = filtered.slice(0, -1);
    return {
      fatherName: fatherParts.map(capitalize).join(" "),
      surname: capitalize(surname),
    };
  } else if (filtered.length === 1) {
    return { fatherName: capitalize(filtered[0]), surname: "" };
  }
  return { fatherName: capitalize(lastName), surname: "" };
}

function extractMotherFirstName(email: string, studentFirstName: string): string {
  const handle = email.split("@")[0] || "";
  const clean = handle.replace(/[\d._\-+]/g, "").trim();
  if (clean.length >= 3) {
    const match = clean.match(
      /^(fatema|batul|batool|jumana|rashida|sakina|mariam|munira|zainab|arwa|tasneem|tasnim|umme|durriya|ruqaiya|amatullah|zahra|khadija|insiyah|shirin|zenab|farida|fatima|alifiya|hafsah|hawra|asma|jameela|jamila|shirin)/i
    );
    if (match) {
      return capitalize(match[1]);
    }
    return capitalize(clean.slice(0, 10));
  }
  return `Mother of ${capitalize(studentFirstName)}`;
}

async function getOrCreateParentUser(
  emailRaw: string,
  firstName: string,
  lastName: string,
  relationType: string,
  watan?: string | null,
  city?: string | null
): Promise<{ userId: string; parentProfileId: string }> {
  const email = emailRaw.toLowerCase().trim();
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
    return { userId: existingUser.id, parentProfileId };
  }

  // Create new User and ParentProfile
  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      plainPassword: PARENT_PASSWORD,
      firstName,
      lastName,
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
  console.log("  LINKING TALABAT TO PARENTS & CREATING PARENT USERS    ");
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
    const sFirstName = student.user.firstName;
    const sLastName = student.user.lastName;
    const { fatherName, surname } = extractFatherAndSurname(sFirstName, sLastName);
    const fatherFullName = `${fatherName} ${surname}`.trim();

    const fEmail = student.fatherEmail?.toLowerCase().trim() || null;
    const mEmail = student.motherEmail?.toLowerCase().trim() || null;

    let motherFullName = "Mother";
    if (mEmail) {
      const mFirst = extractMotherFirstName(mEmail, sFirstName);
      motherFullName = `${mFirst} ${surname}`.trim();
    }

    // 1. Update StudentProfile with clean parent names
    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        fatherName: fatherFullName,
        motherName: motherFullName,
      },
    });
    studentsUpdated++;

    // 2. Link Parents
    if (fEmail && mEmail && fEmail === mEmail) {
      // Shared Parent Account (both parents share the same email)
      const { parentProfileId } = await getOrCreateParentUser(
        fEmail,
        fatherName,
        surname,
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
          fatherName,
          surname,
          "FATHER",
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
        const mFirst = extractMotherFirstName(mEmail, sFirstName);
        const { parentProfileId: motherProfileId } = await getOrCreateParentUser(
          mEmail,
          mFirst,
          surname,
          "MOTHER",
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
