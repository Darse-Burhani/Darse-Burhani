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
