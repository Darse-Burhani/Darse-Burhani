import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { cache } from "../../lib/cache";
import { getRecentTimetableChanges, isSlotRecentlyChanged } from "../../lib/timetable-notify";
import { canonicalizeTeacherDisplay } from "../../lib/timetable-master-sync";

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
              class: {
                select: {
                  id: true,
                  name: true,
                  grade: true,
                  section: true,
                  masool: {
                    select: {
                      id: true,
                      its: true,
                      user: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
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

        // Pre-fetch timetables for all masool classes
        const masoolClassTimetables = await Promise.all(
          masoolClassesList.map(async (mc) => {
            const slots = await prisma.timetableSlot.findMany({
              where: { classId: mc.id },
              include: {
                teacher: {
                  include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
                },
              },
              orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
            });
            return {
              classId: mc.id,
              className: mc.name,
              grade: mc.grade,
              section: mc.section,
              slots: slots.map((s) => {
                const slotDisplay = canonicalizeTeacherDisplay(
                  s.teacher ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}` : "TBA",
                  s.teacher?.user?.avatarUrl || null,
                );
                return {
                  id: s.id,
                  classId: s.classId,
                  className: s.className || mc.name,
                  period: s.period,
                  dayOfWeek: s.dayOfWeek,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  subject: s.subject,
                  roomNumber: s.roomNumber,
                  teacherId: s.teacherId,
                  teacherName: slotDisplay.name,
                  teacherAvatar: slotDisplay.avatarUrl,
                  updatedAt: s.updatedAt,
                };
              }),
            };
          })
        );

        return {
          teacher: (() => {
            const selfDisplay = canonicalizeTeacherDisplay(
              `${teacherProfile.user.firstName} ${teacherProfile.user.lastName}`.trim(),
              null,
            );
            return {
              id: teacherProfile.id,
              name: selfDisplay.name,
              its: teacherProfile.its,
            };
          })(),
          isClassMasool: masoolClassesList.length > 0,
          masoolClasses: masoolClassesList,
          masoolClassTimetables,
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
              classMasool: s.class?.masool
                ? `${s.class.masool.user.firstName} ${s.class.masool.user.lastName}`.trim()
                : null,
              classMasoolIts: s.class?.masool?.its || null,
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
              orderBy: [{ student: { its: "asc" } }, { student: { user: { firstName: "asc" } } }],
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

// GET /api/teacher/timetable/tomorrow-hikvision - Next day's Hikvision scan schedule
router.get("/tomorrow-hikvision", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // Get tomorrow's date in IST
    const now = new Date();
    const istTomorrow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    istTomorrow.setDate(istTomorrow.getDate() + 1);
    const startOfDay = new Date(Date.UTC(istTomorrow.getUTCFullYear(), istTomorrow.getUTCMonth(), istTomorrow.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // Get all classes this teacher teaches
    const teacherSlots = await prisma.timetableSlot.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        class: { select: { id: true, name: true, grade: true, section: true } },
      },
    });
    const classIds = [...new Set(teacherSlots.map((s) => s.classId).filter((id): id is string => Boolean(id)))];

    // Get tomorrow's scans for these classes
    const scans: any[] = ((prisma as any).hikvisionScan?.findMany
      ? await (prisma as any).hikvisionScan.findMany({
          where: {
            classId: { in: classIds },
            scanTime: { gte: startOfDay, lt: endOfDay },
          },
          include: {
            student: { select: { id: true, its: true, user: { select: { firstName: true, lastName: true } } } },
            class: { select: { name: true, grade: true, section: true } },
          },
          orderBy: { scanTime: "asc" },
        })
      : await prisma.attendanceRecord.findMany({
          where: {
            classId: { in: classIds },
            date: { gte: startOfDay, lt: endOfDay },
            source: "BIOMETRIC",
          },
          include: {
            student: { select: { id: true, its: true, user: { select: { firstName: true, lastName: true } } } },
            class: { select: { name: true, grade: true, section: true } },
          },
          orderBy: { checkInTime: "asc" },
        })
    ) as any[];

    // Group by class and period
    const scansByClass = new Map<string, any[]>();
    for (const scan of scans) {
      const key = scan.classId || "unknown";
      if (!scansByClass.has(key)) scansByClass.set(key, []);
      scansByClass.get(key)!.push(scan);
    }

    return res.json({
      success: true,
      data: {
        date: startOfDay.toISOString().split("T")[0],
        scans: scans.map((s: any) => ({
          id: s.id,
          studentName: s.student?.user ? `${s.student.user.firstName} ${s.student.user.lastName}` : "Unknown",
          studentIts: s.student?.its || "",
          className: s.class?.name || "",
          grade: s.class?.grade || "",
          section: s.class?.section || "",
          scanTime: (s.scanTime || s.checkInTime || new Date()).toISOString(),
          status: s.status,
          biometricMethod: s.biometricMethod,
        })),
        summary: {
          totalScans: scans.length,
          classesCovered: scansByClass.size,
          present: scans.filter((s: any) => s.status === "PRESENT").length,
          late: scans.filter((s: any) => s.status === "LATE").length,
          absent: scans.filter((s: any) => s.status === "ABSENT").length,
        },
      },
    });
  } catch (error) {
    console.error("Tomorrow Hikvision scans error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch tomorrow's Hikvision scans" });
  }
});

// GET /api/teacher/timetable/masool-class/:id - Full timetable with badals for a masool class
router.get("/masool-class/:id", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const targetClass = await prisma.class.findUnique({
      where: { id },
      include: {
        masool: { include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } } },
        timetableSlots: {
          include: {
            teacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
        },
        _count: { select: { enrollments: true } },
      },
    });
    if (!targetClass) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    // Get today's badals for this class
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const badals = await prisma.timetableBadal.findMany({
      where: { classId: id, date: { gte: startOfDay, lt: endOfDay } },
      include: { badalTeacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } } },
    });

    const badalByPeriod = new Map<number, any>();
    badals.forEach((b) => badalByPeriod.set(b.period, b));

    const todayDow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
    const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const todayDowNum = dowMap[todayDow] || 1;

    return res.json({
      success: true,
      data: {
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
        },
        slots: targetClass.timetableSlots.map((s) => {
          const badal = s.dayOfWeek === todayDowNum ? badalByPeriod.get(s.period) : null;
          return {
            id: s.id,
            period: s.period,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject,
            roomNumber: s.roomNumber || targetClass.roomNumber || `Room ${targetClass.name}`,
            teacherId: s.teacherId,
            teacherName: s.teacher ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}` : "TBA",
            teacherAvatar: s.teacher?.user?.avatarUrl || null,
            badal: badal ? {
              id: badal.id,
              badalTeacherName: badal.badalTeacher ? `${badal.badalTeacher.user.firstName} ${badal.badalTeacher.user.lastName}` : badal.badalTeacherName,
              badalTeacherAvatar: badal.badalTeacher?.user?.avatarUrl || null,
              reason: badal.reason,
              status: badal.status,
            } : null,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Masool class timetable error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch masool class timetable" });
  }
});

// GET /api/teacher/timetable/masool-class/:id/scans - Live biometric & manual scan records for assigned class
// STRICT PRIVACY: Only the assigned Class Masool (or Admin) can access this!
router.get("/masool-class/:id/scans", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { id } = req.params;
    const queryDate = (req.query.date as string) || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // 1. Resolve teacher profile
    let teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (!teacherProfile && session.user.role === "ADMIN") {
      teacherProfile = await prisma.teacherProfile.findFirst({
        include: { user: { select: { firstName: true, lastName: true } } },
      });
    }

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // 2. Fetch class with masool details
    const targetClass = await prisma.class.findUnique({
      where: { id },
      include: {
        masool: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!targetClass) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    // 3. STRICT PRIVACY RULE: Only Class Masool of this class or Admin may view individual scan records
    const isMasool = targetClass.masoolId === teacherProfile.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isMasool && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Access restricted: Individual student biometric scan records are private and visible only to the designated Class Masool.",
      });
    }

    // 4. Calculate day boundaries in IST
    const parts = queryDate.split("-").map(Number);
    const startOfDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // 5. Fetch all active students enrolled in this class
    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId: targetClass.id, isActive: true },
      include: {
        student: {
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
          },
        },
      },
      orderBy: [
        { student: { user: { firstName: "asc" } } },
        { student: { user: { lastName: "asc" } } },
      ],
    });

    // 6. Fetch attendance records for this class on this date
    const records = await prisma.attendanceRecord.findMany({
      where: {
        classId: targetClass.id,
        date: { gte: startOfDay, lt: endOfDay },
      },
    });

    const recordMap = new Map<string, any>();
    records.forEach((r) => recordMap.set(r.studentId, r));

    // 7. Check if raw Hikvision punches exist in hikvisionScan table
    const rawHikvisionMap = new Map<string, any[]>();
    try {
      if ((prisma as any).hikvisionScan?.findMany) {
        const studentIds = enrollments.map((e) => e.studentId);
        const scans = await (prisma as any).hikvisionScan.findMany({
          where: {
            studentId: { in: studentIds },
            scanTime: { gte: startOfDay, lt: endOfDay },
          },
          orderBy: { scanTime: "asc" },
        });
        for (const scan of scans) {
          if (!rawHikvisionMap.has(scan.studentId)) rawHikvisionMap.set(scan.studentId, []);
          rawHikvisionMap.get(scan.studentId)!.push(scan);
        }
      }
    } catch {
      // Non-critical fallback
    }

    // 8. Map individual student scan records
    const talabatScans = enrollments.map((e) => {
      const student = e.student;
      const rec = recordMap.get(student.id);
      const studentPunches = rawHikvisionMap.get(student.id) || [];

      // Determine verification method and punch times
      const isBiometric = rec?.source === "BIOMETRIC" || studentPunches.length > 0;
      const checkInDate = rec?.checkInTime || (studentPunches[0]?.scanTime ? new Date(studentPunches[0].scanTime) : null);
      const checkOutDate = rec?.checkOutTime || (studentPunches.length > 1 ? new Date(studentPunches[studentPunches.length - 1].scanTime) : null);

      let checkInTimeStr = "";
      if (checkInDate) {
        checkInTimeStr = new Date(checkInDate).toLocaleTimeString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
      }

      let checkOutTimeStr = "";
      if (checkOutDate && checkOutDate.getTime() !== checkInDate?.getTime()) {
        checkOutTimeStr = new Date(checkOutDate).toLocaleTimeString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
      }

      const status = rec?.status || (studentPunches.length > 0 ? "PRESENT" : "NOT_MARKED");
      const biometricMethod = rec?.biometricMethod || (isBiometric ? "FACIAL" : null);
      const source = rec?.source || (isBiometric ? "BIOMETRIC" : "NOT_RECORDED");

      return {
        enrollmentId: e.id,
        studentId: student.id,
        its: student.its || student.studentId || "",
        studentNumber: student.studentId || "",
        name: `${student.user.firstName} ${student.user.lastName}`.trim(),
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        avatarUrl: student.user.avatarUrl || null,
        status, // "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE" | "NOT_MARKED"
        source, // "BIOMETRIC" | "MANUAL" | "NOT_RECORDED"
        biometricMethod, // "FACIAL" | "FINGERPRINT" | null
        verificationMethod: rec?.verificationMethod || (isBiometric ? "Hikvision Biometric Terminal" : rec?.source === "MANUAL" ? "Class Masool Manual Entry" : null),
        checkInTime: checkInTimeStr,
        checkInTimestamp: checkInDate ? checkInDate.toISOString() : null,
        checkOutTime: checkOutTimeStr,
        punchesCount: Math.max(studentPunches.length, checkInDate ? 1 : 0),
        punchHistory: studentPunches.map((p) =>
          new Date(p.scanTime).toLocaleTimeString("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
        ),
        justification: rec?.justification || null,
        justificationStatus: rec?.justificationStatus || "NONE",
      };
    });

    // 9. Aggregate summary stats
    const totalEnrolled = talabatScans.length;
    const presentCount = talabatScans.filter((s) => s.status === "PRESENT").length;
    const lateCount = talabatScans.filter((s) => s.status === "LATE").length;
    const absentCount = talabatScans.filter((s) => s.status === "ABSENT").length;
    const onLeaveCount = talabatScans.filter((s) => s.status === "ON_LEAVE").length;
    const biometricCount = talabatScans.filter((s) => s.source === "BIOMETRIC" || Boolean(s.biometricMethod)).length;
    const manualCount = talabatScans.filter((s) => s.source === "MANUAL").length;
    const unmarkedCount = talabatScans.filter((s) => s.status === "NOT_MARKED").length;

    return res.json({
      success: true,
      data: {
        class: {
          id: targetClass.id,
          name: targetClass.name,
          grade: targetClass.grade,
          section: targetClass.section,
          roomNumber: targetClass.roomNumber || `Room ${targetClass.name}`,
          masoolName: targetClass.masool ? `${targetClass.masool.user.firstName} ${targetClass.masool.user.lastName}` : null,
          masoolIts: targetClass.masool?.its || null,
        },
        date: queryDate,
        summary: {
          totalEnrolled,
          presentCount,
          lateCount,
          absentCount,
          onLeaveCount,
          biometricCount,
          manualCount,
          unmarkedCount,
          attendanceRate: totalEnrolled > 0 ? Math.round(((presentCount + lateCount) / totalEnrolled) * 100) : 0,
        },
        talabat: talabatScans,
      },
    });
  } catch (error) {
    console.error("Masool class scans error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch class talabat scan records" });
  }
});

export default router;
