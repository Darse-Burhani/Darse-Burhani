import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const NEW_PASSWORD = "515253";

async function main() {
  console.log("🔍 Fetching all faculty / teacher accounts...");

  // Find all users with TEACHER role or with an existing teacherProfile
  const facultyUsers = await prisma.user.findMany({
    where: {
      OR: [
        { role: "TEACHER" },
        { teacherProfile: { isNot: null } },
      ],
    },
    include: {
      teacherProfile: {
        select: {
          employeeId: true,
          its: true,
          roleTitle: true,
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  if (facultyUsers.length === 0) {
    console.log("⚠️ No faculty accounts found.");
    return;
  }

  console.log(`Found ${facultyUsers.length} faculty accounts. Resetting password to "${NEW_PASSWORD}"...`);

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);

  let updatedCount = 0;
  for (const user of facultyUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        plainPassword: NEW_PASSWORD,
      },
    });

    // Invalidate old active sessions for clean re-login
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    updatedCount++;
    const empId = user.teacherProfile?.employeeId || user.teacherProfile?.its || "N/A";
    console.log(
      `  ✅ [${updatedCount}/${facultyUsers.length}] Reset: ${user.firstName} ${user.lastName} | Email: ${user.email} | ID/ITS: ${empId}`
    );
  }

  console.log("\n==========================================");
  console.log("🎉 ALL FACULTY PASSWORDS RESET SUCCESSFULLY");
  console.log(`Total Faculty Accounts Updated: ${updatedCount}`);
  console.log(`New Default Password: ${NEW_PASSWORD}`);
  console.log("==========================================\n");
}

main()
  .catch((err) => {
    console.error("❌ Error resetting faculty passwords:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
