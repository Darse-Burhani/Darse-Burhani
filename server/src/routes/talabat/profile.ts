import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth } from "../../middleware";
import { getProfilePermissions } from "../../lib/profile-permissions";
import path from "path";
import fs from "fs";
import { talabatUploadsDir } from "../../lib/paths";

const router = Router();

// GET /api/talabat/profile/permissions - Get region lock status for the student view
router.get("/permissions", requireAuth, (req, res) => {
  const permissions = getProfilePermissions();
  return res.json({
    success: true,
    data: permissions.talabat || permissions,
    modules: permissions.modules?.talabat,
  });
});

// GET /api/talabat/profile - Fetch student profile with parent privacy applied
router.get("/", requireAuth, async (req, res) => {
  const session = req.auth!;
  const isAdmin = session.user.role === "ADMIN";

  const targetUserId = (isAdmin && (req.query.userId as string)) || session.user.id;
  const targetStudentId = (isAdmin && (req.query.studentId as string)) || undefined;

  const user = await prisma.user.findFirst({
    where: targetStudentId
      ? { studentProfile: { id: targetStudentId } }
      : { id: targetUserId },
    include: { studentProfile: true },
  });

  if (!user || !user.studentProfile) {
    return res.status(404).json({ error: "Student profile not found" });
  }

  // Fetch Knowing Myself assessment if exists
  const knowingMyselfSetting = await prisma.systemSetting.findUnique({
    where: { key: `knowing_myself_${user.studentProfile.id}` },
  });
  const knowingMyselfData = (knowingMyselfSetting?.value as any) || null;

  const profile: any = {
    ...user.studentProfile,
    avatarUrl: user.avatarUrl,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    reallyGoodAt: user.studentProfile.reallyGoodAt || "",
    loveToStudy: user.studentProfile.loveToStudy || "",
    loveForFun: user.studentProfile.loveForFun || "",
    knowingMyself: knowingMyselfData,
    knowingMyselfSubmitted: Boolean(knowingMyselfData),
    knowingMyselfSubmittedAt: knowingMyselfData?.submittedAt || null,
  };

  const permissions = getProfilePermissions();

  // If parents region is not visible to student, wipe parent contact data from payload
  const isParentsVisible = permissions.talabat?.parents?.isVisible !== false && 
    (permissions.talabat?.parents?.isVisibleToStudent !== false && permissions.parents?.isVisibleToStudent !== false);

  if (!isAdmin && !isParentsVisible) {
    profile.fatherEmail = null;
    profile.motherEmail = null;
    profile.fatherPhone = null;
    profile.motherPhone = null;
    profile.fatherOccupation = null;
    profile.fatherName = null;
    profile.motherName = null;
  }

  return res.json({
    success: true,
    data: profile,
    permissions: permissions.talabat || permissions,
    modules: permissions.modules?.talabat,
    // root level fields for backwards compatibility
    ...profile,
  });
});

