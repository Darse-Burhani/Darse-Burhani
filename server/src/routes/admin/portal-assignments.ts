import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth } from "../../middleware";
import { cache } from "../../lib/cache";

const router = Router();

// Standard available teacher pages and modules in Darse Burhani
// CANONICAL CATALOG: every id here matches a route and nav entry for assigning to faculty
export const TEACHER_AVAILABLE_PAGES = [
  { id: "dashboard", label: "Dashboard", category: "General", description: "Teacher main HUD & point analytics", path: "/teacher", icon: "LayoutDashboard" },
  { id: "classes", label: "Classes", category: "Academics", description: "Class student rosters & timetable", path: "/teacher/classes", icon: "BookOpen" },
  { id: "talabat-profiles", label: "Yearly Profile (1447 H)", category: "Community", description: "Talabat yearly profile, remarks & 1447 H records", path: "/teacher/talabat-profiles", icon: "GraduationCap" },
  { id: "timetable", label: "Timetable Matrix", category: "Academics", description: "Master timetable & schedule", path: "/teacher/timetable", icon: "CalendarDays" },
  { id: "quran", label: "Quran (Hifz)", category: "Hifz", description: "Ajza progress, marhala & weekly slips", path: "/teacher/hifz", icon: "Sparkles" },
  { id: "hifz-marhala", label: "Hifz Marhala", category: "Hifz", description: "Marhala progress & exams", path: "/teacher/hifz-marhala", icon: "GraduationCap" },
  { id: "takhteet", label: "Takhteet", category: "Academics", description: "Curriculum pacing & syllabus tracking", path: "/teacher/takhteet", icon: "Layers" },
  { id: "manual-attendance", label: "Manual Attendance", category: "Attendance", description: "Take manual attendance for classes, windows & registry", path: "/teacher/attendance", icon: "ClipboardCheck" },
  { id: "attendance-logs", label: "Hikvision Scans & Logs", category: "Attendance", description: "Live Hikvision scans, manual logs, exports & audit timeline", path: "/teacher/attendance-hik", icon: "Fingerprint" },
  { id: "attendance-schedule", label: "Attendance Schedule", category: "Attendance", description: "Scan windows, shifts & period timers", path: "/teacher/attendance-schedule", icon: "Clock" },
  { id: "email-reports", label: "Email Attendance Reports", category: "Attendance", description: "Automated attendance summaries & email delivery", path: "/teacher/attendance-emails", icon: "Mail" },
  { id: "google-sheets", label: "Google Sheets Sync", category: "Attendance", description: "Cloud spreadsheet sync, daily/monthly exports & configuration", path: "/teacher/google-sheets", icon: "FileSpreadsheet" },
  { id: "biometric", label: "Biometric Scanners", category: "Attendance", description: "Device status & scanner management", path: "/teacher/biometric", icon: "Fingerprint" },
  { id: "medical-duty", label: "Medical & Health Duty", category: "Operations", description: "Mark Talabat & Faculty on Medical Leave / Exemption", path: "/teacher/medical-duty", icon: "Stethoscope" },
  { id: "leave", label: "Leave Management", category: "Operations", description: "Talabat & faculty leave approvals", path: "/teacher/leave", icon: "CalendarCheck" },
  { id: "tracking", label: "Individual Tracking", category: "Operations", description: "Student tracking & metrics", path: "/teacher/tracking", icon: "BarChart3" },
  { id: "procurement", label: "Procurement", category: "Operations", description: "Stationery & supply requisitions", path: "/teacher/procurement", icon: "ShoppingBag" },
  { id: "makhzan", label: "Makhzan", category: "Operations", description: "School inventory, assets & physical equipment", path: "/teacher/makhzn", icon: "Package" },
  { id: "library", label: "Library", category: "Library", description: "Digital catalog, 3D shelf & loans", path: "/teacher/library", icon: "Library" },
  { id: "library-overview", label: "Library Overview", category: "Library", description: "Library dashboard, circulation metrics & quick actions", path: "/teacher/library/overview", icon: "Library" },
  { id: "library-shelves", label: "Library Shelves", category: "Library", description: "Physical shelves, book locations & catalog management", path: "/teacher/library/shelves", icon: "Library" },
  { id: "library-checkout", label: "Library Checkout", category: "Library", description: "Issue books, scan borrowers & manage active loans", path: "/teacher/library/checkout", icon: "Library" },
  { id: "library-overdue", label: "Library Overdue", category: "Library", description: "Overdue loans, reminder emails & return tracking", path: "/teacher/library/overdue", icon: "Library" },
  { id: "library-auditor", label: "Library Auditor", category: "Library", description: "Inventory audit, missing books & shelf reconciliation", path: "/teacher/library/auditor", icon: "Library" },
  { id: "students", label: "Talabat (Students)", category: "Community", description: "Student directory & details", path: "/teacher/students", icon: "GraduationCap" },
  { id: "parents", label: "Parents Directory", category: "Community", description: "Parent contacts & directory", path: "/teacher/parents", icon: "Heart" },
  { id: "parents-assign", label: "Assign Talabat to Parent", category: "Community", description: "Link talabat profiles to parent guardian accounts", path: "/teacher/parents/assign", icon: "Link2" },
  { id: "users", label: "Staff & Users", category: "Community", description: "Staff directory & accounts", path: "/teacher/users", icon: "Users" },
  { id: "passwords", label: "User Passwords", category: "Community", description: "Password resets & credentials", path: "/teacher/passwords", icon: "KeyRound" },
  { id: "point-matrix", label: "Point Matrix", category: "Systems", description: "Star point rules & matrix", path: "/teacher/point-matrix", icon: "Award" },
  { id: "portal-assignments", label: "Portal Assignments", category: "Systems", description: "Assign portal pages to teachers (delegates authority)", path: "/teacher/portal-assignments", icon: "UserCheck" },
  { id: "notifications", label: "Notification Studio", category: "Systems", description: "School-wide broadcasts & notification center", path: "/teacher/notifications", icon: "Bell" },
  { id: "security", label: "Security & Logs", category: "Systems", description: "Audit logs, active sessions & security preferences", path: "/teacher/security", icon: "Shield" },
  { id: "settings", label: "Portal Settings", category: "Systems", description: "Global portal module locks & permissions", path: "/teacher/settings", icon: "Settings" },
  { id: "profile", label: "Profile & Settings", category: "General", description: "Khidmat details, credentials & security", path: "/teacher/profile", icon: "UserCheck" },
  { id: "student-assignments", label: "Assignments", category: "Academics", description: "Create assignments, grade talabat & view skill assessments", path: "/teacher/assignments", icon: "ClipboardList" },
  { id: "talabat-skills", label: "Talabat Skills Records", category: "Academics", description: "Every talabat's skill %, test scores, assignment marks & hobbies", path: "/teacher/skills", icon: "Sparkles" },
  { id: "hobbies", label: "Hobbies & Skills", category: "Community", description: "View & manage talabat hobbies and skills", path: "/teacher/hobbies", icon: "Palette" },
];

