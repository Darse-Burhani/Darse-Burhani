import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { completelyDeleteUser } from "../../lib/user-deletion";
import bcrypt from "bcryptjs";
const { hash } = bcrypt;

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const page = parseInt((req.query.page as string) || "1");
    const pageSize = parseInt((req.query.pageSize as string) || "50");
    const search = (req.query.search as string) || "";
    const role = (req.query.role as string) || "";
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };
    if (role && role !== "ALL" && ["ADMIN", "TEACHER", "STUDENT", "PARENT"].includes(role)) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          plainPassword: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          teacherProfile: {
            select: {
              employeeId: true,
              its: true,
              department: true,
              subCategory: true,
              roleTitle: true,
              khidmatMauze: true,
              farigYear: true,
              khidmatYear: true,
              mobile: true,
              tEmail: true,
              age: true,
              photoUrl: true,
              portfolioEnabled: true,
            },
          },
          studentProfile: {
            select: {
              studentId: true,
              grade: true,
              section: true,
              currentPoints: true,
              totalPoints: true,
              tier: true,
              its: true,
              trNo: true,
              status: true,
              hafizYear: true,
              watan: true,
              residentCity: true,
              bloodGroup: true,
              fatherName: true,
              motherName: true,
              fatherPhone: true,
              motherPhone: true,
            },
          },
          parentProfile: {
            select: {
              phone: true,
              secondaryPhone: true,
              occupation: true,
              address: true,
              city: true,
              watan: true,
              bloodGroup: true,
              its: true,
              relationType: true,
              notes: true,
              studentLinks: {
                select: {
                  id: true,
                  relationship: true,
                  student: {
                    select: {
                      studentId: true,
                      its: true,
                      grade: true,
                      section: true,
                      user: {
                        select: {
                          firstName: true,
                          lastName: true,
                          avatarUrl: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      success: true,
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (error) {
    console.error("Users fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      employeeId,
      department,
      subjects,
      grade,
      section,
      phone,
      its,
      trNo,
      motherName,
      fatherName,
      fatherOccupation,
      age,
      status,
      bloodGroup,
      dobGregorian,
      dobHijri,
      hafizYear,
      nameAr,
      fatherEmail,
      motherEmail,
      fatherPhone,
      motherPhone,
      admissionYear,
      currentYear,
      darsId,
      externalSchooling,
      watan,
      residentCity,
      address,
      mobileNumber,
    } = body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ success: false, error: "Missing required fields (Email, Password, First Name, Last Name, Role)" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
      return res.status(409).json({ success: false, error: `Email "${cleanEmail}" is already registered to another user.` });
    }

    // Check ITS duplicate for student
    if (role === "STUDENT" && its) {
      const cleanIts = its.trim();
      const existingStudent = await prisma.studentProfile.findFirst({
        where: {
          OR: [{ its: cleanIts }, { studentId: cleanIts }],
        },
      });
      if (existingStudent) {
        return res.status(409).json({ success: false, error: `Student with ITS / ID "${cleanIts}" is already registered.` });
      }
    }

    // Check Employee ID duplicate for teacher
    if (role === "TEACHER" && employeeId) {
      const cleanEmpId = employeeId.trim();
      const existingTeacher = await prisma.teacherProfile.findUnique({
        where: { employeeId: cleanEmpId },
      });
      if (existingTeacher) {
        return res.status(409).json({ success: false, error: `Teacher with Employee ID "${cleanEmpId}" already exists.` });
      }
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        plainPassword: password.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        ...(role === "TEACHER" && {
          teacherProfile: {
            create: {
              employeeId: employeeId?.trim() || `TCH-${Date.now()}`,
              department: department || null,
              subjects: subjects || [],
            },
          },
        }),
        ...(role === "STUDENT" && {
          studentProfile: {
            create: {
              studentId: its?.trim() || `STU-${Date.now()}`,
              grade: grade || "1",
              section: section || "A",
              its: its?.trim() || null,
              trNo: trNo?.trim() || null,
              motherName: motherName || null,
              fatherName: fatherName || null,
              fatherOccupation: fatherOccupation || null,
              age: age ? parseInt(age) : null,
              status: status || null,
              bloodGroup: bloodGroup || null,
              dobGregorian: dobGregorian ? new Date(dobGregorian) : null,
              dobHijri: dobHijri || null,
              hafizYear: hafizYear || null,
              nameAr: nameAr || null,
              fatherEmail: fatherEmail || null,
              motherEmail: motherEmail || null,
              fatherPhone: fatherPhone || null,
              motherPhone: motherPhone || null,
              admissionYear: admissionYear || null,
              currentYear: currentYear || null,
              darsId: darsId || null,
              externalSchooling: externalSchooling || null,
              watan: watan || null,
              residentCity: residentCity || null,
              address: address || null,
              mobileNumber: mobileNumber || null,
            },
          },
        }),
        ...(role === "PARENT" && {
          parentProfile: {
            create: {
              phone: phone?.trim() || null,
              secondaryPhone: body.secondaryPhone?.trim() || null,
              occupation: body.occupation?.trim() || null,
              address: address?.trim() || null,
              city: body.city?.trim() || null,
              watan: watan?.trim() || null,
              bloodGroup: bloodGroup?.trim() || null,
              its: its?.trim() || null,
              relationType: body.relationType?.trim() || null,
              notes: body.notes?.trim() || null,
            },
          },
        }),
      },
    });

    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Welcome to Darse Burhani",
          body: `Your ${role.toLowerCase()} account has been created. Sign in to access the portal.`,
          type: "WELCOME",
          link: `/${role.toLowerCase()}`,
        },
      });
    } catch {
      // Non-critical notification failure
    }

    return res.status(201).json({ success: true, data: { id: user.id, email: user.email } });
  } catch (error: any) {
    console.error("User create error:", error);
    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "A user or profile with this email, ITS, or ID already exists in the system.",
      });
    }
    return res.status(500).json({ success: false, error: error?.message || "Failed to create user" });
  }
});

