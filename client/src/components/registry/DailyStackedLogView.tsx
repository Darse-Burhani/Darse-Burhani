"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Stethoscope,
  FileCheck2,
  Bot,
  UserCheck,
  Search,
  Eye,
  ChevronRight,
  Flame,
  Zap,
  Layers,
  GraduationCap,
  Briefcase,
  Sparkles,
  Activity,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { AttendanceLogRecordItem, AttendanceLogsSummary } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface DailyStackedLogViewProps {
  records: AttendanceLogRecordItem[];
  summary: AttendanceLogsSummary;
  talabatSummary?: AttendanceLogsSummary;
  facultySummary?: AttendanceLogsSummary;
  overallSummary?: AttendanceLogsSummary;
  availableGrades: string[];
  availableSections: string[];
  selectedGrade: string;
  selectedSection: string;
  onGradeChange: (grade: string) => void;
  onSectionChange: (section: string) => void;
  onMemberClick: (memberId: string, role: "STUDENT" | "FACULTY") => void;
  audience: "STUDENT" | "FACULTY" | "ALL";
  livePulse?: boolean;
  lastUpdatedAt?: string | null;
}

type TabType = "ALL" | "PRESENT" | "LATE" | "MEDICAL" | "ON_LEAVE" | "ABSENT" | "NOT_MARKED";

const sourceBadgeConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  SCAN: { label: "Live Scan", icon: Zap, color: "text-emerald-700" },
  BIOMETRIC: { label: "Live Scan", icon: Zap, color: "text-emerald-700" },
  MANUAL: { label: "Manual", icon: UserCheck, color: "text-blue-700" },
  AUTO_ABSENT: { label: "Auto Absent", icon: Bot, color: "text-rose-700" },
  MEDICAL_LEAVE: { label: "Medical", icon: Stethoscope, color: "text-rose-700" },
  LEAVE_APPROVED: { label: "Leave", icon: FileCheck2, color: "text-amber-700" },
};

