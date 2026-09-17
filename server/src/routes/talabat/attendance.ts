import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireAuth, requireRole } from "../../middleware";
import { getScanWindow } from "../../lib/biometric";

const router = Router();

router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const month = parseInt((req.query.month as string) || String(new Date().getMonth()));
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

    const data = await cache.getOrSet(
      `student:attendance:${session.user.id}:${year}:${month}`,
      async () => {
        const studentProfile = await prisma.studentProfile.findUnique({
          where: { userId: session.user.id },
          select: { id: true, grade: true, section: true, streakDays: true },
        });

        if (!studentProfile) {
          throw new Error("Student profile not found");
        }

        // Date range for the requested month
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

        // All-time stats (for totals)
        const allTimeStats = await prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { studentId: studentProfile.id },
          _count: true,
        });

        // Current month records (for calendar)
        const monthRecords = await prisma.attendanceRecord.findMany({
          where: {
            studentId: studentProfile.id,
            date: { gte: monthStart, lte: monthEnd },
          },
          include: {
            class: { select: { name: true, subject: true } },
          },
          orderBy: { date: "desc" },
        });

        // Get biometric scan records (Tilawat al Dua) for this month
        const scanWindow = await getScanWindow("STUDENT");
        const biometricRecords = await prisma.attendanceRecord.findMany({
          where: {
            studentId: studentProfile.id,
            date: { gte: monthStart, lte: monthEnd },
            verificationMethod: "BIOMETRIC",
          },
          orderBy: { date: "desc" },
        });

        // Recent records (last 20)
        const recentRecords = await prisma.attendanceRecord.findMany({
          where: { studentId: studentProfile.id },
          include: {
            class: { select: { name: true, subject: true } },
          },
          orderBy: { date: "desc" },
          take: 20,
        });

        // This month stats
        const monthPresent = monthRecords.filter((r) => r.status === "PRESENT").length;
        const monthLate = monthRecords.filter((r) => r.status === "LATE").length;
        const monthAbsent = monthRecords.filter((r) => r.status === "ABSENT").length;
        const monthEarly = monthRecords.filter((r) => r.status === "EARLY_DEPARTURE").length;
        const monthTotal = monthRecords.length;
        const monthPercentage = monthTotal > 0 ? Math.round(((monthPresent + monthLate) / monthTotal) * 100) : 0;

        // Biometric (Tilawat al Dua) stats
        const biometricPresent = biometricRecords.filter((r) => r.status === "PRESENT").length;
        const biometricLate = biometricRecords.filter((r) => r.status === "LATE").length;
        const biometricTotal = biometricRecords.length;
        const biometricPercentage = biometricTotal > 0 ? Math.round(((biometricPresent + biometricLate) / biometricTotal) * 100) : 0;

        // Map all-time stats
        const totalPresent = allTimeStats.find((s) => s.status === "PRESENT")?._count || 0;
        const totalLate = allTimeStats.find((s) => s.status === "LATE")?._count || 0;
        const totalAbsent = allTimeStats.find((s) => s.status === "ABSENT")?._count || 0;
        const totalEarly = allTimeStats.find((s) => s.status === "EARLY_DEPARTURE")?._count || 0;
        const totalRecords = totalPresent + totalLate + totalAbsent + totalEarly;
        const overallPercentage = totalRecords > 0 ? Math.round(((totalPresent + totalLate) / totalRecords) * 100) : 0;

        // Calendar data — map each day of month to its status
        const daysInMonth = monthEnd.getDate();
        const calendar: { day: number; status: string | null; tilawatStatus?: string | null }[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const record = monthRecords.find(
            (r) => r.date.toISOString().slice(0, 10) === dateStr,
          );
          // Check for Tilawat al Dua biometric scan on this day
          const biometricRecord = biometricRecords.find(
            (r) => r.date.toISOString().slice(0, 10) === dateStr,
          );
          calendar.push({
            day: d,
            status: record?.status || null,
            tilawatStatus: biometricRecord?.status || null,
          });
        }

        // Streak calculation — single batched query instead of 365 individual queries
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const recentStreakRecords = await prisma.attendanceRecord.findMany({
          where: {
            studentId: studentProfile.id,
            status: { in: ["PRESENT", "LATE"] },
            date: { gte: new Date(today.getTime() - 365 * 86400000) },
          },
          select: { date: true },
          orderBy: { date: "desc" },
        });

        // Count consecutive days from today backwards
        const uniqueDates = new Set(
          recentStreakRecords.map((r) => r.date.toISOString().slice(0, 10)),
        );
        let currentStreak = 0;
        const checkDate = new Date(today);
        while (uniqueDates.has(checkDate.toISOString().slice(0, 10))) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }

        return {
          stats: {
            month: {
              total: monthTotal,
              present: monthPresent,
              late: monthLate,
              absent: monthAbsent,
              earlyDeparture: monthEarly,
              percentage: monthPercentage,
            },
            overall: {
              total: totalRecords,
              present: totalPresent,
              late: totalLate,
              absent: totalAbsent,
              earlyDeparture: totalEarly,
              percentage: overallPercentage,
            },
            currentStreak,
            grade: studentProfile.grade,
            section: studentProfile.section,
          },
          biometricStats: {
            windowName: scanWindow?.name || "Tilawat al Dua",
            windowStart: scanWindow?.startTime || "07:00",
            windowEnd: scanWindow?.endTime || "08:15",
            total: biometricTotal,
            present: biometricPresent,
            late: biometricLate,
            percentage: biometricPercentage,
          },
          calendar,
          recentRecords: recentRecords.map((r) => ({
            id: r.id,
            date: r.date.toISOString(),
            status: r.status,
            checkInTime: r.checkInTime?.toISOString() || null,
            checkOutTime: r.checkOutTime?.toISOString() || null,
            className: r.class.name,
            subject: r.class.subject,
            verificationMethod: r.verificationMethod,
            justification: r.justification,
            justificationStatus: r.justificationStatus,
            justificationSubmittedAt: r.justificationSubmittedAt?.toISOString() || null,
            justifiedAt: r.justifiedAt?.toISOString() || null,
          })),
          month: { index: month, name: monthStart.toLocaleString("default", { month: "long" }), year },
        };
      },
      { ttl: 15_000, tags: ["attendanceRecord", "dashboard"] },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Student attendance error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch attendance" });
  }
});

export default router;
