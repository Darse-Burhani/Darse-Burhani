import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PARENT_PASSWORD = "parent5253";

async function main() {
  console.log("=========================================================");
  console.log("  SYNC PARENTS WITH EMAIL NAME ONLY & ASSIGN TO TALABAT   ");
  console.log("  Password standard: parent5253                          ");
  console.log("=========================================================\n");

  const passwordHash = await bcrypt.hash(PARENT_PASSWORD, 10);

  // 1. Fetch all student profiles with user relations
  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { its: "asc" },
  });

  console.log(`Processing ${students.length} Talabat students...`);

  // Map of unique email -> { email, emailName, relationType, students: [{ studentId, relationship }] }
  const parentMap = new Map<
    string,
    {
      email: string;
      emailName: string;
      watan?: string | null;
      city?: string | null;
      roles: Set<string>;
      studentLinks: Array<{ studentId: string; relationship: string }>;
    }
  >();

  for (const s of students) {
    const fEmail = s.fatherEmail?.toLowerCase().trim() || null;
    const mEmail = s.motherEmail?.toLowerCase().trim() || null;

    const fEmailName = fEmail ? fEmail.split("@")[0].trim() : "";
    const mEmailName = mEmail ? mEmail.split("@")[0].trim() : "";

    // Update studentProfile fatherName & motherName with the email name only
    await prisma.studentProfile.update({
      where: { id: s.id },
      data: {
        fatherName: fEmailName || s.fatherName,
        motherName: mEmailName || s.motherName,
      },
    });

    if (fEmail && mEmail && fEmail === mEmail) {
      // Shared account
      if (!parentMap.has(fEmail)) {
        parentMap.set(fEmail, {
          email: fEmail,
          emailName: fEmailName,
          watan: s.watan,
          city: s.residentCity,
          roles: new Set(["FATHER & MOTHER"]),
          studentLinks: [],
        });
      }
      const p = parentMap.get(fEmail)!;
      p.roles.add("FATHER & MOTHER");
      if (!p.studentLinks.some((l) => l.studentId === s.id)) {
        p.studentLinks.push({ studentId: s.id, relationship: "FATHER & MOTHER" });
      }
    } else {
      // Separate father account
      if (fEmail) {
        if (!parentMap.has(fEmail)) {
          parentMap.set(fEmail, {
            email: fEmail,
            emailName: fEmailName,
            watan: s.watan,
            city: s.residentCity,
            roles: new Set(["Father"]),
            studentLinks: [],
          });
        }
        const p = parentMap.get(fEmail)!;
        p.roles.add("Father");
        if (!p.studentLinks.some((l) => l.studentId === s.id)) {
          p.studentLinks.push({ studentId: s.id, relationship: "FATHER" });
        }
      }

      // Separate mother account
      if (mEmail) {
        if (!parentMap.has(mEmail)) {
          parentMap.set(mEmail, {
            email: mEmail,
            emailName: mEmailName,
            watan: s.watan,
            city: s.residentCity,
            roles: new Set(["Mother"]),
            studentLinks: [],
          });
        }
        const p = parentMap.get(mEmail)!;
        p.roles.add("Mother");
        if (!p.studentLinks.some((l) => l.studentId === s.id)) {
          p.studentLinks.push({ studentId: s.id, relationship: "MOTHER" });
        }
      }
    }
  }

  console.log(`Found ${parentMap.size} unique parent email accounts to configure.\n`);

  let usersUpdated = 0;
  let usersCreated = 0;
  let linksConfigured = 0;

  for (const [email, info] of parentMap.entries()) {
    const relationType = Array.from(info.roles).join(" & ");

    // Upsert User
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { parentProfile: true },
    });

    let userId: string;
    let parentProfileId: string;

    if (existingUser) {
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          firstName: info.emailName,
          lastName: "",
          role: "PARENT",
          plainPassword: PARENT_PASSWORD,
          passwordHash,
          isActive: true,
        },
      });
      userId = updated.id;
      usersUpdated++;

      if (existingUser.parentProfile) {
        const updatedProf = await prisma.parentProfile.update({
          where: { id: existingUser.parentProfile.id },
          data: {
            relationType,
            watan: info.watan || existingUser.parentProfile.watan,
            city: info.city || existingUser.parentProfile.city,
          },
        });
        parentProfileId = updatedProf.id;
      } else {
        const newProf = await prisma.parentProfile.create({
          data: {
            userId: existingUser.id,
            relationType,
            watan: info.watan || null,
            city: info.city || null,
          },
        });
        parentProfileId = newProf.id;
      }
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          firstName: info.emailName,
          lastName: "",
          role: "PARENT",
          plainPassword: PARENT_PASSWORD,
          passwordHash,
          isActive: true,
          parentProfile: {
            create: {
              relationType,
              watan: info.watan || null,
              city: info.city || null,
            },
          },
        },
        include: { parentProfile: true },
      });
      userId = created.id;
      parentProfileId = created.parentProfile!.id;
      usersCreated++;
    }

    // Link each assigned talabat student
    for (const link of info.studentLinks) {
      await prisma.parentStudentLink.upsert({
        where: {
          parentId_studentId: {
            parentId: parentProfileId,
            studentId: link.studentId,
          },
        },
        create: {
          parentId: parentProfileId,
          studentId: link.studentId,
          relationship: link.relationship,
        },
        update: {
          relationship: link.relationship,
        },
      });
      linksConfigured++;
    }
  }

  console.log("\n=========================================================");
  console.log("  PARENT RECONFIGURATION COMPLETE                       ");
  console.log("=========================================================");
  console.log(`- Parent Users Updated:   ${usersUpdated}`);
  console.log(`- Parent Users Created:   ${usersCreated}`);
  console.log(`- Total Parent Profiles:  ${parentMap.size}`);
  console.log(`- Student Links Active:   ${linksConfigured}`);
  console.log(`- Default Parent Password: ${PARENT_PASSWORD}`);
  console.log("=========================================================\n");
}

main()
  .catch((err) => {
    console.error("Parent sync error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
