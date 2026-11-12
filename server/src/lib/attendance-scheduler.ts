import prisma from "./prisma";
import { getStartOfDayIST, getISTDetails, broadcastAttendanceEvent, getWindowType, getAudienceType } from "./biometric";

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
  autoWeeklyEnabled: false, // paused by default
  weeklyDayOfWeek: parseInt(process.env.WEEKLY_ATTENDANCE_DAY || "0", 10), // Sunday
  weeklyHourUtc: parseInt(process.env.WEEKLY_ATTENDANCE_HOUR || "4", 10), // 4am UTC (9:30am IST)
  autoMonthlyEnabled: false, // paused by default
  monthlyDayOfMonth: 1,
  monthlyHourUtc: 4,
  autoMarkAbsentEnabled: process.env.AUTO_MARK_ABSENT_ENABLED !== "false", // enabled by default
  autoMarkAbsentHourUtc: parseInt(process.env.AUTO_MARK_ABSENT_HOUR || "14", 10), // 14:00 UTC / 19:30 IST
  autoDailyEmailEnabled: false, // paused by default
  sheetSyncEnabled: process.env.GOOGLE_SHEET_DAILY_SYNC !== "false", // enabled by default when configured
  sheetSyncHourUtc: parseInt(process.env.GOOGLE_SHEET_SYNC_HOUR || "15", 10), // 15:00 UTC / 20:30 IST
};

let lastWeeklyRunDate: string | null = null;
let lastMonthlyRunDate: string | null = null;
let lastAutoAbsentRunDate: string | null = null;
let lastSheetSyncRunDate: string | null = null;

// Track which windows have already finalized attendance today (Key: "YYYY-MM-DD:windowId:role")
const finalizedWindowsToday = new Set<string>();

const AUTO_PRESENT_REMARKS = "Auto-present — no device scans recorded today";

/**
 * Counts *real* biometric scans for the given IST day. Registry rows written by
 * device processing always carry a check-in time; auto-generated rows
 * (auto-present / holiday / leave) never do, so they can't mask an outage.
 */
async function countRealScansToday(dayStart: Date): Promise<number> {
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return prisma.attendanceRegistry.count({
    where: {
      date: { gte: dayStart, lt: dayEnd },
      source: "BIOMETRIC",
      checkInTime: { not: null },
    },
  });
}

/** Called by manual sync or automated triggers */
export function markSheetSyncRan(dateStr = new Date().toISOString().slice(0, 10)) {
  lastSheetSyncRunDate = dateStr;
  return lastSheetSyncRunDate;
}

/**
 * Automated email reports disabled per system configuration.
 */
export async function runDailyAttendanceEmailDigestJob(_targetDate?: Date): Promise<{ sent: number; failed: number }> {
  return { sent: 0, failed: 0 };
}

export async function runWeeklyAttendanceReportJob(_targetDate?: Date): Promise<{ sent: number; failed: number }> {
  return { sent: 0, failed: 0 };
}

export async function runMonthlyAttendanceReportJob(_targetDate?: Date): Promise<{ sent: number; failed: number }> {
  return { sent: 0, failed: 0 };
}



/**
 * Automatically marks all active students who have NOT logged any attendance today as ABSENT.
 */
