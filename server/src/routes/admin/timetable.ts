import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/admin/timetable - Full matrix with optional filtering
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const { classId, className, teacherId, dayOfWeek } = req.query as Record<string, string | undefined>;

    const where: any = {};
    if (classId) where.classId = classId;
    if (className) where.className = className;
    if (teacherId) where.teacherId = teacherId;
    if (dayOfWeek !== undefined && dayOfWeek !== "") where.dayOfWeek = parseInt(dayOfWeek, 10);

    const [slots, classes, teachers] = await Promise.all([
      prisma.timetableSlot.findMany({
        where,
        include: {
          class: {
            select: {
              id: true,
              name: true,
              grade: true,
              section: true,
              subject: true,
            },
          },
          teacher: {
            select: {
              id: true,
              its: true,
              employeeId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }, { className: "asc" }],
      }),
      prisma.class.findMany({
        where: { isActive: true, academicYear: "1448 H", grade: { in: ["1", "2", "3", "4"] } },
        include: {
          masool: {
            include: { user: true },
          },
          _count: {
            select: { enrollments: true, timetableSlots: true },
          },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }],
      }),
      prisma.teacherProfile.findMany({
        where: {
          user: { isActive: true, deletedAt: null },
          timetableSlots: { some: {} },
        },
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
          _count: { select: { timetableSlots: true } },
        },
        orderBy: [{ user: { firstName: "asc" } }],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        slots: slots.map((s) => ({
          id: s.id,
          classId: s.classId,
          className: s.className || s.class?.name || "Class",
          classGrade: s.class?.grade || "",
          classSection: s.class?.section || "",
          teacherId: s.teacherId,
          teacherName: s.teacherName || (s.teacher ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}` : "TBA"),
          teacherAvatar: s.teacher?.user.avatarUrl || null,
          teacherIts: s.teacher?.its || null,
          subject: s.subject,
          dayOfWeek: s.dayOfWeek,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          roomNumber: s.roomNumber,
          isBreak: s.isBreak,
          breakName: s.breakName,
        })),
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          subject: c.subject,
          masoolName: c.masool ? `${c.masool.user.firstName} ${c.masool.user.lastName}` : "TBA",
          masoolIts: c.masool?.its || null,
          studentCount: c._count.enrollments,
          slotCount: c._count.timetableSlots,
        })),
        teachers: teachers.map((t) => ({
          id: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`,
          email: t.user.email,
          its: t.its,
          avatarUrl: t.user.avatarUrl,
          weeklyPeriods: t._count.timetableSlots,
        })),
      },
    });
  } catch (error) {
    console.error("Timetable fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch timetable" });
  }
});

// ── BADAL (SUBSTITUTION) MANAGEMENT ENDPOINTS ──

