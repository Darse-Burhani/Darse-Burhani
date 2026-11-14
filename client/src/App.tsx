import { lazy, Suspense, useEffect } from "react";

/**
 * Robust lazy import that auto-reloads once if a production deployment
 * has replaced old hashed asset chunks, avoiding stale 404 / MIME type exceptions.
 */
function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = err?.message || String(err || "");
      const isChunk =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("error loading dynamically imported module") ||
        msg.includes("Failed to load module script") ||
        msg.includes("Expected a JavaScript-or-Wasm module script") ||
        msg.includes("MIME type of \"text/html\"") ||
        msg.includes("Strict MIME type checking") ||
        msg.includes("text/html");

      const hasRetried = typeof window !== "undefined" ? sessionStorage.getItem("chunk_retry_in_progress") : null;
      if (isChunk && !hasRetried && typeof window !== "undefined") {
        sessionStorage.setItem("chunk_retry_in_progress", "true");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "next-auth/react";
import PageSkeleton from "@/components/PageSkeleton";
import { ModuleLockGuard, usePortalAccess } from "@/context/PortalAccessContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DevLockGuard } from "@/components/DevLockGuard";

// ── Public Pages ──
const LoginPage = safeLazy(() => import("@/app/login/page"));
const PrivacyPage = safeLazy(() => import("@/app/privacy/page"));
const TermsPage = safeLazy(() => import("@/app/terms/page"));
const LibraryTvPage = safeLazy(() => import("@/app/library-tv/page"));
const NotificationsLayout = safeLazy(() => import("@/app/notifications/layout"));
const NotificationsPage = safeLazy(() => import("@/app/notifications/page"));
const NotFoundPage = safeLazy(() => import("@/app/not-found/page"));
const ThankYouPage = safeLazy(() => import("@/app/thank-you/page"));

import { CookieConsentBanner } from "@/components/CookieConsentBanner";
const CommandPalette = safeLazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { useAutoRouteSEO } from "@/components/SEO";
import { SplashScreen } from "@/components/SplashScreen";
import { WaitingInterface } from "@/components/WaitingInterface";

// ── Admin Portal Pages ──
const AdminLayout = safeLazy(() => import("@/app/admin/layout"));
const AdminDashboard = safeLazy(() => import("@/app/admin/page"));
const AdminClasses = safeLazy(() => import("@/app/admin/classes/page"));
const AdminTimetable = safeLazy(() => import("@/app/admin/timetable/page"));
const AdminPointMatrix = safeLazy(() => import("@/app/admin/point-matrix/page"));
const AdminUsers = safeLazy(() => import("@/app/admin/users/page"));
const AdminPasswords = safeLazy(() => import("@/app/admin/passwords/page"));
const AdminStudents = safeLazy(() => import("@/app/admin/students/page"));
const AdminParents = safeLazy(() => import("@/app/admin/parents/page"));
const AdminParentsAssign = safeLazy(() => import("@/app/admin/parents/assign/page"));
const AdminLibrary = safeLazy(() => import("@/app/admin/library/page"));
const AdminLibraryOverview = safeLazy(() => import("@/app/admin/library/overview/page"));
const AdminLibraryShelves = safeLazy(() => import("@/app/admin/library/shelves/page"));
const AdminLibraryCheckout = safeLazy(() => import("@/app/admin/library/checkout/page"));
const AdminLibraryAttendance = safeLazy(() => import("@/app/admin/library/attendance/page"));
const AdminLibraryOverdue = safeLazy(() => import("@/app/admin/library/overdue/page"));
const AdminLibraryAuditor = safeLazy(() => import("@/app/admin/library/auditor/page"));
const AdminWarasMubarak = safeLazy(() => import("@/app/admin/waras-mubarak/page"));
const AdminMakhzan = safeLazy(() => import("@/app/admin/makhzn/page"));
const AdminPortalAssignments = safeLazy(() => import("@/app/admin/portal-assignments/page"));
const AdminTakhteet = safeLazy(() => import("@/app/admin/takhteet/page"));
const AdminBiometric = safeLazy(() => import("@/app/admin/biometric/page"));
const AdminAttendanceSchedule = safeLazy(() => import("@/app/admin/attendance-schedule/page"));
const AdminAttendanceEmails = safeLazy(() => import("@/app/admin/attendance-emails/page"));
const AdminTracking = safeLazy(() => import("@/app/admin/tracking/page"));
const AdminNotifications = safeLazy(() => import("@/app/admin/notifications/page"));
const AdminSecurity = safeLazy(() => import("@/app/admin/security/page"));
const AdminProcurement = safeLazy(() => import("@/app/admin/procurement/page"));
const AdminLeave = safeLazy(() => import("@/app/admin/leave/page"));
const AdminAttendanceLogs = safeLazy(() => import("@/app/admin/attendance-logs/page"));
const AdminAttendanceHik = safeLazy(() => import("@/app/admin/attendance-hik/page"));
const AdminHikConnect = safeLazy(() => import("@/app/admin/hik-connect/page"));
const AdminManualAttendance = safeLazy(() => import("@/app/admin/manual-attendance/page"));
const AdminGoogleSheets = safeLazy(() => import("@/app/admin/google-sheets/page"));
const AdminWhatsApp = safeLazy(() => import("@/app/admin/whatsapp/page"));
const AdminMailflare = safeLazy(() => import("@/app/admin/mailflare/page"));
const AdminGrievances = safeLazy(() => import("@/app/admin/grievances/page"));
const AdminSettings = safeLazy(() => import("@/app/admin/settings/page"));
const AdminTilawatDua = safeLazy(() => import("@/app/admin/tilawat-dua/page"));
const TalabatTilawatDua = safeLazy(() => import("@/app/talabat/tilawat-dua/page"));
const TeacherTilawatDua = safeLazy(() => import("@/app/teacher/tilawat-dua/page"));
const FacultyTilawatDua = safeLazy(() => import("@/app/faculty/tilawat-dua/page"));
const DirectProjectorPage = safeLazy(() => import("@/app/tilawat-dua/projector/page"));
const FatimiDemoPage = safeLazy(() => import("@/app/fatimi-demo/page"));

// ── Talabat (Student) Portal Pages ──
const TalabatLayout = safeLazy(() => import("@/app/talabat/layout"));
const TalabatDashboard = safeLazy(() => import("@/app/talabat/page"));
const TalabatAttendance = safeLazy(() => import("@/app/talabat/attendance/page"));
const TalabatLeaveRequest = safeLazy(() => import("@/app/talabat/leave-request/page"));
const TalabatScans = safeLazy(() => import("@/app/talabat/scans/page"));
const TalabatBadges = safeLazy(() => import("@/app/talabat/badges/page"));
const TalabatLibrary = safeLazy(() => import("@/app/talabat/library/page"));
const TalabatProfile = safeLazy(() => import("@/app/talabat/profile/page"));
const TalabatProfile1447 = safeLazy(() => import("@/app/talabat/profile-1447/page"));
const TalabatKnowingMyself = safeLazy(() => import("@/app/talabat/knowing-myself/page"));
const TalabatSettings = safeLazy(() => import("@/app/talabat/settings/page"));
const TalabatSkillTree = safeLazy(() => import("@/app/talabat/skill-tree/page"));
const TalabatAssignments = safeLazy(() => import("@/app/talabat/assignments/page"));
const TalabatHobbies = safeLazy(() => import("@/app/talabat/hobbies/page"));
const TalabatTimetable = safeLazy(() => import("@/app/talabat/timetable/page"));
const TalabatSupport = safeLazy(() => import("@/app/talabat/support/page"));
const AdminAssignments = safeLazy(() => import("@/app/admin/assignments/page"));
const AdminHobbies = safeLazy(() => import("@/app/admin/hobbies/page"));
const AdminSkills = safeLazy(() => import("@/app/admin/skills/page"));
const AdminTalabatProfiles = safeLazy(() => import("@/app/admin/talabat-profiles/page"));
const TeacherTalabatProfiles = safeLazy(() => import("@/app/teacher/talabat-profiles/page"));

// ── Teacher Portal Pages ──
const TeacherLayout = safeLazy(() => import("@/app/teacher/layout"));
const TeacherDashboard = safeLazy(() => import("@/app/teacher/page"));
const TeacherClasses = safeLazy(() => import("@/app/teacher/classes/page"));
const TeacherAttendance = safeLazy(() => import("@/app/teacher/attendance/page"));
const TeacherLeave = safeLazy(() => import("@/app/teacher/leave/page"));
const TeacherTakhteet = safeLazy(() => import("@/app/teacher/takhteet/page"));
const TeacherProfile = safeLazy(() => import("@/app/teacher/profile/page"));
const TeacherMedicalDuty = safeLazy(() => import("@/app/teacher/medical-duty/page"));
const TeacherTimetable = safeLazy(() => import("@/app/teacher/timetable/page"));
const TeacherProcurement = safeLazy(() => import("@/app/teacher/procurement/page"));
const TeacherSettings = safeLazy(() => import("@/app/teacher/settings/page"));
const TeacherMyAttendance = safeLazy(() => import("@/app/teacher/my-attendance/page"));
const TeacherAssignments = safeLazy(() => import("@/app/teacher/assignments/page"));

// ── Faculty Portal Pages ──
const FacultyLayout = safeLazy(() => import("@/app/faculty/layout"));
const FacultyAttendance = safeLazy(() => import("@/app/faculty/attendance/page"));

// ── Parent Portal Pages ──
const ParentLayout = safeLazy(() => import("@/app/parent/layout"));
const ParentDashboard = safeLazy(() => import("@/app/parent/page"));
const ParentActivity = safeLazy(() => import("@/app/parent/activity/page"));
const ParentSettings = safeLazy(() => import("@/app/parent/settings/page"));

function SuspenseFallback() {
  return <WaitingInterface variant="fullscreen" />;
}

function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <WaitingInterface variant="fullscreen" message="Verifying Institutional Credentials…" />;
  }

  if (!session) return <Navigate to="/login" replace />;
  // Admin has universal access across all portals
  if (session.user.role === "ADMIN") return <>{children}</>;
  // Assigned Teacher has full access and authority to run admin, teacher and preview portals
  if (session.user.role === "TEACHER" && (role === "ADMIN" || role === "TEACHER" || role === "STUDENT")) {
    return <>{children}</>;
  }
  if (session.user.role !== role) {
    const rolePaths: Record<string, string> = {
      ADMIN: "/admin",
      TEACHER: "/teacher",
      STUDENT: "/talabat",
      PARENT: "/parent",
    };
    return <Navigate to={rolePaths[session.user.role] || "/login"} replace />;
  }
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <WaitingInterface variant="fullscreen" message="Authenticating Academic Session…" />;
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SmartSupportRedirect() {
  const { data: session, status } = useSession();
  if (status === "loading") {
    return <WaitingInterface variant="fullscreen" message="Accessing Communications…" />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.user.role === "STUDENT") {
    return <Navigate to="/talabat/support" replace />;
  }
  return <Navigate to="/admin/mailflare" replace />;
}

