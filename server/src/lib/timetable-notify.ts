import prisma from "./prisma";
import { cache } from "./cache";
import { sendEmail } from "./email";
import { sendBadalEmailDetailed, getBadalSmtpConfig } from "./badal-email";
import {
  formatBadalWhatsAppMessage,
  dispatchWhatsAppNotification,
  generateWhatsAppLink,
  formatWhatsAppPhone,
} from "./whatsapp";

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

export interface BadalNotificationOptions {
  customSubject?: string;
  customBody?: string;
  customTo?: string;
  customFrom?: string;
  sendEmailNotification?: boolean;
  sendWhatsAppNotification?: boolean;
  customPhone?: string;
}

export type BadalEmailOptions = BadalNotificationOptions;

export function resolveTeacherBadalEmail(
  user?: { email?: string; firstName?: string; lastName?: string } | null,
  altEmail?: string | null,
  fallbackName?: string | null
): string | undefined {
  const combinedName = [fallbackName, user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : ""].filter(Boolean).join(" ");
  const userEmail = user?.email?.trim();
  const alt = altEmail?.trim();

  // Mustafa Sir priority
  if (
    /(mustafa.*sir|mustafa.*tailor|manpur)/i.test(combinedName) ||
    (userEmail && /mustafa.*sir/i.test(userEmail)) ||
    (alt && /mustafa.*sir/i.test(alt))
  ) {
    return "mustafa.sir@darseburhani.com";
  }

  // Official mahadalzahra email priority
  if (userEmail && userEmail.toLowerCase().includes("@mahadalzahra.com")) {
    return userEmail;
  }

  if (userEmail) {
    return userEmail;
  }

  return alt || undefined;
}

