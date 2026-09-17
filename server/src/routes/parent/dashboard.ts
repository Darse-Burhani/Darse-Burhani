import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const data = await cache.getOrSet(
      `parent:dashboard:${session.user.id}`,
      async () => {
        const links = await prisma.parentStudentLink.findMany({
          where: { parentId: parentProfile.id },
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
              },
            },
          },
        });

        if (links.length === 0) {
          return {
            parent: {
              id: parentProfile.id,
              userId: parentProfile.userId,
              firstName: parentProfile.user?.firstName || "",
              lastName: parentProfile.user?.lastName || "",
              email: parentProfile.user?.email || "",
              phone: parentProfile.phone,
              secondaryPhone: parentProfile.secondaryPhone,
              relationType: parentProfile.relationType,
              its: parentProfile.its,
            },
            children: [],
          };
        }

        const studentProfileIds = links.map((l) => l.student.id);

        // Date calculations
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tonight = new Date(today.getTime() + 86400000);
        const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

        const [
          todayAttendanceRecords,
          weeklyAttendanceRecords,
          pointAggregations,
          allPointLogs,
          allBadges,
          latestHifzSlips,
        ] = await Promise.all([
          // 1. Today's attendance for all children
          prisma.attendanceRecord.findMany({
            where: {
              studentId: { in: studentProfileIds },
              date: { gte: today, lt: tonight },
            },
            orderBy: { checkInTime: "desc" },
            distinct: ["studentId"],
          }),
          // 2. Past 7 days attendance records
          prisma.attendanceRecord.findMany({
            where: {
              studentId: { in: studentProfileIds },
              date: { gte: sevenDaysAgo, lt: tonight },
            },
            select: {
              studentId: true,
              date: true,
              status: true,
              checkInTime: true,
            },
          }),
          // 3. Points today aggregated per student
          prisma.pointLog.groupBy({
            by: ["studentId"],
            where: {
              studentId: { in: studentProfileIds },
              createdAt: { gte: today },
            },
            _sum: { points: true },
            _count: true,
          }),
          // 4. Recent point logs for ALL children
          prisma.pointLog.findMany({
            where: { studentId: { in: studentProfileIds } },
            orderBy: { createdAt: "desc" },
            take: studentProfileIds.length * 15,
            include: {
              teacher: {
                select: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
              },
            },
          }),
          // 5. Earned badges for ALL children
          prisma.badgeProgress.findMany({
            where: { studentId: { in: studentProfileIds }, isEarned: true },
            include: { badge: true },
            orderBy: { earnedAt: "desc" },
            take: studentProfileIds.length * 8,
          }),
          // 6. Latest published Hifz weekly slips
          prisma.hifzWeeklySlip.findMany({
            where: {
              studentId: { in: studentProfileIds },
              status: "PUBLISHED",
            },
            orderBy: { weekNumber: "desc" },
            include: {
              faculty: {
                select: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          }),
        ]);

        // Group attendance by student
        const attendanceByStudent = new Map(
          todayAttendanceRecords.map((a) => [a.studentId, a]),
        );

        // Group 7-day attendance count
        const weeklyAttendanceByStudent = new Map<string, typeof weeklyAttendanceRecords>();
        for (const rec of weeklyAttendanceRecords) {
          const list = weeklyAttendanceByStudent.get(rec.studentId) || [];
          list.push(rec);
          weeklyAttendanceByStudent.set(rec.studentId, list);
        }

        const pointsTodayByStudent = new Map(
          pointAggregations.map((p) => [p.studentId, p._sum.points || 0]),
        );

        // Group point logs, badges, and slips by studentId
        const pointLogsByStudentMap = new Map<string, typeof allPointLogs>();
        const badgesByStudentMap = new Map<string, typeof allBadges>();
        const latestSlipByStudentMap = new Map<string, (typeof latestHifzSlips)[0]>();

        for (const log of allPointLogs) {
          const existing = pointLogsByStudentMap.get(log.studentId) || [];
          if (existing.length < 15) {
            existing.push(log);
            pointLogsByStudentMap.set(log.studentId, existing);
          }
        }

        for (const badge of allBadges) {
          const existing = badgesByStudentMap.get(badge.studentId) || [];
          if (existing.length < 8) {
            existing.push(badge);
            badgesByStudentMap.set(badge.studentId, existing);
          }
        }

        for (const slip of latestHifzSlips) {
          if (!latestSlipByStudentMap.has(slip.studentId)) {
            latestSlipByStudentMap.set(slip.studentId, slip);
          }
        }

        const children = links.map((link) => {
          const student = link.student;
          const attendance = attendanceByStudent.get(student.id);
          const weeklyRecords = weeklyAttendanceByStudent.get(student.id) || [];
          const pointsToday = (pointsTodayByStudent.get(student.id) as number) || 0;
          const studentLogs = pointLogsByStudentMap.get(student.id) || [];
          const studentBadges = badgesByStudentMap.get(student.id) || [];
          const latestSlip = latestSlipByStudentMap.get(student.id) || null;

          const daysPresentLast7 = weeklyRecords.filter((r) => r.checkInTime || r.status === "PRESENT").length;

          return {
            id: student.userId,
            studentProfileId: student.id,
            firstName: student.user?.firstName || "",
            lastName: student.user?.lastName || "",
            email: student.user?.email || "",
            avatarUrl: student.user?.avatarUrl || null,
            its: student.its || student.studentId || "—",
            studentId: student.studentId || "",
            trNo: student.trNo || "",
            grade: student.grade || "Rabea",
            section: student.section || "",
            currentPoints: student.currentPoints || 0,
            tier: student.tier || "BRONZE",
            streakDays: student.streakDays || 0,
            status: student.status || "STUDENT",
            hafizYear: student.hafizYear || null,
            watan: student.watan || "",
            residentCity: student.residentCity || "",
            bloodGroup: student.bloodGroup || "",
            relationship: link.relationship || parentProfile.relationType || "Parent",

            // Attendance details
            isCheckedIn: !!attendance,
            lastCheckIn: attendance?.checkInTime || null,
            checkOutTime: (attendance as any)?.checkOutTime || null,
            gate: (attendance as any)?.gate || "Main Gate",
            daysPresentLast7,
            attendanceRateLast7: Math.round((daysPresentLast7 / 7) * 100),

            // Points
            pointsToday,
            recentActivity: studentLogs.map((r) => ({
              id: r.id,
              type: "POINTS" as const,
              category: r.category,
              points: r.points,
              title: `${r.points > 0 ? "+" : ""}${r.points} ${r.category} Points`,
              detail: r.note || `Awarded by ${r.teacher?.user?.firstName || "Teacher"} ${r.teacher?.user?.lastName || ""}`,
              teacherName: r.teacher?.user ? `${r.teacher.user.firstName} ${r.teacher.user.lastName}` : "Faculty",
              createdAt: r.createdAt,
            })),

            // Badges
            recentBadges: studentBadges.map((b) => ({
              name: b.badge.name,
              tier: b.badge.tier,
              category: b.badge.category,
              earnedAt: b.earnedAt,
            })),

            // Latest Hifz Progress
            latestHifzSlip: latestSlip
              ? {
                  weekNumber: latestSlip.weekNumber,
                  academicYear: latestSlip.academicYear,
                  currentJuz: latestSlip.currentJuz,
                  currentSafah: latestSlip.currentSafah,
                  sabaqLines: latestSlip.sabaqLines,
                  totalMarks: latestSlip.totalMarks,
                  overallPerformance: latestSlip.overallPerformance,
                  disciplineRating: latestSlip.disciplineRating,
                  teacherNotes: latestSlip.teacherNotes,
                  murajaatSabqi: latestSlip.murajaatSabqi,
                  muhaffizName: latestSlip.faculty?.user
                    ? `${latestSlip.faculty.user.firstName} ${latestSlip.faculty.user.lastName}`
                    : "Muhaffiz",
                  publishedAt: latestSlip.publishedAt,
                }
              : null,
          };
        });

        return {
          parent: {
            id: parentProfile.id,
            userId: parentProfile.userId,
            firstName: parentProfile.user?.firstName || "",
            lastName: parentProfile.user?.lastName || "",
            email: parentProfile.user?.email || "",
            phone: parentProfile.phone,
            secondaryPhone: parentProfile.secondaryPhone,
            relationType: parentProfile.relationType,
            its: parentProfile.its,
          },
          children,
        };
      },
      {
        ttl: 10_000, // 10 seconds cache
        tags: ["dashboard", "studentprofile", "pointlog", "attendancerecord", "hifzweeklyslip"],
      },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Parent dashboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch dashboard" });
  }
});

export default router;
