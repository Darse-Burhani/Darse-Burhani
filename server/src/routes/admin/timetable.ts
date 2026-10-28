import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { cache } from "../../lib/cache";
import { notifyTimetableChange, getRecentTimetableChanges, isSlotRecentlyChanged, notifyBadalAssignment } from "../../lib/timetable-notify";
import { canonicalizeTeacherDisplay, canonicalizeTeacherName } from "../../lib/timetable-master-sync";

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
    const windowStart = new Date(startOfToday.getTime() - 7 * 86400000);
    const windowEnd = new Date(endOfToday.getTime() + 14 * 86400000);

    const cacheKey = `admin:timetable:${JSON.stringify(where)}`;
    const data = await cache.getOrSet(
      cacheKey,
      async () => {
        const [
          slots,
          classes,
          teachers,
          todayBadals,
          teacherAttendanceLeaves,
          teacherMedicalExemptions,
          studentLeaves,
          todayStudentRegistries,
        ] = await Promise.all([
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
                      studentId: true,
                      grade: true,
                      section: true,
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
                orderBy: [{ student: { studentId: "asc" } }],
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
          // 5. Teacher attendance marked ON_LEAVE or MEDICAL
          prisma.teacherAttendanceRecord.findMany({
            where: {
              date: { gte: windowStart, lt: windowEnd },
              status: { in: ["ON_LEAVE", "MEDICAL"] },
            },
            select: {
              teacherId: true,
              date: true,
              status: true,
              notes: true,
            },
          }),
          // 6. Medical exemptions for teachers
          prisma.medicalExemption.findMany({
            where: {
              personType: "TEACHER",
              isActive: true,
              date: { gte: windowStart, lt: windowEnd },
            },
            select: {
              teacherId: true,
              date: true,
              eventName: true,
              reason: true,
            },
          }),
          // 7. Approved Student Leaves
          prisma.leaveRequest.findMany({
            where: {
              status: "APPROVED",
              startDate: { lte: windowEnd },
              endDate: { gte: windowStart },
            },
            include: {
              student: {
                select: {
                  id: true,
                  studentId: true,
                  its: true,
                  grade: true,
                  section: true,
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          }),
          // 8. Today's Student Registries marked ON_LEAVE or MEDICAL
          prisma.attendanceRegistry.findMany({
            where: {
              date: { gte: startOfToday, lt: endOfToday },
              status: { in: ["ON_LEAVE", "MEDICAL"] },
            },
            select: {
              studentId: true,
              status: true,
              remarks: true,
            },
          }),
        ]);

        // Aggregate teacher leave details
        const teacherLeavesMap = new Map<string, {
          teacherId: string;
          reason: string;
          type: string;
          datesSummary: string;
        }>();

        for (const l of teacherAttendanceLeaves) {
          const prev = teacherLeavesMap.get(l.teacherId);
          const typeStr = l.status === "MEDICAL" ? "Medical Leave" : "Authorized Leave";
          const reasonStr = l.notes || typeStr;
          teacherLeavesMap.set(l.teacherId, {
            teacherId: l.teacherId,
            reason: reasonStr,
            type: typeStr,
            datesSummary: prev ? `${prev.datesSummary}, ${l.date.toISOString().split("T")[0]}` : l.date.toISOString().split("T")[0],
          });
        }

        for (const m of teacherMedicalExemptions) {
          if (!m.teacherId) continue;
          const prev = teacherLeavesMap.get(m.teacherId);
          teacherLeavesMap.set(m.teacherId, {
            teacherId: m.teacherId,
            reason: m.reason || m.eventName || "Medical Exemption",
            type: "Medical Exemption",
            datesSummary: prev ? `${prev.datesSummary}, ${m.date.toISOString().split("T")[0]}` : m.date.toISOString().split("T")[0],
          });
        }

        // Aggregate student leave details by studentId
        const studentLeaveMap = new Map<string, {
          studentId: string;
          name: string;
          its: string;
          grade: string;
          section: string;
          type: string;
          reason: string;
          startDate: string;
          endDate: string;
        }>();

        for (const sl of studentLeaves) {
          studentLeaveMap.set(sl.studentId, {
            studentId: sl.studentId,
            name: `${sl.student?.user?.firstName || ""} ${sl.student?.user?.lastName || ""}`.trim(),
            its: sl.student?.its || "",
            grade: sl.student?.grade || "",
            section: sl.student?.section || "",
            type: String(sl.type || "LEAVE"),
            reason: sl.reason || "Approved Leave",
            startDate: sl.startDate.toISOString().split("T")[0],
            endDate: sl.endDate.toISOString().split("T")[0],
          });
        }

        for (const reg of todayStudentRegistries) {
          if (!studentLeaveMap.has(reg.studentId)) {
            studentLeaveMap.set(reg.studentId, {
              studentId: reg.studentId,
              name: "Talib",
              its: "",
              grade: "",
              section: "",
              type: reg.status === "MEDICAL" ? "Medical Leave" : "On Leave",
              reason: reg.remarks || "Marked on Leave",
              startDate: startOfToday.toISOString().split("T")[0],
              endDate: startOfToday.toISOString().split("T")[0],
            });
          }
        }

        return {
          slots: slots.map((s) => formatSlotResponse(s, teacherLeavesMap)),
          recentChanges: getRecentTimetableChanges(),
          classes: classes.map((c: any) => {
            const classStudentIds = new Set((c.enrollments || []).map((e: any) => e.student?.id).filter(Boolean));
            const onLeaveInThisClass = Array.from(studentLeaveMap.values()).filter((item) => classStudentIds.has(item.studentId));

            return {
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
              talabatOnLeave: onLeaveInThisClass,
              talabatOnLeaveCount: onLeaveInThisClass.length,
              talabat: (c.enrollments || []).map((e: any) => {
                const sLeave = studentLeaveMap.get(e.student?.id);
                return {
                  id: e.student?.id,
                  userId: e.student?.user?.id,
                  name: `${e.student?.user?.firstName || ""} ${e.student?.user?.lastName || ""}`.trim(),
                  its: e.student?.its,
                  rollNumber: e.student?.studentId || null,
                  studentId: e.student?.studentId,
                  avatarUrl: e.student?.user?.avatarUrl || null,
                  isUnavailable: Boolean(sLeave),
                  leaveReason: sLeave?.reason || null,
                  leaveType: sLeave?.type || null,
                  leaveDates: sLeave ? `${sLeave.startDate} to ${sLeave.endDate}` : null,
                };
              }),
            };
          }),
          teachers: teachers.map((t) => {
            const display = canonicalizeTeacherDisplay(
              t.user ? `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() : "Teacher",
              t.user?.avatarUrl || t.photoUrl || null,
            );
            const tLeave = teacherLeavesMap.get(t.id);
            return {
              id: t.id,
              name: display.name,
              email: t.user?.email || "",
              its: t.its,
              avatarUrl: display.avatarUrl,
              weeklyPeriods: t._count.timetableSlots,
              isUnavailable: Boolean(tLeave),
              leaveReason: tLeave?.reason || null,
              leaveType: tLeave?.type || null,
              leaveDates: tLeave?.datesSummary || null,
            };
          }),
          unavailableTeachers: Array.from(teacherLeavesMap.values()),
          todayBadals: todayBadals.map((b) => {
            const originalDisplay = canonicalizeTeacherDisplay(
              b.originalTeacherName || (b.originalTeacher?.user ? `${b.originalTeacher.user.firstName} ${b.originalTeacher.user.lastName}` : "TBA"),
              b.originalTeacher?.user?.avatarUrl || null,
            );
            const badalDisplay = canonicalizeTeacherDisplay(
              b.badalTeacherName || (b.badalTeacher?.user ? `${b.badalTeacher.user.firstName} ${b.badalTeacher.user.lastName}` : "TBA"),
              b.badalTeacher?.user?.avatarUrl || null,
            );
            return {
              id: b.id,
              date: b.date.toISOString().split("T")[0],
              slotId: b.slotId,
              classId: b.classId,
              className: b.className,
              period: b.period,
              subject: b.subject,
              originalTeacherId: b.originalTeacherId,
              originalTeacherName: originalDisplay.name,
              originalTeacherAvatar: originalDisplay.avatarUrl,
              badalTeacherId: b.badalTeacherId,
              badalTeacherName: badalDisplay.name,
              badalTeacherAvatar: badalDisplay.avatarUrl,
              status: b.status,
              isFulfilled: b.isFulfilled,
            };
          }),
        };
      },
      { ttl: 15_000, tags: ["timetableslot", "timetable", "class", "teacherAttendanceRecord", "attendanceRecord"] }
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Timetable fetch error:", error);
    return res.status(500).json({ success: false, error: (error as Error)?.message || "Failed to fetch timetable" });
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

function formatSlotResponse(slot: any, teacherLeavesMap?: Map<string, any>) {
  const changeInfo = isSlotRecentlyChanged(slot);
  const updatedAtTime = slot.updatedAt ? new Date(slot.updatedAt).getTime() : 0;
  const createdAtTime = slot.createdAt ? new Date(slot.createdAt).getTime() : 0;
  const isRecentByDate = Boolean(
    updatedAtTime &&
    Date.now() - updatedAtTime < 3 * 24 * 60 * 60 * 1000 &&
    updatedAtTime - createdAtTime > 5000
  );
  const isRecent = Boolean(changeInfo || isRecentByDate);

  const composedTeacherName = slot.teacherName || (slot.teacher?.user ? `${slot.teacher.user.firstName || ""} ${slot.teacher.user.lastName || ""}`.trim() : "TBA");
  const slotDisplay = canonicalizeTeacherDisplay(composedTeacherName, slot.teacher?.user?.avatarUrl || slot.teacher?.photoUrl || null);

  const teacherLeave = slot.teacherId && teacherLeavesMap ? teacherLeavesMap.get(slot.teacherId) : null;

  return {
    id: slot.id,
    classId: slot.classId,
    className: slot.className || slot.class?.name || "Class",
    classGrade: slot.class?.grade || "",
    classSection: slot.class?.section || "",
    teacherId: slot.teacherId,
    teacherName: slotDisplay.name,
    teacherAvatar: slotDisplay.avatarUrl,
    teacherIts: slot.teacher?.its || null,
    subject: slot.subject,
    dayOfWeek: slot.dayOfWeek,
    period: slot.period,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomNumber: slot.roomNumber,
    isBreak: slot.isBreak,
    breakName: slot.breakName,
    updatedAt: slot.updatedAt,
    isRecentlyChanged: isRecent,
    changeDescription: changeInfo?.changeDescription || (isRecent ? `Recently updated: ${slot.subject} (${canonicalizeTeacherName(slot.teacherName) || "Assigned Teacher"})` : null),
    // Leave / Availability metadata
    isUnavailable: Boolean(teacherLeave),
    leaveReason: teacherLeave?.reason || null,
    leaveType: teacherLeave?.type || null,
    leaveDates: teacherLeave?.datesSummary || null,
  };
}

// GET /api/admin/timetable/recent-changes - List recent timetable changes
router.get("/recent-changes", requireRole("ADMIN", "TEACHER"), async (_req, res) => {
  return res.json({
    success: true,
    data: getRecentTimetableChanges(),
  });
});

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
    let changeType: "CREATED" | "UPDATED" = "CREATED";
    let oldDetails: any = null;

    if (id) {
      const existing = await prisma.timetableSlot.findUnique({ where: { id } });
      if (existing) {
        changeType = "UPDATED";
        oldDetails = {
          subject: existing.subject,
          teacherName: existing.teacherName || undefined,
          roomNumber: existing.roomNumber || undefined,
          startTime: existing.startTime,
          endTime: existing.endTime,
        };
      }
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
      // Check if a slot already exists for this class (or teacher) at this day and period
      const existing = resolvedClassId
        ? await prisma.timetableSlot.findFirst({
            where: { classId: resolvedClassId, dayOfWeek: dow, period: p },
          })
        : resolvedTeacherId
        ? await prisma.timetableSlot.findFirst({
            where: { teacherId: resolvedTeacherId, dayOfWeek: dow, period: p },
          })
        : null;

      if (existing) {
        changeType = "UPDATED";
        oldDetails = {
          subject: existing.subject,
          teacherName: existing.teacherName || undefined,
          roomNumber: existing.roomNumber || undefined,
          startTime: existing.startTime,
          endTime: existing.endTime,
        };
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
        changeType = "CREATED";
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

    // Broadcast notifications to assigned teacher and enrolled students
    notifyTimetableChange({
      slotId: slot.id,
      classId: slot.classId,
      className: slot.className,
      dayOfWeek: slot.dayOfWeek,
      period: slot.period,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      teacherId: slot.teacherId,
      teacherName: slot.teacherName,
      roomNumber: slot.roomNumber,
      changeType,
      oldDetails,
      actorName: req.auth?.user ? `${req.auth.user.firstName} ${req.auth.user.lastName}` : "Admin",
    }).catch((err) => console.error("Async timetable notification error:", err));

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

    const existing = await prisma.timetableSlot.findUnique({ where: { id } });
    const oldDetails = existing
      ? {
          subject: existing.subject,
          teacherName: existing.teacherName || undefined,
          roomNumber: existing.roomNumber || undefined,
          startTime: existing.startTime,
          endTime: existing.endTime,
        }
      : undefined;

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

    // Broadcast notifications to assigned teacher and enrolled students
    notifyTimetableChange({
      slotId: updated.id,
      classId: updated.classId,
      className: updated.className,
      dayOfWeek: updated.dayOfWeek,
      period: updated.period,
      startTime: updated.startTime,
      endTime: updated.endTime,
      subject: updated.subject,
      teacherId: updated.teacherId,
      teacherName: updated.teacherName,
      roomNumber: updated.roomNumber,
      changeType: "UPDATED",
      oldDetails,
      actorName: req.auth?.user ? `${req.auth.user.firstName} ${req.auth.user.lastName}` : "Admin",
    }).catch((err) => console.error("Async timetable notification error:", err));

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

    const existing = await prisma.timetableSlot.findUnique({ where: { id } });

    await prisma.timetableSlot.delete({ where: { id } });
    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");

    if (existing) {
      notifyTimetableChange({
        slotId: existing.id,
        classId: existing.classId,
        className: existing.className,
        dayOfWeek: existing.dayOfWeek,
        period: existing.period,
        startTime: existing.startTime,
        endTime: existing.endTime,
        subject: existing.subject,
        teacherId: existing.teacherId,
        teacherName: existing.teacherName,
        roomNumber: existing.roomNumber,
        changeType: "DELETED",
        actorName: req.auth?.user ? `${req.auth.user.firstName} ${req.auth.user.lastName}` : "Admin",
      }).catch((err) => console.error("Async timetable delete notification error:", err));
    }

    return res.json({ success: true, message: "Timetable slot deleted successfully" });
  } catch (error) {
    console.error("Timetable slot delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete timetable slot" });
  }
});

// POST /api/admin/timetable/assign-faculty - Assign or re-assign a faculty teacher to a specific timetable slot
router.post("/assign-faculty", requireRole("ADMIN"), async (req, res) => {
  try {
    const { slotId, teacherId } = req.body;
    if (!slotId) {
      return res.status(400).json({ success: false, error: "slotId is required" });
    }

    let resolvedTeacherId: string | null = null;
    let resolvedTeacherName: string | null = null;

    if (teacherId) {
      const tp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: teacherId }, { userId: teacherId }] },
        include: { user: true },
      });
      if (!tp) {
        return res.status(404).json({ success: false, error: "Teacher not found" });
      }
      resolvedTeacherId = tp.id;
      resolvedTeacherName = `${tp.user.firstName} ${tp.user.lastName}`.trim();
    }

    const updated = await prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        teacherId: resolvedTeacherId,
        teacherName: resolvedTeacherName,
      },
      include: SLOT_INCLUDE,
    });

    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");

    return res.json({
      success: true,
      message: resolvedTeacherName
        ? `Successfully assigned ${resolvedTeacherName} to ${updated.className} (Period ${updated.period})`
        : `Successfully unassigned teacher from ${updated.className} (Period ${updated.period})`,
      data: formatSlotResponse(updated),
    });
  } catch (error: any) {
    console.error("Assign faculty error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to assign faculty" });
  }
});

// POST /api/admin/timetable/assign-masool - Assign or change Class Masool / Class Teacher
router.post("/assign-masool", requireRole("ADMIN"), async (req, res) => {
  try {
    const { classId, teacherId } = req.body;
    if (!classId || !teacherId) {
      return res.status(400).json({ success: false, error: "classId and teacherId are required" });
    }

    const tp = await prisma.teacherProfile.findFirst({
      where: { OR: [{ id: teacherId }, { userId: teacherId }] },
      include: { user: true },
    });
    if (!tp) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: {
        masoolId: tp.id,
        teacherId: tp.id,
      },
      include: {
        masool: { include: { user: true } },
        teacher: { include: { user: true } },
      },
    });

    cache.invalidateTag("class");
    cache.invalidateTag("timetable");
    cache.invalidateTag("takhteet");

    const teacherFullName = `${tp.user.firstName} ${tp.user.lastName}`.trim();

    return res.json({
      success: true,
      message: `Successfully assigned ${teacherFullName} as Class Masool for Class ${updatedClass.name}!`,
      data: {
        classId: updatedClass.id,
        className: updatedClass.name,
        masoolId: updatedClass.masoolId,
        masoolName: teacherFullName,
        masoolIts: tp.its,
        masoolAvatar: tp.photoUrl || tp.user.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error("Assign masool error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to assign class masool" });
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
          ...(() => {
            const od = canonicalizeTeacherDisplay(b.originalTeacherName || (b.originalTeacher?.user ? `${b.originalTeacher.user.firstName || ""} ${b.originalTeacher.user.lastName || ""}`.trim() : "Original Teacher"), b.originalTeacher?.user?.avatarUrl || null);
            const bd = canonicalizeTeacherDisplay(b.badalTeacherName || (b.badalTeacher?.user ? `${b.badalTeacher.user.firstName || ""} ${b.badalTeacher.user.lastName || ""}`.trim() : "Pending Assignment"), b.badalTeacher?.user?.avatarUrl || null);
            return {
              originalTeacherName: od.name,
              originalTeacherAvatar: od.avatarUrl,
              badalTeacherId: b.badalTeacherId,
              badalTeacherName: bd.name,
              badalTeacherAvatar: bd.avatarUrl,
            };
          })(),
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
    const { dayOfWeek, period, date, subject, originalTeacherId } = req.query as Record<string, string | undefined>;
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
    const normalizedSubject = (subject || "").trim();

    // The scheduled teacher can be sent as either a profile id or a user id.
    let originalProfileId: string | null = originalTeacherId?.trim() || null;
    if (originalProfileId) {
      const original = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: originalProfileId }, { userId: originalProfileId }] },
        select: { id: true },
      });
      originalProfileId = original?.id || originalProfileId;
    }

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

    // 2b. Check Faculty on Leave / Medical Exemption on this date
    const [leaveAttendance, leaveMedical] = await Promise.all([
      prisma.teacherAttendanceRecord.findMany({
        where: {
          date: { gte: startOfDay, lt: endOfDay },
          status: { in: ["ON_LEAVE", "MEDICAL"] },
        },
        select: { teacherId: true, status: true, notes: true },
      }),
      prisma.medicalExemption.findMany({
        where: {
          personType: "TEACHER",
          isActive: true,
          date: { gte: startOfDay, lt: endOfDay },
        },
        select: { teacherId: true, eventName: true, reason: true },
      }),
    ]);

    const teacherLeaveMap = new Map<string, string>();
    for (const l of leaveAttendance) {
      teacherLeaveMap.set(l.teacherId, l.notes || (l.status === "MEDICAL" ? "Medical Leave" : "Authorized Leave"));
    }
    for (const m of leaveMedical) {
      if (m.teacherId) teacherLeaveMap.set(m.teacherId, m.reason || m.eventName || "Medical Exemption");
    }

    // 3. Faculty who are already timetabled for this subject are the only
    //    eligible substitutes. This prevents the picker from dumping the
    //    entire faculty roster into the Badal modal.
    let subjectTeacherIds = new Set<string>();
    if (normalizedSubject) {
      const subjectSlots = await prisma.timetableSlot.findMany({
        where: {
          subject: { equals: normalizedSubject, mode: "insensitive" },
          teacherId: { not: null },
        },
        select: { teacherId: true },
        distinct: ["teacherId"],
      });
      subjectTeacherIds = new Set(subjectSlots.map((s) => s.teacherId!));
    }
    const normalizedSubjectKey = normalizedSubject.toLowerCase();

    // 4. Return only free, subject-qualified faculty.
    const allTeachers = await prisma.teacherProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
      },
      select: {
        id: true,
        its: true,
        department: true,
        subjects: true,
        user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
        _count: { select: { substituteBadals: true } },
      },
    });

    const eligibleTeachers = allTeachers
      .filter((t) => t.id !== originalProfileId)
      .filter((t) => {
        if (!normalizedSubjectKey) return true;
        if (subjectTeacherIds.has(t.id)) return true;
        return t.subjects.some((s) => s.trim().toLowerCase() === normalizedSubjectKey);
      })
      .map((t) => {
        const substituteDisplay = canonicalizeTeacherDisplay(
          t.user ? `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() : "Teacher",
          t.user?.avatarUrl || null,
        );
        const onLeaveReason = teacherLeaveMap.get(t.id);
        const isOnLeave = Boolean(onLeaveReason);
        const isFree = !busyTeacherIds.has(t.id) && !isOnLeave;

        return {
          id: t.id,
          name: substituteDisplay.name || "Teacher",
          email: t.user?.email || "",
          its: t.its,
          department: t.department || "Faculty",
          subjects: t.subjects,
          avatarUrl: substituteDisplay.avatarUrl,
          badalCount: t._count.substituteBadals,
          isFree,
          isOnLeave,
          leaveReason: onLeaveReason || null,
          teachesSubject: true,
        };
      })
      .sort(
        (a, b) =>
          Number(b.isFree && !b.isOnLeave) - Number(a.isFree && !a.isOnLeave) ||
          a.badalCount - b.badalCount ||
          a.name.localeCompare(b.name),
      );

    return res.json({
      success: true,
      data: eligibleTeachers,
      meta: {
        subject: normalizedSubject || null,
        period: p,
        date: startOfDay.toISOString().split("T")[0],
        eligibleCount: eligibleTeachers.length,
      },
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
      customEmailSubject,
      customEmailBody,
      senderEmail,
      receiverEmail,
      sendEmailNotification,
    } = req.body;

    if (!date || !className || period === undefined || !subject) {
      return res.status(400).json({ success: false, error: "Missing required fields (date, className, period, subject)" });
    }

    const periodNumber = Number(period);
    if (!Number.isInteger(periodNumber) || periodNumber < 1) {
      return res.status(400).json({ success: false, error: "period must be a positive integer" });
    }

    const dateObj = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(dateObj.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid substitution date" });
    }
    const startOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    let originalProfileId: string | null = originalTeacherId || null;
    if (originalProfileId) {
      const original = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: originalProfileId }, { userId: originalProfileId }] },
        select: { id: true },
      });
      originalProfileId = original?.id || originalProfileId;
    }

    // Validate the substitute is a real, active teacher and is genuinely free
    // for this day/period. This is the server-side guard behind the filtered
    // Badal picker, so a stale browser cannot assign a busy teacher.
    let substituteProfile: {
      id: string;
      user: { firstName: string; lastName: string };
    } | null = null;

    if (badalTeacherId) {
      substituteProfile = await prisma.teacherProfile.findFirst({
        where: {
          OR: [{ id: badalTeacherId }, { userId: badalTeacherId }],
          user: { isActive: true, deletedAt: null },
        },
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      });

      if (!substituteProfile) {
        return res.status(400).json({ success: false, error: "Selected substitute teacher is not active or was not found" });
      }
      if (originalProfileId && substituteProfile.id === originalProfileId) {
        return res.status(400).json({ success: false, error: "A teacher cannot substitute for their own lesson" });
      }

      const alreadyAssigned = await prisma.timetableBadal.findFirst({
        where: {
          date: { gte: startOfDay, lt: endOfDay },
          period: periodNumber,
          badalTeacherId: substituteProfile.id,
          status: { in: ["ASSIGNED", "CONFIRMED"] },
        },
        select: { id: true },
      });
      if (alreadyAssigned) {
        return res.status(409).json({ success: false, error: "This teacher is already assigned as Badal for this period" });
      }

      let substituteDayOfWeek: number | null = null;
      if (slotId) {
        const slot = await prisma.timetableSlot.findUnique({
          where: { id: slotId },
          select: { dayOfWeek: true },
        });
        substituteDayOfWeek = slot?.dayOfWeek ?? null;
      }
      if (substituteDayOfWeek === null) {
        const day = startOfDay.getUTCDay();
        substituteDayOfWeek = day === 0 ? 1 : day;
      }

      const teachingClash = await prisma.timetableSlot.findFirst({
        where: {
          dayOfWeek: substituteDayOfWeek,
          period: periodNumber,
          teacherId: substituteProfile.id,
        },
        select: { id: true },
      });
      if (teachingClash) {
        return res.status(409).json({ success: false, error: "This teacher already has a class in the selected period" });
      }
    }

    const resolvedBadalTeacherId = substituteProfile?.id || null;
    const resolvedBadalTeacherName =
      badalTeacherName ||
      (substituteProfile
        ? `${substituteProfile.user.firstName || ""} ${substituteProfile.user.lastName || ""}`.trim()
        : null);

    const badal = await prisma.timetableBadal.create({
      data: {
        date: dateObj,
        slotId: slotId || null,
        classId: classId || null,
        className,
        period: periodNumber,
        startTime: startTime || "10:30",
        endTime: endTime || "11:00",
        subject,
        originalTeacherId: originalProfileId,
        originalTeacherName: originalTeacherName || null,
        badalTeacherId: resolvedBadalTeacherId,
        badalTeacherName: resolvedBadalTeacherName,
        reason: reason || "Unplanned Absence / Leave",
        status: resolvedBadalTeacherId ? "ASSIGNED" : "PENDING",
        instructions: instructions || null,
        notes: notes || null,
        assignedById: session.user.id,
      },
      include: {
        originalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } } } },
        badalTeacher: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } } } },
      },
    });

    cache.invalidateTag("timetablebadal");
    cache.invalidateTag("timetable");

    if (badal.badalTeacherId) {
      notifyBadalAssignment(badal, session.user.firstName || "Administration", {
        customSubject: customEmailSubject,
        customBody: customEmailBody,
        customTo: receiverEmail,
        customFrom: senderEmail,
        sendEmailNotification: sendEmailNotification !== false,
      }).catch((err) =>
        console.error("[timetable] Failed to send badal notification:", err)
      );
    }

    return res.json({ success: true, data: badal });
  } catch (error) {
    console.error("Create badal error:", error);
    return res.status(500).json({ success: false, error: "Failed to create badal assignment" });
  }
});

