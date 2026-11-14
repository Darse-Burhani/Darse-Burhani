"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";

import { Link } from "react-router-dom";
import { Lock, ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PortalModulesConfig {
  talabat: Record<string, boolean>;
  teacher: Record<string, boolean>;
  parent: Record<string, boolean>;
}

const defaultModules: PortalModulesConfig = {
  talabat: {
    dashboard: true,
    timetable: true,
    attendance: true,
    scans: true,
    library: true,
    skillTree: true,
    badges: true,
    profile: true,
    tilawatDua: true,
  },
  teacher: {
    dashboard: true,
    classes: true,
    timetable: true,
    takhteet: true,
    attendance: true,
    faculty: true,
    profile: true,
    pointMatrix: false,
    tilawatDua: true,
  },
  parent: {
    dashboard: true,
    activity: true,
    tracking: true,
    timetable: true,
    library: true,
    leave: true,
    // Hidden by default for now — Idarah can enable it from Portal Locks & Permissions
    support: false,
    settings: true,
  },
};

// Minimal safe defaults while permissions load — keeps core faculty tools open.
// Teaching modules (classes, timetable, takhteet) are granted exclusively to teachers
// who have assigned subjects and classes (or explicit Admin portal assignment).
const DEFAULT_TEACHER_BASE_PAGES = [
  "dashboard",
  "profile",
  "my-attendance",
  "tilawat-dua",
];

interface PortalAccessContextType {
  modules: PortalModulesConfig;
  assignedPages: string[];
  explicitPages: string[];
  canManageTimetable: boolean;
  isMasterAdmin: boolean;
  loading: boolean;
  refreshModules: () => Promise<void>;
  isModuleVisible: (moduleKey: string, role?: string) => boolean;
  isPageAssigned: (pageIdOrPath: string) => boolean;
  isPageExplicitlyAssigned: (pageIdOrPath: string) => boolean;
}

const PortalAccessContext = createContext<PortalAccessContextType>({
  modules: defaultModules,
  assignedPages: DEFAULT_TEACHER_BASE_PAGES,
  explicitPages: [],
  canManageTimetable: false,
  isMasterAdmin: false,
  loading: false,
  refreshModules: async () => {},
  isModuleVisible: () => true,
  isPageAssigned: () => true,
  isPageExplicitlyAssigned: () => false,
});

export function normalizePageKey(keyOrPath: string): string {
  if (!keyOrPath) return "";
  let clean = keyOrPath.trim().toLowerCase();
  clean = clean.replace(/^\/+(admin|teacher|talabat|faculty|parent)\/+/, "");
  clean = clean.replace(/^\/+|\/+$/g, "");
  clean = clean.replace(/^page:/, "");
  if (!clean || clean === "admin" || clean === "teacher") return "dashboard";
  if (clean === "attendance" || clean === "manual-attendance" || clean === "attendance-manual" || clean === "attendance_manual" || clean === "manual_attendance" || clean === "manual") return "manual-attendance";
  if (clean === "attendance-emails" || clean === "attendance-email" || clean === "email-reports" || clean === "email_reports" || clean === "emails") return "email-reports";
  if (clean === "attendance-log" || clean === "attendance-logs" || clean === "attendance_logs" || clean === "attendance_log" || clean === "logs" || clean === "log" || clean === "attendance-registry" || clean === "attendance-hik" || clean === "hik") return "attendance-logs";
  if (clean === "schedule" || clean === "attendance-schedule" || clean === "attendance_schedule") return "attendance-schedule";
  if (clean === "biometric" || clean === "biometrics" || clean === "scanners") return "biometric";
  if (clean === "medical" || clean === "medical-duty" || clean === "medical_duty" || clean === "medical-desk" || clean === "medical_desk" || clean === "health") return "medical-duty";
  if (clean === "makhzn" || clean === "makhzan" || clean === "warehouse" || clean === "inventory") return "makhzan";
  if (clean === "talabat-profiles" || clean === "talabat-profile" || clean === "yearly-profile" || clean === "profile-1447" || clean === "profile1447") return "talabat-profiles";
  if (clean === "google-sheets" || clean === "google_sheets" || clean === "sheets" || clean === "sheet-sync") return "google-sheets";
  if (clean === "parents/assign" || clean === "parents-assign" || clean === "parent-links") return "parents-assign";
  if (clean.startsWith("library/")) return `library-${clean.split("/")[1]}`;
  if (clean === "library-overview" || clean === "library_overview") return "library-overview";
  if (clean === "library-shelves" || clean === "library_shelves") return "library-shelves";
  if (clean === "library-checkout" || clean === "library_checkout") return "library-checkout";
  if (clean === "library-overdue" || clean === "library_overdue") return "library-overdue";
  if (clean === "library-auditor" || clean === "library_auditor") return "library-auditor";
  if (clean.startsWith("library")) return "library";
  if (clean.startsWith("parents")) return "parents";
  if (clean === "credentials" || clean === "passwords") return "passwords";
  if (clean === "analytics" || clean === "tracking") return "tracking";
  if (clean === "point-rules" || clean === "point-matrix" || clean === "point_matrix" || clean === "points") return "point-matrix";
  if (clean === "portal-assignments" || clean === "portal_assignments") return "portal-assignments";
  if (clean === "assignments" || clean === "student-assignments" || clean === "student_assignments" || clean === "teacher-assignments") return "student-assignments";
  if (clean === "my-attendance" || clean === "my_attendance") return "my-attendance";
  if (clean === "badal" || clean === "badal-management" || clean === "substitution" || clean === "substitute") return "badal";
  if (clean === "timetable" || clean === "schedule-matrix" || clean === "timetable-matrix" || clean === "matrix-management" || clean === "timetable-management") return "timetable";
  if (clean === "procurement" || clean === "desk-requisition" || clean === "requisition" || clean === "supplies") return "procurement";
  if (clean === "notifications" || clean === "broadcasts") return "notifications";
  if (clean === "security" || clean === "audit") return "security";
  if (clean === "takhteet" || clean === "tafseel" || clean === "curriculum" || clean === "syllabus") return "takhteet";
  if (clean === "tilawat-dua" || clean === "tilawat_dua" || clean === "tilawat" || clean === "dua" || clean.startsWith("tilawat-dua/")) return "tilawat-dua";
  return clean;
}

/**
 * Maps a nav item key to the equivalent key used in the module config (admin settings).
 * Nav items sometimes use different keys than the module lock system.
 */
function navKeyToModuleConfigKey(navKey: string): string {
  if (navKey === "tilawat-dua" || navKey === "tilawat_dua") return "tilawatDua";
  if (
    navKey === "manual-attendance" ||
    navKey === "attendance-logs" ||
    navKey === "attendance-schedule" ||
    navKey === "email-reports" ||
    navKey === "google-sheets" ||
    navKey === "biometric"
  )
    return "attendance";
  if (navKey === "overview") return "dashboard";
  return navKey;
}

export function PortalAccessProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [modules, setModules] = useState<PortalModulesConfig>(defaultModules);
  // Start with minimal safe defaults — full page list only after API responds.
  const [assignedPages, setAssignedPages] = useState<string[]>(DEFAULT_TEACHER_BASE_PAGES);
  const [explicitPages, setExplicitPages] = useState<string[]>([]);
  const [serverCanManageTimetable, setServerCanManageTimetable] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    try {
      // 1. Fetch portal module visibility
      let res = await fetch("/api/portal-permissions/modules");
      if (!res.ok) {
        if (session?.user?.role === "ADMIN") {
          res = await fetch("/api/admin/profile-permissions");
        } else if (session?.user?.role === "TEACHER") {
          res = await fetch("/api/teacher/profile/permissions");
        } else if (session?.user?.role === "STUDENT") {
          res = await fetch("/api/talabat/profile/permissions");
        } else if (session?.user?.role === "PARENT") {
          res = await fetch("/api/parent/profile/permissions");
        }
      }

      if (res.ok) {
        const json = await res.json();
        const role = session?.user?.role;
        const candidateModules = json.data?.modules || json.modules || json.data;

        if (candidateModules) {
          if (candidateModules.talabat || candidateModules.teacher || candidateModules.parent) {
            setModules({
              talabat: { ...defaultModules.talabat, ...(candidateModules.talabat || {}) },
              teacher: { ...defaultModules.teacher, ...(candidateModules.teacher || {}) },
              parent: { ...defaultModules.parent, ...(candidateModules.parent || {}) },
            });
          } else if (role === "PARENT") {
            setModules((prev) => ({
              ...prev,
              parent: { ...defaultModules.parent, ...candidateModules },
            }));
          } else if (role === "STUDENT") {
            setModules((prev) => ({
              ...prev,
              talabat: { ...defaultModules.talabat, ...candidateModules },
            }));
          } else if (role === "TEACHER") {
            setModules((prev) => ({
              ...prev,
              teacher: { ...defaultModules.teacher, ...candidateModules },
            }));
          }
        }
      }

      // 2. Fetch specific teacher page assignments if Teacher role
      if (session?.user?.role?.toUpperCase() === "TEACHER") {
        try {
          const assignRes = await fetch("/api/admin/portal-assignments?self=true");
          if (assignRes.ok) {
            const assignJson = await assignRes.json();
            if (assignJson.success) {
              if (Array.isArray(assignJson.data?.assignedPages)) {
                setAssignedPages(assignJson.data.assignedPages);
              }
              if (Array.isArray(assignJson.data?.explicitPages)) {
                setExplicitPages(assignJson.data.explicitPages);
              } else if (Array.isArray(assignJson.data?.rawAssignments)) {
                setExplicitPages(assignJson.data.rawAssignments.map((p: string) => normalizePageKey(p)));
              }
              if (typeof assignJson.data?.canManageTimetable === "boolean") {
                setServerCanManageTimetable(assignJson.data.canManageTimetable);
              }
            }
          }
        } catch {
          // Keep base defaults on failure
        }
      }
    } catch {
      // Keep defaults on network failure
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchModules();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, fetchModules]);

  const isMasterAdmin = useMemo(() => {
    const role = session?.user?.role?.toUpperCase();
    if (role === "ADMIN") return true;
    if (role !== "TEACHER") return false;
    const checkMaster = (p: string) => {
      const clean = String(p).toLowerCase().replace(/^page:/, "").trim();
      return clean === "all" || clean === "*" || clean === "portal-assignments";
    };
    return assignedPages.some(checkMaster) || explicitPages.some(checkMaster);
  }, [session, assignedPages, explicitPages]);

  const canManageTimetable = useMemo(() => {
    const role = session?.user?.role?.toUpperCase();
    if (role === "ADMIN") return true;
    if (role !== "TEACHER") return false;

    if (isMasterAdmin) return true;
    if (serverCanManageTimetable) return true;

    const checkMatch = (p: string) => {
      const k = String(p).toLowerCase().replace(/^page:/, "").trim();
      return (
        k === "badal" ||
        k === "badal-management" ||
        k === "timetable" ||
        k === "timetable-management" ||
        k === "matrix-management" ||
        k === "substitution" ||
        k === "all" ||
        k === "*" ||
        k === "portal-assignments"
      );
    };

    if (explicitPages.some(checkMatch)) return true;
    if (assignedPages.some(checkMatch)) return true;

    return false;
  }, [session, isMasterAdmin, serverCanManageTimetable, explicitPages, assignedPages]);

  const isPageAssigned = useCallback(
    (pageIdOrPath: string) => {
      const role = session?.user?.role?.toUpperCase();
      if (role === "ADMIN") return true;
      if (role !== "TEACHER") return false;

      // Master Administrator receives unconditional authority over all pages
      if (isMasterAdmin) {
        return true;
      }

      // While permissions are still loading, allow base teacher tools (no nav flash)
      if (loading) {
        const key = normalizePageKey(pageIdOrPath);
        return (
          key === "dashboard" ||
          key === "profile" ||
          key === "my-attendance" ||
          key === "tilawat-dua"
        );
      }

      const key = normalizePageKey(pageIdOrPath);
      // Safe base tools accessible to every faculty member
      // NOTE: classes, timetable, and takhteet are strictly restricted to teachers
      // who have assigned subjects and classes (via assignedPages) or explicit Admin assignment.
      if (
        key === "dashboard" ||
        key === "profile" ||
        key === "my-attendance" ||
        key === "tilawat-dua"
      ) {
        return true;
      }

      // Check normalized key against normalized assigned pages
      const normalizedAssigned = assignedPages.map((p) => normalizePageKey(p));
      if (normalizedAssigned.includes(key)) return true;
      if (assignedPages.includes(key)) return true;
      if (assignedPages.includes(pageIdOrPath)) return true;

      // Parent permissions open their child tabs (Library hub, Parents hub).
      if (key.startsWith("library-") && normalizedAssigned.includes("library")) return true;
      if (key === "library" && normalizedAssigned.some((p) => p.startsWith("library-"))) return true;
      if (key === "parents-assign" && normalizedAssigned.includes("parents")) return true;

      // Direct checks on raw strings
      const rawLower = (pageIdOrPath || "").toLowerCase().replace(/^page:/, "");
      if (assignedPages.some((a) => a.toLowerCase().replace(/^page:/, "") === rawLower)) return true;

      // Timetable & Badal mapping
      if (key === "badal" || key === "timetable") {
        if (
          canManageTimetable ||
          assignedPages.some((p) => {
            const k = String(p).toLowerCase().replace(/^page:/, "").trim();
            return k === "badal" || k === "timetable" || k === "badal-management" || k === "timetable-management" || k === "matrix-management";
          }) ||
          explicitPages.some((p) => {
            const k = String(p).toLowerCase().replace(/^page:/, "").trim();
            return k === "badal" || k === "timetable" || k === "badal-management" || k === "timetable-management" || k === "matrix-management";
          })
        ) {
          return true;
        }
      }

      // Attendance mapping: if teacher has 'attendance', 'manual-attendance', or 'attendance-logs'
      if (key === "manual-attendance") {
        if (
          assignedPages.includes("manual-attendance") ||
          assignedPages.includes("attendance") ||
          assignedPages.includes("PAGE:manual-attendance") ||
          assignedPages.includes("PAGE:attendance") ||
          assignedPages.includes("manual") ||
          normalizedAssigned.includes("manual-attendance")
        ) {
          return true;
        }
      }

      if (key === "attendance-logs") {
        if (
          assignedPages.includes("attendance-logs") ||
          assignedPages.includes("attendance") ||
          assignedPages.includes("PAGE:attendance-logs") ||
          assignedPages.includes("PAGE:attendance") ||
          assignedPages.includes("logs") ||
          assignedPages.includes("log") ||
          normalizedAssigned.includes("attendance-logs")
        ) {
          return true;
        }
      }

      if (key === "attendance-schedule") {
        if (
          assignedPages.includes("attendance-schedule") ||
          assignedPages.includes("attendance") ||
          assignedPages.includes("PAGE:attendance-schedule") ||
          assignedPages.includes("PAGE:attendance") ||
          normalizedAssigned.includes("attendance-schedule")
        ) {
          return true;
        }
      }

      // Medical mapping
      if (
        key === "medical-duty" &&
        (assignedPages.includes("medical") ||
          assignedPages.includes("PAGE:medical") ||
          assignedPages.includes("medical-desk") ||
          assignedPages.includes("medical-duty") ||
          assignedPages.includes("PAGE:medical-duty") ||
          normalizedAssigned.includes("medical-duty"))
      ) {
        return true;
      }

      // Legacy synonyms and parent page mappings
      if (key === "passwords" && (assignedPages.includes("users") || assignedPages.includes("PAGE:users") || normalizedAssigned.includes("users") || normalizedAssigned.includes("passwords"))) return true;

      return false;
    },
    [session, isMasterAdmin, assignedPages, explicitPages, loading, canManageTimetable]
  );

  const isPageExplicitlyAssigned = useCallback(
    (pageIdOrPath: string) => {
      const role = session?.user?.role?.toUpperCase();
      if (role === "ADMIN") return true;
      if (role !== "TEACHER") return false;
      if (isMasterAdmin) {
        return true;
      }
      const key = normalizePageKey(pageIdOrPath);
      return (
        explicitPages.includes(key) ||
        explicitPages.some((p) => normalizePageKey(p) === key)
      );
    },
    [session, isMasterAdmin, explicitPages]
  );


  const isModuleVisible = useCallback(
    (moduleKey: string, targetRole?: string) => {
      const role = (targetRole || session?.user?.role || "").toUpperCase();
      const bucket =
        role === "TEACHER"
          ? modules.teacher
          : role === "STUDENT"
          ? modules.talabat
          : role === "PARENT"
          ? modules.parent
          : null;
      if (!bucket) return true;

      // Check direct key first
      if (bucket[moduleKey] === false) return false;

      // Check aliased module config key (nav keys can differ from admin module config keys)
      const configKey = navKeyToModuleConfigKey(moduleKey);
      if (configKey !== moduleKey && bucket[configKey] === false) return false;

      return true;
    },
    [modules, session]
  );

  return (
    <PortalAccessContext.Provider
      value={{
        modules,
        assignedPages,
        explicitPages,
        canManageTimetable,
        isMasterAdmin,
        loading,
        refreshModules: fetchModules,
        isModuleVisible,
        isPageAssigned,
        isPageExplicitlyAssigned,
      }}
    >
      {children}
    </PortalAccessContext.Provider>
  );
}

