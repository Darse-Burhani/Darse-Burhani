/**
 * Transactional email templates for the parent → admin → faculty leave workflow.
 * All mail is sent from the Galiakot administration mailbox: admin.galiakot@darseburhani.org
 */

export interface LeaveApplicationEmailData {
  leaveId: string;
  studentName: string;
  its?: string | null;
  grade?: string | null;
  section?: string | null;
  className?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  attachmentUrl?: string | null;
  submittedAt: string;
  adminUrl: string;
  isAssignedMember?: boolean;
  assignedMemberName?: string | null;
}

export interface LeaveDecisionEmailData {
  leaveId: string;
  studentName: string;
  parentName?: string | null;
  type: string;
  status: "APPROVED" | "REJECTED" | "HOLD";
  requestedStart: string;
  requestedEnd: string;
  requestedDays: number;
  approvedDays?: number | null;
  grantedStart?: string | null;
  grantedEnd?: string | null;
  reviewerName?: string | null;
  reviewerNotes?: string | null;
  portalUrl: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function labelType(type: string): string {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shell(title: string, accent: string, body: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f4;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f4;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8e5;box-shadow:0 8px 24px rgba(15,61,46,0.06);">
            <tr>
              <td style="background:linear-gradient(135deg,#065f46 0%,#0f766e 100%);padding:26px 28px;">
                <div style="font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:#a7f3d0;font-weight:700;">Darse Burhani · Galiakot</div>
                <div style="margin-top:8px;font-size:21px;line-height:1.25;font-weight:800;color:#ffffff;">${escapeHtml(title)}</div>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:${accent};"></td>
            </tr>
            <tr>
              <td style="padding:26px 28px 8px;">${body}</td>
            </tr>
            <tr>
              <td style="padding:18px 28px 26px;">
                <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:11px;line-height:1.7;color:#6b7280;">
                  This is an official automated notification from Darse Burhani Galiakot.<br />
                  For inquiries or assistance, write directly to <a href="mailto:admin.galiakot@darseburhani.org" style="color:#0f766e;text-decoration:none;font-weight:600;">admin.galiakot@darseburhani.org</a>.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;font-size:12px;color:#6b7280;width:150px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-size:13px;color:#111827;font-weight:600;vertical-align:top;">${value}</td>
  </tr>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 4px;">
    <tr>
      <td style="border-radius:12px;background:#065f46;">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function leaveApplicationAdminEmail(data: LeaveApplicationEmailData): string {
  const studentMeta = [
    data.its ? `ITS ${data.its}` : null,
    data.className || (data.grade ? `Grade ${data.grade}${data.section ? `-${data.section}` : ""}` : null),
  ]
    .filter(Boolean)
    .join(" · ");

  const isAssigned = !!data.isAssignedMember;
  const headerTitle = isAssigned ? "Leave Application Assigned to You" : "New Leave Application";
  const accentColor = isAssigned ? "#0d9488" : "#f59e0b";

  const introText = isAssigned
    ? `A student leave application has been submitted by a parent and assigned to you (${escapeHtml(data.assignedMemberName || "Faculty Member")}) for review and granting of leave.`
    : `A new student leave application has been submitted by a parent and reflects in the administration leave portal for review.`;

  const actionButtonText = isAssigned ? "Open Faculty Leave Portal" : "Open Admin Leave Portal";

  const footerInstruction = isAssigned
    ? `Please log in to your portal, add your remarks, and select how many days are granted from the requested start date. The parent will be notified immediately upon your decision.`
    : (data.assignedMemberName
        ? `This request is currently assigned to <strong>${escapeHtml(data.assignedMemberName)}</strong>. You may also review and approve/reject directly or re-assign from the portal.`
        : `Assign this request to a faculty member with portal access, or review and approve/reject directly.`);

  const body = `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#374151;">
      ${introText}
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf9;border:1px solid #e5ebe8;border-radius:14px;padding:6px 16px;margin:0 0 16px;">
      ${infoRow("Student", `${escapeHtml(data.studentName)}${studentMeta ? `<span style="display:block;font-size:11px;color:#6b7280;font-weight:500;margin-top:2px;">${escapeHtml(studentMeta)}</span>` : ""}`)}
      ${infoRow("Parent / Guardian", `${escapeHtml(data.parentName || "Parent / Guardian")}${data.parentEmail ? `<span style="display:block;font-size:11px;color:#6b7280;font-weight:500;margin-top:2px;">${escapeHtml(data.parentEmail)}</span>` : ""}`)}
      ${infoRow("Leave Type", escapeHtml(labelType(data.type)))}
      ${infoRow("Requested Dates", `${escapeHtml(data.startDate)} → ${escapeHtml(data.endDate)}`)}
      ${infoRow("Requested Duration", `${data.days} ${data.days === 1 ? "day" : "days"}`)}
      ${data.assignedMemberName ? infoRow("Assigned Member", escapeHtml(data.assignedMemberName)) : ""}
      ${infoRow("Submitted At", escapeHtml(data.submittedAt))}
    </table>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:14px 16px;margin:0 0 18px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#92400e;margin-bottom:6px;">Reason given by parent</div>
      <div style="font-size:13px;line-height:1.7;color:#78350f;white-space:pre-wrap;">${escapeHtml(data.reason)}</div>
      ${
        data.attachmentUrl
          ? `<div style="margin-top:10px;font-size:12px;"><a href="${escapeHtml(data.attachmentUrl)}" target="_blank" style="color:#92400e;font-weight:700;">View supporting document →</a></div>`
          : ""
      }
    </div>

    ${button(actionButtonText, data.adminUrl)}

    <p style="margin:14px 0 0;font-size:11.5px;line-height:1.7;color:#6b7280;">
      ${footerInstruction}
    </p>
  `;

  return shell(headerTitle, accentColor, body);
}

export function leaveDecisionParentEmail(data: LeaveDecisionEmailData): string {
  const approved = data.status === "APPROVED";
  const onHold = data.status === "HOLD";
  const grantedDays = data.approvedDays ?? data.requestedDays;
  const reduced = approved && grantedDays < data.requestedDays;
  const accent = onHold ? "#f59e0b" : approved ? (reduced ? "#f59e0b" : "#10b981") : "#ef4444";

  const headline = onHold
    ? "Leave Application Placed On Hold"
    : !approved
    ? "Leave Application Not Approved"
    : reduced
    ? "Leave Approved — Reduced Days"
    : "Leave Application Approved";

  const intro = onHold
    ? `The leave application for <strong>${escapeHtml(data.studentName)}</strong> has been placed <strong>on hold pending administrative clarification or verification</strong>.`
    : !approved
    ? `The leave application for <strong>${escapeHtml(data.studentName)}</strong> has been reviewed by the school and could not be approved.`
    : reduced
    ? `The leave application for <strong>${escapeHtml(data.studentName)}</strong> has been <strong>approved for ${grantedDays} of ${data.requestedDays} requested ${data.requestedDays === 1 ? "day" : "days"}</strong>.`
    : `The leave application for <strong>${escapeHtml(data.studentName)}</strong> has been <strong>approved in full</strong>.`;

  const datesBlock = approved
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${reduced ? "#fffbeb" : "#ecfdf5"};border:1px solid ${reduced ? "#fde68a" : "#a7f3d0"};border-radius:14px;padding:14px 16px;margin:0 0 16px;">
        <tr>
          <td style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${reduced ? "#92400e" : "#047857"};">
            ${reduced ? "Granted Leave (Reduced Period)" : "Granted Leave (Full Period)"}
          </td>
        </tr>
        <tr>
          <td style="padding-top:6px;font-size:18px;font-weight:800;color:${reduced ? "#78350f" : "#064e3b"};">
            ${escapeHtml(data.grantedStart || data.requestedStart)} → ${escapeHtml(data.grantedEnd || data.requestedEnd)}
          </td>
        </tr>
        <tr>
          <td style="padding-top:4px;font-size:12.5px;color:${reduced ? "#92400e" : "#047857"};font-weight:600;">
            ${grantedDays} ${grantedDays === 1 ? "day" : "days"} granted${
              reduced ? ` · ${data.requestedDays} days requested` : ""
            }
          </td>
        </tr>
      </table>`
    : "";

  const body = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151;">${intro}</p>

    ${datesBlock}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf9;border:1px solid #e5ebe8;border-radius:14px;padding:6px 16px;margin:0 0 16px;">
      ${infoRow("Student", escapeHtml(data.studentName))}
      ${infoRow("Leave Type", escapeHtml(labelType(data.type)))}
      ${infoRow("Requested Dates", `${escapeHtml(data.requestedStart)} → ${escapeHtml(data.requestedEnd)} (${data.requestedDays} ${data.requestedDays === 1 ? "day" : "days"})`)}
      ${infoRow("Application Status", onHold ? "Placed On Hold" : approved ? (reduced ? "Approved (Reduced Days)" : "Approved in Full") : "Not Approved")}
      ${data.reviewerName ? infoRow("Reviewed By", escapeHtml(data.reviewerName)) : ""}
    </table>

    ${
      data.reviewerNotes
        ? `<div style="background:${onHold ? "#fffbeb" : "#f0f9ff"};border:1px solid ${onHold ? "#fde68a" : "#bae6fd"};border-radius:14px;padding:14px 16px;margin:0 0 18px;">
            <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${onHold ? "#92400e" : "#0369a1"};margin-bottom:6px;">Remarks from Administration</div>
            <div style="font-size:13px;line-height:1.7;color:${onHold ? "#78350f" : "#0c4a6e"};white-space:pre-wrap;">${escapeHtml(data.reviewerNotes)}</div>
          </div>`
        : ""
    }

    ${button("Open Parent Portal", data.portalUrl)}

    <p style="margin:14px 0 0;font-size:11.5px;line-height:1.7;color:#6b7280;">
      ${onHold ? "Please check the remarks above and contact the administration if additional information is required." : "Attendance for the granted dates is synchronized automatically with the school registry."}
    </p>
  `;

  return shell(headline, accent, body);
}