// PUT /api/admin/timetable/badal/:id - Update badal status / fulfillment
router.put("/badal/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
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
      include: {
        originalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } } } },
        badalTeacher: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } } } },
      },
    });

    cache.invalidateTag("timetablebadal");
    cache.invalidateTag("timetable");

    if (badalTeacherId || (data.status && data.status === "ASSIGNED")) {
      notifyBadalAssignment(updated, session.user.firstName || "Administration").catch((err) =>
        console.error("[timetable] Failed to send badal update notification:", err)
      );
    }

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

// POST /api/admin/timetable/ai-fill - AI auto-fill slots assigned to teachers, respecting Free Time
router.post("/ai-fill", requireRole("ADMIN"), async (req, res) => {
  try {
    const {
      classId,
      className,
      preserveExisting = true,
      periodsPerDay = 9,
    } = req.body;

    const classWhere: any = { isActive: true };
    if (classId) {
      classWhere.id = classId;
    } else if (className && className !== "ALL") {
      classWhere.name = className;
    } else {
      classWhere.grade = { in: ["1", "2", "3", "4"] };
    }

    const [activeClasses, activeTeachers, existingSlots] = await Promise.all([
      prisma.class.findMany({
        where: classWhere,
        include: {
          masool: { include: { user: true } },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }],
      }),
      prisma.teacherProfile.findMany({
        where: { user: { isActive: true } },
        include: {
          user: true,
          classes: true,
          masoolClasses: true,
        },
      }),
      prisma.timetableSlot.findMany({
        include: {
          class: true,
          teacher: { include: { user: true } },
        },
      }),
    ]);

    if (activeClasses.length === 0) {
      return res.status(400).json({ success: false, error: "No active classes found for AI generation" });
    }

    const classSlotMap = new Map<string, any>();
    const teacherBusyMap = new Map<string, any>();
    const teacherFreeTimeMap = new Map<string, boolean>();

    for (const slot of existingSlots) {
      if (slot.classId) {
        classSlotMap.set(`${slot.classId}_${slot.dayOfWeek}_${slot.period}`, slot);
      }
      if (slot.teacherId) {
        teacherBusyMap.set(`${slot.teacherId}_${slot.dayOfWeek}_${slot.period}`, slot);
        if (slot.isBreak || (slot.breakName && /free|استقبال|receiving/i.test(slot.breakName))) {
          teacherFreeTimeMap.set(`${slot.teacherId}_${slot.dayOfWeek}_${slot.period}`, true);
        }
      }
    }

    const MORNING_SUBJECTS = ["Quran Hifz", "Lisan Arabi", "Daim al-Islam", "Sharhal akhbar"];
    const MID_SUBJECTS = ["Tamreen", "Tadreeb", "Insha", "Science", "Maths"];
    const AFTERNOON_SUBJECTS = ["English", "Physics", "Chemistry", "Biology", "Geography", "Hist/Civ", "Raudat Hidayat", "Mukhtasar al-Asar"];

    const teacherLoad = new Map<string, number>();
    for (const t of activeTeachers) {
      let count = 0;
      for (const slot of existingSlots) {
        if (slot.teacherId === t.id && !slot.isBreak) count++;
      }
      teacherLoad.set(t.id, count);
    }

    const createdSlots: any[] = [];
    let skippedFreeTimeCount = 0;

    for (let day = 1; day <= 6; day++) {
      for (let p = 1; p <= Math.min(periodsPerDay, 9); p++) {
        for (const cls of activeClasses) {
          const slotKey = `${cls.id}_${day}_${p}`;
          const existing = classSlotMap.get(slotKey);

          if (existing) {
            if (existing.isBreak || (existing.breakName && /free|استقبال|receiving/i.test(existing.breakName))) {
              skippedFreeTimeCount++;
              continue;
            }
            if (preserveExisting) {
              continue;
            }
          }

          let candidateSubjects: string[];
          if (p <= 2) candidateSubjects = MORNING_SUBJECTS;
          else if (p <= 5) candidateSubjects = MID_SUBJECTS;
          else candidateSubjects = AFTERNOON_SUBJECTS;

          const subjectIdx = (cls.name.charCodeAt(0) * 7 + day * 3 + p) % candidateSubjects.length;
          const chosenSubject = candidateSubjects[subjectIdx];

          let selectedTeacher: (typeof activeTeachers)[0] | null = null;

          const specialists = activeTeachers.filter((t) => {
            const hasSubject = t.subjects?.some((s) => s.toLowerCase() === chosenSubject.toLowerCase());
            const hasDept = t.department && chosenSubject.toLowerCase().includes(t.department.toLowerCase());
            const isBusy = teacherBusyMap.has(`${t.id}_${day}_${p}`);
            const isFreeTime = teacherFreeTimeMap.has(`${t.id}_${day}_${p}`);
            return (hasSubject || hasDept) && !isBusy && !isFreeTime;
          });

          if (specialists.length > 0) {
            specialists.sort((a, b) => (teacherLoad.get(a.id) || 0) - (teacherLoad.get(b.id) || 0));
            selectedTeacher = specialists[0];
          }

          if (!selectedTeacher && cls.masoolId) {
            const masool = activeTeachers.find((t) => t.id === cls.masoolId);
            if (masool && !teacherBusyMap.has(`${masool.id}_${day}_${p}`) && !teacherFreeTimeMap.has(`${masool.id}_${day}_${p}`)) {
              selectedTeacher = masool;
            }
          }

          if (!selectedTeacher) {
            const available = activeTeachers.filter((t) => {
              const isBusy = teacherBusyMap.has(`${t.id}_${day}_${p}`);
              const isFreeTime = teacherFreeTimeMap.has(`${t.id}_${day}_${p}`);
              return !isBusy && !isFreeTime;
            });
            if (available.length > 0) {
              available.sort((a, b) => (teacherLoad.get(a.id) || 0) - (teacherLoad.get(b.id) || 0));
              selectedTeacher = available[0];
            }
          }

          if (!selectedTeacher) continue;

          const times = PERIOD_TIMES[p] || { startTime: "10:30", endTime: "11:00" };

          const newSlot = existing
            ? await prisma.timetableSlot.update({
                where: { id: existing.id },
                data: {
                  teacherId: selectedTeacher.id,
                  teacherName: canonicalizeTeacherName(`${selectedTeacher.user.firstName} ${selectedTeacher.user.lastName}`.trim()),
                  subject: chosenSubject,
                  roomNumber: `Room ${cls.name}`,
                  isBreak: false,
                  breakName: null,
                },
                include: SLOT_INCLUDE,
              })
            : await prisma.timetableSlot.create({
                data: {
                  classId: cls.id,
                  className: cls.name,
                  teacherId: selectedTeacher.id,
                  teacherName: canonicalizeTeacherName(`${selectedTeacher.user.firstName} ${selectedTeacher.user.lastName}`.trim()),
                  dayOfWeek: day,
                  period: p,
                  startTime: times.startTime,
                  endTime: times.endTime,
                  subject: chosenSubject,
                  roomNumber: `Room ${cls.name}`,
                  isBreak: false,
                  breakName: null,
                },
                include: SLOT_INCLUDE,
              });

          teacherBusyMap.set(`${selectedTeacher.id}_${day}_${p}`, newSlot);
          teacherLoad.set(selectedTeacher.id, (teacherLoad.get(selectedTeacher.id) || 0) + 1);
          classSlotMap.set(slotKey, newSlot);
          createdSlots.push(formatSlotResponse(newSlot));
        }
      }
    }

    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");

    return res.json({
      success: true,
      message: `AI generated and assigned ${createdSlots.length} lesson slot(s) successfully. Protected ${skippedFreeTimeCount} designated free time period(s).`,
      data: {
        createdCount: createdSlots.length,
        skippedFreeTimeCount,
        slots: createdSlots,
      },
    });
  } catch (error: any) {
    console.error("AI timetable fill error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to execute AI timetable fill" });
  }
});

