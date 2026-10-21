import prisma from "./prisma";
import { cache } from "./cache";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface TimetableChangeNotificationPayload {
  classId?: string | null;
  className?: string | null;
  slotId?: string | null;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherId?: string | null;
  teacherName?: string | null;
  roomNumber?: string | null;
  changeType: "CREATED" | "UPDATED" | "DELETED" | "SWAPPED";
  oldDetails?: {
    subject?: string;
    teacherName?: string;
    roomNumber?: string;
    startTime?: string;
    endTime?: string;
  };
  actorName?: string;
}

// In-memory ring buffer of recent timetable changes (last 50 changes)
export interface RecentChangeItem {
  id: string;
  slotId?: string | null;
  classId?: string | null;
  className: string;
  dayOfWeek: number;
  dayName: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherName: string;
  roomNumber?: string | null;
  changeType: "CREATED" | "UPDATED" | "DELETED" | "SWAPPED";
  changeDescription: string;
  changedAt: string;
  actorName?: string;
}

const recentChangesStore: RecentChangeItem[] = [];

export function getRecentTimetableChanges(limit = 20): RecentChangeItem[] {
  return recentChangesStore.slice(0, limit);
}

export function isSlotRecentlyChanged(slot: { id: string; className?: string | null; dayOfWeek: number; period: number }): RecentChangeItem | null {
  const match = recentChangesStore.find(
    (c) => (c.slotId && c.slotId === slot.id) || (c.className === slot.className && c.dayOfWeek === slot.dayOfWeek && c.period === slot.period)
  );
  return match || null;
}

export async function notifyTimetableChange(payload: TimetableChangeNotificationPayload) {
  try {
    const {
      classId,
      className,
      slotId,
      dayOfWeek,
      period,
      startTime,
      endTime,
      subject,
      teacherId,
      teacherName,
      roomNumber,
      changeType,
      oldDetails,
      actorName,
    } = payload;

    const dayName = DAYS[dayOfWeek] || `Day ${dayOfWeek}`;

    // 1. Resolve Class
    let targetClass: any = null;
    if (classId) {
      targetClass = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          masool: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
          enrollments: {
            where: { isActive: true },
            include: { student: { select: { id: true, userId: true } } },
          },
        },
      });
    }

    if (!targetClass && className) {
      targetClass = await prisma.class.findFirst({
        where: { name: className, academicYear: "1448 H" },
        include: {
          masool: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
          enrollments: {
            where: { isActive: true },
            include: { student: { select: { id: true, userId: true } } },
          },
        },
      });
    }

    const resolvedClassName = targetClass?.name || className || "Darajah";

    // 2. Build descriptive change text
    let changeDescription = "";
    if (changeType === "CREATED") {
      changeDescription = `New session added: ${dayName} Period ${period} (${startTime}–${endTime}) is ${subject} with ${teacherName || "Assigned Teacher"}.`;
    } else if (changeType === "DELETED") {
      changeDescription = `Period ${period} on ${dayName} (${subject}) was removed from timetable.`;
    } else if (oldDetails && oldDetails.subject && oldDetails.subject !== subject) {
      changeDescription = `${dayName} Period ${period}: Subject changed from "${oldDetails.subject}" to "${subject}" (${teacherName || "Assigned Teacher"}).`;
    } else if (oldDetails && oldDetails.teacherName && oldDetails.teacherName !== teacherName) {
      changeDescription = `${dayName} Period ${period} (${subject}): Teacher reassigned from ${oldDetails.teacherName} to ${teacherName || "Assigned Teacher"}.`;
    } else {
      changeDescription = `${dayName} Period ${period} (${startTime}–${endTime}) updated: ${subject} with ${teacherName || "Assigned Teacher"}.`;
    }

    // 3. Save to recent in-memory log
    const changeItem: RecentChangeItem = {
      id: `change_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      slotId: slotId || null,
      classId: targetClass?.id || classId || null,
      className: resolvedClassName,
      dayOfWeek,
      dayName,
      period,
      startTime,
      endTime,
      subject,
      teacherName: teacherName || "Assigned Teacher",
      roomNumber: roomNumber || null,
      changeType,
      changeDescription,
      changedAt: new Date().toISOString(),
      actorName: actorName || "Administration",
    };

    // Keep ring buffer under 50 items
    recentChangesStore.unshift(changeItem);
    if (recentChangesStore.length > 50) {
      recentChangesStore.pop();
    }

    // 4. Resolve Target Recipients (Teacher, Students, Masool)
    const teacherUserIds = new Set<string>();
    const studentUserIds = new Set<string>();

    // Target Slot Teacher
    if (teacherId) {
      const tp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: teacherId }, { userId: teacherId }] },
        select: { userId: true },
      });
      if (tp?.userId) teacherUserIds.add(tp.userId);
    }

    // Masool of the class
    if (targetClass?.masool?.userId) {
      teacherUserIds.add(targetClass.masool.userId);
    }

    // Enrolled students of the class
    if (targetClass?.enrollments) {
      for (const e of targetClass.enrollments) {
        if (e.student?.userId) {
          studentUserIds.add(e.student.userId);
        }
      }
    }

    const title = `📅 Timetable Update: Class ${resolvedClassName} (P${period})`;

    const notificationEntries: Array<{
      userId: string;
      title: string;
      body: string;
      type: string;
      link: string;
      priority: string;
    }> = [];

    // Notifications for Teachers
    for (const uid of teacherUserIds) {
      notificationEntries.push({
        userId: uid,
        title,
        body: changeDescription,
        type: "TIMETABLE_CHANGE",
        link: "/teacher/timetable",
        priority: "HIGH",
      });
    }

    // Notifications for Students
    for (const uid of studentUserIds) {
      notificationEntries.push({
        userId: uid,
        title,
        body: changeDescription,
        type: "TIMETABLE_CHANGE",
        link: "/talabat/timetable",
        priority: "HIGH",
      });
    }

    if (notificationEntries.length > 0) {
      await prisma.notification.createMany({
        data: notificationEntries,
      });
    }

    // Invalidate caches
    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");
    cache.invalidateTag("class");

    return {
      success: true,
      notifiedTeachersCount: teacherUserIds.size,
      notifiedStudentsCount: studentUserIds.size,
      changeItem,
    };
  } catch (error) {
    console.error("[timetable-notify] Error broadcasting timetable notification:", error);
    return { success: false, error: (error as Error)?.message };
  }
}
