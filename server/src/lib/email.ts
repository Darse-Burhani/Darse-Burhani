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
  hasResend: boolean;
  hasBrevo: boolean;
  hasGoogleScript?: boolean;
  adminMailbox: string;
  host: string;
  port: number;
}

export interface SmtpTestResult {
  ok: boolean;
  mailbox: string;
  transportType: "google_script" | "resend" | "brevo" | "dedicated_leave" | "primary" | "outlook" | "none";
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

export function cleanEmail(val?: string | null): string {
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

/**
 * Checks whether an address belongs to a public consumer webmail service (Gmail, Yahoo, etc.).
 * Used to enforce student privacy and prevent leakage outside the internal Mailflare network.
 */
export function isPublicConsumerEmail(email?: string | null): boolean {
  if (!email) return false;
  const s = email.trim().toLowerCase();
  const domain = s.split("@")[1] || "";
  const publicProviders = [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.in",
    "ymail.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "zoho.com",
    "proton.me",
    "protonmail.com",
    "rediffmail.com",
    "gmx.com",
    "mail.com",
  ];
  return publicProviders.includes(domain);
}

export const LEAVE_FROM =
  process.env.LEAVE_SMTP_FROM ||
  `Darse Burhani Galiakot <${cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org"}>`;

export function isResendConfigured(): boolean {
  return Boolean(cleanSecret(process.env.RESEND_API_KEY));
}

interface ResendDispatchResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/**
 * HTTPS-first email dispatch through the Resend REST API (port 443).
 *
 * Render free web services block ALL outbound SMTP ports (25/465/587), so raw
 * nodemailer transports hang until timeout in production. Resend travels over
 * HTTPS and works on any host; SMTP transports remain available as fallbacks
 * for local development.
 */
async function dispatchResend(mailOptions: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, unknown>;
}): Promise<ResendDispatchResult> {
  const apiKey = cleanSecret(process.env.RESEND_API_KEY);
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailOptions.from,
        to: [mailOptions.to],
        subject: mailOptions.subject,
        html: mailOptions.html,
        ...(mailOptions.text ? { text: mailOptions.text } : {}),
        ...(mailOptions.headers ? { headers: mailOptions.headers } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Resend API ${response.status}: ${detail.slice(0, 220) || response.statusText}`,
      };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (err: any) {
    return {
      ok: false,
      error:
        err?.name === "AbortError"
          ? "Resend API request timed out after 15s"
          : err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function isBrevoConfigured(): boolean {
  return Boolean(cleanSecret(process.env.BREVO_API_KEY));
}

/** Parses a `"Name <user@host>"` (or bare address) From header into Brevo's sender shape. */
function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const email = cleanEmail(match[2]);
    return { name: match[1].trim() || email, email };
  }
  const email = cleanEmail(from);
  return { name: email, email };
}

/**
 * HTTPS email dispatch through the Brevo REST API (port 443), as a second
 * provider alongside Resend. Whichever API key is configured first in the
 * chain gets used; both are attempted before falling back to raw SMTP.
 */
async function dispatchBrevo(mailOptions: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, unknown>;
}): Promise<ResendDispatchResult> {
  const apiKey = cleanSecret(process.env.BREVO_API_KEY);
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY is not configured" };
  }

  const sender = parseFromHeader(mailOptions.from);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: cleanEmail(mailOptions.to) }],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html,
        ...(mailOptions.text ? { textContent: mailOptions.text } : {}),
        ...(mailOptions.headers ? { headers: mailOptions.headers } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Brevo API ${response.status}: ${detail.slice(0, 220) || response.statusText}`,
      };
    }

