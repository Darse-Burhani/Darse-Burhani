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
  formatCelebrantHijriDisplay,
  autoShootWarasMubarakToday,
} from "../../lib/waras-mubarak-email";
import { HIJRI_MONTHS } from "../../lib/fatimi-calendar";
import { sendBaileysMessage, getBaileysStatus } from "../../lib/whatsapp-baileys";
import { formatWhatsAppPhone } from "../../lib/whatsapp";
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
      notifyAsateezah = true,
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
      notifyAsateezah: Boolean(notifyAsateezah),
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
          notifyAsateezah: true,
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

    const [studentProfiles, teacherProfiles, allClasses] = await Promise.all([
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
          classEnrollments: {
            where: { isActive: true },
            include: {
              class: {
                include: {
                  teacher: { include: { user: true } },
                  masool: { include: { user: true } },
                },
              },
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
          classes: {
            where: { isActive: true },
            select: { id: true, name: true, grade: true, section: true, subject: true },
          },
          masoolClasses: {
            where: { isActive: true },
            select: { id: true, name: true, grade: true, section: true },
          },
        },
        take: 15,
      }),
      prisma.class.findMany({
        where: { isActive: true },
        include: {
          teacher: { include: { user: true } },
          masool: { include: { user: true } },
        },
      }),
    ]);

    const studentResults = studentProfiles.map((p: any) => {
      const parsedHijri = parseHijriDateString(p.dobHijri);
      const convertedHijri = p.dobGregorian ? convertGregorianToHijri(p.dobGregorian) : null;
      const effectiveHijri = parsedHijri || convertedHijri;
      const englishWaras = effectiveHijri ? getEnglishDateOfHijri(effectiveHijri.day, effectiveHijri.month) : null;
      const fallbackGreg = p.dobGregorian ? new Date(p.dobGregorian).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      const birthDateStr = englishWaras?.dateStr || fallbackGreg || "";
      const hijriFormatted = formatCelebrantHijriDisplay({
        hijriDay: effectiveHijri?.day,
        hijriMonth: effectiveHijri?.month,
        hijriYear: effectiveHijri?.year,
        dobHijri: p.dobHijri,
        dobGregorian: p.dobGregorian,
      });

      // Link Asateezah
      const teacherMap = new Map<string, any>();
      if (p.classEnrollments) {
        for (const enr of p.classEnrollments) {
          if (enr.class?.teacher) {
            const t = enr.class.teacher;
            teacherMap.set(t.id, {
              id: t.id,
              name: `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim() || `Ustaaz ${t.its || t.employeeId}`,
              its: t.its || t.employeeId || "",
              roleTitle: t.roleTitle || "Class Teacher",
              department: t.department || "Attalimiyah",
              mobile: t.mobile || "",
              email: t.tEmail || t.user?.email || "",
            });
          }
          if (enr.class?.masool) {
            const m = enr.class.masool;
            teacherMap.set(m.id, {
              id: m.id,
              name: `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || `Ustaaz ${m.its || m.employeeId}`,
              its: m.its || m.employeeId || "",
              roleTitle: "Class Masool (مسؤول)",
              department: m.department || "Attalimiyah",
              mobile: m.mobile || "",
              email: m.tEmail || m.user?.email || "",
            });
          }
        }
      }
      for (const c of allClasses) {
        if (c.grade === p.grade && c.section === p.section) {
          if (c.teacher && !teacherMap.has(c.teacher.id)) {
            const t = c.teacher;
            teacherMap.set(t.id, {
              id: t.id,
              name: `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim() || `Ustaaz ${t.its || t.employeeId}`,
              its: t.its || t.employeeId || "",
              roleTitle: t.roleTitle || "Class Teacher",
              department: t.department || "Attalimiyah",
              mobile: t.mobile || "",
              email: t.tEmail || t.user?.email || "",
            });
          }
          if (c.masool && !teacherMap.has(c.masool.id)) {
            const m = c.masool;
            teacherMap.set(m.id, {
              id: m.id,
              name: `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || `Ustaaz ${m.its || m.employeeId}`,
              its: m.its || m.employeeId || "",
              roleTitle: "Class Masool (مسؤول)",
              department: m.department || "Attalimiyah",
              mobile: m.mobile || "",
              email: m.tEmail || m.user?.email || "",
            });
          }
        }
      }

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
        hijriDay: effectiveHijri?.day,
        hijriMonth: effectiveHijri?.month,
        hijriMonthName: effectiveHijri ? HIJRI_MONTHS[effectiveHijri.month - 1]?.short : undefined,
        hijriYear: effectiveHijri?.year,
        hijriFormatted,
        birthDateStr,
        studentEmail: p.user.email,
        fatherEmail: p.fatherEmail,
        motherEmail: p.motherEmail,
        mobile: p.mobileNumber || p.fatherPhone || p.motherPhone,
        asateezah: Array.from(teacherMap.values()),
      };
    });

    const teacherResults = teacherProfiles.map((t: any) => {
      const parsedHijri = parseHijriDateString(t.birthDateH);
      const convertedHijri = t.birthDateAd ? convertGregorianToHijri(t.birthDateAd) : null;
      const effectiveHijri = parsedHijri || convertedHijri;
      const englishWaras = effectiveHijri ? getEnglishDateOfHijri(effectiveHijri.day, effectiveHijri.month) : null;
      const fallbackGreg = t.birthDateAd ? new Date(t.birthDateAd).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      const birthDateStr = englishWaras?.dateStr || fallbackGreg || "";
      const hijriFormatted = formatCelebrantHijriDisplay({
        hijriDay: effectiveHijri?.day,
        hijriMonth: effectiveHijri?.month,
        hijriYear: effectiveHijri?.year,
        dobHijri: t.birthDateH,
        dobGregorian: t.birthDateAd,
      });

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
        hijriDay: effectiveHijri?.day,
        hijriMonth: effectiveHijri?.month,
        hijriMonthName: effectiveHijri ? HIJRI_MONTHS[effectiveHijri.month - 1]?.short : undefined,
        hijriYear: effectiveHijri?.year,
        hijriFormatted,
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

/**
 * POST /api/admin/waras-mubarak/send-whatsapp
 * Dispatches official Waras Mubarak greetings to a faculty member (or student/parent)
 * via WhatsApp. Automatically delivers via Baileys cloud if connected, and provides
 * a guaranteed direct WhatsApp click-to-send link (wa.me) as fallback without error.
 */
router.post("/send-whatsapp", async (req: Request, res: Response) => {
  try {
    const {
      studentProfileId,
      overrideRecipientPhone,
      customMessage,
    } = req.body;

    if (!studentProfileId) {
      res.status(400).json({ success: false, error: "studentProfileId is required" });
      return;
    }

    const celebrant = await getStudentWarasMubarakInfo(studentProfileId);
    if (!celebrant) {
      res.status(404).json({ success: false, error: "Celebrant profile not found" });
      return;
    }

    const isFaculty = celebrant.celebrantType === "FACULTY";
    const rawPhone = overrideRecipientPhone || celebrant.mobile;

    const cleanPhone = rawPhone ? formatWhatsAppPhone(rawPhone) : null;
    const roleLine = isFaculty
      ? (celebrant.roleTitle || celebrant.department || "Mohtaram Asaatizah · Darse Burhani")
      : `Talib Ilm · Darajah ${celebrant.grade || "Talabat"}`;

    const hijriDisplay = celebrant.hijriFormatted || (celebrant.hijriDay && celebrant.hijriMonthName ? `${celebrant.hijriDay} ${celebrant.hijriMonthName}` : "Mubarak Date");

    const message = customMessage || [
      `*DARSE BURHANI*`,
      `*Qism al-Tahfeez Galiakot*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎉 *WARAS MUBARAK!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      isFaculty
        ? `Baad al-Salaam al-Jameel Janab Mohtaram *${celebrant.fullName}*,`
        : `Baad al-Salaam al-Jameel *${celebrant.fullName}*,`,
      ``,
      `On the auspicious occasion of your Waras Mubarak (*${hijriDisplay}*), Qism al-Tahfeez Galiakot conveys heartiest congratulations, prayers, and mubarakbadi.`,
      ``,
      `📖 *Kalam Mubarak:*`,
      `*افضل ما نال العبد الامن والعافية*`,
      `_Safety and well-being are the greatest blessings one ever received._`,
      ``,
      `✨ *Doa & Mubarakbadi:*`,
      isFaculty
        ? `You are an esteemed faculty pillar of our institution. We pray that by the grace of Syedna al-Dai al-Ajal TUS you be blessed with the best of health, longevity, happiness, and divine tawfeeq in your khidmat of taaleem and tarbiyat.`
        : `We pray that by the grace of Syedna al-Dai al-Ajal TUS you be blessed with the best of health, happiness, radiant intellect, and success in all your academic stages.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Celebrant:* ${celebrant.fullName} (ITS: ${celebrant.studentId})`,
      `🏛️ *Role:* ${roleLine}`,
      `✉️ *Sender Desk:* admin.galiakot@darseburhani.org`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `_Sent with doa from Qism al-Tahfeez Galiakot, Darse Burhani_`,
    ].join("\n");

    const whatsAppUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : null;

    let baileysDelivered = false;
    let baileysError: string | undefined;

    if (cleanPhone) {
      try {
        const baileysStatus = getBaileysStatus();
        if (baileysStatus.isConnected) {
          const result = await sendBaileysMessage(cleanPhone, message);
          baileysDelivered = result.success;
          if (!result.success) baileysError = result.error;
        } else {
          baileysError = "Baileys cloud session is offline. Use direct WhatsApp link.";
        }
      } catch (err: any) {
        baileysError = err?.message || "Baileys dispatch error";
      }
    }

    res.json({
      success: true,
      delivered: baileysDelivered,
      baileysError,
      whatsAppUrl,
      phone: cleanPhone || rawPhone,
      celebrantName: celebrant.fullName,
      isFaculty,
      message,
    });
  } catch (err: any) {
    console.error("[waras-mubarak] Error dispatching WhatsApp greeting:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to dispatch WhatsApp greeting" });
  }
});

/**
 * POST /api/admin/waras-mubarak/auto-shoot
 * Triggers the automated daily Waras Mubarak email dispatch on demand
 */
router.post("/auto-shoot", async (req: Request, res: Response) => {
  try {
    const targetDate = req.body?.date ? new Date(req.body.date) : new Date();
    const result = await autoShootWarasMubarakToday(targetDate);
    res.json({
      success: true,
      data: result,
      message: `Processed ${result.totalCelebrants} celebrant(s): ${result.emailsSent} sent, ${result.emailsAlreadySent} already sent, ${result.emailsFailed} failed.`,
    });
  } catch (err: any) {
    console.error("[waras-mubarak] Error in auto-shoot:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to auto-shoot Waras Mubarak greetings" });
  }
});

export default router;
