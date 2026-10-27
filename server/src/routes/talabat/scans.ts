import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireRole } from "../../middleware";
import { isRabiAlAkhirDate } from "../../lib/fatimi-calendar";

const router = Router();

/** Calendar day start (UTC midnight of the IST calendar day) — the shape every
 *  attendance row stores its `date` in. */
function istDayStart(d: Date): Date {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

function istMonthStart(d: Date): Date {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
}

interface ScanRow {
  id: string;
  date: Date;
  status: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  className: string;
  subject: string;
  biometricHash: string | null;
}

// GET /api/talabat/scans - The student's biometric scan history
router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const data = await cache.getOrSet(
      `student:scans:v3:${session.user.id}`,
      async () => {
        const profile = await prisma.studentProfile.findUnique({
          where: { userId: session.user.id },
          select: { id: true, grade: true, section: true },
        });
        if (!profile) throw new Error("Student profile not found");

        const now = new Date();
        const todayStart = istDayStart(now);
        const monthStart = istMonthStart(now);

        const [perClassRecords, registries] = await Promise.all([
          // Per-class biometric records (written only for enrolled classes)
          prisma.attendanceRecord.findMany({
            where: {
              studentId: profile.id,
              OR: [
                { verificationMethod: "BIOMETRIC" },
                { biometricMethod: { not: null } },
                { checkInTime: { not: null } },
              ],
            },
            include: { class: { select: { name: true, subject: true } } },
            orderBy: { checkInTime: "desc" },
            take: 300,
          }),
          // Daily registry: the authoritative "this talib scanned today" row
          prisma.attendanceRegistry.findMany({
            where: {
              studentId: profile.id,
              OR: [
                { source: "BIOMETRIC" },
                { checkInTime: { not: null } },
              ],
            },
            orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
            take: 300,
          }),
        ]);

        const rows: ScanRow[] = perClassRecords.map((r) => ({
          id: r.id,
          date: r.date,
          status: r.status as string,
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          className: r.class?.name ?? "",
          subject: r.class?.subject ?? "",
          biometricHash: r.biometricHash,
        }));

        // Days that exist only in the registry (student with no active class
        // enrollment, or a scan processed before class mapping) used to make the
        // whole history look empty — merge them in so every scan is visible.
        const seenDays = new Set(rows.map((r) => r.date.getTime()));
        for (const reg of registries) {
          const dayKey = reg.date.getTime();
          if (seenDays.has(dayKey)) continue;
          if (!reg.checkInTime) continue;
          seenDays.add(dayKey);
          rows.push({
            id: reg.id,
            date: reg.date,
            status: reg.status as string,
            checkInTime: reg.checkInTime,
            checkOutTime: reg.checkOutTime,
            className: "",
            subject: "",
            biometricHash: null,
          });
        }

        // Default-present fallback: if the terminals recorded ZERO scans
        // system-wide today (device outage), the talib's day still shows as
        // PRESENT — the scheduler persists the same row by window cutoff.
        const hasTodayRow = rows.some((r) => r.date.getTime() === todayStart.getTime());
        if (!hasTodayRow) {
          const anyRealScanToday = await prisma.attendanceRegistry.count({
            where: { date: todayStart, source: "BIOMETRIC", checkInTime: { not: null } },
          });
          if (anyRealScanToday === 0) {
            const enrollment = await prisma.classEnrollment.findFirst({
              where: { studentId: profile.id, isActive: true },
              include: { class: { select: { name: true, subject: true } } },
            });
            rows.push({
              id: `auto-present-${todayStart.toISOString()}`,
              date: todayStart,
              status: "PRESENT",
              checkInTime: null,
              checkOutTime: null,
              className: enrollment?.class?.name ?? "",
              subject: enrollment?.class?.subject ?? "",
              biometricHash: null,
            });
          }
        }

        rows.sort(
          (a, b) =>
            (b.checkInTime?.getTime() ?? b.date.getTime()) -
            (a.checkInTime?.getTime() ?? a.date.getTime())
        );

        // Filter out Rabi ul Akhar without deleting from DB
        const scans = rows.filter((r) => !isRabiAlAkhirDate(r.date));
        const todayCount = scans.filter((r) => r.date >= todayStart).length;
        const monthCount = scans.filter((r) => r.date >= monthStart).length;
        const totalCount = scans.length;

        return {
          grade: profile.grade,
          section: profile.section,
          stats: { today: todayCount, month: monthCount, total: totalCount },
          scans: scans.map((r) => ({
            id: r.id,
            date: r.date.toISOString(),
            status: r.status,
            checkInTime: r.checkInTime?.toISOString() || null,
            checkOutTime: r.checkOutTime?.toISOString() || null,
            className: r.className,
            subject: r.subject,
            biometricHash: r.biometricHash,
          })),
        };
      },
      { ttl: 15_000, tags: ["attendanceRecord", "attendanceRegistry"] },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Student scans error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch scan history" });
  }
});

export default router;
