import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";
import { cache } from "../../lib/cache";

const router = Router();

router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const data = await cache.getOrSet(
      `teacher:dashboard:${session.user.id}`,
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 86400000);

        const [classes, attendanceCountToday, pointsToday, enrollments, recentPointLogs] = await Promise.all([
          prisma.class.findMany({
            where: { teacherId: teacherProfile.id, isActive: true },
            select: {
              id: true,
              name: true,
              grade: true,
              section: true,
              subject: true,
              roomNumber: true,
              _count: { select: { enrollments: true } },
            },
          }),
          prisma.attendanceRecord.count({
            where: {
              class: { teacherId: teacherProfile.id, isActive: true },
              date: { gte: today, lt: tomorrow },
              status: "PRESENT",
            },
          }),
          prisma.pointLog.aggregate({
            where: { teacherId: teacherProfile.id, createdAt: { gte: today, lt: tomorrow } },
            _sum: { points: true },
            _count: true,
          }),
          prisma.classEnrollment.findMany({
            where: { class: { teacherId: teacherProfile.id, isActive: true }, isActive: true },
            select: {
              studentId: true,
              classId: true,
              class: { select: { id: true, name: true, grade: true, section: true } },
            },
          }),
          prisma.pointLog.findMany({
            where: { teacherId: teacherProfile.id },
            orderBy: { createdAt: "desc" },
            take: 12,
            include: {
              student: {
                select: {
                  id: true,
                  userId: true,
                  user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                },
              },
            },
          }),
        ]);

        const uniqueStudentProfileIds = Array.from(new Set(enrollments.map((e) => e.studentId)));

        // Fetch student profiles and today's attendance for those students
        const [studentProfiles, todayAttendanceRecords] = await Promise.all([
          uniqueStudentProfileIds.length
            ? prisma.studentProfile.findMany({
                where: { id: { in: uniqueStudentProfileIds } },
                select: {
                  id: true,
                  userId: true,
                  currentPoints: true,
                  tier: true,
                  streakDays: true,
                  its: true,
                  studentId: true,
                  grade: true,
                  section: true,
                  status: true,
                  user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
                },
              })
            : [],
          uniqueStudentProfileIds.length
            ? prisma.attendanceRecord.findMany({
                where: {
                  studentId: { in: uniqueStudentProfileIds },
                  date: { gte: today, lt: tomorrow },
                },
                select: { studentId: true, status: true, checkInTime: true },
                distinct: ["studentId"],
              })
            : [],
        ]);

        const attendanceMap = new Map(todayAttendanceRecords.map((a) => [a.studentId, a]));

        // Group classIds per student
        const classMap = new Map<string, string[]>();
        for (const e of enrollments) {
          const list = classMap.get(e.studentId) || [];
          list.push(e.classId);
          classMap.set(e.studentId, list);
        }

        const totalStudentsInClass = classes.reduce((sum, c) => sum + c._count.enrollments, 0);

        return {
          teacher: {
            id: teacherProfile.id,
            userId: teacherProfile.userId,
            firstName: teacherProfile.user?.firstName || "",
            lastName: teacherProfile.user?.lastName || "",
            email: teacherProfile.user?.email || "",
            avatarUrl: teacherProfile.photoUrl || teacherProfile.user?.avatarUrl || null,
            department: teacherProfile.department,
            employeeId: teacherProfile.employeeId,
            its: teacherProfile.its,
            khidmatMauze: teacherProfile.khidmatMauze,
          },
          portfolioEnabled: Boolean(teacherProfile.portfolioEnabled),
          classes: classes.map((c) => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            section: c.section,
            subject: c.subject,
            roomNumber: c.roomNumber,
            studentCount: c._count.enrollments,
          })),
          stats: {
            totalStudents: totalStudentsInClass,
            presentToday: attendanceCountToday,
            pointsToday: pointsToday._sum.points || 0,
            awardsCountToday: pointsToday._count || 0,
          },
          students: studentProfiles.map((s) => {
            const att = attendanceMap.get(s.id);
            return {
              id: s.userId,
              studentProfileId: s.id,
              firstName: s.user?.firstName || "",
              lastName: s.user?.lastName || "",
              avatarUrl: s.user?.avatarUrl || null,
              email: s.user?.email || "",
              its: s.its || s.studentId || "—",
              grade: s.grade,
              section: s.section,
              status: s.status,
              currentPoints: s.currentPoints || 0,
              tier: s.tier || "BRONZE",
              streakDays: s.streakDays || 0,
              classIds: classMap.get(s.id) || [],
              isCheckedIn: Boolean(att?.status === "PRESENT" || att?.checkInTime),
              lastCheckIn: att?.checkInTime || null,
            };
          }),
          recentActivity: recentPointLogs.map((p) => ({
            id: p.id,
            category: p.category,
            points: p.points,
            note: p.note,
            createdAt: p.createdAt,
            studentName: `${p.student?.user?.firstName || ""} ${p.student?.user?.lastName || ""}`,
            studentAvatar: p.student?.user?.avatarUrl || null,
          })),
        };
      },
      {
        ttl: 10_000, // 10 seconds cache
        tags: ["dashboard", "class", "studentprofile", "pointlog", "attendancerecord"],
      },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Teacher dashboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch dashboard" });
  }
});

export default router;
