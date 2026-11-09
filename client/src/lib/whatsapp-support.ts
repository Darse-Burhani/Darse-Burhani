/**
 * WhatsApp Support Message Formatter for Darse Burhani
 * Generates structured, high-end Fatimi institutional messages with proper typography,
 * borders, emojis, and references for official communication.
 */

export const OFFICIAL_IT_SUPPORT_PHONE = "918955199220";
export const OFFICIAL_IT_SUPPORT_PHONE_DISPLAY = "+91 89551 99220";
export const OFFICIAL_IT_SUPPORT_EMAIL = "support@darseburhani-galiakot.org";

/**
 * Clean phone numbers to standard 91XXXXXXXXXX format
 */
export function formatPhoneForWhatsApp(phone?: string | null): string {
  if (!phone) return OFFICIAL_IT_SUPPORT_PHONE;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits.length >= 10 ? digits : OFFICIAL_IT_SUPPORT_PHONE;
}

/**
 * 1. Admin to Student/Parent: Official Response WhatsApp Layout
 */
export function generateAdminReplyWhatsAppMessage(params: {
  ticketId: string;
  studentName: string;
  studentIts?: string;
  grade?: string;
  subject: string;
  replyText?: string;
  adminName?: string;
}): string {
  const {
    ticketId,
    studentName,
    studentIts = "N/A",
    grade = "Talabat",
    subject,
    replyText = "",
    adminName = "IT Administration",
  } = params;

  return [
    `*DARSE BURHANI GALIAKOT*`,
    `🏛️ *Idarah IT & Communications Support Desk*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *Ticket Ref:* #${ticketId}`,
    `👤 *Student:* ${studentName}`,
    `🆔 *ITS:* ${studentIts} | *Class:* ${grade}`,
    `📌 *Subject:* ${subject}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Afzalus Salam *${studentName}*,`,
    ``,
    replyText.trim()
      ? replyText.trim()
      : `This is an official communication regarding your support ticket #${ticketId}. Our technical team is reviewing your request on the institutional network.`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 *Maktab IT Support Lab (Room 102)*`,
    `📞 *Desk Helpline:* ${OFFICIAL_IT_SUPPORT_PHONE_DISPLAY}`,
    `✉️ *Desk Email:* ${OFFICIAL_IT_SUPPORT_EMAIL}`,
    `🌐 *Talabat Portal:* https://darseburhani-galiakot.org/talabat/support`,
    `_Sent by ${adminName} &middot; Darse Burhani Galiakot_`,
  ].join("\n");
}

/**
 * 2. Student to IT Helpdesk: New Inquiry WhatsApp Layout
 */
export function generateStudentInquiryWhatsAppMessage(params: {
  studentName: string;
  studentIts: string;
  grade?: string;
  section?: string;
  institutionalEmail?: string;
  inquiryText?: string;
  ticketId?: string;
}): string {
  const {
    studentName,
    studentIts,
    grade = "",
    section = "",
    institutionalEmail = "",
    inquiryText = "",
    ticketId,
  } = params;

  const classDisplay = grade ? `Grade ${grade}${section || ""}` : "Student";

  return [
    `*DARSE BURHANI — STUDENT IT HELPDESK*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...(ticketId ? [`📋 *Ticket Inquiry:* #${ticketId}`] : []),
    `👤 *Student:* ${studentName}`,
    `🆔 *ITS:* ${studentIts}`,
    `🏫 *Class:* ${classDisplay}`,
    ...(institutionalEmail ? [`📧 *Email:* ${institutionalEmail}`] : []),
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Afzalus Salam IT Administration,`,
    ``,
    inquiryText.trim()
      ? inquiryText.trim()
      : `I need technical assistance regarding my student account / portal access. Please review my details above.`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_Dispatched via Talabat Student Portal Helpdesk_`,
  ].join("\n");
}

/**
 * Generate full wa.me deep link URL
 */
export function getWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

