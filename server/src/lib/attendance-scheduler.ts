import prisma from "./prisma";
import { sendEmail } from "./email";
import {
  generateAttendanceReportEmailHtml,
  generateAttendanceReportPlainText,
  AttendanceReportData,
} from "./attendance-email-template";

interface SchedulerConfig {
  autoWeeklyEnabled: boolean;
  weeklyDayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  weeklyHourUtc: number; // 0-23
  autoMonthlyEnabled: boolean;
  monthlyDayOfMonth: number; // e.g. 1st of the month
  monthlyHourUtc: number;
  autoMarkAbsentEnabled: boolean;
  autoMarkAbsentHourUtc: number; // e.g. 14:00 UTC (19:30 IST)
  sheetSyncEnabled: boolean;
  sheetSyncHourUtc: number; // push to Google Sheet after absents are final
}

const config: SchedulerConfig = {
  autoWeeklyEnabled: process.env.AUTO_WEEKLY_ATTENDANCE_EMAILS === "true",
  weeklyDayOfWeek: parseInt(process.env.WEEKLY_ATTENDANCE_DAY || "0", 10), // Sunday
  weeklyHourUtc: parseInt(process.env.WEEKLY_ATTENDANCE_HOUR || "4", 10), // 4am UTC (approx 9:30am IST)
  autoMonthlyEnabled: process.env.AUTO_MONTHLY_ATTENDANCE_EMAILS === "true",
  monthlyDayOfMonth: 1,
  monthlyHourUtc: 4,
  autoMarkAbsentEnabled: process.env.AUTO_MARK_ABSENT_ENABLED !== "false", // enabled by default
  autoMarkAbsentHourUtc: parseInt(process.env.AUTO_MARK_ABSENT_HOUR || "14", 10), // 14:00 UTC / 19:30 IST
  sheetSyncEnabled: process.env.GOOGLE_SHEET_DAILY_SYNC !== "false", // enabled by default when configured
  sheetSyncHourUtc: parseInt(process.env.GOOGLE_SHEET_SYNC_HOUR || "15", 10), // 15:00 UTC / 20:30 IST
};

let lastWeeklyRunDate: string | null = null;
let lastMonthlyRunDate: string | null = null;
let lastAutoAbsentRunDate: string | null = null;
let lastSheetSyncRunDate: string | null = null;

export function getSchedulerConfig() {
  return { ...config, lastWeeklyRunDate, lastMonthlyRunDate, lastAutoAbsentRunDate, lastSheetSyncRunDate };
}

export function updateSchedulerConfig(newCfg: Partial<SchedulerConfig>) {
  Object.assign(config, newCfg);
  return getSchedulerConfig();
}

/** Called by the manual sync endpoint so the evening job doesn't duplicate. */
export function markSheetSyncRan(dateStr = new Date().toISOString().slice(0, 10)) {
  lastSheetSyncRunDate = dateStr;
  return lastSheetSyncRunDate;
}

/**
 * Executes weekly attendance report dispatch for all active students.
 */
