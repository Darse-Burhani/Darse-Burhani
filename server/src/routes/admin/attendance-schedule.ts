import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import {
  runAutoMarkAbsentJob,
  runAutoMarkFacultyAbsentJob,
  getExpectedFacultyForDay,
} from "../../lib/attendance-scheduler";
import {
  eventRangeForRole,
  hasFacultyTimer,
  isLegacyFacultyRow,
  getISTDetails,
  getStartOfDayIST,
} from "../../lib/biometric";

const router = Router();

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Match a check-in timestamp (IST) to its scheduled scan event name.
// A scan belongs to an event when inside EITHER its Talabat timer or its
// faculty timer (unified model: one event carries both). Role preference
// breaks ties when overlapping events match.
function matchRosterEvent(
  checkInTime: Date | string | null | undefined,
  windows: Array<{ id: string; name: string; startTime: string; endTime: string; lateEndTime?: string | null; enabled: boolean; facultyStartTime?: string | null; facultyEndTime?: string | null; facultyLateEndTime?: string | null; facultyEnabled?: boolean }>,
  preferFaculty: boolean,
): string {
  if (!checkInTime) return "--";
  const d = new Date(checkInTime);
  if (Number.isNaN(d.getTime())) return "--";
  const t = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
  const inWindow = windows.filter((w) => {
    const primary = eventRangeForRole(w, preferFaculty ? "TEACHER" : "STUDENT");
    if (primary && primary.enabled && t >= primary.startMin && t <= primary.lateMin) return true;
    // Cross-timer match so every scan attributes to its event even when the
    // viewer filters the other audience.
    const secondary = eventRangeForRole(w, preferFaculty ? "STUDENT" : "TEACHER");
    return Boolean(secondary && secondary.enabled && t >= secondary.startMin && t <= secondary.lateMin);
  });
  if (inWindow.length === 0) return "Unscheduled";
  const audienceOf = (w: { id: string; name: string } & Record<string, any>) =>
    isLegacyFacultyRow(w as any) ? true : hasFacultyTimer(w as any) ? null : false;
  const preferred = inWindow.filter((w) => {
    const a = audienceOf(w);
    // Unified (both-timer) events serve either audience; legacy rows are strict.
    return a === null || a === preferFaculty;
  });
  const pick = preferred.length > 0 ? preferred : inWindow;
  pick.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return pick[0].name;
}

// ── 1. ALL STUDENTS: General Attendance Windows ──

