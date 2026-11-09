/**
 * Derives institutional Mailflare email for Talabat (students).
 * Rule: firstname.lastname@darseburhani.galiakot (Strictly NO middle name).
 */
export function formatTalabatEmail(
  firstName?: string | null,
  lastName?: string | null,
  fallbackEmail?: string | null
): string {
  const fn = (firstName || "")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const rawLast = (lastName || "").trim();
  const lastConnectorIdx = Math.max(
    rawLast.toLowerCase().lastIndexOf(" bhai "),
    rawLast.toLowerCase().lastIndexOf(" bh "),
    rawLast.toLowerCase().lastIndexOf(" ben ")
  );

  let surnameRaw = lastConnectorIdx !== -1 ? rawLast.slice(lastConnectorIdx + 6).trim() : rawLast;
  if (/^bhai\s+/i.test(surnameRaw)) surnameRaw = surnameRaw.replace(/^bhai\s+/i, "").trim();
  surnameRaw = surnameRaw.replace(/\b(bhai|bh|ben|mulla|shaikh|shk|sheikh|janab)\b/gi, "").trim();

  const tokens = surnameRaw.split(/\s+/).filter(Boolean);
  let ln = tokens.join("").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!ln) {
    const allTokens = rawLast.split(/\s+/).filter(Boolean);
    ln = allTokens.length > 0 ? allTokens[allTokens.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  }

  // Fallback to legacy email if still missing
  if ((!fn || !ln) && fallbackEmail && fallbackEmail.includes("@")) {
    const parts = fallbackEmail.split("@")[0].split(".").filter(Boolean);
    const f = fn || (parts.length > 0 ? parts[0].toLowerCase().replace(/[^a-z0-9]/g, "") : "");
    const l = ln || (parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "") : "");
    if (f && l) return `${f}.${l}@darseburhani.galiakot`;
  }

  if (fn && ln) {
    return `${fn}.${ln}@darseburhani.galiakot`;
  }

  return fallbackEmail || "student@darseburhani.galiakot";
}