// PUT /api/talabat/profile - Save student profile changes respecting regional permissions
router.put("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";

    const targetUserId = (isAdmin && (req.query.userId as string || req.body.userId)) || session.user.id;
    const targetStudentId = (isAdmin && (req.query.studentId as string || req.body.studentProfileId)) || undefined;

    const user = await prisma.user.findFirst({
      where: targetStudentId
        ? { studentProfile: { id: targetStudentId } }
        : { id: targetUserId },
      include: { studentProfile: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Auto-create studentProfile if user exists but profile record is missing
    let studentProfile = user.studentProfile;
    if (!studentProfile) {
      studentProfile = await prisma.studentProfile.create({
        data: {
          userId: user.id,
          studentId: user.email?.split("@")[0] || `STD-${Date.now().toString().slice(-6)}`,
          grade: "1",
          section: "A",
        },
      });
    }

    const permissions = getProfilePermissions();
    const talabatPerms = permissions.talabat || permissions;

    if (!isAdmin && talabatPerms.masterEnabled === false) {
      return res.status(403).json({
        success: false,
        error: "Talabat profile editing is currently locked by administrator",
      });
    }

    const body = req.body as Record<string, any>;
    const updateData: Record<string, any> = {};
    const userUpdateData: Record<string, any> = {};

    // Photo
    const canEditPhoto = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.photo?.isOpen !== false);
    if (canEditPhoto && (body.avatarUrl !== undefined || body.photoUrl !== undefined)) {
      userUpdateData.avatarUrl = body.avatarUrl || body.photoUrl || null;
    }

    // Personal Information Region
    const canEditPersonal = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.personal?.isOpen !== false);
    if (canEditPersonal) {
      if (body.age !== undefined) {
        if (body.age === null || body.age === "" || body.age === undefined) {
          updateData.age = null;
        } else {
          const parsed = parseInt(String(body.age), 10);
          updateData.age = !isNaN(parsed) ? parsed : null;
        }
      }

      if (body.status !== undefined) {
        if (!body.status) {
          updateData.status = null;
        } else {
          const norm = String(body.status).trim().toUpperCase();
          updateData.status = norm === "HAFIZ" || norm === "SANAH" ? norm : null;
        }
      }

      if (body.bloodGroup !== undefined) updateData.bloodGroup = body.bloodGroup ? String(body.bloodGroup).trim() : null;

      if (body.dobGregorian !== undefined) {
        if (!body.dobGregorian) {
          updateData.dobGregorian = null;
        } else {
          const d = new Date(body.dobGregorian);
          updateData.dobGregorian = !isNaN(d.getTime()) ? d : null;
        }
      }

      if (body.dobHijri !== undefined) updateData.dobHijri = body.dobHijri ? String(body.dobHijri).trim() : null;
      if (body.hafizYear !== undefined) updateData.hafizYear = body.hafizYear ? String(body.hafizYear).trim() : null;
      if (body.nameAr !== undefined) updateData.nameAr = body.nameAr ? String(body.nameAr).trim() : null;
    }

    // Academic Information Region
    const canEditAcademic = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.academic?.isOpen !== false);
    if (canEditAcademic) {
      if (body.admissionYear !== undefined) updateData.admissionYear = body.admissionYear ? String(body.admissionYear).trim() : null;
      if (body.currentYear !== undefined) updateData.currentYear = body.currentYear ? String(body.currentYear).trim() : null;
      if (body.darsId !== undefined) updateData.darsId = body.darsId ? String(body.darsId).trim() : null;
      if (body.externalSchooling !== undefined) updateData.externalSchooling = body.externalSchooling ? String(body.externalSchooling).trim() : null;
      if (body.grade !== undefined && body.grade) updateData.grade = String(body.grade).trim();
      if (body.section !== undefined && body.section) updateData.section = String(body.section).trim();
    }

    // Contact & Location Region
    const canEditContact = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.contact?.isOpen !== false);
    if (canEditContact) {
      if (body.watan !== undefined) updateData.watan = body.watan ? String(body.watan).trim() : null;
      if (body.residentCity !== undefined) updateData.residentCity = body.residentCity ? String(body.residentCity).trim() : null;
      if (body.address !== undefined) updateData.address = body.address ? String(body.address).trim() : null;
      if (body.mobileNumber !== undefined) updateData.mobileNumber = body.mobileNumber ? String(body.mobileNumber).trim() : null;
    }

    // Identifiers Region
    const canEditIdentifiers = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.identifiers?.isOpen !== false);
    if (canEditIdentifiers) {
      if (body.its !== undefined) updateData.its = body.its ? String(body.its).trim() : null;
      if (body.trNo !== undefined) updateData.trNo = body.trNo ? String(body.trNo).trim() : null;
    }

    // Parents Details & Contact Region
    const canEditParents = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.parents?.isOpen !== false);
    if (canEditParents) {
      if (body.fatherName !== undefined) updateData.fatherName = body.fatherName ? String(body.fatherName).trim() : null;
      if (body.motherName !== undefined) updateData.motherName = body.motherName ? String(body.motherName).trim() : null;
      if (body.fatherPhone !== undefined) updateData.fatherPhone = body.fatherPhone ? String(body.fatherPhone).trim() : null;
      if (body.motherPhone !== undefined) updateData.motherPhone = body.motherPhone ? String(body.motherPhone).trim() : null;
      if (body.fatherEmail !== undefined) updateData.fatherEmail = body.fatherEmail ? String(body.fatherEmail).trim() : null;
      if (body.motherEmail !== undefined) updateData.motherEmail = body.motherEmail ? String(body.motherEmail).trim() : null;
      if (body.fatherOccupation !== undefined) updateData.fatherOccupation = body.fatherOccupation ? String(body.fatherOccupation).trim() : null;
    }

    // Darajah 4 / Rabea Personal Reflections & Prompts
    if (body.reallyGoodAt !== undefined) updateData.reallyGoodAt = body.reallyGoodAt ? String(body.reallyGoodAt).trim() : null;
    if (body.loveToStudy !== undefined) updateData.loveToStudy = body.loveToStudy ? String(body.loveToStudy).trim() : null;
    if (body.loveForFun !== undefined) updateData.loveForFun = body.loveForFun ? String(body.loveForFun).trim() : null;

    if (isAdmin) {
      if (body.firstName !== undefined && body.firstName.trim()) userUpdateData.firstName = body.firstName.trim();
      if (body.lastName !== undefined && body.lastName.trim()) userUpdateData.lastName = body.lastName.trim();
      if (body.email !== undefined && body.email.trim()) userUpdateData.email = body.email.trim();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      });
    }

    let updatedProfile = studentProfile;
    if (Object.keys(updateData).length > 0) {
      updatedProfile = await prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data: updateData,
      });
    }

    return res.json({
      success: true,
      data: {
        ...updatedProfile,
        avatarUrl: userUpdateData.avatarUrl !== undefined ? userUpdateData.avatarUrl : user.avatarUrl,
      },
    });
  } catch (err: any) {
    console.error("Error updating talabat profile:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update talabat profile",
    });
  }
});