export async function runAutoMarkAbsentJob(targetDate?: Date): Promise<{
  markedCount: number;
  defaultPresentMode: boolean;
  alreadyLoggedCount: number;
  totalStudents: number;
  medicalCount?: number;
  exemptCount?: number;
  markedStudents: Array<{ id: string; name: string; grade: string; section: string }>;
}> {
  console.log("[attendance-scheduler] Starting automated auto-mark absent job...");
  const now = new Date();
  const istNow = getISTDetails(now);
  const dayStart = getStartOfDayIST(targetDate || now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Safety guard: Auto-mark absent should NEVER run before morning arrival window ends (09:00 AM IST)
  // on the current day, preventing premature false absent markings.
  const isTargetToday = dayStart.getTime() === getStartOfDayIST(now).getTime();
  if (isTargetToday && istNow.scanMinutes < 540) {
    console.warn(`[attendance-scheduler] Guard triggered: Skipping auto-mark absent because current time (${istNow.timeFormatted12}) is before 09:00 AM IST morning arrival cutoff.`);
    return {
      markedCount: 0,
      defaultPresentMode: false,
      alreadyLoggedCount: 0,
      totalStudents: 0,
      markedStudents: [],
    };
  }

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
      attendanceRegistries: {
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

  // 1. Check Institutional Calendar Holiday (AcademicCalendarEvent) or Sunday
  const calendarHoliday = await prisma.academicCalendarEvent.findFirst({
    where: {
      eventType: "HOLIDAY",
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
  });
  const isSunday = dayStart.getUTCDay() === 0;
  const isInstitutionalHoliday = Boolean(isSunday || calendarHoliday);
  const holidayLabel = calendarHoliday?.title || "Sunday Holiday";

  if (isInstitutionalHoliday) {
    console.log(`[attendance-scheduler] Institutional holiday detected (${holidayLabel}): marking Holiday for all active students, skipping absent.`);
    let holidayCount = 0;
    for (const s of students) {
      if (s.attendanceRecords.length > 0 && s.attendanceRecords[0].status !== "ABSENT") {
        continue;
      }
      const targetClasses = (s.classEnrollments.map((e) => e.class).filter(Boolean) as any[]);
      if (targetClasses.length === 0 && fallbackClass) targetClasses.push(fallbackClass);

      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: s.id, date: dayStart } },
        create: {
          studentId: s.id,
          date: dayStart,
          status: "ON_LEAVE",
          source: "LEAVE_APPROVED",
          remarks: holidayLabel,
          recordedById: "system-institutional-holiday",
        },
        update: {
          status: "ON_LEAVE",
          source: "LEAVE_APPROVED",
          remarks: holidayLabel,
        },
      });

      for (const assignedClass of targetClasses) {
        await prisma.attendanceRecord.upsert({
          where: {
            studentId_classId_date: {
              studentId: s.id,
              classId: assignedClass.id,
              date: dayStart,
            },
          },
          create: {
            student: { connect: { id: s.id } },
            class: { connect: { id: assignedClass.id } },
            date: dayStart,
            status: "ON_LEAVE",
            source: "LEAVE_APPROVED",
            verificationMethod: "MANUAL",
            recordedById: "system-institutional-holiday",
            justification: holidayLabel,
            justificationStatus: "APPROVED",
          },
          update: {
            status: "ON_LEAVE",
            source: "LEAVE_APPROVED",
            justification: holidayLabel,
          },
        });
      }
      holidayCount++;
    }

    return {
      markedCount: 0,
      defaultPresentMode: false,
      alreadyLoggedCount: holidayCount,
      totalStudents: students.length,
      medicalCount: 0,
      exemptCount: holidayCount,
      markedStudents: [],
    };
  }

  const markedStudents: Array<{ id: string; name: string; grade: string; section: string }> = [];
  let alreadyLoggedCount = 0;
  let medicalCount = 0;
  let exemptCount = 0;

  const allActiveWindows = await prisma.biometricScanWindow.findMany({
    where: { enabled: true },
  });
  // Auto-mark absent only processes automated hardware windows (HIKVISION / BOTH)
  const activeStudentWindows = allActiveWindows.filter(
    (w) => getWindowType(w as any) !== "MANUAL"
  );

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

  // Strict absent mode: unscanned students are marked ABSENT ("no scanning make absent")
  // Disabled auto-present fallback per institutional mandate.
  const defaultPresentMode = false;

  for (const s of students) {
    const hasGatePunch = (s.attendanceRegistries ?? []).some(
      (r: any) => r.status === "PRESENT" || r.status === "LATE" || r.checkInTime !== null
    );
    if (s.attendanceRecords.length > 0 || hasGatePunch) {
      alreadyLoggedCount++;
      continue;
    }

    if (globalExemptStudentIds.has(s.id)) {
      exemptCount++;
      continue;
    }

    const targetClasses = (s.classEnrollments.map((e) => e.class).filter(Boolean) as any[]);
    if (targetClasses.length === 0 && fallbackClass) targetClasses.push(fallbackClass);

    if (windowClassFilterActive && targetClasses.length > 0 && !targetClasses.some((c) => allowedClassIds.has(c.id))) {
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

      for (const assignedClass of targetClasses) {
        await prisma.attendanceRecord.upsert({
          where: {
            studentId_classId_date: {
              studentId: s.id,
              classId: assignedClass.id,
              date: dayStart,
            },
          },
          create: {
            student: { connect: { id: s.id } },
            class: { connect: { id: assignedClass.id } },
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
      }

      medicalCount++;
      alreadyLoggedCount++;
      continue;
    }

    // Default-present fallback (no device scans today): finalize PRESENT
    // instead of ABSENT so an offline scanner never fails the talib.
    if (defaultPresentMode) {
      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: s.id, date: dayStart } },
        create: {
          studentId: s.id,
          date: dayStart,
          status: "PRESENT",
          source: "BIOMETRIC",
          remarks: AUTO_PRESENT_REMARKS,
          recordedById: "system-default-present",
        },
        update: {
          status: "PRESENT",
          source: "BIOMETRIC",
          remarks: AUTO_PRESENT_REMARKS,
        },
      });

      for (const assignedClass of targetClasses) {
        await prisma.attendanceRecord.upsert({
          where: {
            studentId_classId_date: {
              studentId: s.id,
              classId: assignedClass.id,
              date: dayStart,
            },
          },
          create: {
            student: { connect: { id: s.id } },
            class: { connect: { id: assignedClass.id } },
            date: dayStart,
            status: "PRESENT",
            source: "BIOMETRIC",
            verificationMethod: "BIOMETRIC",
            recordedById: "system-default-present",
            justification: AUTO_PRESENT_REMARKS,
            justificationStatus: "APPROVED",
          },
          update: {
            status: "PRESENT",
            source: "BIOMETRIC",
            verificationMethod: "BIOMETRIC",
            justification: AUTO_PRESENT_REMARKS,
            justificationStatus: "APPROVED",
          },
        });
      }

      markedStudents.push({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        grade: s.grade,
        section: s.section,
      });
      continue;
    }

    // Create ABSENT attendance record across enrolled classes
    for (const assignedClass of targetClasses) {
      await prisma.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: s.id,
            classId: assignedClass.id,
            date: dayStart,
          },
        },
        create: {
          student: { connect: { id: s.id } },
          class: { connect: { id: assignedClass.id } },
          date: dayStart,
          status: "ABSENT",
          source: "AUTO_ABSENT",
          verificationMethod: "AUTO_SYSTEM",
          recordedById: "system-auto-absent",
        },
        update: {
          status: "ABSENT",
          source: "AUTO_ABSENT",
          verificationMethod: "AUTO_SYSTEM",
        },
      });
    }

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

  console.log(
    defaultPresentMode
      ? `[attendance-scheduler] Auto-finalize completed in DEFAULT-PRESENT mode: ${markedStudents.length} talabat finalized PRESENT (no device scans today), ${alreadyLoggedCount} already logged (${medicalCount} medical/leave), ${exemptCount} exempt.`
      : `[attendance-scheduler] Auto-mark absent job completed: ${markedStudents.length} marked absent, ${alreadyLoggedCount} already logged (${medicalCount} medical/leave), ${exemptCount} exempt.`
  );
  return {
    markedCount: markedStudents.length,
    defaultPresentMode,
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
  const rawRows = (await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  })) as unknown as Array<{
    id: string;
    name: string;
    enabled: boolean;
    applicableTeacherIds: string[];
    exemptTeacherIds?: string[];
    facultyStartTime: string | null;
    facultyEndTime: string | null;
    facultyEnabled: boolean;
  }>;
  // Hardware attendance roster derives from active automated windows (HIKVISION / BOTH) that are enabled
  const rows = rawRows.filter((w) => getWindowType(w as any) !== "MANUAL" && w.enabled !== false);

  const hasFacultyTimer = (w: { facultyStartTime: string | null; facultyEndTime: string | null }) =>
    Boolean(w.facultyStartTime && w.facultyEndTime);
  const isLegacyFaculty = (w: { id: string; name: string }) =>
    w.id === "faculty_default" ||
    w.id === "faculty" ||
    /faculty|teacher|staff|asateezah/i.test(w.name);

  // Active faculty-relevant windows
  const facultyWindows = rows.filter(
    (w) => hasFacultyTimer(w) || isLegacyFaculty(w) || (Array.isArray(w.applicableTeacherIds) && w.applicableTeacherIds.length > 0)
  );

  // If any active schedule has specific eligible faculty configured, only those faculty are expected across schedules.
  // Faculty not included in any active schedule's applicableTeacherIds will NOT be expected and will NEVER be marked absent.
  const hasSpecificRoster = facultyWindows.some((w) => Array.isArray(w.applicableTeacherIds) && w.applicableTeacherIds.length > 0);
  let applicable: string[] = [];
  if (hasSpecificRoster) {
    const applicableSet = new Set<string>();
    for (const w of facultyWindows) {
      if (Array.isArray(w.applicableTeacherIds) && w.applicableTeacherIds.length > 0) {
        for (const tid of w.applicableTeacherIds) applicableSet.add(tid);
      }
    }
    applicable = Array.from(applicableSet);
  }

  const exemptSet = new Set<string>();
  for (const w of facultyWindows) {
    if (Array.isArray(w.exemptTeacherIds)) {
      for (const eid of w.exemptTeacherIds) exemptSet.add(eid);
    }
  }
  const exemptIds = Array.from(exemptSet);

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
  const now = new Date();
  const istNow = getISTDetails(now);
  const dayStart = getStartOfDayIST(targetDate || now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Safety guard: Faculty auto-mark absent should NEVER run before morning arrival window ends (09:00 AM IST)
  const isTargetToday = dayStart.getTime() === getStartOfDayIST(now).getTime();
  if (isTargetToday && istNow.scanMinutes < 540) {
    console.warn(`[attendance-scheduler] Guard triggered: Skipping faculty auto-mark absent before 09:00 AM IST.`);
    return {
      markedCount: 0,
      alreadyLoggedCount: 0,
      medicalCount: 0,
      skippedCount: 0,
      totalExpected: 0,
      markedTeachers: [],
    };
  }

  const expected = await getExpectedFacultyForDay();

  // 1. Check Institutional Calendar Holiday (AcademicCalendarEvent) or Sunday
  const facultyCalendarHoliday = await prisma.academicCalendarEvent.findFirst({
    where: {
      eventType: "HOLIDAY",
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
  });
  const isFacultySunday = dayStart.getUTCDay() === 0;
  const isFacultyHoliday = Boolean(isFacultySunday || facultyCalendarHoliday);
  const facultyHolidayLabel = facultyCalendarHoliday?.title || "Sunday Holiday";

  if (isFacultyHoliday) {
    console.log(`[attendance-scheduler] Institutional holiday detected (${facultyHolidayLabel}): marking Holiday for faculty, skipping absent.`);
    for (const t of expected) {
      await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: t.id, date: dayStart } },
        create: {
          teacherId: t.id,
          date: dayStart,
          status: "ON_LEAVE",
          verificationMethod: "MANUAL",
          notes: facultyHolidayLabel,
        },
        update: {
          status: "ON_LEAVE",
          verificationMethod: "MANUAL",
          notes: facultyHolidayLabel,
        },
      });
    }

    return {
      markedCount: 0,
      alreadyLoggedCount: expected.length,
      medicalCount: 0,
      skippedCount: 0,
      totalExpected: expected.length,
      markedTeachers: [],
    };
  }

  const existing = await prisma.teacherAttendanceRecord.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
    select: { teacherId: true },
  });
  const loggedIds = new Set(existing.map((r) => r.teacherId));

  // Purge any stale AUTO_SYSTEM absent records for teachers not eligible for scanning today
  if (expected.length > 0) {
    const eligibleIds = expected.map((t) => t.id);
    await prisma.teacherAttendanceRecord.deleteMany({
      where: {
        date: { gte: dayStart, lt: dayEnd },
        verificationMethod: "AUTO_SYSTEM",
        teacherId: { notIn: eligibleIds },
      },
    });
  }

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
      const isMedical = activeMedicalExemption.eventName?.toLowerCase().includes("medical");
      const status = isMedical ? "MEDICAL" : "ON_LEAVE";
      const method = isMedical ? "MEDICAL_DUTY" : "LEAVE_APPROVED";
      const notes = `[${activeMedicalExemption.eventName || "Authorized Leave"}] ${activeMedicalExemption.reason}`;

      await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: t.id, date: dayStart } },
        create: {
          teacherId: t.id,
          date: dayStart,
          status,
          verificationMethod: method,
          notes,
        },
        update: {
          status,
          verificationMethod: method,
          notes,
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
    // Sunday is institutional holiday — no timetable period sync
    if (dayOfWeek === 0) return;

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
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    for (const slot of completedSlots) {
      if (!slot.classId) continue;
      const [eh, em] = slot.endTime.split(":").map(Number);
      const slotEndMin = (eh || 0) * 60 + (em || 0);

      // Only process periods that have concluded
      if (nowMin >= slotEndMin) {
        // Strict mode: unlogged students propagate as ABSENT (no scanning make absent)
        const defaultPresentMode = false;

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

            const isGateBio = gateLog?.source === "BIOMETRIC" || Boolean(gateLog?.checkInTime);
            let initialStatus = gateLog?.status;
            let initialSource = isGateBio ? "BIOMETRIC" : gateLog?.source;

            if (!initialStatus) {
              const approvedLeave = await prisma.leaveRequest.findFirst({
                where: {
                  studentId: en.studentId,
                  status: "APPROVED",
                  startDate: { lte: dayEnd },
                  endDate: { gte: dayStart },
                },
              });
              if (approvedLeave) {
                initialStatus = approvedLeave.type === "MEDICAL" ? "MEDICAL" : "ON_LEAVE";
                initialSource = approvedLeave.type === "MEDICAL" ? "MEDICAL_LEAVE" : "LEAVE_APPROVED";
              } else {
                initialStatus = defaultPresentMode ? "PRESENT" : "ABSENT";
                initialSource = defaultPresentMode ? "BIOMETRIC" : "AUTO_ABSENT";
              }
            }

            await prisma.attendanceRecord.create({
              data: {
                studentId: en.studentId,
                classId: slot.classId,
                date: dayStart,
                status: initialStatus as any,
                source: (initialSource as any) || "AUTO_ABSENT",
                checkInTime: gateLog?.checkInTime || null,
                checkOutTime: gateLog?.checkOutTime || null,
                verificationMethod: isGateBio ? "BIOMETRIC" : "AUTO_TIMETABLE_SYNC",
                biometricMethod: isGateBio ? "FACIAL" : null,
                recordedById: "system-timetable-sync",
                ...(defaultPresentMode && !gateLog
                  ? { justification: AUTO_PRESENT_REMARKS, justificationStatus: "APPROVED" as any }
                  : {}),
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
 * Called whenever an Admin or Assigned Teacher creates or updates an attendance schedule window.
 * 1. Resets finalization status so the window's updated time is evaluated cleanly.
 * 2. If the updated window is currently active, immediately pulls latest punches from terminals
 *    and syncs to class registers.
 * 3. As soon as the new last time/cutoff passes, pulling strictly stops and Render sleeps to save tokens.
 */
export async function handleScheduleWindowChanged(windowId: string): Promise<void> {
  try {
    const now = new Date();
    const { calendarDayUTC, scanMinutes } = getISTDetails(now);
    const todayStr = calendarDayUTC.toISOString().slice(0, 10);

    // Clear previous finalization flags so the updated window can be evaluated with its new cutoff
    finalizedWindowsToday.delete(`${todayStr}:${windowId}:STUDENT`);
    finalizedWindowsToday.delete(`${todayStr}:${windowId}:TEACHER`);

    // Check if the modified window is a hardware window and is currently open
    const window = await prisma.biometricScanWindow.findUnique({ where: { id: windowId } });
    if (!window || !window.enabled) return;

    const winType = getWindowType(window as any);
    if (winType === "MANUAL") return;

    const [sh, sm] = window.startTime.split(":").map(Number);
    const [lh, lm] = (window.lateEndTime || window.endTime).split(":").map(Number);
    const startMin = (sh || 0) * 60 + (sm || 0);
    const cutoffMin = (lh || 0) * 60 + (lm || 0);

    // If current time is within [startMin - 5, cutoffMin], window is currently active!
    if (scanMinutes >= Math.max(0, startMin - 5) && scanMinutes <= cutoffMin) {
      console.log(`[attendance-automation] ⚡ Schedule changed for "${window.name}" and window is ACTIVE now! Triggering instant Hikvision pull...`);
      lastBackgroundHardwarePullMs = Date.now();
      const { pullAllDevicesScansForRange } = await import("./hikvision");
      const dayStart = getStartOfDayIST(now);
      const pullStart = new Date(dayStart.getTime() + startMin * 60000 - 5.5 * 3600000);
      await pullAllDevicesScansForRange(pullStart, now);
      await syncGateRegistryToClassAttendance(now);
    } else {
      console.log(`[attendance-automation] 🕒 Schedule updated for "${window.name}" (${window.startTime} - ${window.lateEndTime || window.endTime}). Outside active hours: terminal pulling inactive (Render sleeps).`);
    }
  } catch (err) {
    console.error("[attendance-automation] handleScheduleWindowChanged error:", err);
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
    // Sunday is institutional holiday — Hikvision scan auto-finalization is disabled
    if (calendarDayUTC.getUTCDay() === 0) {
      return;
    }
    const todayStr = calendarDayUTC.toISOString().slice(0, 10);

    const windows = await prisma.biometricScanWindow.findMany({
      where: { enabled: true },
    });

    for (const w of windows) {
      const [eh, em] = w.endTime.split(":").map(Number);
      const [lh, lm] = (w.lateEndTime || w.endTime).split(":").map(Number);
      const cutoffMin = (lh || eh || 0) * 60 + (lm || em || 0);

      // Check Talabat (Student) timer on the window — ONLY if window applies to students!
      const audience = getAudienceType(w as any);
      if (audience === "ALL_STUDENTS" || audience === "BOTH") {
        const studentKey = `${todayStr}:${w.id}:STUDENT`;
        if (scanMinutes >= cutoffMin && !finalizedWindowsToday.has(studentKey)) {
          finalizedWindowsToday.add(studentKey);
          console.log(`[attendance-automation] 🚀 Triggering instant auto-finalization for Talabat window "${w.name}" (Cutoff ${w.lateEndTime || w.endTime} IST passed)...`);

          // Final sweep pull from devices right at cutoff before auto-marking absents
          const winType = getWindowType(w as any);
          if (winType !== "MANUAL") {
            try {
              const { pullAllDevicesScansForRange } = await import("./hikvision");
              const dayStart = getStartOfDayIST(now);
              const [sh, sm] = w.startTime.split(":").map(Number);
              const winStart = new Date(dayStart.getTime() + ((sh || 0) * 60 + (sm || 0)) * 60000 - 5.5 * 3600000);
              await pullAllDevicesScansForRange(winStart, now);
              await syncGateRegistryToClassAttendance(now);
            } catch (sweepErr) {
              console.warn(`[attendance-automation] Final sweep pull failed for window "${w.name}":`, sweepErr);
            }
          }

          const finalizeResult = await runAutoMarkAbsentJob(now);

          broadcastAttendanceEvent({
            type: "ATTENDANCE_AUTO_FINALIZED",
            windowId: w.id,
            windowName: w.name,
            role: "STUDENT",
            message: finalizeResult.defaultPresentMode
              ? `Talabat attendance window "${w.name}" closed with no device scans recorded today — all unscanned talabat finalized as PRESENT (default-present fallback).`
              : `Talabat Attendance window "${w.name}" closed. Unscanned learners automatically finalized as ABSENT.`,
          });

          // Trigger Google Sheet sync & Parent Daily Email
          if (config.sheetSyncEnabled) {
            try {
              const { runDailySheetSyncJob } = await import("./google-attendance-sync");
              await runDailySheetSyncJob(now);
            } catch { }
          }
          await runDailyAttendanceEmailDigestJob(now);
        }
      }

      // Check faculty timer on the same window — ONLY if window applies to faculty!
      if (audience === "FACULTY" || audience === "BOTH") {
        if (w.facultyStartTime && w.facultyEndTime && (w.facultyEnabled ?? true)) {
          const [flh, flm] = (w.facultyLateEndTime || w.facultyEndTime).split(":").map(Number);
          const facCutoffMin = (flh || 0) * 60 + (flm || 0);
          const facultyKey = `${todayStr}:${w.id}:TEACHER`;

          if (scanMinutes >= facCutoffMin && !finalizedWindowsToday.has(facultyKey)) {
            finalizedWindowsToday.add(facultyKey);
            console.log(`[attendance-automation] 🚀 Triggering instant auto-finalization for Faculty timer on "${w.name}" (Cutoff ${w.facultyLateEndTime || w.facultyEndTime} IST passed)...`);

          // Final sweep pull for faculty timer
          const winType = getWindowType(w as any);
          if (winType !== "MANUAL") {
            try {
              const { pullAllDevicesScansForRange } = await import("./hikvision");
              const dayStart = getStartOfDayIST(now);
              const [fsh, fsm] = (w.facultyStartTime || w.startTime).split(":").map(Number);
              const winStart = new Date(dayStart.getTime() + ((fsh || 0) * 60 + (fsm || 0)) * 60000 - 5.5 * 3600000);
              await pullAllDevicesScansForRange(winStart, now);
              await syncGateRegistryToClassAttendance(now);
            } catch (sweepErr) {
              console.warn(`[attendance-automation] Final sweep pull failed for faculty on window "${w.name}":`, sweepErr);
            }
          }

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
            } catch { }
          }
        }
      }
    }
  }
} catch (err) {
  console.error("[attendance-automation] Window watchdog check error:", err);
}
}

/**
 * Self-healing Gate-to-Class Attendance Auto-Sync:
 * Continuously propagates all biometric punches recorded in AttendanceRegistry
 * into every enrolled class AttendanceRecord for every student, guaranteeing
 * that all class rosters reflect the student's exact scan time and status.
 */
export async function syncGateRegistryToClassAttendance(targetDate?: Date): Promise<void> {
  try {
    const when = targetDate || new Date();
    const dayStart = getStartOfDayIST(when);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const registries = await prisma.attendanceRegistry.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
    });
    if (registries.length === 0) return;

    const regMap = new Map<string, any>();
    registries.forEach((r) => regMap.set(r.studentId, r));

    const enrollments = await prisma.classEnrollment.findMany({
      where: { isActive: true },
      select: { studentId: true, classId: true },
    });

    for (const en of enrollments) {
      const reg = regMap.get(en.studentId);
      if (!reg) continue;

      const isBio = reg.source === "BIOMETRIC" || Boolean(reg.checkInTime);
      await prisma.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: en.studentId,
            classId: en.classId,
            date: dayStart,
          },
        },
        create: {
          student: { connect: { id: en.studentId } },
          class: { connect: { id: en.classId } },
          date: dayStart,
          status: reg.status,
          source: isBio ? "BIOMETRIC" : reg.source,
          checkInTime: reg.checkInTime || null,
          checkOutTime: reg.checkOutTime || null,
          verificationMethod: isBio ? "BIOMETRIC" : "AUTO_SYSTEM",
          biometricMethod: isBio ? "FACIAL" : null,
          justification: reg.remarks || null,
          recordedById: reg.recordedById || en.studentId,
        },
        update: {
          status: reg.status,
          source: isBio ? "BIOMETRIC" : reg.source,
          checkInTime: reg.checkInTime || undefined,
          checkOutTime: reg.checkOutTime || undefined,
          verificationMethod: isBio ? "BIOMETRIC" : undefined,
          biometricMethod: isBio ? "FACIAL" : undefined,
          justification: reg.remarks || undefined,
        },
      }).catch(() => { });
    }
  } catch (err) {
    console.warn("[attendance-sync] Auto-sync gate-to-class notice:", (err as any)?.message || err);
  }
}

