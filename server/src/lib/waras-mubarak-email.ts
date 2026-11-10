import fs from "fs";
import path from "path";
import prisma from "./prisma";
import {
  sendLeaveEmailDetailed,
  isDeliverableEmail,
  SendEmailOptions,
} from "./email";
import {
  gregorianToJulianDay,
  julianDayToHijri,
  hijriToJulianDay,
  julianDayToGregorian,
  HIJRI_MONTHS,
  getTodayHijri,
} from "./fatimi-calendar";

function cleanEmail(val?: string | null): string {
  if (!val) return "";
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export interface WarasMubarakStudentInfo {
  celebrantType: "STUDENT" | "FACULTY";
  studentProfileId: string; // studentProfile.id or teacherProfile.id
  teacherProfileId?: string;
  studentId: string; // ITS or employeeId
  fullName: string;
  nameAr?: string | null;
  grade?: string;
  section?: string;
  roleTitle?: string;
  department?: string;
  avatarUrl?: string | null;
  dobGregorian?: Date | null;
  dobHijri?: string | null;
  hijriDay?: number;
  hijriMonth?: number;
  hijriMonthName?: string;
  hijriYear?: number;
  studentEmail?: string | null;
  fatherEmail?: string | null;
  motherEmail?: string | null;
  linkedParentEmails?: string[];
  fatherName?: string | null;
  motherName?: string | null;
  mobile?: string | null;
  daysUntil?: number;
  birthDateStr?: string;
  isHijriMatch?: boolean;
  isGregorianMatch?: boolean;
}

export interface WarasMubarakCustomTemplate {
  salutation?: string;
  recipientName?: string;
  occasionTitle?: string;
  arabicKalam?: string;
  dawatKalam?: string;
  englishKalam?: string;
  blessingParagraph?: string;
  signOffTitle?: string;
  signOffSubtitle?: string;
  signOffLocation?: string;
}

export interface WarasMubarakEmailData {
  student: WarasMubarakStudentInfo;
  recipientType: "student" | "parent" | "test";
  recipientName?: string;
  photoCidOrDataUri?: string;
  isToday?: boolean;
  customTemplate?: WarasMubarakCustomTemplate;
}

export interface SendWarasMubarakParams {
  studentProfileId: string; // studentProfileId or teacherProfileId
  sendToStudent?: boolean;
  sendToParents?: boolean;
  customNote?: string;
  overrideRecipientEmail?: string; // For testing
  adminUserId?: string;
  customTemplate?: WarasMubarakCustomTemplate;
}

export interface WarasMubarakDeliveryReport {
  success: boolean;
  studentProfileId: string;
  studentName: string;
  its: string;
  recipientsAttempted: string[];
  recipientsDelivered: string[];
  recipientsFailed: string[];
  error?: string;
  deliveredAt: string;
}

/**
 * Parses Hijri date string formatted like D/M/YYYY or D/M or D-M-YYYY
 */
export function parseHijriDateString(str?: string | null): { day: number; month: number; year?: number } | null {
  if (!str) return null;
  const clean = str.trim();
  const tokens = clean.split(/[/.\s-]+/).map((t) => parseInt(t, 10)).filter((n) => !isNaN(n));
  if (tokens.length >= 2) {
    const day = tokens[0];
    const month = tokens[1];
    const year = tokens.length >= 3 ? tokens[2] : undefined;
    if (day >= 1 && day <= 30 && month >= 1 && month <= 12) {
      return { day, month, year };
    }
  }
  return null;
}

/**
 * Converts a Gregorian Date to its Fatimi Hijri day, month, year
 */
export function convertGregorianToHijri(date: Date): { day: number; month: number; year: number } {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const jd = gregorianToJulianDay(y, m, d);
  return julianDayToHijri(jd);
}

/**
 * Calculates the Gregorian (English) date corresponding to a celebrant's Hijri birthday
 * for the current/upcoming celebration cycle.
 */
export function getEnglishDateOfHijri(
  hijriDay?: number,
  hijriMonth?: number,
  refDate: Date = new Date()
): { dateStr: string; fullDateStr: string } | null {
  if (!hijriDay || !hijriMonth) return null;
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth();
  const refDay = refDate.getDate();
  const currentJd = gregorianToJulianDay(refYear, refMonth + 1, refDay);
  const todayHijri = julianDayToHijri(currentJd);

  // If this Hijri day/month is today, then the English date is today!
  if (hijriDay === todayHijri.day && hijriMonth === todayHijri.month) {
    const gregStr = refDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fullDateStr = refDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { dateStr: gregStr, fullDateStr };
  }

  // Check this Hijri year
  let nextJd = hijriToJulianDay(todayHijri.year, hijriMonth, hijriDay);
  if (nextJd < currentJd) {
    nextJd = hijriToJulianDay(todayHijri.year + 1, hijriMonth, hijriDay);
  }
  const greg = julianDayToGregorian(nextJd);
  const gregDate = new Date(greg.year, greg.month - 1, greg.day);
  const dateStr = gregDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fullDateStr = gregDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { dateStr, fullDateStr };
}

/**
 * Resolves local file path or data URI for student's profile photo
 */
export function resolveStudentPhoto(avatarUrl?: string | null, its?: string | null): {
  filePath?: string;
  dataUri?: string;
  webUrl?: string;
} {
  const repoRoot = process.cwd();
  const candidates: string[] = [];

  if (avatarUrl) {
    const cleanPath = avatarUrl.replace(/^\/+/, "");
    candidates.push(path.join(repoRoot, cleanPath));
    candidates.push(path.join(repoRoot, "public", cleanPath));
    candidates.push(path.join(repoRoot, "client", "public", cleanPath));
    candidates.push(path.join(repoRoot, "server", cleanPath));
  }

  if (its) {
    const cleanIts = String(its).trim();
    candidates.push(path.join(repoRoot, "public", "uploads", "Talabat", `${cleanIts}.jpg`));
    candidates.push(path.join(repoRoot, "public", "uploads", "talabat", `${cleanIts}.jpg`));
    candidates.push(path.join(repoRoot, "client", "public", "uploads", "talabat", `${cleanIts}.jpg`));
    candidates.push(path.join(repoRoot, "server", "uploads", "Talabat", `${cleanIts}.jpg`));
    candidates.push(path.join(repoRoot, "server", "uploads", "talabat", `${cleanIts}.jpg`));
    candidates.push(path.join(repoRoot, "public", "uploads", "Talabat", `${cleanIts}.png`));
    candidates.push(path.join(repoRoot, "client", "public", "uploads", "talabat", `${cleanIts}.png`));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const buffer = fs.readFileSync(candidate);
        const ext = path.extname(candidate).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
        const dataUri = `data:${ext};base64,${buffer.toString("base64")}`;
        return {
          filePath: candidate,
          dataUri,
          webUrl: avatarUrl && avatarUrl.startsWith("http") ? avatarUrl : undefined,
        };
      }
    } catch {}
  }

  return {
    webUrl: avatarUrl && avatarUrl.startsWith("http") ? avatarUrl : undefined,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the official Waras Mubarak HTML email adhering faithfully to the
 * Aljamea-tus-Saifiyah standard layout with student photo badge and Darse Burhani Galiakot styling.
 */
export function renderWarasMubarakHtml(data: WarasMubarakEmailData): string {
  const { student, photoCidOrDataUri, customTemplate } = data;
  const isFaculty = student.celebrantType === "FACULTY";
  const fullName = (customTemplate?.recipientName && customTemplate.recipientName.trim()) || `${student.fullName}`.trim();
  const classLabel = isFaculty
    ? (student.roleTitle || student.department || "Mohtaram Asaatizah")
    : (student.grade ? `Darajah ${student.grade}${student.section ? ` · ${student.section}` : ""}` : "");
  const itsLabel = student.studentId ? `ITS: ${student.studentId}` : "";
  const roleBadgeText = isFaculty ? "Mohtaram Asaatizah · Darse Burhani" : "Talib Ilm · Darse Burhani";

  const salutation = customTemplate?.salutation?.trim() || (isFaculty ? "Baad al-Salaam al-Jameel Janab Mohtaram Ustaaz" : "Baad al-Salaam al-Jameel");
  const occasionTitle = customTemplate?.occasionTitle?.trim() || "Waras Mubarak!";
  const arabicKalam = customTemplate?.arabicKalam?.trim() || "افضل ما نال العبد الامن والعافية";
  const dawatKalam = customTemplate?.dawatKalam?.trim() || "افضل ما افضل چیز کوئی بندہ نے ملی ھوئی\nیه سوں چهے که - امان آنے عافیة.";
  const dawatKalamHtml = escapeHtml(dawatKalam).replace(/\r?\n/g, "<br />");
  const englishKalam = customTemplate?.englishKalam?.trim() || "Safety and well-being are the greatest blessings one ever received.";
  
  const defaultBlessing = isFaculty
    ? "You are an esteemed faculty pillar of our institution. In light of this kalam mubarak, we pray that by the grace of Syedna al-Dai al-Ajal TUS you be blessed with the best of health, happiness, long life, and divine tawfeeq in your khidmat of taaleem and tarbiyat."
    : "You are a valued member of our esteemed institution. In light of this kalam mubarak, we pray that by the grace of Syedna al-Dai al-Ajal TUS you be blessed with the best of health and happiness and may you succeed in all your endeavors.";

  const blessingParagraphRaw = customTemplate?.blessingParagraph?.trim() || defaultBlessing;
  const blessingParagraph = blessingParagraphRaw.includes("<")
    ? blessingParagraphRaw
    : escapeHtml(blessingParagraphRaw).replace(/kalam mubarak/gi, `<em style="font-family:Georgia,serif;color:#0f2b48;">kalam mubarak</em>`);

  const signOffTitle = customTemplate?.signOffTitle?.trim() || "Maktab Masool al-Aam";
  const signOffSubtitle = customTemplate?.signOffSubtitle?.trim() || "Idarah Darse Burhani";
  const signOffLocation = customTemplate?.signOffLocation?.trim() || "Galiakot";

  const photoHtml = photoCidOrDataUri
    ? `<img src="${photoCidOrDataUri}" alt="${escapeHtml(fullName)}" width="110" height="110" style="display:block;border-radius:50%;width:110px;height:110px;object-fit:cover;border:3px solid #f3b833;box-shadow:0 6px 18px rgba(11,37,69,0.15);" />`
    : `<table role="presentation" cellspacing="0" cellpadding="0" style="width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg, #0b2545 0%, #173f6c 100%);border:3px solid #f3b833;box-shadow:0 6px 18px rgba(11,37,69,0.15);text-align:center;">
        <tr>
          <td align="center" valign="middle" style="color:#f3b833;font-family:Georgia,serif;font-size:28px;font-weight:bold;">
            ${escapeHtml(fullName.charAt(0) || "D")}
          </td>
        </tr>
      </table>`;

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(occasionTitle)} - ${escapeHtml(fullName)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .outer-card { width: 100% !important; border-radius: 8px !important; margin: 0 !important; }
      .content-padding { padding: 24px 18px !important; }
      .arabic-kalam { font-size: 21px !important; line-height: 1.6 !important; }
      .dawat-kalam { font-size: 18px !important; line-height: 1.7 !important; }
      .english-kalam { font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4efe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4efe6;padding:32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="outer-card" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#faf7f0;border:1px solid #dcd3c4;border-radius:12px;overflow:hidden;box-shadow:0 12px 36px rgba(15,23,42,0.08);">
          
          <!-- Inner Border Accent Frame -->
          <tr>
            <td style="padding:4px 4px 0 4px;background-color:#faf7f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e7ded0;border-bottom:none;border-radius:8px 8px 0 0;">
                
                <!-- Institutional Header Tag -->
                <tr>
                  <td style="padding:14px 28px 0 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="left" style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;letter-spacing:1.8px;text-transform:uppercase;color:#85754e;font-weight:700;">
                          ${escapeHtml(signOffSubtitle)} · ${escapeHtml(signOffLocation)}
                        </td>
                        <td align="right" style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;letter-spacing:1px;color:#a39268;font-weight:600;">
                          ${escapeHtml(signOffTitle)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td class="content-padding" style="padding:28px 36px 20px 36px;">
                    
                    <!-- Salutation -->
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:#1e293b;line-height:1.4;margin-bottom:6px;">
                      ${escapeHtml(salutation)}
                    </div>

                    <!-- Student Name -->
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;color:#0f172a;line-height:1.3;margin-bottom:14px;">
                      ${escapeHtml(fullName)}
                    </div>

                    <!-- Talib Profile Medallion / Photo Badge -->
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0 20px 0;">
                      <tr>
                        <td style="vertical-align:middle;padding-right:16px;">
                          ${photoHtml}
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;color:#9a2020;letter-spacing:0.5px;text-transform:uppercase;">
                            ${escapeHtml(roleBadgeText)}
                          </div>
                          <div style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#0f2b48;margin-top:2px;">
                            ${escapeHtml(fullName)}
                          </div>
                          ${classLabel ? `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#475569;margin-top:3px;">${escapeHtml(classLabel)}</div>` : ""}
                          ${itsLabel ? `<div style="font-family:'Segoe UI',monospace;font-size:11.5px;font-weight:600;color:#64748b;margin-top:2px;">${escapeHtml(itsLabel)}</div>` : ""}
                        </td>
                      </tr>
                    </table>

                    <!-- Waras Mubarak Occasion Title -->
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#a91d22;margin:18px 0 16px 0;letter-spacing:0.3px;">
                      ${escapeHtml(occasionTitle)}
                    </div>

                    <!-- Decorative Divider -->
                    <div style="height:1px;background:linear-gradient(to right, transparent, #e2d7c5, transparent);margin:16px 0 22px 0;"></div>

                    <!-- Arabic Kalam (Matching Aljamea screenshot) -->
                    <div dir="rtl" class="arabic-kalam" style="font-family:'Amiri','Traditional Arabic','Scheherazade New',serif;font-size:24px;line-height:1.6;color:#a91d22;font-weight:bold;text-align:center;margin:14px 0 10px 0;letter-spacing:0.2px;">
                      ${escapeHtml(arabicKalam)}
                    </div>

                    <!-- Lisan al-Dawat Kalam (Matching Aljamea screenshot) -->
                    <div dir="rtl" class="dawat-kalam" style="font-family:'Amiri','Traditional Arabic','Scheherazade New',serif;font-size:21px;line-height:1.8;color:#a91d22;font-weight:normal;text-align:center;margin:6px 0 18px 0;">
                      ${dawatKalamHtml}
                    </div>

                    <!-- English Kalam Translation -->
                    <div class="english-kalam" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#a91d22;text-align:center;font-weight:500;margin:12px 0 24px 0;">
                      ${escapeHtml(englishKalam)}
                    </div>

                    <!-- Decorative Divider -->
                    <div style="height:1px;background:linear-gradient(to right, transparent, #e2d7c5, transparent);margin:20px 0;"></div>

                    <!-- Institutional Blessing Paragraph -->
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#2c3338;margin:18px 0 22px 0;">
                      ${blessingParagraph}
                    </div>

                    <!-- Warmest Regards / Official Signature -->
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#1e293b;margin:28px 0 12px 0;">
                      Warmest regards,<br />
                      <strong style="color:#0f2b48;">${escapeHtml(signOffTitle)}</strong><br />
                      <span style="color:#475569;">${escapeHtml(signOffSubtitle)}</span><br />
                      <span style="color:#64748b;font-size:13.5px;">${escapeHtml(signOffLocation)}</span>
                    </div>

                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Navy Bottom Accent Bar (Faithfully matching Aljamea card bottom) -->
          <tr>
            <td style="background-color:#0b2545;padding:14px 28px;text-align:center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#cbd5e1;letter-spacing:0.5px;">
                    Sent with doa from Idarah Darse Burhani Galiakot
                  </td>
                  <td align="right" style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#f3b833;font-weight:600;">
                    admin.galiakot@darseburhani.org
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Security & Delivery Notice Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin-top:12px;">
          <tr>
            <td align="center" style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#78716c;line-height:1.6;">
              This greeting is officially dispatched by Idarah Darse Burhani Galiakot to Talabat and their esteemed parents.<br />
              Official contact: <a href="mailto:admin.galiakot@darseburhani.org" style="color:#0b2545;text-decoration:none;font-weight:600;">admin.galiakot@darseburhani.org</a>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Loads a student's or faculty's full profile including contact details and Hijri date info.
 */
export async function getStudentWarasMubarakInfo(studentProfileIdOrStudentId: string): Promise<WarasMubarakStudentInfo | null> {
  const cleanId = String(studentProfileIdOrStudentId || "").trim();

  // 1. Try finding Student Profile
  const profile = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { id: cleanId },
        { studentId: cleanId },
        { userId: cleanId },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      parentLinks: {
        include: {
          parent: {
            include: {
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (profile) {
    const linkedParentEmails: string[] = [];
    if (profile.parentLinks && Array.isArray(profile.parentLinks)) {
      for (const link of profile.parentLinks) {
        const email = link.parent?.user?.email;
        if (email && isDeliverableEmail(email) && !linkedParentEmails.includes(email)) {
          linkedParentEmails.push(email);
        }
      }
    }

    const fullName = `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim() || `Talib ${profile.studentId}`;
    const parsedHijri = parseHijriDateString(profile.dobHijri);
    const convertedHijri = profile.dobGregorian ? convertGregorianToHijri(profile.dobGregorian) : null;
    const effectiveHijri = parsedHijri || convertedHijri;

    const englishWaras = effectiveHijri ? getEnglishDateOfHijri(effectiveHijri.day, effectiveHijri.month) : null;
    const fallbackGreg = profile.dobGregorian ? new Date(profile.dobGregorian).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    const birthDateStr = englishWaras?.dateStr || fallbackGreg || "";

    return {
      celebrantType: "STUDENT",
      studentProfileId: profile.id,
      studentId: profile.studentId,
      fullName,
      nameAr: profile.nameAr,
      grade: profile.grade,
      section: profile.section,
      avatarUrl: profile.user.avatarUrl,
      dobGregorian: profile.dobGregorian,
      dobHijri: profile.dobHijri,
      hijriDay: effectiveHijri?.day,
      hijriMonth: effectiveHijri?.month,
      hijriMonthName: effectiveHijri ? HIJRI_MONTHS[effectiveHijri.month - 1]?.short : undefined,
      hijriYear: effectiveHijri?.year,
      birthDateStr,
      studentEmail: profile.user.email,
      fatherEmail: profile.fatherEmail,
      motherEmail: profile.motherEmail,
      linkedParentEmails,
      fatherName: profile.fatherName,
      motherName: profile.motherName,
    };
  }

  // 2. Try finding Teacher / Faculty Profile
  const teacher = await prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { id: cleanId },
        { its: cleanId },
        { employeeId: cleanId },
        { userId: cleanId },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (teacher) {
    const fullName = `${teacher.user.firstName || ""} ${teacher.user.lastName || ""}`.trim() || `Ustaaz ${teacher.its || teacher.employeeId}`;
    const parsedHijri = parseHijriDateString(teacher.birthDateH);
    const convertedHijri = teacher.birthDateAd ? convertGregorianToHijri(teacher.birthDateAd) : null;
    const effectiveHijri = parsedHijri || convertedHijri;
    const teacherEmail = teacher.tEmail || teacher.user.email;

    const englishWaras = effectiveHijri ? getEnglishDateOfHijri(effectiveHijri.day, effectiveHijri.month) : null;
    const fallbackGreg = teacher.birthDateAd ? new Date(teacher.birthDateAd).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    const birthDateStr = englishWaras?.dateStr || fallbackGreg || "";

    return {
      celebrantType: "FACULTY",
      studentProfileId: teacher.id,
      teacherProfileId: teacher.id,
      studentId: teacher.its || teacher.employeeId,
      fullName,
      roleTitle: teacher.roleTitle || "Asaatizah",
      department: teacher.department || "Faculty",
      avatarUrl: teacher.photoUrl || teacher.user.avatarUrl,
      dobGregorian: teacher.birthDateAd,
      dobHijri: teacher.birthDateH,
      hijriDay: effectiveHijri?.day,
      hijriMonth: effectiveHijri?.month,
      hijriMonthName: effectiveHijri ? HIJRI_MONTHS[effectiveHijri.month - 1]?.short : undefined,
      hijriYear: effectiveHijri?.year,
      birthDateStr,
      studentEmail: teacherEmail,
      mobile: teacher.mobile,
    };
  }

  return null;
}

/**
 * Dispatches the Waras Mubarak greeting email to the celebrant (Talib + Parents, or Faculty member)
 * from the institutional mailbox admin.galiakot@darseburhani.org
 */
export async function sendWarasMubarakEmail(params: SendWarasMubarakParams): Promise<WarasMubarakDeliveryReport> {
  const {
    studentProfileId,
    sendToStudent = true,
    sendToParents = true,
    overrideRecipientEmail,
    adminUserId,
  } = params;

  const celebrant = await getStudentWarasMubarakInfo(studentProfileId);
  if (!celebrant) {
    throw new Error(`Celebrant profile not found for ID/ITS: ${studentProfileId}`);
  }

  const isFaculty = celebrant.celebrantType === "FACULTY";

  // Resolve profile picture
  const photo = resolveStudentPhoto(celebrant.avatarUrl, celebrant.studentId);
  const photoCidOrDataUri = photo.dataUri || photo.webUrl;

  const report: WarasMubarakDeliveryReport = {
    success: false,
    studentProfileId: celebrant.studentProfileId,
    studentName: celebrant.fullName,
    its: celebrant.studentId,
    recipientsAttempted: [],
    recipientsDelivered: [],
    recipientsFailed: [],
    deliveredAt: new Date().toISOString(),
  };

  // Build target recipient list
  const targetEmails = new Set<string>();

  if (overrideRecipientEmail) {
    targetEmails.add(cleanEmail(overrideRecipientEmail));
  } else if (isFaculty) {
    if (celebrant.studentEmail) {
      targetEmails.add(cleanEmail(celebrant.studentEmail));
    }
  } else {
    if (sendToStudent && celebrant.studentEmail) {
      targetEmails.add(cleanEmail(celebrant.studentEmail));
    }
    if (sendToParents) {
      if (celebrant.fatherEmail) targetEmails.add(cleanEmail(celebrant.fatherEmail));
      if (celebrant.motherEmail) targetEmails.add(cleanEmail(celebrant.motherEmail));
      if (celebrant.linkedParentEmails) {
        celebrant.linkedParentEmails.forEach((e) => targetEmails.add(cleanEmail(e)));
      }
    }
  }

  const validRecipients = Array.from(targetEmails).filter((email) => isDeliverableEmail(email));
  report.recipientsAttempted = validRecipients;

  if (validRecipients.length === 0) {
    report.error = isFaculty
      ? `No valid email address found on file for faculty member ${celebrant.fullName}.`
      : "No deliverable student or parent email addresses found on file.";
    console.warn(`[waras-mubarak] ${report.error} (${celebrant.studentId})`);
    return report;
  }

  // Render the email HTML
  const emailHtml = renderWarasMubarakHtml({
    student: celebrant,
    recipientType: overrideRecipientEmail ? "test" : "student",
    photoCidOrDataUri,
    customTemplate: params.customTemplate,
  });

  const occasion = params.customTemplate?.occasionTitle?.trim() || "Waras Mubarak!";
  const recipientName = params.customTemplate?.recipientName?.trim() || celebrant.fullName;
  const subject = `${occasion} - ${recipientName} (ITS: ${celebrant.studentId})`;
  const fromHeader = `"Maktab Masool al-Aam, Idarah Darse Burhani" <admin.galiakot@darseburhani.org>`;

  for (const recipient of validRecipients) {
    try {
      const emailOptions: SendEmailOptions = {
        to: recipient,
        subject,
        html: emailHtml,
        from: fromHeader,
        transactional: true,
      };

      const result = await sendLeaveEmailDetailed(emailOptions);
      if (result.success) {
        report.recipientsDelivered.push(recipient);
      } else {
        report.recipientsFailed.push(recipient);
        if (!report.error) report.error = result.error;
      }
    } catch (err: any) {
      report.recipientsFailed.push(recipient);
      if (!report.error) report.error = err?.message || String(err);
    }
  }

  report.success = report.recipientsDelivered.length > 0;

  // Create In-App Notification
  try {
    if (isFaculty) {
      const teacherUser = await prisma.user.findFirst({
        where: { teacherProfile: { id: celebrant.studentProfileId } },
        select: { id: true },
      });
      if (teacherUser) {
        await prisma.notification.create({
          data: {
            userId: teacherUser.id,
            title: "🎉 Waras Mubarak Mohtaram Ustaaz!",
            body: `Waras Mubarak Janab ${celebrant.fullName}! Heartiest congratulations from Maktab Masool al-Aam, Idarah Darse Burhani Galiakot.`,
            type: "MILESTONE",
            priority: "HIGH",
            link: "/teacher/profile",
          },
        });
      }
    } else {
      const studentUser = await prisma.user.findFirst({
        where: { studentProfile: { id: celebrant.studentProfileId } },
        select: { id: true },
      });

      if (studentUser) {
        await prisma.notification.create({
          data: {
            userId: studentUser.id,
            title: "🎉 Waras Mubarak!",
            body: `Waras Mubarak ${celebrant.fullName}! May you be blessed with the best of health and happiness by the grace of Syedna al-Dai al-Ajal TUS.`,
            type: "MILESTONE",
            priority: "HIGH",
            link: "/talabat/profile",
          },
        });
      }

      // Also notify linked parents
      if (celebrant.linkedParentEmails && celebrant.linkedParentEmails.length > 0) {
        const parentUsers = await prisma.user.findMany({
          where: { email: { in: celebrant.linkedParentEmails } },
          select: { id: true },
        });
        for (const p of parentUsers) {
          await prisma.notification.create({
            data: {
              userId: p.id,
              title: `🎉 Waras Mubarak - ${celebrant.fullName}!`,
              body: `Waras Mubarak on the birthday of your child ${celebrant.fullName} (ITS: ${celebrant.studentId}). Heartiest congratulations from Idarah Darse Burhani Galiakot!`,
              type: "MILESTONE",
              priority: "HIGH",
              link: "/parent",
            },
          });
        }
      }
    }
  } catch (notifyErr) {
    console.warn("[waras-mubarak] Could not create in-app notification:", notifyErr);
  }

  return report;
}

/**
 * Finds students and faculty members celebrating Waras Mubarak today or upcoming
 * using precise Fatimi (Misri) Hijri calendar calculations and Gregorian DOB fallbacks.
 */
export async function findBirthdayStudents(options?: {
  targetDate?: Date;
  daysAhead?: number;
}): Promise<{
  today: WarasMubarakStudentInfo[];
  upcoming: (WarasMubarakStudentInfo & { daysUntil: number; birthDateStr: string })[];
}> {
  const refDate = options?.targetDate ? new Date(options.targetDate) : new Date();
  const daysAhead = options?.daysAhead ?? 30;

  // Reference Gregorian day & month
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth(); // 0-11
  const refDay = refDate.getDate(); // 1-31
  const refStartOfDay = new Date(refYear, refMonth, refDay, 0, 0, 0, 0);

  // Reference Hijri date
  const todayHijri = julianDayToHijri(gregorianToJulianDay(refYear, refMonth + 1, refDay));
  const currentJd = gregorianToJulianDay(refYear, refMonth + 1, refDay);

  const [studentProfiles, teacherProfiles] = await Promise.all([
    prisma.studentProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
        OR: [
          { dobGregorian: { not: null } },
          { dobHijri: { not: null } },
        ],
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { studentId: "asc" },
    }),
    prisma.teacherProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
        OR: [
          { birthDateAd: { not: null } },
          { birthDateH: { not: null } },
        ],
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { its: "asc" },
    }),
  ]);

  const todayList: WarasMubarakStudentInfo[] = [];
  const upcomingList: (WarasMubarakStudentInfo & { daysUntil: number; birthDateStr: string })[] = [];

  // Helper processor for any celebrant record
  function processCelebrant(celebrant: WarasMubarakStudentInfo) {
    const { dobGregorian, dobHijri, hijriDay, hijriMonth, hijriMonthName } = celebrant;

    let isMatchToday = false;
    let isHijriMatch = false;
    let isGregorianMatch = false;

    // 1. Check Hijri Match (Fatimi Tabular Calendar)
    if (hijriDay && hijriMonth) {
      if (hijriDay === todayHijri.day && hijriMonth === todayHijri.month) {
        isMatchToday = true;
        isHijriMatch = true;
      }
    }

    // 2. Check Gregorian Match
    if (dobGregorian) {
      const d = new Date(dobGregorian);
      const bMonth = d.getMonth();
      const bDay = d.getDate();
      const bMonthUtc = d.getUTCMonth();
      const bDayUtc = d.getUTCDate();
      if ((bMonth === refMonth && bDay === refDay) || (bMonthUtc === refMonth && bDayUtc === refDay)) {
        isMatchToday = true;
        isGregorianMatch = true;
      }
    }

    celebrant.isHijriMatch = isHijriMatch;
    celebrant.isGregorianMatch = isGregorianMatch;

    if (isMatchToday) {
      celebrant.birthDateStr = refDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      todayList.push(celebrant);
    } else {
      // Calculate upcoming birthday: Prioritize Hijri cycle, fallback to Gregorian
      let minDiffDays: number | null = null;
      let displayDateStr = "";

      if (hijriDay && hijriMonth) {
        let nextJd = hijriToJulianDay(todayHijri.year, hijriMonth, hijriDay);
        if (nextJd < currentJd) {
          nextJd = hijriToJulianDay(todayHijri.year + 1, hijriMonth, hijriDay);
        }
        const diffDays = nextJd - currentJd;
        if (diffDays > 0 && diffDays <= daysAhead) {
          minDiffDays = diffDays;
          const greg = julianDayToGregorian(nextJd);
          const gregDate = new Date(greg.year, greg.month - 1, greg.day);
          const gregStr = gregDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          displayDateStr = gregStr;
          celebrant.isHijriMatch = true;
        }
      }

      if (minDiffDays === null && dobGregorian) {
        const d = new Date(dobGregorian);
        const bMonth = d.getMonth();
        const bDay = d.getDate();
        let nextBirthday = new Date(refYear, bMonth, bDay, 0, 0, 0, 0);
        if (nextBirthday < refStartOfDay) {
          nextBirthday = new Date(refYear + 1, bMonth, bDay, 0, 0, 0, 0);
        }
        const diffMs = nextBirthday.getTime() - refStartOfDay.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= daysAhead) {
          minDiffDays = diffDays;
          displayDateStr = nextBirthday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          celebrant.isGregorianMatch = true;
        }
      }

      if (minDiffDays !== null && minDiffDays > 0 && minDiffDays <= daysAhead) {
        upcomingList.push({
          ...celebrant,
          daysUntil: minDiffDays,
          birthDateStr: displayDateStr,
        });
      }
    }
  }

  // 1. Process Students
  for (const p of studentProfiles) {
    const linkedParentEmails: string[] = [];
    if (p.parentLinks) {
      for (const link of p.parentLinks) {
        const e = link.parent?.user?.email;
        if (e && isDeliverableEmail(e)) linkedParentEmails.push(e);
      }
    }

    const parsedHijri = parseHijriDateString(p.dobHijri);
    const convertedHijri = p.dobGregorian ? convertGregorianToHijri(p.dobGregorian) : null;
    const effectiveHijri = parsedHijri || convertedHijri;

    const studentInfo: WarasMubarakStudentInfo = {
      celebrantType: "STUDENT",
      studentProfileId: p.id,
      studentId: p.studentId,
      fullName: `${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || `Talib ${p.studentId}`,
      nameAr: p.nameAr,
      grade: p.grade,
      section: p.section,
      avatarUrl: p.user.avatarUrl,
      dobGregorian: p.dobGregorian,
      dobHijri: p.dobHijri,
      hijriDay: effectiveHijri?.day,
      hijriMonth: effectiveHijri?.month,
      hijriMonthName: effectiveHijri ? HIJRI_MONTHS[effectiveHijri.month - 1]?.short : undefined,
      hijriYear: effectiveHijri?.year,
      studentEmail: p.user.email,
      fatherEmail: p.fatherEmail,
      motherEmail: p.motherEmail,
      linkedParentEmails,
      fatherName: p.fatherName,
      motherName: p.motherName,
    };

    processCelebrant(studentInfo);
  }

  // 2. Process Faculty / Teachers
  for (const t of teacherProfiles) {
    const parsedHijri = parseHijriDateString(t.birthDateH);
    const convertedHijri = t.birthDateAd ? convertGregorianToHijri(t.birthDateAd) : null;
    const effectiveHijri = parsedHijri || convertedHijri;

    const teacherInfo: WarasMubarakStudentInfo = {
      celebrantType: "FACULTY",
      studentProfileId: t.id,
      teacherProfileId: t.id,
      studentId: t.its || t.employeeId,
      fullName: `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() || `Ustaaz ${t.its || t.employeeId}`,
      roleTitle: t.roleTitle || "Asaatizah",
      department: t.department || "Faculty",
      avatarUrl: t.photoUrl || t.user.avatarUrl,
      dobGregorian: t.birthDateAd,
      dobHijri: t.birthDateH,
      hijriDay: effectiveHijri?.day,
      hijriMonth: effectiveHijri?.month,
      hijriMonthName: effectiveHijri ? HIJRI_MONTHS[effectiveHijri.month - 1]?.short : undefined,
      hijriYear: effectiveHijri?.year,
      studentEmail: t.tEmail || t.user.email,
      mobile: t.mobile,
    };

    processCelebrant(teacherInfo);
  }

  // Sort upcoming chronologically
  upcomingList.sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));

  return { today: todayList, upcoming: upcomingList };
}
