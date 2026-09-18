import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware";
import { completelyDeleteUser } from "../lib/user-deletion";
import {
  processBiometricScan,
  subscribeSse,
  getEvents,
  clearEvents,
  getEventCount,
  getUptimeMs,
  isMockRunning,
  startMock,
  stopMock,
  getUnmatchedFingerprints,
  clearUnmatchedFingerprint,
} from "../lib/biometric";
import { discoverDevices } from "../lib/hikvision/sadp";
import {
  createDevice,
  updateDevice,
  removeDevice,
  testDevice,
  forceSyncDeviceTime,
  syncDeviceScansNow,
  syncAllDevicesScansNow,
  pullDeviceScansForRange,
  pullAllDevicesScansForRange,
  fetchMembersFromDevice,
  fetchAllMembersFromAllDevices,
  toDeviceDto,
  toConnection,
  remoteControlDoor,
  getDoorStatus,
  rebootDevice,
  getDeviceSnapshot,
  getDeviceSystemStatus,
  getAudioVolume,
  setAudioVolume,
  playVoicePrompt,
  deployUserToDevice,
  deleteUserFromDevice,
  deployFaceToDevice,
  deployCardToDevice,
  deployAllStudentsToDevice,
  deployAllTeachersToDevice,
} from "../lib/hikvision";
import { generateDailyAttendanceExcel, generateRangedAttendanceExcel } from "../lib/attendance-excel";
import { eventRangeForRole, hasFacultyTimer, isLegacyFacultyRow } from "../lib/biometric";
import { getLocalLanIp, configureDevicePush, getHttpHosts } from "../lib/hikvision/push";

const router = Router();

// Match a check-in timestamp to its schedule event (unified model: a scan
// belongs to an event when inside EITHER its Talabat timer or faculty timer).
function matchEventForRecord(
  windows: Array<Record<string, any>>,
  isoTime: string | null | undefined,
  preferFaculty: boolean,
) {
  const unscheduled = (name: string) => ({ eventId: "unscheduled", eventName: name, startTime: "--", endTime: "--", lateEndTime: "--" });
  if (!isoTime) return unscheduled("Unscheduled / Outside Window");
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return unscheduled("Unscheduled");
  const t = (((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440) + 1440) % 1440;

  const inWindow = windows.filter((w) => {
    if (!w.enabled) return false;
    const primary = eventRangeForRole(w as any, preferFaculty ? "TEACHER" : "STUDENT");
    if (primary && primary.enabled && t >= primary.startMin && t <= primary.lateMin) return true;
    const secondary = eventRangeForRole(w as any, preferFaculty ? "STUDENT" : "TEACHER");
    return Boolean(secondary && secondary.enabled && t >= secondary.startMin && t <= secondary.lateMin);
  });

  if (inWindow.length === 0) {
    return unscheduled("General Daily Scan");
  }

  // Unified both-timer events serve either audience; legacy rows are strict.
  const serves = (w: Record<string, any>) =>
    hasFacultyTimer(w as any) || isLegacyFacultyRow(w as any)
      ? true
      : !preferFaculty;
  const preferred = inWindow.filter((w) => serves(w));
  const pick = preferred.length > 0 ? preferred[0] : inWindow[0];

  return {
    eventId: pick.id,
    eventName: pick.name,
    startTime: pick.startTime,
    endTime: pick.endTime,
    lateEndTime: pick.lateEndTime ?? pick.endTime,
  };
}

function eventAudience(w: Record<string, any>): "FACULTY" | "ALL_STUDENTS" | "BOTH" {
  if (isLegacyFacultyRow(w as any)) return "FACULTY";
  return hasFacultyTimer(w as any) ? "BOTH" : "ALL_STUDENTS";
}


// GET /api/biometric/status - Gateway / mock status + counts
router.get("/status", requireRole("ADMIN"), async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [scannedToday, fingerprintCount, teacherScannedToday, teacherFingerprintCount] = await Promise.all([
      prisma.attendanceRecord.count({
        where: { date: { gte: todayStart }, verificationMethod: "BIOMETRIC" },
      }),
      prisma.studentProfile.count({ where: { biometricHash: { not: null } } }),
      prisma.teacherAttendanceRecord.count({
        where: { date: { gte: todayStart }, verificationMethod: "BIOMETRIC" },
      }),
      prisma.teacherProfile.count({ where: { biometricHash: { not: null } } }),
    ]);

    return res.json({
      success: true,
      data: {
        mockEnabled: isMockRunning(),
        uptimeMs: getUptimeMs(),
        eventCount: getEventCount(),
        scannedToday,
        fingerprintCount,
        teacherScannedToday,
        teacherFingerprintCount,
        gatewaySecretSet: Boolean(process.env.BIOMETRIC_SECRET),
      },
    });
  } catch (error) {
    console.error("Biometric status error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch status" });
  }
});

// GET /api/biometric/teachers - Faculty list (for enrollment / management)
router.get("/teachers", requireRole("ADMIN"), async (_req, res) => {
  try {
    const teachers = await prisma.teacherProfile.findMany({
      orderBy: [{ user: { firstName: "asc" } }, { employeeId: "asc" }],
      select: {
        id: true,
        employeeId: true,
        department: true,
        biometricHash: true,
        user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
      },
    });

    return res.json({
      success: true,
      data: teachers.map((t) => ({
        id: t.id,
        employeeId: t.employeeId,
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        department: t.department || "General Faculty",
        active: t.user.isActive,
        enrolled: Boolean(t.biometricHash),
        fingerprint: t.biometricHash,
        fingerprintPreview: t.biometricHash ? `${t.biometricHash.slice(0, 10)}…` : null,
      })),
    });
  } catch (error) {
    console.error("Biometric teachers error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch teachers" });
  }
});

// POST /api/biometric/teachers/enroll - Register (or clear) biometric ID for a teacher
router.post("/teachers/enroll", requireRole("ADMIN"), async (req, res) => {
  try {
    const { teacherId, fingerprint } = req.body as Record<string, any>;
    if (!teacherId) {
      return res.status(400).json({ success: false, error: "teacherId is required" });
    }

    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    const fp = typeof fingerprint === "string" && fingerprint.trim() ? fingerprint.trim() : null;

    if (fp) {
      const existing = await prisma.teacherProfile.findUnique({
        where: { biometricHash: fp },
        select: { id: true },
      });
      if (existing && existing.id !== teacher.id) {
        return res
          .status(409)
          .json({ success: false, error: "Biometric ID already enrolled to another teacher" });
      }
    }

    await prisma.teacherProfile.update({
      where: { id: teacher.id },
      data: { biometricHash: fp },
    });

    if (fp) clearUnmatchedFingerprint(fp);

    return res.json({
      success: true,
      data: { teacherId: teacher.id, enrolled: Boolean(fp), fingerprint: fp },
    });
  } catch (error) {
    console.error("Teacher biometric enroll error:", error);
    return res.status(500).json({ success: false, error: "Failed to update teacher enrollment" });
  }
});

// GET /api/biometric/students - Talabat list (for enrollment / simulation)
router.get("/students", requireRole("ADMIN"), async (_req, res) => {
  try {
    const students = await prisma.studentProfile.findMany({
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      select: {
        id: true,
        studentId: true,
        grade: true,
        section: true,
        biometricHash: true,
        user: { select: { firstName: true, lastName: true, isActive: true } },
      },
    });

    return res.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        grade: s.grade,
        section: s.section,
        active: s.user.isActive,
        enrolled: Boolean(s.biometricHash),
        fingerprint: s.biometricHash,
        fingerprintPreview: s.biometricHash ? `${s.biometricHash.slice(0, 10)}…` : null,
      })),
    });
  } catch (error) {
    console.error("Biometric students error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch students" });
  }
});

