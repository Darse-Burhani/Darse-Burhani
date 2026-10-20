import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireRole } from "../../middleware";
import { isRabiAlAkhirDate } from "../../lib/fatimi-calendar";
import { getISTDetails, eventRangeForRole } from "../../lib/biometric";

const router = Router();

router.get("/", requireRole("PARENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    let parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    if (!parentProfile && (session.user.role === "ADMIN" || session.user.role === "TEACHER")) {
      const targetParentId = (req.query.parentId as string) || (req.query.parent as string);
      parentProfile = await prisma.parentProfile.findFirst({
        where: targetParentId ? { OR: [{ id: targetParentId }, { userId: targetParentId }] } : undefined,
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      });
    }

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const effectiveUserId = parentProfile.userId;

    const data = await cache.getOrSet(
      `parent:dashboard:${effectiveUserId}`,
      async () => {
        const links = await prisma.parentStudentLink.findMany({
          where: { parentId: parentProfile.id },
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                classEnrollments: {
                  where: { class: { academicYear: "1448 H", grade: { in: ["1", "2", "3", "4"] } } },
                  include: {
                    class: {
                      include: {
                        masool: {
                          include: {
                            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                          },
                        },
                      },
                    },
                  },
                },
                talabatProfile1447: {
                  select: {
                    id: true,
                    status: true,
                    studentPhotoUrl: true,
                    fatherPhotoUrl: true,
                    motherPhotoUrl: true,
                  },
                },
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

        // Date calculations (UTC normalized)
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const tonight = new Date(today.getTime() + 86400000);
        const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

        const studentUserIds = links.map((l) => l.student.userId);
        const studentTrOrIts = links
          .flatMap((l) => [l.student.studentId, l.student.its, l.student.trNo])
          .filter(Boolean) as string[];

        const allStudentLoanIds = Array.from(
          new Set([...studentProfileIds, ...studentUserIds, ...studentTrOrIts])
        );

        const [
          todayAttendanceRecords,
          todayAttendanceRegistries,
          weeklyAttendanceRecords,
          todayHifzEvaluations,
          pointAggregations,
          allPointLogs,
          allBadges,
          latestHifzSlips,
          allBookLoans,
          scanWindows,
        ] = await Promise.all([
          // 1. Today's class attendance records
          prisma.attendanceRecord.findMany({
            where: {
              studentId: { in: studentProfileIds },
              date: { gte: today, lt: tonight },
            },
            include: { class: { select: { id: true, name: true } } },
            orderBy: { checkInTime: "desc" },
          }),
          // 1b. Today's Master Attendance Registry (Biometric punches)
          prisma.attendanceRegistry.findMany({
            where: {
              studentId: { in: studentProfileIds },
              date: { gte: today, lt: tonight },
            },
            orderBy: { checkInTime: "desc" },
          }),
          // 2. Past 7 days attendance records
          prisma.attendanceRecord.findMany({
            where: {
              studentId: { in: studentProfileIds },
              date: { gte: sevenDaysAgo, lt: tonight },
            },
            include: { class: { select: { id: true, name: true } } },
            orderBy: { date: "desc" },
          }),
          // 2b. Today's Daily Hifz Evaluation
          prisma.hifzDailyEvaluation.findMany({
            where: {
              studentId: { in: studentProfileIds },
              evaluationDate: today,
            },
            include: {
              faculty: { include: { user: { select: { firstName: true, lastName: true } } } },
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
          // 7. Recent book loans for all children
          prisma.bookLoan.findMany({
            where: { studentId: { in: allStudentLoanIds } },
            orderBy: { borrowedAt: "desc" },
            take: studentProfileIds.length * 10,
            include: { book: true },
          }),
          // 8. Scheduled scan windows
          prisma.biometricScanWindow.findMany({
            where: { enabled: true },
            orderBy: { startTime: "asc" },
          }),
        ]);

        // Group attendance by student (excluding Rabi ul Akhar without deleting from DB)
        const nonRabiTodayRegistries = todayAttendanceRegistries.filter((r) => !isRabiAlAkhirDate(r.date));
        const nonRabiTodayRecords = todayAttendanceRecords.filter((a) => !isRabiAlAkhirDate(a.date));
        const nonRabiWeeklyRecords = weeklyAttendanceRecords.filter((r) => !isRabiAlAkhirDate(r.date));

        const registryByStudent = new Map(nonRabiTodayRegistries.map((r) => [r.studentId, r]));
        const attendanceByStudent = new Map(nonRabiTodayRecords.map((a) => [a.studentId, a]));
        const hifzEvalByStudent = new Map(todayHifzEvaluations.map((h) => [h.studentId, h]));

        // Group 7-day attendance count excluding Rabi ul Akhar
        const weeklyAttendanceByStudent = new Map<string, typeof weeklyAttendanceRecords>();
        for (const rec of nonRabiWeeklyRecords) {
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
          const registry = registryByStudent.get(student.id);
          const attendance = attendanceByStudent.get(student.id);
          const hifzEval = hifzEvalByStudent.get(student.id);
          const weeklyRecords = weeklyAttendanceByStudent.get(student.id) || [];
          const pointsToday = (pointsTodayByStudent.get(student.id) as number) || 0;
          const studentLogs = pointLogsByStudentMap.get(student.id) || [];
          const studentBadges = badgesByStudentMap.get(student.id) || [];
          const latestSlip = latestSlipByStudentMap.get(student.id) || null;

          const daysPresentLast7 = weeklyRecords.filter((r) => r.checkInTime || r.status === "PRESENT").length;
          
          // Determine active check-in status
          const checkInTime = registry?.checkInTime || attendance?.checkInTime || null;
          const isCheckedIn = !!checkInTime || (registry?.status === "PRESENT" || attendance?.status === "PRESENT");
          const attendanceStatus = registry?.status || attendance?.status || (isCheckedIn ? "PRESENT" : "ABSENT");

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

            // Academic Class & Masool
            academicClass: student.classEnrollments?.[0]?.class
              ? {
                  id: student.classEnrollments[0].class.id,
                  name: student.classEnrollments[0].class.name,
                  grade: student.classEnrollments[0].class.grade,
                  section: student.classEnrollments[0].class.section,
                  masoolName: student.classEnrollments[0].class.masool?.user
                    ? `${student.classEnrollments[0].class.masool.user.firstName} ${student.classEnrollments[0].class.masool.user.lastName}`
                    : null,
                  masoolIts: student.classEnrollments[0].class.masool?.its || null,
                  masoolEmail: student.classEnrollments[0].class.masool?.user?.email || null,
                  masoolAvatar: student.classEnrollments[0].class.masool?.user?.avatarUrl || null,
                }
              : null,

            // Attendance details
            isCheckedIn,
            attendanceStatus,
            lastCheckIn: checkInTime,
            checkOutTime: (registry as any)?.checkOutTime || (attendance as any)?.checkOutTime || null,
            gate: (registry as any)?.gate || (attendance as any)?.gate || "Main Gate MinMoe",
            method: (registry as any)?.method || (attendance as any)?.method || "BIOMETRIC",
            daysPresentLast7,
            attendanceRateLast7: Math.round((daysPresentLast7 / 7) * 100),

            // Yearly Profile & Parent Photo Status (1447 H)
            yearlyProfile: student.talabatProfile1447
              ? {
                  id: student.talabatProfile1447.id,
                  status: student.talabatProfile1447.status,
                  studentPhotoUrl: student.talabatProfile1447.studentPhotoUrl || student.user?.avatarUrl || null,
                  fatherPhotoUrl: student.talabatProfile1447.fatherPhotoUrl,
                  motherPhotoUrl: student.talabatProfile1447.motherPhotoUrl,
                  hasStudentPhoto: !!(student.talabatProfile1447.studentPhotoUrl || student.user?.avatarUrl),
                  hasFatherPhoto: !!student.talabatProfile1447.fatherPhotoUrl,
                  hasMotherPhoto: !!student.talabatProfile1447.motherPhotoUrl,
                  isComplete: !!(
                    (student.talabatProfile1447.studentPhotoUrl || student.user?.avatarUrl) &&
                    student.talabatProfile1447.fatherPhotoUrl &&
                    student.talabatProfile1447.motherPhotoUrl
                  ),
                }
              : null,

            // Today's Daily Hifz Evaluation
            todayHifzEvaluation: hifzEval
              ? {
                  sabaqSurah: hifzEval.sabaqSurah,
                  sabaqLines: hifzEval.sabaqLines,
                  sabaqMarks: hifzEval.sabaqMarks,
                  sabqiJuz: hifzEval.sabqiJuz,
                  sabqiMarks: hifzEval.sabqiMarks,
                  murajaatJuz: hifzEval.murajaatJuz,
                  murajaatMarks: hifzEval.murajaatMarks,
                  totalMarks: hifzEval.totalMarks,
                  performanceRating: hifzEval.performanceRating,
                  teacherRemarks: hifzEval.teacherRemarks,
                  muhaffizName: hifzEval.faculty?.user
                    ? `${hifzEval.faculty.user.firstName} ${hifzEval.faculty.user.lastName}`
                    : "Muhaffiz",
                }
              : null,

            // Points
            pointsToday,
            recentActivity: (() => {
              const studentLoans = allBookLoans.filter(
                (l) =>
                  l.studentId === student.id ||
                  l.studentId === student.userId ||
                  l.studentId === student.studentId ||
                  l.studentId === student.its ||
                  l.studentId === student.trNo
              );

              const studentAtt = weeklyRecords.slice(0, 10);

              const combined = [
                ...studentLogs.map((r) => ({
                  id: `point-${r.id}`,
                  type: "POINTS" as const,
                  category: r.category,
                  points: r.points,
                  title: `${r.points > 0 ? "+" : ""}${r.points} ${r.category} Points`,
                  detail: r.note || `Awarded by ${r.teacher?.user?.firstName || "Teacher"} ${r.teacher?.user?.lastName || ""}`,
                  teacherName: r.teacher?.user ? `${r.teacher.user.firstName} ${r.teacher.user.lastName}` : "Faculty",
                  createdAt: r.createdAt,
                })),
                ...studentLoans.map((loan) => {
                  const dueFormatted = new Date(loan.dueAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  });
                  return {
                    id: `loan-${loan.id}`,
                    type: "LIBRARY" as const,
                    category: "Library",
                    points: 0,
                    title: `Library Book Issue: ${loan.bookTitle}`,
                    detail: `Barcode: ${loan.bookBarcode || loan.book?.barcode || "—"} • Due: ${dueFormatted} • Status: ${loan.status}`,
                    teacherName: "Maktabat",
                    createdAt: loan.borrowedAt,
                  };
                }),
                ...studentAtt.map((att) => {
                  const scanTimestamp = att.checkInTime || att.date;
                  const { scanMinutes, timeFormatted12 } = getISTDetails(new Date(scanTimestamp));

                  const matchedWindow = scanWindows.find((w) => {
                    const r = eventRangeForRole(w as any, "STUDENT");
                    return r && r.enabled && scanMinutes >= r.startMin && scanMinutes <= r.lateMin;
                  });

                  const eventName = matchedWindow?.name || (att as any).class?.name || "Tilawat al Dua";
                  const method = (att as any).biometricMethod || (att as any).verificationMethod || "Biometric";

                  return {
                    id: `att-${att.id || att.date}`,
                    type: "ATTENDANCE" as const,
                    category: "Attendance",
                    points: 0,
                    title: `${eventName}: ${att.status}`,
                    detail: att.checkInTime
                      ? `Verified at ${timeFormatted12} IST via ${method} (${eventName})`
                      : `Logged as ${att.status} for ${eventName}`,
                    teacherName: eventName,
                    createdAt: att.checkInTime || att.date,
                  };
                }),
              ];

              return combined
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10);
            })(),

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
        ttl: 5_000, // 5s cache for real-time live attendance updates
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
