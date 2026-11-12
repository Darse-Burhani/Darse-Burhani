
import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireRole } from "../../middleware";
import { getScanWindow, getStartOfDayIST, getAudienceType } from "../../lib/biometric";
import { isRabiAlAkhirDate } from "../../lib/fatimi-calendar";

const router = Router();

router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const month = parseInt((req.query.month as string) || String(new Date().getMonth()));
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

    const data = await cache.getOrSet(
      `student:attendance:v2:${session.user.id}:${year}:${month}`,
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

        // All-time attendance records (filter out Rabi ul Akhar without deleting from database)
        const allRecords = await prisma.attendanceRecord.findMany({
          where: { studentId: studentProfile.id },
          select: { status: true, date: true },
        });
        const nonRabiAllRecords = allRecords.filter((r) => !isRabiAlAkhirDate(r.date));

        // Current month records (for calendar and breakdown)
        const rawMonthRecords = await prisma.attendanceRecord.findMany({
          where: {
            studentId: studentProfile.id,
            date: { gte: monthStart, lte: monthEnd },
          },
          include: {
            class: { select: { name: true, subject: true } },
          },
          orderBy: { date: "desc" },
        });
        const monthRecords = rawMonthRecords.filter((r) => !isRabiAlAkhirDate(r.date));

        // Get biometric scan records (Tilawat al Dua) for this month
        const scanWindow = await getScanWindow("STUDENT");
        const [rawBiometricRecords, rawBiometricRegistries] = await Promise.all([
          prisma.attendanceRecord.findMany({
            where: {
              studentId: studentProfile.id,
              date: { gte: monthStart, lte: monthEnd },
              OR: [
                { verificationMethod: "BIOMETRIC" },
                { biometricMethod: { not: null } },
                { checkInTime: { not: null } },
              ],
            },
            orderBy: { date: "desc" },
          }),
          prisma.attendanceRegistry.findMany({
            where: {
              studentId: studentProfile.id,
              date: { gte: monthStart, lte: monthEnd },
              OR: [
                { source: "BIOMETRIC" },
                { checkInTime: { not: null } },
              ],
            },
            orderBy: { date: "desc" },
          }),
        ]);

        const mergedBiometricMap = new Map<string, any>();
        for (const reg of rawBiometricRegistries) {
          if (!isRabiAlAkhirDate(reg.date)) {
            mergedBiometricMap.set(reg.date.toISOString().slice(0, 10), reg);
          }
        }
        for (const rec of rawBiometricRecords) {
          if (!isRabiAlAkhirDate(rec.date)) {
            mergedBiometricMap.set(rec.date.toISOString().slice(0, 10), rec);
          }
        }
        const biometricRecords = Array.from(mergedBiometricMap.values());

        // Recent records (excluding Rabi ul Akhar, take 20)
        const rawRecentRecords = await prisma.attendanceRecord.findMany({
          where: { studentId: studentProfile.id },
          include: {
            class: { select: { name: true, subject: true } },
          },
          orderBy: { date: "desc" },
          take: 60,
        });
        const recentRecords = rawRecentRecords.filter((r) => !isRabiAlAkhirDate(r.date)).slice(0, 20);

        // This month stats
        const monthPresent = monthRecords.filter((r) => r.status === "PRESENT").length;
        const monthLate = monthRecords.filter((r) => r.status === "LATE").length;
        const monthAbsent = monthRecords.filter((r) => r.status === "ABSENT").length;
        const monthEarly = monthRecords.filter((r) => r.status === "EARLY_DEPARTURE").length;
        const monthTotal = monthRecords.length;
        const monthPercentage = monthTotal > 0 ? Math.round(((monthPresent + monthLate) / monthTotal) * 100) : 0;

        // Default-present fallback: zero device scans today system-wide
        // (device outage) → today's Tilawat al Dua cell counts as PRESENT.
        const todayIstStart = getStartOfDayIST(new Date());
        const todayStrIST = todayIstStart.toISOString().slice(0, 10);
        const anyRealScanToday = await prisma.attendanceRegistry.count({
          where: { date: todayIstStart, source: "BIOMETRIC", checkInTime: { not: null } },
        });
        const studentHasBiometricToday = biometricRecords.some(
          (r) => r.date.toISOString().slice(0, 10) === todayStrIST
        );
        const defaultPresentToday = anyRealScanToday === 0 && !studentHasBiometricToday;

        // Biometric (Tilawat al Dua) stats
        const biometricPresent = biometricRecords.filter((r) => r.status === "PRESENT").length + (defaultPresentToday ? 1 : 0);
        const biometricLate = biometricRecords.filter((r) => r.status === "LATE").length;
        const biometricTotal = biometricRecords.length + (defaultPresentToday ? 1 : 0);
        const biometricPercentage = biometricTotal > 0 ? Math.round(((biometricPresent + biometricLate) / biometricTotal) * 100) : 0;

        // Map all-time stats excluding Rabi ul Akhar
        const totalPresent = nonRabiAllRecords.filter((s) => s.status === "PRESENT").length;
        const totalLate = nonRabiAllRecords.filter((s) => s.status === "LATE").length;
        const totalAbsent = nonRabiAllRecords.filter((s) => s.status === "ABSENT").length;
        const totalEarly = nonRabiAllRecords.filter((s) => s.status === "EARLY_DEPARTURE").length;
        const totalRecords = totalPresent + totalLate + totalAbsent + totalEarly;
        const overallPercentage = totalRecords > 0 ? Math.round(((totalPresent + totalLate) / totalRecords) * 100) : 0;

        // Calendar data — map each day of month to its status, hiding Rabi ul Akhar days
        const daysInMonth = monthEnd.getDate();
        const calendar: { day: number; status: string | null; tilawatStatus?: string | null }[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
          const dayDate = new Date(year, month, d);
          const isRabiDay = isRabiAlAkhirDate(dayDate);
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

          const record = !isRabiDay
            ? monthRecords.find((r) => r.date.toISOString().slice(0, 10) === dateStr)
            : null;
          const biometricRecord = !isRabiDay
            ? biometricRecords.find((r) => r.date.toISOString().slice(0, 10) === dateStr)
            : null;

          const tilawatStatus =
            biometricRecord?.status ||
            (defaultPresentToday && !isRabiDay && dateStr === todayStrIST ? "PRESENT" : null);

          const effectiveStatus =
            (record?.status && record.status !== "ABSENT")
              ? record.status
              : biometricRecord?.status || record?.status || null;

          calendar.push({
            day: d,
            status: effectiveStatus,
            tilawatStatus,
          });
        }

        // Streak calculation — single batched query excluding Rabi ul Akhar
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const rawStreakRecords = await prisma.attendanceRecord.findMany({
          where: {
            studentId: studentProfile.id,
            status: { in: ["PRESENT", "LATE"] },
            date: { gte: new Date(today.getTime() - 365 * 86400000) },
          },
          select: { date: true },
          orderBy: { date: "desc" },
        });
        const recentStreakRecords = rawStreakRecords.filter((r) => !isRabiAlAkhirDate(r.date));

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

        // Fetch Maktabat Attendance Arrivals
        const maktabatAttendances = await (prisma as any).libraryAttendance.findMany({
          where: {
            studentId: { in: [session.user.id, studentProfile.id] },
          },
          orderBy: { checkInTime: "desc" },
          take: 25,
        });

        // Fetch all active scan schedules applicable to students (STUDENT or BOTH)
        const allWindows = await prisma.biometricScanWindow.findMany({
          where: { enabled: true },
          orderBy: { startTime: "asc" },
        });
        const studentWindows = allWindows.filter((w) => {
          const aud = getAudienceType(w);
          return aud === "BOTH" || aud === "ALL_STUDENTS";
        });
        const schedules = studentWindows.map((w) => {
          const aud = getAudienceType(w);
          const [sh, sm] = (w.startTime || "07:00").split(":").map(Number);
          const [eh, em] = (w.endTime || "08:15").split(":").map(Number);
          const [lh, lm] = ((w as any).lateEndTime || w.endTime || "08:30").split(":").map(Number);
          const sMin = (sh || 0) * 60 + (sm || 0);
          const eMin = (eh || 0) * 60 + (em || 0);
          const lMin = (lh || 0) * 60 + (lm || 0);

          // Find scans matching this window
          const matchedScans = biometricRecords.filter((r) => {
            if (!r.checkInTime) return false;
            const cd = new Date(r.checkInTime);
            const punchMin = (cd.getUTCHours() * 60 + cd.getUTCMinutes() + 330) % 1440;
            return punchMin >= Math.max(0, sMin - 120) && punchMin <= lMin;
          });

          const onTime = matchedScans.filter((r) => r.status === "PRESENT").length;
          const late = matchedScans.filter((r) => r.status === "LATE").length;
          const totalDays = biometricTotal || 1;
          const percentage = totalDays > 0 ? Math.round(((onTime + late) / totalDays) * 100) : 0;

          return {
            id: w.id,
            name: w.name,
            startTime: w.startTime,
            endTime: w.endTime,
            lateEndTime: (w as any).lateEndTime || w.endTime,
            audience: aud,
            stats: {
              total: totalDays,
              present: onTime,
              late,
              missed: Math.max(0, totalDays - onTime - late),
              percentage,
            },
            scans: matchedScans.slice(0, 15).map((r) => ({
              id: r.id,
              date: r.date.toISOString(),
              checkInTime: r.checkInTime?.toISOString() || null,
              status: r.status,
              source: r.source || r.verificationMethod,
            })),
          };
        });

        return {
          schedules,
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
          maktabatAttendances: maktabatAttendances.map((m: any) => ({
            id: m.id,
            date: m.date?.toISOString() || null,
            checkInTime: m.checkInTime?.toISOString() || null,
            status: m.status || "PRESENT",
            sessionType: m.sessionType || "PRESENT",
          })),
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
