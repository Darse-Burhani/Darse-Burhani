import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";
import {
  gregorianToJulianDay,
  julianDayToHijri,
  hijriToJulianDay,
  julianDayToGregorian,
  getDaysInHijriMonth,
  getCurrentHijriYearMonth,
  HIJRI_MONTHS,
} from "../../../lib/fatimi-calendar";

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

// ── Fatimi Hijri month helpers (shared by monthly/leaders/stacking/yearly endpoints) ──

function getFullHijri(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value || date.getFullYear());
  const m = Number(parts.find((p) => p.type === "month")?.value || date.getMonth() + 1);
  const d = Number(parts.find((p) => p.type === "day")?.value || date.getDate());
  const jd = gregorianToJulianDay(y, m, d);
  const h = julianDayToHijri(jd);
  const meta = HIJRI_MONTHS[h.month - 1] || HIJRI_MONTHS[0];
  return { year: h.year, month: h.month, day: h.day, monthName: meta.en, monthNameAr: meta.ar, formatted: `${h.day} ${meta.en} ${h.year} H` };
}

/** Gregorian [start, end] window covering a full Fatimi Hijri month. */
function hijriMonthWindow(year: number, month: number) {
  const daysInMonth = getDaysInHijriMonth(year, month);
  const startGreg = julianDayToGregorian(hijriToJulianDay(year, month, 1));
  const endGreg = julianDayToGregorian(hijriToJulianDay(year, month, daysInMonth));
  return {
    daysInMonth,
    start: new Date(startGreg.year, startGreg.month - 1, startGreg.day, 0, 0, 0, 0),
    end: new Date(endGreg.year, endGreg.month - 1, endGreg.day, 23, 59, 59, 999),
  };
}

/** Resolve ?hijriMonth / ?hijriYear query params, defaulting to the current Fatimi month. */
function resolveHijriParams(req: { query: any }) {
  const current = getCurrentHijriYearMonth();
  const month = Number(req.query.hijriMonth) || current.month;
  const year = Number(req.query.hijriYear) || current.year;
  const meta = HIJRI_MONTHS[month - 1] || HIJRI_MONTHS[0];
  const win = hijriMonthWindow(year, month);
  return {
    month,
    year,
    daysInMonth: win.daysInMonth,
    start: win.start,
    end: win.end,
    monthName: meta.en,
    monthNameAr: meta.ar,
    monthLabel: `${meta.en} ${year} H`,
  };
}

/** Loan notes carry borrower metadata (borrowerType, borrowerDarjah, parentName...) */
function parseLoanMeta(notes: string | null): any {
  if (notes && notes.startsWith("{")) {
    try {
      return JSON.parse(notes);
    } catch {
      return {};
    }
  }
  return {};
}

function resolveBorrowerRole(loan: { studentName: string; notes: string | null }, meta: any): "STUDENT" | "FACULTY" {
  return meta.borrowerType === "FACULTY" || /\(faculty\)/i.test(loan.studentName) ? "FACULTY" : "STUDENT";
}

const SESSION_TYPES = ["PRESENT", "READING", "RESEARCH", "BOOK_EXCHANGE", "STUDY_HALL"] as const;

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

