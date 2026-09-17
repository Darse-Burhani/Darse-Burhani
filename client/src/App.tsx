import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "next-auth/react";
import PageSkeleton from "@/components/PageSkeleton";
import { ModuleLockGuard, usePortalAccess } from "@/context/PortalAccessContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ── Public Pages ──
const LoginPage = lazy(() => import("@/app/login/page"));
const PrivacyPage = lazy(() => import("@/app/privacy/page"));
const TermsPage = lazy(() => import("@/app/terms/page"));
const FatimiCalendarPage = lazy(() => import("@/app/fatimi-calendar/page"));
const LibraryTvPage = lazy(() => import("@/app/library-tv/page"));
const NotificationsLayout = lazy(() => import("@/app/notifications/layout"));
const NotificationsPage = lazy(() => import("@/app/notifications/page"));
const NotFoundPage = lazy(() => import("@/app/not-found/page"));
const ThankYouPage = lazy(() => import("@/app/thank-you/page"));

import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { useAutoRouteSEO } from "@/components/SEO";


// ── Admin Portal Pages ──
const AdminLayout = lazy(() => import("@/app/admin/layout"));
const AdminDashboard = lazy(() => import("@/app/admin/page"));
const AdminClasses = lazy(() => import("@/app/admin/classes/page"));
const AdminTimetable = lazy(() => import("@/app/admin/timetable/page"));
const AdminHifz = lazy(() => import("@/app/admin/hifz/page"));
const AdminHifzMarhala = lazy(() => import("@/app/admin/hifz-marhala/page"));
const AdminPointMatrix = lazy(() => import("@/app/admin/point-matrix/page"));
const AdminUsers = lazy(() => import("@/app/admin/users/page"));
const AdminPasswords = lazy(() => import("@/app/admin/passwords/page"));
const AdminStudents = lazy(() => import("@/app/admin/students/page"));
const AdminParents = lazy(() => import("@/app/admin/parents/page"));
const AdminParentsAssign = lazy(() => import("@/app/admin/parents/assign/page"));
const AdminLibrary = lazy(() => import("@/app/admin/library/page"));
const AdminLibraryOverview = lazy(() => import("@/app/admin/library/overview/page"));
const AdminLibraryShelves = lazy(() => import("@/app/admin/library/shelves/page"));
const AdminLibraryCheckout = lazy(() => import("@/app/admin/library/checkout/page"));
const AdminLibraryOverdue = lazy(() => import("@/app/admin/library/overdue/page"));
const AdminLibraryAuditor = lazy(() => import("@/app/admin/library/auditor/page"));
const AdminMakhzan = lazy(() => import("@/app/admin/makhzn/page"));
const AdminPortalAssignments = lazy(() => import("@/app/admin/portal-assignments/page"));
const AdminTakhteet = lazy(() => import("@/app/admin/takhteet/page"));
const AdminBiometric = lazy(() => import("@/app/admin/biometric/page"));
const AdminAttendanceSchedule = lazy(() => import("@/app/admin/attendance-schedule/page"));
const AdminAttendanceEmails = lazy(() => import("@/app/admin/attendance-emails/page"));
const AdminTracking = lazy(() => import("@/app/admin/tracking/page"));
const AdminNotifications = lazy(() => import("@/app/admin/notifications/page"));
const AdminSecurity = lazy(() => import("@/app/admin/security/page"));
const AdminProcurement = lazy(() => import("@/app/admin/procurement/page"));
const AdminLeave = lazy(() => import("@/app/admin/leave/page"));
const AdminAttendanceLogs = lazy(() => import("@/app/admin/attendance-logs/page"));
const AdminAttendanceRegistry = lazy(() => import("@/app/admin/attendance-logs/page"));
const AdminSettings = lazy(() => import("@/app/admin/settings/page"));

// ── Talabat (Student) Portal Pages ──
const TalabatLayout = lazy(() => import("@/app/talabat/layout"));
const TalabatDashboard = lazy(() => import("@/app/talabat/page"));
const TalabatAttendance = lazy(() => import("@/app/talabat/attendance/page"));
const TalabatLeaveRequest = lazy(() => import("@/app/talabat/leave-request/page"));
const TalabatScans = lazy(() => import("@/app/talabat/scans/page"));
const TalabatBadges = lazy(() => import("@/app/talabat/badges/page"));
const TalabatHifz = lazy(() => import("@/app/talabat/hifz/page"));
const TalabatHifzMarhala = lazy(() => import("@/app/talabat/hifz-marhala/page"));
const TalabatLibrary = lazy(() => import("@/app/talabat/library/page"));
const TalabatProfile = lazy(() => import("@/app/talabat/profile/page"));
const TalabatSettings = lazy(() => import("@/app/talabat/settings/page"));
const TalabatSkillTree = lazy(() => import("@/app/talabat/skill-tree/page"));

