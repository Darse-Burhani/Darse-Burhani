"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Stethoscope,
  Fingerprint,
  FileCheck2,
  Bot,
  UserCheck,
  Search,
  Eye,
  ChevronRight,
  Flame,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface DailyStackedViewProps {
  records: RegistryRecordItem[];
  summary: RegistrySummary;
  availableGrades: string[];
  availableSections: string[];
  selectedGrade: string;
  selectedSection: string;
  onGradeChange: (grade: string) => void;
  onSectionChange: (section: string) => void;
  onStudentClick: (studentId: string) => void;
}

type TabType = "ALL" | "PRESENT" | "LATE" | "MEDICAL" | "ON_LEAVE" | "ABSENT";

const sourceBadgeConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  BIOMETRIC: {
    label: "Biometric Scan",
    icon: Fingerprint,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  MANUAL: {
    label: "Manual Entry",
    icon: UserCheck,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  AUTO_ABSENT: {
    label: "Auto Absent",
    icon: Bot,
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
  MEDICAL_LEAVE: {
    label: "Medical Leave",
    icon: Stethoscope,
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
  LEAVE_APPROVED: {
    label: "Approved Leave",
    icon: FileCheck2,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
};

export function DailyStackedView({
  records,
  summary,
  availableGrades,
  availableSections,
  selectedGrade,
  selectedSection,
  onGradeChange,
  onSectionChange,
  onStudentClick,
}: DailyStackedViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [search, setSearch] = useState("");

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Tab filter
      if (activeTab === "PRESENT" && r.status !== "PRESENT") return false;
      if (activeTab === "LATE" && r.status !== "LATE") return false;
      if (activeTab === "MEDICAL" && r.status !== "MEDICAL") return false;
      if (activeTab === "ON_LEAVE" && r.status !== "ON_LEAVE") return false;
      if (activeTab === "ABSENT" && r.status !== "ABSENT") return false;

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesIts = r.its?.toLowerCase().includes(q);
        const matchesClass = r.className?.toLowerCase().includes(q);
        if (!matchesName && !matchesIts && !matchesClass) return false;
      }

      return true;
    });
  }, [records, activeTab, search]);

  return (
    <div className="space-y-4">
      {/* ── Top Summary Metric Stack ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === "ALL"
              ? "bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-gray-900/20"
              : "bg-white text-gray-900 border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">Expected</div>
          <div className="text-xl font-black mt-0.5">{summary.total}</div>
          <div className="text-[10px] font-medium opacity-60">Total Roster</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PRESENT")}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === "PRESENT"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white text-emerald-800 border-gray-100 hover:border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Present</span>
            <CheckCircle2 className="w-3.5 h-3.5 opacity-80" />
          </div>
          <div className="text-xl font-black mt-0.5">{summary.present}</div>
          <div className="text-[10px] font-medium opacity-70">
            {summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0}% on-time
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LATE")}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === "LATE"
              ? "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400/20"
              : "bg-white text-amber-800 border-gray-100 hover:border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Late</span>
            <Clock className="w-3.5 h-3.5 opacity-80" />
          </div>
          <div className="text-xl font-black mt-0.5">{summary.late}</div>
          <div className="text-[10px] font-medium opacity-70">Grace window</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MEDICAL")}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === "MEDICAL"
              ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/20"
              : "bg-white text-rose-800 border-gray-100 hover:border-rose-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Medical</span>
            <Stethoscope className="w-3.5 h-3.5 opacity-80" />
          </div>
          <div className="text-xl font-black mt-0.5">{summary.medical}</div>
          <div className="text-[10px] font-medium opacity-70">Doctor / Sick</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ON_LEAVE")}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === "ON_LEAVE"
              ? "bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-500/20"
              : "bg-white text-purple-800 border-gray-100 hover:border-purple-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Leave</span>
            <FileCheck2 className="w-3.5 h-3.5 opacity-80" />
          </div>
          <div className="text-xl font-black mt-0.5">{summary.onLeave}</div>
          <div className="text-[10px] font-medium opacity-70">Approved off</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ABSENT")}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeTab === "ABSENT"
              ? "bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-500/20"
              : "bg-white text-red-800 border-gray-100 hover:border-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Absent</span>
            <XCircle className="w-3.5 h-3.5 opacity-80" />
          </div>
          <div className="text-xl font-black mt-0.5">{summary.absent}</div>
          <div className="text-[10px] font-medium opacity-70">Unexplained</div>
        </button>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-white border border-gray-100 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, ITS, or class..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Grade Dropdown */}
          <select
            value={selectedGrade}
            onChange={(e) => onGradeChange(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Grades</option>
            {availableGrades.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>

          {/* Section Dropdown */}
          <select
            value={selectedSection}
            onChange={(e) => onSectionChange(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Sections</option>
            {availableSections.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Stacked Roster Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredRecords.map((r) => {
          const sourceConfig = sourceBadgeConfig[r.source] || sourceBadgeConfig.BIOMETRIC;
          const SourceIcon = sourceConfig.icon;

          return (
            <div
              key={r.studentId}
              className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header row with student info & status */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="w-10 h-10 rounded-xl border border-gray-100 shrink-0">
                      <AvatarImage src={r.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs font-bold bg-emerald-100 text-emerald-800">
                        {getInitials(r.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-gray-900 truncate leading-snug">{r.name}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                        <span>ITS: {r.its || "—"}</span>
                        <span>•</span>
                        <span>Gr {r.grade}-{r.section}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border shrink-0 ${
                      r.status === "PRESENT"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : r.status === "LATE"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : r.status === "MEDICAL"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : r.status === "ON_LEAVE"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {r.status === "PRESENT" && <CheckCircle2 className="w-3 h-3" />}
                    {r.status === "LATE" && <Clock className="w-3 h-3" />}
                    {r.status === "MEDICAL" && <Stethoscope className="w-3 h-3" />}
                    {r.status === "ON_LEAVE" && <FileCheck2 className="w-3 h-3" />}
                    {r.status === "ABSENT" && <XCircle className="w-3 h-3" />}
                    <span>{r.status.replace(/_/g, " ")}</span>
                  </span>
                </div>

                {/* Metadata & Remarks Bar */}
                <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 font-medium">Source:</span>
                    <span className={`font-bold flex items-center gap-1 ${sourceConfig.color}`}>
                      <SourceIcon className="w-3 h-3" />
                      <span>{sourceConfig.label}</span>
                    </span>
                  </div>

                  {r.checkInTime && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 font-medium">Check-in:</span>
                      <span className="font-semibold text-gray-800">
                        {new Date(r.checkInTime).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {r.remarks && (
                    <div className="text-[11px] text-gray-600 line-clamp-1 italic pt-0.5">
                      "{r.remarks}"
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Drawer Button */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>{r.streakDays || 0}d streak</span>
                </div>

                <button
                  type="button"
                  onClick={() => r.studentId && onStudentClick(r.studentId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Audit History</span>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