// POST /api/biometric/enroll - Register (or clear) a fingerprint for a talabat
router.post("/enroll", requireRole("ADMIN"), async (req, res) => {
  try {
    const { studentId, fingerprint } = req.body as Record<string, any>;
    if (!studentId) {
      return res.status(400).json({ success: false, error: "studentId is required" });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ success: false, error: "Talabat not found" });
    }

    const fp = typeof fingerprint === "string" && fingerprint.trim() ? fingerprint.trim() : null;

    if (fp) {
      const existing = await prisma.studentProfile.findUnique({
        where: { biometricHash: fp },
        select: { id: true },
      });
      if (existing && existing.id !== student.id) {
        return res
          .status(409)
          .json({ success: false, error: "Fingerprint already enrolled to another talabat" });
      }
    }

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { biometricHash: fp },
    });

    if (fp) clearUnmatchedFingerprint(fp);

    return res.json({
      success: true,
      data: { studentId: student.id, enrolled: Boolean(fp), fingerprint: fp },
    });
  } catch (error) {
    console.error("Biometric enroll error:", error);
    return res.status(500).json({ success: false, error: "Failed to update enrollment" });
  }
});

// POST /api/biometric/simulate - Fire a synthetic scan (admin testing tool)
router.post("/simulate", requireRole("ADMIN"), async (req, res) => {
  try {
    const { studentId, fingerprint, timestamp, verifyMode } = req.body as Record<string, any>;

    let fp: string | undefined = fingerprint;
    if (!fp && studentId) {
      const profile = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        select: { biometricHash: true },
      });
      fp = profile?.biometricHash ?? undefined;
      if (!fp) {
        return res.status(400).json({
          success: false,
          error: "This talabat has no registered fingerprint. Enroll one first.",
        });
      }
    }

    if (!fp || !fp.trim()) {
      return res.status(400).json({
        success: false,
        error: "studentId or fingerprint is required",
      });
    }

    const event = await processBiometricScan(fp.trim(), timestamp, "simulator", verifyMode);
    return res.json({ success: true, data: event });
  } catch (error) {
    console.error("Biometric simulate error:", error);
    return res.status(500).json({ success: false, error: "Failed to simulate scan" });
  }
});

// POST /api/biometric/face-scan - Instant facial biometric scan for student or teacher
router.post("/face-scan", requireAuth, async (req, res) => {
  try {
    const { studentId, teacherId, itsNumber, verifyMode = "FACIAL" } = req.body as Record<string, any>;

    if (studentId || itsNumber) {
      let profile = null;
      if (studentId) {
        profile = await prisma.studentProfile.findFirst({
          where: {
            OR: [
              { id: studentId },
              { studentId: studentId },
              { its: studentId },
            ],
          },
          include: { user: true },
        });
      } else if (itsNumber) {
        profile = await prisma.studentProfile.findFirst({
          where: {
            OR: [
              { its: itsNumber },
              { studentId: itsNumber },
            ],
          },
          include: { user: true },
        });
      }

      if (!profile) {
        return res.status(404).json({ success: false, error: "Talabat not found for face recognition" });
      }

      const ref = profile.its || profile.studentId || profile.biometricHash || profile.id;
      const event = await processBiometricScan(ref, new Date().toISOString(), "face-camera", "FACIAL");
      const isLate = event.classes?.some((c) => c.status === "LATE") || event.message?.includes("LATE");
      const statusLabel = isLate ? "LATE" : "PRESENT";
      return res.json({
        success: true,
        message: `Face recognized: ${profile.user.firstName} ${profile.user.lastName} marked ${event.type === "DUPLICATE" ? "VERIFIED" : isLate ? "LATE" : "PRESENT"} instantly!`,
        data: {
          ...event,
          status: statusLabel,
        },
      });
    }

    if (teacherId) {
      const teacher = await prisma.teacherProfile.findFirst({
        where: {
          OR: [
            { id: teacherId },
            { employeeId: teacherId },
            { userId: teacherId },
          ],
        },
        include: { user: true },
      });
      if (!teacher) {
        return res.status(404).json({ success: false, error: "Teacher not found" });
      }

      const ref = teacher.employeeId || teacher.id;
      const event = await processBiometricScan(ref, new Date().toISOString(), "face-camera", "FACIAL");
      const isLate = event.teacher?.status === "LATE" || event.message?.includes("LATE");
      const statusLabel = isLate ? "LATE" : "PRESENT";
      return res.json({
        success: true,
        message: `Faculty Face verified: ${teacher.user.firstName} ${teacher.user.lastName} marked ${event.type === "DUPLICATE" ? "VERIFIED" : isLate ? "LATE" : "PRESENT"}!`,
        data: {
          ...event,
          status: statusLabel,
        },
      });
    }

    return res.status(400).json({ success: false, error: "studentId, teacherId, or itsNumber required" });
  } catch (error) {
    console.error("Instant face scan error:", error);
    return res.status(500).json({ success: false, error: "Failed to process face scan" });
  }
});

// POST /api/biometric/events - Ingest from a real gateway/device
// (no session; guarded by the optional shared secret instead)
router.post("/events", async (req, res) => {
  try {
    const secret = process.env.BIOMETRIC_SECRET;
    if (secret) {
      const provided = req.headers["x-biometric-secret"];
      if (provided !== secret) {
        return res.status(401).json({ success: false, error: "Invalid biometric secret" });
      }
    }

    const { fingerprint, timestamp, deviceId, verifyMode } = req.body as Record<string, any>;
    if (typeof fingerprint !== "string" || !fingerprint.trim()) {
      return res.status(400).json({ success: false, error: "fingerprint is required" });
    }

    const event = await processBiometricScan(fingerprint.trim(), timestamp, deviceId ?? null, verifyMode);
    return res.json({ success: true, data: event });
  } catch (error) {
    console.error("Biometric event error:", error);
    return res.status(500).json({ success: false, error: "Failed to process scan" });
  }
});

// GET /api/biometric/events - Recent scan events
router.get("/events", requireRole("ADMIN"), (_req, res) => {
  res.json({ success: true, data: getEvents(200) });
});

// POST /api/biometric/events/clear - Clear realtime scan events
router.post("/events/clear", requireRole("ADMIN"), (req, res) => {
  const { role } = (req.body as { role?: "STUDENT" | "TEACHER" }) || {};
  clearEvents(role);
  res.json({ success: true, message: role ? `${role} events cleared` : "Realtime scan events cleared" });
});

// GET /api/biometric/unmatched - Fingerprints that scanned but matched nobody
router.get("/unmatched", requireRole("ADMIN"), (_req, res) => {
  res.json({ success: true, data: getUnmatchedFingerprints() });
});

// POST /api/biometric/unmatched/clear - Dismiss one (or all) unmatched fingerprints
router.post("/unmatched/clear", requireRole("ADMIN"), (req, res) => {
  const { fingerprint } = req.body as Record<string, any>;
  clearUnmatchedFingerprint(
    typeof fingerprint === "string" && fingerprint.trim() ? fingerprint.trim() : undefined,
  );
  return res.json({ success: true, data: getUnmatchedFingerprints() });
});

