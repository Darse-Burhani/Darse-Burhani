import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { apiCacheMiddleware, cache } from "../../lib/cache";
import { sendPushToUser } from "../../lib/push";

const router = Router();

import { talabatUploadsDir } from "../../lib/paths";


const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(talabatUploadsDir, { recursive: true });
      cb(null, talabatUploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      cb(null, `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF"));
  },
});

// GET /api/admin/students - List all students with full profile info (high-speed cache)
router.get("/", requireRole("ADMIN", "TEACHER"), apiCacheMiddleware({ ttlMs: 30_000, tags: ["studentprofile", "user"] }), async (_req, res) => {
  try {
    const students = await prisma.studentProfile.findMany({
      where: {
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true, avatarUrl: true } },
        talabatProfile1447: {
          select: {
            id: true,
            status: true,
            studentPhotoUrl: true,
            fatherPhotoUrl: true,
            motherPhotoUrl: true,
            fatherName: true,
            motherName: true,
            fatherOccupation: true,
            motherOccupation: true,
          },
        },
        _count: {
          select: {
            pointLogs: true,
            attendanceRecords: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        userId: s.user.id,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        email: s.user.email,
        isActive: s.user.isActive,
        avatarUrl: s.user.avatarUrl,
        fatherPhotoUrl: s.talabatProfile1447?.fatherPhotoUrl || null,
        motherPhotoUrl: s.talabatProfile1447?.motherPhotoUrl || null,
        talabatProfile1447: s.talabatProfile1447,
        studentId: s.studentId,
        its: s.its,
        trNo: s.trNo,
        grade: s.grade,
        section: s.section,
        status: s.status,
        bloodGroup: s.bloodGroup,
        dobGregorian: s.dobGregorian,
        dobHijri: s.dobHijri,
        hafizYear: s.hafizYear,
        nameAr: s.nameAr,
        motherName: s.motherName,
        fatherName: s.fatherName,
        fatherOccupation: s.fatherOccupation,
        age: s.age,
        fatherEmail: s.fatherEmail,
        motherEmail: s.motherEmail,
        fatherPhone: s.fatherPhone,
        motherPhone: s.motherPhone,
        admissionYear: s.admissionYear,
        currentYear: s.currentYear,
        darsId: s.darsId,
        externalSchooling: s.externalSchooling,
        watan: s.watan,
        residentCity: s.residentCity,
        address: s.address,
        mobileNumber: s.mobileNumber,
        currentPoints: s.currentPoints,
        totalPoints: s.totalPoints,
        tier: s.tier,
        streakDays: s.streakDays,
        walletBalance: s.walletBalance,
        biometricHash: s.biometricHash,
        reallyGoodAt: s.reallyGoodAt,
        loveToStudy: s.loveToStudy,
        loveForFun: s.loveForFun,
        counts: s._count,
      })),
    });
  } catch (error) {
    console.error("Admin students list error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch students" });
  }
});

// PUT /api/admin/students/:userId - Update a student profile (admin)
router.put("/:userId", requireRole("ADMIN"), async (req, res) => {
  const { userId } = req.params;
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const body = req.body as Record<string, any>;

    const userUpdate: Record<string, any> = {};
    if (body.firstName !== undefined) userUpdate.firstName = body.firstName;
    if (body.lastName !== undefined) userUpdate.lastName = body.lastName;
    if (body.email !== undefined) userUpdate.email = body.email;
    if (body.avatarUrl !== undefined) userUpdate.avatarUrl = body.avatarUrl || null;
    if (body.isActive !== undefined) userUpdate.isActive = Boolean(body.isActive);

    if (Object.keys(userUpdate).length > 0) {
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      if (userUpdate.email && existingUser && existingUser.email !== userUpdate.email) {
        const duplicate = await prisma.user.findUnique({ where: { email: userUpdate.email } });
        if (duplicate) {
          return res.status(409).json({ success: false, error: "Email already exists" });
        }
      }
      await prisma.user.update({ where: { id: userId }, data: userUpdate });
    }

    const profileData: Record<string, any> = {};
    const stringFields = [
      "its", "trNo", "grade", "section", "motherName", "fatherName", "fatherOccupation",
      "status", "bloodGroup", "dobHijri", "hafizYear", "fatherEmail", "motherEmail",
      "fatherPhone", "motherPhone", "admissionYear", "currentYear", "darsId",
      "externalSchooling", "watan", "residentCity", "address", "mobileNumber", "nameAr",
      "biometricHash", "reallyGoodAt", "loveToStudy", "loveForFun", "tier",
    ] as const;
    for (const field of stringFields) {
      if (body[field] !== undefined) profileData[field] = body[field] || null;
    }
    if (body.age !== undefined) profileData.age = body.age ? parseInt(body.age) : null;
    if (body.currentPoints !== undefined) profileData.currentPoints = parseInt(body.currentPoints) || 0;
    if (body.totalPoints !== undefined) profileData.totalPoints = parseInt(body.totalPoints) || 0;
    if (body.streakDays !== undefined) profileData.streakDays = parseInt(body.streakDays) || 0;
    if (body.walletBalance !== undefined) profileData.walletBalance = parseInt(body.walletBalance) || 0;
    if (body.dobGregorian !== undefined) {
      profileData.dobGregorian = body.dobGregorian ? new Date(body.dobGregorian) : null;
    }
    if (profileData.its) profileData.studentId = profileData.its;
    if (body.studentId !== undefined && body.studentId) profileData.studentId = body.studentId;

    const updatedProfile = await prisma.studentProfile.update({
      where: { id: student.id },
      data: profileData,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, isActive: true, avatarUrl: true } },
        talabatProfile1447: true,
      },
    });

    // If fatherPhotoUrl or motherPhotoUrl was provided, sync to talabatProfile1447
    if (body.fatherPhotoUrl !== undefined || body.motherPhotoUrl !== undefined) {
      const talabatPhotoUpdates: any = {};
      if (body.fatherPhotoUrl !== undefined) talabatPhotoUpdates.fatherPhotoUrl = body.fatherPhotoUrl || null;
      if (body.motherPhotoUrl !== undefined) talabatPhotoUpdates.motherPhotoUrl = body.motherPhotoUrl || null;
      if (body.fatherName !== undefined) talabatPhotoUpdates.fatherName = body.fatherName || null;
      if (body.motherName !== undefined) talabatPhotoUpdates.motherName = body.motherName || null;

      await prisma.talabatProfile1447.upsert({
        where: { studentId: student.id },
        create: {
          studentId: student.id,
          year: "1447 H",
          status: "DRAFT",
          ...talabatPhotoUpdates,
        },
        update: talabatPhotoUpdates,
      }).catch(() => {});
    }

    // ── DYNAMIC CLASS ENROLLMENT SYNCHRONIZATION ──
    // If Grade or Section was modified, automatically sync active ClassEnrollment records
    const gradeOrSectionChanged =
      (body.grade !== undefined && body.grade !== student.grade) ||
      (body.section !== undefined && body.section !== student.section);

    if (gradeOrSectionChanged && updatedProfile.grade && updatedProfile.section) {
      try {
        const targetClasses = await prisma.class.findMany({
          where: {
            grade: String(updatedProfile.grade),
            section: String(updatedProfile.section),
            isActive: true,
          },
        });

        if (targetClasses.length > 0) {
          // Deactivate prior enrollments for mismatched grades/sections
          const previousEnrollments = await prisma.classEnrollment.findMany({
            where: { studentId: student.id, isActive: true },
            include: { class: true },
          });

          for (const enr of previousEnrollments) {
            if (enr.class.grade !== updatedProfile.grade || enr.class.section !== updatedProfile.section) {
              await prisma.classEnrollment.update({
                where: { id: enr.id },
                data: { isActive: false },
              }).catch(() => {});
            }
          }

          // Enroll in new target classes
          for (const tc of targetClasses) {
            await prisma.classEnrollment.upsert({
              where: {
                classId_studentId: {
                  classId: tc.id,
                  studentId: student.id,
                },
              },
              create: {
                classId: tc.id,
                studentId: student.id,
                isActive: true,
              },
              update: {
                isActive: true,
              },
            }).catch(() => {});
          }

          cache.invalidateTag("class");
          cache.invalidateTag("timetable");
          cache.invalidateTag("attendance");
        }
      } catch (classSyncErr: any) {
        console.warn("[admin-students] Dynamic class enrollment sync notice:", classSyncErr?.message || classSyncErr);
      }
    }

    // ── DISPATCH IN-APP NOTIFICATION & OS PUSH NOTIFICATION ──
    const studentDisplayName = `${updatedProfile.user?.firstName || "Talab"} ${updatedProfile.user?.lastName || ""}`.trim();
    const classLabel = `Grade ${updatedProfile.grade || ""}${updatedProfile.section || ""}`.trim();

    const notifyStudent = body.notifyStudent !== false;
    const notifyParents = body.notifyParents !== false;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
    const changesSummary = Array.isArray(body.changesSummary)
      ? body.changesSummary.slice(0, 4).join(" • ")
      : typeof body.changesSummary === "string"
      ? body.changesSummary.trim()
      : "";

    // 1. Notify the student in-app and push if enabled
    if (notifyStudent) {
      let notifBody = `Your official profile records (${classLabel ? classLabel + " • " : ""}ITS: ${updatedProfile.its || updatedProfile.studentId}) have been updated by administration.`;
      if (adminNote) {
        notifBody += ` Note: "${adminNote}"`;
      } else if (changesSummary) {
        notifBody += ` Changes: ${changesSummary}`;
      }

      await prisma.notification.create({
        data: {
          userId,
          title: "Profile Updated by Administration",
          body: notifBody,
          type: "PROFILE_UPDATE",
          link: "/talabat/profile",
          priority: "HIGH",
        },
      }).catch((err) => console.warn("[admin-students] Notification create notice:", err?.message || err));

      await sendPushToUser(userId, {
        title: "Profile Updated by Administration",
        body: adminNote ? `Profile updated: ${adminNote}` : `Your student profile details have been updated. Tap to view your updated record.`,
        url: "/talabat/profile",
        tag: `profile-update-${Date.now()}`,
      }).catch(() => {});
    }

    // 2. Notify linked parents (if enabled)
    if (notifyParents) {
      const parentLinks = await prisma.parentStudentLink.findMany({
        where: { studentId: student.id },
        include: { parent: { select: { userId: true } } },
      }).catch(() => []);

      for (const link of parentLinks) {
        if (link.parent?.userId) {
          let parentBody = `Academic and demographic records for ${studentDisplayName} (${classLabel}) were updated by administration.`;
          if (adminNote) parentBody += ` Note: "${adminNote}"`;

          await prisma.notification.create({
            data: {
              userId: link.parent.userId,
              title: "Child's Profile Updated",
              body: parentBody,
              type: "PROFILE_UPDATE",
              link: "/parent/activity",
              priority: "NORMAL",
            },
          }).catch(() => {});

          await sendPushToUser(link.parent.userId, {
            title: "Child's Profile Updated",
            body: adminNote ? `${studentDisplayName}: ${adminNote}` : `Institutional record for ${studentDisplayName} was updated by administration.`,
            url: "/parent/activity",
            tag: `parent-profile-update-${Date.now()}`,
          }).catch(() => {});
        }
      }
    }

    // 3. Invalidate related caches so the user sees updates immediately
    cache.invalidateTag("notifications");
    cache.invalidateTag("user");
    cache.invalidateTag("studentprofile");
    cache.invalidateTag("dashboard");

    return res.json({ success: true, data: updatedProfile });
  } catch (error) {
    console.error("Admin student update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update student" });
  }
});

import { completelyDeleteUser } from "../../lib/user-deletion";

// DELETE /api/admin/students - Delete a student profile via query param (?id=xxx or ?userId=xxx or ?studentId=xxx)
router.delete("/", requireRole("ADMIN"), async (req, res) => {
  const targetId = (req.query.id as string) || (req.query.userId as string) || (req.query.studentId as string) || (req.body?.id as string) || (req.body?.userId as string);
  if (!targetId) {
    return res.status(400).json({ success: false, error: "Student ID or User ID is required" });
  }
  try {
    const result = await completelyDeleteUser(targetId);
    return res.json({
      success: true,
      message: "Student profile completely purged from database and biometric terminals.",
      data: result,
    });
  } catch (error: any) {
    console.error("Admin student delete error:", error);
    const status = error?.message?.includes("Master system administrator") ? 403 : 400;
    return res.status(status).json({ success: false, error: error?.message || "Failed to delete student" });
  }
});

// DELETE /api/admin/students/:userId - Delete a student profile + user + physical terminals
router.delete("/:userId", requireRole("ADMIN"), async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ success: false, error: "Student identifier is required" });
  }
  try {
    const result = await completelyDeleteUser(userId);
    return res.json({
      success: true,
      message: "Student profile completely purged from database and biometric terminals.",
      data: result,
    });
  } catch (error: any) {
    console.error("Admin student delete error:", error);
    const status = error?.message?.includes("Master system administrator") ? 403 : 400;
    return res.status(status).json({ success: false, error: error?.message || "Failed to delete student" });
  }
});

// POST /api/admin/students/:userId/avatar - Upload profile picture for a talabat
router.post("/:userId/avatar", requireRole("ADMIN"), (req, res) => {
  const { userId } = req.params;
  avatarUpload.single("file")(req, res, async (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? "File too large. Maximum 5MB"
            : "Upload failed"
          : err instanceof Error
            ? err.message
            : "Upload failed";
      return res.status(400).json({ success: false, error: message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file provided" });
    }

    try {
      const student = await prisma.studentProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!student) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, error: "Student not found" });
      }

      const url = `/uploads/talabat/${req.file.filename}`;
      await prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });

      return res.json({ success: true, url });
    } catch (error) {
      console.error("Admin student avatar upload error:", error);
      return res.status(500).json({ success: false, error: "Failed to upload avatar" });
    }
  });
});

// POST /api/admin/students/:userId/deploy-biometric - Sync this student's ITS/biometrics to all physical terminals
router.post("/:userId/deploy-biometric", requireRole("ADMIN"), async (req, res) => {
  try {
    const { userId } = req.params;
    const student = await prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const enabledDevices = await prisma.biometricDevice.findMany({
      where: { enabled: true },
    });

    if (enabledDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No active biometric terminals found. Please enable at least one terminal in Hardware Settings.",
      });
    }

    const empNo = student.biometricHash || student.its || student.studentId;
    const name = `${student.user.firstName} ${student.user.lastName}`.trim();
    const results: Array<{ deviceId: string; name: string; host: string; status: "SUCCESS" | "ERROR"; error?: string }> = [];

    const { toConnection, deployUserToDevice } = await import("../../lib/hikvision");

    for (const dev of enabledDevices) {
      try {
        const conn = toConnection(dev);
        await deployUserToDevice(conn, {
          employeeNo: String(empNo).trim(),
          name,
          userType: "normal",
        });
        results.push({ deviceId: dev.id, name: dev.name, host: dev.host, status: "SUCCESS" });
      } catch (devErr: any) {
        results.push({ deviceId: dev.id, name: dev.name, host: dev.host, status: "ERROR", error: devErr?.message || "Terminal unreachable" });
      }
    }

    const successfulCount = results.filter((r) => r.status === "SUCCESS").length;
    return res.json({
      success: true,
      message: `Biometric sync completed: ${successfulCount}/${enabledDevices.length} terminals updated for ${name} (${empNo}).`,
      data: { results, successfulCount, totalTerminals: enabledDevices.length },
    });
  } catch (err: any) {
    console.error("Biometric deploy error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to deploy to biometric terminals" });
  }
});

export default router;
