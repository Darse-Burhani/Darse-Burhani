import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";
import { gregorianToJulianDay, julianDayToHijri, HIJRI_MONTHS } from "../../../lib/fatimi-calendar";

const router = Router();

function getHijriDetails(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value || date.getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || date.getMonth() + 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || date.getDate());

  const jd = gregorianToJulianDay(year, month, day);
  const hijri = julianDayToHijri(jd);
  const mMeta = HIJRI_MONTHS[hijri.month - 1] || HIJRI_MONTHS[0];
  return {
    formatted: `${hijri.day} ${mMeta.en} ${hijri.year} H`,
  };
}

// ── GET /api/admin/library/attendance ──
// Returns library attendance records for a specified date
router.get("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const darjahFilter = (req.query.darjah as string) || "ALL";

    const targetDate = new Date(dateParam);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const whereClause: any = {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (darjahFilter !== "ALL") {
      whereClause.darjah = darjahFilter;
    }

    const records = await (prisma as any).libraryAttendance.findMany({
      where: whereClause,
      orderBy: { checkInTime: "desc" },
    });

    const hijriInfo = getHijriDetails(targetDate);

    // Enrich records with student profile photo and ITS
    const studentIds = Array.from(new Set((records as any[]).map((r: any) => r.studentId).filter(Boolean)));
    const [users, profiles] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, avatarUrl: true },
      }),
      prisma.studentProfile.findMany({
        where: { OR: [{ id: { in: studentIds } }, { userId: { in: studentIds } }] },
        select: { id: true, userId: true, its: true, user: { select: { avatarUrl: true } } },
      }),
    ]);

    const avatarMap = new Map<string, string | null>();
    const itsMap = new Map<string, string | null>();

    for (const u of users) {
      if (u.avatarUrl) avatarMap.set(u.id, u.avatarUrl);
    }
    for (const p of profiles) {
      const av = p.user?.avatarUrl;
      if (av) {
        avatarMap.set(p.id, av);
        if (p.userId) avatarMap.set(p.userId, av);
      }
      if (p.its) {
        itsMap.set(p.id, p.its);
        if (p.userId) itsMap.set(p.userId, p.its);
      }
    }

    const enrichedRecords = (records as any[]).map((r: any) => ({
      ...r,
      avatarUrl: avatarMap.get(r.studentId) || null,
      its: itsMap.get(r.studentId) || null,
    }));

    // Compute session distribution
    const sessionCounts = {
      PRESENT: 0,
      READING: 0,
      RESEARCH: 0,
      BOOK_EXCHANGE: 0,
      STUDY_HALL: 0,
    };

    for (const r of (records as any[])) {
      const st = r.sessionType || "PRESENT";
      if (st in sessionCounts) {
        sessionCounts[st as keyof typeof sessionCounts]++;
      } else {
        sessionCounts.PRESENT++;
      }
    }

    return res.json({
      success: true,
      date: dateParam,
      hijriDate: hijriInfo.formatted,
      stats: {
        totalVisits: (records as any[]).length,
        distinctStudents: new Set((records as any[]).map((r: any) => r.studentId)).size,
        sessionCounts,
      },
      data: enrichedRecords,
    });
  } catch (err: any) {
    console.error("Fetch library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to load library attendance" });
  }
});

// ── GET /api/admin/library/attendance/classes ──
// Returns list of active classes for the Maktabat attendance filter
router.get("/classes", requireRole("ADMIN", "TEACHER"), async (_req, res) => {
  try {
    const classes = await prisma.class.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        grade: true,
        section: true,
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }],
    });
    return res.json({ success: true, data: classes });
  } catch (err: any) {
    console.error("Fetch classes for library error:", err);
    return res.status(500).json({ success: false, error: "Failed to load classes" });
  }
});