// GET /api/talabat/profile/knowing-myself — Get student's Knowing Myself assessment
router.get("/knowing-myself", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";
    const targetUserId = (isAdmin && (req.query.userId as string)) || session.user.id;
    const targetStudentId = (isAdmin && (req.query.studentId as string)) || undefined;

    const user = await prisma.user.findFirst({
      where: targetStudentId
        ? { studentProfile: { id: targetStudentId } }
        : { id: targetUserId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const sp = user.studentProfile;
    const settingKey = `knowing_myself_${sp.id}`;
    const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
    const knowingMyselfData = (setting?.value as any) || null;

    return res.json({
      success: true,
      data: knowingMyselfData,
      isSubmitted: Boolean(knowingMyselfData),
      student: {
        id: sp.id,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        its: sp.its || "",
        grade: sp.grade || "4",
        section: sp.section || "A",
        age: sp.age || null,
        avatarUrl: user.avatarUrl || null,
        reallyGoodAt: sp.reallyGoodAt || "",
        loveToStudy: sp.loveToStudy || "",
        loveForFun: sp.loveForFun || "",
      },
    });
  } catch (err: any) {
    console.error("[knowing-myself] Fetch error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch assessment" });
  }
});

// POST /api/talabat/profile/knowing-myself — Submit or update Knowing Myself assessment
router.post("/knowing-myself", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";
    const targetUserId = (isAdmin && (req.body.userId as string)) || session.user.id;
    const targetStudentId = (isAdmin && (req.body.studentId as string)) || undefined;

    const user = await prisma.user.findFirst({
      where: targetStudentId
        ? { studentProfile: { id: targetStudentId } }
        : { id: targetUserId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const sp = user.studentProfile;
    const body = req.body || {};

    const payload = {
      studentId: sp.id,
      userId: user.id,
      studentName: body.studentName || `${user.firstName} ${user.lastName}`.trim(),
      its: sp.its || "",
      grade: sp.grade || "4",
      section: sp.section || "A",
      ageGrade: body.ageGrade || `${sp.age ? `${sp.age} Yrs` : ""} / Grade ${sp.grade || "4"}`.trim(),
      dateOfAssessment: body.dateOfAssessment || new Date().toISOString().slice(0, 10),
      submittedAt: new Date().toISOString(),

      // Core strengths & aspirations
      threeStrengths: Array.isArray(body.threeStrengths) ? body.threeStrengths : [body.strength1 || "", body.strength2 || "", body.strength3 || ""],
      threeThingsEnjoy: Array.isArray(body.threeThingsEnjoy) ? body.threeThingsEnjoy : [body.enjoy1 || "", body.enjoy2 || "", body.enjoy3 || ""],
      proudAccomplishment: String(body.proudAccomplishment || "").trim(),
      improveBetterAt: String(body.improveBetterAt || "").trim(),
      admirePersonWhy: String(body.admirePersonWhy || "").trim(),

      // Obstacles (up to 3)
      selectedObstacles: Array.isArray(body.selectedObstacles) ? body.selectedObstacles : [],
      otherObstacle: String(body.otherObstacle || "").trim(),

      // Further Reflections (14 compulsory questions)
      difficultResponse: String(body.difficultResponse || "").trim(),
      wantToGiveUp: String(body.wantToGiveUp || "").trim(),
      recoverAfterDisappointment: String(body.recoverAfterDisappointment || "").trim(),
      approachForSupport: String(body.approachForSupport || "").trim(),
      obstacleWillingToWorkOn: String(body.obstacleWillingToWorkOn || "").trim(),
      behaviorHurtsMost: String(body.behaviorHurtsMost || "").trim(),
      wishOthersUnderstood: String(body.wishOthersUnderstood || "").trim(),
      successfulPersonMeaning: String(body.successfulPersonMeaning || "").trim(),
      successBeyondQualifications: String(body.successBeyondQualifications || "").trim(),
      qualitiesWorthyOfRespect: String(body.qualitiesWorthyOfRespect || "").trim(),
      continueLearningReason: String(body.continueLearningReason || "").trim(),
      khidmatMeaning: String(body.khidmatMeaning || "").trim(),
      useSkillsToBenefitOthers: String(body.useSkillsToBenefitOthers || "").trim(),
      rememberedFor: String(body.rememberedFor || "").trim(),
    };

    // Save to SystemSetting
    const settingKey = `knowing_myself_${sp.id}`;
    await prisma.systemSetting.upsert({
      where: { key: settingKey },
      create: { key: settingKey, value: payload },
      update: { value: payload },
    });

    // Also update 3 prompts on StudentProfile if provided
    const spUpdates: Record<string, string | null> = {};
    if (body.reallyGoodAt !== undefined) spUpdates.reallyGoodAt = body.reallyGoodAt ? String(body.reallyGoodAt).trim() : null;
    if (body.loveToStudy !== undefined) spUpdates.loveToStudy = body.loveToStudy ? String(body.loveToStudy).trim() : null;
    if (body.loveForFun !== undefined) spUpdates.loveForFun = body.loveForFun ? String(body.loveForFun).trim() : null;

    if (Object.keys(spUpdates).length > 0) {
      await prisma.studentProfile.update({
        where: { id: sp.id },
        data: spUpdates,
      });
    }

    return res.json({
      success: true,
      message: "Knowing Myself assessment submitted successfully",
      data: payload,
    });
  } catch (err: any) {
    console.error("[knowing-myself] Submit error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to submit assessment" });
  }
});