export async function runWeeklyAttendanceReportJob(): Promise<{ sent: number; failed: number }> {
  console.log("[attendance-scheduler] Starting automated weekly attendance report dispatch...");
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);

  const label = `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true } },
    include: {
      user: true,
      parentLinks: {
        include: { parent: { include: { user: true } } },
      },
      attendanceRecords: {
        where: { date: { gte: start, lt: end } },
        orderBy: { date: "asc" },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const s of students) {
    const parentEmails = new Set<string>();
    if (s.fatherEmail?.includes("@")) parentEmails.add(s.fatherEmail.trim().toLowerCase());
    if (s.motherEmail?.includes("@")) parentEmails.add(s.motherEmail.trim().toLowerCase());
    for (const link of s.parentLinks) {
      if (link.parent?.user?.email?.includes("@")) parentEmails.add(link.parent.user.email.trim().toLowerCase());
    }

    if (parentEmails.size === 0) continue;

    let present = 0;
    let late = 0;
    let absent = 0;
    let early = 0;
    const dailyRecords: any[] = [];

    for (const r of s.attendanceRecords) {
      if (r.status === "PRESENT") present++;
      else if (r.status === "LATE") late++;
      else if (r.status === "ABSENT") absent++;
      else if (r.status === "EARLY_DEPARTURE") early++;

      const d = new Date(r.date);
      dailyRecords.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        dayName: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        status: r.status,
        checkInTime: r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : null,
        justification: r.justification,
        justificationStatus: r.justificationStatus,
      });
    }

    const total = s.attendanceRecords.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    const punctuality = present + late > 0 ? Math.round((present / (present + late)) * 100) : 100;

    const reportData: AttendanceReportData = {
      studentName: `${s.user.firstName} ${s.user.lastName}`,
      studentNameAr: s.nameAr,
      itsNumber: s.its || s.studentId,
      grade: s.grade,
      section: s.section,
      parentName: s.fatherName || s.motherName || null,
      periodType: "WEEKLY",
      periodLabel: label,
      dateRange: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      },
      metrics: {
        totalDays: total,
        presentDays: present,
        lateDays: late,
        absentDays: absent,
        earlyDepartureDays: early,
        attendancePercentage: rate,
        punctualityPercentage: punctuality,
        currentStreakDays: s.streakDays,
      },
      dailyRecords,
    };

    const html = generateAttendanceReportEmailHtml(reportData);
    const plainText = generateAttendanceReportPlainText(reportData);
    const subject = `📅 Weekly Attendance Report – ${reportData.studentName} (${rate}%)`;

    for (const email of parentEmails) {
      const isSent = await sendEmail({ to: email, subject, html, text: plainText });
      if (isSent) sent++;
      else failed++;
    }
  }

  lastWeeklyRunDate = new Date().toISOString();
  console.log(`[attendance-scheduler] Weekly dispatch complete. Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed };
}

/**
 * Executes monthly attendance report dispatch for all active students.
 */
