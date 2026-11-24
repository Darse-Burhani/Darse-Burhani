import prisma from "./prisma";
import { getStartOfDayIST, getISTDetails } from "./biometric";
import { sendLeaveEmailDetailed, isDeliverableEmail } from "./email";
import { sendBaileysMessage, getBaileysStatus } from "./whatsapp-baileys";
import { formatWhatsAppPhone } from "./whatsapp";

export interface AbsentDispatchResult {
  date: string;
  studentNoticesSent: number;
  facultyNoticesSent: number;
  totalSkipped: number;
  errors: string[];
  dispatches: Array<{
    name: string;
    role: "STUDENT" | "TEACHER";
    email: string | null;
    emailSent: boolean;
    phone: string | null;
    whatsAppSent: boolean;
  }>;
}

/**
 * Generates the official Maktab Tanzeem HTML email body
 */
function getAbsentEmailHtml(name: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
      <h2 style="color: #991b1b; margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: bold; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">Attendance Notification</h2>
      <p style="font-size: 15px; margin-bottom: 12px; color: #334155;">Salaam-e-Jameel,</p>
      <p style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #0f172a;">${name}</p>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #1e293b;">
        You have been marked <strong>ABSENT</strong> for today, as you have not completed your attendance scanning.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #334155;">
        In case of any discrepancy or concern regarding your attendance status, kindly contact Maktab Tanzeem immediately for necessary clarification.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; color: #b91c1c; font-weight: 600;">
        Strict compliance with the attendance scanning procedure is expected henceforth.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 14px; font-weight: bold; margin: 0; color: #0f172a;">Maktab Tanzeem</p>
      <p style="font-size: 13px; color: #64748b; margin: 2px 0 0 0;">Darse Burhani - Galiakot</p>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 8px;">admin.galiakot@darseburhani.org</p>
    </div>
  `;
}

/**
 * Generates the official Maktab Tanzeem WhatsApp text body
 */
function getAbsentWhatsAppText(name: string): string {
  return [
    `*Attendance Notification*`,
    ``,
    `Salaam-e-Jameel,`,
    `*${name}*`,
    `You have been marked *ABSENT* for today, as you have not completed your attendance scanning.`,
    ``,
    `In case of any discrepancy or concern regarding your attendance status, kindly contact Maktab Tanzeem immediately for necessary clarification.`,
    ``,
    `Strict compliance with the attendance scanning procedure is expected henceforth.`,
    ``,
    `*Maktab Tanzeem*`,
    `*Darse Burhani - Galiakot*`,
  ].join("\n");
}

/**
 * Automatically dispatches absent notifications to all students & teachers
 * marked ABSENT today. Deduplicates to guarantee exactly ONE notification per person per day.
 */
export async function autoDispatchAbsentNotificationsToday(targetDate?: Date): Promise<AbsentDispatchResult> {
  const now = targetDate || new Date();
  const dayStart = getStartOfDayIST(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const todayStr = dayStart.toISOString().slice(0, 10);

  console.log(`[absent-dispatcher] 🚀 Initiating daily absent alert dispatch for ${todayStr}...`);

  const result: AbsentDispatchResult = {
    date: todayStr,
    studentNoticesSent: 0,
    facultyNoticesSent: 0,
    totalSkipped: 0,
    errors: [],
    dispatches: [],
  };

  const isSunday = dayStart.getUTCDay() === 0;
  if (isSunday) {
    console.log(`[absent-dispatcher] Sunday is an institutional holiday. Skipping absent alert dispatch.`);
    return result;
  }

  // 1. Gather all absent students for today
  const absentRegistries = await prisma.attendanceRegistry.findMany({
    where: {
      date: { gte: dayStart, lt: dayEnd },
      status: "ABSENT",
    },
    include: {
      student: {
        include: {
          user: true,
          parentLinks: {
            include: {
              parent: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const absentRecords = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: dayStart, lt: dayEnd },
      status: "ABSENT",
    },
    include: {
      student: {
        include: {
          user: true,
          parentLinks: {
            include: {
              parent: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Unique absent students
  const absentStudentMap = new Map<string, any>();
  for (const reg of absentRegistries) {
    if (reg.student && reg.student.user) {
      absentStudentMap.set(reg.student.id, reg.student);
    }
  }
  for (const rec of absentRecords) {
    if (rec.student && rec.student.user && !absentStudentMap.has(rec.student.id)) {
      absentStudentMap.set(rec.student.id, rec.student);
    }
  }

  console.log(`[absent-dispatcher] Identified ${absentStudentMap.size} absent student(s) for ${todayStr}.`);

  // Process students
  for (const student of absentStudentMap.values()) {
    try {
      // Deduplication check: Has this user already received an absent alert today?
      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId: student.user.id,
          type: "ATTENDANCE_ABSENT_ALERT",
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });

      if (alreadySent) {
        result.totalSkipped++;
        continue;
      }

      const studentName = `${student.user.firstName || ""} ${student.user.lastName || ""}`.trim() || `Talab ${student.studentId}`;
      const deliverableEmails: string[] = [];

      // Check student's personal email
      if (student.user.email && isDeliverableEmail(student.user.email)) {
        deliverableEmails.push(student.user.email.trim().toLowerCase());
      }
      // Check father's email
      if (student.fatherEmail && isDeliverableEmail(student.fatherEmail)) {
        const fe = student.fatherEmail.trim().toLowerCase();
        if (!deliverableEmails.includes(fe)) deliverableEmails.push(fe);
      }
      // Check mother's email
      if (student.motherEmail && isDeliverableEmail(student.motherEmail)) {
        const me = student.motherEmail.trim().toLowerCase();
        if (!deliverableEmails.includes(me)) deliverableEmails.push(me);
      }
      // Check parent linked accounts
      for (const pl of student.parentLinks || []) {
        const pe = pl.parent?.user?.email?.trim().toLowerCase();
        if (pe && isDeliverableEmail(pe) && !deliverableEmails.includes(pe)) {
          deliverableEmails.push(pe);
        }
      }

      // Check phone numbers for WhatsApp
      const rawPhone = student.mobileNumber || student.fatherPhone || student.motherPhone;
      const cleanPhone = rawPhone ? formatWhatsAppPhone(rawPhone) : null;

      let emailSent = false;
      if (deliverableEmails.length > 0) {
        try {
          const emailSubject = `Attendance Notification - ${studentName}`;
          const emailHtml = getAbsentEmailHtml(studentName);
          const emailRes = await sendLeaveEmailDetailed({
            to: deliverableEmails[0],
            cc: deliverableEmails.slice(1),
            subject: emailSubject,
            html: emailHtml,
            from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
            transactional: true,
          });
          emailSent = emailRes.success;
        } catch (emErr: any) {
          result.errors.push(`Email error for ${studentName}: ${emErr?.message || emErr}`);
        }
      }

      let whatsAppSent = false;
      if (cleanPhone) {
        try {
          const baileys = getBaileysStatus();
          if (baileys.isConnected) {
            const waText = getAbsentWhatsAppText(studentName);
            const waRes = await sendBaileysMessage(cleanPhone, waText);
            whatsAppSent = waRes.success;
          }
        } catch (waErr: any) {
          result.errors.push(`WhatsApp error for ${studentName}: ${waErr?.message || waErr}`);
        }
      }

      // Record in Notification table to prevent duplicate sends today
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          title: "Attendance Notification",
          body: `You have been marked ABSENT for today, as you have not completed your attendance scanning.`,
          type: "ATTENDANCE_ABSENT_ALERT",
          link: "/portal/student",
        },
      });

      result.studentNoticesSent++;
      result.dispatches.push({
        name: studentName,
        role: "STUDENT",
        email: deliverableEmails[0] || null,
        emailSent,
        phone: cleanPhone,
        whatsAppSent,
      });
    } catch (sErr: any) {
      result.errors.push(`Processing error for student ${student.id}: ${sErr?.message || sErr}`);
    }
  }

  // 2. Gather all absent faculty for today
  const absentTeachers = await prisma.teacherAttendanceRecord.findMany({
    where: {
      date: { gte: dayStart, lt: dayEnd },
      status: "ABSENT",
    },
    include: {
      teacher: {
        include: {
          user: true,
        },
      },
    },
  });

  console.log(`[absent-dispatcher] Identified ${absentTeachers.length} absent faculty member(s) for ${todayStr}.`);

  for (const record of absentTeachers) {
    try {
      const teacher = record.teacher;
      if (!teacher || !teacher.user) continue;

      // Deduplication check
      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId: teacher.user.id,
          type: "ATTENDANCE_ABSENT_ALERT",
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });

      if (alreadySent) {
        result.totalSkipped++;
        continue;
      }

      const teacherName = `${teacher.user.firstName || ""} ${teacher.user.lastName || ""}`.trim() || `Ustaaz ${teacher.employeeId}`;
      const teacherEmail = teacher.tEmail || teacher.user.email;
      const cleanPhone = teacher.mobile ? formatWhatsAppPhone(teacher.mobile) : null;

      let emailSent = false;
      if (teacherEmail && isDeliverableEmail(teacherEmail)) {
        try {
          const emailSubject = `Attendance Notification - ${teacherName}`;
          const emailHtml = getAbsentEmailHtml(teacherName);
          const emailRes = await sendLeaveEmailDetailed({
            to: teacherEmail,
            subject: emailSubject,
            html: emailHtml,
            from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
            transactional: true,
          });
          emailSent = emailRes.success;
        } catch (emErr: any) {
          result.errors.push(`Email error for ${teacherName}: ${emErr?.message || emErr}`);
        }
      }

      let whatsAppSent = false;
      if (cleanPhone) {
        try {
          const baileys = getBaileysStatus();
          if (baileys.isConnected) {
            const waText = getAbsentWhatsAppText(teacherName);
            const waRes = await sendBaileysMessage(cleanPhone, waText);
            whatsAppSent = waRes.success;
          }
        } catch (waErr: any) {
          result.errors.push(`WhatsApp error for ${teacherName}: ${waErr?.message || waErr}`);
        }
      }

      // Record in Notification table
      await prisma.notification.create({
        data: {
          userId: teacher.user.id,
          title: "Attendance Notification",
          body: `You have been marked ABSENT for today, as you have not completed your attendance scanning.`,
          type: "ATTENDANCE_ABSENT_ALERT",
          link: "/portal/faculty",
        },
      });

      result.facultyNoticesSent++;
      result.dispatches.push({
        name: teacherName,
        role: "TEACHER",
        email: teacherEmail || null,
        emailSent,
        phone: cleanPhone,
        whatsAppSent,
      });
    } catch (tErr: any) {
      result.errors.push(`Processing error for teacher ${record.teacherId}: ${tErr?.message || tErr}`);
    }
  }

  console.log(`[absent-dispatcher] Completed absent alert dispatch: ${result.studentNoticesSent} student notice(s), ${result.facultyNoticesSent} faculty notice(s), ${result.totalSkipped} skipped.`);
  return result;
}
