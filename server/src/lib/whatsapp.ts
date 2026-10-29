/**
 * WhatsApp One-Way Notification Service
 * Strictly handles outbound administrative notifications (e.g. Leave Approval/Rejection).
 * Non-conversational: strictly one-way notification to parents.
 */

export interface LeaveWhatsAppParams {
  parentName?: string | null;
  studentName: string;
  className?: string | null;
  status: "APPROVED" | "REJECTED" | "APPROVED_REDUCED";
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

/**
 * Generate official, one-way administrative leave notice text
 */
export function formatLeaveWhatsAppMessage(params: LeaveWhatsAppParams): string {
  const pName = params.parentName?.trim() || "Respected Parent";
  const sName = params.studentName.trim();
  const cName = params.className ? ` (Class ${params.className})` : "";
  const statusLabel =
    params.status === "APPROVED"
      ? "✅ APPROVED"
      : params.status === "APPROVED_REDUCED"
      ? "⚠️ APPROVED (REDUCED DAYS)"
      : "❌ REJECTED";

  const periodStr =
    params.startDate === params.endDate
      ? params.startDate
      : `${params.startDate} to ${params.endDate}`;

  const daysStr =
    params.approvedDays !== undefined
      ? `${params.approvedDays} ${params.approvedDays === 1 ? "day" : "days"}`
      : params.requestedDays
      ? `${params.requestedDays} ${params.requestedDays === 1 ? "day" : "days"}`
      : "As requested";

  const remarks = params.reviewerNotes?.trim() || (params.status === "REJECTED" ? "Decision recorded by administration." : "Approved by administration.");
  const authority = params.reviewerName?.trim() || "Administration Desk";

  return `*IDARAH DARSE BURHANI • MAHAD AL-ZAHRA*
_Academic Administration Desk • Galiakot_

Afzalus Salam Janab ${pName},

The leave application for talib *${sName}*${cName} has been *${statusLabel}*.

📋 *Leave Decision Details:*
• *Application Status:* ${statusLabel}
• *Leave Category:* ${params.leaveType}
• *Sanctioned Period:* ${periodStr}
• *Granted Days:* ${daysStr}
• *Administrative Remarks:* ${remarks}
• *Sanctioned By:* ${authority}

----------------------------------------
_⚠️ NOTICE: This is an automated one-way administrative notification. Incoming replies to this number are not monitored. For queries, contact support.darseburhanigaliakot@gmail.com or call +91 2964 282222._`;
}

/**
 * Generate direct 1-click wa.me URL
 */
export function generateWhatsAppLink(rawPhone: string, message: string): string | null {
  const cleanPhone = formatWhatsAppPhone(rawPhone);
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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

  // 1. Meta WhatsApp Cloud API
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
