import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware";
import { sendPushToUsers } from "../lib/push";

const router = Router();

async function notifyStudentAndParents(
  studentProfileId: string,
  title: string,
  body: string,
  link: string = "/talabat/profile-1447"
) {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: {
        userId: true,
        parentLinks: { select: { parent: { select: { userId: true } } } },
      },
    });
    if (!student) return;

    const notifData: Array<{
      userId: string;
      title: string;
      body: string;
      type: "ANNOUNCEMENT";
      link: string;
      priority: string;
    }> = [];

    const recipientUserIds: string[] = [];
    if (student.userId) {
      notifData.push({
        userId: student.userId,
        title,
        body,
        type: "ANNOUNCEMENT",
        link,
        priority: "NORMAL",
      });
      recipientUserIds.push(student.userId);
    }

    for (const pl of student.parentLinks) {
      if (pl.parent?.userId && !recipientUserIds.includes(pl.parent.userId)) {
        notifData.push({
          userId: pl.parent.userId,
          title,
          body,
          type: "ANNOUNCEMENT",
          link,
          priority: "NORMAL",
        });
        recipientUserIds.push(pl.parent.userId);
      }
    }

    if (notifData.length > 0) {
      await prisma.notification.createMany({ data: notifData });
    }
    if (recipientUserIds.length > 0) {
      sendPushToUsers(recipientUserIds, { title, body, url: link }).catch(() => {});
    }
  } catch (err) {
    console.warn("[talabat-profile] Failed to dispatch notifications:", err);
  }
}

function isGrade4(grade?: string | null): boolean {
  if (!grade) return false;
  const g = grade.trim().toLowerCase();
  return (
    g === "4" ||
    g === "darajah 4" ||
    g === "grade 4" ||
    g === "class 4" ||
    g === "iv" ||
    g === "4th" ||
    g === "rabea" ||
    g === "darajah rabea" ||
    g === "grade 4 (rabea)" ||
    g === "class 4 (rabea)" ||
    g === "rabi'a" ||
    g.includes("rabea") ||
    g.includes("rabia") ||
    g.includes("الرابعة") ||
    g.includes("رابعة")
  );
}

function normalizePhotoUrl(val: any): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return "/" + trimmed;
}

// Canonical 11 Evaluation Tabs and their respective database fields
export const ALL_YEARLY_PROFILE_TABS = [
  "masool",
  "tahfeez",
  "taleem",
  "tadeeb",
  "tanzeem",
  "sports",
  "maktabat",
  "skills",
  "otherExams",
  "counselling",
  "ratings",
] as const;

export type YearlyProfileTabId = (typeof ALL_YEARLY_PROFILE_TABS)[number];

export const TAB_FIELD_MAP: Record<YearlyProfileTabId, string[]> = {
  masool: ["remarksMasool", "masoolRemarks"],
  tahfeez: ["remarksTahfeez"],
  taleem: ["remarksTaleem"],
  tadeeb: ["remarksTadeeb"],
  tanzeem: ["remarksTanzeem"],
  sports: ["remarksSports"],
  maktabat: ["remarksMaktabat"],
  skills: ["remarksSkills"],
  otherExams: ["remarksOtherExams"],
  counselling: ["remarksCounselling", "counsellingNotes"],
  ratings: ["behaviourRating", "communicationRating", "dedicationRating", "disciplineRating"],
};

export async function getTeacherPermissions(userId: string, role: string) {
  const allTabs = [...ALL_YEARLY_PROFILE_TABS];

  if (role === "ADMIN") {
    return {
      canEditRemarks: true,
      canViewCounsellor: true,
      canEditCounsellor: true,
      assignedTabs: allTabs,
      isAllTabs: true,
    };
  }
  if (role !== "TEACHER") {
    return {
      canEditRemarks: false,
      canViewCounsellor: false,
      canEditCounsellor: false,
      assignedTabs: [] as string[],
      isAllTabs: false,
    };
  }

  const teacherProfile = await prisma.teacherProfile.findFirst({
    where: { OR: [{ userId }, { id: userId }] },
    include: { portalAssignments: true },
  });

  if (!teacherProfile) {
    return {
      canEditRemarks: false,
      canViewCounsellor: false,
      canEditCounsellor: false,
      assignedTabs: [] as string[],
      isAllTabs: false,
    };
  }

  const activeAssignments = teacherProfile.portalAssignments.filter((a) => a.isActive);
  const rawTypes = activeAssignments.map((a) => a.portalType.trim().toLowerCase());

  const isAll = rawTypes.some((t) => {
    const clean = t.replace(/^page:/, "");
    return clean === "all" || clean === "*" || clean === "portal-assignments";
  });

  if (isAll) {
    return {
      canEditRemarks: true,
      canViewCounsellor: true,
      canEditCounsellor: true,
      assignedTabs: allTabs,
      isAllTabs: true,
    };
  }

  const assignedTabsSet = new Set<string>();

  for (const raw of rawTypes) {
    const tabMatch = raw.match(/^(?:tab:)?(?:yearly[-_]profile:?|yearly[-_]profile[-_]tab:?)(.+)$/);
    if (tabMatch) {
      const tabKey = tabMatch[1].trim();
      if (allTabs.includes(tabKey as YearlyProfileTabId)) {
        assignedTabsSet.add(tabKey);
      }
    }
  }

  const assignedKeys = new Set(rawTypes.map((t) => t.replace(/^page:/, "")));
  if (
    assignedKeys.has("counsellor-remarks") ||
    assignedKeys.has("counsellor_remarks") ||
    assignedKeys.has("counsellor") ||
    assignedKeys.has("counselor") ||
    assignedKeys.has("counselor-remarks")
  ) {
    assignedTabsSet.add("counselling");
  }

  const hasLegacyRemarks =
    assignedKeys.has("talabat-profiles-remarks") ||
    assignedKeys.has("remarks-edit") ||
    assignedKeys.has("talabat_profiles_remarks") ||
    assignedKeys.has("yearly-profile-remarks");

  if (hasLegacyRemarks && assignedTabsSet.size === 0) {
    allTabs.forEach((t) => assignedTabsSet.add(t));
  }

  const assignedTabs = Array.from(assignedTabsSet);
  const canEditRemarks = assignedTabs.length > 0;
  const canViewCounsellor = assignedTabs.includes("counselling") || isAll;
  const canEditCounsellor = assignedTabs.includes("counselling") || isAll;

  return {
    canEditRemarks,
    canViewCounsellor,
    canEditCounsellor,
    assignedTabs,
    isAllTabs: assignedTabs.length === allTabs.length,
  };
}

export function sanitizeProfileForTeacher(
  profile: any,
  perms: { isAllTabs?: boolean; assignedTabs?: string[] }
) {
  if (!profile || perms.isAllTabs) return profile;

  const allowedTabs = new Set(perms.assignedTabs || []);
  const sanitized = { ...profile };

  for (const [tabId, fields] of Object.entries(TAB_FIELD_MAP)) {
    if (!allowedTabs.has(tabId)) {
      for (const field of fields) {
        sanitized[field] = null;
      }
    }
  }

  return sanitized;
}