export async function runMonthlyAttendanceReportJob(): Promise<{ sent: number; failed: number }> {
  console.log("[attendance-scheduler] Starting automated monthly attendance report dispatch...");
  const now = new Date();
  // Target previous month
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
  const start = new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

  const monthName = start.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const label = `${monthName} ${start.getUTCFullYear()}`;

  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true } },
    include: {
      user: true,
      parentLinks: {
        include: { parent: { include: { user: true } } },
      },
      attendanceRecords: {
        where: { date: { gte: start, lt: end } },
        orderBy: { date: "asc" },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const s of students) {
    const parentEmails = new Set<string>();
    if (s.fatherEmail?.includes("@")) parentEmails.add(s.fatherEmail.trim().toLowerCase());
    if (s.motherEmail?.includes("@")) parentEmails.add(s.motherEmail.trim().toLowerCase());
    for (const link of s.parentLinks) {
      if (link.parent?.user?.email?.includes("@")) parentEmails.add(link.parent.user.email.trim().toLowerCase());
    }

    if (parentEmails.size === 0) continue;

    let present = 0;
    let late = 0;
    let absent = 0;
    let early = 0;
    const dailyRecords: any[] = [];

    for (const r of s.attendanceRecords) {
      if (r.status === "PRESENT") present++;
      else if (r.status === "LATE") late++;
      else if (r.status === "ABSENT") absent++;
      else if (r.status === "EARLY_DEPARTURE") early++;

      const d = new Date(r.date);
      dailyRecords.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        dayName: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        status: r.status,
        checkInTime: r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : null,
        justification: r.justification,
        justificationStatus: r.justificationStatus,
      });
    }

    const total = s.attendanceRecords.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    const punctuality = present + late > 0 ? Math.round((present / (present + late)) * 100) : 100;

    const reportData: AttendanceReportData = {
      studentName: `${s.user.firstName} ${s.user.lastName}`,
      studentNameAr: s.nameAr,
      itsNumber: s.its || s.studentId,
      grade: s.grade,
      section: s.section,
      parentName: s.fatherName || s.motherName || null,
      periodType: "MONTHLY",
      periodLabel: label,
      dateRange: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      },
      metrics: {
        totalDays: total,
        presentDays: present,
        lateDays: late,
        absentDays: absent,
        earlyDepartureDays: early,
        attendancePercentage: rate,
        punctualityPercentage: punctuality,
        currentStreakDays: s.streakDays,
      },
      dailyRecords,
    };

    const html = generateAttendanceReportEmailHtml(reportData);
    const plainText = generateAttendanceReportPlainText(reportData);
    const subject = `📊 Monthly Attendance Report – ${reportData.studentName} (${label})`;

    for (const email of parentEmails) {
      const isSent = await sendEmail({ to: email, subject, html, text: plainText });
      if (isSent) sent++;
      else failed++;
    }
  }

  lastMonthlyRunDate = new Date().toISOString();
  console.log(`[attendance-scheduler] Monthly dispatch complete. Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed };
}

/**
 * Automatically marks all active students who have NOT logged any attendance today as ABSENT.
 */
export async function runAutoMarkAbsentJob(targetDate?: Date): Promise<{
  markedCount: number;
  alreadyLoggedCount: number;
  totalStudents: number;
  markedStudents: Array<{ id: string; name: string; grade: string; section: string }>;
}> {
  console.log("[attendance-scheduler] Starting automated auto-mark absent job...");
  const now = targetDate || new Date();
  const dayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // 1. Fetch active students with class enrollments and existing attendance records for the target day
  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true } },
    include: {
      user: true,
      classEnrollments: {
        where: { isActive: true },
        include: { class: true },
        take: 1,
      },
      attendanceRecords: {
        where: {
          date: { gte: dayStart, lt: dayEnd },
        },
      },
    },
  });

  // Default class fallback if a student is not assigned to an active class
  let fallbackClass = await prisma.class.findFirst({
    where: { isActive: true },
  });
  if (!fallbackClass) {
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    let adminTeacher = await prisma.teacherProfile.findFirst();
    if (!adminTeacher && adminUser) {
      adminTeacher = await prisma.teacherProfile.create({
        data: {
          userId: adminUser.id,
          employeeId: "EMP-ADMIN",
          department: "Administration",
          subjects: ["General"],
        },
      });
    }
    fallbackClass = await prisma.class.create({
      data: {
        name: "General Attendance",
        grade: "All",
        section: "A",
        subject: "General",
        academicYear: "1446-1447",
        teacherId: adminTeacher?.id || "admin",
      },
    });
  }

  const markedStudents: Array<{ id: string; name: string; grade: string; section: string }> = [];
  let alreadyLoggedCount = 0;

  for (const s of students) {
    if (s.attendanceRecords.length > 0) {
      alreadyLoggedCount++;
      continue;
    }

    const assignedClass = s.classEnrollments[0]?.class || fallbackClass;

    // Check if student has an active approved leave for today
    const hasApprovedLeave = await prisma.leaveRequest.findFirst({
      where: {
        studentId: s.id,
        status: "APPROVED",
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
    });

    if (hasApprovedLeave) {
      const registryStatus = hasApprovedLeave.type === "MEDICAL" ? "MEDICAL" : "ON_LEAVE";
      const registrySource = hasApprovedLeave.type === "MEDICAL" ? "MEDICAL_LEAVE" : "LEAVE_APPROVED";

      await prisma.attendanceRegistry.upsert({
        where: {
          studentId_date: {
            studentId: s.id,
            date: dayStart,
          },
        },
        create: {
          studentId: s.id,
          date: dayStart,
          status: registryStatus,
          source: registrySource,
          remarks: `Approved ${hasApprovedLeave.type} Leave`,
          leaveId: hasApprovedLeave.id,
          recordedById: "system-leave-scheduler",
        },
        update: {
          status: registryStatus,
          source: registrySource,
          remarks: `Approved ${hasApprovedLeave.type} Leave`,
          leaveId: hasApprovedLeave.id,
        },
      });

      // Also ensure AttendanceRecord exists for the assigned class
      await prisma.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: s.id,
            classId: assignedClass.id,
            date: dayStart,
          },
        },
        create: {
          studentId: s.id,
          classId: assignedClass.id,
          date: dayStart,
          status: registryStatus,
          source: registrySource,
          verificationMethod: "LEAVE_PORTAL",
          recordedById: "system-leave-scheduler",
          justification: `Approved ${hasApprovedLeave.type} Leave`,
          justificationStatus: "APPROVED",
        },
        update: {
          status: registryStatus,
          source: registrySource,
        },
      });

      alreadyLoggedCount++;
      continue; // Skip auto-absent
    }

    // Create ABSENT attendance record
    await prisma.attendanceRecord.upsert({
      where: {
        studentId_classId_date: {
          studentId: s.id,
          classId: assignedClass.id,
          date: dayStart,
        },
      },
      create: {
        studentId: s.id,
        classId: assignedClass.id,
        date: dayStart,
        status: "ABSENT",
        verificationMethod: "AUTO_SYSTEM",
        recordedById: "system-auto-absent",
      },
      update: {
        status: "ABSENT",
        verificationMethod: "AUTO_SYSTEM",
      },
    });

    // Reset streak on absence
    if (s.streakDays > 0) {
      await prisma.studentProfile.update({
        where: { id: s.id },
        data: { streakDays: 0 },
      });
    }

    // Send in-app notification to student
    await prisma.notification.create({
      data: {
        userId: s.userId,
        title: "Absence Logged",
        body: `You were marked absent on ${dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. If this was an error, please submit an absence justification.`,
        type: "ALERT",
        link: "/talabat/attendance",
        priority: "HIGH",
      },
    });

    markedStudents.push({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      grade: s.grade,
      section: s.section,
    });
  }

  console.log(`[attendance-scheduler] Auto-mark absent job completed: ${markedStudents.length} marked absent, ${alreadyLoggedCount} already logged.`);
  return {
    markedCount: markedStudents.length,
    alreadyLoggedCount,
    totalStudents: students.length,
    markedStudents,
  };
}

let intervalTimer: NodeJS.Timeout | null = null;

/**
 * Faculty expected roster for a target day: teachers the faculty timer of the
 * unified schedule event applies to. Empty applicableTeacherIds = all active
 * teachers. Falls back to legacy standalone faculty rows (pre-unification).
 */
export async function getExpectedFacultyForDay(): Promise<
  Array<{ id: string; name: string; department: string | null; userId: string }>
> {
  const rows = (await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  })) as unknown as Array<{
    id: string;
    name: string;
    applicableTeacherIds: string[];
    facultyStartTime: string | null;
    facultyEndTime: string | null;
    facultyEnabled: boolean;
  }>;

  const hasFacultyTimer = (w: { facultyStartTime: string | null; facultyEndTime: string | null }) =>
    Boolean(w.facultyStartTime && w.facultyEndTime);
  const isLegacyFaculty = (w: { id: string; name: string }) =>
    w.id === "faculty_default" ||
    w.id === "faculty" ||
    /faculty|teacher|staff|asateezah/i.test(w.name);

  const unified =
    rows.find((w) => w.id === "default" && hasFacultyTimer(w)) ??
    rows.find((w) => hasFacultyTimer(w) && w.facultyEnabled) ??
    rows.find((w) => isLegacyFaculty(w));

  const applicable = unified?.applicableTeacherIds ?? [];
  const teachers = await prisma.teacherProfile.findMany({
    where: {
      user: { isActive: true },
      ...(applicable.length > 0 ? { id: { in: applicable } } : {}),
    },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { employeeId: "asc" },
  });

  return teachers.map((t) => ({
    id: t.id,
    name: `${t.user.firstName} ${t.user.lastName}`.trim(),
    department: t.department,
    userId: t.userId,
  }));
}

/**
 * Automatically marks expected faculty (per the window applicability roster)
 * who have NOT scanned today as ABSENT. Teachers outside the roster are skipped.
 */
export async function runAutoMarkFacultyAbsentJob(targetDate?: Date): Promise<{
  markedCount: number;
  alreadyLoggedCount: number;
  skippedCount: number;
  totalExpected: number;
  markedTeachers: Array<{ id: string; name: string }>;
}> {
  console.log("[attendance-scheduler] Starting faculty auto-mark absent job...");
  const now = targetDate || new Date();
  const dayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const expected = await getExpectedFacultyForDay();
  const existing = await prisma.teacherAttendanceRecord.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
    select: { teacherId: true },
  });
  const loggedIds = new Set(existing.map((r) => r.teacherId));

  // Teachers outside the applicability roster are never touched.
  const allActiveCount = await prisma.teacherProfile.count({ where: { user: { isActive: true } } });
  const skippedCount = Math.max(0, allActiveCount - expected.length);

  const markedTeachers: Array<{ id: string; name: string }> = [];
  let alreadyLoggedCount = 0;

  for (const t of expected) {
    if (loggedIds.has(t.id)) {
      alreadyLoggedCount++;
      continue;
    }

    await prisma.teacherAttendanceRecord.upsert({
      where: { teacherId_date: { teacherId: t.id, date: dayStart } },
      create: {
        teacherId: t.id,
        date: dayStart,
        status: "ABSENT",
        verificationMethod: "AUTO_SYSTEM",
        notes: "Auto-marked absent (no scan inside the faculty window)",
      },
      update: { status: "ABSENT", verificationMethod: "AUTO_SYSTEM" },
    });

    await prisma.notification.create({
      data: {
        userId: t.userId,
        title: "Absence Logged",
        body: `You were marked absent on ${dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. If this was an error, please contact admin.`,
        type: "ALERT",
        link: "/faculty/attendance",
        priority: "HIGH",
      },
    });

    markedTeachers.push({ id: t.id, name: t.name });
  }

  console.log(`[attendance-scheduler] Faculty auto-mark absent completed: ${markedTeachers.length} marked, ${alreadyLoggedCount} already logged, ${skippedCount} out of roster.`);
  return {
    markedCount: markedTeachers.length,
    alreadyLoggedCount,
    skippedCount,
    totalExpected: expected.length,
    markedTeachers,
  };
}

/**
 * Initializes background worker that checks periodic trigger conditions every 30 minutes.
 */
export function startAttendanceScheduler() {
  if (intervalTimer) return;

  console.log("[attendance-scheduler] Service initialized");

  // Check every 30 minutes
  intervalTimer = setInterval(async () => {
    try {
      const now = new Date();
      const currentDayOfWeek = now.getUTCDay();
      const currentDayOfMonth = now.getUTCDate();
      const currentHour = now.getUTCHours();
      const todayDateStr = now.toISOString().slice(0, 10);

      // Check daily auto-mark absent
      if (
        config.autoMarkAbsentEnabled &&
        currentHour >= config.autoMarkAbsentHourUtc &&
        lastAutoAbsentRunDate?.slice(0, 10) !== todayDateStr
      ) {
        lastAutoAbsentRunDate = todayDateStr;
        await runAutoMarkAbsentJob();
        await runAutoMarkFacultyAbsentJob();
        // Push the finalized day to the online Google Sheet log
        if (config.sheetSyncEnabled && currentHour >= config.sheetSyncHourUtc) {
          lastSheetSyncRunDate = todayDateStr;
          const { runDailySheetSyncJob } = await import("./google-attendance-sync");
          await runDailySheetSyncJob();
        }
      }

      // Late-evening sheet push (runs even if absents were finalized earlier,
      // e.g. server restarted between the two hours)
      if (
        config.sheetSyncEnabled &&
        currentHour >= config.sheetSyncHourUtc &&
        lastSheetSyncRunDate?.slice(0, 10) !== todayDateStr
      ) {
        lastSheetSyncRunDate = todayDateStr;
        const { runDailySheetSyncJob } = await import("./google-attendance-sync");
        await runDailySheetSyncJob();
      }

      // Check weekly
      if (
        config.autoWeeklyEnabled &&
        currentDayOfWeek === config.weeklyDayOfWeek &&
        currentHour >= config.weeklyHourUtc &&
        lastWeeklyRunDate?.slice(0, 10) !== todayDateStr
      ) {
        await runWeeklyAttendanceReportJob();
      }

      // Check monthly
      if (
        config.autoMonthlyEnabled &&
        currentDayOfMonth === config.monthlyDayOfMonth &&
        currentHour >= config.monthlyHourUtc &&
        lastMonthlyRunDate?.slice(0, 7) !== todayDateStr.slice(0, 7)
      ) {
        await runMonthlyAttendanceReportJob();
      }
    } catch (err) {
      console.error("[attendance-scheduler] Background check error:", err);
    }
  }, 30 * 60 * 1000);
}