const PAGE_IDS = new Set(TEACHER_AVAILABLE_PAGES.map((p) => p.id));

// Normalizes any stored portalType or page name to one or more canonical page ids.
export function normalizeCanonicalPageId(raw: string): string[] {
  if (!raw) return [];
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/^page:/, "")
    .replace(/^\/?(admin|teacher)\//, "")
    .replace(/\/+$/, "");
  if (clean === "all" || clean === "*") return ["ALL"];
  if (clean === "attendance" || clean === "attendance_all") return ["manual-attendance", "attendance-logs", "attendance-schedule"];
  if (clean === "manual-attendance" || clean === "manual_attendance" || clean === "attendance-manual" || clean === "attendance_manual" || clean === "manual") return ["manual-attendance"];
  if (clean === "attendance-logs" || clean === "attendance_logs" || clean === "attendance-log" || clean === "attendance_log" || clean === "logs" || clean === "log" || clean === "attendance-registry" || clean === "attendance-hik" || clean === "hikvision" || clean === "hik") return ["attendance-logs"];
  if (clean === "attendance-schedule" || clean === "attendance_schedule" || clean === "schedule") return ["attendance-schedule"];
  if (clean === "email-reports" || clean === "email_reports" || clean === "attendance-emails" || clean === "attendance_emails" || clean === "emails" || clean === "attendance-email") return ["email-reports"];
  if (clean === "google-sheets" || clean === "google_sheets" || clean === "google-sheet" || clean === "sheets" || clean === "sheet-sync" || clean === "sheet_sync") return ["google-sheets"];
  if (clean === "biometric" || clean === "biometrics" || clean === "scanners") return ["biometric"];
  if (clean === "medical" || clean === "medical-duty" || clean === "medical_duty" || clean === "medical-desk" || clean === "medical_desk" || clean === "health") return ["medical-duty"];
  if (clean === "quran" || clean === "hifz" || clean === "hifz-reports" || clean === "weekly-slips") return ["quran"];
  if (clean === "hifz-marhala" || clean === "hifz_marhala" || clean === "marhala") return ["hifz-marhala"];
  if (clean === "makhzan" || clean === "makhzn" || clean === "warehouse" || clean === "inventory") return ["makhzan"];
  if (clean === "point-matrix" || clean === "point_matrix" || clean === "point-rules" || clean === "points") return ["point-matrix"];
  if (clean === "portal-assignments" || clean === "portal_assignments" || clean === "assignments") return ["portal-assignments"];
  if (clean === "passwords" || clean === "credentials") return ["passwords"];
  if (clean === "tracking" || clean === "analytics") return ["tracking"];
  if (clean === "classes" || clean === "class") return ["classes"];
  if (clean === "talabat-profiles" || clean === "talabat_profiles" || clean === "talabat-profile" || clean === "yearly-profile" || clean === "profile-1447" || clean === "profile1447") return ["talabat-profiles"];
  if (clean === "timetable") return ["timetable"];
  if (clean === "takhteet") return ["takhteet"];
  if (clean === "leave" || clean === "leaves") return ["leave"];
  if (clean === "procurement") return ["procurement"];
  if (clean === "library") return ["library"];
  if (clean === "library-overview" || clean === "library_overview" || clean === "library/overview") return ["library-overview"];
  if (clean === "library-shelves" || clean === "library_shelves" || clean === "library/shelves") return ["library-shelves"];
  if (clean === "library-checkout" || clean === "library_checkout" || clean === "library/checkout") return ["library-checkout"];
  if (clean === "library-overdue" || clean === "library_overdue" || clean === "library/overdue") return ["library-overdue"];
  if (clean === "library-auditor" || clean === "library_auditor" || clean === "library/auditor") return ["library-auditor"];
  if (clean.startsWith("library/")) {
    const sub = clean.split("/")[1];
    const candidate = `library-${sub}`;
    if (PAGE_IDS.has(candidate)) return [candidate];
  }
  if (clean === "students" || clean === "talabat") return ["students"];
  if (clean === "parents") return ["parents"];
  if (clean === "parents-assign" || clean === "parents_assign" || clean === "parents/assign" || clean === "parent-links") return ["parents-assign"];
  if (clean === "users" || clean === "staff") return ["users"];
  if (clean === "notifications" || clean === "broadcasts") return ["notifications"];
  if (clean === "security" || clean === "audit") return ["security"];
  if (clean === "settings") return ["settings"];
  if (clean === "dashboard") return ["dashboard"];
  if (clean === "profile") return ["profile"];
  if (PAGE_IDS.has(clean)) return [clean];
  return [];
}

