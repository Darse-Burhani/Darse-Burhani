import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware";
import {
  findBirthdayStudents,
  getStudentWarasMubarakInfo,
  renderWarasMubarakHtml,
  resolveStudentPhoto,
  sendWarasMubarakEmail,
  getEnglishDateOfHijri,
  parseHijriDateString,
  convertGregorianToHijri,
} from "../../lib/waras-mubarak-email";
import { getSmtpConfigStatus } from "../../lib/email";
import prisma from "../../lib/prisma";

const router = Router();

// Require admin or authorized staff
router.use(requireAuth);

/**
 * GET /api/admin/waras-mubarak/today
 * Returns today's celebrants, upcoming birthdays, and mailbox status
 */
router.get("/today", async (req: Request, res: Response) => {
  try {
    const daysAhead = parseInt(String(req.query.daysAhead || "30"), 10);
    const targetDate = req.query.date ? new Date(String(req.query.date)) : new Date();
    const { today, upcoming } = await findBirthdayStudents({ targetDate, daysAhead });
    const smtpStatus = getSmtpConfigStatus();

    res.json({
      success: true,
      data: {
        today,
        upcoming,
        todayCount: today.length,
        upcomingCount: upcoming.length,
        senderMailbox: "admin.galiakot@darseburhani.org",
        smtpStatus,
      },
    });
  } catch (err: any) {
    console.error("[waras-mubarak] Error fetching today celebrants:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch birthday celebrants" });
  }
});

/**
 * GET & POST /api/admin/waras-mubarak/preview/:studentId
 * Returns rendered preview of the greeting card.
 * Accepts optional customTemplate in POST body for live interactive customization.
 * If format=html query param is provided, returns raw HTML for iframe embedding.
 */
const previewHandler = async (req: Request, res: Response) => {
  try {
    const student = await getStudentWarasMubarakInfo(req.params.studentId);
    if (!student) {
      res.status(404).json({ success: false, error: "Student not found" });
      return;
    }

    const photo = resolveStudentPhoto(student.avatarUrl, student.studentId);
    const photoCidOrDataUri = photo.dataUri || photo.webUrl;
    const customTemplate = req.body?.customTemplate || undefined;

    const html = renderWarasMubarakHtml({
      student,
      recipientType: "student",
      photoCidOrDataUri,
      customTemplate,
    });

    if (req.query.format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      return;
    }

    res.json({
      success: true,
      data: {
        student,
        html,
        hasPhoto: Boolean(photo.dataUri || photo.webUrl),
      },
    });
  } catch (err: any) {
    console.error("[waras-mubarak] Error generating preview:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to generate preview" });
  }
};

router.get("/preview/:studentId", previewHandler);
router.post("/preview/:studentId", previewHandler);

/**
 * POST /api/admin/waras-mubarak/send
 * Shoots greeting to a specific student and/or their parents from admin.galiakot@darseburhani.org
 * Accepts customTemplate for fully personalized milestone dispatches.
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const {
      studentProfileId,
      sendToStudent = true,
      sendToParents = true,
      overrideRecipientEmail,
      customTemplate,
    } = req.body;

    if (!studentProfileId) {
      res.status(400).json({ success: false, error: "studentProfileId is required" });
      return;
    }

    const adminUser = (req as any).auth?.user;

    const report = await sendWarasMubarakEmail({
      studentProfileId,
      sendToStudent: Boolean(sendToStudent),
      sendToParents: Boolean(sendToParents),
      overrideRecipientEmail: overrideRecipientEmail ? String(overrideRecipientEmail).trim() : undefined,
      adminUserId: adminUser?.id,
      customTemplate,
    });

    res.json({
      success: report.success,
      data: report,
    });
  } catch (err: any) {
    console.error("[waras-mubarak] Error dispatching email:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to send Waras Mubarak greeting" });
  }
});

/**
 * POST /api/admin/waras-mubarak/send-bulk-today
 * Shoots greetings in bulk to ALL students celebrating Waras Mubarak today
 */