// ── GET /api/admin/library/attendance/monthly ──
// Fatimi Hijri month attendance summary: per-person visit totals + per-day distribution
router.get("/monthly", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const m = resolveHijriParams(req);

    const records = (await (prisma as any).libraryAttendance.findMany({
      where: { date: { gte: m.start, lte: m.end } },
      orderBy: { checkInTime: "asc" },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        darjah: true,
        date: true,
        checkInTime: true,
        sessionType: true,
        status: true,
      },
    })) as any[];

    // Per-person aggregation (single pass — no N+1)
    const personMap = new Map<string, {
      studentId: string;
      name: string;
      darjah: string;
      visits: number;
      lastVisit: string | null;
      sessions: Record<string, number>;
    }>();
    const dayCounts = new Array<number>(m.daysInMonth).fill(0);
    const sessionCounts: Record<string, number> = {};

    for (const r of records) {
      const key = r.studentId || r.studentName;
      const h = getFullHijri(new Date(r.date));
      if (h.month === m.month && h.day >= 1 && h.day <= m.daysInMonth) dayCounts[h.day - 1]++;

      const session = r.sessionType || "PRESENT";
      sessionCounts[session] = (sessionCounts[session] || 0) + 1;

      let p = personMap.get(key);
      if (!p) {
        p = { studentId: key, name: r.studentName, darjah: r.darjah || "General", visits: 0, lastVisit: null, sessions: {} };
        personMap.set(key, p);
      }
      p.visits++;
      p.sessions[session] = (p.sessions[session] || 0) + 1;
      const t = r.checkInTime || r.date;
      if (t && (!p.lastVisit || new Date(t) > new Date(p.lastVisit))) p.lastVisit = t;
    }

    const persons = Array.from(personMap.values()).sort(
      (a, b) => b.visits - a.visits || a.name.localeCompare(b.name)
    );

    return res.json({
      success: true,
      month: {
        month: m.month,
        year: m.year,
        monthName: m.monthName,
        monthNameAr: m.monthNameAr,
        monthLabel: m.monthLabel,
        daysInMonth: m.daysInMonth,
        gregorianStart: m.start.toISOString(),
        gregorianEnd: m.end.toISOString(),
      },
      months: HIJRI_MONTHS.map((x, i) => ({ month: i + 1, name: x.en, nameAr: x.ar })),
      totals: {
        totalVisits: records.length,
        distinctPersons: persons.length,
        sessionCounts,
      },
      days: dayCounts,
      persons,
    });
  } catch (err: any) {
    console.error("Monthly library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to load monthly attendance" });
  }
});