// GET /api/biometric/report?date=YYYY-MM-DD - 5-column CSV export of the day's attendance
router.get("/report", requireRole("ADMIN"), async (req, res) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const start = new Date(`${dateStr}T00:00:00Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const audience = ((req.query.audience as string) || "ALL").toUpperCase();
    const [students, studentRecords, teachers, teacherRecords] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { user: { isActive: true } },
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
      }),
      prisma.attendanceRecord.findMany({
        where: { date: { gte: start, lt: end } },
      }),
      prisma.teacherProfile.findMany({
        where: { user: { isActive: true } },
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: [{ employeeId: "asc" }],
      }),
      prisma.teacherAttendanceRecord.findMany({
        where: { date: { gte: start, lt: end } },
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
      "Name",
      "ITS / Employee ID",
      "Grade / Department",
      "Role",
      "Date",
      "Scan Time (IST) - Highlighted",
      "Status - Present/Late/Absent (Highlighted)",
      "Profile Pic",
    ];
    const formattedDate = new Date(start).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });

    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const timeIST = (t: any) => t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "--";
    const out: string[] = [];
    out.push(esc(`DARSE BURHANI — DAILY ATTENDANCE (BIFURCATED) — ${formattedDate}`));
    out.push(esc(`Date: ${dateStr} | Talabat: ${students.length} | Faculty: ${teachers.length} | Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`));
    out.push("");
    const wantStudents = audience === "ALL" || audience === "STUDENT" || audience === "TALABAT";
    const wantFaculty = audience === "ALL" || audience === "FACULTY" || audience === "TEACHER";
    // Build rows with bifurcated sections and ITS + Scan Time highlighted columns
    const headerLine = headers.map((h) => esc(h)).join(",");
    if (wantStudents) {
      out.push(esc("──────── TALABAT (STUDENTS) ────────"));
      out.push(headerLine);
      for (const s of students) {
        const att = studentAttMap.get(s.id);
        const name = `${s.user.firstName} ${s.user.lastName}`.trim();
        const pic = s.user.avatarUrl || "--";
        const itsVal = (s as any).its || s.studentId;
        const gradeSection = s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`;
        const status = att ? att.status : "ABSENT";
        const time = timeIST(att?.checkInTime as any);
        out.push([esc(name), esc(itsVal), esc(gradeSection), esc("Talabat"), esc(formattedDate), esc(time), esc(status), esc(pic)].join(","));
      }
      out.push("");
    }
    if (wantFaculty) {
      out.push(esc("──────── FACULTY (TEACHERS) ────────"));
      out.push(headerLine);

    for (const t of teachers) {
      const att = teacherAttMap.get(t.id);
      const name = `${t.user.firstName} ${t.user.lastName}`.trim();
      const pic = t.user.avatarUrl || (t as any).photoUrl || "--";
      const department = t.department || (t as any).roleTitle || "Faculty";
      const empId = (t as any).employeeId || t.id;
      const status = att ? att.status : "ABSENT";
      const time = timeIST(att?.checkInTime as any);
      out.push([esc(name), esc(empId), esc(department), esc("Faculty"), esc(formattedDate), esc(time), esc(status), esc(pic)].join(","));
      }
    }

    const csv = "\uFEFF" + out.join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    const aud = audience === "ALL" ? "bifurcated" : audience.toLowerCase();
    res.setHeader("Content-Disposition", `attachment; filename="Attendance-${aud}-${dateStr}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Biometric report error:", error);
    return res.status(500).json({ success: false, error: "Failed to export report" });
  }
});

// GET /api/biometric/excel-report?date=YYYY-MM-DD - Professional multi-sheet Excel export
router.get("/excel-report", requireRole("ADMIN"), async (req, res) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const { filename, buffer } = await generateDailyAttendanceExcel({ dateStr });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Biometric excel report error:", error);
    return res.status(500).json({ success: false, error: "Failed to export Excel report" });
  }
});

// GET /api/biometric/excel-range-report?from=YYYY-MM-DD&to=YYYY-MM-DD (max 14 days)
// Day-wise, event-bifurcated attendance log workbook (.xlsx opens directly in Google Sheets)
router.get("/excel-range-report", requireRole("ADMIN"), async (req, res) => {
  try {
    const fromStr = (req.query.from as string) || undefined;
    const toStr = (req.query.to as string) || undefined;
    const { filename, buffer } = await generateRangedAttendanceExcel({ fromStr, toStr });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (error: any) {
    console.error("Biometric excel range report error:", error);
    const message = error?.message || "Failed to export Excel log";
    const status = /maximum 14 days|Invalid from/.test(message) ? 400 : 500;
    return res.status(status).json({ success: false, error: message });
  }
});

// GET /api/biometric/records/today - Combined Talabat & Teacher biometric attendance records with Event Bifurcation
router.get("/records/today", requireRole("ADMIN"), async (req, res) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const eventFilter = (req.query.eventId as string) || (req.query.windowId as string) || "ALL";
    const start = new Date(`${dateStr}T00:00:00Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const [studentRecords, teacherRecords, windows] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { date: { gte: start, lt: end }, verificationMethod: "BIOMETRIC" },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          class: { select: { name: true, subject: true } },
        },
        orderBy: [{ checkInTime: "desc" }],
      }),
      prisma.teacherAttendanceRecord.findMany({
        where: { date: { gte: start, lt: end }, verificationMethod: "BIOMETRIC" },
        include: {
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ checkInTime: "desc" }],
      }),
      prisma.biometricScanWindow.findMany({
        orderBy: { startTime: "asc" },
      }),
    ]);

    const formattedStudents = studentRecords.map((r) => {
      const ev = matchEventForRecord(windows, r.checkInTime ? r.checkInTime.toISOString() : null, false);
      return {
        id: r.id,
        role: "STUDENT" as const,
        personId: r.student.studentId,
        name: `${r.student.user.firstName} ${r.student.user.lastName}`.trim(),
        grade: r.student.grade,
        section: r.student.section,
        details: r.class ? `${r.class.name} (${r.class.subject})` : `Grade ${r.student.grade}-${r.student.section}`,
        status: r.status,
        checkInTime: r.checkInTime ? r.checkInTime.toISOString() : null,
        verificationMethod: r.verificationMethod,
        biometricMethod: r.biometricMethod,
        biometricHash: r.biometricHash,
        eventId: ev.eventId,
        eventName: ev.eventName,
        eventStartTime: ev.startTime,
        eventEndTime: ev.endTime,
        eventLateEndTime: (ev as any).lateEndTime ?? ev.endTime,
      };
    });

    const formattedTeachers = teacherRecords.map((r) => {
      const ev = matchEventForRecord(windows, r.checkInTime ? r.checkInTime.toISOString() : null, true);
      return {
        id: r.id,
        role: "TEACHER" as const,
        personId: r.teacher.employeeId,
        name: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`.trim(),
        grade: null,
        section: null,
        details: r.teacher.department || "Faculty",
        status: r.status,
        checkInTime: r.checkInTime ? r.checkInTime.toISOString() : null,
        verificationMethod: r.verificationMethod,
        biometricMethod: r.biometricMethod,
        biometricHash: r.biometricHash,
        eventId: ev.eventId,
        eventName: ev.eventName,
        eventStartTime: ev.startTime,
        eventEndTime: ev.endTime,
        eventLateEndTime: (ev as any).lateEndTime ?? ev.endTime,
      };
    });

    const allRecords = [...formattedStudents, ...formattedTeachers].sort(
      (a, b) => new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime(),
    );

    // Compute Bifurcated Event Summaries
    const eventSummaries = windows.map((w) => {
      const audience = eventAudience(w as any);
      const studentMatches = formattedStudents.filter((s) => s.eventId === w.id);
      const teacherMatches = formattedTeachers.filter((t) => t.eventId === w.id);
      const presentCount = studentMatches.filter((s) => s.status === "PRESENT").length + teacherMatches.filter((t) => t.status === "PRESENT").length;
      const lateCount = studentMatches.filter((s) => s.status === "LATE").length + teacherMatches.filter((t) => t.status === "LATE").length;

      return {
        id: w.id,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        graceMinutes: w.graceMinutes,
        enabled: w.enabled,
        audience,
        studentCount: studentMatches.length,
        teacherCount: teacherMatches.length,
        totalCount: studentMatches.length + teacherMatches.length,
        presentCount,
        lateCount,
      };
    });

    // Apply eventFilter if specific window selected
    const filteredStudents = eventFilter === "ALL" ? formattedStudents : formattedStudents.filter((s) => s.eventId === eventFilter);
    const filteredTeachers = eventFilter === "ALL" ? formattedTeachers : formattedTeachers.filter((t) => t.eventId === eventFilter);
    const filteredAll = eventFilter === "ALL" ? allRecords : allRecords.filter((r) => r.eventId === eventFilter);

    return res.json({
      success: true,
      data: {
        windows: eventSummaries,
        eventSummaries,
        students: filteredStudents,
        teachers: filteredTeachers,
        all: filteredAll,
        rawStudents: formattedStudents,
        rawTeachers: formattedTeachers,
        rawAll: allRecords,
      },
    });
  } catch (error) {
    console.error("Biometric records today error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch today records" });
  }
});

// GET /api/biometric/records/history - All-days stacked attendance storage
// Query: from=YYYY-MM-DD, to=YYYY-MM-DD (default last 30 days), eventId, role, limit
// Returns per-day stacked buckets (persistent DB storage) + event breakdown + flat records.
router.get("/records/history", requireRole("ADMIN"), async (req, res) => {
  try {
    const toStr = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date(`${toStr}T00:00:00Z`).getTime() - 29 * 24 * 60 * 60 * 1000;
    const fromStr =
      (req.query.from as string) || new Date(fromDefault).toISOString().slice(0, 10);
    const eventFilter = (req.query.eventId as string) || "ALL";
    const roleFilter = ((req.query.role as string) || "ALL").toUpperCase();
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));

    const start = new Date(`${fromStr}T00:00:00Z`);
    const endExclusive = new Date(`${toStr}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;
    const end = new Date(endExclusive);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ success: false, error: "Invalid from/to date range" });
    }

    const [studentRecords, teacherRecords, windows] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { date: { gte: start, lt: end }, verificationMethod: "BIOMETRIC" },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          class: { select: { name: true, subject: true } },
        },
        orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
        take: limit,
      }),
      prisma.teacherAttendanceRecord.findMany({
        where: { date: { gte: start, lt: end }, verificationMethod: "BIOMETRIC" },
        include: {
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
        take: limit,
      }),
      prisma.biometricScanWindow.findMany({ orderBy: { startTime: "asc" } }),
    ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);

    const formattedStudents = studentRecords.map((r) => {
      const ev = matchEventForRecord(windows, r.checkInTime ? r.checkInTime.toISOString() : null, false);
      return {
        id: r.id,
        role: "STUDENT" as const,
        day: dayKey(new Date(r.date)),
        date: r.date.toISOString(),
        personId: r.student.studentId,
        name: `${r.student.user.firstName} ${r.student.user.lastName}`.trim(),
        grade: r.student.grade,
        section: r.student.section,
        details: r.class ? `${r.class.name} (${r.class.subject})` : `Grade ${r.student.grade}-${r.student.section}`,
        status: r.status,
        checkInTime: r.checkInTime ? r.checkInTime.toISOString() : null,
        verificationMethod: r.verificationMethod,
        biometricMethod: r.biometricMethod,
        eventId: ev.eventId,
        eventName: ev.eventName,
        eventStartTime: ev.startTime,
        eventEndTime: ev.endTime,
        eventLateEndTime: (ev as any).lateEndTime ?? ev.endTime,
      };
    });

    const formattedTeachers = teacherRecords.map((r) => {
      const ev = matchEventForRecord(windows, r.checkInTime ? r.checkInTime.toISOString() : null, true);
      return {
        id: r.id,
        role: "TEACHER" as const,
        day: dayKey(new Date(r.date)),
        date: r.date.toISOString(),
        personId: r.teacher.employeeId,
        name: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`.trim(),
        grade: null,
        section: null,
        details: r.teacher.department || "Faculty",
        status: r.status,
        checkInTime: r.checkInTime ? r.checkInTime.toISOString() : null,
        verificationMethod: r.verificationMethod,
        biometricMethod: r.biometricMethod,
        eventId: ev.eventId,
        eventName: ev.eventName,
        eventStartTime: ev.startTime,
        eventEndTime: ev.endTime,
        eventLateEndTime: (ev as any).lateEndTime ?? ev.endTime,
      };
    });

    let all = [...formattedStudents, ...formattedTeachers].sort(
      (a, b) => new Date(b.checkInTime || b.date).getTime() - new Date(a.checkInTime || a.date).getTime(),
    );
    if (eventFilter !== "ALL") all = all.filter((r) => r.eventId === eventFilter);
    if (roleFilter === "STUDENT" || roleFilter === "TEACHER") all = all.filter((r) => r.role === roleFilter);

    // Stack per day (storage buckets) — every day in range appears, even with zero scans.
    const days: Array<{
      date: string;
      total: number;
      present: number;
      late: number;
      students: number;
      teachers: number;
      byEvent: Record<string, number>;
    }> = [];
    const byDay = new Map<string, typeof all>();
    for (const r of all) {
      const arr = byDay.get(r.day) || [];
      arr.push(r);
      byDay.set(r.day, arr);
    }
    const cursor = new Date(start);
    while (cursor < end) {
      const key = dayKey(cursor);
      const recs = byDay.get(key) || [];
      const byEvent: Record<string, number> = {};
      for (const r of recs) byEvent[r.eventId] = (byEvent[r.eventId] || 0) + 1;
      days.push({
        date: key,
        total: recs.length,
        present: recs.filter((r) => r.status === "PRESENT").length,
        late: recs.filter((r) => r.status === "LATE").length,
        students: recs.filter((r) => r.role === "STUDENT").length,
        teachers: recs.filter((r) => r.role === "TEACHER").length,
        byEvent,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const eventTotals = windows.map((w) => {
      const matches = all.filter((r) => r.eventId === w.id);
      return {
        id: w.id,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        total: matches.length,
        present: matches.filter((m) => m.status === "PRESENT").length,
        late: matches.filter((m) => m.status === "LATE").length,
        students: matches.filter((m) => m.role === "STUDENT").length,
        teachers: matches.filter((m) => m.role === "TEACHER").length,
      };
    });

    return res.json({
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        days,
        eventTotals,
        windows: windows.map((w) => ({ id: w.id, name: w.name, startTime: w.startTime, endTime: w.endTime })),
        records: all.slice(0, limit),
        totals: {
          total: all.length,
          present: all.filter((r) => r.status === "PRESENT").length,
          late: all.filter((r) => r.status === "LATE").length,
          students: all.filter((r) => r.role === "STUDENT").length,
          teachers: all.filter((r) => r.role === "TEACHER").length,
        },
      },
    });
  } catch (error) {
    console.error("Biometric records history error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stacked history" });
  }
});

// GET /api/biometric/events/stream - Server-Sent Events live feed across portals
router.get("/events/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const send = (payload: string) => res.write(payload);
  const unsubscribe = subscribeSse(send);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// GET /api/biometric/network-info - Network LAN IPs and webhook URL for device linking
router.get("/network-info", requireRole("ADMIN"), (_req, res) => {
  const lanIp = getLocalLanIp();
  const pushUrl = `http://${lanIp}:4000/api/hikvision/events`;
  return res.json({
    success: true,
    data: {
      lanIp,
      port: 4000,
      pushUrl,
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/biometric/window - The school's daily scan event timers (Talabat & Faculty timers of the unified event)
router.get("/window", requireRole("ADMIN"), async (req, res) => {
  try {
    const roleQuery = (req.query.role as string)?.toUpperCase();

    // Ensure the primary unified event exists (carries BOTH timers)
    let primary = await prisma.biometricScanWindow.findUnique({ where: { id: "default" } });
    if (!primary) {
      primary = await prisma.biometricScanWindow.create({
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
    }

    // Self-heal legacy split rows: merge any leftover standalone faculty row
    // into the unified event, then retire it.
    const legacy = await prisma.biometricScanWindow.findFirst({
      where: {
        id: { not: "default" },
        OR: [
          { id: "faculty_default" },
          { id: "faculty" },
          { name: { contains: "Faculty", mode: "insensitive" } },
          { name: { contains: "Teacher", mode: "insensitive" } },
        ],
      },
    });
    if (legacy && !(primary as any).facultyStartTime) {
      primary = await prisma.biometricScanWindow.update({
        where: { id: "default" },
        data: {
          facultyStartTime: legacy.startTime,
          facultyEndTime: legacy.endTime,
          facultyLateEndTime: (legacy as any).lateEndTime ?? legacy.endTime,
          facultyEnabled: legacy.enabled,
        },
      });
      await prisma.biometricScanWindow.delete({ where: { id: legacy.id } }).catch(() => {});
    } else if (legacy && legacy.id === "faculty_default") {
      // Timers already unified — retire the redundant legacy row.
      await prisma.biometricScanWindow.delete({ where: { id: legacy.id } }).catch(() => {});
    }

    const p = primary as any;
    const student = {
      id: p.id,
      name: p.name,
      startTime: p.startTime,
      endTime: p.endTime,
      lateEndTime: p.lateEndTime ?? p.endTime,
      graceMinutes: p.graceMinutes,
      enabled: p.enabled,
    };
    const faculty = {
      id: p.id,
      name: p.name,
      startTime: p.facultyStartTime ?? p.startTime,
      endTime: p.facultyEndTime ?? p.endTime,
      lateEndTime: p.facultyLateEndTime ?? p.facultyEndTime ?? p.endTime,
      graceMinutes: p.graceMinutes,
      enabled: p.facultyEnabled ?? true,
      unified: true,
    };

    if (roleQuery === "TEACHER") {
      return res.json({ success: true, data: faculty, student, faculty });
    }

    return res.json({
      success: true,
      data: student,
      student,
      faculty,
    });
  } catch (error) {
    console.error("Biometric window fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch scan window" });
  }
});

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// PUT /api/biometric/window - Update scan timers on the unified schedule event (admin only)
// Two-time rule per role: [startTime, endTime] => PRESENT (on-time), (endTime, lateEndTime] => LATE.
// role=TEACHER (or faculty timer fields) updates the FACULTY timer of the same event;
// otherwise the Talabat timer is updated. Legacy standalone faculty rows are
// merged into the unified event on write.
router.put("/window", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id, role, name, startTime, endTime, lateEndTime, graceMinutes, enabled, applicableTeacherIds,
      facultyStartTime, facultyEndTime, facultyLateEndTime, facultyEnabled } =
      req.body as Record<string, any>;

    const wantsFacultyTimer =
      role === "TEACHER" ||
      id === "faculty_default" ||
      facultyStartTime !== undefined ||
      facultyEndTime !== undefined ||
      facultyLateEndTime !== undefined ||
      facultyEnabled !== undefined;

    // Resolve the unified target event (merge away legacy faculty rows).
    let targetId = id && id !== "faculty_default" ? String(id) : "default";
    let existing = await prisma.biometricScanWindow.findUnique({ where: { id: targetId } });
    if (!existing && targetId !== "default") {
      return res.status(404).json({ success: false, error: "Schedule event not found" });
    }
    if (!existing) {
      existing = await prisma.biometricScanWindow.create({
        data: {
          id: "default",
          name: typeof name === "string" && name.trim() ? name.trim() : "Tilawat al Dua",
          startTime: "07:30",
          endTime: "08:15",
          lateEndTime: "08:15",
          graceMinutes: 10,
          enabled: true,
        },
      });
      targetId = "default";
    }
    // Merge legacy standalone faculty row into the unified event.
    if (id === "faculty_default" || (existing as any).id === "faculty_default") {
      const legacy = await prisma.biometricScanWindow.findUnique({ where: { id: "faculty_default" } });
      const primary = await prisma.biometricScanWindow.findUnique({ where: { id: "default" } });
      if (legacy && primary && legacy.id !== primary.id) {
        await prisma.biometricScanWindow.update({
          where: { id: "default" },
          data: {
            facultyStartTime: (primary as any).facultyStartTime ?? legacy.startTime,
            facultyEndTime: (primary as any).facultyEndTime ?? legacy.endTime,
            facultyLateEndTime:
              (primary as any).facultyLateEndTime ?? ((legacy as any).lateEndTime ?? legacy.endTime),
            facultyEnabled: (primary as any).facultyEnabled ?? legacy.enabled,
          },
        });
        await prisma.biometricScanWindow.delete({ where: { id: legacy.id } }).catch(() => {});
        existing = (await prisma.biometricScanWindow.findUnique({ where: { id: "default" } })) ?? existing;
        targetId = "default";
      }
    }

    const isTeacherName =
      role === "TEACHER" || (typeof name === "string" && /faculty|teacher|staff/i.test(name));
    const defaultName = isTeacherName && !existing ? "Faculty Reporting & Briefing" : "Tilawat al Dua";
    const windowName = typeof name === "string" && name.trim() ? name.trim() : (existing?.name ?? defaultName);

    const validateTimer = (
      s: unknown,
      e: unknown,
      l: unknown,
      label: string,
    ): { start: string; end: string; late: string } | null => {
      if (s === undefined && e === undefined && l === undefined) return null;
      const ex = existing as any;
      const start = s !== undefined ? String(s) : wantsFacultyTimer
        ? (ex.facultyStartTime ?? ex.startTime) : ex.startTime;
      const end = e !== undefined ? String(e) : wantsFacultyTimer
        ? (ex.facultyEndTime ?? ex.endTime) : ex.endTime;
      const lateRaw = l !== undefined ? String(l) : wantsFacultyTimer
        ? (ex.facultyLateEndTime ?? ex.facultyEndTime ?? ex.endTime)
        : (ex.lateEndTime ?? ex.endTime);
      const late = lateRaw && lateRaw.trim() ? lateRaw.trim() : end;
      if (!HH_MM.test(start) || !HH_MM.test(end)) {
        throw new Error(`${label} start/end must be HH:MM`);
      }
      if (toMinutes(end) <= toMinutes(start)) {
        throw new Error(`${label} On-time To must be later than On-time From`);
      }
      if (!HH_MM.test(late)) {
        throw new Error(`${label} lateEndTime must be HH:MM`);
      }
      if (toMinutes(late) < toMinutes(end)) {
        throw new Error(`${label} Late-till must be at or after On-time To`);
      }
      return { start, end, late };
    };

    let studentTimer: { start: string; end: string; late: string } | null = null;
    let facultyTimer: { start: string; end: string; late: string } | null = null;
    try {
      if (wantsFacultyTimer) {
        facultyTimer = validateTimer(facultyStartTime ?? (role === "TEACHER" ? startTime : undefined),
          facultyEndTime ?? (role === "TEACHER" ? endTime : undefined),
          facultyLateEndTime ?? (role === "TEACHER" ? lateEndTime : undefined), "Faculty");
        // With role=TEACHER the legacy time fields address the faculty timer.
        if (!facultyTimer && role === "TEACHER") {
          facultyTimer = validateTimer(startTime, endTime, lateEndTime, "Faculty");
        }
        if (role !== "TEACHER") {
          studentTimer = validateTimer(startTime, endTime, lateEndTime, "Talabat");
        }
      } else {
        studentTimer = validateTimer(startTime, endTime, lateEndTime, "Talabat");
      }
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err?.message || "Invalid timer" });
    }

    const grace = graceMinutes !== undefined
      ? Math.min(180, Math.max(0, Math.round(Number(graceMinutes) || 0)))
      : undefined;

    let applicable: string[] | undefined;
    if (applicableTeacherIds !== undefined) {
      if (!Array.isArray(applicableTeacherIds)) {
        return res.status(400).json({ success: false, error: "applicableTeacherIds must be an array" });
      }
      applicable = applicableTeacherIds.filter((v) => typeof v === "string" && (v as string).trim()).map((v) => String(v).trim());
    }

    const data: Record<string, any> = {
      name: windowName,
      ...(studentTimer ? { startTime: studentTimer.start, endTime: studentTimer.end, lateEndTime: studentTimer.late } : {}),
      ...(facultyTimer ? { facultyStartTime: facultyTimer.start, facultyEndTime: facultyTimer.end, facultyLateEndTime: facultyTimer.late } : {}),
      ...(grace !== undefined ? { graceMinutes: grace } : {}),
      ...(enabled !== undefined && !wantsFacultyTimer ? { enabled: Boolean(enabled) } : {}),
      ...(facultyEnabled !== undefined ? { facultyEnabled: Boolean(facultyEnabled) } : {}),
      ...(enabled !== undefined && role === "TEACHER" && facultyEnabled === undefined
        ? { facultyEnabled: Boolean(enabled) } : {}),
      ...(applicable !== undefined ? { applicableTeacherIds: applicable } : {}),
    };

    const window = await prisma.biometricScanWindow.update({ where: { id: targetId }, data });
    return res.json({ success: true, data: window });
  } catch (error) {
    console.error("Biometric window update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update scan window" });
  }
});

// POST /api/biometric/mock - Toggle the mock device simulator
router.post("/mock", requireRole("ADMIN"), async (req, res) => {
  try {
    const enabled = Boolean((req.body as Record<string, any>)?.enabled);
    if (enabled) {
      await startMock();
    } else {
      stopMock();
    }
    return res.json({ success: true, data: { mockEnabled: isMockRunning() } });
  } catch (error) {
    console.error("Biometric mock toggle error:", error);
    return res.status(500).json({ success: false, error: "Failed to toggle mock device" });
  }
});

// ── Hikvision devices (SADP discovery + ISAPI polling) ──

// POST /api/biometric/discover - SADP LAN search for Hikvision devices
router.post("/discover", requireRole("ADMIN"), async (_req, res) => {
  try {
    const devices = await discoverDevices({ timeoutMs: 4000 });
    return res.json({ success: true, data: devices });
  } catch (error) {
    console.error("Biometric discover error:", error);
    return res.status(500).json({ success: false, error: "Discovery failed" });
  }
});

// GET /api/biometric/devices - Configured Hikvision devices
router.get("/devices", requireRole("ADMIN"), async (_req, res) => {
  try {
    const devices = await prisma.biometricDevice.findMany({ orderBy: { createdAt: "asc" } });
    return res.json({ success: true, data: devices.map(toDeviceDto) });
  } catch (error) {
    console.error("Biometric devices error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch devices" });
  }
});