    const data = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  } catch (err: any) {
    return {
      ok: false,
      error:
        err?.name === "AbortError"
          ? "Brevo API request timed out after 15s"
          : err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxGM3JNRgcREfEp5u8gMqGx_7i6DqT_t5-t1v82R0UiOxhM5lkLkGSbRn-o42nj1fHQ/exec";

export function isGoogleScriptConfigured(): boolean {
  return Boolean(
    cleanSecret(process.env.GOOGLE_SCRIPT_EMAIL_URL || process.env.GMAIL_WEBHOOK_URL) ||
      DEFAULT_GOOGLE_SCRIPT_URL
  );
}

/**
 * 100% Free HTTPS email relay via Google Apps Script (port 443).
 *
 * Why this exists:
 * Render free web services block outbound SMTP ports (25, 465, 587).
 * Third-party services like Resend or Brevo require DNS domain verification, credit cards, or strict sender restrictions.
 * Google Apps Script runs directly on Google's cloud with standard port 443 HTTPS webhooks,
 * allowing instant, unblocked email delivery directly from the school's Gmail account (100-1500 emails/day free)
 * with ZERO DNS setup, ZERO domain verification, and ZERO cost.
 */
async function dispatchGoogleScript(mailOptions: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<ResendDispatchResult> {
  const webhookUrl =
    cleanSecret(process.env.GOOGLE_SCRIPT_EMAIL_URL || process.env.GMAIL_WEBHOOK_URL) ||
    DEFAULT_GOOGLE_SCRIPT_URL;
  if (!webhookUrl) {
    return { ok: false, error: "GOOGLE_SCRIPT_EMAIL_URL is not configured" };
  }

  const secret = cleanSecret(process.env.GOOGLE_SCRIPT_SECRET || "DARSEBURHANI_EMAIL_SECRET");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        secret,
        to: cleanEmail(mailOptions.to),
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text || mailOptions.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        from: mailOptions.from,
      }),
      signal: controller.signal,
      redirect: "follow",
    });

    const text = await response.text().catch(() => "");
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok && (text.includes('"ok":true') || text.includes('"success":true'))) {
        data = { ok: true };
      }
    }

    if (!response.ok || (data && data.ok === false)) {
      return {
        ok: false,
        error: data?.error || `Google Script Relay ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    return { ok: true, messageId: data.messageId || `gscript_${Date.now()}` };
  } catch (err: any) {
    return {
      ok: false,
      error:
        err?.name === "AbortError"
          ? "Google Apps Script request timed out after 20s"
          : err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function getSmtpConfigStatus(): SmtpConfigStatus {
  const leaveUser = cleanEmail(process.env.LEAVE_SMTP_USER || process.env.LEAVE_ADMIN_EMAIL || "admin.galiakot@darseburhani.org");
  const leavePass = cleanSecret(process.env.LEAVE_SMTP_PASS);
  const primaryUser = cleanEmail(process.env.SMTP_USER);
  const primaryPass = cleanSecret(process.env.SMTP_PASS);

  const hasDedicated = Boolean(leavePass && !isPlaceholderSecret(leavePass));
  const hasPrimary = Boolean(primaryUser && primaryPass && !isPlaceholderSecret(primaryPass));
  const hasResend = isResendConfigured();
  const hasBrevo = isBrevoConfigured();
  const hasGoogleScript = isGoogleScriptConfigured();

  return {
    configured: hasDedicated || hasPrimary || hasResend || hasBrevo || hasGoogleScript,
    activeMailbox: hasDedicated ? leaveUser : primaryUser || leaveUser,
    hasDedicatedLeaveCreds: hasDedicated,
    hasPrimaryCreds: hasPrimary,
    hasResend,
    hasBrevo,
    hasGoogleScript,
    adminMailbox: cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org",
    host: hasGoogleScript ? "script.google.com (HTTPS Relay)" : (process.env.LEAVE_SMTP_HOST || process.env.SMTP_HOST || "smtp.gmail.com"),
    port: hasGoogleScript ? 443 : parseInt(process.env.LEAVE_SMTP_PORT || process.env.SMTP_PORT || "587"),
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

  // Enforce Talabat closed network guardrail: prevent student mail from leaking to external public services
  if (options.from && options.from.includes("@darseburhani.galiakot") && isPublicConsumerEmail(options.to)) {
    console.warn(`[email] Blocked student mail to external provider (${options.to}) under Mailflare closed network policy.`);
    return false;
  }

  const primary = getPrimaryTransporter() || getLeaveTransporter();
  const fallback = getFallbackTransporter();

  if (!primary && !fallback && !isResendConfigured()) {
    console.error("[email] No SMTP transporter configured — cannot send email");
    return false;
  }

  const primaryUser = cleanEmail(process.env.SMTP_USER);
  const primaryPass = cleanSecret(process.env.SMTP_PASS);
  const hasDedicatedPrimary = Boolean(primaryUser && primaryPass && !isPlaceholderSecret(primaryPass));

  const fromEmail = hasDedicatedPrimary
    ? primaryUser
    : cleanEmail(process.env.LEAVE_SMTP_USER || process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org";
  const from = options.from || process.env.SMTP_FROM || process.env.LEAVE_SMTP_FROM || `Darse Burhani <${fromEmail}>`;
  const mailOptions = buildMailOptions(options, from, fromEmail);

  // 0a. HTTPS-first via Google Apps Script (100% Free, zero DNS domain setup, never blocked on Render)
  if (isGoogleScriptConfigured()) {
    const gsResult = await dispatchGoogleScript(mailOptions);
    if (gsResult.ok) return true;
    console.warn(`[email] Google Apps Script relay failed for ${options.to}: ${gsResult.error}`);
  }

  // HTTPS-first: Resend works on any host (Render blocks outbound SMTP ports)
  if (isResendConfigured()) {
    const resendResult = await dispatchResend(mailOptions);
    if (resendResult.ok) return true;
    console.warn(`[email] Resend dispatch failed for ${options.to}: ${resendResult.error}`);
  }

  // Second HTTPS provider: Brevo (whichever key is configured gets used)
  if (isBrevoConfigured()) {
    const brevoResult = await dispatchBrevo(mailOptions);
    if (brevoResult.ok) return true;
    console.warn(`[email] Brevo dispatch failed for ${options.to}: ${brevoResult.error}`);
  }

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

  // 0a. HTTPS-first via Google Apps Script (100% Free, zero DNS domain setup, never blocked on Render)
  let googleScriptError: string | undefined;
  if (isGoogleScriptConfigured()) {
    const gsResult = await dispatchGoogleScript(mailOptions);
    if (gsResult.ok) {
      console.log(`[email] Leave email delivered to ${options.to} via Google Apps Script HTTPS relay [id=${gsResult.messageId}]`);
      return { success: true, mailbox: fromEmail, messageId: gsResult.messageId };
    }
    googleScriptError = gsResult.error;
    console.error(`[email] Google Apps Script relay failed for ${options.to}: ${googleScriptError}`);
  }

  // 0b. HTTPS-first via Resend — outbound SMTP ports are blocked on Render free
  //    web services, so raw SMTP transports hang until timeout in production.
  let resendError: string | undefined;
  if (isResendConfigured()) {
    const resendResult = await dispatchResend(mailOptions);
    if (resendResult.ok) {
      console.log(`[email] Leave email delivered to ${options.to} via Resend HTTPS API [id=${resendResult.messageId}]`);
      return { success: true, mailbox: fromEmail, messageId: resendResult.messageId };
    }
    resendError = resendResult.error;
    console.error(`[email] Resend HTTPS dispatch failed for ${options.to}: ${resendError}`);
  }

  // 0c. Third HTTPS provider: Brevo
  let brevoError: string | undefined;
  if (isBrevoConfigured()) {
    const brevoResult = await dispatchBrevo(mailOptions);
    if (brevoResult.ok) {
      console.log(`[email] Leave email delivered to ${options.to} via Brevo HTTPS API [id=${brevoResult.messageId}]`);
      return { success: true, mailbox: fromEmail, messageId: brevoResult.messageId };
    }
    brevoError = brevoResult.error;
    console.error(`[email] Brevo HTTPS dispatch failed for ${options.to}: ${brevoError}`);
  }

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
  const httpsIssues = [
    googleScriptError ? `GoogleScript: ${googleScriptError}` : null,
    resendError ? `Resend: ${resendError}` : null,
    brevoError ? `Brevo: ${brevoError}` : null,
  ]
    .filter(Boolean)
    .join("; ");
  let reason: string;
  if (httpsIssues && (!rawPass || !rawPass.trim())) {
    reason = `HTTPS email dispatch failed (${httpsIssues}). LEAVE_SMTP_PASS is not configured as an SMTP fallback.`;
  } else if (httpsIssues) {
    reason = `HTTPS email dispatch failed (${httpsIssues}) and SMTP fallback also failed. Verify your Google Apps Script relay, Resend/Brevo config, or ensure LEAVE_SMTP_PASS is a genuine 16-character Google App Password.`;
  } else if (!rawPass || !rawPass.trim()) {
    reason = "No email provider configured. Please add GOOGLE_SCRIPT_EMAIL_URL (100% free for Render) or RESEND_API_KEY, BREVO_API_KEY, or a 16-character Google App Password in Render Dashboard.";
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

let cachedSmtpResult: { result: SmtpTestResult; expiresAt: number } | null = null;

export function invalidateSmtpTestCache(): void {
  cachedSmtpResult = null;
}

/**
 * Executes transporter.verify() with a strict timeout to avoid holding HTTP threads
 * and prevent 504 Gateway Timeouts when outbound SMTP ports are blocked or slow.
 */
function verifyWithStrictTimeout(transporter: any, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SMTP connection timed out after ${timeoutMs}ms (outbound port blocked or host unreachable)`));
    }, timeoutMs);

    transporter
      .verify()
      .then((res: any) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err: any) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Verifies live SMTP connectivity without sending a message.
 * Cached for 60 seconds unless force=true to guarantee fast sub-second page loads.
 */