// GET /api/admin/attendance/schedule/windows - List all attendance windows (Students & Faculty)
router.get("/windows", requireRole("ADMIN"), async (req, res) => {
  try {
    const audienceFilter = (req.query.audience as string)?.toUpperCase(); // "ALL_STUDENTS" | "FACULTY" | "ALL"

    let windows = await prisma.biometricScanWindow.findMany({
      orderBy: { startTime: "asc" },
    });

    // Seed the unified primary event if missing (ONE event, BOTH timers)
    if (!windows.some((w) => w.id === "default")) {
      const defaultWindow = await prisma.biometricScanWindow.create({
        data: {
          id: "default",
          name: "Tilawat al Dua",
          startTime: "07:00",
          endTime: "08:15",
          lateEndTime: "08:15",
          graceMinutes: 10,
          enabled: true,
          facultyStartTime: "07:30",
          facultyEndTime: "08:45",
          facultyLateEndTime: "08:45",
          facultyEnabled: true,
        },
      });
      windows.push(defaultWindow);
    }

    // Self-heal: merge any leftover standalone faculty row into the unified
    // event instead of seeding a second row.
    const legacyIdx = windows.findIndex(
      (w) =>
        w.id !== "default" &&
        (w.id === "faculty_default" ||
          w.id === "faculty" ||
          /faculty|teacher|staff/i.test(w.name)),
    );
    if (legacyIdx >= 0) {
      const legacy = windows[legacyIdx] as any;
      const primary = windows.find((w) => w.id === "default") as any;
      if (primary && !primary.facultyStartTime) {
        const merged = await prisma.biometricScanWindow.update({
          where: { id: "default" },
          data: {
            facultyStartTime: legacy.startTime,
            facultyEndTime: legacy.endTime,
            facultyLateEndTime: legacy.lateEndTime ?? legacy.endTime,
            facultyEnabled: legacy.enabled,
          },
        });
        const mi = windows.findIndex((w) => w.id === "default");
        if (mi >= 0) windows[mi] = merged;
      }
      await prisma.biometricScanWindow.delete({ where: { id: legacy.id } }).catch(() => {});
      windows = windows.filter((w) => w.id !== legacy.id);
    }

    // Compute live status per timer in IST (two-time rule: [start, end] on-time PRESENT, (end, lateEnd] LATE)
    const now = new Date();
    const { scanMinutes: nowMinutes } = getISTDetails(now);

    const phaseOf = (range: { startMin: number; endMin: number; lateMin: number } | null) => {
      if (!range) return null;
      if (nowMinutes >= range.startMin && nowMinutes <= range.endMin) return "ON_TIME" as const;
      if (nowMinutes > range.endMin && nowMinutes <= range.lateMin) return "LATE" as const;
      return null;
    };

    let enriched = await Promise.all(
      windows.map(async (w) => {
        const ww = w as any;
        const legacyFaculty = isLegacyFacultyRow(ww);
        const unifiedFaculty = hasFacultyTimer(ww);
        const audience: "FACULTY" | "ALL_STUDENTS" | "BOTH" = legacyFaculty
          ? "FACULTY"
          : unifiedFaculty
            ? "BOTH"
            : "ALL_STUDENTS";

        const studentRange = eventRangeForRole(ww, "STUDENT");
        const facultyRange = eventRangeForRole(ww, "TEACHER");

        let status: "ACTIVE" | "UPCOMING" | "CLOSED" = "CLOSED";
        let phase: "ON_TIME" | "LATE" | null = null;
        if (!w.enabled) {
          status = "CLOSED";
        } else if (studentRange && nowMinutes >= studentRange.startMin && nowMinutes <= studentRange.endMin) {
          status = "ACTIVE";
          phase = "ON_TIME";
        } else if (studentRange && nowMinutes > studentRange.endMin && nowMinutes <= studentRange.lateMin) {
          status = "ACTIVE";
          phase = "LATE";
        } else if (facultyRange && nowMinutes >= facultyRange.startMin && nowMinutes <= facultyRange.lateMin) {
          status = "ACTIVE";
          phase = phaseOf(facultyRange);
        } else if (
          studentRange && nowMinutes < studentRange.startMin && studentRange.startMin - nowMinutes <= 120
        ) {
          status = "UPCOMING";
        } else {
          status = "CLOSED";
        }

        const facultyPhase = facultyRange && w.enabled ? phaseOf(facultyRange) : null;
        const facultyStatus: "ACTIVE" | "UPCOMING" | "CLOSED" | "NONE" = !facultyRange
          ? "NONE"
          : !w.enabled || (ww.facultyEnabled === false && unifiedFaculty)
            ? "CLOSED"
            : facultyPhase
              ? "ACTIVE"
              : facultyRange.startMin - nowMinutes <= 120 && facultyRange.startMin > nowMinutes
                ? "UPCOMING"
                : "CLOSED";

        let applicableTeachers: Array<{ id: string; name: string }> | undefined;
        const applicableIds: string[] = ((w as any).applicableTeacherIds ?? []) as string[];
        if ((audience === "FACULTY" || audience === "BOTH") && applicableIds.length > 0) {
          const teachers = await prisma.teacherProfile.findMany({
            where: { id: { in: applicableIds } },
            include: { user: { select: { firstName: true, lastName: true } } },
          });
          applicableTeachers = teachers.map((t) => ({
            id: t.id,
            name: `${t.user.firstName} ${t.user.lastName}`.trim(),
          }));
        }

        let applicableClasses: Array<{ id: string; name: string; grade: string; section: string }> | undefined;
        const appClassIds: string[] = ((w as any).applicableClassIds ?? []) as string[];
        if (appClassIds.length > 0) {
          const classes = await prisma.class.findMany({
            where: { id: { in: appClassIds } },
            select: { id: true, name: true, grade: true, section: true },
          });
          applicableClasses = classes;
        }

        const exemptStudentIds: string[] = ((w as any).exemptStudentIds ?? []) as string[];
        const exemptTeacherIds: string[] = ((w as any).exemptTeacherIds ?? []) as string[];

        const startMin = toMinutes(w.startTime);
        const endMin = toMinutes(w.endTime);
        const lateEndMin = Math.max(endMin, toMinutes((w as any).lateEndTime ?? w.endTime));

        return {
          ...w,
          lateEndTime: (w as any).lateEndTime ?? w.endTime,
          facultyStartTime: ww.facultyStartTime ?? null,
          facultyEndTime: ww.facultyEndTime ?? null,
          facultyLateEndTime: ww.facultyLateEndTime ?? ww.facultyEndTime ?? null,
          facultyEnabled: ww.facultyEnabled ?? true,
          hasFacultyTimer: unifiedFaculty || legacyFaculty,
          applicableTeacherIds: applicableIds,
          exemptTeacherIds,
          applicableClassIds: appClassIds,
          exemptStudentIds,
          ...(applicableTeachers ? { applicableTeachers } : {}),
          ...(applicableClasses ? { applicableClasses } : {}),
          audience,
          status,
          phase,
          facultyStatus,
          facultyPhase,
          durationMinutes: lateEndMin - startMin,
          onTimeMinutes: endMin - startMin,
        };
      }),
    );

    if (audienceFilter === "FACULTY") {
      enriched = enriched.filter((w) => w.audience === "FACULTY" || w.audience === "BOTH");
    } else if (audienceFilter === "ALL_STUDENTS" || audienceFilter === "STUDENT") {
      enriched = enriched.filter((w) => w.audience === "ALL_STUDENTS" || w.audience === "BOTH");
    }

    return res.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Fetch attendance windows error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch attendance windows" });
  }
});