export async function notifyBadalAssignment(
  badal: BadalNotificationPayload,
  actorName?: string,
  options?: BadalNotificationOptions
) {
  try {
    let substituteUser: { id: string; email: string; firstName: string; lastName: string } | null = null;
    let substituteMobile: string | null = null;
    let substituteAltEmail: string | null = null;

    if (badal.badalTeacherId) {
      const tp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: badal.badalTeacherId }, { userId: badal.badalTeacherId }] },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
      if (tp) {
        substituteMobile = tp.mobile || null;
        substituteAltEmail = tp.tEmail || null;
        if (tp.user) substituteUser = tp.user;
      }
    } else if (badal.badalTeacher?.user?.email) {
      substituteUser = badal.badalTeacher.user;
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
    const cleanClassName = /^class/i.test(badal.className.trim())
      ? badal.className.trim()
      : `Class ${badal.className.trim()}`;
    const instructionsText = badal.instructions?.trim() || "Will be written by Maktab Taalim";
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://darse-burhani.onrender.com").replace(/\/+$/, "");

    // ─────────────────────────────────────────────────────────────
    // 1. DEDICATED BADAL EMAIL DISPATCH
    // ─────────────────────────────────────────────────────────────
    let emailSent = false;
    let emailMailbox: string | undefined;
    let emailError: string | undefined;
    const recipientEmail = options?.customTo?.trim() || resolveTeacherBadalEmail(substituteUser, substituteAltEmail, subName);
    const shouldSendEmail = options?.sendEmailNotification !== false;

    // Generate matching plain-text institutional format
    const plainTextNotice = formatBadalWhatsAppMessage({
      substituteTeacherName: subName,
      originalTeacherName: origTeacher,
      className: badal.className,
      period: badal.period,
      startTime: badal.startTime,
      endTime: badal.endTime,
      subject: badal.subject,
      date: dateFormatted,
      reason: reasonText,
      instructions: instructionsText,
      assignedBy: actorName || "Maktab Taalim",
      portalUrl: appUrl,
    });

    if (recipientEmail && shouldSendEmail) {
      const emailSubject =
        options?.customSubject?.trim() ||
        `🚨 (URGENT) - BADAL PERIOD INTIMATION: ${cleanClassName} Period ${badal.period} (${dateFormatted})`;

      const customBodyHtml = options?.customBody?.trim()
        ? `<div style="background: #f8fafc; border-left: 4px solid #d4af37; padding: 18px 20px; border-radius: 12px; margin-bottom: 24px; font-size: 14px; line-height: 1.7; color: #1e293b; white-space: pre-wrap;">${options.customBody.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
        : "";

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Badal Period Intimation</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
    <!-- Urgent Alert Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); padding: 14px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 13px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase;">
          🚨 (URGENT) - BADAL PERIOD INTIMATION
        </span>
      </td>
    </tr>

    <!-- Institutional Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #021f18 100%); padding: 24px 32px; border-bottom: 3px solid #d4af37;">
        <div style="color: #d4af37; font-size: 13px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase;">
          DARSE BURHANI • MAHAD AL-ZAHRA
        </div>
        <div style="color: #a7f3d0; font-size: 13px; font-weight: 700; font-style: italic; margin-top: 4px;">
          Maktab Taalim • Galiakot
        </div>
      </td>
    </tr>

    <!-- Content Body -->
    <tr>
      <td style="padding: 32px 32px 24px 32px;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #0f172a;">
          <strong>Afzalus Salam Janab ${subName},</strong>
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
          You have been officially assigned by the Matkab Taalim as a substitute teacher (<em>Badal</em>) for the following session:
        </p>

        ${customBodyHtml}

        <!-- Details Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 16px; border: 1px solid #cbd5e1; margin-bottom: 24px; overflow: hidden;">
          <tr>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600; width: 38%;">
              • Date:
            </td>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-weight: 800;">
              📅 ${dateFormatted}
            </td>
          </tr>
          <tr>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              • Period &amp; Time:
            </td>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #b45309; font-weight: 900;">
              ⏰ Period ${badal.period} (${badal.startTime} – ${badal.endTime})
            </td>
          </tr>
          <tr>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              • Darajah / Class:
            </td>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #047857; font-weight: 800;">
              🏫 ${cleanClassName}
            </td>
          </tr>
          <tr>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
              • On behalf of :
            </td>
            <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-weight: 700;">
              👤 ${origTeacher}
            </td>
          </tr>
          <tr>
            <td style="padding: 13px 18px; font-size: 13px; color: #64748b; font-weight: 600;">
              • Instructions:
            </td>
            <td style="padding: 13px 18px; font-size: 13px; color: #0f172a; font-weight: 600;">
              📝 ${instructionsText}
            </td>
          </tr>
        </table>

        <!-- Prompt Arrival Reminder -->
        <p style="font-size: 13px; font-weight: 800; color: #064e3b; margin: 20px 0 24px 0; text-align: center;">
          Kindly ensure your prompt arrival at the classroom for the above session.
        </p>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 24px 0 16px 0;">
          <a href="${appUrl}/teacher/timetable" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); color: #021f18; font-weight: 900; font-size: 13px; padding: 12px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(212,175,55,0.35); text-transform: uppercase; letter-spacing: 0.05em;">
            Open Faculty Timetable on Portal →
          </a>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 11px; color: #64748b; margin: 0; line-height: 1.6; font-style: italic;">
          ⚠️ NOTICE: Automated institutional notice from Maktab Taalim • Darse Burhani.<br>
          For any Queries, please contact Maktab Taalim
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const emailRes = await sendBadalEmailDetailed({
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: plainTextNotice,
        customFrom: options?.customFrom,
      });

      emailSent = emailRes.success;
      emailMailbox = emailRes.mailbox;
      emailError = emailRes.error;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. WHATSAPP NOTIFICATION DISPATCH & 1-CLICK LINK GENERATION
    // ─────────────────────────────────────────────────────────────
    let waSent = false;
    let waLink: string | null = null;
    let waPhoneUsed: string | null = null;
    let waError: string | undefined;

    const rawPhone = options?.customPhone?.trim() || substituteMobile;
    const cleanPhone = formatWhatsAppPhone(rawPhone);
    const shouldSendWhatsApp = options?.sendWhatsAppNotification !== false;

    if (cleanPhone) {
      waPhoneUsed = cleanPhone;
      const waMessage = formatBadalWhatsAppMessage({
        substituteTeacherName: subName,
        originalTeacherName: origTeacher,
        className: badal.className,
        period: badal.period,
        startTime: badal.startTime,
        endTime: badal.endTime,
        subject: badal.subject,
        date: dateFormatted,
        reason: reasonText,
        instructions: instructionsText,
        assignedBy: actorName || "Administration Desk",
        portalUrl: appUrl,
      });

      waLink = generateWhatsAppLink(cleanPhone, waMessage);

      if (shouldSendWhatsApp) {
        const waRes = await dispatchWhatsAppNotification({
          phone: cleanPhone,
          message: waMessage,
        });
        waSent = waRes.success;
        waLink = waRes.waLink || waLink;
        waError = waRes.error;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. IN-PORTAL HIGH-PRIORITY NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────
    if (substituteUser?.id) {
      await prisma.notification.create({
        data: {
          userId: substituteUser.id,
          title: `🚨 [URGENT] Badal Substitute Duty: Class ${badal.className} (P${badal.period})`,
          body: `You are assigned to substitute for ${origTeacher} in Class ${badal.className} for Period ${badal.period} (${badal.startTime}–${badal.endTime}) - ${badal.subject}. Reason: ${reasonText}.`,
          type: "BADAL_ASSIGNED",
          link: "/teacher/timetable",
          priority: "URGENT",
        },
      });
    }

    // Notify Original Teacher that their class is covered
    let origUserId: string | null = (badal.originalTeacher as any)?.user?.id || null;
    if (!origUserId && badal.originalTeacherId) {
      const origTp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: badal.originalTeacherId }, { userId: badal.originalTeacherId }] },
        include: { user: { select: { id: true } } },
      });
      origUserId = origTp?.user?.id || null;
    }
    if (origUserId) {
      await prisma.notification.create({
        data: {
          userId: origUserId,
          title: `Class Covered (Badal): Class ${badal.className} (P${badal.period})`,
          body: `${subName} has been assigned to cover your Period ${badal.period} (${badal.startTime}–${badal.endTime}) for ${badal.subject}.`,
          type: "BADAL_COVERED",
          link: "/teacher/timetable",
          priority: "NORMAL",
        },
      });
    }

    // Invalidate caches so the portal reflects changes immediately
    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");
    cache.invalidateTag("timetablebadal");

    return {
      success: true,
      email: {
        sent: emailSent,
        recipient: recipientEmail || null,
        mailbox: emailMailbox,
        error: emailError,
      },
      whatsapp: {
        sent: waSent,
        phone: waPhoneUsed,
        waLink,
        error: waError,
      },
      substituteTeacher: {
        name: subName,
        email: recipientEmail || null,
        phone: waPhoneUsed,
      },
    };
  } catch (error) {
    console.error("[timetable-notify] Error notifying badal assignment:", error);
    return { success: false, error: (error as Error)?.message };
  }
}

/**
 * Dispatches formal notification to the substitute teacher (and original teacher)
 * when a Badal substitution has been dissolved / cancelled.
 */
export async function notifyBadalDissolution(
  badal: BadalNotificationPayload,
  actorName?: string,
  options?: {
    dissolutionReason?: string;
    sendEmail?: boolean;
    sendWhatsApp?: boolean;
  }
) {
  try {
    let substituteUser: { id: string; email: string; firstName: string; lastName: string } | null = null;
    let substituteMobile: string | null = null;
    let substituteAltEmail: string | null = null;

    if (badal.badalTeacherId) {
      const tp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: badal.badalTeacherId }, { userId: badal.badalTeacherId }] },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
      if (tp) {
        substituteMobile = tp.mobile || null;
        substituteAltEmail = tp.tEmail || null;
        if (tp.user) substituteUser = tp.user;
      }
    } else if (badal.badalTeacher?.user?.email) {
      substituteUser = badal.badalTeacher.user;
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
    const dissolutionReason = options?.dissolutionReason?.trim() || "Duty relieved / Original schedule restored";
    const recipientEmail = resolveTeacherBadalEmail(substituteUser, substituteAltEmail, subName);

    // 1. In-portal Notification to substitute teacher
    if (substituteUser?.id) {
      await prisma.notification.create({
        data: {
          userId: substituteUser.id,
          title: `ℹ️ Badal Duty Dissolved: Class ${badal.className} (P${badal.period})`,
          body: `Your proxy substitution for ${origTeacher} in Class ${badal.className} (Period ${badal.period}, ${dateFormatted}) has been dissolved. Reason: ${dissolutionReason}. You are relieved from this session.`,
          type: "BADAL_DISSOLVED",
          link: "/teacher/timetable",
          priority: "NORMAL",
        },
      });
    }

    // 2. Email Notification to substitute teacher
    if (options?.sendEmail !== false && recipientEmail) {
      const subject = `ℹ️ [UPDATE] Badal Duty Relieved: Class ${badal.className} (Period ${badal.period}) - ${dateFormatted}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background: #1e293b; padding: 20px 24px; color: #ffffff;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #fbbf24; text-transform: uppercase;">Al-Jamea-tus-Saifiyah • Darse Burhani Galiakot</div>
            <h2 style="margin: 6px 0 0; font-size: 19px; font-weight: bold;">Badal Substitution Dissolved (Cancelled)</h2>
          </div>
          <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 14px 0;"><strong>Afzalus Salam Janab ${subName},</strong></p>
            <p style="margin: 0 0 16px 0;">
              Please be informed that the proxy duty (Badal) previously assigned to you for <strong>Class ${badal.className}</strong> (Period ${badal.period}, ${badal.startTime}–${badal.endTime}) on <strong>${dateFormatted}</strong> has been <strong>dissolved</strong> by ${actorName || "Administration"}.
            </p>
            <div style="background: #f8fafc; border-left: 4px solid #64748b; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Reason:</strong> ${dissolutionReason}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;"><strong>Original Teacher:</strong> ${origTeacher} (${badal.subject})</p>
            </div>
            <p style="margin: 0; color: #047857; font-weight: bold; font-size: 13px;">
              ✓ You are not required to cover this period. Your schedule has reverted to normal.
            </p>
          </div>
        </div>
      `;

      sendBadalEmailDetailed({
        to: recipientEmail,
        subject,
        html,
      }).catch((e) => console.error("[timetable-notify] Dissolution email dispatch failed:", e));
    }

    // 3. WhatsApp Notification to substitute teacher
    const rawPhone = substituteMobile;
    const cleanPhone = formatWhatsAppPhone(rawPhone);
    if (options?.sendWhatsApp !== false && cleanPhone) {
      const waMsg = `*ℹ️ DARSE BURHANI — BADAL DUTY DISSOLVED*\n\nAfzalus Salam Janab *${subName}*,\n\nYour proxy substitution for *Class ${badal.className}* (Period ${badal.period}, ${badal.startTime}–${badal.endTime}) on *${dateFormatted}* has been *dissolved*.\n\n• *Subject:* ${badal.subject}\n• *Original Teacher:* ${origTeacher}\n• *Reason:* ${dissolutionReason}\n• *Action By:* ${actorName || "Administration Desk"}\n\n_✓ You are relieved from this session. Shukran._`;
      dispatchWhatsAppNotification({
        phone: cleanPhone,
        message: waMsg,
      }).catch((e) => console.error("[timetable-notify] Dissolution WhatsApp dispatch failed:", e));
    }

    cache.invalidateTag("timetableslot");
    cache.invalidateTag("timetable");
    cache.invalidateTag("timetablebadal");

    return { success: true };
  } catch (error) {
    console.error("[timetable-notify] Error notifying badal dissolution:", error);
    return { success: false, error: (error as Error)?.message };
  }
}

