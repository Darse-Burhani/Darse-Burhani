import prisma from "./prisma";
import { cache } from "./cache";
import { sendEmail } from "./email";

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

export interface BadalNotificationPayload {
  id: string;
  date: Date | string;
  className: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  originalTeacherId?: string | null;
  originalTeacherName?: string | null;
  badalTeacherId?: string | null;
  badalTeacherName?: string | null;
  reason?: string | null;
  instructions?: string | null;
  notes?: string | null;
  originalTeacher?: any;
  badalTeacher?: any;
}

export async function notifyBadalAssignment(badal: BadalNotificationPayload, actorName?: string) {
  try {
    let substituteUser: { id: string; email: string; firstName: string; lastName: string } | null = null;

    if (badal.badalTeacher?.user?.email) {
      substituteUser = badal.badalTeacher.user;
    } else if (badal.badalTeacherId) {
      const tp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: badal.badalTeacherId }, { userId: badal.badalTeacherId }] },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
      if (tp?.user) {
        substituteUser = tp.user;
      }
    }

    const d = new Date(badal.date);
    const dateFormatted = isNaN(d.getTime())
      ? String(badal.date).split("T")[0]
      : new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(d);

    const subName = substituteUser
      ? `${substituteUser.firstName} ${substituteUser.lastName}`.trim()
      : badal.badalTeacherName || "Respected Faculty Member";
    const origTeacher = badal.originalTeacherName || (badal.originalTeacher?.user ? `${badal.originalTeacher.user.firstName} ${badal.originalTeacher.user.lastName}`.trim() : "Faculty Member");
    const reasonText = badal.reason || "Official Substitution / Leave Coverage";
    const instructionsText = badal.instructions || "Please conduct the assigned portion and maintain classroom discipline.";
    const appUrl = process.env.APP_URL || "https://darse-burhani.onrender.com";

    // 1. Send Urgent Email Notification
    let emailSent = false;
    if (substituteUser?.email) {
      const emailSubject = `🚨 [URGENT] Substitute Assignment (Badal): Period ${badal.period} (${badal.startTime}–${badal.endTime}) in Class ${badal.className}`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Urgent Badal Assignment</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
    <!-- Urgent Alert Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); padding: 14px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 13px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase;">
          🚨 URGENT BADAL (SUBSTITUTE) ASSIGNMENT
        </span>
      </td>
    </tr>

    <!-- Institutional Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #021f18 100%); padding: 28px 32px; border-bottom: 3px solid #d4af37;">
        <div style="color: #d4af37; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase;">
          AL-JAMEA-TUS-SAIFIYAH • IDARAH DARSE BURHANI
        </div>
        <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 22px; font-weight: 800; line-height: 1.3;">
          Immediate Class Substitution Notice
        </h1>
        <div style="color: #a7f3d0; font-size: 13px; margin-top: 4px;">
          Academic Session 1448 H • Faculty Timetable Dispatch
        </div>
      </td>
    </tr>

    <!-- Content Body -->
    <tr>
      <td style="padding: 32px 32px 24px 32px;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 18px 0; color: #0f172a;">
          <strong>Afzalus Salam Janab ${subName},</strong>
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; color: #334155;">
          You have been officially assigned by the administration (${actorName || "Academic Coordinator"}) to cover an urgent substitute duty (Badal) for the following class session:
        </p>

        <!-- Details Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 16px; border: 1px solid #cbd5e1; margin-bottom: 24px; overflow: hidden;">
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600; width: 35%;">
              📅 Target Date
            </td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-weight: 800;">
              ${dateFormatted}
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              ⏰ Period &amp; Time
            </td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #b45309; font-weight: 900;">
              Period ${badal.period} (${badal.startTime} – ${badal.endTime})
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              🏫 Class / Darajah
            </td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #047857; font-weight: 800;">
              Class ${badal.className}
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              📖 Subject
            </td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-weight: 800;">
              ${badal.subject}
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              👤 Covering For
            </td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; font-weight: 700;">
              ${origTeacher}
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              📋 Reason
            </td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
              ${reasonText}
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; font-size: 13px; color: #64748b; font-weight: 600;">
              📌 Instructions
            </td>
            <td style="padding: 14px 18px; font-size: 13px; color: #0f172a; font-style: italic;">
              ${instructionsText}
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0 20px 0;">
          <a href="${appUrl}/teacher/timetable" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); color: #021f18; font-weight: 900; font-size: 14px; padding: 14px 32px; border-radius: 14px; text-decoration: none; box-shadow: 0 4px 16px rgba(212,175,55,0.4); text-transform: uppercase; letter-spacing: 0.05em;">
            Open Faculty Timetable on Portal →
          </a>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 11px; color: #64748b; margin: 0; line-height: 1.5;">
          This is an urgent academic dispatch from <strong>Darse Burhani Portal</strong>.<br>
          Al-Jamea-tus-Saifiyah • Faculty Timetable &amp; Roll-Call Management.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      emailSent = await sendEmail({
        to: substituteUser.email,
        subject: emailSubject,
        html: emailHtml,
      });
    }

    // 2. Create High-Priority In-Portal Notification
    if (substituteUser?.id) {
      await prisma.notification.create({
        data: {
          userId: substituteUser.id,
          title: `🚨 [URGENT] Badal Substitute Duty: Class ${badal.className} (P${badal.period})`,
          body: `You are assigned to substitute for ${origTeacher} in Class ${badal.className} for Period ${badal.period} (${badal.startTime}–${badal.endTime}) - ${badal.subject}.`,
          type: "BADAL_ASSIGNED",
          link: "/teacher/timetable",
          priority: "URGENT",
        },
      });
    }

    // 3. Invalidate caches so the portal reflects changes immediately
    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");
    cache.invalidateTag("timetablebadal");

    return {
      success: true,
      emailSent,
      substituteEmail: substituteUser?.email || null,
    };
  } catch (error) {
    console.error("[timetable-notify] Error notifying badal assignment:", error);
    return { success: false, error: (error as Error)?.message };
  }
}

