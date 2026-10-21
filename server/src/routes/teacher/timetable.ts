import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { cache } from "../../lib/cache";
import { getRecentTimetableChanges, isSlotRecentlyChanged } from "../../lib/timetable-notify";

const router = Router();

// GET /api/teacher/timetable - Teacher's personal schedule + assigned classes + badals (high speed cached)
router.get("/", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    let teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        masoolClasses: {
          where: { isActive: true },
          include: {
            _count: { select: { enrollments: true, timetableSlots: true } },
          },
        },
      },
    });

    if (!teacherProfile && session.user.role === "ADMIN") {
      teacherProfile = await prisma.teacherProfile.findFirst({
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          masoolClasses: {
            where: { isActive: true },
            include: {
              _count: { select: { enrollments: true, timetableSlots: true } },
            },
          },
        },
      });
    }

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const nextWeek = new Date(startOfDay.getTime() + 7 * 86400000);

    const cacheKey = `teacher:timetable:personal:${teacherProfile.id}`;
    const data = await cache.getOrSet(
      cacheKey,
      async () => {
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

        const masoolClassesList = (teacherProfile.masoolClasses || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          roomNumber: c.roomNumber || `Room ${c.name}`,
          studentCount: c._count.enrollments,
          slotCount: c._count.timetableSlots,
        }));

        return {
          teacher: {
            id: teacherProfile.id,
            name: `${teacherProfile.user.firstName} ${teacherProfile.user.lastName}`,
            its: teacherProfile.its,
          },
          isClassMasool: masoolClassesList.length > 0,
          masoolClasses: masoolClassesList,
          recentChanges: getRecentTimetableChanges(),
          slots: mySlots.map((s) => {
            const changeInfo = isSlotRecentlyChanged(s);
            const updatedAtTime = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
            const createdAtTime = s.createdAt ? new Date(s.createdAt).getTime() : 0;
            const isRecentByDate = Boolean(
              updatedAtTime &&
              Date.now() - updatedAtTime < 3 * 24 * 60 * 60 * 1000 &&
              updatedAtTime - createdAtTime > 5000
            );
            const isRecent = Boolean(changeInfo || isRecentByDate);

            return {
              id: s.id,
              classId: s.classId,
              className: s.className || s.class?.name || "Class",
              period: s.period,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              subject: s.subject,
              roomNumber: s.roomNumber,
              updatedAt: s.updatedAt,
              isRecentlyChanged: isRecent,
              changeDescription: changeInfo?.changeDescription || (isRecent ? `Recently updated: ${s.subject}` : null),
            };
          }),
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
        };
      },
      { ttl: 15_000, tags: ["timetableslot", "timetable", "timetablebadal"] }
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Teacher timetable error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch teacher timetable" });
  }
});

// GET /api/teacher/timetable/class/:name - Full timetable for any Darajah class
router.get("/class/:name", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const { name } = req.params;
    const cleanName = (name || "").replace(/\s+/g, " ").trim();
    const noSpaceName = cleanName.replace(/\s+/g, "");

    const cacheKey = `teacher:timetable:class:${encodeURIComponent(cleanName.toLowerCase())}`;
    const data = await cache.getOrSet(
      cacheKey,
      async () => {
        const targetClass = await prisma.class.findFirst({
          where: {
            OR: [
              { name: cleanName },
              { name: noSpaceName },
              { name: { contains: cleanName, mode: "insensitive" } },
            ],
          },
          include: {
            teacher: { select: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            masool: { select: { its: true, user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } } },
            enrollments: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
                    },
                  },
                },
              },
              orderBy: [{ student: { rollNumber: "asc" } }, { student: { user: { firstName: "asc" } } }],
            },
            timetableSlots: {
              include: {
                teacher: {
                  include: {
                    user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                  },
                },
              },
              orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
            },
            _count: { select: { enrollments: true } },
          },
        });

        if (!targetClass) {
          return null;
        }

        let slots = targetClass.timetableSlots || [];
        if (slots.length === 0) {
          slots = await prisma.timetableSlot.findMany({
            where: {
              OR: [
                { classId: targetClass.id },
                { className: cleanName },
                { className: noSpaceName },
              ],
            },
            include: {
              teacher: {
                include: {
                  user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                },
              },
            },
            orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
          });
        }

        return {
          class: {
            id: targetClass.id,
            name: targetClass.name,
            grade: targetClass.grade,
            section: targetClass.section,
            roomNumber: targetClass.roomNumber || `Room ${targetClass.name}`,
            studentCount: targetClass._count.enrollments,
            masool: targetClass.masool ? {
              name: `${targetClass.masool.user.firstName} ${targetClass.masool.user.lastName}`,
              email: targetClass.masool.user.email,
              its: targetClass.masool.its,
              avatarUrl: targetClass.masool.user.avatarUrl,
            } : null,
            talabat: (targetClass.enrollments || []).map((e: any) => ({
              id: e.student.id,
              userId: e.student.user?.id,
              name: `${e.student.user?.firstName || ""} ${e.student.user?.lastName || ""}`.trim(),
              its: e.student.its,
              rollNumber: e.student.rollNumber || null,
              avatarUrl: e.student.user?.avatarUrl || null,
            })),
          },
          slots: slots.map((s: any) => {
            const changeInfo = isSlotRecentlyChanged(s);
            const updatedAtTime = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
            const createdAtTime = s.createdAt ? new Date(s.createdAt).getTime() : 0;
            const isRecentByDate = Boolean(
              updatedAtTime &&
              Date.now() - updatedAtTime < 3 * 24 * 60 * 60 * 1000 &&
              updatedAtTime - createdAtTime > 5000
            );
            const isRecent = Boolean(changeInfo || isRecentByDate);

            return {
              id: s.id,
              classId: s.classId,
              className: s.className || targetClass.name,
              teacherId: s.teacherId,
              teacherName: s.teacherName || (s.teacher?.user ? `${s.teacher.user.firstName || ""} ${s.teacher.user.lastName || ""}`.trim() : "TBA"),
              teacherAvatar: s.teacher?.user?.avatarUrl || null,
              subject: s.subject,
              dayOfWeek: s.dayOfWeek,
              period: s.period,
              startTime: s.startTime,
              endTime: s.endTime,
              roomNumber: s.roomNumber || targetClass.roomNumber || `Room ${targetClass.name}`,
              isBreak: s.isBreak,
              breakName: s.breakName,
              updatedAt: s.updatedAt,
              isRecentlyChanged: isRecent,
              changeDescription: changeInfo?.changeDescription || (isRecent ? `Recently updated: ${s.subject} (${s.teacherName || "Assigned Teacher"})` : null),
            };
          }),
        };
      },
      { ttl: 15_000, tags: ["timetableslot", "timetable", "class"] }
    );

    if (!data) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Teacher class timetable error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch class timetable" });
  }
});

export default router;
