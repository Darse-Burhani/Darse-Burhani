/**
 * Repair for "faculty scanned on device but missing in portal":
 *  1. Backfills biometricHash for active teachers that have an ITS / employeeId
 *     but no enrolled hash (device IDs that match nothing land in UNMATCHED).
 *  2. Self-heals the unified schedule event (ONE event carries BOTH the
 *     Talabat timer and the faculty timer) from any leftover legacy
 *     standalone faculty row.
 *
 * Safe to re-run — only touches rows that need it. Run with:
 *   npx tsx server/src/scripts/fix-faculty-enrollment.ts
 */
import "../env";
import prisma from "../lib/prisma";

async function main() {
  // 1. Enroll missing faculty hashes (active teachers only)
  const missing = await prisma.teacherProfile.findMany({
    where: { biometricHash: null, user: { isActive: true } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  let enrolled = 0;
  let skipped = 0;
  for (const t of missing) {
    const candidate =
      t.employeeId && t.employeeId.trim() && t.employeeId.trim() !== "-"
        ? t.employeeId.trim()
        : t.its?.trim() || null;
    if (!candidate) {
      console.log(`SKIP ${t.id} (${t.user.firstName} ${t.user.lastName}): no employeeId/ITS`);
      skipped++;
      continue;
    }
    const clash = await prisma.teacherProfile.findFirst({
      where: {
        biometricHash: candidate,
        NOT: { id: t.id },
      },
      select: { id: true },
    });
    const studentClash = clash
      ? null
      : await prisma.studentProfile.findFirst({
          where: { biometricHash: candidate },
          select: { id: true },
        });
    if (clash || studentClash) {
      console.log(`SKIP ${t.employeeId} (${t.user.firstName} ${t.user.lastName}): "${candidate}" already enrolled elsewhere`);
      skipped++;
      continue;
    }
    await prisma.teacherProfile.update({
      where: { id: t.id },
      data: { biometricHash: candidate },
    });
    console.log(`ENROLLED ${t.employeeId} (${t.user.firstName} ${t.user.lastName}) -> "${candidate}"`);
    enrolled++;
  }
  console.log(`\nFaculty enrollment repair: ${enrolled} enrolled, ${skipped} skipped.`);

  // 2. Ensure the unified primary event carries the faculty timer.
  // (Legacy standalone faculty rows were merged by migration
  // 20260909000000_unified_event_dual_timers; this is a self-heal fallback.)
  const primary = await prisma.biometricScanWindow.findUnique({ where: { id: "default" } });
  const legacy = await prisma.biometricScanWindow.findFirst({
    where: {
      id: { not: "default" },
      OR: [{ id: "faculty_default" }, { id: "faculty" }],
    },
  });
  if (legacy) {
    if (primary && !(primary as any).facultyStartTime) {
      await prisma.biometricScanWindow.update({
        where: { id: "default" },
        data: {
          facultyStartTime: legacy.startTime,
          facultyEndTime: legacy.endTime,
          facultyLateEndTime: (legacy as any).lateEndTime ?? legacy.endTime,
          facultyEnabled: legacy.enabled,
        },
      });
      console.log(`Merged legacy faculty row "${legacy.name}" into the unified "default" event.`);
    }
    await prisma.biometricScanWindow.delete({ where: { id: legacy.id } }).catch(() => {});
    console.log(`Retired legacy faculty row "${legacy.id}".`);
  } else {
    console.log("No legacy faculty row present — unified event model OK.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Repair failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