// POST /api/admin/attendance/schedule/windows - Create new schedule event (ONE event, BOTH Talabat + faculty timers)
router.post("/windows", requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, startTime, endTime, lateEndTime, graceMinutes = 10, enabled = true,
      applicableTeacherIds, exemptTeacherIds, applicableClassIds, exemptStudentIds,
      facultyStartTime, facultyEndTime, facultyLateEndTime, facultyEnabled = true } =
      req.body as Record<string, any>;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Attendance Name is required" });
    }
    if (!startTime || !HH_MM.test(startTime)) {
      return res.status(400).json({ success: false, error: "startTime must be in HH:MM format (24hr)" });
    }
    if (!endTime || !HH_MM.test(endTime)) {
      return res.status(400).json({ success: false, error: "endTime must be in HH:MM format (24hr)" });
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res.status(400).json({ success: false, error: "On-time To must be after On-time From" });
    }
    // Late-till is optional; defaults to endTime (no late zone).
    const lateEnd = lateEndTime && String(lateEndTime).trim() ? String(lateEndTime).trim() : endTime;
    if (!HH_MM.test(lateEnd)) {
      return res.status(400).json({ success: false, error: "lateEndTime must be in HH:MM format (24hr)" });
    }
    if (toMinutes(lateEnd) < toMinutes(endTime)) {
      return res.status(400).json({ success: false, error: "Late-till must be at or after On-time To" });
    }

    let facultyTimer: { start: string; end: string; late: string } | null = null;
    const fs = facultyStartTime && String(facultyStartTime).trim() ? String(facultyStartTime).trim() : null;
    const fe = facultyEndTime && String(facultyEndTime).trim() ? String(facultyEndTime).trim() : null;
    const flRaw = facultyLateEndTime && String(facultyLateEndTime).trim() ? String(facultyLateEndTime).trim() : fe;

    if ((fs && !fe) || (!fs && fe)) {
      return res.status(400).json({ success: false, error: "Faculty timer requires both On-time From and On-time To" });
    }
    if (fs && fe) {
      const fl = facultyLateEndTime && String(facultyLateEndTime).trim() ? String(facultyLateEndTime).trim() : fe;
      if (!HH_MM.test(fs) || !HH_MM.test(fe)) {
        return res.status(400).json({ success: false, error: "Faculty times must be in HH:MM format (24hr)" });
      }
      if (toMinutes(fe) <= toMinutes(fs)) {
        return res.status(400).json({ success: false, error: "Faculty On-time To must be after On-time From" });
      }
      if (!HH_MM.test(fl) || toMinutes(fl) < toMinutes(fe)) {
        return res.status(400).json({ success: false, error: "Faculty Late-till must be at or after On-time To" });
      }
      facultyTimer = { start: fs, end: fe, late: fl };
    }

    const applicableTeachers = Array.isArray(applicableTeacherIds)
      ? applicableTeacherIds.filter((id) => typeof id === "string" && id.trim()).map((id) => String(id).trim())
      : [];
    const exemptTeachers = Array.isArray(exemptTeacherIds)
      ? exemptTeacherIds.filter((id) => typeof id === "string" && id.trim()).map((id) => String(id).trim())
      : [];
    const applicableClasses = Array.isArray(applicableClassIds)
      ? applicableClassIds.filter((id) => typeof id === "string" && id.trim()).map((id) => String(id).trim())
      : [];
    const exemptStudents = Array.isArray(exemptStudentIds)
      ? exemptStudentIds.filter((id) => typeof id === "string" && id.trim()).map((id) => String(id).trim())
      : [];

    const grace = Math.min(180, Math.max(0, Math.round(Number(graceMinutes) || 0)));
    const id = `window_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const created = await prisma.biometricScanWindow.create({
      data: {
        id,
        name: name.trim(),
        startTime,
        endTime,
        lateEndTime: lateEnd,
        graceMinutes: grace,
        enabled: Boolean(enabled),
        applicableTeacherIds: applicableTeachers,
        exemptTeacherIds: exemptTeachers,
        applicableClassIds: applicableClasses,
        exemptStudentIds: exemptStudents,
        ...(facultyTimer
          ? {
              facultyStartTime: facultyTimer.start,
              facultyEndTime: facultyTimer.end,
              facultyLateEndTime: facultyTimer.late,
              facultyEnabled: Boolean(facultyEnabled),
            }
          : {}),
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Create attendance window error:", error);
    return res.status(500).json({ success: false, error: "Failed to create attendance schedule window" });
  }
});

// PUT /api/admin/attendance/schedule/windows/:id - Update an attendance window
router.put("/windows/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, startTime, endTime, lateEndTime, graceMinutes, enabled,
      applicableTeacherIds, exemptTeacherIds, applicableClassIds, exemptStudentIds,
      facultyStartTime, facultyEndTime, facultyLateEndTime, facultyEnabled
    } = req.body as Record<string, any>;

    const existing = await prisma.biometricScanWindow.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Attendance window not found" });
    }

    const updateData: Record<string, any> = {};

    if (name !== undefined) {
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, error: "Attendance Name cannot be empty" });
      }
      updateData.name = name.trim();
    }

    if (startTime !== undefined) {
      if (!startTime || !HH_MM.test(startTime)) {
        return res.status(400).json({ success: false, error: "startTime must be in HH:MM format (24hr)" });
      }
      updateData.startTime = startTime;
    }

    if (endTime !== undefined) {
      if (!endTime || !HH_MM.test(endTime)) {
        return res.status(400).json({ success: false, error: "endTime must be in HH:MM format (24hr)" });
      }
      updateData.endTime = endTime;
    }

    if (lateEndTime !== undefined) {
      const lateEnd = lateEndTime && String(lateEndTime).trim() ? String(lateEndTime).trim() : null;
      if (lateEnd !== null && !HH_MM.test(lateEnd)) {
        return res.status(400).json({ success: false, error: "lateEndTime must be in HH:MM format (24hr)" });
      }
      updateData.lateEndTime = lateEnd;
    }

    // Cross-validate the two-time rule after applying pending updates
    const finalStart = updateData.startTime ?? existing.startTime;
    const finalEnd = updateData.endTime ?? existing.endTime;
    const finalLate = updateData.lateEndTime !== undefined ? updateData.lateEndTime : ((existing as any).lateEndTime ?? existing.endTime);
    if (toMinutes(finalEnd) <= toMinutes(finalStart)) {
      return res.status(400).json({ success: false, error: "On-time To must be after On-time From" });
    }
    if (finalLate !== null && toMinutes(finalLate) < toMinutes(finalEnd)) {
      return res.status(400).json({ success: false, error: "Late-till must be at or after On-time To" });
    }

    // Faculty timer (same event): partial updates allowed; clearing is done
    // by sending empty strings.
    if (
      facultyStartTime !== undefined ||
      facultyEndTime !== undefined ||
      facultyLateEndTime !== undefined
    ) {
      const ex = existing as any;
      const norm = (v: unknown, fallback: string | null) =>
        v !== undefined ? (v && String(v).trim() ? String(v).trim() : null) : fallback;
      const fs = norm(facultyStartTime, ex.facultyStartTime ?? null);
      const fe = norm(facultyEndTime, ex.facultyEndTime ?? null);
      const fl = norm(facultyLateEndTime, ex.facultyLateEndTime ?? ex.facultyEndTime ?? null);
      if ((fs && !fe) || (!fs && fe)) {
        return res.status(400).json({ success: false, error: "Faculty timer needs both On-time From and To (or clear both)" });
      }
      if (fs && fe) {
        if (!HH_MM.test(fs) || !HH_MM.test(fe)) {
          return res.status(400).json({ success: false, error: "Faculty start/end must be in HH:MM format (24hr)" });
        }
        if (toMinutes(fe) <= toMinutes(fs)) {
          return res.status(400).json({ success: false, error: "Faculty On-time To must be after On-time From" });
        }
        const flFinal = fl ?? fe;
        if (!HH_MM.test(flFinal) || toMinutes(flFinal) < toMinutes(fe)) {
          return res.status(400).json({ success: false, error: "Faculty Late-till must be at or after On-time To" });
        }
        updateData.facultyStartTime = fs;
        updateData.facultyEndTime = fe;
        updateData.facultyLateEndTime = flFinal;
      } else {
        updateData.facultyStartTime = null;
        updateData.facultyEndTime = null;
        updateData.facultyLateEndTime = null;
      }
    }

    if (facultyEnabled !== undefined) {
      updateData.facultyEnabled = Boolean(facultyEnabled);
    }

    if (graceMinutes !== undefined) {
      updateData.graceMinutes = Math.min(180, Math.max(0, Math.round(Number(graceMinutes) || 0)));
    }

    if (enabled !== undefined) {
      updateData.enabled = Boolean(enabled);
    }

    if (applicableTeacherIds !== undefined) {
      if (!Array.isArray(applicableTeacherIds)) {
        return res.status(400).json({ success: false, error: "applicableTeacherIds must be an array of teacher ids" });
      }
      updateData.applicableTeacherIds = applicableTeacherIds
        .filter((v) => typeof v === "string" && (v as string).trim())
        .map((v) => String(v).trim());
    }

    if (exemptTeacherIds !== undefined) {
      if (!Array.isArray(exemptTeacherIds)) {
        return res.status(400).json({ success: false, error: "exemptTeacherIds must be an array of teacher ids" });
      }
      updateData.exemptTeacherIds = exemptTeacherIds
        .filter((v) => typeof v === "string" && (v as string).trim())
        .map((v) => String(v).trim());
    }

    if (applicableClassIds !== undefined) {
      if (!Array.isArray(applicableClassIds)) {
        return res.status(400).json({ success: false, error: "applicableClassIds must be an array of class ids" });
      }
      updateData.applicableClassIds = applicableClassIds
        .filter((v) => typeof v === "string" && (v as string).trim())
        .map((v) => String(v).trim());
    }

    if (exemptStudentIds !== undefined) {
      if (!Array.isArray(exemptStudentIds)) {
        return res.status(400).json({ success: false, error: "exemptStudentIds must be an array of student ids" });
      }
      updateData.exemptStudentIds = exemptStudentIds
        .filter((v) => typeof v === "string" && (v as string).trim())
        .map((v) => String(v).trim());
    }

    const updated = await prisma.biometricScanWindow.update({
      where: { id },
      data: updateData,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update attendance window error:", error);
    return res.status(500).json({ success: false, error: "Failed to update attendance schedule window" });
  }
});

// DELETE /api/admin/attendance/schedule/windows/:id - Delete attendance window
router.delete("/windows/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const count = await prisma.biometricScanWindow.count();
    if (count <= 1) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete the only remaining attendance schedule window.",
      });
    }

    await prisma.biometricScanWindow.delete({ where: { id } });
    return res.json({ success: true, message: "Attendance window removed" });
  } catch (error) {
    console.error("Delete attendance window error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete attendance schedule window" });
  }
});

// ── 2. CLASSES: Class-wise Timetable Attendance Schedules ──

// GET /api/admin/attendance/schedule/classes - List class attendance timetable slots
router.get("/classes", requireRole("ADMIN"), async (_req, res) => {
  try {
    const slots = await prisma.timetableSlot.findMany({
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
            section: true,
            subject: true,
            teacher: {
              select: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });

    const classes = await prisma.class.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        grade: true,
        section: true,
        subject: true,
        teacher: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
    });

    return res.json({
      success: true,
      data: {
        slots: slots.map((s) => ({
          id: s.id,
          classId: s.classId,
          className: s.class?.name || (s.isBreak ? (s.breakName || "Break") : "Class"),
          grade: s.class?.grade || "",
          section: s.class?.section || "",
          subject: s.subject || s.class?.subject || "",
          teacherName: s.class ? `${s.class.teacher.user.firstName} ${s.class.teacher.user.lastName}` : "",
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
          teacherName: `${c.teacher.user.firstName} ${c.teacher.user.lastName}`,
        })),
      },
    });
  } catch (error) {
    console.error("Fetch class attendance schedule error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch class timetable schedule" });
  }
});

// ── 3. EXCEL / CSV DOWNLOAD ──

// GET /api/admin/attendance/schedule/export - Download schedule as Excel sheet
router.get("/export", requireRole("ADMIN"), async (req, res) => {
  try {
    const type = (req.query.type as string) || "ALL_STUDENTS"; // "ALL_STUDENTS" | "CLASSES" | "ROSTER"
    const todayStr = new Date().toISOString().slice(0, 10);

    if (type === "CLASSES") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const slots = await prisma.timetableSlot.findMany({
        include: {
          class: {
            include: {
              teacher: {
                include: { user: true },
              },
            },
          },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
      });

      const headers = [
        "Day of Week",
        "Period",
        "Attendance / Subject Name",
        "Class Name",
        "Grade",
        "Section",
        "Teacher in Charge",
        "Start Time",
        "End Time",
        "Room Number",
        "Type",
      ];

      const rows = slots.map((s) => [
        `"${days[s.dayOfWeek] || `Day ${s.dayOfWeek}`}"`,
        s.period,
        `"${(s.subject || s.class?.subject || s.breakName || "Attendance").replace(/"/g, '""')}"`,
        `"${(s.class?.name || (s.isBreak ? "Break" : "Class")).replace(/"/g, '""')}"`,
        `"${s.class?.grade || ""}"`,
        `"${s.class?.section || ""}"`,
        `"${(s.class?.teacher?.user ? `${s.class.teacher.user.firstName} ${s.class.teacher.user.lastName}` : "").replace(/"/g, '""')}"`,
        `"${s.startTime}"`,
        `"${s.endTime}"`,
        `"${s.roomNumber || ""}"`,
        s.isBreak ? "Break" : "Class Attendance",
      ]);

      // Excel BOM \uFEFF for proper UTF-8 handling in Microsoft Excel
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="Class_Attendance_Schedule_${todayStr}.csv"`);
      return res.status(200).send(csvContent);
    }

    if (type === "ROSTER") {
      // Export current day or selected date attendance roster
      const dateStr = (req.query.date as string) || todayStr;
      const targetDate = new Date(`${dateStr}T00:00:00Z`);
      const dateEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

      const [students, studentRecords, teachers, teacherRecords, scanWindows] = await Promise.all([
        prisma.studentProfile.findMany({
          where: { user: { isActive: true } },
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
        }),
        prisma.attendanceRecord.findMany({
          where: { date: { gte: targetDate, lt: dateEnd } },
        }),
        prisma.teacherProfile.findMany({
          where: { user: { isActive: true } },
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: [{ employeeId: "asc" }],
        }),
        prisma.teacherAttendanceRecord.findMany({
          where: { date: { gte: targetDate, lt: dateEnd } },
        }),
        prisma.biometricScanWindow.findMany({
          orderBy: { startTime: "asc" },
        }),
      ]);

      const studentAttMap = new Map<string, (typeof studentRecords)[0]>();
      for (const r of studentRecords) {
        if (!studentAttMap.has(r.studentId)) studentAttMap.set(r.studentId, r);
      }

      const teacherAttMap = new Map<string, (typeof teacherRecords)[0]>();
      for (const r of teacherRecords) {
        if (!teacherAttMap.has(r.teacherId)) teacherAttMap.set(r.teacherId, r);
      }

      const headers = [
        "Profile Pic",
        "Name",
        "Talabat / Teacher",
        "Talabat Grade / Department",
        "Date",
        "Attendance Time",
        "Event (Scheduled Scan)",
        "Status",
      ];

      const formattedDate = targetDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });

      const rows: string[][] = [];

      for (const s of students) {
        const att = studentAttMap.get(s.id);
        const name = `${s.user.firstName} ${s.user.lastName}`.trim();
        const pic = s.user.avatarUrl || "--";
        const gradeSection = s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`;
        const status = att ? att.status : "ABSENT";
        const time = att?.checkInTime
          ? new Date(att.checkInTime).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })
          : "--";

        rows.push([
          `"${pic.replace(/"/g, '""')}"`,
          `"${name.replace(/"/g, '""')}"`,
          `"Talabat"`,
          `"${gradeSection.replace(/"/g, '""')}"`,
          `"${formattedDate}"`,
          `"${time}"`,
          `"${matchRosterEvent(att?.checkInTime, scanWindows, false).replace(/"/g, '""')}"`,
          `"${status}"`,
        ]);
      }

      for (const t of teachers) {
        const att = teacherAttMap.get(t.id);
        const name = `${t.user.firstName} ${t.user.lastName}`.trim();
        const pic = t.user.avatarUrl || (t as any).photoUrl || "--";
        const department = t.department || (t as any).roleTitle || "Faculty";
        const status = att ? att.status : "ABSENT";
        const time = att?.checkInTime
          ? new Date(att.checkInTime).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })
          : "--";

        rows.push([
          `"${pic.replace(/"/g, '""')}"`,
          `"${name.replace(/"/g, '""')}"`,
          `"Teacher"`,
          `"${department.replace(/"/g, '""')}"`,
          `"${formattedDate}"`,
          `"${time}"`,
          `"${matchRosterEvent(att?.checkInTime, scanWindows, true).replace(/"/g, '""')}"`,
          `"${status}"`,
        ]);
      }

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="Attendance_Roster_${dateStr}.csv"`);
      return res.status(200).send(csvContent);
    }

    // Default: ALL_STUDENTS General Attendance Schedule
    const windows = await prisma.biometricScanWindow.findMany({
      orderBy: { startTime: "asc" },
    });

    const headers = [
      "Schedule ID",
      "Attendance Name",
      "Target Audience",
      "On-Time From (24h)",
      "On-Time To (24h)",
      "Late Till (24h)",
      "Grace Period (Minutes)",
      "Applies To (Faculty)",
      "Status",
      "Created At",
      "Last Updated",
    ];

    const rows = windows.map((w) => [
      `"${w.id}"`,
      `"${w.name.replace(/"/g, '""')}"`,
      `"All Students (School-wide)"`,
      `"${w.startTime}"`,
      `"${w.endTime}"`,
      `"${((w as any).lateEndTime ?? w.endTime)}"`,
      w.graceMinutes,
      `"${((((w as any).applicableTeacherIds ?? []) as string[]).length > 0 ? ((w as any).applicableTeacherIds as string[]).join("; ") : "All").replace(/"/g, '""')}"`,
      w.enabled ? "Active / Enabled" : "Disabled",
      `"${w.createdAt.toISOString().slice(0, 10)}"`,
      `"${w.updatedAt.toISOString().slice(0, 10)}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="All_Students_Attendance_Schedule_${todayStr}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Schedule export error:", error);
    return res.status(500).json({ success: false, error: "Failed to export attendance schedule" });
  }
});

// ── 3. AUTOMATED ABSENT MARKING ──

// GET /api/admin/attendance/schedule/auto-absent-preview - Preview unscanned students for today
router.get("/auto-absent-preview", requireRole("ADMIN"), async (req, res) => {
  try {
    const dayStart = getStartOfDayIST(req.query.date as string || new Date());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const totalStudents = await prisma.studentProfile.count({
      where: { user: { isActive: true } },
    });

    const presentOrLogged = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: dayStart, lt: dayEnd },
      },
      select: { studentId: true, status: true },
    });

    // Count active medical exemptions
    const medicalExemptions = await prisma.medicalExemption.findMany({
      where: {
        personType: "STUDENT",
        date: dayStart,
        isActive: true,
      },
      select: { studentId: true },
    });

    const loggedStudentIds = new Set(presentOrLogged.map((r) => r.studentId));
    const medicalStudentIds = new Set(medicalExemptions.map((m) => m.studentId).filter(Boolean));
    const unscannedCount = Math.max(0, totalStudents - loggedStudentIds.size - medicalStudentIds.size);

    return res.json({
      success: true,
      data: {
        totalStudents,
        loggedCount: loggedStudentIds.size,
        medicalCount: medicalStudentIds.size,
        unscannedCount,
        targetDate: dayStart.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Auto-absent preview error:", error);
    return res.status(500).json({ success: false, error: "Failed to load unscanned preview" });
  }
});

// POST /api/admin/attendance/schedule/auto-mark-absent - On-demand trigger to mark unscanned students as absent
router.post("/auto-mark-absent", requireRole("ADMIN"), async (req, res) => {
  try {
    const { date } = req.body as { date?: string };
    const targetDate = date ? new Date(date) : undefined;
    const result = await runAutoMarkAbsentJob(targetDate);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Auto-mark absent error:", error);
    return res.status(500).json({ success: false, error: "Failed to execute auto-mark absent job" });
  }
});

// GET /api/admin/attendance/schedule/faculty-absent-preview - Preview expected vs unscanned faculty for today
router.get("/faculty-absent-preview", requireRole("ADMIN"), async (req, res) => {
  try {
    const dayStart = getStartOfDayIST(req.query.date as string || new Date());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const expected = await getExpectedFacultyForDay();
    const logged = await prisma.teacherAttendanceRecord.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      select: { teacherId: true },
    });

    const medicalExemptions = await prisma.medicalExemption.findMany({
      where: {
        personType: "TEACHER",
        date: dayStart,
        isActive: true,
      },
      select: { teacherId: true },
    });

    const loggedIds = new Set(logged.map((r) => r.teacherId));
    const medicalTeacherIds = new Set(medicalExemptions.map((m) => m.teacherId).filter(Boolean));
    const unscanned = expected.filter((t) => !loggedIds.has(t.id) && !medicalTeacherIds.has(t.id));
    const allActive = await prisma.teacherProfile.count({ where: { user: { isActive: true } } });

    return res.json({
      success: true,
      data: {
        totalExpected: expected.length,
        loggedCount: expected.filter((t) => loggedIds.has(t.id)).length,
        medicalCount: expected.filter((t) => medicalTeacherIds.has(t.id)).length,
        unscannedCount: unscanned.length,
        outOfRosterCount: Math.max(0, allActive - expected.length),
        rosterScoped: expected.length !== allActive,
        targetDate: dayStart.toISOString().slice(0, 10),
        unscannedTeachers: unscanned,
      },
    });
  } catch (error) {
    console.error("Faculty absent preview error:", error);
    return res.status(500).json({ success: false, error: "Failed to load faculty unscanned preview" });
  }
});

// POST /api/admin/attendance/schedule/auto-mark-faculty-absent - Mark unscanned expected faculty as absent
router.post("/auto-mark-faculty-absent", requireRole("ADMIN"), async (req, res) => {
  try {
    const { date } = req.body as { date?: string };
    const targetDate = date ? new Date(date) : undefined;
    const result = await runAutoMarkFacultyAbsentJob(targetDate);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Faculty auto-mark absent error:", error);
    return res.status(500).json({ success: false, error: "Failed to execute faculty auto-mark absent job" });
  }
});

export default router;
