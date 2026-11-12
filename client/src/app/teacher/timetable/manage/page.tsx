"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, ArrowRightLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminTimetable from "@/app/admin/timetable/page";
import { usePortalAccess } from "@/context/PortalAccessContext";

export default function TeacherTimetableManagementPage() {
  const { data: session, status } = useSession();
  const { canManageTimetable, isPageAssigned, loading } = usePortalAccess();

  const hasAccess =
    session?.user?.role?.toUpperCase() === "ADMIN" ||
    canManageTimetable ||
    isPageAssigned("badal") ||
    isPageAssigned("timetable");

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-amber-200/80">Checking Timetable Management Authority...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/90 border border-amber-400/40 rounded-3xl p-8 text-center text-white shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mx-auto text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-amber-300">Management Access Restricted</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Full Timetable Matrix and Badal substitution management is granted strictly to Admin and authorized faculty members assigned by the Administration.
            </p>
          </div>
          <Link href="/teacher/timetable">
            <Button className="w-full bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 rounded-2xl">
              <ArrowLeft className="w-4 h-4 mr-2" /> Return to My Personal Timetable
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-amber-400/40 shadow-xl">
        <div className="flex items-center gap-3">
          <Link href="/teacher/timetable">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-white hover:bg-white/10 rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Timetable
            </Button>
          </Link>
          <div className="h-6 w-px bg-white/20 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-amber-300">Faculty Timetable & Badal Management Console</h1>
              <p className="text-[11px] text-emerald-200/80">Authorized slot allocation, clash detection & proxy management</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Assigned Academic Coordinator
          </span>
        </div>
      </div>

      {/* Admin Timetable Master Desk */}
      <AdminTimetable initialTab="badal" />
    </div>
  );
}