function generatePrefilledProfile(sp: any, user: any, parent?: any) {
  return {
    id: "",
    studentId: sp.id,
    year: "1447 H",
    status: "DRAFT",
    studentPhotoUrl: user?.avatarUrl || null,
    name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
    itsNo: sp.its || "",
    idNo: sp.studentId || sp.trNo || "",
    jamaat: sp.residentCity || sp.watan || "",
    vatan: sp.watan || "",
    nationality: "Indian",
    dob: sp.dobGregorian ? new Date(sp.dobGregorian).toISOString().split("T")[0] : sp.dobHijri || "",
    age: sp.age || null,
    fatherPhotoUrl: null,
    fatherName: sp.fatherName || (parent?.user?.firstName ? `${parent?.user?.firstName} ${parent?.user?.lastName}`.trim() : ""),
    fatherOccupation: sp.fatherOccupation || parent?.occupation || "",
    motherPhotoUrl: null,
    motherName: sp.motherName || "",
    motherOccupation: "Homemaker",
    result1444: "",
    result1445: "",
    result1446: "",
    result1447: "",
    hifzYear: sp.hafizYear || "",
    hifzTabaqa: "",
    course1: "",
    course2: "",
    course3: "",
    course4: "",
    activities: "",
    otherExams: "",
    strengths: ["", "", ""],
    weaknesses: ["", "", ""],
    aboutMyself: "",
    reallyGoodAt: sp.reallyGoodAt || "",
    loveToStudy: sp.loveToStudy || "",
    loveForFun: sp.loveForFun || "",
    standard: sp.grade || "Darajah 4",
    grade: sp.grade || "4",
    section: sp.section || "A",
    studentStatus: sp.status ? String(sp.status) : (sp.hafizYear ? "Hafiz" : "Sanah"),
    admissionYear: sp.admissionYear || "1444 H",
    currentYear: sp.currentYear || "1447 H",
    address: sp.address || "",
    mobileNumber: sp.mobileNumber || "",
    email: user?.email || "",
    externalSchooling: sp.externalSchooling || "Regular Darse Burhani",
    behaviourRating: null,
    communicationRating: null,
    dedicationRating: null,
    disciplineRating: null,
    masoolRemarks: null,
    remarksMasool: null,
    remarksTahfeez: null,
    remarksTaleem: null,
    remarksTadeeb: null,
    remarksTanzeem: null,
    remarksSports: null,
    remarksMaktabat: null,
    remarksSkills: null,
    remarksOtherExams: null,
    remarksCounselling: null,
    counsellingNotes: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function enrichProfileData(profile: any, sp: any, user: any) {
  if (!profile) return profile;
  return {
    ...profile,
    name: profile.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
    studentPhotoUrl: profile.studentPhotoUrl || user?.avatarUrl || null,
    motherName: profile.motherName || sp?.motherName || "",
    fatherName: profile.fatherName || sp?.fatherName || "",
    fatherOccupation: profile.fatherOccupation || sp?.fatherOccupation || "",
    standard: sp?.grade || "Darajah 4",
    grade: sp?.grade || "4",
    section: sp?.section || "A",
    studentStatus: sp?.status ? String(sp.status) : (sp?.hafizYear ? "Hafiz" : "Sanah"),
    hafizYear: sp?.hafizYear || profile.hifzYear || "",
    admissionYear: sp?.admissionYear || "1444 H",
    currentYear: sp?.currentYear || profile.year || "1447 H",
    age: profile.age || sp?.age || null,
    itsNo: profile.itsNo || sp?.its || "",
    watan: profile.vatan || sp?.watan || "",
    residentCity: profile.jamaat || sp?.residentCity || sp?.watan || "",
    address: sp?.address || "",
    mobileNumber: sp?.mobileNumber || "",
    email: user?.email || "",
    externalSchooling: sp?.externalSchooling || "Regular Darse Burhani",
    reallyGoodAt: profile.reallyGoodAt || sp?.reallyGoodAt || "",
    loveToStudy: profile.loveToStudy || sp?.loveToStudy || "",
    loveForFun: profile.loveForFun || sp?.loveForFun || "",
  };
}

// ── GET /api/talabat-profile/me ──
// For logged in student or parent: check if Grade 4 / Rabea, return their profile (or prefilled defaults)
router.get("/me", requireAuth, async (req, res) => {
  const session = req.auth!;

  // Handle PARENT role
  if (session.user.role === "PARENT") {
    const parent = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: true,
        studentLinks: {
          include: {
            student: {
              include: {
                user: true,
                talabatProfile1447: true,
              },
            },
          },
        },
      },
    });

    if (!parent || !parent.studentLinks.length) {
      return res.status(404).json({ success: false, error: "Parent profile or linked students not found" });
    }

    const requestedStudentId = req.query.studentId as string;
    const rabeaChildren = parent.studentLinks.filter(
      (l) => isGrade4(l.student.grade) || !!l.student.talabatProfile1447
    );

    let targetLink = requestedStudentId
      ? parent.studentLinks.find(
          (l) =>
            l.student.id === requestedStudentId ||
            l.student.studentId === requestedStudentId ||
            l.student.userId === requestedStudentId
        )
      : rabeaChildren[0];

    if (!targetLink) {
      return res.json({
        success: true,
        isGrade4: false,
        isParent: true,
        isReadOnly: true,
        message: "None of your assigned children are currently in Darajah 4.",
        availableChildren: [],
      });
    }

    const sp = targetLink.student;
    const grade4 = isGrade4(sp.grade) || !!sp.talabatProfile1447;

    if (!grade4) {
      return res.json({
        success: true,
        isGrade4: false,
        isParent: true,
        isReadOnly: true,
        message: `${sp.user?.firstName || "This student"} is not enrolled in Darajah 4. The Yearly Profile is only for Rabea students.`,
        availableChildren: rabeaChildren.map((l) => ({
          id: l.student.id,
          name: `${l.student.user.firstName} ${l.student.user.lastName}`.trim(),
          grade: l.student.grade,
          isGrade4: true,
        })),
      });
    }

    let profile = sp.talabatProfile1447;
    if (!profile) {
      profile = generatePrefilledProfile(sp, sp.user, parent) as any;
    } else {
      profile = enrichProfileData(profile, sp, sp.user);
    }

    return res.json({
      success: true,
      isGrade4: true,
      isParent: true,
      isReadOnly: false,
      profile,
      studentInfo: {
        id: sp.id,
        name: `${sp.user.firstName} ${sp.user.lastName}`.trim(),
        grade: sp.grade,
        section: sp.section,
        its: sp.its,
        avatarUrl: sp.user.avatarUrl,
      },
      availableChildren: rabeaChildren.map((l) => ({
        id: l.student.id,
        name: `${l.student.user.firstName} ${l.student.user.lastName}`.trim(),
        grade: l.student.grade,
        isGrade4: true,
      })),
    });
  }

  // Handle ADMIN viewing specific student via ?studentId=
  if (session.user.role === "ADMIN" && req.query.studentId) {
    const sp = await prisma.studentProfile.findUnique({
      where: { id: req.query.studentId as string },
      include: {
        user: true,
        talabatProfile1447: true,
      },
    });

    if (!sp) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    let profile = sp.talabatProfile1447;
    if (!profile) {
      profile = generatePrefilledProfile(sp, sp.user) as any;
    } else {
      profile = enrichProfileData(profile, sp, sp.user);
    }

    return res.json({
      success: true,
      isGrade4: isGrade4(sp.grade),
      profile,
      studentInfo: {
        id: sp.id,
        name: `${sp.user.firstName} ${sp.user.lastName}`.trim(),
        grade: sp.grade,
        section: sp.section,
        its: sp.its,
        avatarUrl: sp.user.avatarUrl,
      },
    });
  }

  // Handle STUDENT role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      studentProfile: {
        include: {
          talabatProfile1447: true,
        },
      },
    },
  });

  if (!user || !user.studentProfile) {
    return res.status(404).json({ success: false, error: "Student profile not found" });
  }

  const sp = user.studentProfile;
  const grade4 = isGrade4(sp.grade) || !!sp.talabatProfile1447;

  if (!grade4) {
    return res.json({
      success: true,
      isGrade4: false,
      isParent: false,
      isReadOnly: true,
      message: "The Yearly Profile is strictly designated for Darajah Rabea (Grade 4) Talabat.",
      studentInfo: {
        id: sp.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        grade: sp.grade,
        section: sp.section,
        its: sp.its,
      },
    });
  }

  let profile = sp.talabatProfile1447;
  if (!profile) {
    profile = generatePrefilledProfile(sp, user) as any;
  } else {
    profile = enrichProfileData(profile, sp, user);
  }

  return res.json({
    success: true,
    isGrade4: true,
    isParent: false,
    isReadOnly: false,
    profile,
    studentInfo: {
      id: sp.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      grade: sp.grade,
      section: sp.section,
      its: sp.its,
      avatarUrl: user.avatarUrl,
    },
  });
});

