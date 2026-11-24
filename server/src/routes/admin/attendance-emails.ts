import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";
import { sendLeaveEmailDetailed, isDeliverableEmail } from "../../lib/email";
import { sendBaileysMessage, getBaileysStatus } from "../../lib/whatsapp-baileys";
import { formatWhatsAppPhone } from "../../lib/whatsapp";

const router = Router();

// Helper to compute date boundaries for weekly and monthly reports
function resolveDateRange(query: {
  periodType?: string;
  startDate?: string;
  endDate?: string;
  month?: string | number;
  year?: string | number;
}): { periodType: "WEEKLY" | "MONTHLY"; start: Date; end: Date; label: string } {
  const periodType: "WEEKLY" | "MONTHLY" = query.periodType === "MONTHLY" ? "MONTHLY" : "WEEKLY";
  const now = new Date();

  let start: Date;
  let end: Date;
  let label: string;

  if (periodType === "MONTHLY") {
    const y = Number(query.year) || now.getFullYear();
    const m = query.month !== undefined ? Number(query.month) - 1 : now.getMonth();
    start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
    const monthName = start.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    label = `${monthName} ${y}`;
  } else {
    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      start.setUTCHours(0, 0, 0, 0);
      end = new Date(query.endDate);
      end.setUTCHours(23, 59, 59, 999);
      label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
    } else {
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
      start.setUTCHours(0, 0, 0, 0);
      label = `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
    }
  }

  return { periodType, start, end, label };
}

// ── GET: Summary of all students ──
router.get("/summary", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { periodType, start, end, label } = resolveDateRange(req.query);
    const grade = req.query.grade as string | undefined;
    const section = req.query.section as string | undefined;

    const whereClause: Record<string, any> = {
      user: { isActive: true },
    };
    if (grade) whereClause.grade = grade;
    if (section) whereClause.section = section;

    const students = await prisma.studentProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        parentLinks: {
          include: { parent: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } },
        },
        attendanceRecords: {
          where: { date: { gte: start, lt: end } },
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
    });

    const summaryList = students.map((s) => {
      let present = 0;
      let late = 0;
      let absent = 0;
      let early = 0;

      for (const r of s.attendanceRecords) {
        if (r.status === "PRESENT") present++;
        else if (r.status === "LATE") late++;
        else if (r.status === "ABSENT") absent++;
        else if (r.status === "EARLY_DEPARTURE") early++;
      }

      const total = s.attendanceRecords.length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

      const parentEmails: string[] = [];
      for (const link of s.parentLinks) {
        const pEmail = link.parent?.user?.email?.trim().toLowerCase();
        if (pEmail && !parentEmails.includes(pEmail)) {
          parentEmails.push(pEmail);
        }
      }
      if (s.fatherEmail?.trim()) {
        const fe = s.fatherEmail.trim().toLowerCase();
        if (!parentEmails.includes(fe)) parentEmails.push(fe);
      }
      if (s.motherEmail?.trim()) {
        const me = s.motherEmail.trim().toLowerCase();
        if (!parentEmails.includes(me)) parentEmails.push(me);
      }

      const hasParentEmail = parentEmails.length > 0;

      return {
        id: s.id,
        userId: s.userId,
        studentId: s.studentId,
        its: s.its || s.studentId,
        name: `${s.user.firstName} ${s.user.lastName}`,
        nameAr: s.nameAr,
        grade: s.grade,
        section: s.section,
        totalRecords: total,
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        earlyDepartureCount: early,
        attendanceRate: rate,
        parentEmails,
        hasParentEmail,
        studentEmail: s.user.email,
      };
    });

    const withParentCount = summaryList.filter((s) => s.hasParentEmail).length;

    return res.json({
      success: true,
      data: {
        periodType,
        periodLabel: label,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        stats: {
          totalStudents: summaryList.length,
          withParentEmail: withParentCount,
          withoutParentEmail: summaryList.length - withParentCount,
          averageAttendanceRate: summaryList.length > 0 ? Math.round(summaryList.reduce((acc, s) => acc + s.attendanceRate, 0) / summaryList.length) : 0,
        },
        students: summaryList,
      },
    });
  } catch (error) {
    console.error("Attendance summary error:", error);
    return res.status(500).json({ success: false, error: "Failed to generate attendance summary" });
  }
});

// ── GET: Summary of all teachers / faculty ──
router.get("/teachers-summary", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { start, end, label } = resolveDateRange(req.query);

    const teachers = await prisma.teacherProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        classes: { select: { id: true, name: true, subject: true } },
        attendanceRecords: {
          where: { date: { gte: start, lt: end } },
        },
      },
      orderBy: { employeeId: "asc" },
    });

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const teacherSummaries = await Promise.all(
      teachers.map(async (t) => {
        let present = 0;
        let late = 0;
        let absent = 0;

        for (const r of t.attendanceRecords) {
          if (r.status === "PRESENT") present++;
          else if (r.status === "LATE") late++;
          else if (r.status === "ABSENT") absent++;
        }

        const totalRecords = t.attendanceRecords.length;
        const rate = totalRecords > 0 ? Math.round(((present + late) / totalRecords) * 100) : 100;

        // Determine today's status
        const todayRec = await prisma.teacherAttendanceRecord.findFirst({
          where: {
            teacherId: t.id,
            date: { gte: todayStart, lt: todayEnd },
          },
        });

        const status: "PRESENT" | "ABSENT" =
          todayRec && (todayRec.status === "PRESENT" || todayRec.status === "LATE") ? "PRESENT" : "ABSENT";

        return {
          id: t.id,
          userId: t.userId,
          employeeId: t.employeeId || t.its || "",
          name: `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() || `Ustaaz ${t.employeeId}`,
          email: t.tEmail || t.user.email,
          mobile: t.mobile,
          department: t.department || "Faculty",
          subjects: t.subjects || [],
          totalClasses: t.classes.length,
          status,
          attendanceRate: rate,
          absentDays: absent,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        periodLabel: label,
        teachers: teacherSummaries,
      },
    });
  } catch (error) {
    console.error("Teacher attendance summary error:", error);
    return res.status(500).json({ success: false, error: "Failed to generate teacher attendance summary" });
  }
});

