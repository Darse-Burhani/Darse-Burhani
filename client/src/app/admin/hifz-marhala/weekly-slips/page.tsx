"use client";

import { ArrowLeft, BookOpen } from "lucide-react";
import WeeklySlipsManager from "@/components/hifz/WeeklySlipsManager";

export default function AdminWeeklySlipsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/admin/hifz-marhala"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 mb-4 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Hifz Marhala Management
          </a>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-800 via-purple-900 to-slate-950 p-6 sm:p-8 shadow-xl shadow-purple-900/20">
            <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-purple-400/15 blur-3xl" />
            <div className="absolute -bottom-14 -right-10 w-52 h-52 rounded-full bg-indigo-400/15 blur-3xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Weekly Slips</h1>
                <p className="text-sm text-purple-100/70 mt-1">
                  Review teacher submissions, edit marks and publish slips to parents
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          </div>
        </div>

        <WeeklySlipsManager />
      </div>
    </div>
  );
}