// ── GET /api/admin/library/attendance/class-students ──
// Fast fetch of students in a darjah with their Maktabat attendance status today
router.get("/class-students", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const darjah = req.query.darjah as string;
    const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const targetDate = new Date(dateParam);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const isAll = !darjah || darjah.toLowerCase() === "all";
    const cleanDarjah = darjah ? darjah.replace(/^(grade|darajah)\s*/i, "").trim() : "";

    // Find class enrollments matching darjah (supports "1 A", "Grade 1 A", "Darajah 1 A")
    const enrollments = await prisma.classEnrollment.findMany({
      where: !isAll
        ? {
            class: {
              OR: [
                { name: { contains: darjah, mode: "insensitive" } },
                { name: { contains: cleanDarjah, mode: "insensitive" } },
                { grade: { equals: cleanDarjah, mode: "insensitive" } },
                { grade: { equals: darjah, mode: "insensitive" } },
              ],
            },
            isActive: true,
          }
        : { isActive: true },
      include: {
        class: true,
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: [
        { class: { grade: "asc" } },
        { class: { section: "asc" } },
      ],
      take: isAll ? 300 : 100,
    });

    // Check who is already checked-in today
    const studentUserIds = enrollments.map((e) => e.student.userId);
    const studentProfileIds = enrollments.map((e) => e.student.id);

    const todayAttendances = await (prisma as any).libraryAttendance.findMany({
      where: {
        studentId: { in: [...studentUserIds, ...studentProfileIds] },
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    const attendedStudentIds = new Set((todayAttendances as any[]).map((a: any) => a.studentId));

    const list = enrollments.map((e) => {
      const s = e.student;
      const fullName = `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.trim() || (s as any).name || s.studentId || "Talabat";
      const isCheckedIn = attendedStudentIds.has(s.userId) || attendedStudentIds.has(s.id);
      const existingRecord = (todayAttendances as any[]).find((a: any) => a.studentId === s.userId || a.studentId === s.id);

      return {
        studentId: s.userId || s.id,
        profileId: s.id,
        name: fullName,
        its: s.its || s.studentId || "—",
        darjah: e.class.name || `${s.grade} ${s.section}`.trim(),
        avatarUrl: s.user?.avatarUrl || null,
        isCheckedIn,
        checkInTime: existingRecord?.checkInTime || null,
        attendanceId: existingRecord?.id || null,
      };
    });

    return res.json({ success: true, data: list });
  } catch (err: any) {
    console.error("Fetch class students for library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch class students" });
  }
});

// ── POST /api/admin/library/attendance ──
// Fast single student check-in to Maktabat
router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      darjah,
      sessionType = "READING",
      notes,
    } = req.body;

    if (!studentId || !studentName) {
      return res.status(400).json({ success: false, error: "Student ID and name are required" });
    }

    const now = new Date();
    const session = req.auth!;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Prevent duplicate arrival entries for the same student on the same day
    const existing = await (prisma as any).libraryAttendance.findFirst({
      where: {
        studentId,
        date: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { checkInTime: "desc" },
    });

    if (existing) {
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        message: `${studentName} is already marked present for today`,
        data: existing,
      });
    }

    const record = await (prisma as any).libraryAttendance.create({
      data: {
        studentId,
        studentName,
        darjah: darjah || "General",
        date: now,
        checkInTime: now,
        sessionType,
        status: "PRESENT",
        notes: notes || null,
        recordedById: session.user.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Marked "${studentName}" present in Maktabat (${sessionType})`,
      data: record,
    });
  } catch (err: any) {
    console.error("Mark library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to mark library attendance" });
  }
});

// ── POST /api/admin/library/attendance/scan-checkin ──
// Fast barcode or ITS ID card scan check-in for smooth librarian workflow
router.post("/scan-checkin", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const rawQuery = String(req.body.query || "").trim();
    const cleanQuery = rawQuery.replace(/^its[-:\s]*/i, "").trim();
    const sessionType = req.body.sessionType || "READING";
    const notes = req.body.notes || null;

    if (!rawQuery) {
      return res.status(400).json({ success: false, error: "Please provide an ITS number, barcode, or student name" });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 1. Search student profile by ITS, studentId, id, or user name
    let student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { its: rawQuery },
          { its: cleanQuery },
          { studentId: rawQuery },
          { studentId: cleanQuery },
          { id: rawQuery },
          { userId: rawQuery },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        classEnrollments: {
          where: { isActive: true },
          include: { class: true },
          take: 1,
        },
      },
    });

    // 2. If not found by exact code, search by partial name or partial ITS
    if (!student) {
      student = await prisma.studentProfile.findFirst({
        where: {
          OR: [
            { its: { contains: rawQuery, mode: "insensitive" as const } },
            { user: { firstName: { contains: rawQuery, mode: "insensitive" as const } } },
            { user: { lastName: { contains: rawQuery, mode: "insensitive" as const } } },
          ],
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          classEnrollments: {
            where: { isActive: true },
            include: { class: true },
            take: 1,
          },
        },
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        error: `No Talabat found matching code or name "${rawQuery}". Please verify ITS or barcode.`,
      });
    }

    const studentId = student.userId || student.id;
    const studentUser = (student as any).user;
    const studentName =
      `${studentUser?.firstName || ""} ${studentUser?.lastName || ""}`.trim() ||
      (student as any).name ||
      student.studentId ||
      "Talabat";
    const enrollments = (student as any).classEnrollments;
    const darjah =
      enrollments?.[0]?.class?.name ||
      (student.grade ? `${student.grade} ${student.section || ""}`.trim() : "Maktabat Hall");

    // Check if already checked in today
    const existing = await (prisma as any).libraryAttendance.findFirst({
      where: {
        studentId,
        date: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { checkInTime: "desc" },
    });

    if (existing) {
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        message: `${studentName} is already checked in for today`,
        student: {
          studentId,
          name: studentName,
          darjah,
          its: student.its || "—",
          avatarUrl: studentUser?.avatarUrl || null,
        },
        data: existing,
      });
    }

    // Create fresh check-in record
    const record = await (prisma as any).libraryAttendance.create({
      data: {
        studentId,
        studentName,
        darjah,
        date: now,
        checkInTime: now,
        sessionType: sessionType || "PRESENT",
        status: "PRESENT",
        notes: notes || `Arrival scan check-in: ${rawQuery}`,
        recordedById: req.auth!.user.id,
      },
    });

    return res.status(201).json({
      success: true,
      newlyCheckedIn: true,
      message: `✓ Checked in ${studentName} (${darjah})`,
      student: {
        studentId,
        name: studentName,
        darjah,
        its: student.its || "—",
        avatarUrl: studentUser?.avatarUrl || null,
      },
      data: record,
    });
  } catch (err: any) {
    console.error("Scan checkin error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to process scan checkin" });
  }
});

