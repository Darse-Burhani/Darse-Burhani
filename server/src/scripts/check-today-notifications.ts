import "../env";
import prisma from "../lib/prisma";

async function main() {
  const count = await prisma.notification.count({
    where: { createdAt: { gte: new Date("2026-11-03T00:00:00.000Z") } },
  });
  console.log("Total notifications created today:", count);
  const sample = await prisma.notification.findMany({
    where: { createdAt: { gte: new Date("2026-11-03T00:00:00.000Z") } },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true, role: true } } },
  });
  for (const n of sample) {
    console.log(`- To: ${n.user.firstName} ${n.user.lastName} (${n.user.role}) | Title: "${n.title}" | Body: "${n.body}" | Type: ${n.type}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