// Normalizes any stored portalType (legacy or current) to a canonical page id.
export function toPageId(portalType: string): string | null {
  if (!portalType) return null;
  const mapped = normalizeCanonicalPageId(portalType);
  if (mapped.length > 0) return mapped[0];
  return null;
}

// Normalizes any incoming page id to the precise stored portalType.
export function toPortalType(pageId: string): string | null {
  if (!pageId) return null;
  const clean = pageId.trim();
  if (clean === "ALL" || clean === "*") return "ALL";
  const mapped = normalizeCanonicalPageId(clean);
  if (mapped.length > 0 && mapped[0] !== "ALL") {
    return `PAGE:${mapped[0]}`;
  }
  return null;
}

// Teachers delegated the portal-assignments page can manage assignments too.
async function hasPortalManageAuthority(userId: string, role: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "TEACHER") return false;
  const profile = await prisma.teacherProfile.findFirst({
    where: { OR: [{ userId }, { id: userId }] },
    include: { portalAssignments: true },
  });
  if (!profile) return false;
  return profile.portalAssignments.some(
    (a) => a.isActive && (a.portalType === "ALL" || a.portalType === "PAGE:portal-assignments" || a.portalType === "PORTAL-ASSIGNMENTS")
  );
}

export function toAssignedPageIds(portalTypes: string[]): string[] {
  const result = new Set<string>();
  for (const t of portalTypes) {
    const ids = normalizeCanonicalPageId(t);
    for (const id of ids) {
      if (id === "ALL") {
        return TEACHER_AVAILABLE_PAGES.map((p) => p.id);
      }
      if (PAGE_IDS.has(id)) {
        result.add(id);
      }
    }
  }
  result.add("dashboard");
  result.add("profile");
  return Array.from(result);
}