// ── POST /api/admin/library/attendance/bulk ──
// Bulk check-in for entire class or group visiting Maktabat
router.post("/bulk", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { students, sessionType = "READING", notes } = req.body as {
      students: Array<{ studentId: string; studentName: string; darjah?: string }>;
      sessionType?: string;
      notes?: string;
    };

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, error: "Students array is required" });
    }

    const now = new Date();
    const session = req.auth!;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const candidateIds = students.map((s) => s.studentId);
    const alreadyAttended = await (prisma as any).libraryAttendance.findMany({
      where: {
        studentId: { in: candidateIds },
        date: { gte: todayStart, lte: todayEnd },
      },
      select: { studentId: true },
    });
    const alreadySet = new Set((alreadyAttended as any[]).map((a: any) => a.studentId));
    const toCreate = students.filter((s) => !alreadySet.has(s.studentId));

    if (toCreate.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: "All students in this list are already marked present today",
        data: [],
      });
    }

    const createdRecords = await prisma.$transaction(
      toCreate.map((s) =>
        (prisma as any).libraryAttendance.create({
          data: {
            studentId: s.studentId,
            studentName: s.studentName,
            darjah: s.darjah || "General",
            date: now,
            checkInTime: now,
            sessionType,
            status: "PRESENT",
            notes: notes || null,
            recordedById: session.user.id,
          },
        })
      )
    );

    return res.json({
      success: true,
      count: createdRecords.length,
      message: `Marked ${createdRecords.length} student(s) present in Maktabat`,
      data: createdRecords,
    });
  } catch (err: any) {
    console.error("Bulk library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to mark bulk library attendance" });
  }
});

// ── POST /api/admin/library/attendance/undo ──
// Undo attendance marked by mistake (by attendanceId or by studentId + date)
router.post("/undo", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { attendanceId, studentId, date } = req.body || {};

    if (attendanceId) {
      await (prisma as any).libraryAttendance.delete({ where: { id: attendanceId } });
      return res.json({ success: true, message: "Arrival record undone and reverted" });
    }

    if (studentId) {
      const targetDate = date ? new Date(date) : new Date();
      const dayStart = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
      const dayEnd = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

      const existing = await (prisma as any).libraryAttendance.findFirst({
        where: {
          studentId,
          date: { gte: dayStart, lte: dayEnd },
        },
      });

      if (existing) {
        await (prisma as any).libraryAttendance.delete({ where: { id: existing.id } });
        return res.json({ success: true, message: "Arrival record undone and reverted" });
      }
    }

    return res.status(404).json({ success: false, error: "No matching attendance record found to undo" });
  } catch (err: any) {
    console.error("Undo library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to undo attendance" });
  }
});

// ── DELETE /api/admin/library/attendance/:id ──
// Remove attendance entry
router.delete("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { id } = req.params;
    await (prisma as any).libraryAttendance.delete({ where: { id } });
    return res.json({ success: true, message: "Attendance record deleted" });
  } catch (err: any) {
    console.error("Delete library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to delete record" });
  }
});

export default router;