// ── GET /api/admin/library/attendance/leaders ──
// Top performers for the Fatimi Hijri month: top issuers (most books borrowed) + top visitors
router.get("/leaders", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const m = resolveHijriParams(req);

    const [loans, visits] = await Promise.all([
      prisma.bookLoan.findMany({
        where: { borrowedAt: { gte: m.start, lte: m.end } },
        select: { studentId: true, studentName: true, notes: true, borrowedAt: true, returnedAt: true, status: true },
      }) as unknown as any[],
      (prisma as any).libraryAttendance.groupBy({
        by: ["studentId"],
        _count: { _all: true },
        _max: { checkInTime: true },
        where: { date: { gte: m.start, lte: m.end } },
      }) as any[],
    ]);

    // Aggregate issuers from loans (single pass)
    const issuerMap = new Map<string, { id: string; name: string; role: "STUDENT" | "FACULTY"; issued: number; returned: number; lastAt: Date; darjahMeta: string }>();
    for (const l of loans) {
      const meta = parseLoanMeta(l.notes);
      const role = resolveBorrowerRole(l, meta);
      let e = issuerMap.get(l.studentId);
      if (!e) {
        e = { id: l.studentId, name: l.studentName, role, issued: 0, returned: 0, lastAt: l.borrowedAt, darjahMeta: meta.borrowerDarjah || "" };
        issuerMap.set(l.studentId, e);
      }
      e.issued++;
      if (l.returnedAt) e.returned++;
      if (new Date(l.borrowedAt) > e.lastAt) {
        e.lastAt = l.borrowedAt;
        e.name = l.studentName;
        e.role = role;
        if (meta.borrowerDarjah) e.darjahMeta = meta.borrowerDarjah;
      }
    }

    // Resolve darjah for student issuers in one batched query
    const issuerIds = Array.from(issuerMap.keys());
    const profiles = issuerIds.length
      ? await prisma.studentProfile.findMany({
          where: { userId: { in: issuerIds } },
          select: {
            userId: true,
            classEnrollments: { where: { isActive: true }, take: 1, include: { class: { select: { name: true } } } },
          },
        })
      : [];
    const darjahByUser = new Map(profiles.map((p) => [p.userId, p.classEnrollments[0]?.class?.name || "General"]));

    const topIssuers = Array.from(issuerMap.values())
      .map((e) => ({
        studentId: e.id,
        name: e.name,
        role: e.role,
        darjah: e.role === "FACULTY" ? (e.darjahMeta || "Faculty Department") : (darjahByUser.get(e.id) || e.darjahMeta || "General"),
        issued: e.issued,
        returned: e.returned,
      }))
      .sort((a, b) => b.issued - a.issued || a.name.localeCompare(b.name))
      .slice(0, 12);

    // Top visitors from grouped attendance
    const visitorIds = (visits as any[]).map((v) => v.studentId);
    const visitorProfiles = visitorIds.length
      ? await prisma.studentProfile.findMany({
          where: { userId: { in: visitorIds } },
          select: {
            userId: true,
            user: { select: { firstName: true, lastName: true } },
            classEnrollments: { where: { isActive: true }, take: 1, include: { class: { select: { name: true } } } },
          },
        })
      : [];
    const vpMap = new Map(visitorProfiles.map((p) => [p.userId, p]));

    // Names come from the raw records when groupBy can't provide them — fall back to a light fetch
    let nameById = new Map<string, string>();
    if (visitorIds.length) {
      const rawVisits = (await (prisma as any).libraryAttendance.findMany({
        where: { date: { gte: m.start, lte: m.end } },
        select: { studentId: true, studentName: true },
      })) as any[];
      for (const r of rawVisits) {
        if (!nameById.has(r.studentId)) nameById.set(r.studentId, r.studentName);
      }
    }

    const topVisitors = (visits as any[])
      .map((v) => {
        const vp = vpMap.get(v.studentId);
        return {
          studentId: v.studentId,
          name: vp ? `${vp.user?.firstName || ""} ${vp.user?.lastName || ""}`.trim() || nameById.get(v.studentId) || "Talabat" : nameById.get(v.studentId) || "Talabat",
          darjah: vp?.classEnrollments[0]?.class?.name || "General",
          visits: v._count?._all ?? v._count ?? 0,
          lastVisit: v._max?.checkInTime || null,
        };
      })
      .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name))
      .slice(0, 12);

    return res.json({
      success: true,
      month: { month: m.month, year: m.year, monthLabel: m.monthLabel, monthName: m.monthName, daysInMonth: m.daysInMonth },
      months: HIJRI_MONTHS.map((x, i) => ({ month: i + 1, name: x.en, nameAr: x.ar })),
      topIssuers,
      topVisitors,
    });
  } catch (err: any) {
    console.error("Library leaders error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to load top performers" });
  }
});

