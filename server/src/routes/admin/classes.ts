import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/admin/classes - List all classes
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const page = parseInt((req.query.page as string) || "1");
    const pageSize = parseInt((req.query.pageSize as string) || "50");
    const skip = (page - 1) * pageSize;

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        include: {
          teacher: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          masool: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.class.count(),
    ]);

    return res.json({
      success: true,
      data: classes.map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        section: c.section,
        subject: c.subject,
        roomNumber: c.roomNumber,
        teacherName: c.teacher?.user ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}` : "Unassigned",
        masoolName: c.masool?.user ? `${c.masool.user.firstName} ${c.masool.user.lastName}` : null,
        studentCount: c._count.enrollments,
        academicYear: c.academicYear,
        isActive: c.isActive,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Classes fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch classes" });
  }
});

// POST /api/admin/classes - Create a class
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { name, grade, section, subject, roomNumber, teacherId, masoolId, academicYear } = body;

    if (!name || !grade || !section || !subject || !teacherId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: teacherId } });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    let masoolProfile = null;
    if (masoolId) {
      masoolProfile = await prisma.teacherProfile.findUnique({ where: { userId: masoolId } });
      if (!masoolProfile) {
        return res.status(404).json({ success: false, error: "Masool not found" });
      }
    }

    const newClass = await prisma.class.create({
      data: {
        name,
        grade,
        section,
        subject,
        roomNumber: roomNumber || null,
        teacherId: teacherProfile.id,
        masoolId: masoolProfile?.id ?? null,
        academicYear: academicYear || "2025-2026",
      },
    });

    return res.status(201).json({ success: true, data: newClass });
  } catch (error) {
    console.error("Class create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create class" });
  }
});

// GET /api/admin/classes/:id - Full class detail: info + roster + timetable
router.get("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: {
        teacher: {
          select: {
            id: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        masool: {
          select: {
            id: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        enrollments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    isActive: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
          orderBy: { student: { user: { firstName: "asc" } } },
        },
      },
    });

    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    const slots = await prisma.timetableSlot.findMany({
      where: { classId: cls.id },
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });

    return res.json({
      success: true,
      data: {
        id: cls.id,
        name: cls.name,
        grade: cls.grade,
        section: cls.section,
        subject: cls.subject,
        roomNumber: cls.roomNumber,
        academicYear: cls.academicYear,
        isActive: cls.isActive,
        teacherId: cls.teacher?.user?.id || null,
        teacherName: cls.teacher?.user ? `${cls.teacher.user.firstName} ${cls.teacher.user.lastName}` : "Unassigned",
        masoolId: cls.masool?.user?.id ?? null,
        masoolName: cls.masool?.user ? `${cls.masool.user.firstName} ${cls.masool.user.lastName}` : null,
        students: cls.enrollments.map((e) => ({
          studentProfileId: e.student.id,
          userId: e.student.user.id,
          studentId: e.student.studentId,
          firstName: e.student.user.firstName,
          lastName: e.student.user.lastName,
          email: e.student.user.email,
          isActive: e.student.user.isActive,
          avatarUrl: e.student.user.avatarUrl,
          grade: e.student.grade,
          section: e.student.section,
          status: e.student.status,
        })),
        slots: slots.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject,
          roomNumber: s.roomNumber,
          isBreak: s.isBreak,
          breakName: s.breakName,
        })),
      },
    });
  } catch (error) {
    console.error("Class detail error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch class" });
  }
});

// GET /api/admin/classes/:id/available-students - Talabat NOT enrolled in this class
router.get("/:id/available-students", requireRole("ADMIN"), async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    const enrolled = await prisma.classEnrollment.findMany({
      where: { classId: cls.id, isActive: true },
      select: { studentId: true },
    });
    const enrolledIds = enrolled.map((e) => e.studentId);

    const students = await prisma.studentProfile.findMany({
      where: { id: { notIn: enrolledIds }, user: { role: "STUDENT" } },
      select: {
        id: true,
        studentId: true,
        grade: true,
        section: true,
        status: true,
        user: {
          select: { id: true, firstName: true, lastName: true, isActive: true, avatarUrl: true },
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
    });

    return res.json({
      success: true,
      data: {
        classGrade: cls.grade,
        classSection: cls.section,
        students: students.map((s) => ({
          studentProfileId: s.id,
          userId: s.user.id,
          studentId: s.studentId,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          isActive: s.user.isActive,
          avatarUrl: s.user.avatarUrl,
          grade: s.grade,
          section: s.section,
          status: s.status,
        })),
      },
    });
  } catch (error) {
    console.error("Available students error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch available students" });
  }
});

// PUT /api/admin/classes/:id - Update class details
router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    const body = req.body as Record<string, any>;
    const { name, grade, section, subject, roomNumber, teacherId, masoolId, academicYear, isActive } = body;

    let teacherProfileId = cls.teacherId;
    if (teacherId !== undefined && teacherId) {
      const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: teacherId } });
      if (!teacherProfile) {
        return res.status(404).json({ success: false, error: "Teacher not found" });
      }
      teacherProfileId = teacherProfile.id;
    }

    let masoolProfileId: string | null = cls.masoolId ?? null;
    if (masoolId !== undefined) {
      if (masoolId) {
        const masoolProfile = await prisma.teacherProfile.findUnique({ where: { userId: masoolId } });
        if (!masoolProfile) {
          return res.status(404).json({ success: false, error: "Masool not found" });
        }
        masoolProfileId = masoolProfile.id;
      } else {
        masoolProfileId = null; // cleared
      }
    }

    const updated = await prisma.class.update({
      where: { id: cls.id },
      data: {
        name: name ?? cls.name,
        grade: grade ?? cls.grade,
        section: section ?? cls.section,
        subject: subject ?? cls.subject,
        roomNumber: roomNumber === "" ? null : roomNumber ?? cls.roomNumber,
        teacherId: teacherProfileId,
        masoolId: masoolProfileId,
        academicYear: academicYear ?? cls.academicYear,
        isActive: isActive !== undefined ? Boolean(isActive) : cls.isActive,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Class update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update class" });
  }
});

// DELETE /api/admin/classes/:id - Delete a class (blocked if it has history)
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    const [attendanceCount, pointLogCount] = await Promise.all([
      prisma.attendanceRecord.count({ where: { classId: cls.id } }),
      prisma.pointLog.count({ where: { classId: cls.id } }),
    ]);

    if (attendanceCount > 0 || pointLogCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete this class — it has ${attendanceCount} attendance record(s) and ${pointLogCount} point log(s). Mark it inactive instead.`,
      });
    }

    // Enrollments + timetable slots cascade on delete.
    await prisma.class.delete({ where: { id: cls.id } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Class delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete class" });
  }
});