// POST /api/admin/timetable/quick-free-time - Set a teacher slot as Free Time / Receiving Period
router.post("/quick-free-time", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { teacherId, dayOfWeek, period, classId, className } = req.body;
    if (!teacherId || !dayOfWeek || period === undefined) {
      return res.status(400).json({ success: false, error: "teacherId, dayOfWeek, and period are required" });
    }

    const dow = Number(dayOfWeek);
    const p = Number(period);

    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: teacherId },
      include: { user: true },
    });
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    const times = PERIOD_TIMES[p] || { startTime: "10:30", endTime: "11:00" };
    const teacherName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();

    const existing = await prisma.timetableSlot.findFirst({
      where: { teacherId, dayOfWeek: dow, period: p },
    });

    let slot: any;
    if (existing) {
      const willBeBreak = !existing.isBreak;
      slot = await prisma.timetableSlot.update({
        where: { id: existing.id },
        data: {
          isBreak: willBeBreak,
          breakName: willBeBreak ? "Free Time / Receiving Period (استقبال وتفرغ)" : null,
          subject: willBeBreak ? "" : "General Lesson", // On free time don't assign any subject!
        },
        include: SLOT_INCLUDE,
      });
    } else {
      slot = await prisma.timetableSlot.create({
        data: {
          classId: classId || null,
          className: className || null,
          teacherId,
          teacherName,
          dayOfWeek: dow,
          period: p,
          startTime: times.startTime,
          endTime: times.endTime,
          subject: "", // On free time don't assign any subject!
          roomNumber: "Faculty Desk",
          isBreak: true,
          breakName: "Free Time / Receiving Period (استقبال وتفرغ)",
        },
        include: SLOT_INCLUDE,
      });
    }

    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");

    return res.json({
      success: true,
      message: slot.isBreak
        ? `Marked Period ${p} as Free Time / Receiving Period for ${teacherName}`
        : `Removed Free Time from Period ${p} for ${teacherName}`,
      data: formatSlotResponse(slot),
    });
  } catch (error: any) {
    console.error("Quick free time error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to set free time slot" });
  }
});

export default router;
