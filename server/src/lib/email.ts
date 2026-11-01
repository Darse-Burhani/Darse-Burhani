import nodemailer, { Transporter } from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Override the visible From header. */
  from?: string;
  /** Transactional mail (leave notices) should not carry bulk headers. */
  transactional?: boolean;
}

export interface SmtpConfigStatus {
  configured: boolean;
  activeMailbox: string;
  hasDedicatedLeaveCreds: boolean;
  hasPrimaryCreds: boolean;
  adminMailbox: string;
  host: string;
  port: number;
}

export interface SmtpTestResult {
  ok: boolean;
  mailbox: string;
  transportType: "dedicated_leave" | "primary" | "outlook" | "none";
  error?: string;
  message?: string;
}

function cleanSecret(val?: string | null): string {
  if (!val) return "";
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Strip all whitespace (essential for Google 16-character App Passwords copied as 'xxxx xxxx xxxx xxxx')
  return s.replace(/\s+/g, "");
}

function cleanEmail(val?: string | null): string {
  if (!val) return "";
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function isPlaceholderSecret(secret: string): boolean {
  if (!secret) return true;
  const lower = secret.toLowerCase();
  return (
    lower === "your-app-password" ||
    lower === "yourapppassword" ||
    lower === "password" ||
    lower === "changeme" ||
    lower === "placeholder" ||
    secret.length < 8
  );
}

/**
 * Checks whether an email address belongs to a routable domain.
 * Blocks synthetic seed addresses (*@darseburhani.edu) from triggering bounce emails.
 */
export function isDeliverableEmail(email?: string | null): boolean {
  if (!email) return false;
  const s = email.trim().toLowerCase();
  if (
    s.endsWith("@darseburhani.edu") ||
    s.endsWith(".edu.invalid") ||
    s.includes("example.com") ||
    s.includes("localhost") ||
    s.endsWith("@test.com")
  ) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export const LEAVE_FROM =
  process.env.LEAVE_SMTP_FROM ||
  `Darse Burhani Galiakot <${cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org"}>`;

export function getSmtpConfigStatus(): SmtpConfigStatus {
  const leaveUser = cleanEmail(process.env.LEAVE_SMTP_USER || process.env.LEAVE_ADMIN_EMAIL || "admin.galiakot@darseburhani.org");
  const leavePass = cleanSecret(process.env.LEAVE_SMTP_PASS);
  const primaryUser = cleanEmail(process.env.SMTP_USER);
  const primaryPass = cleanSecret(process.env.SMTP_PASS);

  const hasDedicated = Boolean(leavePass && !isPlaceholderSecret(leavePass));
  const hasPrimary = Boolean(primaryUser && primaryPass && !isPlaceholderSecret(primaryPass));

  return {
    configured: hasDedicated || hasPrimary,
    activeMailbox: hasDedicated ? leaveUser : primaryUser || leaveUser,
    hasDedicatedLeaveCreds: hasDedicated,
    hasPrimaryCreds: hasPrimary,
    adminMailbox: cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org",
    host: process.env.LEAVE_SMTP_HOST || process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.LEAVE_SMTP_PORT || process.env.SMTP_PORT || "587"),
  };
}

function getLeaveTransporter(): Transporter | null {
  const user = cleanEmail(process.env.LEAVE_SMTP_USER || process.env.LEAVE_ADMIN_EMAIL || "admin.galiakot@darseburhani.org");
  const pass = cleanSecret(process.env.LEAVE_SMTP_PASS);

  if (!pass || isPlaceholderSecret(pass)) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.LEAVE_SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.LEAVE_SMTP_PORT || "587"),
    secure: process.env.LEAVE_SMTP_SECURE === "true",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    timeout: 15000,
  } as any);
}

function getPrimaryTransporter(): Transporter | null {
  const user = cleanEmail(process.env.SMTP_USER);
  const pass = cleanSecret(process.env.SMTP_PASS);

  if (!user || !pass || isPlaceholderSecret(pass)) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    timeout: 15000,
  } as any);
}

