import prisma from "./prisma";
import { sendEmail } from "./email";
import { getStartOfDayIST, getISTDetails, broadcastAttendanceEvent } from "./biometric";
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
  autoMarkAbsentHourUtc: number; // fallback evening run
  autoDailyEmailEnabled: boolean;
  sheetSyncEnabled: boolean;
  sheetSyncHourUtc: number; // push to Google Sheet after absents are final
}

const config: SchedulerConfig = {
  autoWeeklyEnabled: process.env.AUTO_WEEKLY_ATTENDANCE_EMAILS !== "false", // enabled by default
  weeklyDayOfWeek: parseInt(process.env.WEEKLY_ATTENDANCE_DAY || "0", 10), // Sunday
  weeklyHourUtc: parseInt(process.env.WEEKLY_ATTENDANCE_HOUR || "4", 10), // 4am UTC (9:30am IST)
  autoMonthlyEnabled: process.env.AUTO_MONTHLY_ATTENDANCE_EMAILS !== "false", // enabled by default
  monthlyDayOfMonth: 1,
  monthlyHourUtc: 4,
  autoMarkAbsentEnabled: process.env.AUTO_MARK_ABSENT_ENABLED !== "false", // enabled by default
  autoMarkAbsentHourUtc: parseInt(process.env.AUTO_MARK_ABSENT_HOUR || "14", 10), // 14:00 UTC / 19:30 IST
  autoDailyEmailEnabled: process.env.AUTO_DAILY_ATTENDANCE_EMAILS !== "false", // enabled by default
  sheetSyncEnabled: process.env.GOOGLE_SHEET_DAILY_SYNC !== "false", // enabled by default when configured
  sheetSyncHourUtc: parseInt(process.env.GOOGLE_SHEET_SYNC_HOUR || "15", 10), // 15:00 UTC / 20:30 IST
};

let lastWeeklyRunDate: string | null = null;
let lastMonthlyRunDate: string | null = null;
let lastAutoAbsentRunDate: string | null = null;
let lastSheetSyncRunDate: string | null = null;
let lastDailyEmailRunDate: string | null = null;

// Track which windows have already finalized attendance today (Key: "YYYY-MM-DD:windowId:role")
const finalizedWindowsToday = new Set<string>();

export function getSchedulerConfig() {
  return {
    ...config,
    lastWeeklyRunDate,
    lastMonthlyRunDate,
    lastAutoAbsentRunDate,
    lastSheetSyncRunDate,
    lastDailyEmailRunDate,
    activeWatchdog: true,
  };
}

export function updateSchedulerConfig(newCfg: Partial<SchedulerConfig>) {
  Object.assign(config, newCfg);
  return getSchedulerConfig();
}

/** Called by manual sync or automated triggers */
export function markSheetSyncRan(dateStr = new Date().toISOString().slice(0, 10)) {
  lastSheetSyncRunDate = dateStr;
  return lastSheetSyncRunDate;
}

/**
 * Executes automated daily attendance email notifications to parents of absent/late/present students.
 */
