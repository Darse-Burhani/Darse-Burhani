import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/teacher/timetable - Teacher's personal schedule + assigned classes + badals
router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const nextWeek = new Date(startOfDay.getTime() + 7 * 86400000);

    const [mySlots, myBadalDuties, badalsForMe, allClasses] = await Promise.all([
      // 1. Regular weekly timetable slots
      prisma.timetableSlot.findMany({
        where: { teacherId: teacherProfile.id },
        include: {
          class: { select: { id: true, name: true, grade: true, section: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
      }),

      // 2. Badal assignments where THIS teacher is the substitute
      prisma.timetableBadal.findMany({
        where: {
          badalTeacherId: teacherProfile.id,
          date: { gte: startOfDay, lt: nextWeek },
        },
        include: {
          originalTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ date: "asc" }, { period: "asc" }],
      }),

      // 3. Badal assignments where someone else is covering for THIS teacher
      prisma.timetableBadal.findMany({
        where: {
          originalTeacherId: teacherProfile.id,
          date: { gte: startOfDay, lt: nextWeek },
        },
        include: {
          badalTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ date: "asc" }, { period: "asc" }],
      }),

      // 4. All classes for reference
      prisma.class.findMany({
        where: { isActive: true, academicYear: "1448 H", grade: { in: ["1", "2", "3", "4"] } },
        select: { id: true, name: true, grade: true, section: true },
        orderBy: [{ grade: "asc" }, { section: "asc" }],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        teacher: {
          id: teacherProfile.id,
          name: `${teacherProfile.user.firstName} ${teacherProfile.user.lastName}`,
          its: teacherProfile.its,
        },
        slots: mySlots.map((s) => ({
          id: s.id,
          classId: s.classId,
          className: s.className || s.class?.name || "Class",
          period: s.period,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject,
          roomNumber: s.roomNumber,
        })),
        badalDuties: myBadalDuties.map((b) => ({
          id: b.id,
          date: b.date.toISOString().split("T")[0],
          className: b.className,
          period: b.period,
          startTime: b.startTime,
          endTime: b.endTime,
          subject: b.subject,
          originalTeacher: b.originalTeacher ? `${b.originalTeacher.user.firstName} ${b.originalTeacher.user.lastName}` : b.originalTeacherName,
          reason: b.reason,
          instructions: b.instructions,
          status: b.status,
          isFulfilled: b.isFulfilled,
        })),
        badalsForMe: badalsForMe.map((b) => ({
          id: b.id,
          date: b.date.toISOString().split("T")[0],
          className: b.className,
          period: b.period,
          startTime: b.startTime,
          endTime: b.endTime,
          subject: b.subject,
          substituteTeacher: b.badalTeacher ? `${b.badalTeacher.user.firstName} ${b.badalTeacher.user.lastName}` : b.badalTeacherName,
          status: b.status,
        })),
        classes: allClasses,
      },
    });
  } catch (error) {
    console.error("Teacher timetable error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch teacher timetable" });
  }
});

export default router;