// GET /api/admin/timetable/badal - List badal records
router.get("/badal", requireRole("ADMIN"), async (req, res) => {
  try {
    const { date, status } = req.query as Record<string, string | undefined>;
    const targetDate = date ? new Date(`${date}T00:00:00.000Z`) : undefined;

    const where: any = {};
    if (targetDate) {
      const nextDay = new Date(targetDate.getTime() + 86400000);
      where.date = { gte: targetDate, lt: nextDay };
    }
    if (status && status !== "ALL") {
      where.status = status;
    }

    const badals = await prisma.timetableBadal.findMany({
      where,
      include: {
        originalTeacher: {
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        },
        badalTeacher: {
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        },
        slot: true,
      },
      orderBy: [{ date: "desc" }, { period: "asc" }],
    });

    return res.json({
      success: true,
      data: badals.map((b) => ({
        id: b.id,
        date: b.date.toISOString().split("T")[0],
        slotId: b.slotId,
        classId: b.classId,
        className: b.className,
        period: b.period,
        startTime: b.startTime,
        endTime: b.endTime,
        subject: b.subject,
        originalTeacherId: b.originalTeacherId,
        originalTeacherName: b.originalTeacherName || (b.originalTeacher ? `${b.originalTeacher.user.firstName} ${b.originalTeacher.user.lastName}` : "Original Teacher"),
        originalTeacherAvatar: b.originalTeacher?.user.avatarUrl || null,
        badalTeacherId: b.badalTeacherId,
        badalTeacherName: b.badalTeacherName || (b.badalTeacher ? `${b.badalTeacher.user.firstName} ${b.badalTeacher.user.lastName}` : "Pending Assignment"),
        badalTeacherAvatar: b.badalTeacher?.user.avatarUrl || null,
        reason: b.reason,
        status: b.status,
        instructions: b.instructions,
        isFulfilled: b.isFulfilled,
        notes: b.notes,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error("Badal fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch badal records" });
  }
});

// GET /api/admin/timetable/badal/available-teachers - Intelligent Free Teacher Finder
router.get("/badal/available-teachers", requireRole("ADMIN"), async (req, res) => {
  try {
    const { dayOfWeek, period, date } = req.query as Record<string, string | undefined>;
    if (!dayOfWeek || !period) {
      return res.status(400).json({ success: false, error: "dayOfWeek and period are required" });
    }

    const dow = parseInt(dayOfWeek, 10);
    const p = parseInt(period, 10);
    const targetDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // 1. Find all teachers busy teaching in this period on this day
    const busySlots = await prisma.timetableSlot.findMany({
      where: {
        dayOfWeek: dow,
        period: p,
        teacherId: { not: null },
      },
      select: { teacherId: true },
    });
    const busyTeacherIds = new Set(busySlots.map((s) => s.teacherId!));

    // 2. Find teachers already assigned as Badal in this period on this date
    const busyBadals = await prisma.timetableBadal.findMany({
      where: {
        date: { gte: startOfDay, lt: endOfDay },
        period: p,
        status: { in: ["ASSIGNED", "CONFIRMED"] },
        badalTeacherId: { not: null },
      },
      select: { badalTeacherId: true },
    });
    for (const b of busyBadals) {
      if (b.badalTeacherId) busyTeacherIds.add(b.badalTeacherId);
    }

    // 3. Find all active teachers who are FREE
    const allTeachers = await prisma.teacherProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
        id: { notIn: Array.from(busyTeacherIds) },
      },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
        _count: { select: { substituteBadals: true } },
      },
      orderBy: [{ substituteBadals: { _count: "asc" } }, { user: { firstName: "asc" } }],
    });

    return res.json({
      success: true,
      data: allTeachers.map((t) => ({
        id: t.id,
        name: `${t.user.firstName} ${t.user.lastName}`,
        email: t.user.email,
        its: t.its,
        avatarUrl: t.user.avatarUrl,
        badalCount: t._count.substituteBadals,
        isFree: true,
      })),
    });
  } catch (error) {
    console.error("Available teachers error:", error);
    return res.status(500).json({ success: false, error: "Failed to find available teachers" });
  }
});

// POST /api/admin/timetable/badal - Create Badal assignment
router.post("/badal", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const {
      date,
      slotId,
      classId,
      className,
      period,
      startTime,
      endTime,
      subject,
      originalTeacherId,
      originalTeacherName,
      badalTeacherId,
      badalTeacherName,
      reason,
      instructions,
      notes,
    } = req.body;

    if (!date || !className || period === undefined || !subject) {
      return res.status(400).json({ success: false, error: "Missing required fields (date, className, period, subject)" });
    }

    const dateObj = new Date(`${date}T00:00:00.000Z`);

    const badal = await prisma.timetableBadal.create({
      data: {
        date: dateObj,
        slotId: slotId || null,
        classId: classId || null,
        className,
        period: Number(period),
        startTime: startTime || "10:30",
        endTime: endTime || "11:00",
        subject,
        originalTeacherId: originalTeacherId || null,
        originalTeacherName: originalTeacherName || null,
        badalTeacherId: badalTeacherId || null,
        badalTeacherName: badalTeacherName || null,
        reason: reason || "Unplanned Absence / Leave",
        status: badalTeacherId ? "ASSIGNED" : "PENDING",
        instructions: instructions || null,
        notes: notes || null,
        assignedById: session.user.id,
      },
      include: {
        originalTeacher: { include: { user: true } },
        badalTeacher: { include: { user: true } },
      },
    });

    return res.json({ success: true, data: badal });
  } catch (error) {
    console.error("Create badal error:", error);
    return res.status(500).json({ success: false, error: "Failed to create badal assignment" });
  }
});

// PUT /api/admin/timetable/badal/:id - Update badal status / fulfillment
router.put("/badal/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isFulfilled, badalTeacherId, badalTeacherName, instructions, notes } = req.body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (isFulfilled !== undefined) data.isFulfilled = isFulfilled;
    if (badalTeacherId !== undefined) data.badalTeacherId = badalTeacherId;
    if (badalTeacherName !== undefined) data.badalTeacherName = badalTeacherName;
    if (instructions !== undefined) data.instructions = instructions;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.timetableBadal.update({
      where: { id },
      data,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update badal error:", error);
    return res.status(500).json({ success: false, error: "Failed to update badal assignment" });
  }
});

// DELETE /api/admin/timetable/badal/:id - Cancel/remove badal assignment
router.delete("/badal/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.timetableBadal.delete({ where: { id } });
    return res.json({ success: true, message: "Badal assignment deleted successfully" });
  } catch (error) {
    console.error("Delete badal error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete badal assignment" });
  }
});

export default router;