function getFallbackTransporter(): Transporter | null {
  const user = cleanEmail(process.env.OUTLOOK_USER);
  const pass = cleanSecret(process.env.OUTLOOK_PASS);

  if (!user || !pass || isPlaceholderSecret(pass)) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.OUTLOOK_HOST || "smtp-mail.outlook.com",
    port: parseInt(process.env.OUTLOOK_PORT || "587"),
    secure: process.env.OUTLOOK_SECURE === "true",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    timeout: 15000,
  } as any);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMailOptions(options: SendEmailOptions, from: string, fromEmail: string) {
  const domain = fromEmail.split("@")[1] || "darseburhani.org";
  const plainText = options.text || stripHtml(options.html);
  const bulkHeaders = options.transactional
    ? {
        "X-Mailer": "DarseBurhani/1.0",
        "X-Auto-Response-Suppress": "All",
        "Auto-Submitted": "auto-generated",
      }
    : {
        "List-Unsubscribe": `<mailto:${fromEmail}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        Precedence: "bulk",
        "X-Mailer": "DarseBurhani/1.0",
        "X-Auto-Response-Suppress": "All",
        "Auto-Submitted": "auto-generated",
        "Feedback-ID": `hifz-report:${domain}`,
      };

  return {
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: plainText,
    headers: bulkHeaders,
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!isDeliverableEmail(options.to)) {
    console.warn(`[email] Skipping dispatch to unroutable or placeholder email: ${options.to}`);
    return false;
  }

  const primary = getPrimaryTransporter();
  const fallback = getFallbackTransporter();

  if (!primary && !fallback) {
    console.error("[email] No SMTP transporter configured — cannot send email");
    return false;
  }

  const fromEmail = cleanEmail(process.env.SMTP_USER) || "support.darseburhani.galiakot@gmail.com";
  const from = options.from || process.env.SMTP_FROM || `Darse Burhani <${fromEmail}>`;
  const mailOptions = buildMailOptions(options, from, fromEmail);

  if (primary) {
    try {
      await primary.sendMail(mailOptions);
      return true;
    } catch (primaryError: any) {
      console.warn(`[email] Primary SMTP failed for ${options.to}:`, primaryError?.message || primaryError);
    }
  }

  if (fallback) {
    try {
      const fallbackFrom = options.from || process.env.OUTLOOK_FROM || process.env.OUTLOOK_USER!;
      await fallback.sendMail({ ...mailOptions, from: fallbackFrom });
      console.log(`[email] Fallback SMTP succeeded for ${options.to}`);
      return true;
    } catch (fallbackError: any) {
      console.error(`[email] Fallback SMTP also failed for ${options.to}:`, fallbackError?.message || fallbackError);
    }
  }

  return false;
}

/**
 * Detailed leave email dispatch returning exact status, used for diagnostics and retry logic.
 */
export async function sendLeaveEmailDetailed(options: SendEmailOptions): Promise<{
  success: boolean;
  mailbox?: string;
  error?: string;
  messageId?: string;
}> {
  if (!isDeliverableEmail(options.to)) {
    console.warn(`[email] Skipping dispatch to unroutable or placeholder email: ${options.to}`);
    return { success: false, error: `Skipped unroutable address (${options.to})` };
  }

  const fromEmail =
    cleanEmail(process.env.LEAVE_SMTP_USER) ||
    cleanEmail(process.env.LEAVE_ADMIN_EMAIL) ||
    "admin.galiakot@darseburhani.org";
  const payload = { ...options, transactional: true };
  const fromHeader = options.from || LEAVE_FROM;
  const mailOptions = buildMailOptions(payload, fromHeader, fromEmail);

  // 1. Try dedicated Galiakot Leave Transport
  const leaveTransport = getLeaveTransporter();
  if (leaveTransport) {
    try {
      const info = await leaveTransport.sendMail(mailOptions);
      console.log(`[email] Leave email delivered to ${options.to} via dedicated leave SMTP (${fromEmail}) [id=${info.messageId}]`);
      return { success: true, mailbox: fromEmail, messageId: info.messageId };
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`[email] Dedicated leave SMTP failed for ${options.to}: ${msg}`);
      // Fall through to try primary if available
    }
  }

  // 2. Try primary transport as fallback
  const primaryTransport = getPrimaryTransporter();
  if (primaryTransport) {
    try {
      const primaryFromEmail = cleanEmail(process.env.SMTP_USER) || fromEmail;
      const primaryFrom = options.from || process.env.SMTP_FROM || `Darse Burhani Galiakot <${primaryFromEmail}>`;
      const primaryMailOptions = buildMailOptions(payload, primaryFrom, primaryFromEmail);
      const info = await primaryTransport.sendMail(primaryMailOptions);
      console.log(`[email] Leave email delivered to ${options.to} via primary SMTP (${primaryFromEmail}) [id=${info.messageId}]`);
      return { success: true, mailbox: primaryFromEmail, messageId: info.messageId };
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`[email] Primary SMTP fallback failed for ${options.to}: ${msg}`);
    }
  }

  // 3. Try outlook transport as second fallback
  const fallbackTransport = getFallbackTransporter();
  if (fallbackTransport) {
    try {
      const fallbackFrom = options.from || process.env.OUTLOOK_FROM || process.env.OUTLOOK_USER!;
      const info = await fallbackTransport.sendMail({ ...mailOptions, from: fallbackFrom });
      console.log(`[email] Leave email delivered to ${options.to} via fallback SMTP [id=${info.messageId}]`);
      return { success: true, mailbox: fallbackFrom, messageId: info.messageId };
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`[email] Fallback SMTP failed for ${options.to}: ${msg}`);
    }
  }

  const rawPass = process.env.LEAVE_SMTP_PASS;
  let reason: string;
  if (!rawPass || !rawPass.trim()) {
    reason = "LEAVE_SMTP_PASS is not configured in environment variables. Please add a 16-character Google App Password in Render Dashboard.";
  } else if (isPlaceholderSecret(rawPass)) {
    reason = "LEAVE_SMTP_PASS contains placeholder text ('your-app-password'). Please replace with a genuine 16-character Google App Password.";
  } else {
    reason = "SMTP authentication failed (BadCredentials). Ensure 2-Step Verification is active on Google Workspace and regenerate the 16-character App Password.";
  }

  console.warn(`[email] Leave email could not be sent to ${options.to}: ${reason}`);
  return { success: false, error: reason };
}

/**
 * Sends leave-workflow mail from the Galiakot administration mailbox.
 * Returns boolean for backwards compatibility with existing callers.
 */
export async function sendLeaveEmail(options: SendEmailOptions): Promise<boolean> {
  const result = await sendLeaveEmailDetailed(options);
  return result.success;
}

/**
 * Verifies live SMTP connectivity without sending a message.
 */
export async function testLeaveSmtpConnection(): Promise<SmtpTestResult> {
  const leaveTransport = getLeaveTransporter();
  if (leaveTransport) {
    const user = cleanEmail(process.env.LEAVE_SMTP_USER || "admin.galiakot@darseburhani.org");
    try {
      await leaveTransport.verify();
      return {
        ok: true,
        mailbox: user,
        transportType: "dedicated_leave",
        message: `Connected successfully to Google SMTP as ${user}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        mailbox: user,
        transportType: "dedicated_leave",
        error: err?.message || String(err),
      };
    }
  }

  const primaryTransport = getPrimaryTransporter();
  if (primaryTransport) {
    const user = cleanEmail(process.env.SMTP_USER || "");
    try {
      await primaryTransport.verify();
      return {
        ok: true,
        mailbox: user,
        transportType: "primary",
        message: `Connected successfully to Primary SMTP as ${user}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        mailbox: user,
        transportType: "primary",
        error: err?.message || String(err),
      };
    }
  }

  const fallbackTransport = getFallbackTransporter();
  if (fallbackTransport) {
    const user = cleanEmail(process.env.OUTLOOK_USER || "");
    try {
      await fallbackTransport.verify();
      return {
        ok: true,
        mailbox: user,
        transportType: "outlook",
        message: `Connected successfully to Outlook SMTP as ${user}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        mailbox: user,
        transportType: "outlook",
        error: err?.message || String(err),
      };
    }
  }

  return {
    ok: false,
    mailbox: cleanEmail(process.env.LEAVE_ADMIN_EMAIL || "admin.galiakot@darseburhani.org"),
    transportType: "none",
    error: "No SMTP credentials configured. Set LEAVE_SMTP_PASS in Render Environment Variables with your 16-character Google App Password.",
  };
}

