/**
 * WhatsApp One-Way Notification Service
 * Strictly handles outbound administrative notifications (e.g. Leave Approval/Rejection/Hold).
 * Non-conversational: strictly one-way notification to parents.
 */

export const DESIGNATED_ADMIN_PARENT_WHATSAPP = "918955199220";

export interface LeaveWhatsAppParams {
  parentName?: string | null;
  studentName: string;
  className?: string | null;
  status: "APPROVED" | "REJECTED" | "APPROVED_REDUCED" | "HOLD" | "PENDING" | string;
  leaveType: string;
  startDate: string;
  endDate: string;
  requestedDays?: number;
  approvedDays?: number;
  reviewerNotes?: string | null;
  reviewerName?: string | null;
}

/**
 * Standardize phone number for WhatsApp deep-links and API gateways.
 * Auto-prefixes India country code 91 for 10-digit mobile numbers.
 */
export function formatWhatsAppPhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/[^0-9]/g, "");
  if (digits.length < 10) return null;

  // 10-digit Indian mobile number
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // 11-digit starting with 0 (e.g., 09876543210)
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

import { getBaileysStatus, sendBaileysMessage } from "./whatsapp-baileys";

function formatLeaveDisplayDate(raw: string | Date): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = monthNames[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  return `${day}-${mon}-${yr}`;
}

function formatLeaveCategory(type: string): string {
  const clean = (type || "").toUpperCase().trim();
  if (clean === "PERSONAL") return "Personal Leave";
  if (clean === "MEDICAL") return "Medical Leave";
  if (clean === "ACADEMIC") return "Academic / Educational Leave";
  if (clean === "FAMILY_EMERGENCY") return "Family Emergency Leave";
  if (clean === "HAJ_ZIYARAT" || clean === "ZIYARAT") return "Ziyarat Leave";
  if (clean === "OFFICIAL") return "Official Duty Leave";
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Leave";
}

/**
 * Generate official, one-way administrative leave notice text
 */
export function formatLeaveWhatsAppMessage(params: LeaveWhatsAppParams): string {
  const pName = params.parentName?.trim() || "Respected Parent";
  const sName = params.studentName.trim();
  const cName = params.className
    ? ` (${params.className.toLowerCase().startsWith("class") ? params.className : `Class ${params.className}`})`
    : "";
  const isPending = params.status === "PENDING";
  const isApproved = params.status === "APPROVED" || params.status === "APPROVED_REDUCED";
  const isHold = params.status === "HOLD";
  const isRejected = params.status === "REJECTED";

  const statusWord = isApproved
    ? params.status === "APPROVED_REDUCED"
      ? "APPROVED (REDUCED DAYS)"
      : "APPROVED"
    : isHold
    ? "PLACED ON HOLD"
    : isPending
    ? "UNDER REVIEW"
    : "REJECTED";

  const statusEmoji = isApproved
    ? params.status === "APPROVED_REDUCED"
      ? "⚠️"
      : "✅"
    : isHold
    ? "⏸️"
    : isPending
    ? "⏳"
    : "❌";

  const statusLabel = `* ${statusEmoji} *${statusWord}*`;

  const startFormatted = formatLeaveDisplayDate(params.startDate);
  const endFormatted = formatLeaveDisplayDate(params.endDate);
  const periodStr = startFormatted === endFormatted
    ? startFormatted
    : `${startFormatted} to ${endFormatted}`;

  const daysStr =
    params.approvedDays !== undefined
      ? `${params.approvedDays} ${params.approvedDays === 1 ? "day" : "days"}`
      : params.requestedDays
      ? `${params.requestedDays} ${params.requestedDays === 1 ? "day" : "days"}`
      : "As requested";

  const remarks =
    params.reviewerNotes?.trim() ||
    (isHold
      ? "Placed on hold pending administrative review / verification."
      : isRejected
      ? "Decision recorded by administration."
      : isPending
      ? "Application received and queued for administrative review."
      : "Approved by administration.");

  const authority = params.reviewerName?.trim() || "Maktab Tanzeem • Galiakot";
  const categoryStr = formatLeaveCategory(params.leaveType);

  if (isPending) {
    return `*DARSE BURHANI • MAHAD AL-ZAHRA*
_Maktab Tanzeem • Galiakot_

Afzalus Salam Janab *${pName}*,

The leave application for talib *${sName}*${cName} has been *UNDER REVIEW* ⏳.

📋 *Leave Decision Details:*
• Application Status: ${statusLabel}

• Leave Category: *${categoryStr}*

• Requested Period: *${periodStr}*

• Requested Days: *${daysStr}*

• Administrative Remarks: *${remarks}*

• Sanctioned By: *${authority}*

----------------------------------------
_⚠️ NOTICE: This is an automated one-way administrative notification. Support: support.darseburhanigaliakot@gmail.com | WhatsApp Desk: +91 8955199220._`;
  }

  if (isHold) {
    return `*DARSE BURHANI • MAHAD AL-ZAHRA*
_Maktab Tanzeem • Galiakot_

Afzalus Salam Janab *${pName}*,

The leave application for talib *${sName}*${cName} has been *PLACED ON HOLD* ⏸️.

📋 *Leave Decision Details:*
• Application Status: ${statusLabel}

• Leave Category: *${categoryStr}*

• Requested Period: *${periodStr}*

• Requested Days: *${daysStr}*

• Administrative Remarks: *${remarks}*

• Sanctioned By: *${authority}*

📌 *Action Required for Parents:*
_Please review the administrative remarks above on the Parent Portal. If clarification, travel details, or medical documentation were requested, kindly update on the portal or contact the administration desk at +91 8955199220._

----------------------------------------
_⚠️ NOTICE: This is an automated one-way administrative notification. Support: support.darseburhanigaliakot@gmail.com | WhatsApp Desk: +91 8955199220._`;
  }

  if (isRejected) {
    return `*DARSE BURHANI • MAHAD AL-ZAHRA*
_Maktab Tanzeem • Galiakot_

Afzalus Salam Janab *${pName}*,

The leave application for talib *${sName}*${cName} has been *REJECTED* ❌.

📋 *Leave Decision Details:*
• Application Status: * ❌ *REJECTED*

• Leave Category: *${categoryStr}*

• Requested Dates: *${periodStr}*

• Granted Days: *None*

• Administrative Remarks: *${remarks}*

----------------------------------------
_⚠️ NOTICE: This is an automated one-way administrative notification. Support: support.darseburhanigaliakot@gmail.com | WhatsApp Desk: +91 8955199220._`;
  }

  return `*DARSE BURHANI • MAHAD AL-ZAHRA*
_Maktab Tanzeem • Galiakot_

Afzalus Salam Janab *${pName}*,

The leave application for talib *${sName}*${cName} has been *${statusWord}* ${statusEmoji}.

📋 *Leave Decision Details:*
• Application Status: ${statusLabel}

• Leave Category: *${categoryStr}*

• Sanctioned Period: *${periodStr}*

• Granted Days: *${daysStr}*

• Administrative Remarks: *${remarks}*

• Sanctioned By: *${authority}*

----------------------------------------
_⚠️ NOTICE: This is an automated one-way administrative notification. Support: support.darseburhanigaliakot@gmail.com | WhatsApp Desk: +91 8955199220._`;
}