// ── GET /api/admin/library/attendance/stacking-all ──
// All-persons stacking (borrow/issue) records for the Fatimi Hijri month — students & faculty
router.get("/stacking-all", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const m = resolveHijriParams(req);
    const limit = Math.min(Number(req.query.limit) || 400, 1000);

    const loans = (await prisma.bookLoan.findMany({
      where: { borrowedAt: { gte: m.start, lte: m.end } },
      include: {
        book: { select: { category: true, rackNumber: true, shelfNumber: true } },
      },
      orderBy: { borrowedAt: "desc" },
      take: limit,
    })) as any[];

    const rows = loans.map((l) => {
      const meta = parseLoanMeta(l.notes);
      const role = resolveBorrowerRole(l, meta);
      const borrowedAt = new Date(l.borrowedAt);
      const dueAt = new Date(l.dueAt);
      const returnedAt = l.returnedAt ? new Date(l.returnedAt) : null;
      const isOverdue = l.status === "ACTIVE" && Date.now() > dueAt.getTime();
      return {
        id: l.id,
        bookId: l.bookId,
        bookTitle: l.bookTitle,
        bookBarcode: l.bookBarcode || "N/A",
        category: l.book?.category || "General",
        borrowerId: l.studentId,
        borrowerName: l.studentName,
        borrowerRole: role,
        darjah: meta.borrowerDarjah || (role === "FACULTY" ? "Faculty Department" : "General"),
        status: isOverdue ? "OVERDUE" : l.status,
        borrowedAt: borrowedAt.toISOString(),
        borrowedDateHijri: getFullHijri(borrowedAt).formatted,
        dueAt: dueAt.toISOString(),
        returnedAt: returnedAt?.toISOString() || null,
      };
    });

    return res.json({
      success: true,
      month: { month: m.month, year: m.year, monthLabel: m.monthLabel, monthName: m.monthName, daysInMonth: m.daysInMonth },
      months: HIJRI_MONTHS.map((x, i) => ({ month: i + 1, name: x.en, nameAr: x.ar })),
      totals: {
        records: rows.length,
        issued: rows.length,
        returned: rows.filter((r) => r.returnedAt).length,
        active: rows.filter((r) => r.status === "ACTIVE").length,
        overdue: rows.filter((r) => r.status === "OVERDUE").length,
        faculty: rows.filter((r) => r.borrowerRole === "FACULTY").length,
        students: rows.filter((r) => r.borrowerRole === "STUDENT").length,
      },
      data: rows,
    });
  } catch (err: any) {
    console.error("All-persons stacking error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to load stacking records" });
  }
});

// ── GET /api/admin/library/attendance/yearly-profile ──
// Inline yearly profile: 12 Fatimi Hijri months of visits + stacking history, per person
router.get("/yearly-profile", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const personId = String(req.query.personId || "").trim();
    const current = getCurrentHijriYearMonth();
    const year = Number(req.query.hijriYear) || current.year;
    if (!personId) {
      return res.status(400).json({ success: false, error: "personId is required" });
    }

    // Hijri year window (month 1 day 1 → month 12 last day)
    const startGreg = julianDayToGregorian(hijriToJulianDay(year, 1, 1));
    const endGreg = julianDayToGregorian(hijriToJulianDay(year, 12, getDaysInHijriMonth(year, 12)));
    const yearStart = new Date(startGreg.year, startGreg.month - 1, startGreg.day, 0, 0, 0, 0);
    const yearEnd = new Date(endGreg.year, endGreg.month - 1, endGreg.day, 23, 59, 59, 999);

    const [profile, attendances, loans] = await Promise.all([
      prisma.studentProfile.findFirst({
        where: { OR: [{ userId: personId }, { id: personId }, { its: personId }] },
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          classEnrollments: { where: { isActive: true }, take: 1, include: { class: { select: { name: true } } } },
        },
      }),
      (prisma as any).libraryAttendance.findMany({
        where: { studentId: personId, date: { gte: yearStart, lte: yearEnd } },
        orderBy: { date: "desc" },
        take: 200,
      }) as unknown as any[],
      prisma.bookLoan.findMany({
        where: { studentId: personId, borrowedAt: { gte: yearStart, lte: yearEnd } },
        orderBy: { borrowedAt: "desc" },
        take: 100,
        select: { id: true, bookTitle: true, bookBarcode: true, borrowedAt: true, dueAt: true, returnedAt: true, status: true, notes: true },
      }) as unknown as any[],
    ]);

    const profileAny = profile as any;
    const personName =
      profileAny
        ? `${profileAny.user?.firstName || ""} ${profileAny.user?.lastName || ""}`.trim() || profileAny.studentId || "Talabat"
        : attendances[0]?.studentName || loans[0]?.studentName || "Unknown Person";
    const darjah = profileAny?.classEnrollments?.[0]?.class?.name || attendances[0]?.darjah || "General";

    // 12-month aggregation (single pass)
    const monthsAgg = HIJRI_MONTHS.map((x, i) => ({
      month: i + 1,
      monthName: x.en,
      visits: 0,
      issued: 0,
    }));
    const monthIndex = new Map(monthsAgg.map((x) => [x.month, x]));

    for (const a of attendances) {
      const h = getFullHijri(new Date(a.date));
      if (h.year === year) {
        const row = monthIndex.get(h.month);
        if (row) row.visits++;
      }
    }
    for (const l of loans) {
      const h = getFullHijri(new Date(l.borrowedAt));
      if (h.year === year) {
        const row = monthIndex.get(h.month);
        if (row) row.issued++;
      }
    }

    return res.json({
      success: true,
      year,
      person: {
        id: personId,
        name: personName,
        darjah,
        its: profileAny?.its || attendances[0]?.its || null,
        avatarUrl: profileAny?.user?.avatarUrl || null,
        role: (loans[0] && resolveBorrowerRole(loans[0], parseLoanMeta(loans[0].notes)) === "FACULTY") ? "FACULTY" : "STUDENT",
      },
      months: monthsAgg,
      totals: {
        visits: attendances.length,
        issued: loans.length,
        returned: loans.filter((l: any) => l.returnedAt).length,
        active: loans.filter((l: any) => l.status === "ACTIVE").length,
      },
      recentAttendance: attendances.slice(0, 40),
      recentLoans: loans.slice(0, 40).map((l: any) => {
        const meta = parseLoanMeta(l.notes);
        return {
          id: l.id,
          bookTitle: l.bookTitle,
          bookBarcode: l.bookBarcode || "N/A",
          borrowedAt: l.borrowedAt,
          borrowedDateHijri: getFullHijri(new Date(l.borrowedAt)).formatted,
          dueAt: l.dueAt,
          returnedAt: l.returnedAt || null,
          status: l.status,
          darjah: meta.borrowerDarjah || null,
        };
      }),
    });
  } catch (err: any) {
    console.error("Yearly profile error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to load yearly profile" });
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

