/**
 * Identity aliases: person display names → canonical employee number (ITS).
 *
 * Device terminals may report an enrolled person by NAME instead of a numeric
 * employeeNo. The official Galiakot kgs staff list identifies this teacher as
 * "Mustafa bhai Moiz bhai Manpurwala" — the same person the terminal enrolls
 * as "Mustafa Bhai Moiz Bhai Manpur" and the app displays as "Mustafa Tailor"
 * (ITS 40444603). Every Name variant must resolve to that ITS so attendance
 * always lands on one profile.
 */
export const MUSTAFA_TAILOR_ITS = "40444603";

/**
 * Official staff photo, extracted from the Galiakot kgs List (KGS DETAILS
 * row 43 — "Mustafa bhai Moiz bhai Manpurwala", ITS 40444603). Served by the
 * client as a static asset and used as the terminal face-enrollment source.
 */
export const MUSTAFA_TAILOR_PHOTO_URL = "/avatars/mustafa-tailor.jpg";

const NAME_ALIAS_PATTERNS: RegExp[] = [/manpur/i, /mustafa\s*tailor/i];

/**
 * Returns the canonical ITS for a device-enrolled display name if it belongs
 * to an aliased identity, otherwise null.
 */
export function resolveAliasIts(nameOrRef: string | null | undefined): string | null {
  const s = String(nameOrRef ?? "").trim();
  if (!s) return null;
  for (const pattern of NAME_ALIAS_PATTERNS) {
    if (pattern.test(s)) return MUSTAFA_TAILOR_ITS;
  }
  return null;
}
