import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanNameParts(fullName: string): { first: string; last: string; middle: string } {
  // Remove honorifics like "bhai", "shaikh", "mulla"
  const tokens = fullName
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !/^(bhai|shaikh|mulla|syedna|shk)$/i.test(t));

  if (tokens.length === 0) {
    return { first: "student", last: "talib", middle: "" };
  }
  if (tokens.length === 1) {
    return { first: slug(tokens[0]), last: "student", middle: "" };
  }

  const first = slug(tokens[0]);
  const last = slug(tokens[tokens.length - 1]);
  const middle = tokens.length > 2 ? slug(tokens[1]) : "";

  return { first, last, middle };
}

async function main() {
  console.log("=== Updating Talabat Emails to firstname.lastname@darseburhani.edu ===");

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: { studentProfile: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${students.length} students.`);

  const usedEmails = new Set<string>();
  let updatedCount = 0;

  for (const user of students) {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    const { first, last, middle } = cleanNameParts(fullName);

    let targetEmail = `${first}.${last}@darseburhani.edu`;

    // Handle collision if two students have identical first and last name
    if (usedEmails.has(targetEmail)) {
      if (middle) {
        targetEmail = `${first}.${middle}.${last}@darseburhani.edu`;
      }
      if (usedEmails.has(targetEmail)) {
        targetEmail = `${first}.${last}.${user.studentProfile?.its || user.id.slice(-4)}@darseburhani.edu`;
      }
    }

    usedEmails.add(targetEmail);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: targetEmail,
        plainPassword: user.plainPassword || "student123",
      },
    });

    console.log(`[UPDATED] ITS: ${user.studentProfile?.its || "N/A"} | ${fullName} -> ${targetEmail}`);
    updatedCount++;
  }

  console.log(`\n✅ Successfully updated ${updatedCount} talabat student emails!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