// ── Teacher Portal Pages ──
const TeacherLayout = lazy(() => import("@/app/teacher/layout"));
const TeacherDashboard = lazy(() => import("@/app/teacher/page"));
const TeacherClasses = lazy(() => import("@/app/teacher/classes/page"));
const TeacherAttendance = lazy(() => import("@/app/teacher/attendance/page"));
const TeacherLeave = lazy(() => import("@/app/teacher/leave/page"));
const TeacherHifz = lazy(() => import("@/app/teacher/hifz/page"));
const TeacherHifzMarhala = lazy(() => import("@/app/teacher/hifz-marhala/page"));
const TeacherHifzWeeklySlip = lazy(() => import("@/app/teacher/hifz-weekly-slip/page"));
const TeacherTakhteet = lazy(() => import("@/app/teacher/takhteet/page"));
const TeacherProfile = lazy(() => import("@/app/teacher/profile/page"));
const TeacherProcurement = lazy(() => import("@/app/teacher/procurement/page"));
const TeacherSettings = lazy(() => import("@/app/teacher/settings/page"));

// ── Faculty Portal Pages ──
const FacultyLayout = lazy(() => import("@/app/faculty/layout"));
const FacultyAttendance = lazy(() => import("@/app/faculty/attendance/page"));

// ── Parent Portal Pages ──
const ParentLayout = lazy(() => import("@/app/parent/layout"));
const ParentDashboard = lazy(() => import("@/app/parent/page"));
const ParentActivity = lazy(() => import("@/app/parent/activity/page"));
const ParentHifz = lazy(() => import("@/app/parent/hifz/page"));
const ParentSettings = lazy(() => import("@/app/parent/settings/page"));

function SuspenseFallback({ variant = "stats" }: { variant?: "card-grid" | "table" | "details" | "stats" }) {
  return <PageSkeleton variant={variant} />;
}

function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div
          role="status"
          aria-label="Loading"
          className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-700 rounded-full animate-spin"
        />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  // Admin can access any page / any user portal
  if (session.user.role === "ADMIN") return <>{children}</>;
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div
          role="status"
          aria-label="Loading"
          className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-700 rounded-full animate-spin"
        />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// The calendar route is shared cross-role, so the per-role ModuleLockGuard