// ── PUT /api/talabat-profile/me ──
// Save or Submit Student or Parent's 1447 H Profile
router.put("/me", requireAuth, async (req, res) => {
  const session = req.auth!;
  const body = req.body || {};
  let studentProfileId: string | null = null;
  let targetUserAvatar: string | null = null;
  let targetUserId: string | null = null;

  if (session.user.role === "PARENT") {
    const parent = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: true,
        studentLinks: {
          include: {
            student: {
              include: {
                user: true,
                talabatProfile1447: true,
              },
            },
          },
        },
      },
    });

    if (!parent || !parent.studentLinks.length) {
      return res.status(404).json({ success: false, error: "Parent profile or linked students not found" });
    }

    const requestedStudentId = body.studentId as string | undefined;
    const rabeaChildren = parent.studentLinks.filter(
      (l) => isGrade4(l.student.grade) || !!l.student.talabatProfile1447
    );

    let targetLink = requestedStudentId
      ? parent.studentLinks.find(
          (l) =>
            l.student.id === requestedStudentId ||
            l.student.studentId === requestedStudentId ||
            l.student.userId === requestedStudentId
        )
      : rabeaChildren[0];

    if (!targetLink) {
      return res.status(403).json({
        success: false,
        error: "You can only edit Yearly Profiles for your assigned Darajah 4 children.",
      });
    }

    const sp = targetLink.student;
    if (!isGrade4(sp.grade) && !sp.talabatProfile1447) {
      return res.status(403).json({
        success: false,
        error: "Yearly Profile is strictly restricted to Darajah Rabea (Grade 4) Talabat.",
      });
    }

    studentProfileId = sp.id;
    targetUserAvatar = sp.user.avatarUrl;
    targetUserId = sp.user.id;
  } else if (session.user.role === "ADMIN" && body.studentId) {
    const sp = await prisma.studentProfile.findUnique({
      where: { id: body.studentId },
      include: { user: true },
    });
    if (!sp) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }
    studentProfileId = sp.id;
    targetUserAvatar = sp.user.avatarUrl;
    targetUserId = sp.user.id;
  } else {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { studentProfile: { include: { talabatProfile1447: true } } },
    });

    if (!user || !user.studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const sp = user.studentProfile;
    if (!isGrade4(sp.grade) && !sp.talabatProfile1447) {
      return res.status(403).json({
        success: false,
        error: "Yearly Profile is strictly restricted to Darajah Rabea (Grade 4) Talabat.",
      });
    }

    studentProfileId = sp.id;
    targetUserAvatar = user.avatarUrl;
    targetUserId = user.id;
  }

  const status = body.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT";

  const studentPhotoUrl = normalizePhotoUrl(body.studentPhotoUrl);
  const fatherPhotoUrl = normalizePhotoUrl(body.fatherPhotoUrl);
  const motherPhotoUrl = normalizePhotoUrl(body.motherPhotoUrl);

  const strengths = Array.isArray(body.strengths)
    ? body.strengths.map((s: any) => (typeof s === "string" ? s.trim() : "")).filter((s: string) => s.length > 0)
    : undefined;
  const weaknesses = Array.isArray(body.weaknesses)
    ? body.weaknesses.map((w: any) => (typeof w === "string" ? w.trim() : "")).filter((w: string) => w.length > 0)
    : undefined;

  // Strict completion validation for Rabea final submission
  if (status === "SUBMITTED") {
    const effectiveStudentPhoto = studentPhotoUrl || targetUserAvatar || null;
    const missingFields: string[] = [];
    if (!effectiveStudentPhoto) missingFields.push("Student Passport Photo");
    if (!fatherPhotoUrl && !body.fatherPhotoUrl) missingFields.push("Father Passport Photo");
    if (!motherPhotoUrl && !body.motherPhotoUrl) missingFields.push("Mother Passport Photo");
    if (!body.name?.trim()) missingFields.push("Student Full Name");
    if (!body.itsNo?.trim()) missingFields.push("Student ITS Number");
    if (!body.idNo?.trim()) missingFields.push("Student ID Number");
    if (!body.jamaat?.trim()) missingFields.push("Jamaat / Mauze");
    if (!body.vatan?.trim()) missingFields.push("Vatan / Native Town");
    if (!body.nationality?.trim()) missingFields.push("Nationality");
    if (!body.dob?.trim()) missingFields.push("Date of Birth");
    if (!body.age) missingFields.push("Age");
    if (!body.fatherName?.trim()) missingFields.push("Father Name");
    if (!body.fatherOccupation?.trim()) missingFields.push("Father Occupation");
    if (!body.motherName?.trim()) missingFields.push("Mother Name");
    if (!body.motherOccupation?.trim()) missingFields.push("Mother Occupation");
    if (!body.result1444?.trim()) missingFields.push("1444 Result");
    if (!body.result1445?.trim()) missingFields.push("1445 Result");
    if (!body.result1446?.trim()) missingFields.push("1446 Result");
    if (!body.result1447?.trim()) missingFields.push("1447 Result");
    if (!body.hifzYear?.trim()) missingFields.push("Hifz Completion");
    if (!body.hifzTabaqa?.trim()) missingFields.push("Hifz Tabaqa");
    if (!body.course1?.trim()) missingFields.push("Course 1");
    if (!body.course2?.trim()) missingFields.push("Course 2");
    if (!body.course3?.trim()) missingFields.push("Course 3");
    if (!body.course4?.trim()) missingFields.push("Course 4");
    if (!body.activities?.trim()) missingFields.push("Program Participation");
    if (!body.otherExams?.trim()) missingFields.push("Other Exams");
    if (!strengths || strengths.length < 3) missingFields.push("At least 3 Strengths");
    if (!weaknesses || weaknesses.length < 3) missingFields.push("At least 3 Areas for Improvement");
    if (!body.aboutMyself?.trim() || body.aboutMyself.trim().length < 15) {
      missingFields.push("About Myself / Vision Statement (min 15 characters)");
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot submit incomplete profile. Please fill all required fields and photos: ${missingFields.join(", ")}.`,
        missingFields,
      });
    }
  }

  const updateData: any = {};
  if (body.year !== undefined) updateData.year = body.year || "1447 H";
  if (body.status !== undefined) updateData.status = status;
  if (body.studentPhotoUrl !== undefined) updateData.studentPhotoUrl = studentPhotoUrl;
  if (body.name !== undefined) updateData.name = body.name || null;
  if (body.itsNo !== undefined) updateData.itsNo = body.itsNo || null;
  if (body.idNo !== undefined) updateData.idNo = body.idNo || null;
  if (body.jamaat !== undefined) updateData.jamaat = body.jamaat || null;
  if (body.vatan !== undefined) updateData.vatan = body.vatan || null;
  if (body.nationality !== undefined) updateData.nationality = body.nationality || "Indian";
  if (body.dob !== undefined) updateData.dob = body.dob || null;
  if (body.age !== undefined) updateData.age = body.age ? parseInt(String(body.age), 10) : null;
  if (body.fatherPhotoUrl !== undefined) updateData.fatherPhotoUrl = fatherPhotoUrl;
  if (body.fatherName !== undefined) updateData.fatherName = body.fatherName || null;
  if (body.fatherOccupation !== undefined) updateData.fatherOccupation = body.fatherOccupation || null;
  if (body.motherPhotoUrl !== undefined) updateData.motherPhotoUrl = motherPhotoUrl;
  if (body.motherName !== undefined) updateData.motherName = body.motherName || null;
  if (body.motherOccupation !== undefined) updateData.motherOccupation = body.motherOccupation || null;
  if (body.result1444 !== undefined) updateData.result1444 = body.result1444 || null;
  if (body.result1445 !== undefined) updateData.result1445 = body.result1445 || null;
  if (body.result1446 !== undefined) updateData.result1446 = body.result1446 || null;
  if (body.result1447 !== undefined) updateData.result1447 = body.result1447 || null;
  if (body.hifzYear !== undefined) updateData.hifzYear = body.hifzYear || null;
  if (body.hifzTabaqa !== undefined) updateData.hifzTabaqa = body.hifzTabaqa || null;
  if (body.course1 !== undefined) updateData.course1 = body.course1 || null;
  if (body.course2 !== undefined) updateData.course2 = body.course2 || null;
  if (body.course3 !== undefined) updateData.course3 = body.course3 || null;
  if (body.course4 !== undefined) updateData.course4 = body.course4 || null;
  if (body.activities !== undefined) updateData.activities = body.activities || null;
  if (body.otherExams !== undefined) updateData.otherExams = body.otherExams || null;
  if (strengths !== undefined) updateData.strengths = strengths;
  if (weaknesses !== undefined) updateData.weaknesses = weaknesses;
  if (body.aboutMyself !== undefined) updateData.aboutMyself = body.aboutMyself || null;
  if (body.reallyGoodAt !== undefined) updateData.reallyGoodAt = body.reallyGoodAt ? String(body.reallyGoodAt).trim() : null;
  if (body.loveToStudy !== undefined) updateData.loveToStudy = body.loveToStudy ? String(body.loveToStudy).trim() : null;
  if (body.loveForFun !== undefined) updateData.loveForFun = body.loveForFun ? String(body.loveForFun).trim() : null;

  const createData = {
    year: body.year || "1447 H",
    status,
    studentPhotoUrl: studentPhotoUrl || targetUserAvatar || null,
    name: body.name || null,
    itsNo: body.itsNo || null,
    idNo: body.idNo || null,
    jamaat: body.jamaat || null,
    vatan: body.vatan || null,
    nationality: body.nationality || "Indian",
    dob: body.dob || null,
    age: body.age ? parseInt(String(body.age), 10) : null,
    fatherPhotoUrl: fatherPhotoUrl || null,
    fatherName: body.fatherName || null,
    fatherOccupation: body.fatherOccupation || null,
    motherPhotoUrl: motherPhotoUrl || null,
    motherName: body.motherName || null,
    motherOccupation: body.motherOccupation || null,
    result1444: body.result1444 || null,
    result1445: body.result1445 || null,
    result1446: body.result1446 || null,
    result1447: body.result1447 || null,
    hifzYear: body.hifzYear || null,
    hifzTabaqa: body.hifzTabaqa || null,
    course1: body.course1 || null,
    course2: body.course2 || null,
    course3: body.course3 || null,
    course4: body.course4 || null,
    activities: body.activities || null,
    otherExams: body.otherExams || null,
    strengths: strengths || [],
    weaknesses: weaknesses || [],
    aboutMyself: body.aboutMyself || null,
    reallyGoodAt: body.reallyGoodAt ? String(body.reallyGoodAt).trim() : null,
    loveToStudy: body.loveToStudy ? String(body.loveToStudy).trim() : null,
    loveForFun: body.loveForFun ? String(body.loveForFun).trim() : null,
    ...updateData,
  };

  const saved = await prisma.talabatProfile1447.upsert({
    where: { studentId: studentProfileId },
    create: {
      studentId: studentProfileId,
      ...createData,
    },
    update: updateData,
  });

  // Sync basic parent and contact fields to StudentProfile for consistency
  const studentProfileUpdates: any = {};
  if (body.fatherName) studentProfileUpdates.fatherName = body.fatherName.trim();
  if (body.fatherOccupation) studentProfileUpdates.fatherOccupation = body.fatherOccupation.trim();
  if (body.motherName) studentProfileUpdates.motherName = body.motherName.trim();
  if (body.vatan) studentProfileUpdates.watan = body.vatan.trim();
  if (body.jamaat) studentProfileUpdates.residentCity = body.jamaat.trim();
  if (body.address) studentProfileUpdates.address = body.address.trim();
  if (body.mobileNumber) studentProfileUpdates.mobileNumber = body.mobileNumber.trim();
  if (body.externalSchooling) studentProfileUpdates.externalSchooling = body.externalSchooling.trim();
  if (body.reallyGoodAt !== undefined) studentProfileUpdates.reallyGoodAt = body.reallyGoodAt ? String(body.reallyGoodAt).trim() : null;
  if (body.loveToStudy !== undefined) studentProfileUpdates.loveToStudy = body.loveToStudy ? String(body.loveToStudy).trim() : null;
  if (body.loveForFun !== undefined) studentProfileUpdates.loveForFun = body.loveForFun ? String(body.loveForFun).trim() : null;

  if (Object.keys(studentProfileUpdates).length > 0) {
    await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: studentProfileUpdates,
    }).catch(() => {});
  }

  // Sync avatar to User if provided and changed
  const effectiveNewStudentPhoto = studentPhotoUrl || body.studentPhotoUrl;
  if (effectiveNewStudentPhoto && targetUserId && effectiveNewStudentPhoto !== targetUserAvatar) {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { avatarUrl: effectiveNewStudentPhoto },
    }).catch(() => {});
  }

  // Sync parent photos to linked ParentProfile user accounts
  if (studentProfileId) {
    const effectiveFatherPhoto = fatherPhotoUrl || body.fatherPhotoUrl;
    if (effectiveFatherPhoto) {
      const fatherLinks = await prisma.parentStudentLink.findMany({
        where: {
          studentId: studentProfileId,
          OR: [
            { relationship: { contains: "father", mode: "insensitive" } },
            { parent: { relationType: { contains: "father", mode: "insensitive" } } },
          ],
        },
        include: { parent: { include: { user: true } } },
      }).catch(() => []);
      for (const link of fatherLinks) {
        if (link.parent?.user?.id) {
          await prisma.user.update({
            where: { id: link.parent.user.id },
            data: { avatarUrl: effectiveFatherPhoto },
          }).catch(() => {});
        }
      }
    }
    const effectiveMotherPhoto = motherPhotoUrl || body.motherPhotoUrl;
    if (effectiveMotherPhoto) {
      const motherLinks = await prisma.parentStudentLink.findMany({
        where: {
          studentId: studentProfileId,
          OR: [
            { relationship: { contains: "mother", mode: "insensitive" } },
            { parent: { relationType: { contains: "mother", mode: "insensitive" } } },
          ],
        },
        include: { parent: { include: { user: true } } },
      }).catch(() => []);
      for (const link of motherLinks) {
        if (link.parent?.user?.id) {
          await prisma.user.update({
            where: { id: link.parent.user.id },
            data: { avatarUrl: effectiveMotherPhoto },
          }).catch(() => {});
        }
      }
    }
  }

  // If submitted, dispatch notifications to administration, student, and parents
  if (status === "SUBMITTED" && studentProfileId) {
    try {
      const studentName = body.name || "Darajah 4 Student";
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            title: `📄 Talabat 1447 Profile Submitted: ${studentName}`,
            body: `${studentName} (Darajah 4 / Rabea) has submitted their complete 1447 H profile report for review.`,
            type: "ALERT",
            link: "/admin/talabat-profiles",
            priority: "HIGH",
          })),
        });
        sendPushToUsers(admins.map((a) => a.id), {
          title: `📄 Profile Submitted: ${studentName}`,
          body: `1447 H profile submitted for Darajah 4 review.`,
          url: "/admin/talabat-profiles",
        }).catch(() => {});
      }

      notifyStudentAndParents(
        studentProfileId,
        "📄 Profile Submitted (1447 H)",
        `Your 1447 H profile report for ${studentName} has been submitted successfully to administration for faculty review.`,
        "/talabat/profile-1447"
      ).catch(() => {});
    } catch (notifErr) {
      console.warn("[talabat-profile] submission notification error:", notifErr);
    }
  }

  return res.json({
    success: true,
    data: saved,
    message: status === "SUBMITTED" ? "Talabat profile submitted successfully to administration!" : "Draft saved successfully.",
  });
});

// ── GET /api/talabat-profile/list ──
// For Admin and Teachers: List all Darajah 4 / Rabea students and their profiles
router.get("/list", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  // Strictly restrict Yearly Profile to Darajah Rabea (Grade 4) Talabat ONLY
  const rabeaGradeFilter = {
    OR: [
      { grade: "4" },
      { grade: "4th" },
      { grade: "IV" },
      { grade: { contains: "4" } },
      { grade: { contains: "rabea", mode: "insensitive" } },
      { grade: { contains: "rabia", mode: "insensitive" } },
    ],
  };

  let whereClause: any = {
    user: { isActive: true, deletedAt: null },
    ...rabeaGradeFilter,
  };

  if (session.user.role === "TEACHER") {
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (teacherProfile) {
      // Find all Darajah Rabea classes (4 A, 4 B)
      const rabeaClasses = await prisma.class.findMany({
        where: {
          OR: [
            { grade: "4" },
            { name: { contains: "4" } },
          ],
        },
        select: { id: true },
      });
      const rabeaClassIds = rabeaClasses.map((c) => c.id);

      whereClause = {
        user: { isActive: true, deletedAt: null },
        ...rabeaGradeFilter,
      };
    }
  }

  const students = await prisma.studentProfile.findMany({
    where: whereClause,
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
      talabatProfile1447: true,
    },
    orderBy: [
      { grade: "asc" },
      { section: "asc" },
      { studentId: "asc" },
      { its: "asc" },
    ],
  });

  const perms = await getTeacherPermissions(session.user.id, session.user.role);

  // If teacher only has specific tabs assigned, indicate if their tab is filled
  const allowedTabs = new Set(perms.assignedTabs || []);
  const formatted = students.map((s) => {
    const prof = s.talabatProfile1447;
    let hasRemarksForTeacher = false;
    if (prof) {
      if (perms.isAllTabs) {
        hasRemarksForTeacher = Boolean(
          prof.remarksMasool ||
          prof.masoolRemarks ||
          prof.remarksTahfeez ||
          prof.remarksTaleem ||
          prof.remarksTadeeb ||
          prof.remarksTanzeem ||
          prof.remarksSports ||
          prof.remarksMaktabat ||
          prof.remarksSkills ||
          prof.remarksOtherExams ||
          prof.remarksCounselling
        );
      } else {
        // Check only assigned tabs
        for (const tabId of perms.assignedTabs) {
          const fields = TAB_FIELD_MAP[tabId as YearlyProfileTabId] || [];
          for (const f of fields) {
            if ((prof as any)[f]) {
              hasRemarksForTeacher = true;
              break;
            }
          }
          if (hasRemarksForTeacher) break;
        }
      }
    }

    const showRatings = perms.isAllTabs || allowedTabs.has("ratings");

    const departmentResponses = prof ? {
      masool: Boolean(prof.remarksMasool || prof.masoolRemarks),
      tahfeez: Boolean(prof.remarksTahfeez),
      taleem: Boolean(prof.remarksTaleem),
      tadeeb: Boolean(prof.remarksTadeeb),
      tanzeem: Boolean(prof.remarksTanzeem),
      sports: Boolean(prof.remarksSports),
      maktabat: Boolean(prof.remarksMaktabat),
      skills: Boolean(prof.remarksSkills),
      otherExams: Boolean(prof.remarksOtherExams),
      counselling: Boolean(prof.remarksCounselling || prof.counsellingNotes),
      ratings: Boolean(prof.behaviourRating || prof.disciplineRating || prof.dedicationRating || prof.communicationRating),
    } : {
      masool: false,
      tahfeez: false,
      taleem: false,
      tadeeb: false,
      tanzeem: false,
      sports: false,
      maktabat: false,
      skills: false,
      otherExams: false,
      counselling: false,
      ratings: false,
    };

    const filledCount = Object.values(departmentResponses).filter(Boolean).length;

    // For Admin: include preview of remarks so admin can see responses in list table & tooltips
    const remarksPreview = session.user.role === "ADMIN" && prof ? {
      masool: prof.remarksMasool || prof.masoolRemarks || null,
      tahfeez: prof.remarksTahfeez || null,
      taleem: prof.remarksTaleem || null,
      tadeeb: prof.remarksTadeeb || null,
      tanzeem: prof.remarksTanzeem || null,
      sports: prof.remarksSports || null,
      maktabat: prof.remarksMaktabat || null,
      skills: prof.remarksSkills || null,
      otherExams: prof.remarksOtherExams || null,
      counselling: prof.remarksCounselling || null,
    } : null;

    return {
      studentId: s.id,
      idNo: s.studentId,
      its: s.its,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      email: s.user.email,
      avatarUrl: prof?.studentPhotoUrl || s.user.avatarUrl,
      grade: s.grade,
      section: s.section,
      status: prof?.status || "NOT_STARTED",
      hasProfile: !!prof,
      profileId: prof?.id || null,
      studentPhotoUrl: prof?.studentPhotoUrl || s.user.avatarUrl || null,
      fatherPhotoUrl: prof?.fatherPhotoUrl || null,
      motherPhotoUrl: prof?.motherPhotoUrl || null,
      fatherName: prof?.fatherName || s.fatherName || null,
      motherName: prof?.motherName || s.motherName || null,
      hasStudentPhoto: !!(prof?.studentPhotoUrl || s.user.avatarUrl),
      hasFatherPhoto: !!prof?.fatherPhotoUrl,
      hasMotherPhoto: !!prof?.motherPhotoUrl,
      ratings: prof && showRatings ? {
        behaviour: prof.behaviourRating,
        communication: prof.communicationRating,
        dedication: prof.dedicationRating,
        discipline: prof.disciplineRating,
        hasRemarks: hasRemarksForTeacher,
      } : (prof ? { hasRemarks: hasRemarksForTeacher } : null),
      departmentResponses,
      filledCount,
      totalDepartments: 11,
      remarksPreview,
      updatedAt: prof?.updatedAt || null,
    };
  });

  return res.json({
    success: true,
    total: formatted.length,
    students: formatted,
    permissions: perms,
  });
});

// ── GET /api/talabat-profile/view/:studentId ──
// For Admin and Teachers: View a specific student's 1447 profile
router.get("/view/:studentId", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const { studentId } = req.params;
  const student = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { id: studentId },
        { studentId: studentId },
        { userId: studentId },
      ],
    },
    include: {
      user: true,
      talabatProfile1447: true,
    },
  });

  if (!student) {
    return res.status(404).json({ success: false, error: "Student not found" });
  }

  let profile: any = student.talabatProfile1447;
  if (!profile) {
    profile = generatePrefilledProfile(student, student.user) as any;
  } else {
    profile = enrichProfileData(profile, student, student.user);
  }

  // If reviewed by someone, fetch reviewer name
  let reviewerName = null;
  if (profile?.reviewedById) {
    const reviewer = await prisma.user.findUnique({
      where: { id: profile.reviewedById },
      select: { firstName: true, lastName: true },
    });
    if (reviewer) reviewerName = `${reviewer.firstName} ${reviewer.lastName}`.trim();
  }

  const perms = await getTeacherPermissions(session.user.id, session.user.role);

  // Strictly sanitize profile: do NOT show other managers' responses if this teacher is not assigned to those tabs
  const sanitizedProfile = sanitizeProfileForTeacher(profile, perms);

  // Load Knowing Myself assessment from SystemSetting
  const knowingMyselfSetting = await prisma.systemSetting.findUnique({
    where: { key: `knowing_myself_${student.id}` },
  });
  const knowingMyself = (knowingMyselfSetting?.value as any) || null;

  return res.json({
    success: true,
    profile: sanitizedProfile,
    knowingMyself,
    hasKnowingMyself: Boolean(knowingMyself),
    studentInfo: {
      id: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      grade: student.grade,
      section: student.section,
      its: student.its,
      email: student.user.email,
      avatarUrl: sanitizedProfile.studentPhotoUrl || student.user.avatarUrl,
      motherName: sanitizedProfile.motherName || student.motherName,
      fatherName: sanitizedProfile.fatherName || student.fatherName,
      fatherOccupation: sanitizedProfile.fatherOccupation || student.fatherOccupation,
      standard: student.grade || "Darajah 4",
      studentStatus: student.status ? String(student.status) : (student.hafizYear ? "Hafiz" : "Sanah"),
      hafizYear: student.hafizYear || sanitizedProfile.hifzYear,
      admissionYear: student.admissionYear || "1444 H",
      currentYear: student.currentYear || sanitizedProfile.year || "1447 H",
      age: sanitizedProfile.age || student.age,
      watan: sanitizedProfile.vatan || student.watan,
      residentCity: sanitizedProfile.jamaat || student.residentCity,
      address: student.address,
      mobileNumber: student.mobileNumber,
      externalSchooling: student.externalSchooling,
      reallyGoodAt: sanitizedProfile.reallyGoodAt || student.reallyGoodAt,
      loveToStudy: sanitizedProfile.loveToStudy || student.loveToStudy,
      loveForFun: sanitizedProfile.loveForFun || student.loveForFun,
    },
    reviewerName,
    permissions: perms,
  });
});

// ── GET /api/talabat-profile/tab-assignments (Admin only) ──
// Get list of teachers and their tab-level delegation for Yearly Profile
router.get("/tab-assignments", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }

  try {
    const teachers = await prisma.teacherProfile.findMany({
      where: { user: { isActive: true, deletedAt: null } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        portalAssignments: { where: { isActive: true } },
      },
      orderBy: [{ user: { firstName: "asc" } }],
    });

    const result = teachers.map((tp) => {
      const activeKeys = tp.portalAssignments.map((a) => a.portalType.trim().toLowerCase());
      const isAll = activeKeys.some((k) => {
        const clean = k.replace(/^page:/, "");
        return clean === "all" || clean === "*" || clean === "portal-assignments";
      });

      const assignedTabs: string[] = [];
      if (isAll) {
        ALL_YEARLY_PROFILE_TABS.forEach((t) => assignedTabs.push(t));
      } else {
        for (const raw of activeKeys) {
          const tabMatch = raw.match(/^(?:tab:)?(?:yearly[-_]profile:?|yearly[-_]profile[-_]tab:?)(.+)$/);
          if (tabMatch && ALL_YEARLY_PROFILE_TABS.includes(tabMatch[1] as any)) {
            assignedTabs.push(tabMatch[1]);
          }
        }
        if (
          (activeKeys.some((k) => k.includes("counsellor") || k.includes("counselor"))) &&
          !assignedTabs.includes("counselling")
        ) {
          assignedTabs.push("counselling");
        }
        if (
          activeKeys.some((k) => k.includes("talabat-profiles-remarks")) &&
          assignedTabs.length === 0
        ) {
          ALL_YEARLY_PROFILE_TABS.forEach((t) => assignedTabs.push(t));
        }
      }

      return {
        teacherId: tp.id,
        userId: tp.user.id,
        name: `${tp.user.firstName} ${tp.user.lastName}`.trim(),
        email: tp.user.email,
        avatarUrl: tp.user.avatarUrl,
        isAllTabs: isAll || assignedTabs.length === ALL_YEARLY_PROFILE_TABS.length,
        assignedTabs: Array.from(new Set(assignedTabs)),
      };
    });

    return res.json({
      success: true,
      teachers: result,
      availableTabs: ALL_YEARLY_PROFILE_TABS,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch tab assignments" });
  }
});

// ── POST /api/talabat-profile/tab-assignments (Admin only) ──
// Save tab assignments: supports either per-teacher { teacherId, tabs, isAll } or per-tab { tabKey, teacherIds }
router.post("/tab-assignments", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }

  const { teacherId, tabs, isAll, tabKey, teacherIds } = req.body || {};

  try {
    // Mode A: Assign teachers to a specific tab
    if (tabKey && Array.isArray(teacherIds)) {
      if (!ALL_YEARLY_PROFILE_TABS.includes(tabKey as any)) {
        return res.status(400).json({ success: false, error: `Invalid tabKey: ${tabKey}` });
      }

      const allTeachers = await prisma.teacherProfile.findMany({
        where: { user: { isActive: true, deletedAt: null } },
        select: { id: true },
      });

      const selectedSet = new Set(teacherIds);

      for (const t of allTeachers) {
        if (selectedSet.has(t.id)) {
          // Ensure assignment exists
          const existing = await prisma.teacherPortalAssignment.findFirst({
            where: {
              teacherId: t.id,
              portalType: `TAB:yearly-profile:${tabKey}`,
              isActive: true,
            },
          });
          if (!existing) {
            await prisma.teacherPortalAssignment.create({
              data: {
                teacherId: t.id,
                portalType: `TAB:yearly-profile:${tabKey}`,
                isActive: true,
                assignedById: session.user.id,
              },
            });
          }
        } else {
          // Remove this specific tab assignment
          await prisma.teacherPortalAssignment.deleteMany({
            where: {
              teacherId: t.id,
              portalType: `TAB:yearly-profile:${tabKey}`,
            },
          });
        }
      }

      return res.json({
        success: true,
        message: `Incharge faculty updated for tab: ${tabKey}`,
      });
    }

    // Mode B: Assign tabs to a specific teacher
    if (!teacherId) {
      return res.status(400).json({ success: false, error: "teacherId or tabKey is required" });
    }

    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // Remove previous yearly profile tab assignments for this teacher
    await prisma.teacherPortalAssignment.deleteMany({
      where: {
        teacherId: teacher.id,
        OR: [
          { portalType: { startsWith: "TAB:yearly-profile:" } },
          { portalType: { startsWith: "yearly-profile-tab:" } },
          { portalType: "PAGE:talabat-profiles-remarks" },
        ],
      },
    });

    if (isAll) {
      await prisma.teacherPortalAssignment.create({
        data: {
          teacherId: teacher.id,
          portalType: "PAGE:talabat-profiles-remarks",
          isActive: true,
          assignedById: session.user.id,
        },
      });
    } else if (Array.isArray(tabs) && tabs.length > 0) {
      const validTabs = tabs.filter((t: string) => ALL_YEARLY_PROFILE_TABS.includes(t as any));
      for (const tab of validTabs) {
        await prisma.teacherPortalAssignment.create({
          data: {
            teacherId: teacher.id,
            portalType: `TAB:yearly-profile:${tab}`,
            isActive: true,
            assignedById: session.user.id,
          },
        });
      }
    }

    return res.json({
      success: true,
      message: "Tab delegation updated successfully!",
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to update tab assignments" });
  }
});

// ── PUT /api/talabat-profile/remarks/:studentId ──
// For Admin and Teachers: Save assigned tab remarks and ratings
router.put("/remarks/:studentId", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const perms = await getTeacherPermissions(session.user.id, session.user.role);

  if (!perms.canEditRemarks) {
    return res.status(403).json({
      success: false,
      error: "Access denied. You do not have any Yearly Profile tabs assigned by administration to edit.",
    });
  }

  const { studentId } = req.params;
  const student = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { id: studentId },
        { studentId: studentId },
        { userId: studentId },
      ],
    },
    include: { user: true, talabatProfile1447: true },
  });

  if (!student) {
    return res.status(404).json({ success: false, error: "Student not found" });
  }

  const body = req.body || {};
  const allowedTabs = new Set(perms.assignedTabs || []);

  const updateFields: any = {
    reviewedById: session.user.id,
    reviewedAt: new Date(),
    status: body.status || (student.talabatProfile1447?.status === "SUBMITTED" ? "REVIEWED" : student.talabatProfile1447?.status || "REVIEWED"),
  };

  // Strictly permit editing ONLY fields associated with teacher's assigned tabs
  if (perms.isAllTabs || allowedTabs.has("ratings")) {
    if (body.behaviourRating !== undefined) updateFields.behaviourRating = parseInt(String(body.behaviourRating), 10) || null;
    if (body.communicationRating !== undefined) updateFields.communicationRating = parseInt(String(body.communicationRating), 10) || null;
    if (body.dedicationRating !== undefined) updateFields.dedicationRating = parseInt(String(body.dedicationRating), 10) || null;
    if (body.disciplineRating !== undefined) updateFields.disciplineRating = parseInt(String(body.disciplineRating), 10) || null;
  }

  if (perms.isAllTabs || allowedTabs.has("masool")) {
    if (body.masoolRemarks !== undefined) updateFields.masoolRemarks = body.masoolRemarks;
    if (body.remarksMasool !== undefined) updateFields.remarksMasool = body.remarksMasool;
  }

  if (perms.isAllTabs || allowedTabs.has("tahfeez")) {
    if (body.remarksTahfeez !== undefined) updateFields.remarksTahfeez = body.remarksTahfeez;
  }

  if (perms.isAllTabs || allowedTabs.has("taleem")) {
    if (body.remarksTaleem !== undefined) updateFields.remarksTaleem = body.remarksTaleem;
  }

  if (perms.isAllTabs || allowedTabs.has("tadeeb")) {
    if (body.remarksTadeeb !== undefined) updateFields.remarksTadeeb = body.remarksTadeeb;
  }

  if (perms.isAllTabs || allowedTabs.has("tanzeem")) {
    if (body.remarksTanzeem !== undefined) updateFields.remarksTanzeem = body.remarksTanzeem;
  }

  if (perms.isAllTabs || allowedTabs.has("sports")) {
    if (body.remarksSports !== undefined) updateFields.remarksSports = body.remarksSports;
  }

  if (perms.isAllTabs || allowedTabs.has("maktabat")) {
    if (body.remarksMaktabat !== undefined) updateFields.remarksMaktabat = body.remarksMaktabat;
  }

  if (perms.isAllTabs || allowedTabs.has("skills")) {
    if (body.remarksSkills !== undefined) updateFields.remarksSkills = body.remarksSkills;
  }

  if (perms.isAllTabs || allowedTabs.has("otherExams")) {
    if (body.remarksOtherExams !== undefined) updateFields.remarksOtherExams = body.remarksOtherExams;
  }

  if (perms.isAllTabs || allowedTabs.has("counselling")) {
    if (body.remarksCounselling !== undefined) updateFields.remarksCounselling = body.remarksCounselling;
    if (body.counsellingNotes !== undefined) updateFields.counsellingNotes = body.counsellingNotes;
  }

  const saved = await prisma.talabatProfile1447.upsert({
    where: { studentId: student.id },
    create: {
      studentId: student.id,
      year: "1447 H",
      status: "REVIEWED",
      name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      itsNo: student.its || null,
      idNo: student.studentId || null,
      ...updateFields,
    },
    update: updateFields,
  });

  // Notify Student and Parents of faculty remarks & performance evaluation
  const remarksStudentName = `${student.user.firstName} ${student.user.lastName}`.trim();
  const evaluationTitle = `🌟 Faculty Remarks & Evaluation (1447 H): ${remarksStudentName}`;
  const evaluationBody = `Institutional evaluation remarks have been recorded for ${remarksStudentName}. Review the full report.`;
  notifyStudentAndParents(student.id, evaluationTitle, evaluationBody, "/talabat/profile-1447").catch(() => {});

  return res.json({
    success: true,
    data: saved,
    message: "Evaluation saved successfully!",
  });
});

// ── PUT /api/talabat-profile/admin/profile/:studentId ──
// For Admin and Teachers: Update student profile details (including photos)
router.put("/admin/profile/:studentId", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const { studentId } = req.params;
  const student = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { id: studentId },
        { studentId: studentId },
        { userId: studentId },
      ],
    },
    include: { user: true, talabatProfile1447: true },
  });

  if (!student) {
    return res.status(404).json({ success: false, error: "Student not found" });
  }

  const body = req.body || {};
  const dataToUpdate: any = {};
  if (body.studentPhotoUrl !== undefined) dataToUpdate.studentPhotoUrl = normalizePhotoUrl(body.studentPhotoUrl);
  if (body.fatherPhotoUrl !== undefined) dataToUpdate.fatherPhotoUrl = normalizePhotoUrl(body.fatherPhotoUrl);
  if (body.fatherName !== undefined) dataToUpdate.fatherName = body.fatherName || null;
  if (body.fatherOccupation !== undefined) dataToUpdate.fatherOccupation = body.fatherOccupation || null;
  if (body.motherPhotoUrl !== undefined) dataToUpdate.motherPhotoUrl = normalizePhotoUrl(body.motherPhotoUrl);
  if (body.motherName !== undefined) dataToUpdate.motherName = body.motherName || null;
  if (body.motherOccupation !== undefined) dataToUpdate.motherOccupation = body.motherOccupation || null;
  if (body.name !== undefined) dataToUpdate.name = body.name || null;
  if (body.itsNo !== undefined) dataToUpdate.itsNo = body.itsNo || null;
  if (body.idNo !== undefined) dataToUpdate.idNo = body.idNo || null;
  if (body.jamaat !== undefined) dataToUpdate.jamaat = body.jamaat || null;
  if (body.vatan !== undefined) dataToUpdate.vatan = body.vatan || null;
  if (body.nationality !== undefined) dataToUpdate.nationality = body.nationality || "Indian";
  if (body.dob !== undefined) dataToUpdate.dob = body.dob || null;
  if (body.age !== undefined) dataToUpdate.age = body.age ? parseInt(String(body.age), 10) : null;
  if (body.result1444 !== undefined) dataToUpdate.result1444 = body.result1444 || null;
  if (body.result1445 !== undefined) dataToUpdate.result1445 = body.result1445 || null;
  if (body.result1446 !== undefined) dataToUpdate.result1446 = body.result1446 || null;
  if (body.result1447 !== undefined) dataToUpdate.result1447 = body.result1447 || null;
  if (body.hifzYear !== undefined) dataToUpdate.hifzYear = body.hifzYear || null;
  if (body.hifzTabaqa !== undefined) dataToUpdate.hifzTabaqa = body.hifzTabaqa || null;
  if (body.course1 !== undefined) dataToUpdate.course1 = body.course1 || null;
  if (body.course2 !== undefined) dataToUpdate.course2 = body.course2 || null;
  if (body.course3 !== undefined) dataToUpdate.course3 = body.course3 || null;
  if (body.course4 !== undefined) dataToUpdate.course4 = body.course4 || null;
  if (body.activities !== undefined) dataToUpdate.activities = body.activities || null;
  if (body.otherExams !== undefined) dataToUpdate.otherExams = body.otherExams || null;
  if (body.strengths !== undefined) {
    dataToUpdate.strengths = Array.isArray(body.strengths)
      ? body.strengths.map((s: any) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
      : [];
  }
  if (body.weaknesses !== undefined) {
    dataToUpdate.weaknesses = Array.isArray(body.weaknesses)
      ? body.weaknesses.map((w: any) => (typeof w === "string" ? w.trim() : "")).filter(Boolean)
      : [];
  }
  if (body.aboutMyself !== undefined) dataToUpdate.aboutMyself = body.aboutMyself || null;
  if (body.reallyGoodAt !== undefined) dataToUpdate.reallyGoodAt = body.reallyGoodAt ? String(body.reallyGoodAt).trim() : null;
  if (body.loveToStudy !== undefined) dataToUpdate.loveToStudy = body.loveToStudy ? String(body.loveToStudy).trim() : null;
  if (body.loveForFun !== undefined) dataToUpdate.loveForFun = body.loveForFun ? String(body.loveForFun).trim() : null;
  if (body.status !== undefined) dataToUpdate.status = body.status;

  const saved = await prisma.talabatProfile1447.upsert({
    where: { studentId: student.id },
    create: {
      studentId: student.id,
      year: "1447 H",
      status: body.status || "DRAFT",
      name: body.name || `${student.user.firstName} ${student.user.lastName}`.trim(),
      itsNo: body.itsNo || student.its || null,
      idNo: body.idNo || student.studentId || null,
      ...dataToUpdate,
    },
    update: dataToUpdate,
  });

  // Sync basic profile fields to StudentProfile
  const spUpdates: any = {};
  if (body.fatherName) spUpdates.fatherName = body.fatherName.trim();
  if (body.fatherOccupation) spUpdates.fatherOccupation = body.fatherOccupation.trim();
  if (body.motherName) spUpdates.motherName = body.motherName.trim();
  if (body.vatan) spUpdates.watan = body.vatan.trim();
  if (body.jamaat) spUpdates.residentCity = body.jamaat.trim();
  if (body.address) spUpdates.address = body.address.trim();
  if (body.mobileNumber) spUpdates.mobileNumber = body.mobileNumber.trim();
  if (body.externalSchooling) spUpdates.externalSchooling = body.externalSchooling.trim();
  if (body.reallyGoodAt !== undefined) spUpdates.reallyGoodAt = body.reallyGoodAt ? String(body.reallyGoodAt).trim() : null;
  if (body.loveToStudy !== undefined) spUpdates.loveToStudy = body.loveToStudy ? String(body.loveToStudy).trim() : null;
  if (body.loveForFun !== undefined) spUpdates.loveForFun = body.loveForFun ? String(body.loveForFun).trim() : null;
  if (Object.keys(spUpdates).length > 0) {
    await prisma.studentProfile.update({
      where: { id: student.id },
      data: spUpdates,
    }).catch(() => {});
  }

  const effectiveAdminStudentPhoto = dataToUpdate.studentPhotoUrl || (body.studentPhotoUrl ? normalizePhotoUrl(body.studentPhotoUrl) : null);
  if (effectiveAdminStudentPhoto) {
    await prisma.user.update({
      where: { id: student.user.id },
      data: { avatarUrl: effectiveAdminStudentPhoto },
    }).catch(() => {});
  }

  // Sync parent photos to linked ParentProfile user accounts
  const effectiveAdminFatherPhoto = dataToUpdate.fatherPhotoUrl || (body.fatherPhotoUrl ? normalizePhotoUrl(body.fatherPhotoUrl) : null);
  if (effectiveAdminFatherPhoto) {
    const fatherLinks = await prisma.parentStudentLink.findMany({
      where: {
        studentId: student.id,
        OR: [
          { relationship: { contains: "father", mode: "insensitive" } },
          { parent: { relationType: { contains: "father", mode: "insensitive" } } },
        ],
      },
      include: { parent: { include: { user: true } } },
    }).catch(() => []);
    for (const link of fatherLinks) {
      if (link.parent?.user?.id) {
        await prisma.user.update({
          where: { id: link.parent.user.id },
          data: { avatarUrl: effectiveAdminFatherPhoto },
        }).catch(() => {});
      }
    }
  }

  const effectiveAdminMotherPhoto = dataToUpdate.motherPhotoUrl || (body.motherPhotoUrl ? normalizePhotoUrl(body.motherPhotoUrl) : null);
  if (effectiveAdminMotherPhoto) {
    const motherLinks = await prisma.parentStudentLink.findMany({
      where: {
        studentId: student.id,
        OR: [
          { relationship: { contains: "mother", mode: "insensitive" } },
          { parent: { relationType: { contains: "mother", mode: "insensitive" } } },
        ],
      },
      include: { parent: { include: { user: true } } },
    }).catch(() => []);
    for (const link of motherLinks) {
      if (link.parent?.user?.id) {
        await prisma.user.update({
          where: { id: link.parent.user.id },
          data: { avatarUrl: effectiveAdminMotherPhoto },
        }).catch(() => {});
      }
    }
  }

  // Dispatch in-portal notification for student and linked parents
  const adminUpdatedStudentName = `${student.user.firstName} ${student.user.lastName}`.trim();
  const updateTitle = `✏️ 1447 H Profile Record Updated: ${adminUpdatedStudentName}`;
  const updateBody = `Administrative details, academic results, or evaluation records for ${adminUpdatedStudentName} have been updated. View your profile.`;
  notifyStudentAndParents(student.id, updateTitle, updateBody, "/talabat/profile-1447").catch(() => {});

  return res.json({
    success: true,
    data: saved,
    message: "Student profile updated successfully!",
  });
});

// ── GET /api/talabat-profile/teaching-faculty ──
// For Admin: Get all teachers who have assigned subjects for teaching
router.get("/teaching-faculty", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Access denied: Admin only" });
  }

  const teachers = await prisma.teacherProfile.findMany({
    where: {
      user: { isActive: true, deletedAt: null },
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, isActive: true },
      },
      portalAssignments: { where: { isActive: true } },
      classes: { select: { id: true, name: true, grade: true } },
      masoolClasses: { select: { id: true, name: true, grade: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  });

  // Query timetable slots to identify assigned teaching subjects
  const timetableSlots = await prisma.timetableSlot.findMany({
    where: {
      subject: { not: "" },
    },
    select: {
      teacherId: true,
      subject: true,
    },
  });

  const slotsMap: Record<string, Set<string>> = {};
  for (const slot of timetableSlots) {
    if (slot.subject) {
      const sub = slot.subject.trim();
      if (slot.teacherId) {
        if (!slotsMap[slot.teacherId]) slotsMap[slot.teacherId] = new Set();
        slotsMap[slot.teacherId].add(sub);
      }
    }
  }

  // Filter and map ONLY teachers who have been assigned subjects for teaching
  const teachingFaculty = teachers
    .map((t) => {
      const explicitSubjects = Array.isArray(t.subjects) ? t.subjects.filter(Boolean) : [];
      const fromId = slotsMap[t.id] ? Array.from(slotsMap[t.id]) : [];
      const fromUserId = slotsMap[t.userId] ? Array.from(slotsMap[t.userId]) : [];
      const allSubjects = Array.from(new Set([...explicitSubjects, ...fromId, ...fromUserId]));

      const activeAssignments = t.portalAssignments.map((a) =>
        a.portalType.trim().toLowerCase().replace(/^page:/, "")
      );
      const isAll = t.portalAssignments.some((a) => a.portalType === "ALL" || a.portalType === "*");
      const canEditRemarks =
        isAll ||
        activeAssignments.includes("talabat-profiles-remarks") ||
        activeAssignments.includes("remarks-edit");
      const canEditCounsellor =
        isAll ||
        activeAssignments.includes("counsellor-remarks") ||
        activeAssignments.includes("counsellor");

      return {
        id: t.userId,
        teacherProfileId: t.id,
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        email: t.user.email,
        employeeId: t.employeeId,
        its: t.its || t.employeeId,
        department: t.department || "Faculty",
        avatarUrl: t.user.avatarUrl || t.photoUrl,
        subjects: allSubjects,
        hasAssignedSubjects: allSubjects.length > 0,
        classes: t.classes.map((c) => c.name),
        masoolClasses: t.masoolClasses.map((c) => c.name),
        canEditRemarks,
        canEditCounsellor,
        isMasterAdmin: isAll,
      };
    })
    .filter((t) => t.hasAssignedSubjects); // STRICTLY ONLY TEACHERS WITH ASSIGNED TEACHING SUBJECTS

  return res.json({
    success: true,
    total: teachingFaculty.length,
    faculty: teachingFaculty,
  });
});

// ── POST /api/talabat-profile/assign-faculty-remarks ──
// For Admin: Assign or revoke remarks editing and counsellor access for teaching faculty
router.post("/assign-faculty-remarks", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Access denied: Admin only" });
  }

  const { teacherUserId, teacherProfileId, canEditRemarks, canEditCounsellor } = req.body || {};

  const teacher = await prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { id: teacherProfileId || undefined },
        { userId: teacherUserId || undefined },
      ],
    },
    include: { user: true },
  });

  if (!teacher) {
    return res.status(404).json({ success: false, error: "Teacher not found" });
  }

  // Manage talabat-profiles-remarks
  if (canEditRemarks !== undefined) {
    if (canEditRemarks) {
      await prisma.teacherPortalAssignment.upsert({
        where: {
          teacherId_portalType: {
            teacherId: teacher.id,
            portalType: "PAGE:talabat-profiles-remarks",
          },
        },
        create: {
          teacherId: teacher.id,
          portalType: "PAGE:talabat-profiles-remarks",
          assignedById: session.user.id,
          isActive: true,
        },
        update: {
          isActive: true,
          assignedById: session.user.id,
        },
      });
      // Also ensure PAGE:talabat-profiles access exists so they can view the Yearly Profile page
      await prisma.teacherPortalAssignment.upsert({
        where: {
          teacherId_portalType: {
            teacherId: teacher.id,
            portalType: "PAGE:talabat-profiles",
          },
        },
        create: {
          teacherId: teacher.id,
          portalType: "PAGE:talabat-profiles",
          assignedById: session.user.id,
          isActive: true,
        },
        update: {
          isActive: true,
          assignedById: session.user.id,
        },
      });
    } else {
      await prisma.teacherPortalAssignment.deleteMany({
        where: {
          teacherId: teacher.id,
          portalType: { in: ["PAGE:talabat-profiles-remarks", "talabat-profiles-remarks", "remarks-edit"] },
        },
      });
    }
  }

  // Manage counsellor-remarks
  if (canEditCounsellor !== undefined) {
    if (canEditCounsellor) {
      await prisma.teacherPortalAssignment.upsert({
        where: {
          teacherId_portalType: {
            teacherId: teacher.id,
            portalType: "PAGE:counsellor-remarks",
          },
        },
        create: {
          teacherId: teacher.id,
          portalType: "PAGE:counsellor-remarks",
          assignedById: session.user.id,
          isActive: true,
        },
        update: {
          isActive: true,
          assignedById: session.user.id,
        },
      });
      await prisma.teacherPortalAssignment.upsert({
        where: {
          teacherId_portalType: {
            teacherId: teacher.id,
            portalType: "PAGE:talabat-profiles",
          },
        },
        create: {
          teacherId: teacher.id,
          portalType: "PAGE:talabat-profiles",
          assignedById: session.user.id,
          isActive: true,
        },
        update: {
          isActive: true,
          assignedById: session.user.id,
        },
      });
    } else {
      await prisma.teacherPortalAssignment.deleteMany({
        where: {
          teacherId: teacher.id,
          portalType: { in: ["PAGE:counsellor-remarks", "counsellor-remarks", "counsellor"] },
        },
      });
    }
  }

  return res.json({
    success: true,
    message: `Yearly Profile remarks privileges updated for ${teacher.user.firstName} ${teacher.user.lastName}`,
  });
});

export default router;
