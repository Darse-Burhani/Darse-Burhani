import nodemailer from "nodemailer";

// Primary transporter (Gmail)
const primaryTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: true },
  timeout: 15000,
} as any);

// Fallback transporter (Outlook) — only created if env vars present
const fallbackTransport = process.env.OUTLOOK_USER
  ? nodemailer.createTransport({
      host: process.env.OUTLOOK_HOST || "smtp-mail.outlook.com",
      port: parseInt(process.env.OUTLOOK_PORT || "587"),
      secure: process.env.OUTLOOK_SECURE === "true",
      auth: {
        user: process.env.OUTLOOK_USER,
        pass: process.env.OUTLOOK_PASS,
      },
      tls: { rejectUnauthorized: true },
      timeout: 15000,
    } as any)
  : null;

// Dedicated Galiakot administration mailbox for the leave workflow.
// Created only when credentials are configured; otherwise leave mail falls
// back to the primary SMTP transport (with the same visible From address).
const leaveTransport =
  process.env.LEAVE_SMTP_USER && process.env.LEAVE_SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.LEAVE_SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.LEAVE_SMTP_PORT || "587"),
        secure: process.env.LEAVE_SMTP_SECURE === "true",
        auth: {
          user: process.env.LEAVE_SMTP_USER,
          pass: process.env.LEAVE_SMTP_PASS,
        },
        tls: { rejectUnauthorized: true },
        timeout: 15000,
      } as any)
    : null;

export const LEAVE_FROM =
  process.env.LEAVE_SMTP_FROM ||
  `Darse Burhani Galiakot <${process.env.LEAVE_ADMIN_EMAIL || "admin.galiakot@darseburhani.org"}>`;

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
  if (!process.env.SMTP_USER) {
    console.error("SMTP_USER not configured - cannot send email");
    return false;
  }

  const fromEmail = process.env.SMTP_USER;
  const from = options.from || process.env.SMTP_FROM || `Darse Burhani <${fromEmail}>`;
  const mailOptions = buildMailOptions(options, from, fromEmail);

  // Try primary (Gmail)
  try {
    await primaryTransport.sendMail(mailOptions);
    return true;
  } catch (primaryError) {
    console.warn(`Primary SMTP failed for ${options.to}:`, primaryError instanceof Error ? primaryError.message : primaryError);
  }

  // Try fallback (Outlook) if configured
  if (fallbackTransport) {
    try {
      const fallbackFrom = options.from || process.env.OUTLOOK_FROM || process.env.OUTLOOK_USER;
      await fallbackTransport.sendMail({ ...mailOptions, from: fallbackFrom });
      console.log(`Fallback SMTP succeeded for ${options.to}`);
      return true;
    } catch (fallbackError) {
      console.error(`Fallback SMTP also failed for ${options.to}:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
    }
  }

  return false;
}

/**
 * Sends leave-workflow mail from the Galiakot administration mailbox.
 * Falls back to the standard transport when dedicated credentials are absent.
 */
export async function sendLeaveEmail(options: SendEmailOptions): Promise<boolean> {
  const fromEmail =
    process.env.LEAVE_SMTP_USER ||
    process.env.LEAVE_ADMIN_EMAIL ||
    "admin.galiakot@darseburhani.org";
  const payload = { ...options, transactional: true };
  const mailOptions = buildMailOptions(payload, options.from || LEAVE_FROM, fromEmail);

  if (leaveTransport) {
    try {
      await leaveTransport.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error(
        `Leave SMTP failed for ${options.to}:`,
        error instanceof Error ? error.message : error
      );
    }
  } else {
    console.warn(
      "[email] LEAVE_SMTP_PASS is not set - sending leave mail through the primary SMTP account. " +
        "Verify that admin.galiakot@darseburhani.org is a verified alias to keep the From address."
    );
  }

  return sendEmail({ ...payload, from: options.from || LEAVE_FROM });
}
