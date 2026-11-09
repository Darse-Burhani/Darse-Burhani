"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminPortalAssignmentsPage from "@/app/admin/portal-assignments/page";
import { usePortalAccess } from "@/context/PortalAccessContext";

export default function TeacherPortalAssignmentsPage() {
  const { data: session, status } = useSession();
  const { isPageAssigned, loading } = usePortalAccess();
  const canManagePortals = session?.user?.role === "ADMIN" || isPageAssigned("portal-assignments");

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Verifying Portal Management Authority...</p>
      </div>
    );
  }

  if (!canManagePortals) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-slate-900/90 border border-amber-400/40 rounded-3xl p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mx-auto text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-amber-300">Portal Management Restricted</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Delegating portal modules and staff permissions requires Portal Management authority assigned by the Principal or Head of Faculty.
            </p>
          </div>
          <Link href="/teacher">
            <Button className="w-full bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 rounded-2xl">
              <ArrowLeft className="w-4 h-4 mr-2" /> Return to Faculty Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminPortalAssignmentsPage />
    </div>
  );
}

