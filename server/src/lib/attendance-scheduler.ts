import prisma from "./prisma";
import { getStartOfDayIST, getISTDetails, broadcastAttendanceEvent, getWindowType } from "./biometric";

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

  // Sunday Institutional Holiday: Do NOT mark absent! Mark Holiday for all active students.
  if (dayStart.getUTCDay() === 0) {
    console.log("[attendance-scheduler] Sunday holiday detected: marking Holiday for all active students, skipping absent.");
    let holidayCount = 0;
    for (const s of students) {
      if (s.attendanceRecords.length > 0 && s.attendanceRecords[0].status !== "ABSENT") {
        continue;
      }
      const assignedClass = s.classEnrollments[0]?.class || fallbackClass;
      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: s.id, date: dayStart } },
        create: {
          studentId: s.id,
          date: dayStart,
          status: "ON_LEAVE",
          source: "LEAVE_APPROVED",
          remarks: "Sunday Holiday",
          recordedById: "system-sunday-holiday",
        },
        update: {
          status: "ON_LEAVE",
          source: "LEAVE_APPROVED",
          remarks: "Sunday Holiday",
        },
      });

      if (assignedClass) {
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
            status: "ON_LEAVE",
            source: "LEAVE_APPROVED",
            verificationMethod: "MANUAL",
            recordedById: "system-sunday-holiday",
            justification: "Sunday Holiday",
            justificationStatus: "APPROVED",
          },
          update: {
            status: "ON_LEAVE",
            source: "LEAVE_APPROVED",
            justification: "Sunday Holiday",
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

  // Default-present fallback: when the biometric terminals recorded ZERO
  // scans today (devices offline / LAN unreachable from the cloud), every
  // unscanned talib is finalized PRESENT instead of ABSENT so a hardware
  // outage never fails the students.
  const defaultPresentMode = (await countRealScansToday(dayStart)) === 0;
  if (defaultPresentMode) {
    console.log("[attendance-scheduler] ⚠️ No real biometric scans recorded today — unscanned talabat will be finalized PRESENT (default-present fallback).");
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

      markedStudents.push({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        grade: s.grade,
        section: s.section,
      });
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
    applicableTeacherIds: string[];
    facultyStartTime: string | null;
    facultyEndTime: string | null;
    facultyEnabled: boolean;
  }>;
  // Hardware attendance roster only derives from automated windows (HIKVISION / BOTH)
  const rows = rawRows.filter((w) => getWindowType(w as any) !== "MANUAL");

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

  // Sunday Institutional Holiday: Do NOT mark faculty absent! Mark Holiday for all expected faculty.
  if (dayStart.getUTCDay() === 0) {
    console.log("[attendance-scheduler] Sunday holiday detected: marking Holiday for faculty, skipping absent.");
    for (const t of expected) {
      await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: t.id, date: dayStart } },
        create: {
          teacherId: t.id,
          date: dayStart,
          status: "ON_LEAVE",
          verificationMethod: "MANUAL",
          notes: "Sunday Holiday",
        },
        update: {
          status: "ON_LEAVE",
          verificationMethod: "MANUAL",
          notes: "Sunday Holiday",
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

    for (const slot of completedSlots) {
      if (!slot.classId) continue;
      const [eh, em] = slot.endTime.split(":").map(Number);
      const slotEndMin = (eh || 0) * 60 + (em || 0);

      // Only process periods that have concluded
      if (nowMin >= slotEndMin) {
        // Default-present fallback: with zero device scans today, unlogged
        // students are propagated as PRESENT (not ABSENT) into class records.
        const defaultPresentMode = (await countRealScansToday(dayStart)) === 0;

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

            const initialStatus = gateLog?.status || (defaultPresentMode ? "PRESENT" : "ABSENT");

            await prisma.attendanceRecord.create({
              data: {
                studentId: en.studentId,
                classId: slot.classId,
                date: dayStart,
                status: initialStatus as any,
                verificationMethod: "AUTO_TIMETABLE_SYNC",
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

      const studentKey = `${todayStr}:${w.id}:STUDENT`;
      if (scanMinutes >= cutoffMin && !finalizedWindowsToday.has(studentKey)) {
        finalizedWindowsToday.add(studentKey);
        console.log(`[attendance-automation] 🚀 Triggering instant auto-finalization for Talabat window "${w.name}" (Cutoff ${w.lateEndTime || w.endTime} IST passed)...`);

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
      const { calendarDayUTC } = getISTDetails(now);
      const isSunday = calendarDayUTC.getUTCDay() === 0;
      const currentDayOfWeek = calendarDayUTC.getUTCDay();
      const currentDayOfMonth = calendarDayUTC.getUTCDate();
      const currentHour = now.getUTCHours();
      const todayDateStr = calendarDayUTC.toISOString().slice(0, 10);

      // A. Real-time window cutoff check & instant auto-mark absent (skipped on Sunday)
      if (!isSunday) {
        await checkAndAutoFinalizeScanWindows();

        // B. Real-time timetable period attendance sync
        await syncClassPeriodAttendance(now);
      }

      // C. Fallback evening auto-mark run (19:30 IST / 14:00 UTC) - skip on Sunday
      if (
        config.autoMarkAbsentEnabled &&
        !isSunday &&
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