// POST /api/biometric/devices - Add a Hikvision device
router.post("/devices", requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, host, port, username, password, pollIntervalSeconds, enabled } =
      req.body as Record<string, any>;
    if (!host || typeof host !== "string" || !host.trim()) {
      return res.status(400).json({ success: false, error: "Device IP/hostname is required" });
    }
    const device = await createDevice({
      name,
      host,
      port: Number(port) || 80,
      username,
      password,
      pollIntervalSeconds: Number(pollIntervalSeconds) || 15,
      enabled: Boolean(enabled),
    });
    return res.json({ success: true, data: toDeviceDto(device) });
  } catch (error: any) {
    console.error("Biometric create device error:", error);
    return res.status(500).json({ success: false, error: error?.message ?? "Failed to add device" });
  }
});

// PUT /api/biometric/devices/:id - Update a Hikvision device
router.put("/devices/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, host, port, username, password, pollIntervalSeconds, enabled } =
      req.body as Record<string, any>;
    const device = await updateDevice(req.params.id, {
      name,
      host,
      port: port !== undefined ? Number(port) : undefined,
      username,
      password,
      pollIntervalSeconds: pollIntervalSeconds !== undefined ? Number(pollIntervalSeconds) : undefined,
      enabled: enabled !== undefined ? Boolean(enabled) : undefined,
    });
    return res.json({ success: true, data: toDeviceDto(device) });
  } catch (error: any) {
    console.error("Biometric update device error:", error);
    return res.status(500).json({ success: false, error: error?.message ?? "Failed to update device" });
  }
});

