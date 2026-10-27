/**
 * Identity aliases: person display names / enrolled IDs → canonical employee number (ITS).
 *
 * 1. Mustafa Tailor (ITS 40444603 - Faculty):
 *    - Device terminals enroll as "Mustafa Bhai Moiz Bhai Manpur" or "Mustafa Tailor"
 *
 * 2. Mulla Murtaza bhai Shaikh Abbas bhai Hamid (ITS 30489490 - Faculty):
 *    - Physical terminal enrolls under employeeNo: "2"
 *    - Display name on terminal: "M Murtaza Bhai Shk Abbas Bhai Hamid"
 *    - Must resolve "2" and all variant names to canonical ITS 30489490
 *
 * 3. Murtaza bhai Abbas bhai Chhatariya (ITS 30150861 - Student / Talabat):
 *    - Physical terminal 192.168.0.4 was enrolled with typo employeeNo: "30450861"
 *    - Display name on terminal: "30150861" (or "Murtaza bhai Abbas bhai Chhatariya")
 *    - Must resolve "30450861" and name "30150861" to canonical ITS 30150861
 */
export const MUSTAFA_TAILOR_ITS = "40444603";
export const MUSTAFA_TAILOR_PHOTO_URL = "/avatars/mustafa-tailor.jpg";

export const MURTAZA_HAMID_ITS = "30489490";
export const MURTAZA_HAMID_PHOTO_URL = "/uploads/teachers/30489490.png";

export const MURTAZA_CHHATARIYA_ITS = "30150861";
export const MURTAZA_CHHATARIYA_PHOTO_URL = "/uploads/Talabat/30150861.jpg";

/**
 * Returns the canonical ITS for a device-enrolled display name or hardware ID
 * if it belongs to an aliased identity, otherwise null.
 */
export function resolveAliasIts(
  nameOrRef?: string | null,
  secondaryRef?: string | null,
): string | null {
  const primary = String(nameOrRef ?? "").trim();
  const secondary = String(secondaryRef ?? "").trim();
  const combined = `${primary} ${secondary}`.trim();

  if (!combined) return null;

  // Direct ID check
  if (primary === "2" || secondary === "2") {
    return MURTAZA_HAMID_ITS;
  }
  if (primary === "30450861" || secondary === "30450861") {
    return MURTAZA_CHHATARIYA_ITS;
  }
  if (primary === MUSTAFA_TAILOR_ITS || secondary === MUSTAFA_TAILOR_ITS) {
    return MUSTAFA_TAILOR_ITS;
  }
  if (primary === MURTAZA_HAMID_ITS || secondary === MURTAZA_HAMID_ITS) {
    return MURTAZA_HAMID_ITS;
  }
  if (primary === MURTAZA_CHHATARIYA_ITS || secondary === MURTAZA_CHHATARIYA_ITS) {
    return MURTAZA_CHHATARIYA_ITS;
  }

  // Mustafa Tailor (40444603)
  if (/manpur/i.test(combined) || /mustafa\s*tailor/i.test(combined)) {
    return MUSTAFA_TAILOR_ITS;
  }

  // Mulla Murtaza Hamid (30489490)
  // (Notice: distinct from Mulla Murtaza Mohammadhussain Hamid who is 50432737)
  if (
    /shk\s*abbas.*hamid/i.test(combined) ||
    /shaikh\s*abbas.*hamid/i.test(combined) ||
    /m.*murtaza.*sh.*abbas/i.test(combined)
  ) {
    return MURTAZA_HAMID_ITS;
  }

  // Murtaza Chhatariya (30150861)
  if (/chhatariya/i.test(combined)) {
    return MURTAZA_CHHATARIYA_ITS;
  }

  // Shaikh Murtaza Jamali (30387984 - enrolled on device as 3038798)
  if (primary === "3038798" || secondary === "3038798" || /murtaza.*jamali/i.test(combined)) {
    return "30387984";
  }

  // If secondary is a valid 8-digit ITS (e.g. name is "30150861")
  if (/^\d{8}$/.test(secondary)) {
    return secondary;
  }
  if (/^\d{8}$/.test(primary)) {
    return primary;
  }

  return null;
}