// Animated number with live pulse
function LiveNumber({ value, pulsing }: { value: number; pulsing?: boolean }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className={`inline-block tabular-nums ${pulsing ? "text-emerald-600" : ""}`}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

function MetricCard({
  active,
  onClick,
  label,
  value,
  sub,
  icon: Icon,
  activeClass,
  inactiveClass,
  pulsing,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  activeClass: string;
  inactiveClass: string;
  pulsing?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden p-3.5 rounded-[16px] border text-left transition-all duration-200 cursor-pointer group ${
        active ? activeClass : inactiveClass
      } ${pulsing ? "ring-2 ring-emerald-400/40" : ""}`}
    >
      {pulsing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 }}
          className="absolute inset-0 bg-emerald-500 pointer-events-none"
        />
      )}
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">{label}</span>
        <span
          className={`w-6 h-6 rounded-lg flex items-center justify-center ${active ? "bg-white/20" : "bg-gray-100 group-hover:bg-gray-200"}`}
        >
          <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-gray-500"}`} />
        </span>
      </div>
      <div className="relative text-[20px] font-black tracking-tight mt-1 leading-none">
        <LiveNumber value={value} pulsing={pulsing} />
      </div>
      <div className="relative text-[10px] font-semibold opacity-60 mt-1 truncate">{sub}</div>
      {pulsing && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
    </button>
  );
}

export function DailyStackedLogView({
  records,
  summary,
  talabatSummary,
  facultySummary,
  overallSummary,
  availableGrades,
  availableSections,
  selectedGrade,
  selectedSection,
  onGradeChange,
  onSectionChange,
  onMemberClick,
  audience,
  livePulse,
  lastUpdatedAt,
}: DailyStackedLogViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [search, setSearch] = useState("");
  const [prevSummary, setPrevSummary] = useState<AttendanceLogsSummary | null>(null);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());

  // Detect which numbers changed for pulse animation
  useEffect(() => {
    if (!prevSummary) {
      setPrevSummary(summary);
      return;
    }
    const keys: (keyof AttendanceLogsSummary)[] = ["total", "present", "late", "absent", "medical", "onLeave", "notMarked"];
    const changed = new Set<string>();
    for (const k of keys) {
      if ((summary as any)[k] !== (prevSummary as any)[k]) changed.add(k as string);
    }
    if (changed.size > 0) {
      setChangedKeys(changed);
      setTimeout(() => setChangedKeys(new Set()), 1200);
    }
    setPrevSummary(summary);
  }, [summary]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (activeTab === "PRESENT" && r.status !== "PRESENT") return false;
      if (activeTab === "LATE" && r.status !== "LATE") return false;
      if (activeTab === "MEDICAL" && r.status !== "MEDICAL") return false;
      if (activeTab === "ON_LEAVE" && r.status !== "ON_LEAVE") return false;
      if (activeTab === "ABSENT" && r.status !== "ABSENT") return false;
      if (activeTab === "NOT_MARKED" && r.status !== "NOT_MARKED") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesIts = r.its?.toLowerCase().includes(q);
        const matchesClass = r.designationOrClass?.toLowerCase().includes(q) || r.className?.toLowerCase().includes(q);
        if (!matchesName && !matchesIts && !matchesClass) return false;
      }
      return true;
    });
  }, [records, activeTab, search]);

  const pct = (n: number) => (summary.total > 0 ? Math.round((n / summary.total) * 100) : 0);

  return (
    <div className="space-y-4">
      {/* Live Audience Split — shows proper Talabat vs Faculty numbers when ALL */}
      {audience === "ALL" && talabatSummary && facultySummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-[16px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </span>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-900">Talabat Live</div>
                <div className="text-[11px] text-emerald-700 font-medium">{talabatSummary.present} present • {talabatSummary.late} late • {talabatSummary.absent} absent</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-emerald-900 tabular-nums">{talabatSummary.total}</div>
              <div className="text-[10px] font-bold text-emerald-700">roster</div>
            </div>
          </div>
          <div className="rounded-[16px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </span>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-900">Faculty Live</div>
                <div className="text-[11px] text-indigo-700 font-medium">{facultySummary.present} present • {facultySummary.late} late • {facultySummary.absent} absent</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-indigo-900 tabular-nums">{facultySummary.total}</div>
              <div className="text-[10px] font-bold text-indigo-700">staff</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        <MetricCard
          active={activeTab === "ALL"}
          onClick={() => setActiveTab("ALL")}
          label="Total Live"
          value={summary.total}
          sub={`${pct(summary.present + summary.late)}% marked • live`}
          icon={Layers}
          activeClass="bg-gray-900 text-white border-gray-900 shadow-lg"
          inactiveClass="bg-white text-gray-900 border-gray-200 hover:border-gray-300 hover:shadow-sm"
          pulsing={changedKeys.has("total") || livePulse}
        />
        <MetricCard
          active={activeTab === "PRESENT"}
          onClick={() => setActiveTab("PRESENT")}
          label="Present"
          value={summary.present}
          sub={`${pct(summary.present)}% on-time`}
          icon={CheckCircle2}
          activeClass="bg-emerald-600 text-white border-emerald-600 shadow-lg"
          inactiveClass="bg-white text-emerald-800 border-gray-200 hover:border-emerald-200 hover:shadow-sm"
          pulsing={changedKeys.has("present")}
        />
        <MetricCard
          active={activeTab === "LATE"}
          onClick={() => setActiveTab("LATE")}
          label="Late"
          value={summary.late}
          sub="Grace window"
          icon={Clock}
          activeClass="bg-amber-500 text-white border-amber-500 shadow-lg"
          inactiveClass="bg-white text-amber-800 border-gray-200 hover:border-amber-200"
          pulsing={changedKeys.has("late")}
        />
        <MetricCard
          active={activeTab === "ABSENT"}
          onClick={() => setActiveTab("ABSENT")}
          label="Absent"
          value={summary.absent}
          sub={`${pct(summary.absent)}% absent`}
          icon={XCircle}
          activeClass="bg-red-600 text-white border-red-600 shadow-lg"
          inactiveClass="bg-white text-red-800 border-gray-200 hover:border-red-200"
          pulsing={changedKeys.has("absent")}
        />
        <MetricCard
          active={activeTab === "NOT_MARKED"}
          onClick={() => setActiveTab("NOT_MARKED")}
          label="Not Marked"
          value={summary.notMarked}
          sub="Pending scan"
          icon={Timer}
          activeClass="bg-slate-700 text-white border-slate-700 shadow-lg"
          inactiveClass="bg-white text-slate-700 border-gray-200 hover:border-slate-200"
          pulsing={changedKeys.has("notMarked")}
        />
        <MetricCard
          active={activeTab === "MEDICAL"}
          onClick={() => setActiveTab("MEDICAL")}
          label="Medical"
          value={summary.medical}
          sub="Sick leave"
          icon={Stethoscope}
          activeClass="bg-rose-600 text-white border-rose-600 shadow-lg"
          inactiveClass="bg-white text-rose-800 border-gray-200 hover:border-rose-200"
          pulsing={changedKeys.has("medical")}
        />
        <MetricCard
          active={activeTab === "ON_LEAVE"}
          onClick={() => setActiveTab("ON_LEAVE")}
          label="On Leave"
          value={summary.onLeave}
          sub="Approved"
          icon={FileCheck2}
          activeClass="bg-purple-600 text-white border-purple-600 shadow-lg"
          inactiveClass="bg-white text-purple-800 border-gray-200 hover:border-purple-200"
          pulsing={changedKeys.has("onLeave")}
        />
      </div>

      {/* Source breakdown + live stamp */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
          <Zap className="w-3 h-3" /> Scanned: {summary.sources.scanned}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-bold">
          <UserCheck className="w-3 h-3" /> Manual: {summary.sources.manual}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-bold">
          <Bot className="w-3 h-3" /> Auto: {summary.sources.autoAbsent}
        </span>
        {lastUpdatedAt && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-900 text-white font-semibold">
            <Activity className={`w-3 h-3 ${livePulse ? "animate-pulse text-emerald-400" : "text-gray-400"}`} />
            Live • {new Date(lastUpdatedAt).toLocaleTimeString()} IST
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-[16px] bg-white border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ITS / ID, or class… (live filter)"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
          />
          {search && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {filteredRecords.length} matches
            </span>
          )}
        </div>
        {audience !== "FACULTY" && availableGrades.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedGrade}
              onChange={(e) => onGradeChange(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Grades</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
            <select
              value={selectedSection}
              onChange={(e) => onSectionChange(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cards */}
      <AnimatePresence mode="popLayout">
        {filteredRecords.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-14 text-center rounded-[16px] bg-white border border-dashed border-gray-200 flex flex-col items-center justify-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-gray-400" />
            </div>
            <div className="text-xs font-bold text-gray-700">No matching records — try another filter</div>
            <div className="text-[11px] text-gray-400 mt-1">Live stream is active; new scans appear instantly when they arrive.</div>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredRecords.map((r) => {
              const cfg = sourceBadgeConfig[r.source] || sourceBadgeConfig.SCAN;
              const SourceIcon = cfg.icon;
              const isFaculty = r.role === "FACULTY";
              return (
                <motion.div
                  key={r.id || r.memberId}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className={`group relative rounded-2xl p-1.5 transition-all duration-300 ${
                    isFaculty
                      ? "bg-gradient-to-b from-indigo-100/70 via-indigo-50/40 to-slate-100 hover:shadow-lg hover:shadow-indigo-500/10"
                      : "bg-gradient-to-b from-emerald-100/70 via-emerald-50/40 to-slate-100 hover:shadow-lg hover:shadow-emerald-500/10"
                  }`}
                >
                  <div className="rounded-[calc(1rem-0.125rem)] bg-white p-3.5 shadow-xs border border-white/80 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-start justify-between gap-2.5 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-10 h-10 rounded-xl border border-gray-100 shrink-0 shadow-xs">
                            <AvatarImage src={r.avatarUrl || undefined} />
                            <AvatarFallback className={`text-xs font-black ${isFaculty ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"}`}>
                              {getInitials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-extrabold text-xs text-gray-950 truncate flex items-center gap-1.5">
                              <span className="truncate">{r.name}</span>
                              {isFaculty && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Staff
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
                              {r.its ? <span className="font-mono font-bold text-gray-700">{r.its}</span> : "—"} • {r.designationOrClass}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border shrink-0 tracking-wide ${
                            r.status === "PRESENT"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : r.status === "LATE"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : r.status === "MEDICAL"
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : r.status === "ON_LEAVE"
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : r.status === "NOT_MARKED"
                              ? "bg-slate-100 text-slate-700 border-slate-200"
                              : "bg-red-50 text-red-800 border-red-200"
                          }`}
                        >
                          {r.status === "PRESENT" && <CheckCircle2 className="w-3 h-3" />}
                          {r.status === "LATE" && <Clock className="w-3 h-3" />}
                          {r.status === "MEDICAL" && <Stethoscope className="w-3 h-3" />}
                          {r.status === "ON_LEAVE" && <FileCheck2 className="w-3 h-3" />}
                          {r.status === "ABSENT" && <XCircle className="w-3 h-3" />}
                          {r.status === "NOT_MARKED" && <Timer className="w-3 h-3" />}
                          <span>{r.status.replace(/_/g, " ")}</span>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-gray-50/90 border border-gray-100 text-xs space-y-1.5">
                        {r.scheduledEvent && (
                          <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-gray-200/60">
                            <span className="text-gray-500 font-semibold">Event Window</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-[10px] border ${isFaculty ? "bg-indigo-50 text-indigo-900 border-indigo-200" : "bg-emerald-50 text-emerald-900 border-emerald-200"}`}>
                              <Sparkles className={`w-2.5 h-2.5 ${isFaculty ? "text-indigo-600" : "text-emerald-600"}`} />
                              {r.scheduledEvent.name}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-semibold">Method / Source</span>
                          <span className={`font-black flex items-center gap-1 ${cfg.color}`}>
                            <SourceIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        {r.checkInTime ? (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 font-semibold">Scan Timestamp</span>
                            <span className="font-mono font-bold text-gray-900 tabular-nums">
                              {new Date(r.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })} IST
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 font-semibold">Scan Timestamp</span>
                            <span className="font-medium text-gray-400">— not scanned</span>
                          </div>
                        )}
                        {r.remarks && (
                          <div className="text-[11px] text-gray-700 italic bg-white/80 p-1.5 rounded-lg border border-gray-200/60 line-clamp-2">
                            “{r.remarks}”
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      {r.role === "STUDENT" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700">
                          <Flame className="w-3.5 h-3.5 text-amber-500" /> {r.streakDays || 0}d streak
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700">
                          <Briefcase className="w-3.5 h-3.5" /> Staff
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onMemberClick(r.memberId || (r as any).studentId, r.role || "STUDENT")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black text-gray-700 hover:text-emerald-800 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer group-hover:border-gray-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Audit Log
                        <ChevronRight className="w-3 h-3 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
