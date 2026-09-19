import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware";
import {
  markMedicalExemption,
  getMedicalExemptions,
  revokeMedicalExemption,
} from "../lib/medical-service";

const router = Router();

// GET /api/medical/exemptions - List all medical exemptions for a date
router.get("/exemptions", requireAuth, async (req, res) => {
  try {
    const { date, personType } = req.query as { date?: string; personType?: "STUDENT" | "TEACHER" | "ALL" };
    const exemptions = await getMedicalExemptions({
      date,
      personType,
      isActive: true,
    });
    return res.json({ success: true, data: exemptions });
  } catch (error: any) {
    console.error("Get medical exemptions error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch medical exemptions" });
  }
});

// POST /api/medical/mark - 1-Click mark a student or teacher on medical leave
router.post("/mark", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const { personType, personId, date, eventId, eventName, reason } = req.body as {
      personType?: "STUDENT" | "TEACHER";
      personId?: string;
      date?: string;
      eventId?: string | null;
      eventName?: string | null;
      reason?: string;
    };

    if (!personType || !["STUDENT", "TEACHER"].includes(personType)) {
      return res.status(400).json({ success: false, error: "personType must be 'STUDENT' or 'TEACHER'" });
    }

    if (!personId || typeof personId !== "string" || !personId.trim()) {
      return res.status(400).json({ success: false, error: "personId is required" });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason / symptom notes are required" });
    }

    const assignedByName = `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim() || session.user.email;

    const exemption = await markMedicalExemption({
      personType,
      personId: personId.trim(),
      date,
      eventId: eventId || null,
      eventName: eventName || null,
      reason: reason.trim(),
      assignedById: session.user.id,
      assignedByName,
    });

    return res.json({
      success: true,
      message: `Marked ${personType.toLowerCase()} on Medical Leave. Status recorded as MEDICAL (will not be marked absent).`,
      data: exemption,
    });
  } catch (error: any) {
    console.error("Mark medical exemption error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to mark medical leave" });
  }
});

// POST /api/medical/revoke/:id - Revoke active medical exemption
router.post("/revoke/:id", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const { id } = req.params;
    const actorName = `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim();

    const revoked = await revokeMedicalExemption(id, session.user.id, actorName);
    return res.json({
      success: true,
      message: "Medical exemption revoked successfully.",
      data: revoked,
    });
  } catch (error: any) {
    console.error("Revoke medical exemption error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to revoke medical exemption" });
  }
});

// GET /api/medical/search-members - Search students & faculty for fast medical marking
router.get("/search-members", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const type = (req.query.type as string)?.toUpperCase() || "ALL"; // "STUDENT" | "TEACHER" | "ALL"

    if (!q || q.length < 1) {
      return res.json({ success: true, data: { students: [], teachers: [] } });
    }

    const results: { students: any[]; teachers: any[] } = { students: [], teachers: [] };

    if (type === "STUDENT" || type === "ALL") {
      const students = await prisma.studentProfile.findMany({
        where: {
          user: { isActive: true, deletedAt: null },
          OR: [
            { studentId: { contains: q, mode: "insensitive" } },
            { its: { contains: q, mode: "insensitive" } },
            { darsId: { contains: q, mode: "insensitive" } },
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          classEnrollments: {
            where: { isActive: true },
            include: { class: { select: { name: true, grade: true, section: true } } },
          },
        },
        take: 15,
      });

      results.students = students.map((s) => ({
        id: s.id,
        personType: "STUDENT",
        studentId: s.studentId,
        its: s.its || s.studentId,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        grade: s.grade,
        section: s.section,
        avatarUrl: s.user.avatarUrl,
        className: s.classEnrollments[0]?.class?.name || `Grade ${s.grade}-${s.section}`,
      }));
    }

    if (type === "TEACHER" || type === "ALL") {
      const teachers = await prisma.teacherProfile.findMany({
        where: {
          user: { isActive: true, deletedAt: null },
          OR: [
            { employeeId: { contains: q, mode: "insensitive" } },
            { its: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
        take: 15,
      });

      results.teachers = teachers.map((t) => ({
        id: t.id,
        personType: "TEACHER",
        employeeId: t.employeeId,
        its: (t as any).its || t.employeeId,
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        department: t.department || "Faculty",
        avatarUrl: t.user.avatarUrl,
      }));
    }

    return res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Search members error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to search members" });
  }
});

// GET /api/medical/schedule-events - Get list of scheduled events / scan windows
router.get("/schedule-events", requireAuth, async (req, res) => {
  try {
    const windows = await prisma.biometricScanWindow.findMany({
      where: { enabled: true },
      orderBy: { startTime: "asc" },
    });

    const events = [
      { id: "full_day", name: "Full Day Medical Exemption", time: "All Day" },
      ...windows.map((w) => ({
        id: w.id,
        name: w.name,
        time: `${w.startTime} – ${w.endTime} IST`,
      })),
    ];

    return res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Get schedule events error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch events" });
  }
});

export default router;