// POST /api/admin/classes/:id/students - Enroll a talabat into the class
router.post("/:id/students", requireRole("ADMIN"), async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    const { studentProfileId, studentId } = req.body as Record<string, any>;
    const profileId = (studentProfileId as string) || (studentId as string);
    if (!profileId) {
      return res.status(400).json({ success: false, error: "studentProfileId is required" });
    }

    const student = await prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!student) {
      return res.status(404).json({ success: false, error: "Talabat not found" });
    }

    await prisma.classEnrollment.upsert({
      where: { classId_studentId: { classId: cls.id, studentId: student.id } },
      update: { isActive: true },
      create: { classId: cls.id, studentId: student.id, isActive: true },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Class enroll error:", error);
    return res.status(500).json({ success: false, error: "Failed to enroll talabat" });
  }
});

// DELETE /api/admin/classes/:id/students/:studentProfileId - Remove a talabat from the class
router.delete("/:id/students/:studentProfileId", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id, studentProfileId } = req.params;

    const enrollment = await prisma.classEnrollment.findUnique({
      where: { classId_studentId: { classId: id, studentId: studentProfileId } },
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, error: "Enrollment not found" });
    }

    await prisma.classEnrollment.delete({ where: { id: enrollment.id } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Class unenroll error:", error);
    return res.status(500).json({ success: false, error: "Failed to remove talabat from class" });
  }
});

export default router;