export function usePortalAccess() {
  return useContext(PortalAccessContext);
}

/**
 * ModuleLockGuard: Wraps a route page. If Admin has locked this module,
 * it displays an authentic Fatimi locked screen instead of the page.
 */
export function ModuleLockGuard({
  moduleKey,
  role,
  title = "Feature Locked",
  children,
}: {
  moduleKey: string;
  role: "STUDENT" | "TEACHER" | "PARENT";
  title?: string;
  children: React.ReactNode;
}) {
  const { isModuleVisible, loading } = usePortalAccess();

  // While permissions load, show a skeleton — never flash locked content.
  if (loading) {
    return (
      <div className="p-6 animate-pulse" aria-label="Loading module">
        <div className="max-w-md w-full mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-200 mx-auto" />
          <div className="h-5 w-2/3 rounded bg-gray-200 mx-auto" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-10 w-full rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  const visible = isModuleVisible(moduleKey, role);
  if (!visible) {
    const returnPath = role === "STUDENT" ? "/talabat" : role === "PARENT" ? "/parent" : "/teacher";
    const portalName = role === "STUDENT" ? "Talabat Portal" : role === "PARENT" ? "Parent Portal" : "Teacher Portal";

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/90 backdrop-blur-md border border-amber-200/80 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center shadow-inner">
            <Lock className="w-8 h-8 text-amber-700 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-900 border border-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              Administrative Policy
            </span>
            <h2 className="text-xl font-bold text-gray-900 font-display">{title} Currently Unavailable</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Access to this module has been temporarily locked by the Administrator for the {portalName}.
            </p>
          </div>

          <div className="pt-2">
            <Link to={returnPath}>
              <Button className="w-full fatimi-emerald-gradient text-white shadow-md text-xs font-semibold rounded-xl h-10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Portal Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * TeacherPageGuard: Wraps a teacher page.
 * Enforces that only faculty explicitly assigned this page by admin can access it.
 */
export function TeacherPageGuard({
  pageKey,
  title = "Page Restricted",
  children,
}: {
  pageKey: string;
  title?: string;
  children: React.ReactNode;
}) {
  const { isPageAssigned, loading } = usePortalAccess();

  if (loading) {
    return (
      <div className="p-6 animate-pulse" aria-label="Loading page permissions">
        <div className="max-w-md w-full mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-200 mx-auto" />
          <div className="h-5 w-2/3 rounded bg-gray-200 mx-auto" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-10 w-full rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  const assigned = isPageAssigned(pageKey);
  if (!assigned) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/90 backdrop-blur-md border border-amber-200/80 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center shadow-inner">
            <Lock className="w-8 h-8 text-amber-700 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-900 border border-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              Administrative Assignment Required
            </span>
            <h2 className="text-xl font-bold text-gray-900 font-display">{title} Restricted</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              This module is restricted to specific assigned faculty members. If you require access, please contact the administrator to grant permission via Portal Assignments.
            </p>
          </div>

          <div className="pt-2">
            <Link to="/teacher">
              <Button className="w-full fatimi-emerald-gradient text-white shadow-md text-xs font-semibold rounded-xl h-10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Teacher Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

