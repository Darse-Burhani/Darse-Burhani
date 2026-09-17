/**
 * Email templates for library overdue book reminders.
 */

interface OverdueReminderData {
  studentName: string;
  parentName: string;
  books: {
    title: string;
    barcode: string;
    borrowedAt: string;
    dueAt: string;
    daysOverdue: number;
  }[];
  totalDaysOverdue: number;
  libraryName?: string;
}

export function overdueReminderEmail(data: OverdueReminderData): string {
  const libName = data.libraryName || "Darse Burhani Library";
  const bookRows = data.books
    .map(
      (b) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;">${escapeHtml(b.title)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;font-family:monospace;color:#666;text-align:center;">${escapeHtml(b.barcode)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#666;text-align:center;">${b.borrowedAt}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#dc2626;font-weight:600;text-align:center;">${b.dueAt}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">
          <span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:2px 10px;border-radius:12px;font-weight:600;font-size:12px;">${b.daysOverdue} day${b.daysOverdue !== 1 ? "s" : ""}</span>
        </td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 32px; text-align: center; }
    .header h1 { color: white; font-size: 22px; margin-bottom: 4px; }
    .header p { color: #fca5a5; font-size: 14px; }
    .body { padding: 24px 32px; }
    .greeting { font-size: 15px; color: #333; margin-bottom: 16px; line-height: 1.5; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .alert-box .count { font-size: 28px; font-weight: bold; color: #dc2626; }
    .alert-box .label { font-size: 13px; color: #991b1b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; border-bottom: 2px solid #eee; text-align: left; }
    th.center { text-align: center; }
    .footer { padding: 20px 32px; border-top: 1px solid #eee; text-align: center; }
    .footer p { font-size: 12px; color: #999; line-height: 1.5; }
    .btn { display: inline-block; padding: 12px 28px; background: #059669; color: white; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 16px; }
    .divider { height: 1px; background: #eee; margin: 20px 0; }
    .note { font-size: 12px; color: #888; line-height: 1.5; padding: 16px; background: #f9fafb; border-radius: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>📚 Overdue Book Notice</h1>
        <p>${libName}</p>
      </div>
      <div class="body">
        <div class="greeting">
          Dear <strong>${escapeHtml(data.parentName)}</strong>,
        </div>
        <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:20px;">
          This is a reminder that <strong>${escapeHtml(data.studentName)}</strong> has 
          <strong>${data.books.length} overdue book${data.books.length !== 1 ? "s" : ""}</strong> 
          that ${data.books.length === 1 ? "is" : "are"} currently checked out from the library.
          Please ensure the book${data.books.length !== 1 ? "s are" : " is"} returned at your earliest convenience.
        </p>

        <div class="alert-box">
          <table>
            <tr>
              <td style="text-align:center;width:33%;">
                <div class="count">${data.books.length}</div>
                <div class="label">Overdue Book${data.books.length !== 1 ? "s" : ""}</div>
              </td>
              <td style="text-align:center;width:33%;">
                <div class="count">${data.totalDaysOverdue}</div>
                <div class="label">Total Days Overdue</div>
              </td>
              <td style="text-align:center;width:33%;">
                <div class="count" style="color:#059669;">${data.books.filter(b => b.daysOverdue <= 7).length}</div>
                <div class="label">Recent (≤7 days)</div>
              </td>
            </tr>
          </table>
        </div>

        <table>
          <thead>
            <tr>
              <th>Book Title</th>
              <th class="center">Barcode</th>
              <th class="center">Borrowed</th>
              <th class="center">Due Date</th>
              <th class="center">Overdue</th>
            </tr>
          </thead>
          <tbody>
            ${bookRows}
          </tbody>
        </table>

        <div class="note">
          <strong>📖 Late Return Policy:</strong> Books returned after the due date may 
          incur a fine. Repeated late returns may result in borrowing privileges being 
          temporarily suspended. If you have any questions, please contact the library.
        </div>

        <div style="text-align:center;margin-top:20px;">
          <p style="font-size:13px;color:#666;">
            Please return the books to the library during working hours.
          </p>
          <p style="font-size:13px;color:#666;margin-top:4px;">
            Thank you for your cooperation.
          </p>
        </div>
      </div>
      <div class="footer">
        <p>${libName} &middot; This is an automated reminder. Please do not reply to this email.</p>
        <p style="margin-top:4px;">If you believe this is an error, please contact the library administration.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function overdueReminderSms(data: OverdueReminderData): string {
  const bookList = data.books
    .map((b) => `• ${b.title} (Due: ${b.dueAt}, ${b.daysOverdue} days overdue)`)
    .join("\n");

  return `📚 LIBRARY OVERDUE NOTICE - ${data.studentName}

Dear ${data.parentName},

${data.studentName} has ${data.books.length} overdue book(s). Please return them as soon as possible.

${bookList}

Total days overdue: ${data.totalDaysOverdue}

Please contact the library for any questions.

- Darse Burhani Library`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