let watchdogTimer: NodeJS.Timeout | null = null;
let lastBackgroundHardwarePullMs = 0;
// Keep terminal punches flowing into the feed promptly. The watchdog ticks
// every 60s, so a 45s throttle guarantees a pull on every tick while still
// preventing duplicate overlapping pulls. Override with
// HARDWARE_PULL_THROTTLE_SECONDS if the terminals need a different cadence.
const BACKGROUND_PULL_THROTTLE_MS = (() => {
  const configured = Number(process.env.HARDWARE_PULL_THROTTLE_SECONDS);
  const seconds = Number.isFinite(configured) && configured > 0 ? configured : 45;
  return Math.max(15_000, seconds * 1000);
})();
let lastDormantLogDate = "";

/**
 * Initializes the 24/7 Full Automation Service (runs continuous 60s event loops).
 */
export function startAttendanceScheduler() {
  if (watchdogTimer) return;

  console.log("[attendance-automation] ⚡ 24/7 Full Automation Engine initialized (Real-time window watchdog, auto-absent, timetable sync, and parent digest active)");

  // 1. Run initial window check and self-healing sync immediately
  checkAndAutoFinalizeScanWindows().catch(() => { });
  syncGateRegistryToClassAttendance().catch(() => { });

  // 2. High-frequency 60-second watchdog loop
  watchdogTimer = setInterval(async () => {
    try {
      const now = new Date();
      const { calendarDayUTC, scanMinutes } = getISTDetails(now);
      const isSunday = calendarDayUTC.getUTCDay() === 0;
      const currentDayOfWeek = calendarDayUTC.getUTCDay();
      const currentDayOfMonth = calendarDayUTC.getUTCDate();
      const currentHour = now.getUTCHours();
      const todayDateStr = calendarDayUTC.toISOString().slice(0, 10);

      // A. Real-time window cutoff check & instant auto-mark absent (skipped on Sunday)
      if (!isSunday) {
        await checkAndAutoFinalizeScanWindows();

        // B. Real-time timetable period attendance sync (only during school class hours 07:30 to 16:30 IST)
        if (scanMinutes >= 450 && scanMinutes <= 990) {
          await syncClassPeriodAttendance(now);
        }

        // C. Hardware Terminal Scan Pull & Propagation
        // STRICT SCHEDULE ADHERENCE: Scans are pulled ONLY during active scheduled window times!
        // Outside scheduled windows / after window closes: NO PULLING takes place -> Render stays dormant / sleeps.
        const pullScheduleEnabled = process.env.HARDWARE_PULL_SCHEDULE_ENABLED !== "false";
        if (pullScheduleEnabled) {
          try {
            const { isAnyHardwareWindowOpen } = await import("./biometric");
            const hwStatus = await isAnyHardwareWindowOpen(now, 5).catch(() => ({ isOpen: false, activeWindows: [] as any[] }));
            if (hwStatus.isOpen && hwStatus.activeWindows && hwStatus.activeWindows.length > 0) {
              const nowMs = Date.now();
              if (nowMs - lastBackgroundHardwarePullMs >= BACKGROUND_PULL_THROTTLE_MS) {
                lastBackgroundHardwarePullMs = nowMs;
                const { pullAllDevicesScansForRange } = await import("./hikvision");

                // Determine window start from active windows
                const dayStart = getStartOfDayIST(now);
                const minStartMinutes = Math.min(...hwStatus.activeWindows.map((w: any) => w.startMinutes));
                const pullStart = new Date(dayStart.getTime() + minStartMinutes * 60000 - 5.5 * 3600000);

                console.log(`[attendance-automation] 🕒 Active window (${hwStatus.activeWindows.map((w: any) => w.name).join(", ")}): syncing hardware punches...`);
                await pullAllDevicesScansForRange(pullStart, now);
                await syncGateRegistryToClassAttendance(now);
              }
            } else {
              // Outside scheduled windows: DO NOT PULL. Render can sleep!
              const currentHourStr = `${todayDateStr}:${Math.floor(scanMinutes / 60)}`;
              if (lastDormantLogDate !== currentHourStr) {
                lastDormantLogDate = currentHourStr;
                console.log(`[attendance-automation] 🌙 No hardware scan window active. Terminal polling inactive (Render dormant / sleep friendly).`);
              }
            }
          } catch (pollErr) {
            // Non-critical background hardware poll notification
          }
        }
      }

      // C. Fallback evening auto-mark run (19:30 IST / 14:00 UTC) - skip on Sunday
      // Note: evaluated in IST minutes so UTC day boundaries never trigger a premature midnight run
      const autoMarkAbsentISTMinutes = (config.autoMarkAbsentHourUtc * 60 + 330) % 1440; // 14:00 UTC = 19:30 IST = 1170 min
      if (
        config.autoMarkAbsentEnabled &&
        !isSunday &&
        scanMinutes >= 660 && // At or after 11:00 AM IST (never early morning or midnight!)
        scanMinutes >= autoMarkAbsentISTMinutes &&
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
      const weeklyISTMinutes = (config.weeklyHourUtc * 60 + 330) % 1440;
      if (
        config.autoWeeklyEnabled &&
        currentDayOfWeek === config.weeklyDayOfWeek &&
        scanMinutes >= weeklyISTMinutes &&
        lastWeeklyRunDate?.slice(0, 10) !== todayDateStr
      ) {
        await runWeeklyAttendanceReportJob();
      }

      // E. Automated Monthly Digest (1st of month 09:30 AM IST / 04:00 UTC)
      const monthlyISTMinutes = (config.monthlyHourUtc * 60 + 330) % 1440;
      if (
        config.autoMonthlyEnabled &&
        currentDayOfMonth === config.monthlyDayOfMonth &&
        scanMinutes >= monthlyISTMinutes &&
        lastMonthlyRunDate?.slice(0, 7) !== todayDateStr.slice(0, 7)
      ) {
        await runMonthlyAttendanceReportJob();
      }
    } catch (err) {
      console.error("[attendance-automation] Watchdog tick error:", err);
    }
  }, 60 * 1000); // 60 seconds
}