// POST /api/talabat/profile/download-pdf - Generate and download professional PDF
router.post("/download-pdf", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";
    const targetUserId = (isAdmin && (req.body.userId as string)) || session.user.id;
    const targetStudentId = (isAdmin && (req.body.studentId as string)) || undefined;

    let user = await prisma.user.findFirst({
      where: targetStudentId
        ? { studentProfile: { id: targetStudentId } }
        : { id: targetUserId },
      include: { studentProfile: { include: { talabatProfile1447: true } } },
    });

    if (!user || !user.studentProfile) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    const sp = user.studentProfile;
    const tp = user.studentProfile.talabatProfile1447 || ({} as any);

    // Get knowing myself data
    const settingKey = `knowing_myself_${sp.id}`;
    const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
    const knowingMyselfData = (setting?.value as any) || null;

    // Set PDF filename
    const studentName = `${user.firstName} ${user.lastName}`.trim() || "student";
    const safeName = studentName.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfFilename = "talabat-profile-" + safeName + "-" + Date.now() + ".pdf";
    const pdfPath = path.join(talabatUploadsDir, pdfFilename);

    // Create a new PDF document using pdfkit
    const PDFDocument = (await import("pdfkit")).default as any;

    // Create a new PDF document
    const doc = new PDFDocument({
      autoFirstPage: false,
      autoPage: true,
    });

    // Write PDF to file
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Helper function to wrap text
    const wrapText = (doc: any, text: string, x: number, y: number, maxWidth: number, fontSize: number, lineHeight: number) => {
      const words = text.split(" ");
      let line = "";
      let lines = [];
      let currentX = x;
      let currentY = y;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = doc.getCurrentFont().measureText(testLine);
        if (metrics.width > maxWidth && line !== "") {
          lines.push(line);
          line = words[n] + " ";
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      for (let i = 0; i < lines.length; i++) {
        if (currentY > doc.page.height - 50) {
          doc.addPage();
          currentY = 50;
        }
        doc.fontSize(fontSize).text(lines[i], x, currentY);
        currentY += lineHeight;
      }

      return currentY;
    };

    // ---- PAGE 1: A4 Profile (Profile & Demographics) ----
    doc.addPage({ size: "A4" });
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    // Header
    doc.fillColor("#1c1c1c");
    doc.fontSize(18).font("Helvetica-Bold");
    doc.text("DARSE BURHANI", margin, margin);
    doc.fontSize(11).font("Helvetica");
    doc.text("DARAJEH RABEA (GRADE 4) • STUDENT TALABAT PROFILE", margin, margin + 20);
    doc.fontSize(9).font("Helvetica").text("Academic Year 1447 H • Official Individual Record Sheet", margin, margin + 30);

    // Student Photo
    let photoX = margin;
    let photoY = margin + 45;
    let photoWidth = 50;
    let photoHeight = 60;

    if (tp.studentPhotoUrl && tp.studentPhotoUrl.trim()) {
      try {
        const imgUrl = tp.studentPhotoUrl.startsWith("/") ? tp.studentPhotoUrl : "/" + tp.studentPhotoUrl;
        doc.addImage ? doc.addImage(imgUrl, "PNG", photoX, photoY, photoWidth, photoHeight) : "";
      } catch (e) {}
    }

    // Student Info Row
    let infoY = margin + 45;
    doc.fillColor("#1c1c1c");
    doc.fontSize(10).font("Helvetica");

    // Name
    doc.font("Helvetica-Bold");
    doc.text("Student Name:", photoX + photoWidth + 10, infoY);
    doc.font("Helvetica");
    doc.text((tp.name || `${user.firstName} ${user.lastName}`.trim() || "Student"), photoX + photoWidth + 60, infoY);

    // ITS
    doc.text("ITS:", photoX + photoWidth + 60, infoY + 12);
    doc.text(sp.its || "—", photoX + photoWidth + 100, infoY + 12);

    // Standard/Section
    doc.text("Standard:", photoX + photoWidth + 60, infoY + 24);
    doc.text((sp.grade || "Darajah 4 (Rabea)"), photoX + photoWidth + 100, infoY + 24);

    // Section
    doc.text("Section:", photoX + photoWidth + 60, infoY + 36);
    doc.text(sp.section || "A", photoX + photoWidth + 100, infoY + 36);

    // Status
    doc.text("Status:", photoX + photoWidth + 60, infoY + 48);
    doc.text((sp.status ? (sp.status === "HAFIZ" ? "Hafiz" : "Sanah") : ""), photoX + photoWidth + 100, infoY + 48);

    // Demographics Table
    infoY = margin + 110;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1c1c");
    doc.text("Student Demographic & Institutional Profile", margin, infoY);
    doc.font("Helvetica").fontSize(8);

    const demographics = [
      ["Father Name:", tp.fatherName || sp.fatherName || "—"],
      ["'s Occupation:", tp.fatherOccupation || sp.fatherOccupation || "—"],
      ["Mother Name:", tp.motherName || sp.motherName || "—"],
      ["Mother's Occupation:", tp.motherOccupation || "Homemaker"],
      ["Admission Year:", tp.admissionYear || sp.admissionYear || "1444 H"],
      ["Current Year:", tp.currentYear || sp.currentYear || "1447 H"],
      ["Student Age:", sp.age ? sp.age + " Years" : "—"],
      ["Watan:", tp.vatan || sp.watan || "—"],
      ["Resident City:", tp.residentCity || sp.residentCity || "—"],
      ["Mobile Number:", sp.mobileNumber || "—"],
      ["Email ID:", user.email || "—"],
    ];

    let tableY = infoY + 15;
    for (const [label, value] of demographics) {
      doc.fontSize(7.5).text(label, margin, tableY);
      doc.fontSize(7.5).text(value, margin + 80, tableY);
      tableY += 8;
    }

    // ---- PAGE 2: Knowing Myself Assessment ----
    let page2Y = margin;

    doc.addPage();
    doc.fillColor("#1c1c1c");
    doc.fontSize(18).font("Helvetica-Bold");
    doc.text("KNOWING MYSELF: MY IDENTITY AND ASPIRATIONS", margin, page2Y);
    doc.fontSize(11).font("Helvetica");
    doc.text("Darajeh Rabea (Grade 4) • Student Self-Reflection & Guidance Record (Page 2 of 2)", margin, page2Y + 20);
    doc.fontSize(9).font("Helvetica").text("Darse Burhani Official Dossier • Page 2 of 2", margin, page2Y + 30);

    // Student info on page 2
    doc.fontSize(9).fillColor("#1c1c1c");
    doc.text("Student:", margin, page2Y + 45);
    doc.font("Helvetica-Bold");
    doc.text((tp.name || user.firstName + " " + user.lastName || "Student"), margin + 40, page2Y + 45);
    doc.font("Helvetica");
    doc.text("ITS: " + (sp.its || "—"), margin + 80, page2Y + 45);

    // Date of Assessment
    const assessmentDate = knowingMyselfData?.dateOfAssessment || new Date().toISOString().slice(0, 10);
    doc.text("Assessment Date:", margin, page2Y + 55);
    doc.text(assessmentDate, margin + 70, page2Y + 55);

    // Assessment submitted badge
    if (knowingMyselfData?.submittedAt) {
      doc.fillColor("#1a73e8").fontSize(7).font("Helvetica-Bold");
      doc.text("✓ Compulsory Assessment Submitted", margin, page2Y + 65);
    }

    // Section A: Strengths, Enjoyed Activities & Aspirations
    page2Y = margin + 75;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1c1c");
    doc.text("★ 3 Greatest Strengths", margin, page2Y);
    page2Y += 12;

    const strengths = knowingMyselfData?.threeStrengths || [];
    for (let i = 0; i < 3; i++) {
      doc.fontSize(8).text((i + 1) + ". " + (strengths[i] || "—"), margin, page2Y);
      page2Y += 10;
    }

    // Things I Enjoy
    page2Y += 5;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1c1c");
    doc.text("★ 3 Things I Enjoy Most", margin, page2Y);
    page2Y += 12;

    const thingsEnjoy = knowingMyselfData?.threeThingsEnjoy || [];
    for (let i = 0; i < 3; i++) {
      doc.fontSize(8).text((i + 1) + ". " + (thingsEnjoy[i] || "—"), margin, page2Y);
      page2Y += 10;
    }

    // Core Accomplishment & Role Model
    page2Y += 5;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1c1c");
    doc.text("★ Aspirations & Mentorship", margin, page2Y);
    page2Y += 12;

    const proudAccomplishment = knowingMyselfData?.proudAccomplishment || "—";
    const improveBetterAt = knowingMyselfData?.improveBetterAt || "—";
    const admirePersonWhy = knowingMyselfData?.admirePersonWhy || "—";

    doc.fontSize(7.5).text("Proud Accomplishment:", margin, page2Y);
    doc.fontSize(7.5).text(proudAccomplishment, margin + 50, page2Y);
    page2Y += 9;
    doc.fontSize(7.5).text("Area Want to Improve:", margin, page2Y);
    doc.fontSize(7.5).text(improveBetterAt, margin + 50, page2Y);
    page2Y += 9;
    doc.fontSize(7.5).text("Person Admired & Why:", margin, page2Y);
    doc.fontSize(7.5).text(admirePersonWhy, margin + 50, page2Y);

    // Section B: Obstacles Identified
    page2Y += 15;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1c1c");
    doc.text("Obstacles Identified:", margin, page2Y);
    page2Y += 12;

    const selectedObstacles = knowingMyselfData?.selectedObstacles || [];
    for (const obs of selectedObstacles) {
      doc.fontSize(7.5).text("• " + obs, margin + 10, page2Y);
      page2Y += 8;
    }

    if (knowingMyselfData?.otherObstacle) {
      doc.fontSize(7.5).text("Other: " + knowingMyselfData.otherObstacle, margin + 10, page2Y);
      page2Y += 8;
    }

    // ✓ Submitted badge
    if (knowingMyselfData?.submittedAt) {
      doc.fillColor("#1a73e8").fontSize(7).font("Helvetica-Bold");
      doc.text("✓ Compulsory Assessment Submitted", margin, page2Y + 5);
    }

    // Section C: In-Depth Self-Reflections (14 Questions)
    page2Y += 15;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1c1c");
    doc.text("★ Self-Reflection Questionnaire (14 Compulsory Questions)", margin, page2Y);
    page2Y += 12;

    const questions = [
      ["1. How do you respond when things get difficult?", knowingMyselfData?.difficultResponse || "—"],
      ["2. What makes you want to give up?", knowingMyselfData?.wantToGiveUp || "—"],
      ["3. What helps you recover after disappointment or failure?", knowingMyselfData?.recoverAfterDisappointment || "—"],
      ["4. Who do you approach when you need support?", knowingMyselfData?.approachForSupport || "—"],
      ["5. One obstacle you are willing to actively work on?", knowingMyselfData?.obstacleWillingToWorkOn || "—"],
      ["6. What kind of behavior hurts you the most?", knowingMyselfData?.behaviorHurtsMost || "—"],
      ["7. What do you wish others understood better about you?", knowingMyselfData?.wishOthersUnderstood || "—"],
      ["8. What does it mean to be a successful person?", knowingMyselfData?.successfulPersonMeaning || "—"],
      ["9. What does success look like beyond academic qualifications?", knowingMyselfData?.successBeyondQualifications || "—"],
      ["10. What qualities make someone worthy of genuine respect?", knowingMyselfData?.qualitiesWorthyOfRespect || "—"],
      ["11. Why is it important to continue learning throughout life?", knowingMyselfData?.continueLearningReason || "—"],
      ["12. What does Khidmat mean to you personally?", knowingMyselfData?.khidmatMeaning || "—"],
      ["13. How can you use your unique skills to benefit others?", knowingMyselfData?.useSkillsToBenefitOthers || "—"],
      ["14. What kind of person do you want to be remembered as?", knowingMyselfData?.rememberedFor || "—"],
    ];

    for (const [question, answer] of questions) {
      doc.fontSize(7).font("Helvetica-Bold").text(question, margin, page2Y);
      doc.font("Helvetica").fontSize(7).text(answer, margin + 55, page2Y);
      page2Y += 8;
    }

    // ---- Footer ----
    const footerY = pageHeight - 40;
    doc.fillColor("#888888").fontSize(7).font("Helvetica");
    doc.text("Darse Burhani Official Institutional Record • Darajah Rabea (Grade 4) • 1447 H", margin, footerY);
    doc.text("Knowing Myself Assessment • Darse Burhani Official Dossier • Darajah Rabea (Grade 4) • Page 2 of 2", margin, footerY + 8);
    doc.fontSize(8).font("Helvetica-Bold").dir("rtl").text("الحمد لله على ما أنعم والشكر له على ما ألهم", pageWidth - margin, footerY, { align: "right" });

    // Finalize PDF
    doc.end();

    // Wait for file to be written
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", reject);
    });

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + pdfFilename + "\"");
    res.setHeader("Cache-Control", "public, max-age=3600");

    // Send the PDF file
    res.sendFile(path.resolve(pdfPath), (err) => {
      if (err) {
        console.error("Error sending PDF file:", err);
        // Fallback: send the file as buffer
        const pdfBuffer = fs.readFileSync(pdfPath);
        res.type("application/pdf");
        res.send(pdfBuffer);
      }
    });

  } catch (err: any) {
    console.error("Error generating talabat PDF:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to generate PDF",
    });
  }
});

export default router;