// When a teacher has no explicit portal assignments, only give them the safe minimum.
// All other pages must be explicitly assigned.
const DEFAULT_BASE_TEACHER_PAGES = ["dashboard", "profile"];

function describePortalPages(pageIds: string[]): string {
  const labels = pageIds
    .filter((id) => id !== "ALL")
    .map((id) => TEACHER_AVAILABLE_PAGES.find((page) => page.id === id)?.label || id);
  if (labels.length === 0) return "Dashboard and Profile";
  if (labels.length <= 5) return labels.join(", ");
  return `${labels.slice(0, 5).join(", ")} +${labels.length - 5} more`;
}

async function notifyPortalAccessChange(
  recipientUserIds: string[],
  options: {
    title: string;
    body: string;
    priority?: "NORMAL" | "HIGH";
  },
) {
  const recipients = Array.from(new Set(recipientUserIds.filter(Boolean)));
  if (recipients.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        title: options.title,
        body: options.body,
        type: "PORTAL_ACCESS",
        link: "/teacher",
        priority: options.priority || "NORMAL",
      })),
    });
  } catch (notificationError) {
    // Permission changes must still succeed if notification delivery fails.
    console.error("Portal access notification error:", notificationError);
  }
}

// GET /api/admin/portal-assignments - List all teachers and their assigned pages
router.get("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";
    const isSelfRequest = req.query.self === "true" || req.query.my === "true";

    let hasManageAuthority = isAdmin;
    let currentTeacherProfile: any = null;

    if (!isAdmin && session.user.role === "TEACHER") {
      hasManageAuthority = await hasPortalManageAuthority(session.user.id, session.user.role);
      if (hasManageAuthority) {
        currentTeacherProfile = await prisma.teacherProfile.findFirst({
          where: { OR: [{ userId: session.user.id }, { id: session.user.id }] },
          include: { portalAssignments: true },
        });
      }
    }

    // If explicit self-request OR teacher lacks manage authority, return their own page access profile
    if (isSelfRequest || (!isAdmin && !hasManageAuthority)) {
      if (!currentTeacherProfile) {
        currentTeacherProfile = await prisma.teacherProfile.findFirst({
          where: { OR: [{ userId: session.user.id }, { id: session.user.id }] },
          include: { portalAssignments: true },
        });
      }

      if (!currentTeacherProfile) {
        return res.json({
          success: true,
          data: {
            assignedPages: DEFAULT_BASE_TEACHER_PAGES,
            allPages: TEACHER_AVAILABLE_PAGES,
          },
        });
      }

      const activeAssignments = currentTeacherProfile.portalAssignments.filter((a: any) => a.isActive);
      const isAll = activeAssignments.some((a: any) => a.portalType === "ALL");

      let assignedPageIds: string[] = [];
      if (isAll) {
        assignedPageIds = TEACHER_AVAILABLE_PAGES.map((p) => p.id);
      } else if (activeAssignments.length > 0) {
        assignedPageIds = toAssignedPageIds(activeAssignments.map((a: any) => a.portalType));
      } else {
        assignedPageIds = [...DEFAULT_BASE_TEACHER_PAGES];
      }

      return res.json({
        success: true,
        data: {
          teacherId: currentTeacherProfile.id,
          assignedPages: Array.from(new Set(assignedPageIds)),
          allPages: TEACHER_AVAILABLE_PAGES,
        },
      });
    }

    if (!hasManageAuthority) {
      return res.status(403).json({ success: false, error: "Access denied: Portal Assignments management authority required" });
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

          return {
            id: t.userId,
            profileId: t.id,
            name: `${t.user.firstName} ${t.user.lastName}`,
            email: t.user.email,
            employeeId: t.employeeId,
            department: t.department || t.roleTitle || "Faculty",
            avatarUrl: t.user.avatarUrl || t.photoUrl,
            isActive: t.user.isActive,
            hasFullAccess: hasAll,
            assignedPages: hasAll
              ? TEACHER_AVAILABLE_PAGES.map((p) => p.id)
              : Array.from(new Set(raw.length > 0 ? toAssignedPageIds(raw.map((a) => a.portalType)) : [...DEFAULT_BASE_TEACHER_PAGES])),
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
// Allowed: ADMIN, or TEACHER delegated PAGE:portal-assignments (GET already allows them to view).
router.post("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    if (!(await hasPortalManageAuthority(session.user.id, session.user.role))) {
      return res.status(403).json({ success: false, error: "Access denied: Portal Assignments management authority required" });
    }
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

    const cleanPortalType = toPortalType(String(portalType)) ?? (String(portalType) === "ALL" ? "ALL" : null);
    if (!cleanPortalType) {
      return res.status(400).json({ success: false, error: `Unknown page: ${portalType}` });
    }

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

    const pageId = toPageId(cleanPortalType) || (cleanPortalType === "ALL" ? "ALL" : cleanPortalType);
    const pageLabel = pageId === "ALL"
      ? `all ${TEACHER_AVAILABLE_PAGES.length} modules`
      : describePortalPages([pageId]);

    await notifyPortalAccessChange([teacherProfile.userId], {
      title: cleanPortalType === "ALL" ? "Full Portal Authority Granted" : "Portal Access Granted",
      body: `Administrator granted you ${pageLabel}. Open your portal to review the new navigation.`,
      priority: cleanPortalType === "ALL" ? "HIGH" : "NORMAL",
    });

    cache.invalidateTag("permissions");
    cache.invalidateTag("portal-assignments");

    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error("Portal assignment create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create assignment" });
  }
});