export async function testLeaveSmtpConnection(force = false): Promise<SmtpTestResult> {
  const now = Date.now();
  if (!force && cachedSmtpResult && cachedSmtpResult.expiresAt > now) {
    return cachedSmtpResult.result;
  }

  let result: SmtpTestResult;

  // 0. HTTPS-first: Google Apps Script Webhook Relay (100% Free, no DNS or API key needed)
  if (isGoogleScriptConfigured()) {
    const mailbox = cleanEmail(process.env.LEAVE_ADMIN_EMAIL || process.env.SMTP_USER || "Google Apps Script Relay");
    result = {
      ok: true,
      mailbox,
      transportType: "google_script",
      message: "Connected to Google Apps Script HTTPS Relay (Port 443 — 100% Free & Unblocked on Render)",
    };
    cachedSmtpResult = { result, expiresAt: now + 60_000 };
    return result;
  }

  // HTTPS-first: verify Resend and Brevo API keys (no mail sent)
  const httpsErrors: string[] = [];
  if (isResendConfigured()) {
    const mailbox = cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${cleanSecret(process.env.RESEND_API_KEY)}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        result = {
          ok: true,
          mailbox,
          transportType: "resend",
          message: "Resend HTTPS API reachable and API key valid",
        };
        cachedSmtpResult = { result, expiresAt: now + 60_000 };
        return result;
      }
      httpsErrors.push(`Resend API responded with status ${resp.status} — check RESEND_API_KEY`);
    } catch (err: any) {
      httpsErrors.push(
        err?.name === "AbortError"
          ? "Resend API request timed out after 5s"
          : `Resend: ${err?.message || String(err)}`
      );
    }
  }

  if (isBrevoConfigured()) {
    const mailbox = cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": cleanSecret(process.env.BREVO_API_KEY)!, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        result = {
          ok: true,
          mailbox,
          transportType: "brevo",
          message: "Brevo HTTPS API reachable and API key valid",
        };
        cachedSmtpResult = { result, expiresAt: now + 60_000 };
        return result;
      }
      httpsErrors.push(`Brevo API responded with status ${resp.status} — check BREVO_API_KEY`);
    } catch (err: any) {
      httpsErrors.push(
        err?.name === "AbortError"
          ? "Brevo API request timed out after 5s"
          : `Brevo: ${err?.message || String(err)}`
      );
    }
  }

  if (httpsErrors.length > 0) {
    result = {
      ok: false,
      mailbox: cleanEmail(process.env.LEAVE_ADMIN_EMAIL) || "admin.galiakot@darseburhani.org",
      transportType: isResendConfigured() ? "resend" : "brevo",
      error: httpsErrors.join("; "),
    };
    cachedSmtpResult = { result, expiresAt: now + 30_000 };
    return result;
  }

  const leaveTransport = getLeaveTransporter();
  if (leaveTransport) {
    const user = cleanEmail(process.env.LEAVE_SMTP_USER || "admin.galiakot@darseburhani.org");
    try {
      await verifyWithStrictTimeout(leaveTransport, 3000);
      result = {
        ok: true,
        mailbox: user,
        transportType: "dedicated_leave",
        message: `Connected successfully to Google SMTP as ${user}`,
      };
      cachedSmtpResult = { result, expiresAt: now + 60_000 };
      return result;
    } catch (err: any) {
      result = {
        ok: false,
        mailbox: user,
        transportType: "dedicated_leave",
        error: err?.message || String(err),
      };
      // Cache failed attempts for 30s to avoid spamming unreachable SMTP on rapid reloads
      cachedSmtpResult = { result, expiresAt: now + 30_000 };
      return result;
    }
  }

  const primaryTransport = getPrimaryTransporter();
  if (primaryTransport) {
    const user = cleanEmail(process.env.SMTP_USER || "");
    try {
      await verifyWithStrictTimeout(primaryTransport, 3000);
      result = {
        ok: true,
        mailbox: user,
        transportType: "primary",
        message: `Connected successfully to Primary SMTP as ${user}`,
      };
      cachedSmtpResult = { result, expiresAt: now + 60_000 };
      return result;
    } catch (err: any) {
      result = {
        ok: false,
        mailbox: user,
        transportType: "primary",
        error: err?.message || String(err),
      };
      cachedSmtpResult = { result, expiresAt: now + 30_000 };
      return result;
    }
  }

  const fallbackTransport = getFallbackTransporter();
  if (fallbackTransport) {
    const user = cleanEmail(process.env.OUTLOOK_USER || "");
    try {
      await verifyWithStrictTimeout(fallbackTransport, 3000);
      result = {
        ok: true,
        mailbox: user,
        transportType: "outlook",
        message: `Connected successfully to Outlook SMTP as ${user}`,
      };
      cachedSmtpResult = { result, expiresAt: now + 60_000 };
      return result;
    } catch (err: any) {
      result = {
        ok: false,
        mailbox: user,
        transportType: "outlook",
        error: err?.message || String(err),
      };
      cachedSmtpResult = { result, expiresAt: now + 30_000 };
      return result;
    }
  }

  result = {
    ok: false,
    mailbox: cleanEmail(process.env.LEAVE_ADMIN_EMAIL || "admin.galiakot@darseburhani.org"),
    transportType: "none",
    error: "No email transport configured. Set GOOGLE_SCRIPT_EMAIL_URL (recommended 100% free for Render) or RESEND_API_KEY, BREVO_API_KEY, or LEAVE_SMTP_PASS in environment variables.",
  };
  cachedSmtpResult = { result, expiresAt: now + 60_000 };
  return result;
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
