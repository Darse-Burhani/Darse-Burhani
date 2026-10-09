import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware";

const router = Router();

function isGrade4(grade?: string | null): boolean {
  if (!grade) return false;
  const g = grade.trim().toLowerCase();
  return g === "4" || g === "darajah 4" || g === "grade 4" || g === "class 4" || g === "iv" || g === "4th";
}

// ── GET /api/talabat-profile/me ──
// For logged in student: check if Grade 4, return their profile (or prefilled defaults)
router.get("/me", requireAuth, async (req, res) => {
  const session = req.auth!;
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
  const grade4 = isGrade4(sp.grade);

  if (!grade4) {
    return res.json({
      success: true,
      isGrade4: false,
      message: "The 1447 H Talabat Profile (توجيه الطالب) is only available for Darajah 4 students.",
    });
  }

  let profile = sp.talabatProfile1447;
  if (!profile) {
    // Generate prefilled draft
    profile = {
      id: "",
      studentId: sp.id,
      year: "1447 H",
      status: "DRAFT",
      studentPhotoUrl: user.avatarUrl || null,
      name: `${user.firstName} ${user.lastName}`.trim(),
      itsNo: sp.its || "",
      idNo: sp.studentId || sp.trNo || "",
      jamaat: sp.residentCity || sp.watan || "",
      vatan: sp.watan || "",
      nationality: "Indian",
      dob: sp.dobGregorian ? new Date(sp.dobGregorian).toISOString().split("T")[0] : sp.dobHijri || "",
      age: sp.age || null,
      fatherPhotoUrl: null,
      fatherName: sp.fatherName || "",
      fatherOccupation: sp.fatherOccupation || "",
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
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  }

  return res.json({
    success: true,
    isGrade4: true,
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
// Save or Submit Student's 1447 H Profile
router.put("/me", requireAuth, async (req, res) => {
  const session = req.auth!;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { studentProfile: true },
  });

  if (!user || !user.studentProfile) {
    return res.status(404).json({ success: false, error: "Student profile not found" });
  }

  const sp = user.studentProfile;
  if (!isGrade4(sp.grade) && session.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Only Darajah 4 Talabat can fill this form." });
  }

  const body = req.body || {};
  const status = body.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT";

  const strengths = Array.isArray(body.strengths) ? body.strengths.filter((s: any) => typeof s === "string" && s.trim().length > 0) : [];
  const weaknesses = Array.isArray(body.weaknesses) ? body.weaknesses.filter((w: any) => typeof w === "string" && w.trim().length > 0) : [];

  const dataToSave = {
    year: body.year || "1447 H",
    status,
    studentPhotoUrl: body.studentPhotoUrl || user.avatarUrl || null,
    name: body.name || `${user.firstName} ${user.lastName}`.trim(),
    itsNo: body.itsNo || sp.its || null,
    idNo: body.idNo || sp.studentId || null,
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
    strengths,
    weaknesses,
    aboutMyself: body.aboutMyself || null,
  };

  const saved = await prisma.talabatProfile1447.upsert({
    where: { studentId: sp.id },
    create: {
      studentId: sp.id,
      ...dataToSave,
    },
    update: dataToSave,
  });

  // Sync basic fields to StudentProfile & User avatar if provided
  if (body.studentPhotoUrl && body.studentPhotoUrl !== user.avatarUrl) {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: body.studentPhotoUrl },
    }).catch(() => {});
  }

  return res.json({
    success: true,
    data: saved,
    message: status === "SUBMITTED" ? "Talabat profile submitted successfully!" : "Draft saved successfully.",
  });
});

// ── GET /api/talabat-profile/list ──
// For Admin and Teachers: List all Darajah 4 students and their profiles
router.get("/list", requireAuth, async (req, res) => {
  const session = req.auth!;
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  // Find all Grade 4 students
  const students = await prisma.studentProfile.findMany({
    where: {
      grade: {
        in: ["4", "Darajah 4", "Grade 4", "Class 4", "IV", "4th"],
      },
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
      talabatProfile1447: true,
    },
    orderBy: [
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
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
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
    where: { studentId },
    create: {
      studentId,
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

export default router;
