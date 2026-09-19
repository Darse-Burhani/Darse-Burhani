import { Router } from "express";
import prisma from "../lib/prisma";
import { cache } from "../lib/cache";
import { requireAuth, requireRole } from "../middleware";
import { AttendanceSource, AttendanceStatus } from "@prisma/client";
import { broadcastAttendanceEvent } from "../lib/biometric";
import adminAttendanceScheduleRoutes from "./admin/attendance-schedule";

const router = Router();

// Sub-router for attendance schedule (/api/attendance/schedule)
router.use("/schedule", adminAttendanceScheduleRoutes);

function parseDay(dateStr: string | undefined): Date {
  const d = new Date(dateStr || Date.now());
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// POST /api/attendance - Record a biometric attendance event (idempotent per student/class/day)
router.post("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { studentId, classId, status, checkInTime, verificationMethod, biometricHash } = body;

    if (!studentId || !classId || !status) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const date = parseDay(checkInTime ? new Date(checkInTime).toISOString() : undefined);
    const record = await prisma.attendanceRecord.upsert({
      where: { studentId_classId_date: { studentId, classId, date } },
      create: {
        studentId,
        classId,
        date,
        status,
        checkInTime: checkInTime ? new Date(checkInTime) : null,
        verificationMethod,
        biometricHash,
        recordedById: session.user.id,
      },
      update: {
        status,
        checkInTime: checkInTime ? new Date(checkInTime) : null,
        verificationMethod,
        biometricHash,
        recordedById: session.user.id,
      },
    });

    // Check for streak bonuses (10 consecutive on-time arrivals)
    const recentRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId: record.studentId,
        status: "PRESENT",
        checkInTime: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { date: "desc" },
      take: 10,
    });

    if (recentRecords.length === 10) {
      let teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!teacherProfile) {
        teacherProfile = await prisma.teacherProfile.findFirst({
          where: { user: { isActive: true } },
        });
      }

      if (teacherProfile) {
        // Award Early Bird Streak Bonus
        await prisma.pointLog.create({
          data: {
            studentId: record.studentId,
            teacherId: teacherProfile.id,
            points: 50,
            actionType: "POSITIVE",
            category: "Attendance",
            note: "Early Bird Streak Bonus: 10 consecutive on-time arrivals",
          },
        });

        await prisma.studentProfile.update({
          where: { id: record.studentId },
          data: {
            currentPoints: { increment: 50 },
            totalPoints: { increment: 50 },
            streakDays: { increment: 1 },
          },
        });
      }
    }

    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("Attendance recording error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to record attendance",
    });
  }
});

