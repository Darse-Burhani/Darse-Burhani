import nodemailer, { Transporter } from "nodemailer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface BadalSmtpConfig {
  email: string;
  name?: string;
  pass?: string;
  host?: string;
  port?: number;
  secure?: boolean;
}

export interface BadalSmtpStatus {
  configured: boolean;
  activeMailbox: string;
  senderName: string;
  host: string;
  port: number;
  hasPassword: boolean;
  isCustomDbConfig: boolean;
  fallbackAvailable: boolean;
}

function cleanSecret(val?: string | null): string {
  if (!val) return "";
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Strip spaces (critical for Google 16-char app passwords copied as 'abcd efgh ijkl mnop')
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
 * Checks whether an email address is valid and deliverable
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

/**
 * Get active Badal SMTP configuration from DB SystemSetting or process.env
 */
export async function getBadalSmtpConfig(): Promise<{
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
  fromName: string;
  fromHeader: string;
  isCustomDbConfig: boolean;
}> {
  // 1. Try DB SystemSetting "badal_smtp_config"
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "badal_smtp_config" },
    });
    if (setting && setting.value && typeof setting.value === "object") {
      const v = setting.value as any;
      const user = cleanEmail(v.email);
      const pass = cleanSecret(v.pass);
      const host = v.host || "smtp.gmail.com";
      const port = Number(v.port) || 587;
      const secure = Boolean(v.secure);
      const fromName = v.name || "Darse Burhani — Badal Desk";

      if (user && pass && !isPlaceholderSecret(pass)) {
        return {
          user,
          pass,
          host,
          port,
          secure,
          fromName,
          fromHeader: `"${fromName}" <${user}>`,
          isCustomDbConfig: true,
        };
      }
    }
  } catch (err) {
    console.warn("[badal-email] Failed to read badal_smtp_config from DB:", err);
  }

  // 2. Try environment variables for dedicated Badal SMTP
  const badalEnvUser = cleanEmail(process.env.BADAL_SMTP_USER || process.env.BADAL_ADMIN_EMAIL);
  const badalEnvPass = cleanSecret(process.env.BADAL_SMTP_PASS);
  if (badalEnvUser && badalEnvPass && !isPlaceholderSecret(badalEnvPass)) {
    const fromName = process.env.BADAL_SMTP_NAME || "Darse Burhani — Badal Desk";
    return {
      user: badalEnvUser,
      pass: badalEnvPass,
      host: process.env.BADAL_SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.BADAL_SMTP_PORT) || 587,
      secure: process.env.BADAL_SMTP_SECURE === "true",
      fromName,
      fromHeader: process.env.BADAL_SMTP_FROM || `"${fromName}" <${badalEnvUser}>`,
      isCustomDbConfig: false,
    };
  }

  // 3. Fallback to LEAVE_SMTP credentials
  const leaveEnvUser = cleanEmail(process.env.LEAVE_SMTP_USER || process.env.LEAVE_ADMIN_EMAIL);
  const leaveEnvPass = cleanSecret(process.env.LEAVE_SMTP_PASS);
  if (leaveEnvUser && leaveEnvPass && !isPlaceholderSecret(leaveEnvPass)) {
    const fromName = "Darse Burhani — Badal Substitution";
    return {
      user: leaveEnvUser,
      pass: leaveEnvPass,
      host: process.env.LEAVE_SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.LEAVE_SMTP_PORT) || 587,
      secure: process.env.LEAVE_SMTP_SECURE === "true",
      fromName,
      fromHeader: `"${fromName}" <${leaveEnvUser}>`,
      isCustomDbConfig: false,
    };
  }

  // 4. Fallback to primary SMTP credentials
  const primaryUser = cleanEmail(process.env.SMTP_USER);
  const primaryPass = cleanSecret(process.env.SMTP_PASS);
  const fallbackUser = primaryUser || "support.darseburhanigaliakot@gmail.com";
  const fromName = "Darse Burhani — Badal Desk";

  return {
    user: fallbackUser,
    pass: primaryPass || "",
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    fromName,
    fromHeader: `"${fromName}" <${fallbackUser}>`,
    isCustomDbConfig: false,
  };
}

/**
 * Returns summary status of the Badal SMTP configuration
 */
export async function getBadalSmtpStatus(): Promise<BadalSmtpStatus> {
  const config = await getBadalSmtpConfig();
  const hasPass = Boolean(config.pass && !isPlaceholderSecret(config.pass));

  return {
    configured: hasPass,
    activeMailbox: config.user,
    senderName: config.fromName,
    host: config.host,
    port: config.port,
    hasPassword: hasPass,
    isCustomDbConfig: config.isCustomDbConfig,
    fallbackAvailable: Boolean(process.env.SMTP_PASS || process.env.LEAVE_SMTP_PASS),
  };
}

/**
 * Save new Badal SMTP configuration to database SystemSetting
 */