function RequireAdminPageAccess({
  pageKey,
  children,
}: {
  pageKey: string;
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const { isPageAssigned, loading } = usePortalAccess();

  if (status === "loading" || loading) return <SuspenseFallback />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role === "ADMIN") return <>{children}</>;
  if (session.user.role === "TEACHER") {
    if (isPageAssigned(pageKey)) return <>{children}</>;
    return <Navigate to="/teacher" replace />;
  }
  return <Navigate to="/login" replace />;
}

function RootRedirect() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <WaitingInterface variant="fullscreen" message="Restoring Institutional Session…" />;
  }

  if (session?.user?.role) {
    const rolePaths: Record<string, string> = {
      ADMIN: "/admin",
      TEACHER: "/teacher",
      STUDENT: "/talabat",
      PARENT: "/parent",
    };
    return <Navigate to={rolePaths[session.user.role] || "/admin"} replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  useAutoRouteSEO();

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("chunk_retry_in_progress");
      sessionStorage.removeItem("chunk_retry_timestamp");
    }
  }, []);

  return (
    <ErrorBoundary>
      <DevLockGuard>
        <Suspense fallback={<SuspenseFallback />}>
          <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route path="/terms" element={<TermsPage />} />
        <Route path="/fatimi-demo" element={<FatimiDemoPage />} />
        <Route path="/fatimi-calendar" element={<Navigate to="/" replace />} />
        <Route path="/calendar" element={<Navigate to="/" replace />} />
        <Route path="/library" element={<Navigate to="/admin/library" replace />} />
        <Route path="/library/attendance" element={<Navigate to="/admin/library/attendance" replace />} />
        <Route path="/maktabat" element={<Navigate to="/admin/library/attendance" replace />} />
        <Route path="/hik-connect" element={<Navigate to="/admin/hik-connect" replace />} />
        <Route path="/waras-mubarak" element={<Navigate to="/admin/waras-mubarak" replace />} />
        <Route path="/waras" element={<Navigate to="/admin/waras-mubarak" replace />} />
        <Route path="/whatsapp" element={<Navigate to="/admin/whatsapp" replace />} />
        <Route path="/mailflare" element={<SmartSupportRedirect />} />
        <Route path="/support" element={<SmartSupportRedirect />} />
        <Route path="/webmail" element={<SmartSupportRedirect />} />
        <Route path="/email" element={<SmartSupportRedirect />} />
        <Route path="/inbox" element={<SmartSupportRedirect />} />
        <Route path="/it-support" element={<SmartSupportRedirect />} />
        <Route path="/library/tv" element={<LibraryTvPage />} />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsLayout />
            </RequireAuth>
          }
        >
          <Route index element={<NotificationsPage />} />
        </Route>

        {/* ── Admin Routes (Strictly guarded by Teacher Page Assignment) ── */}
        <Route
          path="/admin"
          element={
            <RequireRole role="ADMIN">
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<RequireAdminPageAccess pageKey="dashboard"><AdminDashboard /></RequireAdminPageAccess>} />
          <Route path="dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="classes" element={<RequireAdminPageAccess pageKey="classes"><AdminClasses /></RequireAdminPageAccess>} />
          <Route path="timetable" element={<RequireAdminPageAccess pageKey="timetable"><AdminTimetable /></RequireAdminPageAccess>} />
          <Route path="point-matrix" element={<RequireAdminPageAccess pageKey="point-matrix"><AdminPointMatrix /></RequireAdminPageAccess>} />
          <Route path="users" element={<RequireAdminPageAccess pageKey="users"><AdminUsers /></RequireAdminPageAccess>} />
          <Route path="passwords" element={<RequireAdminPageAccess pageKey="passwords"><AdminPasswords /></RequireAdminPageAccess>} />
          <Route path="credentials" element={<Navigate to="/admin/passwords" replace />} />
          <Route path="students" element={<RequireAdminPageAccess pageKey="students"><AdminStudents /></RequireAdminPageAccess>} />
          <Route path="parents" element={<RequireAdminPageAccess pageKey="parents"><AdminParents /></RequireAdminPageAccess>} />
          <Route path="parents/assign" element={<RequireAdminPageAccess pageKey="parents-assign"><AdminParentsAssign /></RequireAdminPageAccess>} />
          <Route path="makhzn" element={<RequireAdminPageAccess pageKey="makhzan"><AdminMakhzan /></RequireAdminPageAccess>} />
          <Route path="makhzan" element={<Navigate to="/admin/makhzn" replace />} />
          <Route path="library/makhzn" element={<Navigate to="/admin/makhzn" replace />} />
          <Route path="library/makhzan" element={<Navigate to="/admin/makhzn" replace />} />
          <Route path="library" element={<RequireAdminPageAccess pageKey="library"><AdminLibrary /></RequireAdminPageAccess>} />
          <Route path="library/overview" element={<RequireAdminPageAccess pageKey="library-overview"><AdminLibraryOverview /></RequireAdminPageAccess>} />
          <Route path="library/shelves" element={<RequireAdminPageAccess pageKey="library-shelves"><AdminLibraryShelves /></RequireAdminPageAccess>} />
          <Route path="library/checkout" element={<RequireAdminPageAccess pageKey="library-checkout"><AdminLibraryCheckout /></RequireAdminPageAccess>} />
          <Route path="library/attendance" element={<RequireAdminPageAccess pageKey="library"><AdminLibraryAttendance /></RequireAdminPageAccess>} />
          <Route path="library/overdue" element={<RequireAdminPageAccess pageKey="library-overdue"><AdminLibraryOverdue /></RequireAdminPageAccess>} />
          <Route path="library/auditor" element={<RequireAdminPageAccess pageKey="library-auditor"><AdminLibraryAuditor /></RequireAdminPageAccess>} />
          <Route path="waras-mubarak" element={<RequireAdminPageAccess pageKey="students"><AdminWarasMubarak /></RequireAdminPageAccess>} />
          <Route path="waras" element={<Navigate to="/admin/waras-mubarak" replace />} />
          <Route path="portal-assignments" element={<RequireAdminPageAccess pageKey="portal-assignments"><AdminPortalAssignments /></RequireAdminPageAccess>} />
          <Route path="takhteet" element={<RequireAdminPageAccess pageKey="takhteet"><AdminTakhteet /></RequireAdminPageAccess>} />
          <Route path="biometric" element={<RequireAdminPageAccess pageKey="biometric"><AdminBiometric /></RequireAdminPageAccess>} />
          <Route path="hik-connect" element={<RequireAdminPageAccess pageKey="attendance-logs"><AdminHikConnect /></RequireAdminPageAccess>} />
          <Route path="attendance-hik" element={<RequireAdminPageAccess pageKey="attendance-logs"><AdminAttendanceHik /></RequireAdminPageAccess>} />
          <Route path="attendance-manual" element={<RequireAdminPageAccess pageKey="manual-attendance"><AdminManualAttendance /></RequireAdminPageAccess>} />
          <Route path="manual-attendance" element={<RequireAdminPageAccess pageKey="manual-attendance"><AdminManualAttendance /></RequireAdminPageAccess>} />
          <Route path="attendance" element={<Navigate to="/admin/attendance-hik" replace />} />
          <Route path="attendance-logs" element={<RequireAdminPageAccess pageKey="attendance-logs"><AdminAttendanceHik /></RequireAdminPageAccess>} />
          <Route path="attendance-log" element={<Navigate to="/admin/attendance-hik" replace />} />
          <Route path="attendance-registry" element={<Navigate to="/admin/attendance-manual" replace />} />
          <Route path="leave" element={<RequireAdminPageAccess pageKey="leave"><AdminLeave /></RequireAdminPageAccess>} />
          <Route path="attendance-schedule" element={<RequireAdminPageAccess pageKey="attendance-schedule"><AdminAttendanceSchedule /></RequireAdminPageAccess>} />
          <Route path="google-sheets" element={<RequireAdminPageAccess pageKey="google-sheets"><AdminGoogleSheets /></RequireAdminPageAccess>} />
          <Route path="sheets" element={<Navigate to="/admin/google-sheets" replace />} />
          <Route path="sheet-sync" element={<Navigate to="/admin/google-sheets" replace />} />
          <Route path="schedule" element={<Navigate to="/admin/attendance-schedule" replace />} />
          <Route path="attendance-emails" element={<RequireAdminPageAccess pageKey="email-reports"><AdminAttendanceEmails /></RequireAdminPageAccess>} />
          <Route path="academics" element={<Navigate to="/admin/classes" replace />} />
          <Route path="directory" element={<Navigate to="/admin/users" replace />} />
          <Route path="tracking" element={<RequireAdminPageAccess pageKey="tracking"><AdminTracking /></RequireAdminPageAccess>} />
          <Route path="analytics" element={<Navigate to="/admin/tracking" replace />} />
          <Route path="notifications" element={<RequireAdminPageAccess pageKey="notifications"><AdminNotifications /></RequireAdminPageAccess>} />
          <Route path="whatsapp" element={<RequireAdminPageAccess pageKey="settings"><AdminWhatsApp /></RequireAdminPageAccess>} />
          <Route path="mailflare" element={<AdminMailflare />} />
          <Route path="grievances" element={<AdminGrievances />} />
          <Route path="feedback" element={<Navigate to="/admin/grievances" replace />} />
          <Route path="grievance" element={<Navigate to="/admin/grievances" replace />} />
          <Route path="support" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="email" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="webmail" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="inbox" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="security" element={<RequireAdminPageAccess pageKey="security"><AdminSecurity /></RequireAdminPageAccess>} />
          <Route path="procurement" element={<RequireAdminPageAccess pageKey="procurement"><AdminProcurement /></RequireAdminPageAccess>} />
          <Route path="assignments" element={<RequireAdminPageAccess pageKey="student-assignments"><AdminAssignments /></RequireAdminPageAccess>} />
          <Route path="hobbies" element={<RequireAdminPageAccess pageKey="hobbies"><AdminHobbies /></RequireAdminPageAccess>} />
          <Route path="skills" element={<RequireAdminPageAccess pageKey="talabat-skills"><AdminSkills /></RequireAdminPageAccess>} />
          <Route path="talabat-profiles" element={<RequireAdminPageAccess pageKey="talabat-profiles"><AdminTalabatProfiles /></RequireAdminPageAccess>} />
          <Route path="profile-1447" element={<Navigate to="/admin/talabat-profiles" replace />} />
          <Route path="knowing-myself" element={<TalabatKnowingMyself />} />
          <Route path="tilawat-dua" element={<RequireAdminPageAccess pageKey="tilawat-dua"><AdminTilawatDua /></RequireAdminPageAccess>} />
          <Route path="settings" element={<RequireAdminPageAccess pageKey="settings"><AdminSettings /></RequireAdminPageAccess>} />
          <Route path="portal-locks" element={<Navigate to="/admin/settings" replace />} />
          <Route path="locking" element={<Navigate to="/admin/settings" replace />} />
          <Route path="permissions" element={<Navigate to="/admin/settings" replace />} />
        </Route>

        {/* ── Talabat (Student) Routes ── */}
        <Route
          path="/talabat"
          element={
            <RequireRole role="STUDENT">
              <TalabatLayout />
            </RequireRole>
          }
        >
          <Route index element={<TalabatDashboard />} />
          <Route path="dashboard" element={<Navigate to="/talabat" replace />} />
          <Route path="timetable" element={<ModuleLockGuard moduleKey="timetable" role="STUDENT" title="Class Timetable"><TalabatTimetable /></ModuleLockGuard>} />
          <Route path="schedule" element={<Navigate to="/talabat/timetable" replace />} />
          <Route path="classes" element={<Navigate to="/talabat/timetable" replace />} />
          <Route path="attendance" element={<ModuleLockGuard moduleKey="attendance" role="STUDENT" title="Attendance"><TalabatAttendance /></ModuleLockGuard>} />
          <Route path="leave-request" element={<ModuleLockGuard moduleKey="attendance" role="STUDENT" title="Leave Records"><TalabatLeaveRequest /></ModuleLockGuard>} />
          <Route path="leave" element={<Navigate to="/talabat/leave-request" replace />} />
          <Route path="leaves" element={<Navigate to="/talabat/leave-request" replace />} />
          <Route path="scans" element={<ModuleLockGuard moduleKey="scans" role="STUDENT" title="My Scans"><TalabatScans /></ModuleLockGuard>} />
          <Route path="badges" element={<ModuleLockGuard moduleKey="badges" role="STUDENT" title="Badges"><TalabatBadges /></ModuleLockGuard>} />
          <Route path="library" element={<ModuleLockGuard moduleKey="library" role="STUDENT" title="Library"><TalabatLibrary /></ModuleLockGuard>} />
          <Route path="profile" element={<ModuleLockGuard moduleKey="profile" role="STUDENT" title="My Profile"><TalabatProfile /></ModuleLockGuard>} />
          <Route path="knowing-myself" element={<TalabatKnowingMyself />} />
          <Route path="profile/knowing-myself" element={<TalabatKnowingMyself />} />
          <Route path="yearly-profile" element={<TalabatProfile1447 />} />
          <Route path="profile-1447" element={<TalabatProfile1447 />} />
          <Route path="settings" element={<TalabatSettings />} />
          <Route path="skill-tree" element={<ModuleLockGuard moduleKey="skillTree" role="STUDENT" title="Skill Tree"><TalabatSkillTree /></ModuleLockGuard>} />
          <Route path="assignments" element={<ModuleLockGuard moduleKey="assignments" role="STUDENT" title="Assignments"><TalabatAssignments /></ModuleLockGuard>} />
          <Route path="hobbies" element={<ModuleLockGuard moduleKey="hobbies" role="STUDENT" title="Hobbies & Skills"><TalabatHobbies /></ModuleLockGuard>} />
          <Route path="tilawat-dua" element={<ModuleLockGuard moduleKey="tilawatDua" role="STUDENT" title="Tilawat Dua"><TalabatTilawatDua /></ModuleLockGuard>} />
          <Route path="support" element={<TalabatSupport />} />
          <Route path="mailflare" element={<Navigate to="/talabat/support" replace />} />
          <Route path="helpdesk" element={<Navigate to="/talabat/support" replace />} />
          <Route path="mail" element={<Navigate to="/talabat/support" replace />} />
          <Route path="email" element={<Navigate to="/talabat/support" replace />} />
          <Route path="emails" element={<Navigate to="/talabat/support" replace />} />
          <Route path="webmail" element={<Navigate to="/talabat/support" replace />} />
          <Route path="inbox" element={<Navigate to="/talabat/support" replace />} />
          <Route path="messages" element={<Navigate to="/talabat/support" replace />} />
          <Route path="message" element={<Navigate to="/talabat/support" replace />} />
          <Route path="tickets" element={<Navigate to="/talabat/support" replace />} />
          <Route path="ticket" element={<Navigate to="/talabat/support" replace />} />
          <Route path="it-support" element={<Navigate to="/talabat/support" replace />} />
          <Route path="it" element={<Navigate to="/talabat/support" replace />} />
          <Route path="*" element={<Navigate to="/talabat" replace />} />
        </Route>

        {/* ── Teacher Routes ── */}
        <Route
          path="/teacher"
          element={
            <RequireRole role="TEACHER">
              <TeacherLayout />
            </RequireRole>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="dashboard" element={<Navigate to="/teacher" replace />} />
          <Route path="classes" element={<RequireAdminPageAccess pageKey="classes"><TeacherClasses /></RequireAdminPageAccess>} />
          <Route path="talabat-profiles" element={<RequireAdminPageAccess pageKey="talabat-profiles"><TeacherTalabatProfiles /></RequireAdminPageAccess>} />
          <Route path="profile-1447" element={<Navigate to="/teacher/talabat-profiles" replace />} />
          <Route path="yearly-profile" element={<Navigate to="/teacher/talabat-profiles" replace />} />
          <Route path="attendance" element={<RequireAdminPageAccess pageKey="manual-attendance"><TeacherAttendance /></RequireAdminPageAccess>} />
          <Route path="manual-attendance" element={<Navigate to="/teacher/attendance" replace />} />
          <Route path="medical-duty" element={<RequireAdminPageAccess pageKey="medical-duty"><TeacherMedicalDuty /></RequireAdminPageAccess>} />
          <Route path="leave" element={<RequireAdminPageAccess pageKey="leave"><TeacherLeave /></RequireAdminPageAccess>} />
          <Route path="leave-request" element={<Navigate to="/teacher/leave" replace />} />
          <Route path="leaves" element={<Navigate to="/teacher/leave" replace />} />
          <Route path="justifications" element={<Navigate to="/teacher/attendance" replace />} />
          <Route path="attendance/justifications" element={<Navigate to="/teacher/attendance" replace />} />
          <Route path="takhteet" element={<RequireAdminPageAccess pageKey="takhteet"><TeacherTakhteet /></RequireAdminPageAccess>} />
          <Route path="tafseel" element={<Navigate to="/teacher/takhteet" replace />} />
          <Route path="students" element={<RequireAdminPageAccess pageKey="students"><AdminStudents /></RequireAdminPageAccess>} />
          <Route path="portal-assignments" element={<RequireAdminPageAccess pageKey="portal-assignments"><AdminPortalAssignments /></RequireAdminPageAccess>} />
          <Route path="parents" element={<RequireAdminPageAccess pageKey="parents"><AdminParents /></RequireAdminPageAccess>} />
          <Route path="parents/assign" element={<RequireAdminPageAccess pageKey="parents-assign"><AdminParentsAssign /></RequireAdminPageAccess>} />
          <Route path="hik-connect" element={<RequireAdminPageAccess pageKey="attendance-logs"><AdminHikConnect /></RequireAdminPageAccess>} />
          <Route path="attendance-hik" element={<RequireAdminPageAccess pageKey="attendance-logs"><AdminAttendanceHik /></RequireAdminPageAccess>} />
          <Route path="attendance-manual" element={<Navigate to="/teacher/attendance" replace />} />
          <Route path="attendance-logs" element={<Navigate to="/teacher/attendance-hik" replace />} />
          <Route path="attendance-schedule" element={<RequireAdminPageAccess pageKey="attendance-schedule"><AdminAttendanceSchedule /></RequireAdminPageAccess>} />
          <Route path="google-sheets" element={<RequireAdminPageAccess pageKey="google-sheets"><AdminGoogleSheets /></RequireAdminPageAccess>} />
          <Route path="attendance-emails" element={<RequireAdminPageAccess pageKey="email-reports"><AdminAttendanceEmails /></RequireAdminPageAccess>} />
          <Route path="biometric" element={<RequireAdminPageAccess pageKey="biometric"><AdminBiometric /></RequireAdminPageAccess>} />
          <Route path="passwords" element={<RequireAdminPageAccess pageKey="passwords"><AdminPasswords /></RequireAdminPageAccess>} />
          <Route path="users" element={<RequireAdminPageAccess pageKey="users"><AdminUsers /></RequireAdminPageAccess>} />
          <Route path="timetable" element={<RequireAdminPageAccess pageKey="timetable"><TeacherTimetable /></RequireAdminPageAccess>} />
          <Route path="timetable/manage" element={<RequireAdminPageAccess pageKey="timetable"><AdminTimetable initialTab="badal" /></RequireAdminPageAccess>} />
          <Route path="timetable/matrix" element={<RequireAdminPageAccess pageKey="timetable"><AdminTimetable /></RequireAdminPageAccess>} />
          <Route path="timetable-matrix" element={<RequireAdminPageAccess pageKey="timetable"><AdminTimetable /></RequireAdminPageAccess>} />
          <Route path="timetable/badal" element={<RequireAdminPageAccess pageKey="timetable"><AdminTimetable initialTab="badal" /></RequireAdminPageAccess>} />
          <Route path="tracking" element={<RequireAdminPageAccess pageKey="tracking"><AdminTracking /></RequireAdminPageAccess>} />
          <Route path="point-matrix" element={<RequireAdminPageAccess pageKey="point-matrix"><AdminPointMatrix /></RequireAdminPageAccess>} />
          <Route path="procurement" element={<TeacherProcurement />} />
          <Route path="desk-requisition" element={<TeacherProcurement />} />
          <Route path="requisition" element={<Navigate to="/teacher/procurement" replace />} />
          <Route path="library" element={<RequireAdminPageAccess pageKey="library"><AdminLibrary /></RequireAdminPageAccess>} />
          <Route path="library/overview" element={<RequireAdminPageAccess pageKey="library-overview"><AdminLibraryOverview /></RequireAdminPageAccess>} />
          <Route path="library/shelves" element={<RequireAdminPageAccess pageKey="library-shelves"><AdminLibraryShelves /></RequireAdminPageAccess>} />
          <Route path="library/checkout" element={<RequireAdminPageAccess pageKey="library-checkout"><AdminLibraryCheckout /></RequireAdminPageAccess>} />
          <Route path="library/attendance" element={<RequireAdminPageAccess pageKey="library"><AdminLibraryAttendance /></RequireAdminPageAccess>} />
          <Route path="library/overdue" element={<RequireAdminPageAccess pageKey="library-overdue"><AdminLibraryOverdue /></RequireAdminPageAccess>} />
          <Route path="library/auditor" element={<RequireAdminPageAccess pageKey="library-auditor"><AdminLibraryAuditor /></RequireAdminPageAccess>} />
          <Route path="waras-mubarak" element={<RequireAdminPageAccess pageKey="students"><AdminWarasMubarak /></RequireAdminPageAccess>} />
          <Route path="waras" element={<Navigate to="/admin/waras-mubarak" replace />} />
          <Route path="makhzn" element={<RequireAdminPageAccess pageKey="makhzan"><AdminMakhzan /></RequireAdminPageAccess>} />
          <Route path="makhzan" element={<Navigate to="/teacher/makhzn" replace />} />
          <Route path="notifications" element={<RequireAdminPageAccess pageKey="notifications"><AdminNotifications /></RequireAdminPageAccess>} />
          <Route path="whatsapp" element={<RequireAdminPageAccess pageKey="settings"><AdminWhatsApp /></RequireAdminPageAccess>} />
          <Route path="mailflare" element={<AdminMailflare />} />
          <Route path="grievances" element={<Navigate to="/admin/grievances" replace />} />
          <Route path="support" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="email" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="webmail" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="inbox" element={<Navigate to="/admin/mailflare" replace />} />
          <Route path="security" element={<RequireAdminPageAccess pageKey="security"><AdminSecurity /></RequireAdminPageAccess>} />
          <Route path="schedule" element={<Navigate to="/teacher/attendance-schedule" replace />} />
          <Route path="attendance-log" element={<Navigate to="/teacher/attendance-hik" replace />} />
          <Route path="attendance-registry" element={<Navigate to="/teacher/attendance" replace />} />
          <Route path="my-attendance" element={<RequireAdminPageAccess pageKey="my-attendance"><TeacherMyAttendance /></RequireAdminPageAccess>} />
          <Route path="profile" element={<RequireAdminPageAccess pageKey="profile"><TeacherProfile /></RequireAdminPageAccess>} />
          <Route path="assignments" element={<RequireAdminPageAccess pageKey="student-assignments"><TeacherAssignments /></RequireAdminPageAccess>} />
          <Route path="hobbies" element={<RequireAdminPageAccess pageKey="hobbies"><AdminHobbies /></RequireAdminPageAccess>} />
          <Route path="skills" element={<RequireAdminPageAccess pageKey="talabat-skills"><AdminSkills /></RequireAdminPageAccess>} />
          <Route path="tilawat-dua" element={<TeacherTilawatDua />} />
          <Route path="tilawat-dua/manage" element={<RequireAdminPageAccess pageKey="tilawat-dua"><AdminTilawatDua /></RequireAdminPageAccess>} />
          <Route path="settings" element={<RequireAdminPageAccess pageKey="settings"><TeacherSettings /></RequireAdminPageAccess>} />
          <Route path="*" element={<Navigate to="/teacher" replace />} />
        </Route>

        {/* ── Faculty Routes ── */}
        <Route
          path="/faculty"
          element={
            <RequireRole role="TEACHER">
              <FacultyLayout />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="/faculty/attendance" replace />} />
          <Route path="attendance" element={<ModuleLockGuard moduleKey="faculty" role="TEACHER" title="Faculty Portal"><FacultyAttendance /></ModuleLockGuard>} />
          <Route path="tilawat-dua" element={<FacultyTilawatDua />} />
        </Route>

        {/* ── Direct Fullscreen Projector Route ── */}
        <Route path="/tilawat-dua/projector" element={<RequireAuth><DirectProjectorPage /></RequireAuth>} />
        <Route path="/projector/tilawat-dua" element={<RequireAuth><DirectProjectorPage /></RequireAuth>} />

        {/* ── Parent Routes ── */}
        <Route
          path="/parent"
          element={
            <RequireRole role="PARENT">
              <ParentLayout />
            </RequireRole>
          }
        >
          <Route index element={<ModuleLockGuard moduleKey="dashboard" role="PARENT" title="Parent Dashboard"><ParentDashboard defaultTab="overview" /></ModuleLockGuard>} />
          <Route path="dashboard" element={<Navigate to="/parent" replace />} />
          <Route path="overview" element={<Navigate to="/parent" replace />} />
          <Route path="activity" element={<ModuleLockGuard moduleKey="activity" role="PARENT" title="Activity Log"><ParentActivity /></ModuleLockGuard>} />
          <Route path="tracking" element={<ModuleLockGuard moduleKey="tracking" role="PARENT" title="Attendance & Telemetry"><ParentDashboard defaultTab="tracking" /></ModuleLockGuard>} />
          <Route path="timetable" element={<ModuleLockGuard moduleKey="timetable" role="PARENT" title="Class Timetable"><ParentDashboard defaultTab="timetable" /></ModuleLockGuard>} />
          <Route path="library" element={<ModuleLockGuard moduleKey="library" role="PARENT" title="Library Books"><ParentDashboard defaultTab="library" /></ModuleLockGuard>} />
          <Route path="leave" element={<ModuleLockGuard moduleKey="leave" role="PARENT" title="Leave Applications"><ParentDashboard defaultTab="leave" /></ModuleLockGuard>} />
          <Route path="grievances" element={<ModuleLockGuard moduleKey="support" role="PARENT" title="Grievances & Feedback"><ParentDashboard defaultTab="support" /></ModuleLockGuard>} />
          <Route path="support" element={<Navigate to="/parent/grievances" replace />} />
          <Route path="feedback" element={<Navigate to="/parent/grievances" replace />} />
          <Route path="complaints" element={<Navigate to="/parent/grievances" replace />} />
          <Route path="leaves" element={<Navigate to="/parent/leave" replace />} />
          <Route path="leave-request" element={<Navigate to="/parent/leave" replace />} />
          <Route path="attendance" element={<Navigate to="/parent/tracking" replace />} />
          <Route path="scans" element={<Navigate to="/parent/tracking" replace />} />
          <Route path="yearly-profile" element={<TalabatProfile1447 />} />
          <Route path="profile-1447" element={<TalabatProfile1447 />} />
          <Route path="profile" element={<Navigate to="/parent/settings" replace />} />
          <Route path="settings" element={<ModuleLockGuard moduleKey="settings" role="PARENT" title="Account Settings"><ParentSettings /></ModuleLockGuard>} />
          <Route path="*" element={<Navigate to="/parent" replace />} />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <CookieConsentBanner />
      <PWAInstallBanner />
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </DevLockGuard>
  </ErrorBoundary>
  );
}