// POST /api/admin/portal-assignments/batch - Batch update assigned pages for one or multiple teachers
// Atomically replaces each teacher's assignments (transaction per teacher).
// grantAll stores a single "ALL" row instead of ALL + N PAGE rows.
router.post("/batch", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    if (!(await hasPortalManageAuthority(session.user.id, session.user.role))) {
      return res.status(403).json({ success: false, error: "Access denied: Portal Assignments management authority required" });
    }
    const body = req.body as {
      teacherIds: string[]; // User IDs or TeacherProfile IDs
      pages: string[]; // Canonical page ids, e.g. ['dashboard', 'classes', 'quran']
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

    const fullGrant = grantAll || (pages || []).length >= TEACHER_AVAILABLE_PAGES.length;
    const pageKeys = fullGrant
      ? ["ALL"]
      : Array.from(
          new Set(
            (pages || [])
              .map((p) => toPortalType(p))
              .filter((v): v is string => !!v)
          )
        );

    if (!fullGrant && pageKeys.length === 0) {
      return res.status(400).json({ success: false, error: "No valid pages provided" });
    }

    for (const profile of profiles) {
      await prisma.$transaction(async (tx) => {
        await tx.teacherPortalAssignment.deleteMany({ where: { teacherId: profile.id } });
        if (pageKeys.length > 0) {
          await tx.teacherPortalAssignment.createMany({
            data: pageKeys.map((pk) => ({
              teacherId: profile.id,
              portalType: pk,
              assignedById: session.user.id,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }
      });
    }

    const grantedPageIds = fullGrant
      ? ["ALL"]
      : (pages || [])
          .map((page) => toPageId(page))
          .filter((value): value is string => !!value && PAGE_IDS.has(value));
    const notificationTitle = fullGrant ? "Full Portal Authority Granted" : "Portal Access Updated";
    const notificationBody = fullGrant
      ? `Administrator granted you all ${TEACHER_AVAILABLE_PAGES.length} portal modules. Open your portal to review the complete navigation.`
      : `Administrator updated your portal access (${grantedPageIds.length} modules): ${describePortalPages(grantedPageIds)}.`;

    await notifyPortalAccessChange(
      profiles.map((profile) => profile.userId),
      {
        title: notificationTitle,
        body: notificationBody,
        priority: fullGrant ? "HIGH" : "NORMAL",
      },
    );

    cache.invalidateTag("permissions");
    cache.invalidateTag("portal-assignments");

    return res.json({
      success: true,
      message: `Updated page permissions for ${profiles.length} teacher(s)`,
      data: { updatedCount: profiles.length, modulesGranted: fullGrant ? TEACHER_AVAILABLE_PAGES.length : grantedPageIds.length },
    });
  } catch (error) {
    console.error("Batch portal assignments error:", error);
    return res.status(500).json({ success: false, error: "Failed to update page assignments" });
  }
});

// DELETE /api/admin/portal-assignments - Revoke assignment by ID or teacher + page
router.delete("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    if (!(await hasPortalManageAuthority(session.user.id, session.user.role))) {
      return res.status(403).json({ success: false, error: "Access denied: Portal Assignments management authority required" });
    }
    const id = req.query.id as string;
    const teacherId = req.query.teacherId as string;
    const page = req.query.page as string;
    const revokeAll = req.query.all === "true" || page === "ALL" || page === "*";

    if (id) {
      const assignment = await prisma.teacherPortalAssignment.findUnique({
        where: { id },
        include: { teacher: { select: { userId: true } } },
      });
      if (assignment) {
        await prisma.teacherPortalAssignment.delete({ where: { id } });
        const pageId = toPageId(assignment.portalType);
        await notifyPortalAccessChange([assignment.teacher.userId], {
          title: pageId === "ALL" ? "Full Portal Authority Revoked" : "Portal Access Revoked",
          body: pageId === "ALL"
            ? "Administrator revoked full portal authority. Dashboard and Profile access remain available."
            : `Administrator revoked access to ${describePortalPages(pageId ? [pageId] : [])}.`,
          priority: pageId === "ALL" ? "HIGH" : "NORMAL",
        });
      }
      cache.invalidateTag("permissions");
      cache.invalidateTag("portal-assignments");
      return res.json({ success: true });
    }

    if (teacherId && (revokeAll || page)) {
      const profile = await prisma.teacherProfile.findFirst({
        where: { OR: [{ userId: teacherId }, { id: teacherId }] },
        select: { id: true, userId: true },
      });
      if (profile) {
        if (revokeAll) {
          const result = await prisma.teacherPortalAssignment.deleteMany({
            where: { teacherId: profile.id },
          });
          await notifyPortalAccessChange([profile.userId], {
            title: "Full Portal Authority Revoked",
            body: "Administrator revoked all delegated portal access. Dashboard and Profile remain available.",
            priority: "HIGH",
          });
          cache.invalidateTag("permissions");
          cache.invalidateTag("portal-assignments");
          return res.json({ success: true, data: { revokedCount: result.count } });
        }

        const portalType = toPortalType(page);
        // Also match legacy rows (HIFZ, unprefixed lowercase) for the same page.
        const pageId = toPageId(page) ?? page.toLowerCase();
        const candidates = Array.from(
          new Set(
            [portalType, `PAGE:${pageId}`, pageId.toUpperCase(), pageId].filter(Boolean) as string[]
          )
        );
        const result = await prisma.teacherPortalAssignment.deleteMany({
          where: { teacherId: profile.id, portalType: { in: candidates } },
        });
        await notifyPortalAccessChange([profile.userId], {
          title: "Portal Access Revoked",
          body: `Administrator revoked access to ${describePortalPages([pageId])}.`,
        });
        cache.invalidateTag("permissions");
        cache.invalidateTag("portal-assignments");
        return res.json({ success: true, data: { revokedCount: result.count } });
      }
      return res.json({ success: true, data: { revokedCount: 0 } });
    }

    return res.status(400).json({ success: false, error: "Assignment ID or teacherId + page required" });
  } catch (error) {
    console.error("Portal assignment delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete assignment" });
  }
});

export default router;
