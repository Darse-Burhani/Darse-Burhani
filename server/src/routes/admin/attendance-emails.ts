import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

// Helper to compute date boundaries for weekly and monthly reports
function resolveDateRange(query: {
  periodType?: string;
  startDate?: string;
  endDate?: string;
  month?: string | number;
  year?: string | number;
}): { periodType: "WEEKLY" | "MONTHLY"; start: Date; end: Date; label: string } {
  const periodType: "WEEKLY" | "MONTHLY" = query.periodType === "MONTHLY" ? "MONTHLY" : "WEEKLY";
  const now = new Date();

  let start: Date;
  let end: Date;
  let label: string;

  if (periodType === "MONTHLY") {
    const y = Number(query.year) || now.getFullYear();
    const m = query.month !== undefined ? Number(query.month) - 1 : now.getMonth();
    start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
    const monthName = start.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    label = `${monthName} ${y}`;
  } else {
    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      start.setUTCHours(0, 0, 0, 0);
      end = new Date(query.endDate);
      end.setUTCHours(23, 59, 59, 999);
      label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
    } else {
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
      start.setUTCHours(0, 0, 0, 0);
      label = `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
    }
  }

  return { periodType, start, end, label };
}

// ── GET: Summary of all students ──
router.get("/summary", requireRole("ADMIN"), async (req, res) => {
  try {
    const { periodType, start, end, label } = resolveDateRange(req.query);
    const grade = req.query.grade as string | undefined;
    const section = req.query.section as string | undefined;

    const whereClause: Record<string, any> = {
      user: { isActive: true },
    };
    if (grade) whereClause.grade = grade;
    if (section) whereClause.section = section;

    const students = await prisma.studentProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        parentLinks: {
          include: { parent: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } },
        },
        attendanceRecords: {
          where: { date: { gte: start, lt: end } },
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
    });

    const summaryList = students.map((s) => {
      let present = 0;
      let late = 0;
      let absent = 0;
      let early = 0;

      for (const r of s.attendanceRecords) {
        if (r.status === "PRESENT") present++;
        else if (r.status === "LATE") late++;
        else if (r.status === "ABSENT") absent++;
        else if (r.status === "EARLY_DEPARTURE") early++;
      }

      const total = s.attendanceRecords.length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

      return {
        id: s.id,
        userId: s.userId,
        studentId: s.studentId,
        its: s.its || s.studentId,
        name: `${s.user.firstName} ${s.user.lastName}`,
        nameAr: s.nameAr,
        grade: s.grade,
        section: s.section,
        totalRecords: total,
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        earlyDepartureCount: early,
        attendanceRate: rate,
        parentEmails: [],
        hasParentEmail: false,
        studentEmail: s.user.email,
      };
    });

    return res.json({
      success: true,
      data: {
        periodType,
        periodLabel: label,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        stats: {
          totalStudents: summaryList.length,
          withParentEmail: 0,
          withoutParentEmail: summaryList.length,
          averageAttendanceRate: summaryList.length > 0 ? Math.round(summaryList.reduce((acc, s) => acc + s.attendanceRate, 0) / summaryList.length) : 0,
        },
        students: summaryList,
      },
    });
  } catch (error) {
    console.error("Attendance summary error:", error);
    return res.status(500).json({ success: false, error: "Failed to generate attendance summary" });
  }
});

// ── GET: Preview email HTML ──
router.get("/preview", requireAuth, async (_req, res) => {
  return res.json({
    success: true,
    data: {
      html: "<p>Attendance email reports and alerts have been disabled.</p>",
      plainText: "Attendance email reports and alerts have been disabled.",
    },
  });
});

// ── POST: Send attendance email reports to parents (DISABLED) ──
router.post("/send", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email reports have been disabled.",
    data: { sentCount: 0, failedCount: 0, skippedCount: 0, total: 0, results: [] },
  });
});

// ── POST: Send bulk (DISABLED) ──
router.post("/dispatch-bulk", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email reports have been disabled.",
    data: { sentCount: 0, failedCount: 0, skippedCount: 0, total: 0, results: [] },
  });
});

// ── POST: Send a single test email report (DISABLED) ──
router.post("/send-test", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email reports have been disabled.",
  });
});

// ── POST: Send direct absent email to a student / parents (DISABLED) ──
router.post("/send-absent-student", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email alerts have been disabled.",
    data: { sent: false },
  });
});

// ── POST: Send direct absent email to an absent teacher (DISABLED) ──
router.post("/send-absent-teacher", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email alerts have been disabled.",
    data: { sent: false },
  });
});

export default router;