/**
 * Sends a real test email to verify end-to-end delivery into the inbox.
 */
export async function sendTestLeaveEmail(targetEmail?: string): Promise<{
  success: boolean;
  to: string;
  mailbox?: string;
  messageId?: string;
  error?: string;
}> {
  const to = cleanEmail(targetEmail) || cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org";
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
    <tr>
      <td style="background:linear-gradient(135deg,#064e3b 0%,#0f766e 100%);padding:28px 32px;color:#ffffff;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a7f3d0;font-weight:700;">Darse Burhani — Mahad al Zahra, Galiakot</div>
        <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;">Leave Notification Service · Test OK</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
          This is a verification email from your <strong>Darse Burhani Leave Management System</strong> confirming that automated email delivery to <strong>${to}</strong> is functioning properly.
        </p>
        <div style="background:#f1f5f9;border-left:4px solid #10b981;border-radius:6px;padding:14px 16px;margin:16px 0;font-size:13px;color:#334155;">
          <div><strong>Timestamp (IST):</strong> ${now}</div>
          <div><strong>Recipient:</strong> ${to}</div>
          <div><strong>SMTP Service:</strong> Google Workspace (smtp.gmail.com:587)</div>
        </div>
        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
          All forthcoming leave applications submitted by parents will automatically deliver here with one-click approval and WhatsApp communication links.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const res = await sendLeaveEmailDetailed({
    to,
    subject: `[Test] Darse Burhani Leave Notification Test · ${now}`,
    html,
  });

  return {
    success: res.success,
    to,
    mailbox: res.mailbox,
    messageId: res.messageId,
    error: res.error,
  };
}
