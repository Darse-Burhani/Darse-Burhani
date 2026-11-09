/**
 * Email templates for library overdue & book return reminders.
 */

export interface OverdueReminderData {
  studentName: string;
  className?: string | null;
  parentName: string;
  books: {
    title: string;
    barcode: string;
    borrowedAt?: string;
    dueAt: string;
    dueDiffLabel?: string;
    daysOverdue?: number;
    isOverdue?: boolean;
  }[];
  totalDaysOverdue?: number;
  libraryName?: string;
}

export function maktabatReturnReminderPlainText(data: OverdueReminderData): string {
  const bName = data.studentName.trim();
  const cName = data.className ? ` (${data.className})` : "";
  const firstBook = data.books[0];
  const isOverdue = Boolean((data.totalDaysOverdue && data.totalDaysOverdue > 0) || firstBook?.isOverdue || (firstBook?.daysOverdue && firstBook.daysOverdue > 0));

  const header = isOverdue
    ? `🚨 *MAKTABAT DARSE BURHANI • OVERDUE BOOK NOTICE*`
    : `📚 *MAKTABAT DARSE BURHANI • BOOK RETURN REMINDER*`;

  const statusText = isOverdue
    ? `*OVERDUE (${data.totalDaysOverdue || firstBook?.daysOverdue || 1} days late)* ⚠️`
    : `*RETURN DUE SOON* ⏰`;

  const dueLabel = firstBook?.dueDiffLabel
    ? `${firstBook.dueAt} (${firstBook.dueDiffLabel})`
    : firstBook?.dueAt || "Due Soon";

  return `*IDARSE BURHANI • MAHAD AL-ZAHRA*
Maktabat• Galiakot

${header}

Afzalus Salam,

Kindly note the library book details issued to *${bName}*${cName}:

📋 *Book Checkout Details:*
• *Book Title:* *${firstBook?.title || "Library Book"}*
• *Accession / Barcode:* *${firstBook?.barcode || "N/A"}*
• *Issued To:* *${bName}*${cName}
• *Return Due Date:* *${dueLabel}*
• *Status:* ${statusText}

📌 *Important Maktabat Instruction:*
*Please return or renew this book in the Maktabat  before the due date to avoid overdue notices.*

----------------------------------------
_⚠️ NOTICE: Automated institutional notice from Maktabat• Galiakot._`;
}

export function overdueReminderEmail(data: OverdueReminderData): string {
  const bName = escapeHtml(data.studentName.trim());
  const cName = data.className ? ` (${escapeHtml(data.className)})` : "";
  const firstBook = data.books[0];
  const isOverdue = Boolean((data.totalDaysOverdue && data.totalDaysOverdue > 0) || firstBook?.isOverdue || (firstBook?.daysOverdue && firstBook.daysOverdue > 0));

  const dueLabel = firstBook?.dueDiffLabel
    ? `${firstBook.dueAt} (${firstBook.dueDiffLabel})`
    : firstBook?.dueAt || "Due Soon";

  const statusBadge = isOverdue
    ? `<span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:12px;font-weight:700;font-size:12px;letter-spacing:0.5px;">OVERDUE (${data.totalDaysOverdue || firstBook?.daysOverdue || 1} DAYS LATE) ⚠️</span>`
    : `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:12px;font-weight:700;font-size:12px;letter-spacing:0.5px;">RETURN DUE SOON ⏰</span>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fdfbf7; color: #1e293b; padding: 24px 12px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; border-bottom: 3px solid #d97706; }
    .inst-title { color: #f59e0b; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
    .inst-dept { color: #94a3b8; font-size: 13px; font-weight: 500; margin-bottom: 12px; }
    .notice-badge { display: inline-block; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-size: 13px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; letter-spacing: 0.5px; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
    .intro { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px; }
    .card-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
    .card-box-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin-bottom: 14px; display: flex; items-center; }
    .detail-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
    .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
    .detail-label { color: #64748b; font-weight: 600; }
    .detail-val { color: #0f172a; font-weight: 700; text-align: right; }
    .inst-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 16px; margin-bottom: 20px; }
    .inst-box-title { color: #b45309; font-size: 13px; font-weight: 800; margin-bottom: 6px; }
    .inst-box-desc { color: #92400e; font-size: 13px; line-height: 1.5; font-weight: 600; }
    .footer { padding: 18px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer-note { font-size: 12px; color: #64748b; line-height: 1.5; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="inst-title">IDARSE BURHANI • MAHAD AL-ZAHRA</div>
      <div class="inst-dept">Maktabat • Galiakot</div>
      <div class="notice-badge">📚 MAKTABAT DARSE BURHANI • BOOK RETURN REMINDER</div>
    </div>
    
    <div class="content">
      <div class="greeting">Afzalus Salam,</div>
      <div class="intro">
        Kindly note the library book details issued to <strong>${bName}</strong>${cName}:
      </div>

      <div class="card-box">
        <div class="card-box-title">📋 Book Checkout Details</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px dashed #cbd5e1;">Book Title:</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:700;text-align:right;border-bottom:1px dashed #cbd5e1;">${escapeHtml(firstBook?.title || "Library Book")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px dashed #cbd5e1;">Accession / Barcode:</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:700;text-align:right;font-family:monospace;border-bottom:1px dashed #cbd5e1;">${escapeHtml(firstBook?.barcode || "N/A")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px dashed #cbd5e1;">Issued To:</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:700;text-align:right;border-bottom:1px dashed #cbd5e1;">${bName}${cName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px dashed #cbd5e1;">Return Due Date:</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:700;text-align:right;border-bottom:1px dashed #cbd5e1;">${escapeHtml(dueLabel)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0 2px 0;color:#64748b;font-size:13px;font-weight:600;">Status:</td>
            <td style="padding:10px 0 2px 0;text-align:right;">${statusBadge}</td>
          </tr>
        </table>
      </div>

      <div class="inst-box">
        <div class="inst-box-title">📌 Important Maktabat Instruction:</div>
        <div class="inst-box-desc">Please return or renew this book in the Maktabat before the due date to avoid overdue notices.</div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-note">⚠️ NOTICE: Automated institutional notice from Maktabat • Galiakot.</div>
    </div>
  </div>
</body>
</html>`;
}

export function overdueReminderSms(data: OverdueReminderData): string {
  return maktabatReturnReminderPlainText(data);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
