import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { cache } from "../../lib/cache";

const router = Router();

// GET /api/admin/timetable - Full matrix with optional filtering (high performance with memory caching)
router.get("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { classId, className, teacherId, dayOfWeek } = req.query as Record<string, string | undefined>;

    const where: any = {};
    if (classId) where.classId = classId;
    if (className) where.className = className;
    if (teacherId) where.teacherId = teacherId;
    if (dayOfWeek !== undefined && dayOfWeek !== "") {
      const parsed = parseInt(dayOfWeek, 10);
      if (!Number.isNaN(parsed)) where.dayOfWeek = parsed;
    }

    const today = new Date();
    const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
    const endOfToday = new Date(startOfToday.getTime() + 86400000);

    const cacheKey = `admin:timetable:${JSON.stringify(where)}`;
    const data = await cache.getOrSet(
      cacheKey,
      async () => {
        const [slots, classes, teachers, todayBadals] = await Promise.all([
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
                  photoUrl: true,
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
            where: { isActive: true, grade: { in: ["1", "2", "3", "4"] } },
            include: {
              masool: {
                select: {
                  id: true,
                  its: true,
                  photoUrl: true,
                  user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                },
              },
              enrollments: {
                where: { isActive: true },
                include: {
                  student: {
                    select: {
                      id: true,
                      its: true,
                      rollNumber: true,
                      user: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          avatarUrl: true,
                          email: true,
                        },
                      },
                    },
                  },
                },
                orderBy: [{ student: { rollNumber: "asc" } }, { student: { user: { firstName: "asc" } } }],
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
            },
            select: {
              id: true,
              its: true,
              photoUrl: true,
              employeeId: true,
              user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
              _count: { select: { timetableSlots: true } },
            },
            orderBy: [{ timetableSlots: { _count: "desc" } }, { user: { firstName: "asc" } }],
          }),
          prisma.timetableBadal.findMany({
            where: {
              date: { gte: startOfToday, lt: endOfToday },
            },
            include: {
              originalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
              badalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            },
            orderBy: [{ period: "asc" }],
          }),
        ]);

        return {
          slots: slots.map((s) => ({
            id: s.id,
            classId: s.classId,
            className: s.className || s.class?.name || "Class",
            classGrade: s.class?.grade || "",
            classSection: s.class?.section || "",
            teacherId: s.teacherId,
            teacherName: s.teacherName || (s.teacher?.user ? `${s.teacher.user.firstName || ""} ${s.teacher.user.lastName || ""}`.trim() : "TBA"),
            teacherAvatar: s.teacher?.user?.avatarUrl || s.teacher?.photoUrl || null,
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
          classes: classes.map((c: any) => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            section: c.section,
            subject: c.subject,
            masoolName: c.masool?.user ? `${c.masool.user.firstName || ""} ${c.masool.user.lastName || ""}`.trim() : "TBA",
            masoolIts: c.masool?.its || null,
            masoolAvatar: c.masool?.user?.avatarUrl || c.masool?.photoUrl || null,
            masoolId: c.masoolId,
            studentCount: c._count.enrollments,
            slotCount: c._count.timetableSlots,
            talabat: (c.enrollments || []).map((e: any) => ({
              id: e.student.id,
              userId: e.student.user?.id,
              name: `${e.student.user?.firstName || ""} ${e.student.user?.lastName || ""}`.trim(),
              its: e.student.its,
              rollNumber: e.student.rollNumber || null,
              avatarUrl: e.student.user?.avatarUrl || null,
            })),
          })),
          teachers: teachers.map((t) => ({
            id: t.id,
            name: t.user ? `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() : "Teacher",
            email: t.user?.email || "",
            its: t.its,
            avatarUrl: t.user?.avatarUrl || t.photoUrl || null,
            weeklyPeriods: t._count.timetableSlots,
          })),
          todayBadals: todayBadals.map((b) => ({
            id: b.id,
            date: b.date.toISOString().split("T")[0],
            slotId: b.slotId,
            classId: b.classId,
            className: b.className,
            period: b.period,
            subject: b.subject,
            originalTeacherId: b.originalTeacherId,
            originalTeacherName: b.originalTeacherName || (b.originalTeacher?.user ? `${b.originalTeacher.user.firstName} ${b.originalTeacher.user.lastName}` : "TBA"),
            originalTeacherAvatar: b.originalTeacher?.user?.avatarUrl || null,
            badalTeacherId: b.badalTeacherId,
            badalTeacherName: b.badalTeacherName || (b.badalTeacher?.user ? `${b.badalTeacher.user.firstName} ${b.badalTeacher.user.lastName}` : "TBA"),
            badalTeacherAvatar: b.badalTeacher?.user?.avatarUrl || null,
            status: b.status,
            isFulfilled: b.isFulfilled,
          })),
        };
      },
      { ttl: 15_000, tags: ["timetableslot", "timetable", "class"] }
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Timetable fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch timetable" });
  }
});

// POST /api/admin/timetable/sync-master - Synchronize 8 Darajah classes and generate 240 timetable slots
router.post("/sync-master", requireRole("ADMIN"), async (req, res) => {
  try {
    const { syncMasterTimetableAndClasses } = await import("../../lib/timetable-master-sync");
    const force = req.query.force === "true" || req.body?.force === true;
    const result = await syncMasterTimetableAndClasses(force);
    return res.json(result);
  } catch (error: any) {
    console.error("Master timetable sync error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to sync master timetable" });
  }
});

const PERIOD_TIMES: Record<number, { startTime: string; endTime: string }> = {
  1: { startTime: "10:30", endTime: "11:00" },
  2: { startTime: "11:00", endTime: "11:30" },
  3: { startTime: "11:30", endTime: "12:00" },
  4: { startTime: "12:00", endTime: "12:30" },
  5: { startTime: "12:30", endTime: "13:00" },
  6: { startTime: "14:15", endTime: "14:45" },
  7: { startTime: "14:45", endTime: "15:15" },
  8: { startTime: "15:15", endTime: "15:45" },
  9: { startTime: "15:45", endTime: "16:15" },
};

const SLOT_INCLUDE = {
  class: { select: { id: true, name: true, grade: true, section: true } },
  teacher: {
    select: {
      id: true,
      its: true,
      photoUrl: true,
      employeeId: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  },
};

function formatSlotResponse(slot: any) {
  return {
    id: slot.id,
    classId: slot.classId,
    className: slot.className || slot.class?.name || "Class",
    classGrade: slot.class?.grade || "",
    classSection: slot.class?.section || "",
    teacherId: slot.teacherId,
    teacherName: slot.teacherName || (slot.teacher?.user ? `${slot.teacher.user.firstName || ""} ${slot.teacher.user.lastName || ""}`.trim() : "TBA"),
    teacherAvatar: slot.teacher?.user?.avatarUrl || slot.teacher?.photoUrl || null,
    teacherIts: slot.teacher?.its || null,
    subject: slot.subject,
    dayOfWeek: slot.dayOfWeek,
    period: slot.period,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomNumber: slot.roomNumber,
    isBreak: slot.isBreak,
    breakName: slot.breakName,
  };
}

// POST /api/admin/timetable - Create or upsert timetable slot
router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const {
      id,
      classId,
      className,
      teacherId,
      teacherName,
      dayOfWeek,
      period,
      startTime,
      endTime,
      subject,
      roomNumber,
      isBreak,
      breakName,
    } = req.body;

    if (!dayOfWeek || period === undefined) {
      return res.status(400).json({ success: false, error: "dayOfWeek and period are required" });
    }

    const dow = Number(dayOfWeek);
    const p = Number(period);

    // Resolve class details
    let resolvedClassId = classId || null;
    let resolvedClassName = className || null;
    if (resolvedClassId && !resolvedClassName) {
      const cls = await prisma.class.findUnique({ where: { id: resolvedClassId } });
      if (cls) resolvedClassName = cls.name;
    } else if (!resolvedClassId && resolvedClassName) {
      const cls = await prisma.class.findFirst({ where: { name: resolvedClassName, academicYear: "1448 H" } });
      if (cls) resolvedClassId = cls.id;
    }

    // Resolve teacher details
    let resolvedTeacherId = teacherId || null;
    let resolvedTeacherName = teacherName || null;
    if (resolvedTeacherId) {
      const tp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: resolvedTeacherId }, { userId: resolvedTeacherId }] },
        include: { user: true },
      });
      if (tp) {
        resolvedTeacherId = tp.id;
        if (!resolvedTeacherName) {
          resolvedTeacherName = `${tp.user.firstName} ${tp.user.lastName}`.trim();
        }
      }
    }

    const defaultTimes = PERIOD_TIMES[p] || { startTime: "10:30", endTime: "11:00" };
    const finalStart = startTime || defaultTimes.startTime;
    const finalEnd = endTime || defaultTimes.endTime;

    let slot: any;
    if (id) {
      slot = await prisma.timetableSlot.update({
        where: { id },
        data: {
          classId: resolvedClassId,
          className: resolvedClassName,
          teacherId: resolvedTeacherId,
          teacherName: resolvedTeacherName,
          dayOfWeek: dow,
          period: p,
          startTime: finalStart,
          endTime: finalEnd,
          subject: isBreak ? "" : (subject || "General Lesson"),
          roomNumber: roomNumber || (resolvedClassName ? `Room ${resolvedClassName}` : null),
          isBreak: Boolean(isBreak),
          breakName: isBreak ? (breakName || "Break") : null,
        },
        include: SLOT_INCLUDE,
      });
    } else {
      // Check if a slot already exists for this class at this day and period
      const existing = resolvedClassId
        ? await prisma.timetableSlot.findFirst({
            where: { classId: resolvedClassId, dayOfWeek: dow, period: p },
          })
        : null;

      if (existing) {
        slot = await prisma.timetableSlot.update({
          where: { id: existing.id },
          data: {
            className: resolvedClassName,
            teacherId: resolvedTeacherId,
            teacherName: resolvedTeacherName,
            startTime: finalStart,
            endTime: finalEnd,
            subject: isBreak ? "" : (subject || "General Lesson"),
            roomNumber: roomNumber || (resolvedClassName ? `Room ${resolvedClassName}` : null),
            isBreak: Boolean(isBreak),
            breakName: isBreak ? (breakName || "Break") : null,
          },
          include: SLOT_INCLUDE,
        });
      } else {
        slot = await prisma.timetableSlot.create({
          data: {
            classId: resolvedClassId,
            className: resolvedClassName,
            teacherId: resolvedTeacherId,
            teacherName: resolvedTeacherName,
            dayOfWeek: dow,
            period: p,
            startTime: finalStart,
            endTime: finalEnd,
            subject: isBreak ? "" : (subject || "General Lesson"),
            roomNumber: roomNumber || (resolvedClassName ? `Room ${resolvedClassName}` : null),
            isBreak: Boolean(isBreak),
            breakName: isBreak ? (breakName || "Break") : null,
          },
          include: SLOT_INCLUDE,
        });
      }
    }

    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");

    return res.json({
      success: true,
      data: formatSlotResponse(slot),
    });
  } catch (error) {
    console.error("Timetable slot save error:", error);
    return res.status(500).json({ success: false, error: "Failed to save timetable slot" });
  }
});

// PUT /api/admin/timetable/:id - Update timetable slot
router.put("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      classId,
      className,
      teacherId,
      teacherName,
      dayOfWeek,
      period,
      startTime,
      endTime,
      subject,
      roomNumber,
      isBreak,
      breakName,
    } = req.body;

    const data: any = {};
    if (classId !== undefined) data.classId = classId;
    if (className !== undefined) data.className = className;
    if (teacherId !== undefined) data.teacherId = teacherId;
    if (teacherName !== undefined) data.teacherName = teacherName;
    if (dayOfWeek !== undefined) data.dayOfWeek = Number(dayOfWeek);
    if (period !== undefined) data.period = Number(period);
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (subject !== undefined) data.subject = subject;
    if (roomNumber !== undefined) data.roomNumber = roomNumber;
    if (isBreak !== undefined) data.isBreak = Boolean(isBreak);
    if (breakName !== undefined) data.breakName = breakName;

    const updated = await prisma.timetableSlot.update({
      where: { id },
      data,
      include: SLOT_INCLUDE,
    });

    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");

    return res.json({ success: true, data: formatSlotResponse(updated) });
  } catch (error) {
    console.error("Timetable slot update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update timetable slot" });
  }
});

// DELETE /api/admin/timetable/:id or DELETE /api/admin/timetable?id=... - Delete timetable slot
router.delete("/:id?", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const id = req.params.id || (req.query.id as string);
    if (!id) {
      return res.status(400).json({ success: false, error: "Slot id is required" });
    }
    await prisma.timetableSlot.delete({ where: { id } });
    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");
    return res.json({ success: true, message: "Timetable slot deleted successfully" });
  } catch (error) {
    console.error("Timetable slot delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete timetable slot" });
  }
});

// ── BADAL (SUBSTITUTION) MANAGEMENT ENDPOINTS ──

// GET /api/admin/timetable/badal - List badal records (high performance cached)
router.get("/badal", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { date, status, search } = req.query as Record<string, string | undefined>;
    const where: any = {};

    if (date && date !== "ALL") {
      if (date === "week") {
        const now = new Date();
        const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7), 0, 0, 0));
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000);
        where.date = { gte: startOfWeek, lt: endOfWeek };
      } else {
        const parsed = Date.parse(date.includes("T") ? date : `${date}T00:00:00.000Z`);
        if (!Number.isNaN(parsed)) {
          const targetDate = new Date(parsed);
          const nextDay = new Date(targetDate.getTime() + 86400000);
          where.date = { gte: targetDate, lt: nextDay };
        }
      }
    }

    if (status && status !== "ALL") {
      if (status === "FULFILLED" || status === "COMPLETED") {
        where.OR = [{ isFulfilled: true }, { status: "COMPLETED" }];
      } else if (status === "PENDING") {
        where.isFulfilled = false;
        where.status = { not: "CANCELLED" };
      } else {
        where.status = status;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { className: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { originalTeacherName: { contains: q, mode: "insensitive" } },
        { badalTeacherName: { contains: q, mode: "insensitive" } },
        { reason: { contains: q, mode: "insensitive" } },
      ];
    }

    const cacheKey = `admin:timetable:badal:${JSON.stringify(where)}`;
    const data = await cache.getOrSet(
      cacheKey,
      async () => {
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

        return badals.map((b) => ({
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
          originalTeacherName: b.originalTeacherName || (b.originalTeacher?.user ? `${b.originalTeacher.user.firstName || ""} ${b.originalTeacher.user.lastName || ""}`.trim() : "Original Teacher"),
          originalTeacherAvatar: b.originalTeacher?.user?.avatarUrl || null,
          badalTeacherId: b.badalTeacherId,
          badalTeacherName: b.badalTeacherName || (b.badalTeacher?.user ? `${b.badalTeacher.user.firstName || ""} ${b.badalTeacher.user.lastName || ""}`.trim() : "Pending Assignment"),
          badalTeacherAvatar: b.badalTeacher?.user?.avatarUrl || null,
          reason: b.reason,
          status: b.status,
          instructions: b.instructions,
          isFulfilled: b.isFulfilled,
          notes: b.notes,
          createdAt: b.createdAt,
        }));
      },
      { ttl: 15_000, tags: ["timetablebadal", "timetable"] }
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Badal fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch badal records" });
  }
});

// GET /api/admin/timetable/badal/available-teachers - Intelligent Free Teacher Finder
router.get("/badal/available-teachers", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { dayOfWeek, period, date } = req.query as Record<string, string | undefined>;
    if (!dayOfWeek || !period) {
      return res.status(400).json({ success: false, error: "dayOfWeek and period are required" });
    }

    const dow = parseInt(dayOfWeek, 10);
    const p = parseInt(period, 10);
    if (Number.isNaN(dow) || Number.isNaN(p)) {
      return res.status(400).json({ success: false, error: "Valid dayOfWeek and period are required" });
    }

    let targetDate = new Date();
    if (date && typeof date === "string" && date.trim()) {
      const parsed = Date.parse(date.includes("T") ? date : `${date}T00:00:00.000Z`);
      if (!Number.isNaN(parsed)) {
        targetDate = new Date(parsed);
      }
    }
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

    // 3. Find all active teachers, prioritizing those who are completely free
    const allTeachers = await prisma.teacherProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
      },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
        _count: { select: { substituteBadals: true } },
      },
      orderBy: [{ substituteBadals: { _count: "asc" } }, { user: { firstName: "asc" } }],
    });

    return res.json({
      success: true,
      data: allTeachers
        .map((t) => {
          const isFree = !busyTeacherIds.has(t.id);
          return {
            id: t.id,
            name: t.user ? `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() : "Teacher",
            email: t.user?.email || "",
            its: t.its,
            avatarUrl: t.user?.avatarUrl || null,
            badalCount: t._count.substituteBadals,
            isFree,
          };
        })
        .sort((a, b) => (a.isFree === b.isFree ? 0 : a.isFree ? -1 : 1)),
    });
  } catch (error) {
    console.error("Available teachers error:", error);
    return res.status(500).json({ success: false, error: "Failed to find available teachers" });
  }
});

// POST /api/admin/timetable/badal - Create Badal assignment
router.post("/badal", requireRole("ADMIN", "TEACHER"), async (req, res) => {
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
        originalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        badalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });

    cache.invalidateTag("timetablebadal");
    cache.invalidateTag("timetable");

    return res.json({ success: true, data: badal });
  } catch (error) {
    console.error("Create badal error:", error);
    return res.status(500).json({ success: false, error: "Failed to create badal assignment" });
  }
});

// PUT /api/admin/timetable/badal/:id - Update badal status / fulfillment
router.put("/badal/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
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

    cache.invalidateTag("timetablebadal");
    cache.invalidateTag("timetable");

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update badal error:", error);
    return res.status(500).json({ success: false, error: "Failed to update badal assignment" });
  }
});

// DELETE /api/admin/timetable/badal/:id - Cancel/remove badal assignment
router.delete("/badal/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.timetableBadal.delete({ where: { id } });
    cache.invalidateTag("timetablebadal");
    cache.invalidateTag("timetable");
    return res.json({ success: true, message: "Badal assignment deleted successfully" });
  } catch (error) {
    console.error("Delete badal error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete badal assignment" });
  }
});

export default router;
