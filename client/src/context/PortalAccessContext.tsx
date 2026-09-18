"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

import { Link } from "react-router-dom";
import { Lock, ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PortalModulesConfig {
  talabat: Record<string, boolean>;
  teacher: Record<string, boolean>;
}

const defaultModules: PortalModulesConfig = {
  talabat: {
    dashboard: true,
    attendance: true,
    scans: true,
    calendar: true,
    hifz: true,
    library: true,
    skillTree: true,
    badges: true,
    profile: true,
  },
  teacher: {
    dashboard: true,
    classes: true,
    takhteet: true,
    attendance: true,
    faculty: true,
    calendar: true,
    hifz: true,
    profile: true,
  },
};

interface PortalAccessContextType {
  modules: PortalModulesConfig;
  loading: boolean;
  refreshModules: () => Promise<void>;
  isModuleVisible: (moduleKey: string, role?: string) => boolean;
}

const PortalAccessContext = createContext<PortalAccessContextType>({
  modules: defaultModules,
  loading: false,
  refreshModules: async () => {},
  isModuleVisible: () => true,
});

export function PortalAccessProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [modules, setModules] = useState<PortalModulesConfig>(defaultModules);
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    try {
      let res = await fetch("/api/portal-permissions/modules");
      if (!res.ok) {
        // Fallback for role-specific routes or un-restarted servers
        if (session?.user?.role === "ADMIN") {
          res = await fetch("/api/admin/profile-permissions");
        } else if (session?.user?.role === "TEACHER") {
          res = await fetch("/api/teacher/profile/permissions");
        } else if (session?.user?.role === "STUDENT") {
          res = await fetch("/api/talabat/profile/permissions");
        }
      }

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          if (json.data.modules) {
            setModules({
              talabat: { ...defaultModules.talabat, ...(json.data.modules.talabat || json.data.modules || {}) },
              teacher: { ...defaultModules.teacher, ...(json.data.modules.teacher || json.data.modules || {}) },
            });
          } else if (session?.user?.role === "TEACHER" && json.data.modules) {
            setModules(prev => ({
              ...prev,
              teacher: { ...defaultModules.teacher, ...json.data.modules },
            }));
          } else if (session?.user?.role === "STUDENT" && json.data.modules) {
            setModules(prev => ({
              ...prev,
              talabat: { ...defaultModules.talabat, ...json.data.modules },
            }));
          } else if (json.data.talabat || json.data.teacher) {
            setModules({
              talabat: { ...defaultModules.talabat, ...(json.data.talabat || {}) },
              teacher: { ...defaultModules.teacher, ...(json.data.teacher || {}) },
            });
          }
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

  const isModuleVisible = useCallback(
    (moduleKey: string, targetRole?: string) => {
      const role = (targetRole || session?.user?.role || "").toUpperCase();
      const bucket =
        role === "TEACHER" ? modules.teacher : role === "STUDENT" ? modules.talabat : null;
      // Admins / unknown roles see everything; unknown module keys default to visible
      // so newly-added pages never vanish by accident.
      if (!bucket) return true;
      return bucket[moduleKey] !== false;
    },
    [modules, session]
  );

  return (
    <PortalAccessContext.Provider
      value={{
        modules,
        loading,
        refreshModules: fetchModules,
        isModuleVisible,
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
  role: "STUDENT" | "TEACHER";
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
    const returnPath = role === "STUDENT" ? "/talabat" : "/teacher";
    const portalName = role === "STUDENT" ? "Talabat Portal" : "Teacher Portal";

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
