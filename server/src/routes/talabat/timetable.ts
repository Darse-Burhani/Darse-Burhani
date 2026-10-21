import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { getRecentTimetableChanges, isSlotRecentlyChanged } from "../../lib/timetable-notify";

const router = Router();

// GET /api/talabat/timetable - Class timetable, masool, teachers and today's schedule
router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        grade: true,
        section: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    // 1. Identify active 1448 H class
    let enrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId: studentProfile.id,
        class: {
          academicYear: "1448 H",
          grade: { in: ["1", "2", "3", "4"] },
        },
      },
      include: {
        class: {
          include: {
            masool: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
              },
            },
          },
        },
      },
    });

    let currentClass: any = enrollment?.class;

    // Fallback if enrollment was missing
    if (!currentClass) {
      const gradeNum = studentProfile.grade.replace(/[^0-9]/g, "") || "1";
      const secLetter = (studentProfile.section || "A").trim().toUpperCase();
      currentClass = await prisma.class.findFirst({
        where: {
          grade: gradeNum,
          section: secLetter,
          academicYear: "1448 H",
        },
        include: {
          masool: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
            },
          },
        },
      });
    }

    if (!currentClass) {
      return res.status(404).json({
        success: false,
        error: `No academic class found for Grade ${studentProfile.grade} Section ${studentProfile.section}`,
      });
    }

    // 2. Fetch all 30 timetable slots for this class
    const slots = await prisma.timetableSlot.findMany({
      where: {
        OR: [
          { classId: currentClass.id },
          { className: currentClass.name },
        ],
      },
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });

    // 3. Fetch today's Badal (substitute) assignments for this class
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const nextDay = new Date(startOfDay.getTime() + 86400000);

    const badals = await prisma.timetableBadal.findMany({
      where: {
        classId: currentClass.id,
        date: { gte: startOfDay, lt: nextDay },
      },
      include: {
        originalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        badalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
      orderBy: { period: "asc" },
    });

    // Badal Map: period -> badal record
    const badalByPeriod = new Map<number, any>();
    badals.forEach((b) => badalByPeriod.set(b.period, b));

    // 4. Calculate today's day of week in IST (1 = Monday, 6 = Saturday, 0/7 = Sunday)
    const istParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
    const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const todayDow = dayMap[istParts] || 1;

    const formattedSlots = slots.map((s) => {
      const badal = s.dayOfWeek === todayDow ? badalByPeriod.get(s.period) : null;
      const changeInfo = isSlotRecentlyChanged(s);
      const updatedAtTime = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
      const createdAtTime = s.createdAt ? new Date(s.createdAt).getTime() : 0;
      const isRecentByDate = Boolean(
        updatedAtTime &&
        Date.now() - updatedAtTime < 3 * 24 * 60 * 60 * 1000 &&
        updatedAtTime - createdAtTime > 5000
      );
      const isRecent = Boolean(changeInfo || isRecentByDate);

      return {
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        period: s.period,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        roomNumber: s.roomNumber || `Room ${currentClass.name}`,
        teacherId: s.teacherId,
        teacherName: s.teacher ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}` : s.teacherName,
        teacherAvatar: s.teacher?.user.avatarUrl || null,
        teacherIts: s.teacher?.its || null,
        updatedAt: s.updatedAt,
        isRecentlyChanged: isRecent,
        changeDescription: changeInfo?.changeDescription || (isRecent ? `Recently updated: ${s.subject}` : null),
        badal: badal
          ? {
              id: badal.id,
              badalTeacherName: badal.badalTeacher ? `${badal.badalTeacher.user.firstName} ${badal.badalTeacher.user.lastName}` : badal.badalTeacherName,
              badalTeacherAvatar: badal.badalTeacher?.user.avatarUrl || null,
              reason: badal.reason,
              instructions: badal.instructions,
              status: badal.status,
            }
          : null,
      };
    });

    // 5. Subject Teachers Breakdown
    const teacherMap = new Map<string, { id: string; name: string; its: string | null; avatarUrl: string | null; email: string | null; subjects: Set<string>; periodsCount: number }>();

    for (const s of formattedSlots) {
      if (!s.teacherName) continue;
      const key = s.teacherId || s.teacherName;
      if (!teacherMap.has(key)) {
        teacherMap.set(key, {
          id: s.teacherId || "",
          name: s.teacherName,
          its: s.teacherIts,
          avatarUrl: s.teacherAvatar,
          email: null,
          subjects: new Set<string>(),
          periodsCount: 0,
        });
      }
      const entry = teacherMap.get(key)!;
      entry.subjects.add(s.subject);
      entry.periodsCount++;
    }

    const subjectTeachers = Array.from(teacherMap.values()).map((t) => ({
      ...t,
      subjects: Array.from(t.subjects),
    }));

    // 6. Today's schedule slots
    const todaySlots = formattedSlots.filter((s) => s.dayOfWeek === todayDow).sort((a, b) => a.period - b.period);

    const classRecentChanges = getRecentTimetableChanges().filter(
      (c) => c.className === currentClass.name || c.classId === currentClass.id || !c.className
    );

    return res.json({
      success: true,
      data: {
        class: {
          id: currentClass.id,
          name: currentClass.name,
          grade: currentClass.grade,
          section: currentClass.section,
          academicYear: currentClass.academicYear,
        },
        masool: currentClass.masool
          ? {
              id: currentClass.masool.id,
              name: `${currentClass.masool.user.firstName} ${currentClass.masool.user.lastName}`,
              its: currentClass.masool.its || null,
              email: currentClass.masool.user.email,
              avatarUrl: currentClass.masool.user.avatarUrl || null,
            }
          : null,
        todayDayOfWeek: todayDow,
        isWeekend: todayDow === 7,
        todaySlots,
        slots: formattedSlots,
        recentChanges: classRecentChanges,
        subjectTeachers,
        badals: badals.map((b) => ({
          period: b.period,
          subject: b.subject,
          originalTeacher: b.originalTeacher ? `${b.originalTeacher.user.firstName} ${b.originalTeacher.user.lastName}` : b.originalTeacherName,
          badalTeacher: b.badalTeacher ? `${b.badalTeacher.user.firstName} ${b.badalTeacher.user.lastName}` : b.badalTeacherName,
          reason: b.reason,
          instructions: b.instructions,
          status: b.status,
        })),
      },
    });
  } catch (error) {
    console.error("Talabat timetable fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch class timetable" });
  }
});

export default router;