export async function saveBadalSmtpConfig(config: BadalSmtpConfig): Promise<boolean> {
  const existing = await prisma.systemSetting.findUnique({
    where: { key: "badal_smtp_config" },
  });
  const currentVal = (existing?.value as any) || {};

  const cleanUser = cleanEmail(config.email);
  const cleanPass = config.pass ? cleanSecret(config.pass) : currentVal.pass || "";

  const payload = {
    email: cleanUser,
    name: config.name || "Darse Burhani — Badal Desk",
    pass: cleanPass,
    host: config.host || "smtp.gmail.com",
    port: Number(config.port) || 587,
    secure: Boolean(config.secure),
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemSetting.upsert({
    where: { key: "badal_smtp_config" },
    create: {
      key: "badal_smtp_config",
      value: payload,
    },
    update: {
      value: payload,
    },
  });

  return true;
}

/**
 * Creates a Nodemailer Transporter using current Badal SMTP settings
 */
export async function createBadalTransporter(): Promise<{
  transporter: Transporter;
  fromHeader: string;
  user: string;
} | null> {
  const config = await getBadalSmtpConfig();
  if (!config.pass || isPlaceholderSecret(config.pass)) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: { rejectUnauthorized: false },
    timeout: 15000,
  } as any);

  return {
    transporter,
    fromHeader: config.fromHeader,
    user: config.user,
  };
}

export interface SendBadalEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  customFrom?: string;
}

/**
 * Dispatch Badal Email with complete delivery status
 */
export async function sendBadalEmailDetailed(options: SendBadalEmailOptions): Promise<{
  success: boolean;
  mailbox?: string;
  messageId?: string;
  error?: string;
}> {
  if (!isDeliverableEmail(options.to)) {
    console.warn(`[badal-email] Skipping dispatch to unroutable or placeholder email: ${options.to}`);
    return { success: false, error: `Skipped unroutable address (${options.to})` };
  }

  const transportInfo = await createBadalTransporter();
  if (!transportInfo) {
    // Fall back to primary email engine (Google Apps Script HTTPS relay / Primary SMTP)
    try {
      const { sendEmail } = await import("./email");
      const ok = await sendEmail({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        from: options.customFrom,
      });
      if (ok) {
        console.log(`[badal-email] ✅ Delivered to ${options.to} via primary email relay`);
        return { success: true, mailbox: "relay", messageId: `relay_${Date.now()}` };
      }
    } catch {}
    console.warn("[badal-email] No active Badal SMTP credentials configured");
    return {
      success: false,
      error: "No active SMTP credentials configured. Please configure Badal Email in Settings or set GOOGLE_SCRIPT_EMAIL_URL in environment.",
    };
  }

  try {
    const from = options.customFrom || transportInfo.fromHeader;
    const plainText = options.text || options.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const info = await transportInfo.transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: plainText,
      headers: {
        "X-Mailer": "DarseBurhani-Badal/1.0",
        "X-Auto-Response-Suppress": "All",
        "Auto-Submitted": "auto-generated",
        Priority: "urgent",
        Importance: "high",
      },
    });

    console.log(`[badal-email] ✅ Delivered to ${options.to} via ${transportInfo.user} [id=${info.messageId}]`);
    return {
      success: true,
      mailbox: transportInfo.user,
      messageId: info.messageId,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[badal-email] ❌ Direct SMTP failed for ${options.to}:`, msg);
    // Fallback to primary email engine
    try {
      const { sendEmail } = await import("./email");
      const ok = await sendEmail({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        from: options.customFrom,
      });
      if (ok) {
        console.log(`[badal-email] ✅ Delivered to ${options.to} via primary email relay fallback`);
        return { success: true, mailbox: "relay-fallback", messageId: `relay_${Date.now()}` };
      }
    } catch {}
    return {
      success: false,
      mailbox: transportInfo.user,
      error: msg,
    };
  }
}

/**
 * Test Badal SMTP connection and optionally send a test verification email
 */
export async function testBadalSmtpConnection(testRecipient?: string): Promise<{
  ok: boolean;
  mailbox: string;
  error?: string;
  message?: string;
}> {
  const transportInfo = await createBadalTransporter();
  if (!transportInfo) {
    return {
      ok: false,
      mailbox: "",
      error: "No SMTP credentials set. Please enter email and 16-character App Password.",
    };
  }

  try {
    await transportInfo.transporter.verify();

    if (testRecipient && isDeliverableEmail(testRecipient)) {
      await transportInfo.transporter.sendMail({
        from: transportInfo.fromHeader,
        to: testRecipient,
        subject: "✅ Test Connection: Darse Burhani Badal Email Service",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #064e3b; margin-top: 0;">Badal Email Service Verified</h2>
            <p>Afzalus Salam,</p>
            <p>This test email confirms that your dedicated Badal notification mailbox <strong>(${transportInfo.user})</strong> is properly connected and ready to notify faculty of substitute duties.</p>
            <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 13px;">
              <strong>Host:</strong> ${(transportInfo.transporter as any).options.host}<br/>
              <strong>Sender:</strong> ${transportInfo.fromHeader}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Darse Burhani Academic Administration • Galiakot</p>
          </div>
        `,
      });
    }

    return {
      ok: true,
      mailbox: transportInfo.user,
      message: `Successfully connected to SMTP as ${transportInfo.user}${testRecipient ? ` and sent test email to ${testRecipient}` : ""}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      mailbox: transportInfo.user,
      error: err?.message || "Failed to authenticate with SMTP server. Check email & App Password.",
    };
  }
}

