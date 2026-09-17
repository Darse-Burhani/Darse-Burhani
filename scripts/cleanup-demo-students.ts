import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Finding demo (imported) students...");

  const users = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      email: { endsWith: "@student.darseburhani.edu" },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      studentProfile: { select: { id: true } },
    },
  });

  console.log(`Found ${users.length} imported demo student account(s).`);
  if (users.length === 0) {
    console.log("Nothing to clean up.");
    await prisma.$disconnect();
    return;
  }

  const userIds = users.map((u) => u.id);
  const profileIds = users
    .map((u) => u.studentProfile?.id)
    .filter((id): id is string => !!id);

  const deleted = await prisma.$transaction(async (tx) => {
    const childResults = await Promise.all([
      tx.attendanceRecord.deleteMany({ where: { studentId: { in: profileIds } } }),
      tx.pointLog.deleteMany({ where: { studentId: { in: profileIds } } }),
      tx.walletTransaction.deleteMany({ where: { studentId: { in: profileIds } } }),
      tx.bookLoan.deleteMany({ where: { studentId: { in: profileIds } } }),
      tx.notification.deleteMany({ where: { userId: { in: userIds } } }),
    ]);

    const deletedUsers = await tx.user.deleteMany({
      where: { id: { in: userIds } },
    });

    return { childResults, deletedUsers };
  });

  const [attendance, pointLogs, wallet, loans, notifications] = deleted.childResults;

  console.log("\n=== Cleanup Complete ===");
  console.log(`Attendance records deleted: ${attendance.count}`);
  console.log(`Point logs deleted: ${pointLogs.count}`);
  console.log(`Wallet transactions deleted: ${wallet.count}`);
  console.log(`Library loans deleted: ${loans.count}`);
  console.log(`Notifications deleted: ${notifications.count}`);
  console.log(`Demo student users deleted: ${deleted.deletedUsers.count}`);
  console.log("\nOnly talabat created via the admin panel remain.");
}

main()
  .catch(async (e) => {
    console.error("Cleanup error:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