router.post("/send-bulk-today", async (req: Request, res: Response) => {
  try {
    const { today } = await findBirthdayStudents({ daysAhead: 0 });

    if (today.length === 0) {
      res.json({
        success: true,
        message: "No students are celebrating Waras Mubarak today.",
        dispatchedCount: 0,
        reports: [],
      });
      return;
    }

    const adminUser = (req as any).auth?.user;
    const reports = [];

    for (const student of today) {
      try {
        const report = await sendWarasMubarakEmail({
          studentProfileId: student.studentProfileId,
          sendToStudent: true,
          sendToParents: true,
          adminUserId: adminUser?.id,
        });
        reports.push(report);
      } catch (err: any) {
        reports.push({
          success: false,
          studentProfileId: student.studentProfileId,
          studentName: student.fullName,
          its: student.studentId,
          recipientsAttempted: [],
          recipientsDelivered: [],
          recipientsFailed: [],
          error: err?.message || String(err),
          deliveredAt: new Date().toISOString(),
        });
      }
    }

    const successful = reports.filter((r) => r.success).length;

    res.json({
      success: true,
      totalCelebrants: today.length,
      successfulDispatches: successful,
      reports,
    });
  } catch (err: any) {
    console.error("[waras-mubarak] Error bulk dispatching today:", err);
    res.status(500).json({ success: false, error: err?.message || "Bulk dispatch failed" });
  }
});

/**
 * GET /api/admin/waras-mubarak/search
 * Search students and faculty members to view card or send custom greeting
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      res.json({ success: true, data: [] });
      return;
    }

    const [studentProfiles, teacherProfiles] = await Promise.all([
      prisma.studentProfile.findMany({
        where: {
          OR: [
            { studentId: { contains: query, mode: "insensitive" } },
            { user: { firstName: { contains: query, mode: "insensitive" } } },
            { user: { lastName: { contains: query, mode: "insensitive" } } },
            { grade: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        take: 20,
      }),
      prisma.teacherProfile.findMany({
        where: {
          OR: [
            { its: { contains: query, mode: "insensitive" } },
            { employeeId: { contains: query, mode: "insensitive" } },
            { department: { contains: query, mode: "insensitive" } },
            { roleTitle: { contains: query, mode: "insensitive" } },
            { user: { firstName: { contains: query, mode: "insensitive" } } },
            { user: { lastName: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        take: 15,
      }),
    ]);

    const studentResults = studentProfiles.map((p: any) => {
      const parsedHijri = parseHijriDateString(p.dobHijri);
      const convertedHijri = p.dobGregorian ? convertGregorianToHijri(p.dobGregorian) : null;
      const effectiveHijri = parsedHijri || convertedHijri;
      const englishWaras = effectiveHijri ? getEnglishDateOfHijri(effectiveHijri.day, effectiveHijri.month) : null;
      const fallbackGreg = p.dobGregorian ? new Date(p.dobGregorian).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      const birthDateStr = englishWaras?.dateStr || fallbackGreg || "";

      return {
        celebrantType: "STUDENT",
        studentProfileId: p.id,
        studentId: p.studentId,
        fullName: `${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || `Talib ${p.studentId}`,
        grade: p.grade,
        section: p.section,
        avatarUrl: p.user.avatarUrl,
        dobGregorian: p.dobGregorian,
        dobHijri: p.dobHijri,
        birthDateStr,
        studentEmail: p.user.email,
        fatherEmail: p.fatherEmail,
        motherEmail: p.motherEmail,
      };
    });

    const teacherResults = teacherProfiles.map((t: any) => {
      const parsedHijri = parseHijriDateString(t.birthDateH);
      const convertedHijri = t.birthDateAd ? convertGregorianToHijri(t.birthDateAd) : null;
      const effectiveHijri = parsedHijri || convertedHijri;
      const englishWaras = effectiveHijri ? getEnglishDateOfHijri(effectiveHijri.day, effectiveHijri.month) : null;
      const fallbackGreg = t.birthDateAd ? new Date(t.birthDateAd).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      const birthDateStr = englishWaras?.dateStr || fallbackGreg || "";

      return {
        celebrantType: "FACULTY",
        studentProfileId: t.id,
        teacherProfileId: t.id,
        studentId: t.its || t.employeeId,
        fullName: `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() || `Ustaaz ${t.its || t.employeeId}`,
        roleTitle: t.roleTitle || "Asaatizah",
        department: t.department || "Faculty",
        avatarUrl: t.photoUrl || t.user.avatarUrl,
        dobGregorian: t.birthDateAd,
        dobHijri: t.birthDateH,
        birthDateStr,
        studentEmail: t.tEmail || t.user.email,
        mobile: t.mobile,
      };
    });

    res.json({ success: true, data: [...studentResults, ...teacherResults] });
  } catch (err: any) {
    console.error("[waras-mubarak] Search error:", err);
    res.status(500).json({ success: false, error: err?.message || "Search failed" });
  }
});

export default router;