// ── PUT /api/admin/library/attendance/:id ──
// Edit an attendance record: check-in time, session type, notes (yearly profile inline editor)
router.put("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { checkInTime, sessionType, notes, status } = req.body || {};

    const existing = await (prisma as any).libraryAttendance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Attendance record not found" });
    }

    const data: any = {};

    if (checkInTime !== undefined && checkInTime !== null && checkInTime !== "") {
      const raw = String(checkInTime).trim();
      // "HH:MM" → combine with the record's existing date; full ISO/date strings pass through
      const hhmm = /^(\d{1,2}):(\d{2})$/.exec(raw);
      if (hhmm) {
        const base = existing.checkInTime || existing.date || new Date();
        const t = new Date(base);
        t.setHours(Number(hhmm[1]), Number(hhmm[2]), 0, 0);
        data.checkInTime = t;
      } else {
        const parsed = new Date(raw);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ success: false, error: "Invalid check-in time. Use HH:MM or a valid date." });
        }
        data.checkInTime = parsed;
      }
    }

    if (sessionType !== undefined && sessionType !== null && sessionType !== "") {
      const st = String(sessionType).trim().toUpperCase();
      if (!(SESSION_TYPES as readonly string[]).includes(st)) {
        return res.status(400).json({ success: false, error: `Invalid session type. Allowed: ${SESSION_TYPES.join(", ")}` });
      }
      data.sessionType = st;
    }

    if (notes !== undefined) {
      data.notes = notes === null || notes === "" ? null : String(notes);
    }

    if (status !== undefined && status !== null && status !== "") {
      const st = String(status).trim().toUpperCase();
      if (!["PRESENT", "COMPLETED"].includes(st)) {
        return res.status(400).json({ success: false, error: "Invalid status. Allowed: PRESENT, COMPLETED" });
      }
      data.status = st;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: "Nothing to update" });
    }

    const updated = await (prisma as any).libraryAttendance.update({ where: { id }, data });
    return res.json({ success: true, message: "Attendance record updated", data: updated });
  } catch (err: any) {
    console.error("Edit library attendance error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to update attendance record" });
  }
});

export default router;