// can't cover it — this sends locked-out students/teachers back to their
// dashboard instead of letting the URL bypass the admin's hide.
function RequireCalendarAccess({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { isModuleVisible, loading } = usePortalAccess();

  if (status === "loading" || loading) return <SuspenseFallback />;

  const role = session?.user?.role;
  if (role === "STUDENT" && !isModuleVisible("calendar", "STUDENT")) {
    return <Navigate to="/talabat" replace />;
  }
  if (role === "TEACHER" && !isModuleVisible("calendar", "TEACHER")) {
    return <Navigate to="/teacher" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  useAutoRouteSEO();

  return (
    <ErrorBoundary>
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route path="/terms" element={<TermsPage />} />
        <Route path="/fatimi-calendar" element={<RequireCalendarAccess><FatimiCalendarPage /></RequireCalendarAccess>} />
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

        {/* ── Admin Routes ── */}
        <Route
          path="/admin"
          element={
            <RequireRole role="ADMIN">
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="classes" element={<AdminClasses />} />
          <Route path="timetable" element={<AdminTimetable />} />
          <Route path="hifz" element={<AdminHifz />} />
          <Route path="hifz-marhala" element={<AdminHifzMarhala />} />
          <Route path="hifz-marhala/weekly-slips" element={<Navigate to="/admin/hifz-marhala" replace />} />
          <Route path="point-matrix" element={<AdminPointMatrix />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="passwords" element={<AdminPasswords />} />
          <Route path="credentials" element={<Navigate to="/admin/passwords" replace />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="parents" element={<AdminParents />} />
          <Route path="parents/assign" element={<AdminParentsAssign />} />
          <Route path="makhzn" element={<AdminMakhzan />} />
          <Route path="makhzan" element={<Navigate to="/admin/makhzn" replace />} />
          <Route path="library/makhzn" element={<Navigate to="/admin/makhzn" replace />} />
          <Route path="library/makhzan" element={<Navigate to="/admin/makhzn" replace />} />
          <Route path="library" element={<AdminLibrary />} />
          <Route path="library/overview" element={<AdminLibraryOverview />} />
          <Route path="library/shelves" element={<AdminLibraryShelves />} />
          <Route path="library/checkout" element={<AdminLibraryCheckout />} />
          <Route path="library/overdue" element={<AdminLibraryOverdue />} />
          <Route path="library/auditor" element={<AdminLibraryAuditor />} />
          <Route path="portal-assignments" element={<AdminPortalAssignments />} />
          <Route path="takhteet" element={<AdminTakhteet />} />
          <Route path="biometric" element={<AdminBiometric />} />
          <Route path="attendance" element={<Navigate to="/admin/attendance-logs" replace />} />
          <Route path="attendance-logs" element={<AdminAttendanceLogs />} />
          <Route path="attendance-log" element={<Navigate to="/admin/attendance-logs" replace />} />
          <Route path="attendance-registry" element={<Navigate to="/admin/attendance-logs" replace />} />
          <Route path="leave" element={<AdminLeave />} />
          <Route path="attendance-schedule" element={<AdminAttendanceSchedule />} />
          <Route path="schedule" element={<Navigate to="/admin/attendance-schedule" replace />} />
          <Route path="attendance-emails" element={<AdminAttendanceEmails />} />
          <Route path="academics" element={<Navigate to="/admin/classes" replace />} />
          <Route path="directory" element={<Navigate to="/admin/users" replace />} />
          <Route path="tracking" element={<AdminTracking />} />
          <Route path="analytics" element={<Navigate to="/admin/tracking" replace />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="procurement" element={<AdminProcurement />} />
          <Route path="settings" element={<AdminSettings />} />
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
          <Route path="attendance" element={<ModuleLockGuard moduleKey="attendance" role="STUDENT" title="Attendance"><TalabatAttendance /></ModuleLockGuard>} />
          <Route path="leave-request" element={<ModuleLockGuard moduleKey="attendance" role="STUDENT" title="Leave Request"><TalabatLeaveRequest /></ModuleLockGuard>} />
          <Route path="scans" element={<ModuleLockGuard moduleKey="scans" role="STUDENT" title="My Scans"><TalabatScans /></ModuleLockGuard>} />
          <Route path="badges" element={<ModuleLockGuard moduleKey="badges" role="STUDENT" title="Badges"><TalabatBadges /></ModuleLockGuard>} />
          <Route path="hifz" element={<ModuleLockGuard moduleKey="hifz" role="STUDENT" title="Hifz Journey"><TalabatHifz /></ModuleLockGuard>} />
          <Route path="hifz-marhala" element={<ModuleLockGuard moduleKey="hifz" role="STUDENT" title="Hifz Marhala"><TalabatHifzMarhala /></ModuleLockGuard>} />
          <Route path="library" element={<ModuleLockGuard moduleKey="library" role="STUDENT" title="Library"><TalabatLibrary /></ModuleLockGuard>} />
          <Route path="profile" element={<ModuleLockGuard moduleKey="profile" role="STUDENT" title="My Profile"><TalabatProfile /></ModuleLockGuard>} />
          <Route path="settings" element={<TalabatSettings />} />
          <Route path="skill-tree" element={<ModuleLockGuard moduleKey="skillTree" role="STUDENT" title="Skill Tree"><TalabatSkillTree /></ModuleLockGuard>} />
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
          <Route path="classes" element={<ModuleLockGuard moduleKey="classes" role="TEACHER" title="My Classes"><TeacherClasses /></ModuleLockGuard>} />
          <Route path="attendance" element={<ModuleLockGuard moduleKey="attendance" role="TEACHER" title="Attendance"><TeacherAttendance /></ModuleLockGuard>} />
          <Route path="leave" element={<ModuleLockGuard moduleKey="attendance" role="TEACHER" title="Leave Requests"><TeacherLeave /></ModuleLockGuard>} />
          <Route path="hifz" element={<ModuleLockGuard moduleKey="hifz" role="TEACHER" title="Hifz Reports"><TeacherHifz /></ModuleLockGuard>} />
          <Route path="hifz-marhala" element={<ModuleLockGuard moduleKey="hifz" role="TEACHER" title="Hifz Marhala"><TeacherHifzMarhala /></ModuleLockGuard>} />
          <Route path="hifz-weekly-slip" element={<ModuleLockGuard moduleKey="hifz" role="TEACHER" title="Hifz Weekly Slips"><TeacherHifzWeeklySlip /></ModuleLockGuard>} />
          <Route path="takhteet" element={<ModuleLockGuard moduleKey="takhteet" role="TEACHER" title="Takhteet"><TeacherTakhteet /></ModuleLockGuard>} />
          <Route path="procurement" element={<TeacherProcurement />} />
          <Route path="profile" element={<ModuleLockGuard moduleKey="profile" role="TEACHER" title="My Profile"><TeacherProfile /></ModuleLockGuard>} />
          <Route path="settings" element={<TeacherSettings />} />
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
        </Route>

        {/* ── Parent Routes ── */}
        <Route
          path="/parent"
          element={
            <RequireRole role="PARENT">
              <ParentLayout />
            </RequireRole>
          }
        >
          <Route index element={<ParentDashboard />} />
          <Route path="activity" element={<ParentActivity />} />
          <Route path="hifz" element={<ParentHifz />} />
          <Route path="settings" element={<ParentSettings />} />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <CookieConsentBanner />
    </ErrorBoundary>
  );
}