// DELETE /api/biometric/devices/:id - Remove a Hikvision device
router.delete("/devices/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await removeDevice(req.params.id);
    return res.json({ success: true, data: null });
  } catch (error) {
    console.error("Biometric delete device error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete device" });
  }
});

// POST /api/biometric/devices/:id/test - Verify connectivity + credentials
router.post("/devices/:id/test", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await testDevice(req.params.id);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    const device = await prisma.biometricDevice
      .update({
        where: { id: req.params.id },
        data: { status: "ERROR", lastError: message, lastPolledAt: new Date() },
      })
      .catch(() => null);
    return res.status(200).json({
      success: false,
      error: message,
      data: device ? toDeviceDto(device) : null,
    });
  }
});

// POST /api/biometric/devices/:id/sync-time - Synchronize terminal clock with server time
router.post("/devices/:id/sync-time", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await forceSyncDeviceTime(req.params.id);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    console.warn(`[biometric] Sync time failed for device ${req.params.id}:`, message);
    return res.status(200).json({
      success: false,
      error: message.includes("ETIMEDOUT") || message.includes("EHOSTUNREACH") || message.includes("ECONNREFUSED")
        ? "Terminal is on local private network (LAN) and cannot be reached directly from cloud server. Scans push automatically via Webhook."
        : message,
    });
  }
});

