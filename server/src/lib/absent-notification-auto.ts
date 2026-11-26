import prisma from "./prisma";
import {
  getStartOfDayIST,
  eventRangeForRole,
  getWindowType,
  isELearningWindow,
} from "./biometric";
import { sendLeaveEmailDetailed, isDeliverableEmail } from "./email";
import { formatWhatsAppPhone, sendWhatsAppGatewayMessage } from "./whatsapp";

export interface AbsentDispatchResult {
  date: string;
  studentNoticesSent: number;
  facultyNoticesSent: number;
  totalSkipped: number;
  errors: string[];
  dispatches: Array<{
    name: string;
    role: "STUDENT" | "TEACHER";
    scheduleName: string;
    scheduleTiming: string;
    email: string | null;
    emailSent: boolean;
    phone: string | null;
    whatsAppSent: boolean;
  }>;
}

function toISTMinutes(d: Date): number {
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
}

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = (hhmm || "00:00").split(":");
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Generates the official Maktab Tanzeem HTML email body
 */
function getAbsentEmailHtml(name: string, scheduleName?: string, scheduleTiming?: string): string {
  const scheduleLine = scheduleName
    ? `<p style="font-size: 13px; margin: 0 0 14px 0; color: #475569;"><strong>Schedule:</strong> ${scheduleName}${scheduleTiming ? ` (${scheduleTiming})` : ""}</p>`
    : "";
  const scheduleText = scheduleName
    ? `today's <strong>${scheduleName}</strong> attendance schedule${scheduleTiming ? ` (${scheduleTiming})` : ""}`
    : `today`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
      <h2 style="color: #991b1b; margin-top: 0; margin-bottom: 12px; font-size: 20px; font-weight: bold; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">Attendance Notification</h2>
      ${scheduleLine}
      <p style="font-size: 15px; margin-bottom: 12px; color: #334155;">Salaam-e-Jameel,</p>
      <p style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #0f172a;">${name}</p>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #1e293b;">
        You have been marked <strong>ABSENT</strong> for ${scheduleText}, as you have not completed your attendance scanning.
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
function getAbsentWhatsAppText(name: string, scheduleName?: string, scheduleTiming?: string): string {
  const scheduleHeader = scheduleName
    ? [`*Schedule:* ${scheduleName}${scheduleTiming ? ` (${scheduleTiming})` : ""}`]
    : [];
  const scheduleText = scheduleName
    ? `today's *${scheduleName}* attendance schedule${scheduleTiming ? ` (${scheduleTiming})` : ""}`
    : `today`;

  return [
    `*Attendance Notification*`,
    ...scheduleHeader,
    ``,
    `Salaam-e-Jameel,`,
    `*${name}*`,
    `You have been marked *ABSENT* for ${scheduleText}, as you have not completed your attendance scanning.`,
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
 * Automatically dispatches absent notifications per closed hardware schedule window
 * using each schedule's own eligibility roster and timing.
 * Deduplicates per user + schedule + day.
 */
export async function autoDispatchAbsentNotificationsToday(targetDate?: Date): Promise<AbsentDispatchResult> {
  const now = targetDate || new Date();
  const dayStart = getStartOfDayIST(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const todayStr = dayStart.toISOString().slice(0, 10);

  console.log(`[absent-dispatcher] 🚀 Initiating per-schedule absent alert dispatch for ${todayStr}...`);

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

  const todayStart = getStartOfDayIST(new Date());
  const isPastDay = dayStart.getTime() < todayStart.getTime();
  const isFutureDay = dayStart.getTime() > todayStart.getTime();
  if (isFutureDay) return result;
  const nowMin = toISTMinutes(now);

  const windows = await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  });
  const hwWindows = windows.filter((w) => getWindowType(w as any) !== "MANUAL");
  if (hwWindows.length === 0) return result;

  // E-Learning assigned faculty should NOT receive Tilawat al Dua absent alerts unless explicitly in Tilawat's applicableTeacherIds
  const eLearningTeacherIds = new Set<string>(
    hwWindows
      .filter((w) => isELearningWindow(w as any))
      .flatMap((w) => ((w as any).applicableTeacherIds as string[]) || [])
  );

  // Fetch all scan logs & daily attendance/exemption records once
  const [dayScanLogs, students, teachers] = await Promise.all([
    prisma.biometricScanLog.findMany({
      where: {
        scannedAt: { gte: dayStart, lt: dayEnd },
        outcome: { in: ["MATCHED", "DUPLICATE"] },
      },
      select: { studentId: true, teacherId: true, scannedAt: true },
    }),
    prisma.studentProfile.findMany({
      where: { user: { isActive: true } },
      include: {
        user: true,
        classEnrollments: { where: { isActive: true }, select: { classId: true } },
        attendanceRegistries: { where: { date: { gte: dayStart, lt: dayEnd } }, take: 1 },
        leaveRequests: { where: { status: "APPROVED", startDate: { lte: dayEnd }, endDate: { gte: dayStart } }, take: 1 },
        medicalExemptions: { where: { isActive: true, date: { gte: dayStart, lt: dayEnd } }, take: 1 },
        parentLinks: { include: { parent: { include: { user: true } } } },
      },
    }),
    prisma.teacherProfile.findMany({
      where: { user: { isActive: true } },
      include: {
        user: true,
        attendanceRecords: { where: { date: { gte: dayStart, lt: dayEnd } }, take: 1 },
        medicalExemptions: { where: { isActive: true, date: { gte: dayStart, lt: dayEnd } }, take: 1 },
      },
    }),
  ]);

  const studentScanMap = new Map<string, Date[]>();
  const teacherScanMap = new Map<string, Date[]>();
  for (const l of dayScanLogs) {
    if (l.studentId) {
      const arr = studentScanMap.get(l.studentId) || [];
      arr.push(l.scannedAt);
      studentScanMap.set(l.studentId, arr);
    }
    if (l.teacherId) {
      const arr = teacherScanMap.get(l.teacherId) || [];
      arr.push(l.scannedAt);
      teacherScanMap.set(l.teacherId, arr);
    }
  }

  for (const w of hwWindows) {
    const ww = w as any;
    const isTilawat = w.id === "default" || /tilawat/i.test(w.name);
    const isELearning = isELearningWindow(ww);

    // ── 1. Student evaluation for this window ──
    const sRange = eventRangeForRole(ww, "STUDENT");
    if (sRange && sRange.enabled && (isPastDay || nowMin > sRange.lateMin)) {
      const hasEarlierStudentWin = hwWindows.some((other) => {
        if (other.id === w.id) return false;
        const r = eventRangeForRole(other as any, "STUDENT");
        return Boolean(r && r.enabled && r.lateMin < sRange.startMin);
      });
      const winStartMin = Math.max(0, sRange.startMin - (hasEarlierStudentWin ? 20 : 60));
      const timingStr = `${formatTime12h(w.startTime)} – ${formatTime12h(w.lateEndTime || w.endTime)}`;
      const applicableClassIds: string[] = ww.applicableClassIds || [];
      const exemptStudentIds: string[] = (ww.exemptStudentIds || []).filter((id: string) => !id.startsWith("AUDIENCE_"));
      const isWholeSchool = w.id === "default" || /tilawat|dua|assembly|morning|general|check-?in/i.test(w.name);
      const hasClassFilter = !isWholeSchool && applicableClassIds.length > 0;

      // Only auto-dispatch for windows that are Tilawat, have explicit class filters, or actually had scans today
      const anyStudentScanInWin = students.some((s) => {
        const reg = s.attendanceRegistries[0];
        const times = [
          ...(studentScanMap.get(s.id) || []),
          ...(reg?.checkInTime ? [reg.checkInTime] : []),
          ...(reg?.checkOutTime ? [reg.checkOutTime] : []),
        ];
        return times.some((dt) => {
          const m = toISTMinutes(dt);
          return m >= winStartMin && m <= sRange.lateMin;
        });
      });

      if (isTilawat || hasClassFilter || anyStudentScanInWin) {
        const notifTitle = `Attendance Notification (${w.name})`;
        for (const student of students) {
          try {
            if (exemptStudentIds.includes(student.id)) continue;
            if (hasClassFilter && !student.classEnrollments.some((c) => applicableClassIds.includes(c.classId))) continue;
            if (student.medicalExemptions.length > 0 || student.leaveRequests.length > 0) continue;

            const reg = student.attendanceRegistries[0];
            if (reg && (reg.status === "ON_LEAVE" || reg.status === "MEDICAL")) continue;
            if (reg && reg.source === "MANUAL" && (reg.status === "PRESENT" || reg.status === "LATE")) continue;

            const times = [
              ...(studentScanMap.get(student.id) || []),
              ...(reg?.checkInTime ? [reg.checkInTime] : []),
              ...(reg?.checkOutTime ? [reg.checkOutTime] : []),
            ];
            const scannedInWin = times.some((dt) => {
              const m = toISTMinutes(dt);
              return m >= winStartMin && m <= sRange.lateMin;
            });
            if (scannedInWin) continue;

            const alreadySent = await prisma.notification.findFirst({
              where: {
                userId: student.user.id,
                type: "ATTENDANCE_ABSENT_ALERT",
                title: notifTitle,
                createdAt: { gte: dayStart, lt: dayEnd },
              },
            });
            if (alreadySent) {
              result.totalSkipped++;
              continue;
            }

            const studentName = `${student.user.firstName || ""} ${student.user.lastName || ""}`.trim() || `Talab ${student.studentId}`;
            const deliverableEmails: string[] = [];
            for (const em of [
              student.user.email,
              student.fatherEmail,
              student.motherEmail,
              ...(student.parentLinks || []).map((pl: any) => pl.parent?.user?.email),
            ]) {
              if (em && isDeliverableEmail(em)) {
                const clean = em.trim().toLowerCase();
                if (!deliverableEmails.includes(clean)) deliverableEmails.push(clean);
              }
            }

            const targetPhones: string[] = [];
            for (const rp of [
              student.mobileNumber,
              student.fatherPhone,
              student.motherPhone,
              ...(student.parentLinks || []).flatMap((pl: any) => [pl.parent?.phone, pl.parent?.secondaryPhone]),
            ]) {
              const formatted = rp ? formatWhatsAppPhone(rp) : null;
              if (formatted && !targetPhones.includes(formatted)) targetPhones.push(formatted);
            }
            const cleanPhone = targetPhones[0] || null;

            let emailSent = false;
            if (deliverableEmails.length > 0) {
              try {
                const emailRes = await sendLeaveEmailDetailed({
                  to: deliverableEmails[0],
                  cc: deliverableEmails.slice(1),
                  subject: `Attendance Notification (${w.name}) - ${studentName}`,
                  html: getAbsentEmailHtml(studentName, w.name, timingStr),
                  from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
                  transactional: true,
                });
                emailSent = emailRes.success;
              } catch (emErr: any) {
                result.errors.push(`Email error for ${studentName} (${w.name}): ${emErr?.message || emErr}`);
              }
            }

            let whatsAppSent = false;
            if (targetPhones.length > 0) {
              const waText = getAbsentWhatsAppText(studentName, w.name, timingStr);
              for (const phone of targetPhones) {
                try {
                  const waRes = await sendWhatsAppGatewayMessage(phone, waText);
                  if (waRes.success) whatsAppSent = true;
                  else if (waRes.error) result.errors.push(`WhatsApp error for ${studentName} (${phone}): ${waRes.error}`);
                } catch (waErr: any) {
                  result.errors.push(`WhatsApp error for ${studentName} (${phone}): ${waErr?.message || waErr}`);
                }
              }
            }

            await prisma.notification.create({
              data: {
                userId: student.user.id,
                title: notifTitle,
                body: `You have been marked ABSENT for ${w.name} (${timingStr}), as you have not completed your attendance scanning.`,
                type: "ATTENDANCE_ABSENT_ALERT",
                link: "/portal/student",
              },
            });

            result.studentNoticesSent++;
            result.dispatches.push({
              name: studentName,
              role: "STUDENT",
              scheduleName: w.name,
              scheduleTiming: timingStr,
              email: deliverableEmails[0] || null,
              emailSent,
              phone: cleanPhone,
              whatsAppSent,
            });
          } catch (sErr: any) {
            result.errors.push(`Processing error for student ${student.id} (${w.name}): ${sErr?.message || sErr}`);
          }
        }
      }
    }

    // ── 2. Faculty evaluation for this window ──
    const fRange = eventRangeForRole(ww, "TEACHER");
    if (fRange && fRange.enabled && (isPastDay || nowMin > fRange.lateMin)) {
      const hasEarlierFacultyWin = hwWindows.some((other) => {
        if (other.id === w.id) return false;
        const r = eventRangeForRole(other as any, "TEACHER");
        return Boolean(r && r.enabled && r.lateMin < fRange.startMin);
      });
      const winStartMin = Math.max(0, fRange.startMin - (hasEarlierFacultyWin ? 20 : 60));
      const fStart = ww.facultyStartTime || w.startTime;
      const fEnd = ww.facultyLateEndTime || ww.facultyEndTime || w.lateEndTime || w.endTime;
      const timingStr = `${formatTime12h(fStart)} – ${formatTime12h(fEnd)}`;

      const applicableFacultyIds: string[] = ww.applicableTeacherIds || [];
      const exemptFacultyIds: string[] = ww.exemptTeacherIds || [];
      const hasFacultyFilter = applicableFacultyIds.length > 0;

      const anyFacultyScanInWin = teachers.some((t) => {
        const rec = t.attendanceRecords[0];
        const times = [
          ...(teacherScanMap.get(t.id) || []),
          ...(rec?.checkInTime ? [rec.checkInTime] : []),
          ...(rec?.checkOutTime ? [rec.checkOutTime] : []),
        ];
        return times.some((dt) => {
          const m = toISTMinutes(dt);
          return m >= winStartMin && m <= fRange.lateMin;
        });
      });

      if (isTilawat || isELearning || hasFacultyFilter || anyFacultyScanInWin) {
        const notifTitle = `Attendance Notification (${w.name})`;
        for (const teacher of teachers) {
          try {
            if (hasFacultyFilter && !applicableFacultyIds.includes(teacher.id)) continue;
            if (exemptFacultyIds.includes(teacher.id)) continue;
            if (isTilawat && eLearningTeacherIds.has(teacher.id) && !applicableFacultyIds.includes(teacher.id)) continue;
            if (teacher.medicalExemptions.length > 0) continue;

            const rec = teacher.attendanceRecords[0];
            if (rec && (rec.status === "ON_LEAVE" || rec.status === "MEDICAL")) continue;
            if (rec && rec.verificationMethod === "MANUAL" && (rec.status === "PRESENT" || rec.status === "LATE")) continue;

            const times = [
              ...(teacherScanMap.get(teacher.id) || []),
              ...(rec?.checkInTime ? [rec.checkInTime] : []),
              ...(rec?.checkOutTime ? [rec.checkOutTime] : []),
            ];
            const scannedInWin = times.some((dt) => {
              const m = toISTMinutes(dt);
              return m >= winStartMin && m <= fRange.lateMin;
            });
            if (scannedInWin) continue;

            const alreadySent = await prisma.notification.findFirst({
              where: {
                userId: teacher.user.id,
                type: "ATTENDANCE_ABSENT_ALERT",
                title: notifTitle,
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
                const emailRes = await sendLeaveEmailDetailed({
                  to: teacherEmail,
                  subject: `Attendance Notification (${w.name}) - ${teacherName}`,
                  html: getAbsentEmailHtml(teacherName, w.name, timingStr),
                  from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
                  transactional: true,
                });
                emailSent = emailRes.success;
              } catch (emErr: any) {
                result.errors.push(`Email error for ${teacherName} (${w.name}): ${emErr?.message || emErr}`);
              }
            }

            let whatsAppSent = false;
            if (cleanPhone) {
              try {
                const waText = getAbsentWhatsAppText(teacherName, w.name, timingStr);
                const waRes = await sendWhatsAppGatewayMessage(cleanPhone, waText);
                whatsAppSent = waRes.success;
                if (!waRes.success && waRes.error) {
                  result.errors.push(`WhatsApp error for ${teacherName} (${w.name}): ${waRes.error}`);
                }
              } catch (waErr: any) {
                result.errors.push(`WhatsApp error for ${teacherName} (${w.name}): ${waErr?.message || waErr}`);
              }
            }

            await prisma.notification.create({
              data: {
                userId: teacher.user.id,
                title: notifTitle,
                body: `You have been marked ABSENT for ${w.name} (${timingStr}), as you have not completed your attendance scanning.`,
                type: "ATTENDANCE_ABSENT_ALERT",
                link: "/portal/faculty",
              },
            });

            result.facultyNoticesSent++;
            result.dispatches.push({
              name: teacherName,
              role: "TEACHER",
              scheduleName: w.name,
              scheduleTiming: timingStr,
              email: teacherEmail || null,
              emailSent,
              phone: cleanPhone,
              whatsAppSent,
            });
          } catch (tErr: any) {
            result.errors.push(`Processing error for teacher ${teacher.id} (${w.name}): ${tErr?.message || tErr}`);
          }
        }
      }
    }
  }

  console.log(`[absent-dispatcher] Completed per-schedule dispatch: ${result.studentNoticesSent} student notice(s), ${result.facultyNoticesSent} faculty notice(s), ${result.totalSkipped} skipped.`);
  return result;
}

export interface ParentProfileReminderResult {
  totalParents: number;
  alreadyDoneCount: number;
  remindersSent: number;
  emailsSent: number;
  whatsAppSent: number;
  skippedNoContact: number;
  errors: string[];
}

/**
 * Sends Email + WhatsApp reminders to parents who have NOT yet updated their
 * family/student profile. Parents who have already completed their profile
 * (phone + address + occupation on ParentProfile, OR SUBMITTED/REVIEWED/APPROVED TalabatProfile1447)
 * are strictly skipped.
 */
export async function dispatchParentProfileUpdateReminders(): Promise<ParentProfileReminderResult> {
  const parents = await prisma.parentProfile.findMany({
    where: { user: { isActive: true } },
    include: {
      user: true,
      studentLinks: {
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              talabatProfile1447: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  const dayStart = getStartOfDayIST(new Date());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const res: ParentProfileReminderResult = {
    totalParents: parents.length,
    alreadyDoneCount: 0,
    remindersSent: 0,
    emailsSent: 0,
    whatsAppSent: 0,
    skippedNoContact: 0,
    errors: [],
  };

  for (const parent of parents) {
    const hasParentDetails = Boolean(parent.phone && parent.address && parent.occupation);
    const hasCompletedTalabatProfile = parent.studentLinks.some((l) =>
      ["SUBMITTED", "REVIEWED", "APPROVED"].includes(l.student?.talabatProfile1447?.status || "")
    );

    if (hasParentDetails || hasCompletedTalabatProfile) {
      res.alreadyDoneCount++;
      continue;
    }

    const alreadyRemindedToday = await prisma.notification.findFirst({
      where: {
        userId: parent.user.id,
        type: "PARENT_PROFILE_REMINDER",
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (alreadyRemindedToday) continue;

    const parentName = `${parent.user.firstName || ""} ${parent.user.lastName || ""}`.trim() || "Respected Parent";
    const childNames = parent.studentLinks
      .map((l) => `${l.student?.user?.firstName || ""} ${l.student?.user?.lastName || ""}`.trim())
      .filter(Boolean);
    const childLine = childNames.length > 0 ? ` (${childNames.join(", ")})` : "";

    const emails: string[] = [];
    for (const em of [
      parent.user.email,
      ...parent.studentLinks.flatMap((l) => [l.student?.fatherEmail, l.student?.motherEmail]),
    ]) {
      if (em && isDeliverableEmail(em)) {
        const clean = em.trim().toLowerCase();
        if (!emails.includes(clean)) emails.push(clean);
      }
    }

    const phones: string[] = [];
    for (const rp of [
      parent.phone,
      parent.secondaryPhone,
      ...parent.studentLinks.flatMap((l) => [l.student?.fatherPhone, l.student?.motherPhone, l.student?.mobileNumber]),
    ]) {
      const formatted = rp ? formatWhatsAppPhone(rp) : null;
      if (formatted && !phones.includes(formatted)) phones.push(formatted);
    }

    if (emails.length === 0 && phones.length === 0) {
      res.skippedNoContact++;
      continue;
    }

    let emailOk = false;
    if (emails.length > 0) {
      try {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
            <h2 style="color: #0f766e; margin-top: 0; margin-bottom: 14px; font-size: 20px; border-bottom: 2px solid #ccfbf1; padding-bottom: 8px;">Profile Update Reminder</h2>
            <p style="font-size: 15px; margin-bottom: 12px;">Salaam-e-Jameel,</p>
            <p style="font-size: 16px; font-weight: bold; margin-bottom: 14px; color: #0f172a;">${parentName}${childLine}</p>
            <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
              Kindly log in to the <strong>Darse Burhani Parent Portal</strong> and complete/update your family and Talabat profile details at your earliest convenience.
            </p>
            <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px; color: #475569;">
              If you have already updated your profile, please ignore this reminder.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 14px; font-weight: bold; margin: 0; color: #0f172a;">Maktab Tanzeem</p>
            <p style="font-size: 13px; color: #64748b; margin: 2px 0 0 0;">Darse Burhani - Galiakot</p>
          </div>
        `;
        const emRes = await sendLeaveEmailDetailed({
          to: emails[0],
          cc: emails.slice(1),
          subject: `Reminder: Please Update Your Parent Profile - Darse Burhani`,
          html,
          from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
          transactional: true,
        });
        emailOk = emRes.success;
        if (emailOk) res.emailsSent++;
      } catch (err: any) {
        res.errors.push(`Email error for ${parentName}: ${err?.message || err}`);
      }
    }

    let waOk = false;
    if (phones.length > 0) {
      const waText = [
        `*Profile Update Reminder*`,
        ``,
        `Salaam-e-Jameel,`,
        `*${parentName}*${childLine}`,
        ``,
        `Kindly log in to the *Darse Burhani Parent Portal* and complete/update your family and Talabat profile details at your earliest convenience.`,
        ``,
        `*Maktab Tanzeem*`,
        `*Darse Burhani - Galiakot*`,
      ].join("\n");
      for (const phone of phones) {
        try {
          const waRes = await sendWhatsAppGatewayMessage(phone, waText);
          if (waRes.success) {
            waOk = true;
          } else if (waRes.error) {
            res.errors.push(`WhatsApp error for ${parentName} (${phone}): ${waRes.error}`);
          }
        } catch (err: any) {
          res.errors.push(`WhatsApp error for ${parentName} (${phone}): ${err?.message || err}`);
        }
      }
      if (waOk) res.whatsAppSent++;
    }

    await prisma.notification.create({
      data: {
        userId: parent.user.id,
        title: "Profile Update Reminder",
        body: "Please complete/update your family and Talabat profile details in the Parent Portal.",
        type: "PARENT_PROFILE_REMINDER",
        link: "/portal/parent/profile",
      },
    });

    if (emailOk || waOk) res.remindersSent++;
  }

  return res;
}
