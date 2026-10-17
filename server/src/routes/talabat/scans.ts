import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireRole } from "../../middleware";
import { isRabiAlAkhirDate } from "../../lib/fatimi-calendar";

const router = Router();

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// GET /api/talabat/scans - The student's biometric scan history
router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const data = await cache.getOrSet(
      `student:scans:v2:${session.user.id}`,
      async () => {
        const profile = await prisma.studentProfile.findUnique({
          where: { userId: session.user.id },
          select: { id: true, grade: true, section: true },
        });
        if (!profile) throw new Error("Student profile not found");

        const now = new Date();
        const todayStart = utcDayStart(now);
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        const rawScans = await prisma.attendanceRecord.findMany({
          where: { studentId: profile.id, verificationMethod: "BIOMETRIC" },
          include: { class: { select: { name: true, subject: true } } },
          orderBy: { checkInTime: "desc" },
          take: 300,
        });

        // Filter out Rabi ul Akhar without deleting from DB
        const scans = rawScans.filter((r) => !isRabiAlAkhirDate(r.date));
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
            className: r.class?.name ?? "",
            subject: r.class?.subject ?? "",
            biometricHash: r.biometricHash,
          })),
        };
      },
      { ttl: 15_000, tags: ["attendanceRecord"] },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Student scans error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch scan history" });
  }
});

export default router;
