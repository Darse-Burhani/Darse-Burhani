
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const slots = await prisma.timetableSlot.findMany({
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
            section: true,
            subject: true,
            teacher: {
              select: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });

    const classes = await prisma.class.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        grade: true,
        section: true,
        subject: true,
        teacher: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return res.json({
      success: true,
      data: {
        slots: slots.map((s) => ({
          id: s.id,
          classId: s.classId,
          className: s.class?.name || "Break",
          classGrade: s.class?.grade || "",
          classSection: s.class?.section || "",
          subject: s.subject,
          teacherName: s.class ? `${s.class.teacher.user.firstName} ${s.class.teacher.user.lastName}` : "",
          dayOfWeek: s.dayOfWeek,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          roomNumber: s.roomNumber,
          isBreak: s.isBreak,
          breakName: s.breakName,
        })),
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          subject: c.subject,
          teacherName: `${c.teacher.user.firstName} ${c.teacher.user.lastName}`,
        })),
      },
    });
  } catch (error) {
    console.error("Timetable fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch timetable" });
  }
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { id, classId, dayOfWeek, period, startTime, endTime, subject, roomNumber, isBreak, breakName } = body;

    if (dayOfWeek === undefined || period === undefined || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    let slot;
    if (id) {
      slot = await prisma.timetableSlot.update({
        where: { id },
        data: {
          classId: classId || null,
          dayOfWeek,
          period,
          startTime,
          endTime,
          subject: subject || "",
          roomNumber: roomNumber || null,
          isBreak: isBreak || false,
          breakName: breakName || null,
        },
      });
    } else if (classId) {
      // Try to find existing slot for this class/day/period
      const existing = await prisma.timetableSlot.findFirst({
        where: { classId, dayOfWeek, period },
      });
      if (existing) {
        slot = await prisma.timetableSlot.update({
          where: { id: existing.id },
          data: {
            startTime,
            endTime,
            subject: subject || "",
            roomNumber: roomNumber || null,
          },
        });
      } else {
        slot = await prisma.timetableSlot.create({
          data: {
            classId,
            dayOfWeek,
            period,
            startTime,
            endTime,
            subject: subject || "",
            roomNumber: roomNumber || null,
            isBreak: false,
          },
        });
      }
    } else {
      // Break slot - no classId
      slot = await prisma.timetableSlot.create({
        data: {
          dayOfWeek,
          period,
          startTime,
          endTime,
          subject: "",
          isBreak: true,
          breakName: breakName || "Break",
        },
      });
    }

    return res.json({ success: true, data: slot });
  } catch (error) {
    console.error("Timetable create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create timetable slot" });
  }
});

router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const id = (req.query.id as string);

    if (!id) {
      return res.status(400).json({ success: false, error: "Slot ID required" });
    }

    await prisma.timetableSlot.delete({ where: { id } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Timetable delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete timetable slot" });
  }
});

export default router;