export async function runDailyAttendanceEmailDigestJob(targetDate?: Date): Promise<{ sent: number; failed: number }> {
  if (!config.autoDailyEmailEnabled) return { sent: 0, failed: 0 };

  const dayStart = getStartOfDayIST(targetDate || new Date());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dateStr = dayStart.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  console.log(`[attendance-automation] Starting automated daily attendance parent email dispatch for ${dateStr}...`);

  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true } },
    include: {
      user: true,
      parentLinks: {
        include: { parent: { include: { user: true } } },
      },
      attendanceRecords: {
        where: { date: { gte: dayStart, lt: dayEnd } },
        take: 1,
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

    const record = s.attendanceRecords[0];
    const status = record?.status || "ABSENT";
    const checkInIST = record?.checkInTime
      ? getISTDetails(new Date(record.checkInTime)).timeFormatted12
      : "—";

    const studentName = `${s.user.firstName} ${s.user.lastName}`.trim();
    const statusColor = status === "PRESENT" ? "#047857" : status === "LATE" ? "#b45309" : "#b91c1c";
    const statusEmoji = status === "PRESENT" ? "✅" : status === "LATE" ? "⚠️" : "❌";

    const subject = `${statusEmoji} Daily Attendance Notice: ${studentName} (${status}) – ${dateStr}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #093b2a 0%, #0d503a 100%); padding: 24px; text-align: center;">
          <h2 style="color: #d4af37; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">DARSE BURHANI</h2>
          <p style="color: #ecfdf5; margin: 4px 0 0 0; font-size: 13px;">Daily Attendance Notification</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 14px; color: #334155; margin-top: 0;">Respected Parents of <strong>${studentName}</strong>,</p>
          <div style="background: #f8fafc; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; margin: 16px 0;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Student:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${studentName} (ITS: ${s.its || s.studentId})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Grade / Section:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">Grade ${s.grade}-${s.section}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Date:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Attendance Status:</td>
                <td style="padding: 6px 0;">
                  <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; font-weight: 800; font-size: 12px; color: #ffffff; background-color: ${statusColor};">
                    ${status}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Check-In Time:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${checkInIST}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
            This is an automated attendance notice generated by the Darse Burhani Biometric Gateway. For questions or absence justifications, please log in to the Parent Portal.
          </p>
        </div>
      </div>
    `;

    const text = `Darse Burhani Attendance Notice\nStudent: ${studentName}\nDate: ${dateStr}\nStatus: ${status}\nCheck-in Time: ${checkInIST}`;

    for (const email of parentEmails) {
      const isSent = await sendEmail({ to: email, subject, html, text });
      if (isSent) sent++;
      else failed++;
    }
  }

  lastDailyEmailRunDate = new Date().toISOString();
  console.log(`[attendance-automation] Daily parent email dispatch complete. Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed };
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
  medicalCount?: number;
  exemptCount?: number;
  markedStudents: Array<{ id: string; name: string; grade: string; section: string }>;
}> {
  console.log("[attendance-scheduler] Starting automated auto-mark absent job...");
  const dayStart = getStartOfDayIST(targetDate || new Date());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

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
  let medicalCount = 0;
  let exemptCount = 0;

  const activeStudentWindows = await prisma.biometricScanWindow.findMany({
    where: { enabled: true },
  });

  const windowClassFilterActive = activeStudentWindows.some(
    (w) => ((w as any).applicableClassIds ?? []).length > 0,
  );
  const allowedClassIds = new Set<string>();
  const globalExemptStudentIds = new Set<string>();

  for (const w of activeStudentWindows) {
    const classIds = ((w as any).applicableClassIds ?? []) as string[];
    const exemptIds = ((w as any).exemptStudentIds ?? []) as string[];
    classIds.forEach((id) => allowedClassIds.add(id));
    exemptIds.forEach((id) => globalExemptStudentIds.add(id));
  }

  for (const s of students) {
    if (s.attendanceRecords.length > 0) {
      alreadyLoggedCount++;
      continue;
    }

    if (globalExemptStudentIds.has(s.id)) {
      exemptCount++;
      continue;
    }

    const assignedClass = s.classEnrollments[0]?.class || fallbackClass;

    if (windowClassFilterActive && assignedClass?.id && !allowedClassIds.has(assignedClass.id)) {
      exemptCount++;
      continue;
    }

    const activeMedicalExemption = await prisma.medicalExemption.findFirst({
      where: {
        studentId: s.id,
        date: dayStart,
        isActive: true,
      },
    });

    const hasApprovedLeave = await prisma.leaveRequest.findFirst({
      where: {
        studentId: s.id,
        status: "APPROVED",
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
    });

    if (activeMedicalExemption || hasApprovedLeave) {
      const isMedical = Boolean(activeMedicalExemption || hasApprovedLeave?.type === "MEDICAL");
      const registryStatus = isMedical ? "MEDICAL" : "ON_LEAVE";
      const registrySource = isMedical ? "MEDICAL_LEAVE" : "LEAVE_APPROVED";
      const reasonLabel = activeMedicalExemption?.reason || hasApprovedLeave?.reason || "Medical Duty Exemption";
      const eventLabel = activeMedicalExemption?.eventName || (hasApprovedLeave ? "Approved Leave" : "Medical Duty");

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
          remarks: `[${eventLabel}] ${reasonLabel}`,
          leaveId: hasApprovedLeave?.id || null,
          recordedById: activeMedicalExemption?.assignedById || "system-medical-scheduler",
        },
        update: {
          status: registryStatus,
          source: registrySource,
          remarks: `[${eventLabel}] ${reasonLabel}`,
          leaveId: hasApprovedLeave?.id || null,
        },
      });

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
          verificationMethod: activeMedicalExemption ? "MEDICAL_DUTY" : "LEAVE_PORTAL",
          recordedById: activeMedicalExemption?.assignedById || "system-medical-scheduler",
          justification: `[${eventLabel}] ${reasonLabel}`,
          justificationStatus: "APPROVED",
        },
        update: {
          status: registryStatus,
          source: registrySource,
        },
      });

      medicalCount++;
      alreadyLoggedCount++;
      continue;
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

    if (s.streakDays > 0) {
      await prisma.studentProfile.update({
        where: { id: s.id },
        data: { streakDays: 0 },
      });
    }

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

  console.log(`[attendance-scheduler] Auto-mark absent job completed: ${markedStudents.length} marked absent, ${alreadyLoggedCount} already logged (${medicalCount} medical/leave), ${exemptCount} exempt.`);
  return {
    markedCount: markedStudents.length,
    alreadyLoggedCount,
    medicalCount,
    exemptCount,
    totalStudents: students.length,
    markedStudents,
  };
}

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
  const exemptIds = ((unified as any)?.exemptTeacherIds ?? []) as string[];
  const teachers = await prisma.teacherProfile.findMany({
    where: {
      user: { isActive: true },
      ...(applicable.length > 0 ? { id: { in: applicable } } : {}),
      ...(exemptIds.length > 0 ? { id: { notIn: exemptIds } } : {}),
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
 * Automatically marks expected faculty who have NOT scanned today as ABSENT.
 */
export async function runAutoMarkFacultyAbsentJob(targetDate?: Date): Promise<{
  markedCount: number;
  alreadyLoggedCount: number;
  medicalCount: number;
  skippedCount: number;
  totalExpected: number;
  markedTeachers: Array<{ id: string; name: string }>;
}> {
  console.log("[attendance-scheduler] Starting faculty auto-mark absent job...");
  const dayStart = getStartOfDayIST(targetDate || new Date());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const expected = await getExpectedFacultyForDay();
  const existing = await prisma.teacherAttendanceRecord.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
    select: { teacherId: true },
  });
  const loggedIds = new Set(existing.map((r) => r.teacherId));

  const allActiveCount = await prisma.teacherProfile.count({ where: { user: { isActive: true } } });
  const skippedCount = Math.max(0, allActiveCount - expected.length);

  const markedTeachers: Array<{ id: string; name: string }> = [];
  let alreadyLoggedCount = 0;
  let medicalCount = 0;

  for (const t of expected) {
    if (loggedIds.has(t.id)) {
      alreadyLoggedCount++;
      continue;
    }

    const activeMedicalExemption = await prisma.medicalExemption.findFirst({
      where: {
        teacherId: t.id,
        date: dayStart,
        isActive: true,
      },
    });

    if (activeMedicalExemption) {
      await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: t.id, date: dayStart } },
        create: {
          teacherId: t.id,
          date: dayStart,
          status: "MEDICAL",
          verificationMethod: "MEDICAL_DUTY",
          notes: `[${activeMedicalExemption.eventName || "Medical Duty"}] ${activeMedicalExemption.reason}`,
        },
        update: {
          status: "MEDICAL",
          verificationMethod: "MEDICAL_DUTY",
          notes: `[${activeMedicalExemption.eventName || "Medical Duty"}] ${activeMedicalExemption.reason}`,
        },
      });
      medicalCount++;
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

  console.log(`[attendance-scheduler] Faculty auto-mark absent completed: ${markedTeachers.length} marked, ${alreadyLoggedCount} logged (${medicalCount} medical), ${skippedCount} out of roster.`);
  return {
    markedCount: markedTeachers.length,
    alreadyLoggedCount,
    medicalCount,
    skippedCount,
    totalExpected: expected.length,
    markedTeachers,
  };
}

/**
 * Automatically syncs completed class timetable period attendance from gate logs.
 */
async function syncClassPeriodAttendance(nowIST: Date): Promise<void> {
  try {
    const dayOfWeek = nowIST.getDay(); // 0=Sunday
    const { hours, minutes } = getISTDetails(nowIST);
    const nowMin = hours * 60 + minutes;

    const completedSlots = await prisma.timetableSlot.findMany({
      where: {
        dayOfWeek,
        isBreak: false,
        classId: { not: null },
      },
      include: { class: true },
    });

    const dayStart = getStartOfDayIST(nowIST);

    for (const slot of completedSlots) {
      if (!slot.classId) continue;
      const [eh, em] = slot.endTime.split(":").map(Number);
      const slotEndMin = (eh || 0) * 60 + (em || 0);

      // Only process periods that have concluded
      if (nowMin >= slotEndMin) {
        const enrollments = await prisma.classEnrollment.findMany({
          where: { classId: slot.classId, isActive: true },
        });

        for (const en of enrollments) {
          // Check if an attendance record exists for today
          const existing = await prisma.attendanceRecord.findUnique({
            where: {
              studentId_classId_date: {
                studentId: en.studentId,
                classId: slot.classId,
                date: dayStart,
              },
            },
          });

          // If no record exists yet, propagate daily gate check-in status
          if (!existing) {
            const gateLog = await prisma.attendanceRegistry.findUnique({
              where: {
                studentId_date: {
                  studentId: en.studentId,
                  date: dayStart,
                },
              },
            });

            const initialStatus = gateLog?.status || "ABSENT";

            await prisma.attendanceRecord.create({
              data: {
                studentId: en.studentId,
                classId: slot.classId,
                date: dayStart,
                status: initialStatus as any,
                verificationMethod: "AUTO_TIMETABLE_SYNC",
                recordedById: "system-timetable-sync",
              },
            });
          }
        }
      }
    }
  } catch (err) {
    // Non-critical timetable background sync notice
  }
}

/**
 * Real-Time Automation Watchdog:
 * Evaluates active scan windows every 60s and immediately executes auto-mark
 * absent, parent alerts, and cloud sheet sync as soon as a window's cutoff passes!
 */
async function checkAndAutoFinalizeScanWindows(): Promise<void> {
  try {
    const now = new Date();
    const { scanMinutes, calendarDayUTC } = getISTDetails(now);
    const todayStr = calendarDayUTC.toISOString().slice(0, 10);

    const windows = await prisma.biometricScanWindow.findMany({
      where: { enabled: true },
    });

    for (const w of windows) {
      const [sh, sm] = w.startTime.split(":").map(Number);
      const [eh, em] = w.endTime.split(":").map(Number);
      const [lh, lm] = (w.lateEndTime || w.endTime).split(":").map(Number);
      const cutoffMin = (lh || eh || 0) * 60 + (lm || em || 0);

      const studentKey = `${todayStr}:${w.id}:STUDENT`;
      if (scanMinutes >= cutoffMin && !finalizedWindowsToday.has(studentKey)) {
        finalizedWindowsToday.add(studentKey);
        console.log(`[attendance-automation] 🚀 Triggering instant auto-finalization for Talabat window "${w.name}" (Cutoff ${w.lateEndTime || w.endTime} IST passed)...`);

        await runAutoMarkAbsentJob(now);

        broadcastAttendanceEvent({
          type: "ATTENDANCE_AUTO_FINALIZED",
          windowId: w.id,
          windowName: w.name,
          role: "STUDENT",
          message: `Talabat Attendance window "${w.name}" closed. Unscanned learners automatically finalized as ABSENT.`,
        });

        // Trigger Google Sheet sync & Parent Daily Email
        if (config.sheetSyncEnabled) {
          try {
            const { runDailySheetSyncJob } = await import("./google-attendance-sync");
            await runDailySheetSyncJob(now);
          } catch {}
        }
        await runDailyAttendanceEmailDigestJob(now);
      }

      // Check faculty timer on the same window
      if (w.facultyStartTime && w.facultyEndTime && (w.facultyEnabled ?? true)) {
        const [flh, flm] = (w.facultyLateEndTime || w.facultyEndTime).split(":").map(Number);
        const facCutoffMin = (flh || 0) * 60 + (flm || 0);
        const facultyKey = `${todayStr}:${w.id}:TEACHER`;

        if (scanMinutes >= facCutoffMin && !finalizedWindowsToday.has(facultyKey)) {
          finalizedWindowsToday.add(facultyKey);
          console.log(`[attendance-automation] 🚀 Triggering instant auto-finalization for Faculty timer on "${w.name}" (Cutoff ${w.facultyLateEndTime || w.facultyEndTime} IST passed)...`);

          await runAutoMarkFacultyAbsentJob(now);

          broadcastAttendanceEvent({
            type: "ATTENDANCE_AUTO_FINALIZED",
            windowId: w.id,
            windowName: w.name,
            role: "TEACHER",
            message: `Faculty Attendance window for "${w.name}" closed. Unscanned faculty automatically finalized as ABSENT.`,
          });

          if (config.sheetSyncEnabled) {
            try {
              const { runDailySheetSyncJob } = await import("./google-attendance-sync");
              await runDailySheetSyncJob(now);
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.error("[attendance-automation] Window watchdog check error:", err);
  }
}

let watchdogTimer: NodeJS.Timeout | null = null;

/**
 * Initializes the 24/7 Full Automation Service (runs continuous 60s event loops).
 */
export function startAttendanceScheduler() {
  if (watchdogTimer) return;

  console.log("[attendance-automation] ⚡ 24/7 Full Automation Engine initialized (Real-time window watchdog, auto-absent, timetable sync, and parent digest active)");

  // 1. Run initial check immediately
  checkAndAutoFinalizeScanWindows().catch(() => {});

  // 2. High-frequency 60-second watchdog loop
  watchdogTimer = setInterval(async () => {
    try {
      const now = new Date();
      const currentDayOfWeek = now.getUTCDay();
      const currentDayOfMonth = now.getUTCDate();
      const currentHour = now.getUTCHours();
      const todayDateStr = now.toISOString().slice(0, 10);

      // A. Real-time window cutoff check & instant auto-mark absent
      await checkAndAutoFinalizeScanWindows();

      // B. Real-time timetable period attendance sync
      await syncClassPeriodAttendance(now);

      // C. Fallback evening auto-mark run (19:30 IST / 14:00 UTC)
      if (
        config.autoMarkAbsentEnabled &&
        currentHour >= config.autoMarkAbsentHourUtc &&
        lastAutoAbsentRunDate?.slice(0, 10) !== todayDateStr
      ) {
        lastAutoAbsentRunDate = todayDateStr;
        await runAutoMarkAbsentJob();
        await runAutoMarkFacultyAbsentJob();
        if (config.sheetSyncEnabled) {
          lastSheetSyncRunDate = todayDateStr;
          const { runDailySheetSyncJob } = await import("./google-attendance-sync");
          await runDailySheetSyncJob();
        }
        await runDailyAttendanceEmailDigestJob();
      }

      // D. Automated Weekly Digest (Sunday 09:30 AM IST / 04:00 UTC)
      if (
        config.autoWeeklyEnabled &&
        currentDayOfWeek === config.weeklyDayOfWeek &&
        currentHour >= config.weeklyHourUtc &&
        lastWeeklyRunDate?.slice(0, 10) !== todayDateStr
      ) {
        await runWeeklyAttendanceReportJob();
      }

      // E. Automated Monthly Digest (1st of month 09:30 AM IST / 04:00 UTC)
      if (
        config.autoMonthlyEnabled &&
        currentDayOfMonth === config.monthlyDayOfMonth &&
        currentHour >= config.monthlyHourUtc &&
        lastMonthlyRunDate?.slice(0, 7) !== todayDateStr.slice(0, 7)
      ) {
        await runMonthlyAttendanceReportJob();
      }
    } catch (err) {
      console.error("[attendance-automation] Watchdog tick error:", err);
    }
  }, 60 * 1000); // 60 seconds
}