router.put("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { id, firstName, lastName, email, isActive, portfolioEnabled, avatarUrl } = body;

    if (!id) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }

    // Check if email is being changed and if it already exists
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== id) {
        return res.status(409).json({ success: false, error: "Email already exists" });
      }
    }

    const userData: Record<string, any> = {};
    if (firstName !== undefined) userData.firstName = firstName.trim();
    if (lastName !== undefined) userData.lastName = lastName.trim();
    if (email !== undefined) userData.email = email.trim();
    if (isActive !== undefined) userData.isActive = isActive;
    if (avatarUrl !== undefined) userData.avatarUrl = avatarUrl || null;

    const user = await prisma.user.update({
      where: { id },
      data: userData,
    });

    // Update portfolioEnabled and photoUrl on teacher profile if provided
    if (user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: id } });
      if (teacherProfile) {
        const teacherData: Record<string, any> = {};
        if (portfolioEnabled !== undefined) teacherData.portfolioEnabled = portfolioEnabled;
        if (avatarUrl !== undefined) teacherData.photoUrl = avatarUrl || null;
        if (body.photoUrl !== undefined) teacherData.photoUrl = body.photoUrl || null;

        if (Object.keys(teacherData).length > 0) {
          await prisma.teacherProfile.update({
            where: { id: teacherProfile.id },
            data: teacherData,
          });
        }
      }
    }

    // Update parent profile if user is PARENT
    if (user.role === "PARENT") {
      const parentProfileData: Record<string, any> = {};
      if (body.phone !== undefined) parentProfileData.phone = body.phone?.trim() || null;
      if (body.secondaryPhone !== undefined) parentProfileData.secondaryPhone = body.secondaryPhone?.trim() || null;
      if (body.occupation !== undefined) parentProfileData.occupation = body.occupation?.trim() || null;
      if (body.address !== undefined) parentProfileData.address = body.address?.trim() || null;
      if (body.city !== undefined) parentProfileData.city = body.city?.trim() || null;
      if (body.watan !== undefined) parentProfileData.watan = body.watan?.trim() || null;
      if (body.bloodGroup !== undefined) parentProfileData.bloodGroup = body.bloodGroup?.trim() || null;
      if (body.its !== undefined) parentProfileData.its = body.its?.trim() || null;
      if (body.relationType !== undefined) parentProfileData.relationType = body.relationType?.trim() || null;
      if (body.notes !== undefined) parentProfileData.notes = body.notes?.trim() || null;

      if (Object.keys(parentProfileData).length > 0) {
        await prisma.parentProfile.upsert({
          where: { userId: id },
          update: parentProfileData,
          create: {
            userId: id,
            ...parentProfileData,
          },
        });
      }
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error("User update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update user" });
  }
});

// POST /api/admin/users/clear-avatars
router.post("/clear-avatars", requireRole("ADMIN"), async (req, res) => {
  try {
    const { userId, role } = req.body as { userId?: string; role?: string };

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      });
      await prisma.teacherProfile.updateMany({
        where: { userId },
        data: { photoUrl: null },
      });
      return res.json({ success: true, message: "User profile image cleared successfully" });
    }

    const where: Record<string, any> = {};
    if (role && role !== "ALL") {
      where.role = role;
    }

    const [userUpdate, teacherUpdate] = await Promise.all([
      prisma.user.updateMany({
        where,
        data: { avatarUrl: null },
      }),
      prisma.teacherProfile.updateMany({
        data: { photoUrl: null },
      }),
    ]);

    return res.json({
      success: true,
      message: `Cleared avatar images for ${userUpdate.count} users and ${teacherUpdate.count} faculty profiles.`,
    });
  } catch (error) {
    console.error("Clear avatars error:", error);
    return res.status(500).json({ success: false, error: "Failed to clear profile images" });
  }
});

router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = (req.query.id as string) || (req.body?.id as string);

    if (!id) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }

    const result = await completelyDeleteUser(id);
    return res.json({
      success: true,
      message: "User profile completely purged from database and biometric terminals.",
      data: result,
    });
  } catch (error: any) {
    console.error("User complete delete error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to delete user" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }

    const result = await completelyDeleteUser(id);
    return res.json({
      success: true,
      message: "User profile completely purged from database and biometric terminals.",
      data: result,
    });
  } catch (error: any) {
    console.error("User complete delete error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to delete user" });
  }
});

// POST /api/admin/users/reset-password
router.post("/reset-password", requireRole("ADMIN"), async (req, res) => {
  try {
    const { userId, newPassword } = req.body as { userId?: string; newPassword?: string };

    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, error: "User ID and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters long" });
    }

    const passwordHash = await hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        plainPassword: newPassword,
      },
    });

    // Invalidate active sessions
    await prisma.session.deleteMany({ where: { userId } });

    return res.json({ success: true, message: "User password reset successfully" });
  } catch (error) {
    console.error("Admin user reset password error:", error);
    return res.status(500).json({ success: false, error: "Failed to reset password" });
  }
});

export default router;
