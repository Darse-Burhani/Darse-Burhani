/**
 * Fatimid Royal Gold & Emerald Email Template for Weekly & Monthly Attendance Reports.
 * Designed for Darse Burhani - Aljamea-tus-Saifiyah.
 */

export interface DailyAttendanceDetail {
  date: string;
  dayName: string;
  hijriDate?: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EARLY_DEPARTURE";
  checkInTime?: string | null;
  checkOutTime?: string | null;
  verificationMethod?: string | null;
  justification?: string | null;
  justificationStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
}

export interface AttendanceReportData {
  studentName: string;
  studentNameAr?: string | null;
  itsNumber?: string | null;
  grade: string;
  section?: string | null;
  parentName?: string | null;
  periodType: "WEEKLY" | "MONTHLY";
  periodLabel: string; // e.g. "Week of Oct 12 – Oct 18, 2026" or "October 2026"
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    earlyDepartureDays: number;
    attendancePercentage: number; // 0 - 100
    punctualityPercentage: number; // 0 - 100
    currentStreakDays?: number;
  };
  dailyRecords: DailyAttendanceDetail[];
  customNote?: string | null;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateAttendanceReportEmailHtml(data: AttendanceReportData): string {
  const {
    studentName,
    studentNameAr,
    itsNumber,
    grade,
    section,
    parentName,
    periodType,
    periodLabel,
    metrics,
    dailyRecords,
    customNote,
  } = data;

  const enFont = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const arFont = "'Amiri', 'Traditional Arabic', 'Scheherazade', Arial, serif";

  const percent = Math.min(100, Math.max(0, Math.round(metrics.attendancePercentage || 0)));

  // SVG circular gauge geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * percent) / 100;

  // Rating color branding
  let ratingColor = "#059669"; // Emerald (default high)
  let ratingGradientStart = "#10b981";
  let ratingGradientEnd = "#047857";
  let ratingLabel = "Excellent Attendance";
  let ratingLabelAr = "حضور ممتاز";
  let ratingBadgeBg = "#ecfdf5";
  let ratingBadgeBorder = "#a7f3d0";
  let ratingBadgeText = "#065f46";

  if (percent >= 90) {
    ratingColor = "#059669";
    ratingGradientStart = "#10b981";
    ratingGradientEnd = "#047857";
    ratingLabel = "Excellent Attendance";
    ratingLabelAr = "حضور ممتاز";
    ratingBadgeBg = "#ecfdf5";
    ratingBadgeBorder = "#a7f3d0";
    ratingBadgeText = "#065f46";
  } else if (percent >= 75) {
    ratingColor = "#0284c7";
    ratingGradientStart = "#38bdf8";
    ratingGradientEnd = "#0369a1";
    ratingLabel = "Good Attendance";
    ratingLabelAr = "حضور جيد";
    ratingBadgeBg = "#f0f9ff";
    ratingBadgeBorder = "#bae6fd";
    ratingBadgeText = "#0369a1";
  } else if (percent >= 60) {
    ratingColor = "#d97706";
    ratingGradientStart = "#fbbf24";
    ratingGradientEnd = "#b45309";
    ratingLabel = "Needs Attention";
    ratingLabelAr = "يحتاج إلى متابعة";
    ratingBadgeBg = "#fffbeb";
    ratingBadgeBorder = "#fde68a";
    ratingBadgeText = "#92400e";
  } else {
    ratingColor = "#dc2626";
    ratingGradientStart = "#f87171";
    ratingGradientEnd = "#b91c1c";
    ratingLabel = "Critical Attendance";
    ratingLabelAr = "تنبيه غياب";
    ratingBadgeBg = "#fef2f2";
    ratingBadgeBorder = "#fecaca";
    ratingBadgeText = "#991b1b";
  }

  const generatedDateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Table rows for daily breakdown
  const dailyRows = dailyRecords.length > 0
    ? dailyRecords
        .map((rec, index) => {
          let badgeBg = "#ecfdf5";
          let badgeText = "#065f46";
          let badgeBorder = "#a7f3d0";
          let statusText = "Present";

          if (rec.status === "PRESENT") {
            badgeBg = "#ecfdf5";
            badgeText = "#065f46";
            badgeBorder = "#a7f3d0";
            statusText = "Present";
          } else if (rec.status === "LATE") {
            badgeBg = "#fffbeb";
            badgeText = "#92400e";
            badgeBorder = "#fde68a";
            statusText = "Late";
          } else if (rec.status === "ABSENT") {
            badgeBg = "#fef2f2";
            badgeText = "#991b1b";
            badgeBorder = "#fecaca";
            statusText = "Absent";
          } else if (rec.status === "EARLY_DEPARTURE") {
            badgeBg = "#fff7ed";
            badgeText = "#9a3412";
            badgeBorder = "#fed7aa";
            statusText = "Early Dep.";
          }

          const rowBg = index % 2 === 0 ? "#ffffff" : "#fbfbfd";
          const checkIn = rec.checkInTime || (rec.status === "ABSENT" ? "—" : "Recorded");

          let justificationNote = "";
          if (rec.justification) {
            const jStatusBadge =
              rec.justificationStatus === "APPROVED"
                ? `<span style="color:#059669;font-weight:600;">(Approved)</span>`
                : rec.justificationStatus === "REJECTED"
                ? `<span style="color:#dc2626;font-weight:600;">(Declined)</span>`
                : `<span style="color:#d97706;font-weight:600;">(Pending)</span>`;
            justificationNote = `<div style="font-size:11px;color:#64748b;margin-top:2px;"><em>Reason: ${escapeHtml(rec.justification)} ${jStatusBadge}</em></div>`;
          }

          return `
          <tr style="background-color:${rowBg};">
            <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:600;">
              <div>${escapeHtml(rec.dayName)}, ${escapeHtml(rec.date)}</div>
              ${justificationNote}
            </td>
            <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;text-align:center;font-family:monospace;">
              ${escapeHtml(checkIn)}
            </td>
            <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;text-align:right;">
              <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background-color:${badgeBg};color:${badgeText};border:1px solid ${badgeBorder};">
                ${statusText}
              </span>
            </td>
          </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="3" style="padding:24px;text-align:center;color:#64748b;font-size:13px;">
          No specific day records logged for this duration.
        </td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${periodType === "WEEKLY" ? "Weekly" : "Monthly"} Attendance Report - ${escapeHtml(studentName)}</title>
  <!--[if mso]>
  <style>table,td,div,p,a{font-family:Arial,sans-serif !important}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:${enFont};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#1e293b;">

  <!-- Preview Hook Text for Inbox Readers -->
  <div style="font-size:1px;color:#f4f6f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${periodType === "WEEKLY" ? "Weekly" : "Monthly"} Attendance Report for ${escapeHtml(studentName)}: ${percent}% Attendance (${metrics.presentDays} Present, ${metrics.absentDays} Absent).
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f6f8;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <!-- Main Card Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.07);border:1px solid #e2e8f0;">

          <!-- Top Regal Header Bar (Emerald & Gold) -->
          <tr>
            <td style="background:linear-gradient(135deg, #093b2a 0%, #0f4c3a 50%, #062b1e 100%);padding:28px 24px;text-align:center;border-bottom:3px solid #d4af37;">
              
              <!-- Arabic Bismillah & Motifs -->
              <p style="margin:0 0 6px 0;font-size:16px;color:#d4af37;font-family:${arFont};letter-spacing:1px;" dir="rtl">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </p>
              
              <!-- Brand Title -->
              <h1 style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:2.5px;text-transform:uppercase;font-family:${enFont};">
                Darse Burhani
              </h1>
              <p style="margin:2px 0 0 0;font-size:10px;color:#a7f3d0;letter-spacing:2px;text-transform:uppercase;font-weight:700;">
                Aljamea-tus-Saifiyah
              </p>

              <div style="margin:14px auto 0 auto;width:60px;height:2px;background:linear-gradient(90deg, transparent, #d4af37, transparent);border-radius:2px;"></div>

              <div style="margin-top:12px;display:inline-block;padding:5px 16px;background:rgba(212,175,55,0.18);border:1px solid #d4af37;border-radius:20px;">
                <span style="font-size:11px;font-weight:800;color:#fff2b2;letter-spacing:1.5px;text-transform:uppercase;">
                  ${periodType === "WEEKLY" ? "📅 Weekly Attendance Report" : "📊 Monthly Attendance Report"}
                </span>
              </div>
            </td>
          </tr>

          <!-- Student Profile & Period Banner -->
          <tr>
            <td style="padding:24px 28px 12px 28px;background-color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;">
                <tr>
                  <td valign="middle" style="width:75%;">
                    ${parentName ? `<p style="margin:0 0 4px 0;font-size:12px;color:#64748b;font-weight:600;">Dear <strong>${escapeHtml(parentName)}</strong>,</p>` : ""}
                    <h2 style="margin:0 0 4px 0;font-size:19px;font-weight:800;color:#0f172a;line-height:1.2;">
                      ${escapeHtml(studentName)}
                      ${studentNameAr ? `<span style="font-size:17px;font-family:${arFont};color:#047857;margin-left:6px;" dir="rtl">(${escapeHtml(studentNameAr)})</span>` : ""}
                    </h2>
                    <p style="margin:0;font-size:12px;color:#475569;font-weight:500;">
                      ${itsNumber ? `<strong>ITS:</strong> ${escapeHtml(itsNumber)} &nbsp;·&nbsp; ` : ""}
                      <strong>Class:</strong> Grade ${escapeHtml(grade)}${section ? `-${escapeHtml(section)}` : ""}
                    </p>
                  </td>
                  <td valign="middle" align="right" style="width:25%;">
                    <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                      <div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Period</div>
                      <div style="font-size:12px;color:#0f172a;font-weight:800;margin-top:2px;">${escapeHtml(periodLabel)}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Circular Performance Ring & Rating -->
          <tr>
            <td style="padding:10px 28px 16px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg, #fafbfd 0%, #f1f5f9 100%);border:1px solid #e2e8f0;border-radius:14px;padding:20px;">
                <tr>
                  <td align="center" valign="middle" style="width:45%;padding-right:12px;">
                    <!-- Circular Meter SVG -->
                    <div style="position:relative;width:130px;height:130px;margin:0 auto;">
                      <svg width="130" height="130" viewBox="0 0 130 130" style="display:block;">
                        <defs>
                          <linearGradient id="meterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${ratingGradientStart}"/>
                            <stop offset="100%" stop-color="${ratingGradientEnd}"/>
                          </linearGradient>
                        </defs>
                        <!-- Background Track -->
                        <circle cx="65" cy="65" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="10"/>
                        <!-- Value Circle -->
                        <circle cx="65" cy="65" r="${radius}" fill="none" stroke="url(#meterGrad)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" transform="rotate(-90 65 65)"/>
                      </svg>
                      <!-- Center Number -->
                      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);text-align:center;width:100px;">
                        <div style="font-size:32px;font-weight:900;color:${ratingColor};line-height:1;font-family:${enFont};">
                          ${percent}<span style="font-size:14px;font-weight:700;">%</span>
                        </div>
                        <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Attendance</div>
                      </div>
                    </div>
                  </td>

                  <td valign="middle" style="width:55%;padding-left:12px;">
                    <div style="display:inline-block;padding:4px 12px;background:${ratingBadgeBg};border:1px solid ${ratingBadgeBorder};border-radius:20px;margin-bottom:8px;">
                      <span style="font-size:12px;font-weight:800;color:${ratingBadgeText};">
                        ● ${ratingLabel}
                      </span>
                    </div>

                    <p style="margin:0 0 6px 0;font-size:13px;color:#334155;line-height:1.4;">
                      ${
                        percent >= 90
                          ? "Masha'Allah! The student maintains outstanding attendance and timely arrival."
                          : percent >= 75
                          ? "Good attendance record. Please ensure continued regularity."
                          : "Attendance has fallen below the optimal threshold. Please assist in punctual daily attendance."
                      }
                    </p>

                    <div style="font-size:11px;color:#64748b;margin-top:8px;">
                      <strong>Punctuality Rate:</strong> ${Math.round(metrics.punctualityPercentage || 0)}% on-time check-in
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Metric Cards (4 Columns) -->
          <tr>
            <td style="padding:0 28px 20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  
                  <!-- Present -->
                  <td width="23%" style="padding:0 4px 0 0;" valign="top">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;padding:12px 6px;">
                      <tr>
                        <td>
                          <div style="font-size:22px;font-weight:900;color:#15803d;line-height:1;">${metrics.presentDays}</div>
                          <div style="font-size:10px;font-weight:700;color:#166534;margin-top:4px;text-transform:uppercase;">Present</div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Late -->
                  <td width="23%" style="padding:0 4px;" valign="top">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;text-align:center;padding:12px 6px;">
                      <tr>
                        <td>
                          <div style="font-size:22px;font-weight:900;color:#b45309;line-height:1;">${metrics.lateDays}</div>
                          <div style="font-size:10px;font-weight:700;color:#92400e;margin-top:4px;text-transform:uppercase;">Late</div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Absent -->
                  <td width="23%" style="padding:0 4px;" valign="top">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;text-align:center;padding:12px 6px;">
                      <tr>
                        <td>
                          <div style="font-size:22px;font-weight:900;color:#b91c1c;line-height:1;">${metrics.absentDays}</div>
                          <div style="font-size:10px;font-weight:700;color:#991b1b;margin-top:4px;text-transform:uppercase;">Absent</div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Total Days -->
                  <td width="23%" style="padding:0 0 0 4px;" valign="top">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;padding:12px 6px;">
                      <tr>
                        <td>
                          <div style="font-size:22px;font-weight:900;color:#334155;line-height:1;">${metrics.totalDays}</div>
                          <div style="font-size:10px;font-weight:700;color:#64748b;margin-top:4px;text-transform:uppercase;">Total Days</div>
                        </td>
                      </tr>
                    </table>
                  </td>

                </tr>
              </table>
            </td>
          </tr>

          <!-- Custom Message Note from Teacher / Admin (if present) -->
          ${
            customNote
              ? `
          <tr>
            <td style="padding:0 28px 20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fdf6e2;border-left:4px solid #d4af37;border-radius:8px;padding:14px 16px;">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:800;color:#854d0e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">
                      📝 Note from Administration / Masool
                    </div>
                    <div style="font-size:13px;color:#713f12;line-height:1.5;">
                      ${escapeHtml(customNote)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ""
          }

          <!-- Detailed Daily Attendance Table -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <div style="font-size:13px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                📋 Detailed Attendance Log
              </div>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#475569;text-align:left;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">
                      Date & Day
                    </th>
                    <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#475569;text-align:center;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">
                      Check-In
                    </th>
                    <th style="padding:10px 14px;font-size:11px;font-weight:800;color:#475569;text-align:right;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${dailyRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Portal Quick Action Button -->
          <tr>
            <td style="padding:0 28px 28px 28px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#059669,#047857);text-align:center;box-shadow:0 4px 14px rgba(5,150,105,0.3);">
                    <a href="https://darseburhani.edu/login" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.5px;border-radius:10px;">
                      Access Darse Burhani Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer & Sign-off -->
          <tr>
            <td style="background-color:#0f172a;padding:24px;text-align:center;border-top:1px solid #1e293b;">
              <p style="margin:0 0 4px 0;font-size:12px;font-weight:800;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">
                Darse Burhani · Aljamea-tus-Saifiyah
              </p>
              <div style="width:30px;height:2px;background:#d4af37;margin:6px auto;border-radius:2px;"></div>
              <p style="margin:0 0 4px 0;font-size:11px;color:#94a3b8;">
                Automated Attendance Notification System · Generated on ${generatedDateStr}
              </p>
              <p style="margin:0;font-size:10px;color:#64748b;">
                If you have queries regarding your child's attendance or wish to submit an absence justification, please log in to the Parent Portal.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

export function generateAttendanceReportPlainText(data: AttendanceReportData): string {
  const { studentName, itsNumber, grade, section, periodType, periodLabel, metrics, dailyRecords, customNote } = data;

  const lines = [
    `==================================================`,
    `DARSE BURHANI - ALJAMEA-TUS-SAIFIYAH`,
    `${periodType === "WEEKLY" ? "WEEKLY" : "MONTHLY"} ATTENDANCE REPORT`,
    `==================================================`,
    ``,
    `Student: ${studentName}`,
    ...(itsNumber ? [`ITS Number: ${itsNumber}`] : []),
    `Grade & Section: ${grade}${section ? `-${section}` : ""}`,
    `Period: ${periodLabel}`,
    ``,
    `SUMMARY STATISTICS:`,
    `--------------------------------------------------`,
    `Attendance Rate : ${metrics.attendancePercentage}%`,
    `Punctuality Rate: ${metrics.punctualityPercentage}%`,
    `Present Days    : ${metrics.presentDays} / ${metrics.totalDays}`,
    `Late Arrivals   : ${metrics.lateDays}`,
    `Absences        : ${metrics.absentDays}`,
    `Early Dep.      : ${metrics.earlyDepartureDays}`,
    ``,
  ];

  if (customNote) {
    lines.push(`NOTE FROM ADMINISTRATION:`, `${customNote}`, ``);
  }

  lines.push(`DAILY ATTENDANCE LOG:`, `--------------------------------------------------`);

  if (dailyRecords.length === 0) {
    lines.push(`No attendance records found for this period.`);
  } else {
    for (const rec of dailyRecords) {
      const checkIn = rec.checkInTime || "—";
      lines.push(`${rec.dayName}, ${rec.date} | Status: ${rec.status} | Check-in: ${checkIn}`);
      if (rec.justification) {
        lines.push(`   Reason: ${rec.justification} (${rec.justificationStatus || "PENDING"})`);
      }
    }
  }

  lines.push(
    ``,
    `--------------------------------------------------`,
    `Log in to the portal at https://darseburhani.edu/login`,
    `Generated on: ${new Date().toLocaleDateString()}`,
    `Darse Burhani Automated Notification System`,
    `==================================================`
  );

  return lines.join("\n");
}