// ── GET: Preview email HTML ──
router.get("/preview", requireAuth, async (_req, res) => {
  return res.json({
    success: true,
    data: {
      html: "<p>Attendance email reports and alerts have been disabled.</p>",
      plainText: "Attendance email reports and alerts have been disabled.",
    },
  });
});

// ── POST: Send attendance email reports to parents (DISABLED) ──
router.post("/send", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email reports have been disabled.",
    data: { sentCount: 0, failedCount: 0, skippedCount: 0, total: 0, results: [] },
  });
});

// ── POST: Send bulk (DISABLED) ──
router.post("/dispatch-bulk", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email reports have been disabled.",
    data: { sentCount: 0, failedCount: 0, skippedCount: 0, total: 0, results: [] },
  });
});

// ── POST: Send a single test email report (DISABLED) ──
router.post("/send-test", requireRole("ADMIN"), async (_req, res) => {
  return res.json({
    success: true,
    message: "Attendance email reports have been disabled.",
  });
});

// ── POST: Send direct absent email and WhatsApp to a student & parents ──
router.post("/send-absent-student", requireRole("ADMIN"), async (req, res) => {
  try {
    const { studentId, reason, channel = "BOTH" } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, error: "studentId is required" });
    }

    const student = await prisma.studentProfile.findFirst({
      where: { OR: [{ id: studentId }, { studentId }, { its: studentId }] },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const studentName = `${student.user.firstName || ""} ${student.user.lastName || ""}`.trim() || `Talabat ${student.studentId}`;
    
    // Collect recipient emails
    const targetEmails: string[] = [];
    if (student.user?.email && isDeliverableEmail(student.user.email)) {
      const uEmail = student.user.email.trim().toLowerCase();
      if (!targetEmails.includes(uEmail)) targetEmails.push(uEmail);
    }
    if (student.fatherEmail && isDeliverableEmail(student.fatherEmail)) {
      const fEmail = student.fatherEmail.trim().toLowerCase();
      if (!targetEmails.includes(fEmail)) targetEmails.push(fEmail);
    }
    if (student.motherEmail && isDeliverableEmail(student.motherEmail)) {
      const mEmail = student.motherEmail.trim().toLowerCase();
      if (!targetEmails.includes(mEmail)) targetEmails.push(mEmail);
    }
    for (const link of student.parentLinks || []) {
      const pEmail = link.parent?.user?.email?.trim().toLowerCase();
      if (pEmail && isDeliverableEmail(pEmail) && !targetEmails.includes(pEmail)) {
        targetEmails.push(pEmail);
      }
    }

    // Collect recipient phone
    const targetPhone = student.mobileNumber || student.fatherPhone || student.motherPhone || null;

    let emailSent = false;
    let emailError: string | undefined;
    let whatsAppSent = false;
    let whatsAppError: string | undefined;
    let whatsAppUrl: string | null = null;

    // 1. Email notification from admin.galiakot@darseburhani.org
    if (channel === "EMAIL" || channel === "BOTH") {
      if (targetEmails.length > 0) {
        try {
          const emailSubject = `Attendance Notification - ${studentName}`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
              <h2 style="color: #991b1b; margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: bold; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">Attendance Notification</h2>
              <p style="font-size: 15px; margin-bottom: 12px; color: #334155;">Salaam-e-Jameel,</p>
              <p style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #0f172a;">${studentName}</p>
              <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #1e293b;">
                You have been marked <strong>ABSENT</strong> for today, as you have not completed your attendance scanning.
              </p>
              ${reason ? `<div style="padding: 10px 14px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; font-size: 13px; color: #991b1b; margin: 14px 0;"><strong>Administrative Note:</strong> ${reason}</div>` : ""}
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

          const emailRes = await sendLeaveEmailDetailed({
            to: targetEmails[0],
            cc: targetEmails.slice(1),
            subject: emailSubject,
            html: emailHtml,
            from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
            transactional: true,
          });

          emailSent = emailRes.success;
          if (!emailRes.success) emailError = emailRes.error;
        } catch (err: any) {
          emailError = err?.message || "Email delivery failed";
        }
      } else {
        emailError = "No valid deliverable email found for student or parents.";
      }
    }

    // 2. WhatsApp notification
    if (channel === "WHATSAPP" || channel === "BOTH") {
      const cleanPhone = targetPhone ? formatWhatsAppPhone(targetPhone) : null;
      const whatsAppMessage = [
        `*Attendance Notification*`,
        ``,
        `Salaam-e-Jameel,`,
        `*${studentName}*`,
        `You have been marked *ABSENT* for today, as you have not completed your attendance scanning.`,
        ...(reason ? [``, `📋 *Note:* ${reason}`] : []),
        ``,
        `In case of any discrepancy or concern regarding your attendance status, kindly contact Maktab Tanzeem immediately for necessary clarification.`,
        ``,
        `Strict compliance with the attendance scanning procedure is expected henceforth.`,
        ``,
        `*Maktab Tanzeem*`,
        `*Darse Burhani - Galiakot*`,
      ].join("\n");

      if (cleanPhone) {
        whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`;
        try {
          const baileys = getBaileysStatus();
          if (baileys.isConnected) {
            const bRes = await sendBaileysMessage(cleanPhone, whatsAppMessage);
            whatsAppSent = bRes.success;
            if (!bRes.success) whatsAppError = bRes.error;
          } else {
            whatsAppError = "WhatsApp cloud gateway is offline. Click direct WhatsApp link to send.";
          }
        } catch (err: any) {
          whatsAppError = err?.message || "WhatsApp dispatch failed";
        }
      } else {
        whatsAppError = "No mobile number on file for student or parents.";
      }
    }

    return res.json({
      success: emailSent || whatsAppSent || Boolean(whatsAppUrl),
      message: emailSent
        ? `Attendance notice sent to ${studentName} via Email${whatsAppSent ? " and WhatsApp" : ""}`
        : whatsAppSent
        ? `Attendance notice sent to ${studentName} via WhatsApp`
        : "Direct dispatch initiated",
      data: {
        studentId: student.id,
        name: studentName,
        emailSent,
        emailError,
        whatsAppSent,
        whatsAppError,
        whatsAppUrl,
        sentCount: (emailSent ? 1 : 0) + (whatsAppSent ? 1 : 0),
      },
    });
  } catch (error: any) {
    console.error("send-absent-student error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to send absent alert" });
  }
});

// ── POST: Send direct absent notice to an absent teacher via Email and WhatsApp ──
router.post("/send-absent-teacher", requireRole("ADMIN"), async (req, res) => {
  try {
    const { teacherId, reason, channel = "BOTH" } = req.body;
    if (!teacherId) {
      return res.status(400).json({ success: false, error: "teacherId is required" });
    }

    const teacher = await prisma.teacherProfile.findFirst({
      where: { OR: [{ id: teacherId }, { employeeId: teacherId }, { its: teacherId }] },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    const teacherName = `${teacher.user.firstName || ""} ${teacher.user.lastName || ""}`.trim() || `Ustaaz ${teacher.employeeId}`;
    const teacherEmail = teacher.tEmail || teacher.user.email;
    const teacherPhone = teacher.mobile;

    const todayDateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });

    let emailSent = false;
    let emailError: string | undefined;
    let whatsAppSent = false;
    let whatsAppError: string | undefined;
    let whatsAppUrl: string | null = null;

    // 1. Email notification from admin.galiakot@darseburhani.org
    if (channel === "EMAIL" || channel === "BOTH") {
      if (teacherEmail && isDeliverableEmail(teacherEmail)) {
        try {
          const emailSubject = `Attendance Notification - ${teacherName}`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
              <h2 style="color: #991b1b; margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: bold; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">Attendance Notification</h2>
              <p style="font-size: 15px; margin-bottom: 12px; color: #334155;">Salaam-e-Jameel,</p>
              <p style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #0f172a;">${teacherName}</p>
              <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #1e293b;">
                You have been marked <strong>ABSENT</strong> for today, as you have not completed your attendance scanning.
              </p>
              ${reason ? `<div style="padding: 10px 14px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; font-size: 13px; color: #991b1b; margin: 14px 0;"><strong>Administrative Note:</strong> ${reason}</div>` : ""}
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

          const emailRes = await sendLeaveEmailDetailed({
            to: teacherEmail,
            subject: emailSubject,
            html: emailHtml,
            from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
            transactional: true,
          });

          emailSent = emailRes.success;
          if (!emailRes.success) emailError = emailRes.error;
        } catch (err: any) {
          emailError = err?.message || "Email delivery failed";
        }
      } else {
        emailError = "No valid deliverable email found for faculty member.";
      }
    }

    // 2. WhatsApp notification
    if (channel === "WHATSAPP" || channel === "BOTH") {
      const cleanPhone = teacherPhone ? formatWhatsAppPhone(teacherPhone) : null;
      const whatsAppMessage = [
        `*Attendance Notification*`,
        ``,
        `Salaam-e-Jameel,`,
        `*${teacherName}*`,
        `You have been marked *ABSENT* for today, as you have not completed your attendance scanning.`,
        ...(reason ? [``, `📋 *Note:* ${reason}`] : []),
        ``,
        `In case of any discrepancy or concern regarding your attendance status, kindly contact Maktab Tanzeem immediately for necessary clarification.`,
        ``,
        `Strict compliance with the attendance scanning procedure is expected henceforth.`,
        ``,
        `*Maktab Tanzeem*`,
        `*Darse Burhani - Galiakot*`,
      ].join("\n");

      if (cleanPhone) {
        whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`;
        try {
          const baileys = getBaileysStatus();
          if (baileys.isConnected) {
            const bRes = await sendBaileysMessage(cleanPhone, whatsAppMessage);
            whatsAppSent = bRes.success;
            if (!bRes.success) whatsAppError = bRes.error;
          } else {
            whatsAppError = "WhatsApp cloud gateway is offline. Click direct WhatsApp link to send.";
          }
        } catch (err: any) {
          whatsAppError = err?.message || "WhatsApp dispatch failed";
        }
      } else {
        whatsAppError = "No mobile number on file for faculty member.";
      }
    }

    return res.json({
      success: emailSent || whatsAppSent || Boolean(whatsAppUrl),
      message: `Notice processed for ${teacherName}`,
      data: {
        teacherName,
        teacherEmail,
        teacherPhone,
        emailSent,
        emailError,
        whatsAppSent,
        whatsAppError,
        whatsAppUrl,
      },
    });
  } catch (error: any) {
    console.error("Send absent teacher error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to send absent alert" });
  }
});

// ── POST: Trigger automated absent notification dispatch immediately ──
router.post("/auto-dispatch-absents", requireRole("ADMIN"), async (req, res) => {
  try {
    const { autoDispatchAbsentNotificationsToday } = await import("../../lib/absent-notification-auto");
    const result = await autoDispatchAbsentNotificationsToday();
    return res.json({
      success: true,
      message: `Dispatched ${result.studentNoticesSent} student and ${result.facultyNoticesSent} faculty absent notification(s).`,
      data: result,
    });
  } catch (error: any) {
    console.error("auto-dispatch-absents error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to trigger absent dispatch" });
  }
});

export default router;
