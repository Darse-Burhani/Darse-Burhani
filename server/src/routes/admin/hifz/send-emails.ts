import { Router } from "express";
import prisma from "../../../lib/prisma";
import { sendEmail } from "../../../lib/email";
import { requireAuth, requireRole } from "../../../middleware";

const router = Router();

// Email template for hifz report card - formal Fatimid design for parents
function generateEmailHtml(studentName: string, reportData: any) {
  const { its, currentJuz, currentSafah, totalJadeedPages, performancePercent, darajah, sanah } = reportData;

  // SVG progress ring values
  const ringRadius = 58;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (ringCircumference * performancePercent) / 100;

  // Performance color palette (Fatimid emerald-gold theme)
  let perfColor = "#065f46";
  let perfAccent = "#047857";
  if (performancePercent >= 80) {
    perfColor = "#065f46";
    perfAccent = "#047857";
  } else if (performancePercent >= 50) {
    perfColor = "#0d7377";
    perfAccent = "#0f766e";
  } else if (performancePercent >= 25) {
    perfColor = "#92400e";
    perfAccent = "#b45309";
  } else {
    perfColor = "#991b1b";
    perfAccent = "#dc2626";
  }



  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const ornamentDivider = `<svg width="200" height="12" viewBox="0 0 200 12" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="6" x2="70" y2="6" stroke="#e2e8f0" stroke-width="1"/><polygon points="80,1 85,6 80,11 75,6" fill="#06b6d4"/><polygon points="90,2 93,6 90,10 87,6" fill="#0891b2"/><circle cx="100" cy="6" r="3" fill="#06b6d4"/><polygon points="110,2 113,6 110,10 107,6" fill="#0891b2"/><polygon points="120,1 125,6 120,11 115,6" fill="#06b6d4"/><line x1="130" y1="6" x2="200" y2="6" stroke="#e2e8f0" stroke-width="1"/></svg>`;

  const enFont = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const arFont = "'Amiri','Al-Kanz',Arial,sans-serif";

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Hifz Report - ${studentName}</title>
  <!--[if mso]>
  <style>table,td,div,p,a{font-family:Arial,sans-serif !important}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:${enFont};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">

  <div style="font-size:1px;color:#f0f2f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    Hifz Report for ${studentName} &#8212; ${performancePercent}% Performance
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f0f2f5">
    <tr>
      <td align="center" style="padding:40px 16px">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background-color:#ffffff;border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:24px 32px;text-align:center">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:4px;text-transform:uppercase;font-family:${enFont}">Hifz Report</h1>
              <div style="margin:10px auto;width:40px;height:2px;background:linear-gradient(90deg,#06b6d4,#0891b2);border-radius:2px"></div>
              <p style="margin:0;font-size:9px;color:#94a3b8;letter-spacing:3px;text-transform:uppercase;font-weight:600">Darse Burhani</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:24px 32px 0">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                      <tr>
                        <td style="padding:24px 20px;text-align:center;background:#f8fafc">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:14px">
                            <tr>
                              <td width="80" height="80" style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:50%;text-align:center;vertical-align:middle;border:2.5px solid #06b6d4;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
                                <span style="font-size:32px;font-weight:700;color:#06b6d4;line-height:75px;display:block;font-family:${arFont}">${studentName.charAt(0)}</span>
                              </td>
                            </tr>
                          </table>
                          <h2 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#0f172a;font-family:${arFont};letter-spacing:0.5px" dir="rtl">${studentName}</h2>
                          <div style="width:40px;height:2px;background:linear-gradient(90deg,transparent,#06b6d4,transparent);margin:0 auto 10px;border-radius:2px"></div>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                            <tr>
                              <td style="padding:0 3px">
                                <span style="display:inline-block;padding:4px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:9px;color:#0369a1;font-weight:600;font-family:${arFont}" dir="rtl">&#1575;&#1604;&#1589;&#1601;: ${darajah}</span>
                              </td>
                              ${sanah ? `<td style="padding:0 3px">
                                <span style="display:inline-block;padding:4px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:9px;color:#0369a1;font-weight:600;font-family:${arFont}" dir="rtl">&#1575;&#1604;&#1602;&#1587;&#1605;: ${sanah}</span>
                              </td>` : ""}
                              ${its ? `<td style="padding:0 3px">
                                <span style="display:inline-block;padding:4px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:9px;color:#0369a1;font-weight:600;font-family:${enFont}">ITS: ${its}</span>
                              </td>` : ""}
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 32px 0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                <tr>
                  <td style="padding:20px 16px;text-align:center;background:#f8fafc">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                            <tr>
                              <td style="position:relative" align="center">
                                <svg width="160" height="160" viewBox="0 0 160 160" style="display:block;margin:0 auto;position:absolute;top:-5px;left:-5px">
                                  <circle cx="80" cy="80" r="77" fill="none" stroke="#06b6d4" stroke-width="0.5" opacity="0.3"/>
                                </svg>
                                <svg width="150" height="150" viewBox="0 0 150 150" style="display:block;margin:0 auto;position:relative">
                                  <defs>
                                    <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
                                      <stop offset="0%" stop-color="#06b6d4"/>
                                      <stop offset="50%" stop-color="#047857"/>
                                      <stop offset="100%" stop-color="#06b6d4"/>
                                    </linearGradient>
                                  </defs>
                                  <circle cx="75" cy="75" r="${ringRadius}" fill="none" stroke="#e8e4d9" stroke-width="8"/>
                                  <circle cx="75" cy="75" r="${ringRadius}" fill="none" stroke="#06b6d4" stroke-width="1" stroke-dasharray="2 28" opacity="0.2"/>
                                  <circle cx="75" cy="75" r="${ringRadius}" fill="none" stroke="url(#rg)" stroke-width="8" stroke-linecap="square" stroke-dasharray="${ringCircumference}" stroke-dashoffset="${ringOffset}" transform="rotate(-90 75 75)"/>
                                </svg>
                                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:150px">
                                  <div style="font-size:42px;font-weight:900;color:#06b6d4;line-height:1;font-family:${enFont}">${performancePercent}<span style="font-size:16px;font-weight:700">%</span></div>
                                  <div style="width:24px;height:2px;background:#06b6d4;margin:6px auto;border-radius:2px"></div>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 32px 0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                <tr>
                  <td style="padding:14px 8px;background:#f8fafc">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td width="25%" style="padding:0 5px" valign="top">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td style="text-align:center;padding:18px 8px;background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #334155;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
                                      <div style="font-size:24px;font-weight:800;color:#ffffff;line-height:1;font-family:${enFont}">${currentJuz}</div>
                                      <div style="width:12px;height:1px;background:#06b6d4;margin:5px auto;opacity:0.6"></div>
                                      <div style="font-size:10px;color:#ffffff;margin-top:3px;font-weight:700;font-family:${arFont}" dir="rtl">&#1575;&#1604;&#1580;&#1586;&#1569; &#1575;&#1604;&#1581;&#1575;&#1604;&#1610;</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td width="25%" style="padding:0 5px" valign="top">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td style="text-align:center;padding:18px 8px;background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #334155;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
                                      <div style="font-size:24px;font-weight:800;color:#ffffff;line-height:1;font-family:${enFont}">${currentSafah}</div>
                                      <div style="width:12px;height:1px;background:#06b6d4;margin:5px auto;opacity:0.6"></div>
                                      <div style="font-size:10px;color:#ffffff;margin-top:3px;font-weight:700;font-family:${arFont}" dir="rtl">&#1575;&#1604;&#1589;&#1601;&#1581;&#1577;</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td width="25%" style="padding:0 5px" valign="top">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td style="text-align:center;padding:18px 8px;background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #334155;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
                                      <div style="font-size:24px;font-weight:800;color:#ffffff;line-height:1;font-family:${enFont}">${totalJadeedPages}</div>
                                      <div style="width:12px;height:1px;background:#06b6d4;margin:5px auto;opacity:0.6"></div>
                                      <div style="font-size:10px;color:#ffffff;margin-top:3px;font-weight:700;font-family:${arFont}" dir="rtl">&#1575;&#1604;&#1589;&#1601;&#1581;&#1575;&#1578;</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td width="25%" style="padding:0 5px" valign="top">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td style="text-align:center;padding:18px 8px;background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #334155;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
                                      <div style="font-size:24px;font-weight:800;color:#ffffff;line-height:1;font-family:${enFont}">30</div>
                                      <div style="width:12px;height:1px;background:#06b6d4;margin:5px auto;opacity:0.6"></div>
                                      <div style="font-size:10px;color:#ffffff;margin-top:3px;font-weight:700;font-family:${arFont}" dir="rtl">&#1575;&#1604;&#1571;&#1580;&#1586;&#1575;&#1569;</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;text-align:center">
              ${ornamentDivider}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 20px;text-align:center">
              <p style="margin:0 0 4px;font-size:13px;font-weight:900;color:#0f172a;letter-spacing:3px;text-transform:uppercase;font-family:${enFont}">DARSE BURHANI</p>
              <div style="width:28px;height:2px;background:#06b6d4;margin:6px auto;border-radius:2px"></div>
              <p style="margin:0;font-size:8px;color:#94a3b8;letter-spacing:1px;font-weight:500;font-family:${enFont}">Report generated: ${formattedDate}</p>
            </td>
          </tr>

          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#7a5c1f,#b8962e,#06b6d4,#b8962e,#7a5c1f)"></td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// POST /api/admin/hifz/send-emails - Send report cards to parents via SMTP
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { reportIds } = body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ success: false, error: "Report IDs are required" });
    }

    let sent = 0;
    let failed = 0;
    const emails: Array<{ email: string; subject: string; html: string; studentName: string }> = [];

    for (const reportId of reportIds) {
      try {
        const report = await prisma.hifzReport.findUnique({
          where: { id: reportId },
          include: {
            student: {
              include: {
                user: true,
                parentLinks: {
                  include: {
                    parent: {
                      include: { user: true },
                    },
                  },
                },
              },
            },
            parts: true,
          },
        });

        if (!report || !report.student) {
          failed++;
          continue;
        }

        // Get parent emails - from linked parent accounts and direct profile contact fields
        const rawParentEmails = [
          ...report.student.parentLinks.map((link) => link.parent?.user?.email),
          report.student.fatherEmail,
          report.student.motherEmail,
        ].filter((email): email is string => !!email && email.includes("@"));

        const parentEmails = Array.from(new Set(rawParentEmails.map((e) => e.trim().toLowerCase())));

        if (parentEmails.length === 0) {
          failed++;
          continue;
        }

        // Get data from sheet columns: B(ITS), C(Name), F(Current Juz), G(Current Safah), H(Total Jadeed Pages), O(Performance %)
        const currentPart = report.parts.find((p) => p.status === "IN_PROGRESS" || p.status === "COMPLETED");
        const currentJuz = currentPart?.partNumber || 0;
        const currentSafah = currentPart?.currentPage || 0;
        const totalJadeedPages = report.parts.reduce((sum, p) => sum + (p.sentencesMemorized || 0), 0);

        // Get performance percent from the current part (column O from sheet)
        const performancePercent = currentPart?.performancePercent ||
          currentPart?.sentencePercentage ||
          Math.round((currentJuz / 30) * 100);

        const studentName = `${report.student.user.firstName} ${report.student.user.lastName}`;
        const emailHtml = generateEmailHtml(studentName, {
          its: report.student.studentId,
          currentJuz,
          currentSafah,
          totalJadeedPages,
          performancePercent,
          darajah: report.student.grade,
          sanah: report.student.section,
        });

        // Plain text version for better deliverability
        const plainText = [
          `Hifz Report - ${studentName}`,
          `================================`,
          ``,
          `Student: ${studentName}`,
          `ITS: ${report.student.studentId}`,
          `Grade: ${report.student.grade}`,
          `Section: ${report.student.section}`,
          ``,
          `Performance: ${performancePercent}%`,
          `Current Juz: ${currentJuz}`,
          `Current Safah: ${currentSafah}`,
          `Total Jadeed Pages: ${totalJadeedPages}`,
          ``,
          `DARSE BURHANI`,
          `Report generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        ].join("\n");

        // Send one email per parent of this child
        for (const parentEmail of parentEmails) {
          const subject = `Hifz Report - ${studentName}`;
          const emailSent = await sendEmail({
            to: parentEmail,
            subject,
            html: emailHtml,
            text: plainText,
          });

          if (emailSent) {
            emails.push({
              email: parentEmail,
              subject,
              html: emailHtml,
              studentName,
            });
            sent++;
          } else {
            failed++;
          }
        }
      } catch (error) {
        console.error(`Failed to prepare email for report ${reportId}:`, error);
        failed++;
      }
    }

    // Return results after sending emails via SMTP
    return res.json({
      success: true,
      data: {
        sent,
        failed,
        total: reportIds.length,
        emails, // Return email data for client-side processing
      },
    });
  } catch (error) {
    console.error("Send emails error:", error);
    const message = error instanceof Error ? error.message : "Failed to prepare emails";
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