export interface BadalWhatsAppParams {
  substituteTeacherName: string;
  originalTeacherName?: string | null;
  className: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  date: string;
  reason?: string | null;
  instructions?: string | null;
  assignedBy?: string | null;
  portalUrl?: string;
}

/**
 * Generate official, one-way administrative Badal (proxy duty) WhatsApp notice
 */
export function formatBadalWhatsAppMessage(params: BadalWhatsAppParams): string {
  const subName = params.substituteTeacherName.trim();
  const origName = params.originalTeacherName?.trim() || "Faculty Member";
  const instructionsText = params.instructions?.trim() || "Will be written by Maktab Taalim";
  const cleanClassName = /^class/i.test(params.className.trim())
    ? params.className.trim()
    : `Class ${params.className.trim()}`;

  let dateFormatted = params.date;
  try {
    const d = new Date(params.date);
    if (!isNaN(d.getTime())) {
      dateFormatted = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
    }
  } catch {}

  return `*DARSE BURHANI • MAHAD AL-ZAHRA*
_Maktab Taalim • Galiakot_

🚨 *(URGENT) - BADAL PERIOD INTIMATION*

Afzalus Salam Janab *${subName}*,

You have been officially assigned by the Matkab Taalim as a substitute teacher (*Badal*) for the following session:

📋 *Class & Period Details:*

• Date: 📅 *${dateFormatted}*

• Period & Time: ⏰ *Period ${params.period} (${params.startTime} – ${params.endTime})*

• Darajah / Class: 🏫 *${cleanClassName}*

• On behalf of : 👤 *${origName}*

• Instructions: 📝 *${instructionsText}*

*Kindly ensure your prompt arrival at the classroom for the above session.*

----------------------------------------
_⚠️ NOTICE: Automated institutional notice from Maktab Taalim • Darse Burhani_. 
_For any Queries, please contact Maktab Taalim_`;
}

export interface LibraryReminderWhatsAppParams {
  borrowerName: string;
  className?: string | null;
  bookTitle: string;
  barcode?: string | null;
  dueDate: string;
  dueHijri?: string | null;
  dueDiffLabel?: string | null;
  isOverdue?: boolean;
  daysOverdue?: number;
}

/**
 * Generate official, one-way Maktabat Book Return Reminder WhatsApp notice
 */