// POST /api/biometric/devices/:id/sync-now - On-demand fetch scans immediately from terminal
router.post("/devices/:id/sync-now", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await syncDeviceScansNow(req.params.id);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || "Failed to fetch device scans" });
    }
    return res.json({
      success: true,
      message: `Successfully fetched ${result.scansFetched} scans (${result.scansProcessed} processed into attendance).`,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/biometric/devices/:id/pull-range - Pull scans from a terminal for a custom date range
router.post("/devices/:id/pull-range", requireRole("ADMIN"), async (req, res) => {
  try {
    const { fromDate, toDate } = req.body as { fromDate?: string; toDate?: string };
    if (!fromDate) {
      return res.status(400).json({ success: false, error: "fromDate is required (e.g. 2026-09-18)" });
    }
    const from = new Date(fromDate);
    const to = toDate ? new Date(toDate) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid date format provided" });
    }

    const result = await pullDeviceScansForRange(req.params.id, from, to);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || "Failed to pull device scans" });
    }
    return res.json({
      success: true,
      message: `Successfully pulled ${result.scansFetched} scans (${result.scansProcessed} processed into attendance records).`,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/biometric/pull-range - Pull scans from ALL enabled terminals for a custom date range
router.post("/pull-range", requireRole("ADMIN"), async (req, res) => {
  try {
    const { fromDate, toDate } = req.body as { fromDate?: string; toDate?: string };
    if (!fromDate) {
      return res.status(400).json({ success: false, error: "fromDate is required (e.g. 2026-09-18)" });
    }
    const from = new Date(fromDate);
    const to = toDate ? new Date(toDate) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid date format provided" });
    }

    const result = await pullAllDevicesScansForRange(from, to);
    return res.json({
      success: true,
      message: `Pulled ${result.totalFetched} scans across ${result.devices.length} terminal(s) (${result.totalProcessed} processed into attendance).`,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/biometric/devices/:id/configure-push - Register Alarm Server / HTTP Listening push on the terminal
router.post("/devices/:id/configure-push", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const body = (req.body && typeof req.body === "object") ? req.body : {};
    let targetUrl: string = typeof body.url === "string" && body.url.trim() ? body.url.trim() : "";
    if (!targetUrl) {
      if (process.env.HIKVISION_PUSH_URL) {
        targetUrl = process.env.HIKVISION_PUSH_URL;
      } else if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") && !process.env.NEXT_PUBLIC_APP_URL.includes("127.0.0.1")) {
        targetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/hikvision/events`;
      } else {
        const lanIp = getLocalLanIp(device.host);
        targetUrl = `http://${lanIp}:4000/api/hikvision/events`;
      }
    }

    const format: "XML" | "JSON" = body.format === "JSON" ? "JSON" : "XML";
    const result = await configureDevicePush(req.params.id, targetUrl, format);
    return res.json({
      success: true,
      message: `HTTP Listening configured to push real-time events to: ${targetUrl}`,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/biometric/simulate-scan - Manually ingest / simulate punch for diagnostics
router.post("/simulate-scan", requireRole("ADMIN"), async (req, res) => {
  try {
    const { identifier, verifyMode, timestamp, deviceId } = req.body as {
      identifier?: string;
      verifyMode?: string;
      timestamp?: string;
      deviceId?: string;
    };
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, error: "Identifier (Student ID / ITS / Employee ID / Card / Hash) is required" });
    }

    const event = await processBiometricScan(
      identifier.trim(),
      timestamp ? new Date(timestamp) : new Date(),
      deviceId || "admin-simulator",
      verifyMode || "FACIAL",
    );

    return res.json({
      success: true,
      message: `Simulated scan processed: [${event.type}] ${event.message || ""}`,
      data: event,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/biometric/devices/:id/fetch-members - Fetch enrolled users from a terminal & sync to portal
router.post("/devices/:id/fetch-members", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await fetchMembersFromDevice(req.params.id);
    return res.json({
      success: true,
      message: `Found ${result.totalFound} member(s) on ${result.deviceName}. Matched ${result.studentsMatched} student(s) and ${result.teachersMatched} faculty member(s).`,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/biometric/fetch-all-members - Fetch enrolled users from ALL terminals & sync to portal
router.post("/fetch-all-members", requireRole("ADMIN"), async (_req, res) => {
  try {
    const result = await fetchAllMembersFromAllDevices();
    return res.json({
      success: true,
      message: `Found ${result.totalFound} member(s) across ${result.devices.length} terminal(s). Matched ${result.studentsMatched} student(s) and ${result.teachersMatched} faculty member(s).`,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/biometric/auto-match - Smart auto-match suggestions for unmatched fingerprints
router.post("/auto-match", requireRole("ADMIN"), async (_req, res) => {
  try {
    const unmatched = getUnmatchedFingerprints();
    const students = await prisma.studentProfile.findMany({
      select: {
        id: true,
        studentId: true,
        its: true,
        darsId: true,
        trNo: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const suggestions: Array<{
      fingerprint: string;
      studentId: string;
      studentName: string;
      confidence: number;
      matchedBy: string;
    }> = [];

    for (const u of unmatched) {
      const clean = u.fingerprint.trim();
      const stripped = clean.replace(/^0+/, "");

      for (const s of students) {
        const name = `${s.user.firstName} ${s.user.lastName}`.toLowerCase();
        if (clean === s.studentId || stripped === s.studentId || clean === `STU-${s.studentId}`) {
          suggestions.push({ fingerprint: clean, studentId: s.id, studentName: `${s.user.firstName} ${s.user.lastName}`, confidence: 100, matchedBy: "Student ID" });
          break;
        }
        if (s.its && (clean === s.its || stripped === s.its)) {
          suggestions.push({ fingerprint: clean, studentId: s.id, studentName: `${s.user.firstName} ${s.user.lastName}`, confidence: 100, matchedBy: "ITS ID" });
          break;
        }
        if (s.darsId && (clean === s.darsId || stripped === s.darsId)) {
          suggestions.push({ fingerprint: clean, studentId: s.id, studentName: `${s.user.firstName} ${s.user.lastName}`, confidence: 95, matchedBy: "Dars ID" });
          break;
        }
      }
    }

    return res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("Biometric auto-match error:", error);
    return res.status(500).json({ success: false, error: "Failed to calculate auto-matches" });
  }
});

// ── iVMS-4200 Full Device Control & Telemetry Endpoints ──

// POST /api/biometric/devices/:id/door-control - Remote unlock/lock/remain open/close
router.post("/devices/:id/door-control", requireRole("ADMIN"), async (req, res) => {
  try {
    const { command, doorNo } = req.body as Record<string, any>;
    if (!command || !["open", "close", "alwaysOpen", "alwaysClose"].includes(command)) {
      return res.status(400).json({ success: false, error: "Valid command is required ('open', 'close', 'alwaysOpen', 'alwaysClose')" });
    }

    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const result = await remoteControlDoor(toConnection(device), Number(doorNo) || 1, command);
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { status: "ONLINE", lastError: null, lastSeenAt: new Date() },
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Biometric door control error:", error);
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to control door" });
  }
});

// GET /api/biometric/devices/:id/door-status - Read door lock status
router.get("/devices/:id/door-status", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const status = await getDoorStatus(toConnection(device), Number(req.query.doorNo) || 1);
    return res.json({ success: true, data: status });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to read door status" });
  }
});

// POST /api/biometric/devices/:id/reboot - Remote reboot terminal
router.post("/devices/:id/reboot", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const result = await rebootDevice(toConnection(device));
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to reboot terminal" });
  }
});

// GET /api/biometric/devices/:id/snapshot - Live JPEG camera frame
router.get("/devices/:id/snapshot", async (req, res) => {
  let devName = "Terminal Camera Standby";
  let devHost = "192.168.0.4:80";
  let isOnline = false;
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    devName = device.name || "Terminal Camera";
    devHost = `${device.host}:${device.port}`;
    isOnline = device.status === "ONLINE";

    const { contentType, data } = await getDeviceSnapshot(toConnection(device));
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).send(data);
  } catch (error: any) {
    const statusText = isOnline ? "Camera Standby (Awaiting Face Capture)" : "Terminal Offline";
    const statusColor = isOnline ? "#38bdf8" : "#f43f5e";
    const fallbackSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#090d16"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#bg)"/>
        <circle cx="320" cy="130" r="38" fill="#1e293b" stroke="${statusColor}" stroke-width="2" stroke-opacity="0.5"/>
        <path d="M304 122h32v22h-32z M314 115h12v7h-12z" fill="${statusColor}"/>
        <circle cx="320" cy="133" r="5" fill="#090d16"/>
        <text x="50%" y="205" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700">${devName}</text>
        <text x="50%" y="230" text-anchor="middle" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="13">${devHost} • ${statusText}</text>
        <rect x="180" y="255" width="280" height="24" rx="12" fill="#1e293b" fill-opacity="0.8"/>
        <text x="50%" y="271" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="11">RTSP: rtsp://${devHost}/Streaming/channels/101</text>
      </svg>`
    );
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).send(fallbackSvg);
  }
});

// GET /api/biometric/devices/:id/stream - Continuous Live MJPEG Video Stream
router.get("/devices/:id/stream", async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).end();

    const conn = toConnection(device);
    res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=--frame");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Connection", "close");
    res.setHeader("Pragma", "no-cache");

    let isStreaming = true;
    req.on("close", () => {
      isStreaming = false;
    });

    const streamLoop = async () => {
      while (isStreaming && !res.writableEnded) {
        try {
          const snapshot = await getDeviceSnapshot(conn);
          if (isStreaming && !res.writableEnded && snapshot.data) {
            res.write(`--frame\r\n`);
            res.write(`Content-Type: image/jpeg\r\n`);
            res.write(`Content-Length: ${snapshot.data.length}\r\n\r\n`);
            res.write(snapshot.data);
            res.write(`\r\n`);
          }
        } catch {
          // brief pause on network frame error
          await new Promise((r) => setTimeout(r, 600));
        }
        await new Promise((r) => setTimeout(r, 200)); // ~5 FPS smooth live stream
      }
    };

    streamLoop().catch(() => {});
  } catch {
    if (!res.headersSent) res.status(500).end();
  }
});

// DELETE /api/biometric/users/:userId/purge - Complete DB & Physical Hardware Purge
router.delete("/users/:userId/purge", requireRole("ADMIN"), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await completelyDeleteUser(userId);
    return res.json({
      success: true,
      message: "Profile completely deleted from database and active biometric hardware.",
      data: result,
    });
  } catch (error: any) {
    console.error("Biometric user purge error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to purge user" });
  }
});

// GET /api/biometric/devices/:id/system-status - Hardware telemetry (CPU, RAM, Uptime, Door)
router.get("/devices/:id/system-status", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const telemetry = await getDeviceSystemStatus(toConnection(device));
    return res.json({ success: true, data: { device: toDeviceDto(device), telemetry } });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to get system status" });
  }
});

// GET /api/biometric/devices/:id/volume - Read prompt volume
router.get("/devices/:id/volume", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const data = await getAudioVolume(toConnection(device));
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to read volume" });
  }
});

// POST /api/biometric/devices/:id/volume - Set prompt volume
router.post("/devices/:id/volume", requireRole("ADMIN"), async (req, res) => {
  try {
    const { volume } = req.body as Record<string, any>;
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const data = await setAudioVolume(toConnection(device), Number(volume) || 50);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to set volume" });
  }
});

// POST /api/biometric/devices/:id/voice/play - Trigger audio prompt on terminal
router.post("/devices/:id/voice/play", requireRole("ADMIN"), async (req, res) => {
  try {
    const { promptType = "pleaseScanFace", customText } = req.body as Record<string, any>;
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const result = await playVoicePrompt(toConnection(device), promptType, customText);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to play voice prompt" });
  }
});

// POST /api/biometric/devices/bulk/voice/play - Broadcast voice prompt to all active devices
router.post("/devices/bulk/voice/play", requireRole("ADMIN"), async (req, res) => {
  try {
    const { promptType = "pleaseScanFace", customText } = req.body as Record<string, any>;
    const devices = await prisma.biometricDevice.findMany({ where: { enabled: true } });
    
    const results = await Promise.allSettled(
      devices.map((d) => playVoicePrompt(toConnection(d), promptType, customText))
    );

    return res.json({
      success: true,
      message: `Voice prompt sent to ${devices.length} devices.`,
      data: results,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to broadcast voice prompt" });
  }
});

// POST /api/biometric/devices/bulk/volume - Set volume across all devices
router.post("/devices/bulk/volume", requireRole("ADMIN"), async (req, res) => {
  try {
    const { volume } = req.body as Record<string, any>;
    const devices = await prisma.biometricDevice.findMany({ where: { enabled: true } });

    const results = await Promise.allSettled(
      devices.map((d) => setAudioVolume(toConnection(d), Number(volume) || 50))
    );

    return res.json({
      success: true,
      message: `Volume set to ${volume}% on all terminals.`,
      data: results,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to bulk set volume" });
  }
});

// POST /api/biometric/devices/bulk/sync-time - Synchronize IST clock on all terminals
router.post("/devices/bulk/sync-time", requireRole("ADMIN"), async (_req, res) => {
  try {
    const devices = await prisma.biometricDevice.findMany({ where: { enabled: true } });
    if (devices.length === 0) {
      return res.json({ success: true, message: "No enabled terminals found.", data: [] });
    }

    const results = await Promise.allSettled(
      devices.map((d) => forceSyncDeviceTime(d.id))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;

    return res.json({
      success: true,
      message: successful > 0
        ? `Clock synchronized to IST on ${successful} of ${devices.length} terminals.`
        : `Terminals are on local network (${devices.map((d) => d.host).join(", ")}). Direct clock push from cloud requires local bridge; live scans push automatically via Webhook.`,
      data: results,
    });
  } catch (error: any) {
    return res.status(200).json({ success: false, error: error?.message ?? "Failed to sync time on all devices" });
  }
});

// POST /api/biometric/devices/:id/users/deploy - Deploy a student or teacher to terminal
router.post("/devices/:id/users/deploy", requireRole("ADMIN"), async (req, res) => {
  try {
    const { studentId, teacherId, employeeNo, name } = req.body as Record<string, any>;
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });
    const conn = toConnection(device);

    let targetEmpNo = employeeNo;
    let targetName = name;

    if (studentId) {
      const s = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: true },
      });
      if (s) {
        targetEmpNo = targetEmpNo || s.its || s.studentId || s.biometricHash || s.id;
        targetName = targetName || `${s.user.firstName} ${s.user.lastName}`.trim();
        if (!s.biometricHash) {
          await prisma.studentProfile.update({ where: { id: s.id }, data: { biometricHash: targetEmpNo } }).catch(() => {});
        }
      }
    } else if (teacherId) {
      const t = await prisma.teacherProfile.findUnique({
        where: { id: teacherId },
        include: { user: true },
      });
      if (t) {
        targetEmpNo = targetEmpNo || t.employeeId || t.its || t.biometricHash || t.id;
        targetName = targetName || `${t.user.firstName} ${t.user.lastName}`.trim();
        if (!t.biometricHash) {
          await prisma.teacherProfile.update({ where: { id: t.id }, data: { biometricHash: targetEmpNo } }).catch(() => {});
        }
      }
    }

    if (!targetEmpNo || !targetName) {
      return res.status(400).json({ success: false, error: "employeeNo and name are required" });
    }

    const result = await deployUserToDevice(conn, {
      employeeNo: String(targetEmpNo).trim(),
      name: String(targetName).trim(),
      userType: "normal",
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to deploy user" });
  }
});

// POST /api/biometric/devices/:id/users/deploy-all - Batch deploy all students/faculty to terminal
router.post("/devices/:id/users/deploy-all", requireRole("ADMIN"), async (req, res) => {
  try {
    const { target = "ALL" } = req.body as Record<string, any>;
    const deviceId = req.params.id;

    let studentsResult = { total: 0, successful: 0, failed: 0, errors: [] as any[] };
    let teachersResult = { total: 0, successful: 0, failed: 0, errors: [] as any[] };

    if (target === "ALL" || target === "STUDENTS") {
      studentsResult = await deployAllStudentsToDevice(deviceId);
    }
    if (target === "ALL" || target === "TEACHERS") {
      teachersResult = await deployAllTeachersToDevice(deviceId);
    }

    const totalDeployed = studentsResult.successful + teachersResult.successful;
    const totalFailed = studentsResult.failed + teachersResult.failed;

    return res.json({
      success: true,
      message: `Deployed ${totalDeployed} members to terminal (${totalFailed} failed).`,
      data: {
        students: studentsResult,
        teachers: teachersResult,
        totalDeployed,
        totalFailed,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed batch deployment" });
  }
});

// DELETE /api/biometric/devices/:id/users/:employeeNo - Delete user from terminal
router.delete("/devices/:id/users/:employeeNo", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const result = await deleteUserFromDevice(toConnection(device), req.params.employeeNo);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to delete user" });
  }
});

// POST /api/biometric/devices/:id/users/:employeeNo/card - Assign RFID card
router.post("/devices/:id/users/:employeeNo/card", requireRole("ADMIN"), async (req, res) => {
  try {
    const { cardNo } = req.body as Record<string, any>;
    if (!cardNo || typeof cardNo !== "string" || !cardNo.trim()) {
      return res.status(400).json({ success: false, error: "cardNo is required" });
    }

    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const result = await deployCardToDevice(toConnection(device), req.params.employeeNo, cardNo.trim());
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ?? "Failed to assign card" });
  }
});

export default router;

