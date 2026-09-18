
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

// Standard available teacher pages and modules in Darse Burhani
export const TEACHER_AVAILABLE_PAGES = [
  { id: "dashboard", label: "Dashboard", category: "General", description: "Teacher main HUD & point analytics", path: "/teacher", icon: "LayoutDashboard" },
  { id: "classes", label: "Classes", category: "Academics", description: "Class student rosters & timetable", path: "/teacher/classes", icon: "BookOpen" },
  { id: "attendance-logs", label: "Attendance Logs", category: "Attendance", description: "Live scans, daily registry & student status", path: "/admin/attendance-logs", icon: "FileText" },
  { id: "leave", label: "Leave Management", category: "Operations", description: "Talabat & faculty leave approvals", path: "/admin/leave", icon: "CalendarCheck" },
  { id: "attendance-schedule", label: "Attendance Schedule", category: "Attendance", description: "Scan windows, shifts & period timers", path: "/admin/attendance-schedule", icon: "Clock" },
  { id: "email-reports", label: "Email Reports", category: "Communications", description: "Automated daily email dispatches", path: "/admin/attendance-emails", icon: "Mail" },
  { id: "procurement", label: "Procurement", category: "Operations", description: "Stationery & supply requisitions", path: "/admin/procurement", icon: "ShoppingBag" },
  { id: "quran", label: "Quran (Hifz)", category: "Hifz", description: "Ajza progress, marhala & weekly slips", path: "/teacher/hifz-reports", icon: "Sparkles" },
  { id: "takhteet", label: "Takhteet", category: "Academics", description: "Curriculum pacing & syllabus tracking", path: "/teacher/takhteet", icon: "Layers" },
  { id: "makhzan", label: "Makhzan", category: "Operations", description: "School asset & resource inventory", path: "/admin/library", icon: "Package" },
  { id: "library", label: "Library", category: "Library", description: "Digital catalog, 3D shelf & loans", path: "/admin/library", icon: "Library" },
  { id: "profile", label: "Profile & Settings", category: "General", description: "Khidmat details, credentials & security", path: "/teacher/profile", icon: "UserCheck" },
];

