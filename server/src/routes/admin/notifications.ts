import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

// Require ADMIN role for all routes in this file
router.use(requireAuth, requireRole("ADMIN"));

/**
 * GET /api/admin/notifications
 * Fetch recent broadcasts, stats, and notification overview.
 */
router.get("/", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    const totalCount = await prisma.notification.count();
    const unreadCount = await prisma.notification.count({ where: { isRead: false } });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sentToday = await prisma.notification.count({
      where: { createdAt: { gte: todayStart } },
    });

    // Group recent identical broadcasts by title + createdAt (within 5 seconds)
    const groupedBroadcasts: Array<{
      id: string;
      title: string;
      body: string;
      type: string;
      link?: string | null;
      recipientCount: number;
      readCount: number;
      createdAt: Date;
    }> = [];

    const processedMap = new Map<string, typeof groupedBroadcasts[0]>();

    for (const n of notifications) {
      const timeKey = Math.floor(new Date(n.createdAt).getTime() / 5000);
      const key = `${n.title}_${n.body}_${timeKey}`;

      if (!processedMap.has(key)) {
        const item = {
          id: n.id,
          title: n.title,
          body: n.body,
          type: n.type,
          link: n.link,
          recipientCount: 1,
          readCount: n.isRead ? 1 : 0,
          createdAt: n.createdAt,
        };
        processedMap.set(key, item);
        groupedBroadcasts.push(item);
      } else {
        const item = processedMap.get(key)!;
        item.recipientCount += 1;
        if (n.isRead) item.readCount += 1;
      }
    }

    return res.json({
      success: true,
      data: {
        broadcasts: groupedBroadcasts.slice(0, 50),
        stats: {
          totalCount,
          unreadCount,
          sentToday,
          totalBroadcasts: groupedBroadcasts.length,
        },
      },
    });
  } catch (error) {
    console.error("Admin fetch notifications error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch notification history" });
  }
});

/**
 * GET /api/admin/notifications/audiences
 * Fetch target segments, class lists, and recipient counts.
 */
router.get("/audiences", async (req, res) => {
  try {
    const [totalUsers, studentCount, teacherCount, parentCount, classes, students, teachers] =
      await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { role: "STUDENT", isActive: true } }),
        prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
        prisma.user.count({ where: { role: "PARENT", isActive: true } }),
        prisma.class.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            grade: true,
            section: true,
            subject: true,
            enrollments: { select: { student: { select: { userId: true } } } },
          },
        }),
        prisma.user.findMany({
          where: { role: "STUDENT", isActive: true },
          select: { id: true, firstName: true, lastName: true, email: true },
          take: 150,
          orderBy: { firstName: "asc" },
        }),
        prisma.user.findMany({
          where: { role: "TEACHER", isActive: true },
          select: { id: true, firstName: true, lastName: true, email: true },
          take: 100,
          orderBy: { firstName: "asc" },
        }),
      ]);

    const formattedClasses = classes.map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      section: c.section,
      subject: c.subject,
      studentCount: c.enrollments.length,
      studentUserIds: c.enrollments.map((e) => e.student.userId),
    }));

    return res.json({
      success: true,
      data: {
        counts: {
          all: totalUsers,
          students: studentCount,
          teachers: teacherCount,
          parents: parentCount,
        },
        classes: formattedClasses,
        sampleStudents: students,
        sampleTeachers: teachers,
      },
    });
  } catch (error) {
    console.error("Admin audiences fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch audience targets" });
  }
});

/**
 * POST /api/admin/notifications/broadcast
 * Send custom notification to designated target audience.
 */
router.post("/broadcast", async (req, res) => {
  try {
    const { title, body, type, link, targetType, targetClassId, targetUserIds } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: "Title and message body are required." });
    }

    let recipientUserIds: string[] = [];

    switch (targetType) {
      case "ALL": {
        const users = await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        recipientUserIds = users.map((u) => u.id);
        break;
      }
      case "STUDENTS": {
        const students = await prisma.user.findMany({
          where: { role: "STUDENT", isActive: true },
          select: { id: true },
        });
        recipientUserIds = students.map((u) => u.id);
        break;
      }
      case "TEACHERS": {
        const teachers = await prisma.user.findMany({
          where: { role: "TEACHER", isActive: true },
          select: { id: true },
        });
        recipientUserIds = teachers.map((u) => u.id);
        break;
      }
      case "PARENTS": {
        const parents = await prisma.user.findMany({
          where: { role: "PARENT", isActive: true },
          select: { id: true },
        });
        recipientUserIds = parents.map((u) => u.id);
        break;
      }
      case "CLASS": {
        if (!targetClassId) {
          return res.status(400).json({ success: false, error: "targetClassId is required for class broadcast." });
        }
        const enrollments = await prisma.classEnrollment.findMany({
          where: { classId: targetClassId },
          select: { student: { select: { userId: true } } },
        });
        recipientUserIds = enrollments.map((e) => e.student.userId);
        break;
      }
      case "SPECIFIC_USERS": {
        if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
          return res.status(400).json({ success: false, error: "targetUserIds array is required." });
        }
        recipientUserIds = targetUserIds;
        break;
      }
      default:
        return res.status(400).json({ success: false, error: "Invalid targetType specified." });
    }

    if (recipientUserIds.length === 0) {
      return res.status(400).json({ success: false, error: "No active recipients matched the selected target." });
    }

    // Deduplicate user IDs
    const uniqueUserIds = Array.from(new Set(recipientUserIds));

    // Batch insert notifications
    await prisma.notification.createMany({
      data: uniqueUserIds.map((uid) => ({
        userId: uid,
        title: title.trim(),
        body: body.trim(),
        type: type || "ANNOUNCEMENT",
        link: link ? link.trim() : null,
      })),
    });

    return res.json({
      success: true,
      data: {
        sentCount: uniqueUserIds.length,
        title,
        type: type || "ANNOUNCEMENT",
      },
    });
  } catch (error) {
    console.error("Admin broadcast notification error:", error);
    return res.status(500).json({ success: false, error: "Failed to broadcast notification" });
  }
});

/**
 * DELETE /api/admin/notifications/:id
 * Delete a specific notification record.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({
      where: { id },
    });
    return res.json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Admin delete notification error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete notification" });
  }
});

export default router;
