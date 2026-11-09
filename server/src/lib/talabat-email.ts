/**
 * Talabat (Student) Institutional Email & Mailflare Security Module
 * 
 * Rules:
 * 1. Email format: firstname.lastname@darseburhani.galiakot
 *    - Strictly NO middle name (e.g. father's name "Aliasgar" is stripped).
 *    - Example: Abdeali bhai Aliasgar bhai Calcuttawala -> abdeali.calcuttawala@darseburhani.galiakot
 * 2. Closed Institutional Network (Walled Garden):
 *    - Talabat receive notifications and can chat/message internally within the institution.
 *    - Strictly blocked from dispatching or receiving to outside public providers (Gmail, Yahoo, Outlook, etc.).
 */

export const TALABAT_MAIL_DOMAIN = "darseburhani.galiakot";
export const TALABAT_FQDN_DOMAIN = "darseburhani-galiakot.org";

export const FORBIDDEN_PUBLIC_DOMAINS = [
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
  "yandex.com",
];

/**
 * Extracts first name and family surname (strictly excluding father's / middle name).
 */
export function extractStudentNameParts(
  firstName?: string | null,
  lastName?: string | null,
  fallbackEmail?: string | null
): {
  firstName: string;
  lastName: string;
  username: string;
  institutionalEmail: string;
  webmailAlias: string;
} {
  // 1. First name (single word)
  let fn = (firstName || "")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  // 2. Surname / Last name (strictly no middle name)
  let rawLast = (lastName || "").trim();

  // Find index of last "bhai", "bh", or "ben" to separate father's name from surname
  const lastConnectorIdx = Math.max(
    rawLast.toLowerCase().lastIndexOf(" bhai "),
    rawLast.toLowerCase().lastIndexOf(" bh "),
    rawLast.toLowerCase().lastIndexOf(" ben ")
  );

  let surnameRaw = lastConnectorIdx !== -1 ? rawLast.slice(lastConnectorIdx + 6).trim() : rawLast;

  // Clean leading "bhai " if present
  if (/^bhai\s+/i.test(surnameRaw)) {
    surnameRaw = surnameRaw.replace(/^bhai\s+/i, "").trim();
  }

  // Strip any remaining honorific tags
  surnameRaw = surnameRaw.replace(/\b(bhai|bh|ben|mulla|shaikh|shk|sheikh|janab)\b/gi, "").trim();

  const tokens = surnameRaw.split(/\s+/).filter(Boolean);
  let ln = tokens.join("").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!ln) {
    const allTokens = rawLast.split(/\s+/).filter(Boolean);
    ln = allTokens.length > 0 ? allTokens[allTokens.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  }

  // Fallback to legacy email if still missing parts (e.g. abdeali.aliasgar.calcuttawala@...)
  if ((!fn || !ln) && fallbackEmail && fallbackEmail.includes("@")) {
    const parts = fallbackEmail.split("@")[0].split(".").filter(Boolean);
    if (!fn && parts.length > 0) fn = parts[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!ln && parts.length > 1) {
      // parts[0] is first name, parts[parts.length - 1] is surname (omits middle name parts)
      ln = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");
    }
  }

  fn = fn || "student";
  ln = ln || "talib";

  const username = `${fn}.${ln}`;
  const institutionalEmail = `${username}@${TALABAT_MAIL_DOMAIN}`;
  const webmailAlias = `${username}@${TALABAT_FQDN_DOMAIN}`;

  return {
    firstName: fn,
    lastName: ln,
    username,
    institutionalEmail,
    webmailAlias,
  };
}

/**
 * Validates whether an email recipient is permitted for Talabat student communication.
 * Blocks all external consumer webmail providers (Gmail, Yahoo, Outlook, etc.).
 */
export function validateTalabatOutboundEmail(targetEmail: string): {
  allowed: boolean;
  domain: string;
  reason?: string;
} {
  const clean = (targetEmail || "").trim().toLowerCase();
  const domain = clean.includes("@") ? clean.split("@")[1].trim() : "";

  if (!domain) {
    return { allowed: false, domain, reason: "Invalid recipient email address format." };
  }

  // Check against forbidden public domains
  if (FORBIDDEN_PUBLIC_DOMAINS.includes(domain)) {
    return {
      allowed: false,
      domain,
      reason: `External email blocked: Talabat communications are restricted to the internal Mailflare institutional network (@${TALABAT_MAIL_DOMAIN}). Sending to external services like ${domain} is strictly prohibited for student safety.`,
    };
  }

  // Permitted internal institutional domains (Mahad al-Zahra faculty & Darse Burhani campus)
  const allowedInternalDomains = [
    "mahadalzahra.com",
    "darseburhani.com",
    "darseburhani.org",
    TALABAT_MAIL_DOMAIN,
    TALABAT_FQDN_DOMAIN,
    "darseburhani.edu",
    "darse-burhani.edu",
  ];

  const isInternal = allowedInternalDomains.some((d) => domain === d || domain.endsWith(`.${d}`));

  if (!isInternal) {
    return {
      allowed: false,
      domain,
      reason: `External email blocked: Recipient domain "@${domain}" is outside the institutional Mailflare network. Only internal campus domains are permitted.`,
    };
  }

  return { allowed: true, domain };
}

