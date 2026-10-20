import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/parent/timetable - Get timetable and masool for a linked child
router.get("/", requireRole("PARENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    let parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        studentLinks: {
          select: { studentId: true },
        },
      },
    });

    if (!parentProfile && (session.user.role === "ADMIN" || session.user.role === "TEACHER")) {
      const targetParentId = (req.query.parentId as string) || (req.query.parent as string);
      parentProfile = await prisma.parentProfile.findFirst({
        where: targetParentId ? { OR: [{ id: targetParentId }, { userId: targetParentId }] } : undefined,
        include: {
          studentLinks: { select: { studentId: true } },
        },
      });
    }

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const linkedStudentIds = parentProfile.studentLinks.map((l) => l.studentId);
    if (linkedStudentIds.length === 0) {
      return res.json({
        success: true,
        data: {
          hasLinkedChildren: false,
          children: [],
          currentChild: null,
          class: null,
          masool: null,
          slots: [],
        },
      });
    }

    // Determine target child
    const requestedStudentId = req.query.studentId as string | undefined;
    const targetStudentId = (requestedStudentId && linkedStudentIds.includes(requestedStudentId))
      ? requestedStudentId
      : linkedStudentIds[0];

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { id: targetStudentId },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        classEnrollments: {
          where: {
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
                    user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Child profile not found" });
    }

    let activeClass: any = studentProfile.classEnrollments?.[0]?.class || null;

    // Fallback if enrollment was missing
    if (!activeClass) {
      const gradeNum = studentProfile.grade.replace(/[^0-9]/g, "") || "1";
      const secLetter = (studentProfile.section || "A").trim().toUpperCase();
      activeClass = await prisma.class.findFirst({
        where: {
          grade: gradeNum,
          section: secLetter,
          academicYear: "1448 H",
        },
        include: {
          masool: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
            },
          },
        },
      });
    }

    // Fetch timetable slots for this class
    let slots: any[] = [];
    let badals: any[] = [];

    if (activeClass) {
      slots = await prisma.timetableSlot.findMany({
        where: {
          OR: [
            { classId: activeClass.id },
            { className: activeClass.name },
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

      const now = new Date();
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const nextDay = new Date(startOfDay.getTime() + 86400000);

      badals = await prisma.timetableBadal.findMany({
        where: {
          classId: activeClass.id,
          date: { gte: startOfDay, lt: nextDay },
        },
        include: {
          badalTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      });
    }

    // Current day of week in IST (Monday=1, ..., Saturday=6, Sunday=7)
    const now = new Date();
    const istDayStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
    const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const todayDow = dowMap[istDayStr] || 1;

    // Filter today's slots
    const todaySlots = slots.filter((s) => s.dayOfWeek === todayDow);

    // List of all linked children for the child selector tabs
    const allLinkedChildren = await prisma.studentProfile.findMany({
      where: { id: { in: linkedStudentIds } },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    return res.json({
      success: true,
      data: {
        hasLinkedChildren: true,
        children: allLinkedChildren.map((c) => ({
          id: c.id,
          name: `${c.user.firstName} ${c.user.lastName}`,
          grade: c.grade,
          section: c.section,
          its: c.its || c.studentId,
          avatarUrl: c.user.avatarUrl,
          isSelected: c.id === studentProfile.id,
        })),
        currentChild: {
          id: studentProfile.id,
          name: `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
          grade: studentProfile.grade,
          section: studentProfile.section,
          its: studentProfile.its || studentProfile.studentId,
          avatarUrl: studentProfile.user.avatarUrl,
        },
        class: activeClass
          ? {
              id: activeClass.id,
              name: activeClass.name,
              grade: activeClass.grade,
              section: activeClass.section,
              subject: activeClass.subject,
              roomNumber: activeClass.roomNumber || `Room ${activeClass.name}`,
              academicYear: activeClass.academicYear,
            }
          : null,
        masool: activeClass?.masool
          ? {
              id: activeClass.masool.id,
              name: activeClass.masool.user
                ? `${activeClass.masool.user.firstName} ${activeClass.masool.user.lastName}`
                : "Masool",
              email: activeClass.masool.user?.email || null,
              avatarUrl: activeClass.masool.user?.avatarUrl || null,
              its: activeClass.masool.its || null,
              department: activeClass.masool.department || "Attalimiyah",
            }
          : null,
        todayDayOfWeek: todayDow,
        isWeekend: todayDow === 7,
        todaySlots: todaySlots.map((s) => ({
          id: s.id,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject,
          roomNumber: s.roomNumber,
          teacherName: s.teacher?.user
            ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}`
            : (s.teacherName || "TBA"),
          teacherAvatar: s.teacher?.user?.avatarUrl || null,
        })),
        slots: slots.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject,
          roomNumber: s.roomNumber,
          teacherName: s.teacher?.user
            ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}`
            : (s.teacherName || "TBA"),
          teacherAvatar: s.teacher?.user?.avatarUrl || null,
        })),
        badals: badals.map((b) => ({
          id: b.id,
          period: b.period,
          subject: b.subject,
          substituteTeacher: b.badalTeacher?.user
            ? `${b.badalTeacher.user.firstName} ${b.badalTeacher.user.lastName}`
            : (b.badalTeacherName || "Covering Teacher"),
        })),
      },
    });
  } catch (error) {
    console.error("Parent timetable error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch parent timetable" });
  }
});

export default router;