// GET /api/admin/portal-assignments - List all teachers and their assigned pages
router.get("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";

    // If teacher calling for their own assignments
    if (!isAdmin && session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        include: { portalAssignments: true },
      });

      if (!teacherProfile) {
        return res.json({ success: true, data: { pages: TEACHER_AVAILABLE_PAGES.map(p => p.id) } });
      }

      const activeAssignments = teacherProfile.portalAssignments.filter((a) => a.isActive);
      const isAll = activeAssignments.some((a) => a.portalType === "ALL");
      
      let assignedPageIds: string[] = [];
      if (activeAssignments.length === 0 || isAll) {
        // If no custom restrictions or ALL assigned, default to full standard access
        assignedPageIds = TEACHER_AVAILABLE_PAGES.map((p) => p.id);
      } else {
        assignedPageIds = activeAssignments.map((a) => {
          if (a.portalType.startsWith("PAGE:")) return a.portalType.replace("PAGE:", "");
          if (a.portalType === "HIFZ") return "quran";
          return a.portalType.toLowerCase();
        });
        // Always ensure Dashboard and Profile are accessible unless explicitly revoked
        if (!assignedPageIds.includes("dashboard")) assignedPageIds.push("dashboard");
        if (!assignedPageIds.includes("profile")) assignedPageIds.push("profile");
      }

      return res.json({
        success: true,
        data: {
          teacherId: teacherProfile.id,
          assignedPages: Array.from(new Set(assignedPageIds)),
          allPages: TEACHER_AVAILABLE_PAGES,
        },
      });
    }

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const assignments = await prisma.teacherPortalAssignment.findMany({
      where: {
        teacher: { user: { isActive: true, deletedAt: null } },
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const teachers = await prisma.teacherProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, isActive: true } },
        portalAssignments: true,
      },
      orderBy: { user: { firstName: "asc" } },
    });

    return res.json({
      success: true,
      data: {
        availablePages: TEACHER_AVAILABLE_PAGES,
        assignments: assignments.map((a) => ({
          id: a.id,
          teacherId: a.teacherId,
          teacherUserId: a.teacher.user.id,
          teacherName: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`,
          teacherEmail: a.teacher.user.email,
          portalType: a.portalType,
          assignedById: a.assignedById,
          isActive: a.isActive,
          createdAt: a.createdAt,
        })),
        teachers: teachers.map((t) => {
          const raw = t.portalAssignments.filter((a) => a.isActive);
          const hasAll = raw.some((a) => a.portalType === "ALL");
          const pageKeys = hasAll
            ? TEACHER_AVAILABLE_PAGES.map((p) => p.id)
            : raw.map((a) => {
                if (a.portalType.startsWith("PAGE:")) return a.portalType.replace("PAGE:", "");
                if (a.portalType === "HIFZ") return "hifz";
                return a.portalType.toLowerCase();
              });

          return {
            id: t.userId,
            profileId: t.id,
            name: `${t.user.firstName} ${t.user.lastName}`,
            email: t.user.email,
            employeeId: t.employeeId,
            department: t.department || t.roleTitle || "Faculty",
            avatarUrl: t.user.avatarUrl || t.photoUrl,
            isActive: t.user.isActive,
            assignedPages: Array.from(new Set(pageKeys.length > 0 ? pageKeys : ["dashboard", "classes", "attendance-logs", "takhteet", "quran", "profile"])),
            assignments: t.portalAssignments.map((a) => ({
              id: a.id,
              portalType: a.portalType,
              isActive: a.isActive,
            })),
          };
        }),
      },
    });
  } catch (error) {
    console.error("Portal assignments fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch assignments" });
  }
});

// POST /api/admin/portal-assignments - Assign single page or portal type to teacher
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { teacherId, portalType } = body;

    if (!teacherId || !portalType) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const teacherProfile = await prisma.teacherProfile.findFirst({
      where: { OR: [{ userId: teacherId }, { id: teacherId }] },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const cleanPortalType = portalType.startsWith("PAGE:") || ["HIFZ", "ALL"].includes(portalType)
      ? portalType
      : `PAGE:${portalType}`;

    const assignment = await prisma.teacherPortalAssignment.upsert({
      where: {
        teacherId_portalType: {
          teacherId: teacherProfile.id,
          portalType: cleanPortalType,
        },
      },
      update: {
        isActive: true,
        assignedById: session.user.id,
      },
      create: {
        teacherId: teacherProfile.id,
        portalType: cleanPortalType,
        assignedById: session.user.id,
        isActive: true,
      },
    });

    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error("Portal assignment create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create assignment" });
  }
});

// POST /api/admin/portal-assignments/batch - Batch update assigned pages for one or multiple teachers
router.post("/batch", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as {
      teacherIds: string[]; // User IDs or TeacherProfile IDs
      pages: string[]; // Array of page IDs like ['dashboard', 'classes', 'attendance', 'hifz']
      grantAll?: boolean;
    };

    const { teacherIds, pages, grantAll } = body;

    if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
      return res.status(400).json({ success: false, error: "teacherIds array is required" });
    }

    const profiles = await prisma.teacherProfile.findMany({
      where: { OR: [{ userId: { in: teacherIds } }, { id: { in: teacherIds } }] },
    });

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, error: "No matching teacher profiles found" });
    }

    const pageKeys = grantAll
      ? ["ALL", ...TEACHER_AVAILABLE_PAGES.map((p) => `PAGE:${p.id}`)]
      : (pages || []).map((p) => (p.startsWith("PAGE:") ? p : `PAGE:${p}`));

    for (const profile of profiles) {
      // 1. Remove previous custom page assignments
      await prisma.teacherPortalAssignment.deleteMany({
        where: { teacherId: profile.id },
      });

      // 2. Insert new page assignments
      if (pageKeys.length > 0) {
        await prisma.teacherPortalAssignment.createMany({
          data: pageKeys.map((pk) => ({
            teacherId: profile.id,
            portalType: pk,
            assignedById: session.user.id,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }
    }

    return res.json({
      success: true,
      message: `Updated page permissions for ${profiles.length} teacher(s)`,
      data: { updatedCount: profiles.length },
    });
  } catch (error) {
    console.error("Batch portal assignments error:", error);
    return res.status(500).json({ success: false, error: "Failed to update page assignments" });
  }
});

// DELETE /api/admin/portal-assignments - Revoke assignment by ID or teacher + page
router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = req.query.id as string;
    const teacherId = req.query.teacherId as string;
    const page = req.query.page as string;

    if (id) {
      await prisma.teacherPortalAssignment.delete({ where: { id } });
      return res.json({ success: true });
    }

    if (teacherId && page) {
      const profile = await prisma.teacherProfile.findFirst({
        where: { OR: [{ userId: teacherId }, { id: teacherId }] },
      });
      if (profile) {
        const portalType = page.startsWith("PAGE:") ? page : `PAGE:${page}`;
        await prisma.teacherPortalAssignment.deleteMany({
          where: { teacherId: profile.id, portalType },
        });
      }
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: "Assignment ID or teacherId + page required" });
  } catch (error) {
    console.error("Portal assignment delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete assignment" });
  }
});

export default router;