// POST /api/attendance/bulk - Mark attendance for an entire class roster on a date
router.post("/bulk", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { classId, date, records } = body;

    if (!classId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: "classId, date and a non-empty records array are required",
      });
    }

    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacher) {
      return res.status(403).json({ success: false, error: "Teacher profile not found" });
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacherId: true },
    });
    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }
    if (cls.teacherId !== teacher.id) {
      return res.status(403).json({ success: false, error: "You can only mark attendance for your own classes" });
    }

    const day = parseDay(date);

    const saved = await prisma.$transaction(
      records.map((r: any) =>
        prisma.attendanceRecord.upsert({
          where: { studentId_classId_date: { studentId: r.studentId, classId, date: day } },
          create: {
            studentId: r.studentId,
            classId,
            date: day,
            status: r.status,
            source: AttendanceSource.MANUAL,
            checkInTime: r.checkInTime ? new Date(r.checkInTime) : null,
            checkOutTime: r.checkOutTime ? new Date(r.checkOutTime) : null,
            recordedById: session.user.id,
          },
          update: {
            status: r.status,
            source: AttendanceSource.MANUAL,
            checkInTime: r.checkInTime ? new Date(r.checkInTime) : null,
            checkOutTime: r.checkOutTime ? new Date(r.checkOutTime) : null,
            recordedById: session.user.id,
          },
        }),
      ),
    );

    // Also sync AttendanceRegistry for each student so daily stats reflect class attendance
    for (const r of records) {
      if (!r.studentId) continue;
      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: r.studentId, date: day } },
        create: {
          studentId: r.studentId,
          date: day,
          status: r.status,
          source: AttendanceSource.MANUAL,
          checkInTime: r.checkInTime ? new Date(r.checkInTime) : null,
          checkOutTime: r.checkOutTime ? new Date(r.checkOutTime) : null,
          remarks: `Class attendance marked by Teacher`,
          recordedById: session.user.id,
        },
        update: {
          status: r.status,
          source: AttendanceSource.MANUAL,
          checkInTime: r.checkInTime ? new Date(r.checkInTime) : null,
          checkOutTime: r.checkOutTime ? new Date(r.checkOutTime) : null,
          remarks: `Class attendance marked by Teacher`,
          recordedById: session.user.id,
        },
      }).catch(() => {});
    }

    // Broadcast SSE live event
    broadcastAttendanceEvent({
      type: "CLASS_ATTENDANCE_SAVED",
      classId,
      count: saved.length,
      date: day.toISOString(),
      actorName: `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim(),
    });

    return res.json({
      success: true,
      data: { count: saved.length, records: saved },
    });
  } catch (error) {
    console.error("Bulk attendance error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save attendance",
    });
  }
});

// POST /api/attendance/justify - Student or parent submits an absence justification
router.post("/justify", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const role = session.user.role;

    const body = req.body as Record<string, any>;
    const { attendanceId, reason } = body;

    if (!attendanceId || !reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: "attendanceId and reason are required" });
    }

    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
      include: {
        student: { include: { user: true } },
        class: { include: { teacher: true } },
      },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: "Attendance record not found" });
    }

    if (record.status === "PRESENT") {
      return res.status(400).json({ success: false, error: "Only absent records can be justified" });
    }

    if (role === "STUDENT") {
      const student = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!student || student.id !== record.studentId) {
        return res.status(403).json({ success: false, error: "Not your attendance record" });
      }
    } else if (role === "PARENT") {
      const parent = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { studentLinks: true },
      });
      if (!parent || !parent.studentLinks.some((l) => l.studentId === record.studentId)) {
        return res.status(403).json({ success: false, error: "Not a linked student" });
      }
    } else {
      return res.status(403).json({ success: false, error: "Only students or parents can justify absences" });
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        justification: reason.trim(),
        justificationStatus: "PENDING",
        justificationSubmittedAt: new Date(),
      },
    });

    cache.invalidateTag("attendanceRecord");

    // Notify class teacher in-app and in notification bar
    const teacherUserId = record.class?.teacher?.userId;
    const studentName = `${record.student.user.firstName} ${record.student.user.lastName}`;
    if (teacherUserId) {
      await prisma.notification.create({
        data: {
          userId: teacherUserId,
          title: "New Absence Justification",
          body: `${studentName} submitted an absence justification: "${reason.trim().slice(0, 100)}"`,
          type: "ALERT",
          link: "/teacher/justifications",
          priority: "HIGH",
        },
      });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Attendance justification error:", error);
    return res.status(500).json({ success: false, error: "Failed to submit justification" });
  }
});

// PUT /api/attendance/justification - Teacher approves or rejects a justification
router.put("/justification", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { attendanceId, decision } = body;

    if (!attendanceId || !["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ success: false, error: "attendanceId and a valid decision are required" });
    }

    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacher) {
      return res.status(403).json({ success: false, error: "Teacher profile not found" });
    }

    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
      include: { student: { include: { user: true } } },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: "Attendance record not found" });
    }

    if (record.classId) {
      const cls = await prisma.class.findUnique({ where: { id: record.classId } });
      if (!cls || cls.teacherId !== teacher.id) {
        return res.status(403).json({ success: false, error: "Not your class" });
      }
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        justificationStatus: decision,
        justifiedById: session.user.id,
        justifiedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: record.student.userId,
        title: decision === "APPROVED" ? "Absence Justified" : "Absence Justification Declined",
        body:
          decision === "APPROVED"
            ? "Your absence has been approved as justified."
            : "Your absence justification was declined. Please contact your teacher.",
        type: "ALERT",
        link: "/talabat/attendance",
      },
    });

    cache.invalidateTag("attendanceRecord");

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Attendance justification review error:", error);
    return res.status(500).json({ success: false, error: "Failed to update justification" });
  }
});

// GET /api/attendance - Get attendance records
router.get("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const role = session.user.role;

    const studentId = req.query.studentId as string;
    const classId = req.query.classId as string;
    const date = req.query.date as string;
    const status = req.query.status as string;
    const method = req.query.method as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: Record<string, unknown> = {};
    if (studentId) where.studentId = studentId;
    if (classId) where.classId = classId;
    if (status && status !== "ALL") where.status = status;
    if (method && method !== "ALL") where.verificationMethod = method;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    } else if (date) {
      where.date = {
        gte: new Date(date),
        lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
      };
    }

    // Scope visibility by role
    if (role === "TEACHER") {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!teacher) {
        return res.status(403).json({ success: false, error: "Teacher profile not found" });
      }
      where.class = { teacherId: teacher.id };
    } else if (role === "STUDENT") {
      const student = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!student) {
        return res.status(403).json({ success: false, error: "Student profile not found" });
      }
      where.studentId = student.id;
    } else if (role === "PARENT") {
      const parent = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { studentLinks: { select: { studentId: true } } },
      });
      if (!parent) {
        return res.status(403).json({ success: false, error: "Parent profile not found" });
      }
      where.studentId = { in: parent.studentLinks.map((l) => l.studentId) };
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            grade: true,
            section: true,
            biometricHash: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        class: {
          select: { id: true, name: true, subject: true, grade: true, section: true },
        },
      },
      orderBy: [{ checkInTime: "desc" }, { date: "desc" }],
      take: 300,
    });

    return res.json({ success: true, data: records });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch attendance",
    });
  }
});

export default router;
