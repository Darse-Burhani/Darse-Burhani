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

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!process.env.SMTP_USER) {
    console.error("SMTP_USER not configured - cannot send email");
    return false;
  }

  const fromEmail = process.env.SMTP_USER;
  const domain = fromEmail.split("@")[1];
  const plainText = options.text || stripHtml(options.html);

  const mailOptions = {
    from: process.env.SMTP_FROM || `Darse Burhani <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: plainText,
    headers: {
      "List-Unsubscribe": `<mailto:${fromEmail}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "Precedence": "bulk",
      "X-Mailer": "DarseBurhani/1.0",
      "X-Auto-Response-Suppress": "All",
      "Auto-Submitted": "auto-generated",
      "Feedback-ID": `hifz-report:${domain}`,
    },
  };

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
      const fallbackFrom = process.env.OUTLOOK_FROM || process.env.OUTLOOK_USER;
      await fallbackTransport.sendMail({ ...mailOptions, from: fallbackFrom });
      console.log(`Fallback SMTP succeeded for ${options.to}`);
      return true;
    } catch (fallbackError) {
      console.error(`Fallback SMTP also failed for ${options.to}:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
    }
  }

  return false;
}