export function formatLibraryReminderWhatsAppMessage(params: LibraryReminderWhatsAppParams): string {
  const bName = params.borrowerName.trim();
  const cName = params.className ? ` (${params.className})` : "";
  const isOverdue = Boolean(params.isOverdue || (params.daysOverdue && params.daysOverdue > 0));

  const header = isOverdue
    ? `🚨 *MAKTABAT DARSE BURHANI • OVERDUE BOOK NOTICE*`
    : `📚 *MAKTABAT DARSE BURHANI • BOOK RETURN REMINDER*`;

  const statusText = isOverdue
    ? `*OVERDUE (${params.daysOverdue || 1} days late)* ⚠️`
    : `*RETURN DUE SOON* ⏰`;

  // Compute clean relative due label (e.g. "10-Nov-2026 (Due in 2 days)")
  let relativeTag = params.dueDiffLabel || "";
  if (!relativeTag && params.dueDate) {
    try {
      const dueParsed = new Date(params.dueDate);
      if (!Number.isNaN(dueParsed.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDay = new Date(dueParsed);
        dueDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) relativeTag = "Due today";
        else if (diffDays === 1) relativeTag = "Due tomorrow";
        else if (diffDays > 1) relativeTag = `Due in ${diffDays} days`;
        else relativeTag = `Overdue by ${Math.abs(diffDays)} days`;
      }
    } catch {
      // ignore
    }
  }

  const dueLabel = relativeTag
    ? `${params.dueDate} (${relativeTag})`
    : params.dueHijri
    ? `${params.dueDate} (${params.dueHijri})`
    : params.dueDate;

  return `*IDARSE BURHANI • MAHAD AL-ZAHRA*
Maktabat• Galiakot

${header}

Afzalus Salam,

Kindly note the library book details issued to *${bName}*${cName}:

📋 *Book Checkout Details:*
• *Book Title:* *${params.bookTitle}*
• *Accession / Barcode:* *${params.barcode || "N/A"}*
• *Issued To:* *${bName}*${cName}
• *Return Due Date:* *${dueLabel}*
• *Status:* ${statusText}

📌 *Important Maktabat Instruction:*
*Please return or renew this book in the Maktabat  before the due date to avoid overdue notices.*

----------------------------------------
_⚠️ NOTICE: Automated institutional notice from Maktabat• Galiakot._`;
}

/**
 * Generate direct 1-click wa.me URL.
 * Falls back to designated WhatsApp (+91 8955199220) if rawPhone is missing.
 */
export function generateWhatsAppLink(rawPhone?: string | null, message?: string): string | null {
  const targetPhone = rawPhone?.trim() || DESIGNATED_ADMIN_PARENT_WHATSAPP;
  const cleanPhone = formatWhatsAppPhone(targetPhone) || DESIGNATED_ADMIN_PARENT_WHATSAPP;
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || "")}`;
}

/**
 * Dispatch automated one-way WhatsApp message via configured gateway (if present).
 * If no gateway is configured in environment, safely logs and provides the 1-click link.
 */
export async function dispatchWhatsAppNotification(options: {
  phone: string;
  message: string;
}): Promise<{ success: boolean; waLink: string | null; error?: string }> {
  const cleanPhone = formatWhatsAppPhone(options.phone);
  if (!cleanPhone) {
    return { success: false, waLink: null, error: "Invalid phone number" };
  }

  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(options.message)}`;

  // 1. Built-in Self-Hosted Baileys Cloud WhatsApp Service (100% Free, 24/7)
  const baileysStatus = getBaileysStatus();
  if (baileysStatus.isConnected) {
    const res = await sendBaileysMessage(cleanPhone, options.message);
    if (res.success) {
      return { success: true, waLink };
    }
    console.warn("[whatsapp] Baileys dispatch failed, falling back:", res.error);
  }

  // 2. Meta WhatsApp Cloud API
  const metaToken = process.env.META_WHATSAPP_TOKEN;
  const metaPhoneId = process.env.META_WHATSAPP_PHONE_ID;

  if (metaToken && metaPhoneId) {
    try {
      const resp = await fetch(
        `https://graph.facebook.com/v21.0/${metaPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: "text",
            text: { preview_url: false, body: options.message },
          }),
        }
      );
      if (resp.ok) {
        return { success: true, waLink };
      }
      const errJson = await resp.json().catch(() => ({}));
      console.warn("[whatsapp] Meta API response not ok:", errJson);
    } catch (err: any) {
      console.error("[whatsapp] Meta Cloud API error:", err?.message || err);
    }
  }

  // 2. Generic HTTP / UltraMsg / Wati webhook
  const genericApiUrl = process.env.WHATSAPP_API_URL;
  const genericToken = process.env.WHATSAPP_TOKEN;

  if (genericApiUrl) {
    try {
      const resp = await fetch(genericApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(genericToken ? { Authorization: `Bearer ${genericToken}` } : {}),
        },
        body: JSON.stringify({
          token: genericToken,
          to: cleanPhone,
          phone: cleanPhone,
          body: options.message,
          message: options.message,
        }),
      });
      if (resp.ok) {
        return { success: true, waLink };
      }
    } catch (err: any) {
      console.error("[whatsapp] Generic gateway error:", err?.message || err);
    }
  }

  // Fallback: 1-Click Link is generated and ready for admin/teacher click
  return { success: true, waLink };
}
