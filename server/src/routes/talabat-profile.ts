import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware";

const router = Router();

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
        message: "None of your assigned children are currently in Darajah 4 (Rabea).",
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
        message: `${sp.user?.firstName || "This student"} is not enrolled in Darajah 4 (Rabea). The Yearly Profile is only for Rabea students.`,
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
    }

    return res.json({
      success: true,
      isGrade4: true,
      isParent: true,
      isReadOnly: true,
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
    return res.status(403).json({
      success: false,
      error: "Parents have view-only access to the Yearly Profile and cannot edit or fill the form.",
    });
  }

  if (session.user.role === "ADMIN" && body.studentId) {
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

  const strengths = Array.isArray(body.strengths) ? body.strengths.filter((s: any) => typeof s === "string" && s.trim().length > 0) : undefined;
  const weaknesses = Array.isArray(body.weaknesses) ? body.weaknesses.filter((w: any) => typeof w === "string" && w.trim().length > 0) : undefined;

  const updateData: any = {};
  if (body.year !== undefined) updateData.year = body.year || "1447 H";
  if (body.status !== undefined) updateData.status = status;
  if (body.studentPhotoUrl !== undefined) updateData.studentPhotoUrl = body.studentPhotoUrl || null;
  if (body.name !== undefined) updateData.name = body.name || null;
  if (body.itsNo !== undefined) updateData.itsNo = body.itsNo || null;
  if (body.idNo !== undefined) updateData.idNo = body.idNo || null;
  if (body.jamaat !== undefined) updateData.jamaat = body.jamaat || null;
  if (body.vatan !== undefined) updateData.vatan = body.vatan || null;
  if (body.nationality !== undefined) updateData.nationality = body.nationality || "Indian";
  if (body.dob !== undefined) updateData.dob = body.dob || null;
  if (body.age !== undefined) updateData.age = body.age ? parseInt(String(body.age), 10) : null;
  if (body.fatherPhotoUrl !== undefined) updateData.fatherPhotoUrl = body.fatherPhotoUrl || null;
  if (body.fatherName !== undefined) updateData.fatherName = body.fatherName || null;
  if (body.fatherOccupation !== undefined) updateData.fatherOccupation = body.fatherOccupation || null;
  if (body.motherPhotoUrl !== undefined) updateData.motherPhotoUrl = body.motherPhotoUrl || null;
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

  const createData = {
    year: body.year || "1447 H",
    status,
    studentPhotoUrl: body.studentPhotoUrl || targetUserAvatar || null,
    name: body.name || null,
    itsNo: body.itsNo || null,
    idNo: body.idNo || null,
    jamaat: body.jamaat || null,
    vatan: body.vatan || null,
    nationality: body.nationality || "Indian",
    dob: body.dob || null,
    age: body.age ? parseInt(String(body.age), 10) : null,
    fatherPhotoUrl: body.fatherPhotoUrl || null,
    fatherName: body.fatherName || null,
    fatherOccupation: body.fatherOccupation || null,
    motherPhotoUrl: body.motherPhotoUrl || null,
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

  if (Object.keys(studentProfileUpdates).length > 0) {
    await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: studentProfileUpdates,
    }).catch(() => {});
  }

  // Sync avatar to User if provided and changed
  if (body.studentPhotoUrl && targetUserId && body.studentPhotoUrl !== targetUserAvatar) {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { avatarUrl: body.studentPhotoUrl },
    }).catch(() => {});
  }

  // Sync parent photos to linked ParentProfile user accounts
  if (studentProfileId) {
    if (body.fatherPhotoUrl) {
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
            data: { avatarUrl: body.fatherPhotoUrl },
          }).catch(() => {});
        }
      }
    }
    if (body.motherPhotoUrl) {
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
            data: { avatarUrl: body.motherPhotoUrl },
          }).catch(() => {});
        }
      }
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

  const formatted = students.map((s) => ({
    studentId: s.id,
    idNo: s.studentId,
    its: s.its,
    name: `${s.user.firstName} ${s.user.lastName}`.trim(),
    email: s.user.email,
    avatarUrl: s.talabatProfile1447?.studentPhotoUrl || s.user.avatarUrl,
    grade: s.grade,
    section: s.section,
    status: s.talabatProfile1447?.status || "NOT_STARTED",
    hasProfile: !!s.talabatProfile1447,
    profileId: s.talabatProfile1447?.id || null,
    studentPhotoUrl: s.talabatProfile1447?.studentPhotoUrl || s.user.avatarUrl || null,
    fatherPhotoUrl: s.talabatProfile1447?.fatherPhotoUrl || null,
    motherPhotoUrl: s.talabatProfile1447?.motherPhotoUrl || null,
    fatherName: s.talabatProfile1447?.fatherName || s.fatherName || null,
    motherName: s.talabatProfile1447?.motherName || s.motherName || null,
    hasStudentPhoto: !!(s.talabatProfile1447?.studentPhotoUrl || s.user.avatarUrl),
    hasFatherPhoto: !!s.talabatProfile1447?.fatherPhotoUrl,
    hasMotherPhoto: !!s.talabatProfile1447?.motherPhotoUrl,
    ratings: s.talabatProfile1447 ? {
      behaviour: s.talabatProfile1447.behaviourRating,
      communication: s.talabatProfile1447.communicationRating,
      dedication: s.talabatProfile1447.dedicationRating,
      discipline: s.talabatProfile1447.disciplineRating,
      hasRemarks: !!s.talabatProfile1447.masoolRemarks,
    } : null,
    updatedAt: s.talabatProfile1447?.updatedAt || null,
  }));

  return res.json({
    success: true,
    total: formatted.length,
    students: formatted,
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
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
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
    // Return placeholder
    profile = {
      id: "",
      studentId: student.id,
      year: "1447 H",
      status: "NOT_STARTED",
      studentPhotoUrl: student.user.avatarUrl || null,
      name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      itsNo: student.its || "",
      idNo: student.studentId || student.trNo || "",
      jamaat: student.residentCity || student.watan || "",
      vatan: student.watan || "",
      nationality: "Indian",
      dob: student.dobGregorian ? new Date(student.dobGregorian).toISOString().split("T")[0] : student.dobHijri || "",
      age: student.age || null,
      fatherPhotoUrl: null,
      fatherName: student.fatherName || "",
      fatherOccupation: student.fatherOccupation || "",
      motherPhotoUrl: null,
      motherName: student.motherName || "",
      motherOccupation: "Homemaker",
      result1444: "",
      result1445: "",
      result1446: "",
      result1447: "",
      hifzYear: student.hafizYear || "",
      hifzTabaqa: "",
      course1: "",
      course2: "",
      course3: "",
      course4: "",
      activities: "",
      otherExams: "",
      strengths: [],
      weaknesses: [],
      aboutMyself: "",
      behaviourRating: null,
      communicationRating: null,
      dedicationRating: null,
      disciplineRating: null,
      masoolRemarks: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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

  return res.json({
    success: true,
    profile,
    studentInfo: {
      id: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      grade: student.grade,
      section: student.section,
      its: student.its,
      email: student.user.email,
      avatarUrl: student.user.avatarUrl,
    },
    reviewerName,
  });
});

// ── PUT /api/talabat-profile/remarks/:studentId ──
// For Admin and Teachers: Save Masul Collective Remarks & Ratings (1-5)
router.put("/remarks/:studentId", requireAuth, async (req, res) => {
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
  const behaviourRating = body.behaviourRating !== undefined ? parseInt(String(body.behaviourRating), 10) || null : undefined;
  const communicationRating = body.communicationRating !== undefined ? parseInt(String(body.communicationRating), 10) || null : undefined;
  const dedicationRating = body.dedicationRating !== undefined ? parseInt(String(body.dedicationRating), 10) || null : undefined;
  const disciplineRating = body.disciplineRating !== undefined ? parseInt(String(body.disciplineRating), 10) || null : undefined;
  
  const updateFields: any = {
    reviewedById: session.user.id,
    reviewedAt: new Date(),
    status: student.talabatProfile1447?.status === "SUBMITTED" ? "REVIEWED" : student.talabatProfile1447?.status || "REVIEWED",
  };

  if (behaviourRating !== undefined) updateFields.behaviourRating = behaviourRating;
  if (communicationRating !== undefined) updateFields.communicationRating = communicationRating;
  if (dedicationRating !== undefined) updateFields.dedicationRating = dedicationRating;
  if (disciplineRating !== undefined) updateFields.disciplineRating = disciplineRating;
  
  if (body.masoolRemarks !== undefined) updateFields.masoolRemarks = body.masoolRemarks;
  if (body.remarksMasool !== undefined) updateFields.remarksMasool = body.remarksMasool;
  if (body.remarksTahfeez !== undefined) updateFields.remarksTahfeez = body.remarksTahfeez;
  if (body.remarksTaleem !== undefined) updateFields.remarksTaleem = body.remarksTaleem;
  if (body.remarksTadeeb !== undefined) updateFields.remarksTadeeb = body.remarksTadeeb;
  if (body.remarksTanzeem !== undefined) updateFields.remarksTanzeem = body.remarksTanzeem;
  if (body.remarksSports !== undefined) updateFields.remarksSports = body.remarksSports;
  if (body.remarksMaktabat !== undefined) updateFields.remarksMaktabat = body.remarksMaktabat;
  if (body.remarksSkills !== undefined) updateFields.remarksSkills = body.remarksSkills;
  if (body.remarksOtherExams !== undefined) updateFields.remarksOtherExams = body.remarksOtherExams;
  if (body.remarksCounselling !== undefined) updateFields.remarksCounselling = body.remarksCounselling;
  if (body.counsellingNotes !== undefined) updateFields.counsellingNotes = body.counsellingNotes;

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

  return res.json({
    success: true,
    data: saved,
    message: "Masul remarks and ratings saved successfully!",
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
  if (body.studentPhotoUrl !== undefined) dataToUpdate.studentPhotoUrl = body.studentPhotoUrl || null;
  if (body.fatherPhotoUrl !== undefined) dataToUpdate.fatherPhotoUrl = body.fatherPhotoUrl || null;
  if (body.fatherName !== undefined) dataToUpdate.fatherName = body.fatherName || null;
  if (body.fatherOccupation !== undefined) dataToUpdate.fatherOccupation = body.fatherOccupation || null;
  if (body.motherPhotoUrl !== undefined) dataToUpdate.motherPhotoUrl = body.motherPhotoUrl || null;
  if (body.motherName !== undefined) dataToUpdate.motherName = body.motherName || null;
  if (body.motherOccupation !== undefined) dataToUpdate.motherOccupation = body.motherOccupation || null;
  if (body.name !== undefined) dataToUpdate.name = body.name || null;
  if (body.itsNo !== undefined) dataToUpdate.itsNo = body.itsNo || null;
  if (body.idNo !== undefined) dataToUpdate.idNo = body.idNo || null;
  if (body.jamaat !== undefined) dataToUpdate.jamaat = body.jamaat || null;
  if (body.vatan !== undefined) dataToUpdate.vatan = body.vatan || null;
  if (body.status !== undefined) dataToUpdate.status = body.status;

  const saved = await prisma.talabatProfile1447.upsert({
    where: { studentId: student.id },
    create: {
      studentId: student.id,
      year: "1447 H",
      status: "DRAFT",
      name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      itsNo: student.its || null,
      idNo: student.studentId || null,
      ...dataToUpdate,
    },
    update: dataToUpdate,
  });

  if (body.studentPhotoUrl) {
    await prisma.user.update({
      where: { id: student.user.id },
      data: { avatarUrl: body.studentPhotoUrl },
    }).catch(() => {});
  }

  // Sync parent photos to linked ParentProfile user accounts
  if (body.fatherPhotoUrl) {
    const fatherLinks = await prisma.parentStudentLink.findMany({
      where: {
        studentId,
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
          data: { avatarUrl: body.fatherPhotoUrl },
        }).catch(() => {});
      }
    }
  }
  if (body.motherPhotoUrl) {
    const motherLinks = await prisma.parentStudentLink.findMany({
      where: {
        studentId,
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
          data: { avatarUrl: body.motherPhotoUrl },
        }).catch(() => {});
      }
    }
  }

  return res.json({
    success: true,
    data: saved,
    message: "Student profile updated successfully!",
  });
});

export default router;
