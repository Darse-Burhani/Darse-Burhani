/**
 * Email Noise & Automated Vendor Suppression Filter for Mailflare
 * Prevents promotional emails, cloud provider onboarding (Render, Google Gemini, Vercel, etc.),
 * social media notifications (Facebook, Meta), newsletter drips, and automated bots
 * from polluting institutional student support queues.
 */

export const KNOWN_AUTOMATED_DOMAINS = [
  "render.com",
  "facebookmail.com",
  "uptimerobot.com",
  "github.com",
  "cloudflare.com",
  "vercel.com",
  "resend.com",
  "sendgrid.net",
  "mailgun.org",
  "postmarkapp.com",
  "amazonaws.com",
  "supabase.co",
  "supabase.com",
  "stripe.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "meta.com",
  "notifications.google.com",
  "accounts.google.com",
];

export const KNOWN_AUTOMATED_USERNAMES = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "notifications",
  "notification",
  "alerts",
  "alert",
  "mailer-daemon",
  "mailer",
  "bounce",
  "bounces",
  "postmaster",
  "newsletter",
  "newsletters",
  "promo",
  "promotions",
  "marketing",
  "campaign",
  "updates",
  "digest",
  "billing",
  "invitations",
  "welcome",
];

export function isSuppressedAutomatedEmail(
  from: string | undefined | null,
  subject: string = "",
  headers: Record<string, any> = {}
): boolean {
  if (!from) return false;

  const cleanSender = String(from).trim().toLowerCase();
  const senderEmail = cleanSender.includes("<")
    ? cleanSender.match(/<([^>]+)>/)?.[1] || cleanSender
    : cleanSender;

  const [userPart = "", domainPart = ""] = senderEmail.split("@");

  // 1. Check known automated prefixes / usernames
  if (
    KNOWN_AUTOMATED_USERNAMES.some(
      (u) =>
        userPart === u ||
        userPart.startsWith(`${u}-`) ||
        userPart.endsWith(`-${u}`) ||
        userPart.includes("noreply") ||
        userPart.includes("no-reply")
    )
  ) {
    return true;
  }

  // 2. Check known cloud vendors, hosting providers, monitoring services & social media
  if (
    KNOWN_AUTOMATED_DOMAINS.some(
      (d) => domainPart === d || domainPart.endsWith(`.${d}`)
    )
  ) {
    return true;
  }

  // Specific Google automation / Gemini welcome addresses
  if (
    senderEmail.includes("google-gemini") ||
    senderEmail.includes("google-workspace-noreply") ||
    (domainPart === "google.com" && (userPart.includes("noreply") || userPart.includes("no-reply")))
  ) {
    return true;
  }

  // Render vendor onboarding or newsletter (e.g. hello@render.com)
  if (domainPart.includes("render.com")) {
    return true;
  }

  // 3. Inspect automated headers (Standard RFC 3834 & email marketing specs)
  if (headers && typeof headers === "object") {
    const normHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (typeof k === "string") {
        normHeaders[k.toLowerCase()] = String(v).toLowerCase();
      }
    }

    // Auto-Submitted: auto-generated | auto-replied
    const autoSubmitted = normHeaders["auto-submitted"];
    if (autoSubmitted && autoSubmitted !== "no") {
      return true;
    }

    // Precedence: bulk | junk | list
    const precedence = normHeaders["precedence"];
    if (precedence && ["bulk", "junk", "list"].includes(precedence)) {
      return true;
    }

    // List-Unsubscribe header signifies bulk/marketing campaign
    if (normHeaders["list-unsubscribe"]) {
      return true;
    }

    // X-Autoreply
    if (normHeaders["x-autoreply"] === "yes") {
      return true;
    }
  }

  // 4. Automated / vendor marketing subject patterns
  const lowerSubject = subject.toLowerCase().trim();
  const automatedSubjectKeywords = [
    "welcome to gemini",
    "managing your data alongside your services",
    "how to enhance performance with automated processes",
    "how to enhance app security and performance",
    "ends tonight: ",
    "welcome to facebook",
    "confirm your business email",
    "did you just add a phone number",
    "unsubscribe",
  ];

  if (automatedSubjectKeywords.some((k) => lowerSubject.includes(k))) {
    return true;
  }

  return false;
}

