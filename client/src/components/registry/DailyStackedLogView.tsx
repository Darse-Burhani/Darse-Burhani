"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Stethoscope,
  FileCheck2,
  UserCheck,
  Search,
  Eye,
  ChevronRight,
  Flame,
  Zap,
  Layers,
  GraduationCap,
  Briefcase,
  Timer,
  AlertTriangle,
  Table as TableIcon,
  LayoutGrid,
  Fingerprint,
  ClipboardCheck,
  Moon,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { AttendanceLogRecordItem, AttendanceLogsSummary } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { getHijriFromDate } from "@/lib/fatimi-calendar";

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
  selectedDate?: string;
  onGradeChange: (grade: string) => void;
  onSectionChange: (section: string) => void;
  onMemberClick: (memberId: string, role: "STUDENT" | "FACULTY") => void;
  onQuickMark?: (
    memberId: string,
    role: "STUDENT" | "FACULTY",
    status: "PRESENT" | "LATE" | "ABSENT" | "MEDICAL" | "ON_LEAVE"
  ) => Promise<void>;
  audience: "STUDENT" | "FACULTY" | "ALL";
  livePulse?: boolean;
  lastUpdatedAt?: string | null;
  logType?: "HIKVISION" | "MANUAL" | "ALL";
}

type TabType = "ALL" | "PRESENT" | "LATE" | "MEDICAL" | "ON_LEAVE" | "ABSENT" | "NOT_MARKED";

function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "PRESENT":
      return {
        label: "PRESENT",
        icon: CheckCircle2,
        className: "bg-emerald-50 text-emerald-800 border-emerald-300",
      };
    case "LATE":
      return {
        label: "LATE",
        icon: Clock,
        className: "bg-amber-50 text-amber-800 border-amber-300",
      };
    case "ABSENT":
      return {
        label: "ABSENT",
        icon: XCircle,
        className: "bg-red-50 text-red-800 border-red-300",
      };
    case "ON_LEAVE":
      return {
        label: "LEAVE",
        icon: FileCheck2,
        className: "bg-purple-50 text-purple-800 border-purple-300",
      };
    case "MEDICAL":
      return {
        label: "MEDICAL",
        icon: Stethoscope,
        className: "bg-rose-50 text-rose-800 border-rose-300",
      };
    case "HOLIDAY":
      return {
        label: "HOLIDAY",
        icon: CalendarDays,
        className: "bg-amber-50 text-amber-900 border-amber-300",
      };
    case "NOT_MARKED":
    default:
      return {
        label: "NOT MARKED",
        icon: Timer,
        className: "bg-slate-100 text-slate-700 border-slate-300",
      };
  }
}

function formatScanTimeIST(timeStr?: string | Date | null): string {
  if (!timeStr) return "—";
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

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

// Sub-component: Spreadsheet Table for a specific role
function AttendanceTableView({
  records,
  role,
  onMemberClick,
  onQuickMark,
  logType,
  selectedDate,
}: {
  records: AttendanceLogRecordItem[];
  role: "STUDENT" | "FACULTY";
  onMemberClick: (memberId: string, role: "STUDENT" | "FACULTY") => void;
  onQuickMark?: (
    memberId: string,
    role: "STUDENT" | "FACULTY",
    status: "PRESENT" | "LATE" | "ABSENT" | "MEDICAL" | "ON_LEAVE"
  ) => Promise<void>;
  logType?: "HIKVISION" | "MANUAL" | "ALL";
  selectedDate?: string;
}) {
  const isFaculty = role === "FACULTY";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className={`text-white font-bold text-[11px] tracking-wide uppercase border-b ${isFaculty ? "bg-slate-900 border-indigo-950" : "bg-slate-900 border-emerald-950"}`}>
            <tr>
              <th scope="col" className="px-3.5 py-3 text-center w-12">Photo</th>
              <th scope="col" className="px-4 py-3">{isFaculty ? "Faculty Member" : "Talib (Student)"}</th>
              <th scope="col" className="px-3 py-3 font-mono">{isFaculty ? "Employee ID" : "ITS / ID"}</th>
              <th scope="col" className="px-3 py-3">{isFaculty ? "Department / Roles" : "Grade & Section"}</th>
              <th scope="col" className="px-3 py-3 text-center">Scan Time (IST)</th>
              <th scope="col" className="px-3 py-3 text-center min-w-[200px]">
                {logType === "MANUAL" ? "Attendance & Quick Roll-Call" : "Attendance Status"}
              </th>
              <th scope="col" className="px-3 py-3">Verification Mode</th>
              <th scope="col" className="px-4 py-3">Notes / Remarks</th>
              <th scope="col" className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium">
            {records.map((r, i) => {
              const isScanned = Boolean(r.source === "SCAN" || r.verificationMethod === "BIOMETRIC" || r.checkInTime);
              const hijri = getHijriFromDate(r.checkInTime || selectedDate);
              const badge = getStatusBadgeConfig(r.status);
              const StatusIcon = badge.icon;
              const targetId = r.memberId || (r as any).studentId || (r as any).id;

              return (
                <tr
                  key={r.id || r.memberId || i}
                  className={`transition-colors hover:bg-slate-50/90 ${
                    isFaculty ? "hover:bg-indigo-50/20" : "hover:bg-emerald-50/20"
                  }`}
                >
                  {/* Profile Photo */}
                  <td className="px-3.5 py-2.5 text-center">
                    <Avatar className="w-9 h-9 mx-auto rounded-xl border border-gray-200 shrink-0 shadow-xs">
                      <AvatarImage src={r.avatarUrl || undefined} />
                      <AvatarFallback
                        className={`text-[10px] font-black ${
                          isFaculty ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {getInitials(r.name)}
                      </AvatarFallback>
                    </Avatar>
                  </td>

                  {/* Name & Role */}
                  <td className="px-4 py-2.5 font-bold text-gray-950">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{r.name}</span>
                      {isFaculty ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          Staff
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Talabat
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ITS / ID */}
                  <td className="px-3 py-2.5 font-mono font-bold text-gray-700">
                    {r.its || "—"}
                  </td>

                  {/* Class / Department */}
                  <td className="px-3 py-2.5 text-gray-600 font-semibold">
                    <div>{r.designationOrClass || "—"}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-slate-600 bg-slate-100 border border-slate-200"
                        title={hijri.formatted}
                      >
                        <Moon className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        <span>{hijri.day} {hijri.monthNameShort}</span>
                      </span>
                    </div>
                  </td>

                  {/* Scan Time (IST) */}
                  <td className="px-3 py-2.5 text-center bg-slate-50/50">
                    {r.checkInTime ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-50 text-emerald-950 border border-emerald-300 font-mono shadow-2xs">
                          <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{formatScanTimeIST(r.checkInTime)}</span>
                        </span>
                        <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
                          {formatRelative(r.checkInTime)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-mono italic">—</span>
                    )}
                  </td>

                  {/* Attendance Status & Inline Roll-Call Selector */}
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-black border tracking-wide shadow-2xs ${badge.className}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                        {r.isDefaultPresent && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300"
                            title="Default Present: automatically marked present for roll-call"
                          >
                            Default
                          </span>
                        )}
                      </div>

                      {/* Quick Status Buttons (P / L / A / M / Leave) */}
                      {onQuickMark && (
                        <div className="inline-flex items-center gap-1 mt-1 p-0.5 rounded-lg bg-slate-100/80 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => onQuickMark(targetId, role, "PRESENT")}
                            title="Mark Present"
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black transition-all ${
                              r.status === "PRESENT"
                                ? "bg-emerald-600 text-white shadow-xs scale-105"
                                : "text-emerald-800 hover:bg-emerald-100"
                            }`}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickMark(targetId, role, "LATE")}
                            title="Mark Late"
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black transition-all ${
                              r.status === "LATE"
                                ? "bg-amber-500 text-white shadow-xs scale-105"
                                : "text-amber-800 hover:bg-amber-100"
                            }`}
                          >
                            L
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickMark(targetId, role, "ABSENT")}
                            title="Mark Absent"
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black transition-all ${
                              r.status === "ABSENT"
                                ? "bg-red-600 text-white shadow-xs scale-105"
                                : "text-red-800 hover:bg-red-100"
                            }`}
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickMark(targetId, role, "MEDICAL")}
                            title="Mark Medical"
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black transition-all ${
                              r.status === "MEDICAL"
                                ? "bg-rose-600 text-white shadow-xs scale-105"
                                : "text-rose-800 hover:bg-rose-100"
                            }`}
                          >
                            M
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickMark(targetId, role, "ON_LEAVE")}
                            title="Mark On Leave"
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black transition-all ${
                              r.status === "ON_LEAVE"
                                ? "bg-purple-600 text-white shadow-xs scale-105"
                                : "text-purple-800 hover:bg-purple-100"
                            }`}
                          >
                            Leave
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Verification Mode */}
                  <td className="px-3 py-2.5 text-xs">
                    {r.status === "ON_LEAVE" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                        <FileCheck2 className="w-3 h-3 text-purple-600" />
                        Approved Leave
                      </span>
                    ) : r.status === "MEDICAL" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-900 border border-rose-200">
                        <Stethoscope className="w-3 h-3 text-rose-600" />
                        Medical Duty
                      </span>
                    ) : (r.status as string) === "HOLIDAY" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        <CalendarDays className="w-3 h-3 text-amber-600" />
                        Sunday Holiday
                      </span>
                    ) : isScanned && r.verificationMethod !== "MANUAL" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100/80 text-emerald-950 border border-emerald-300">
                        <Fingerprint className="w-3 h-3 text-emerald-700" />
                        MinMoe Device Scan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-200">
                        <ClipboardCheck className="w-3 h-3 text-blue-600" />
                        {r.source === "AUTO_ABSENT" ? "Auto-System" : "Manual Register"}
                      </span>
                    )}
                  </td>

                  {/* Notes / Leave Reason */}
                  <td className="px-4 py-2.5 text-gray-600 max-w-[260px] truncate">
                    {r.remarks ? (
                      <span className="italic text-gray-800 font-medium">“{r.remarks}”</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onMemberClick(targetId, r.role || "STUDENT")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        isFaculty
                          ? "text-indigo-900 bg-indigo-50/50 hover:bg-indigo-100 border-indigo-200"
                          : "text-emerald-900 bg-emerald-50/50 hover:bg-emerald-100 border-emerald-200"
                      }`}
                    >
                      <Eye className={`w-3.5 h-3.5 ${isFaculty ? "text-indigo-600" : "text-emerald-600"}`} />
                      <span>Audit</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Sub-component: Bento Card Grid for a specific role
function AttendanceGridView({
  records,
  role,
  onMemberClick,
  onQuickMark,
  selectedDate,
}: {
  records: AttendanceLogRecordItem[];
  role: "STUDENT" | "FACULTY";
  onMemberClick: (memberId: string, role: "STUDENT" | "FACULTY") => void;
  onQuickMark?: (
    memberId: string,
    role: "STUDENT" | "FACULTY",
    status: "PRESENT" | "LATE" | "ABSENT" | "MEDICAL" | "ON_LEAVE"
  ) => Promise<void>;
  selectedDate?: string;
}) {
  const isFaculty = role === "FACULTY";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
      {records.map((r) => {
        const hijri = getHijriFromDate(r.checkInTime || selectedDate);
        const targetId = r.memberId || (r as any).studentId || (r as any).id;
        const badge = getStatusBadgeConfig(r.status);
        const BadgeIcon = badge.icon;

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

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wide ${badge.className}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>
                    {r.isDefaultPresent && (
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                        Default
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Inline Status Changer for Grid */}
                {onQuickMark && (
                  <div className="mb-2 p-1 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 pl-1">Mark:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onQuickMark(targetId, role, "PRESENT")}
                        className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                          r.status === "PRESENT" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickMark(targetId, role, "LATE")}
                        className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                          r.status === "LATE" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        Late
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickMark(targetId, role, "ABSENT")}
                        className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                          r.status === "ABSENT" ? "bg-red-600 text-white shadow-2xs" : "text-red-800 hover:bg-red-100"
                        }`}
                      >
                        Absent
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickMark(targetId, role, "MEDICAL")}
                        className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                          r.status === "MEDICAL" ? "bg-rose-600 text-white shadow-2xs" : "text-rose-800 hover:bg-rose-100"
                        }`}
                      >
                        Med
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickMark(targetId, role, "ON_LEAVE")}
                        className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                          r.status === "ON_LEAVE" ? "bg-purple-600 text-white shadow-2xs" : "text-purple-800 hover:bg-purple-100"
                        }`}
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {(() => {
                    const isScanned = Boolean(r.source === "SCAN" || r.verificationMethod === "BIOMETRIC" || r.checkInTime);
                    const verificationLabel =
                      r.status === "ON_LEAVE"
                        ? "Approved Leave"
                        : r.status === "MEDICAL"
                        ? "Medical Duty"
                        : (r.status as string) === "HOLIDAY"
                        ? "Sunday Holiday"
                        : isScanned && r.verificationMethod !== "MANUAL"
                        ? "MinMoe Device Scan"
                        : "Manual Register";

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-semibold">Verification Mode</span>
                          <span className="font-bold text-gray-800 text-[11px]">
                            {verificationLabel}
                          </span>
                        </div>

                        {/* Hijri Day */}
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-gray-100/80">
                          <span className="text-gray-400 flex items-center gap-1 font-semibold">
                            <Moon className="w-2.5 h-2.5 text-emerald-600" /> Hijri Day
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-slate-700 bg-slate-100 border border-slate-200">
                            <span>{hijri.day} {hijri.monthNameShort}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })()}
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
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" /> Talib
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700">
                    <Briefcase className="w-3.5 h-3.5" /> Staff
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onMemberClick(targetId, r.role || "STUDENT")}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer group-hover:border-gray-200 border ${
                    isFaculty
                      ? "text-indigo-900 hover:bg-indigo-50 border-transparent hover:border-indigo-200"
                      : "text-emerald-900 hover:bg-emerald-50 border-transparent hover:border-emerald-200"
                  }`}
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
    </div>
  );
}

// Sub-component: Distinct Stacked Section Container for Talabat or Faculty
function AttendanceSectionBlock({
  role,
  title,
  subtitle,
  icon: Icon,
  records,
  viewMode,
  onMemberClick,
  onQuickMark,
  logType,
  selectedDate,
}: {
  role: "STUDENT" | "FACULTY";
  title: string;
  subtitle: string;
  icon: React.ElementType;
  records: AttendanceLogRecordItem[];
  viewMode: "table" | "grid";
  onMemberClick: (memberId: string, role: "STUDENT" | "FACULTY") => void;
  onQuickMark?: (
    memberId: string,
    role: "STUDENT" | "FACULTY",
    status: "PRESENT" | "LATE" | "ABSENT" | "MEDICAL" | "ON_LEAVE"
  ) => Promise<void>;
  logType?: "HIKVISION" | "MANUAL" | "ALL";
  selectedDate?: string;
}) {
  const isFaculty = role === "FACULTY";
  const presentCount = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const onTimePct = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;

  return (
    <div className={`rounded-[20px] p-4 border transition-all ${
      isFaculty
        ? "bg-gradient-to-b from-indigo-50/50 via-white to-slate-50/50 border-indigo-200/80 shadow-xs"
        : "bg-gradient-to-b from-emerald-50/50 via-white to-slate-50/50 border-emerald-200/80 shadow-xs"
    } space-y-3.5`}>
      {/* Section Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-gray-200/70">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
            isFaculty ? "bg-indigo-600 shadow-indigo-600/20" : "bg-emerald-600 shadow-emerald-600/20"
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-950 tracking-tight">{title}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isFaculty ? "bg-indigo-100 text-indigo-900 border border-indigo-200" : "bg-emerald-100 text-emerald-900 border border-emerald-200"
              }`}>
                {records.length} {isFaculty ? "Faculty" : "Talabat"}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black border ${
            isFaculty
              ? "bg-indigo-50 text-indigo-800 border-indigo-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}>
            {presentCount}/{records.length} Present ({onTimePct}%)
          </span>
        </div>
      </div>

      {/* Section Content: Table or Grid */}
      {records.length === 0 ? (
        <div className="py-10 text-center rounded-[16px] bg-white/80 border border-dashed border-gray-200 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-2">
            <AlertTriangle className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-xs font-bold text-gray-700">
            No matching {isFaculty ? "faculty" : "student"} records found for current filters
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {logType === "HIKVISION" ? "Awaiting card scans from Hikvision terminals." : "Try adjusting status or search filters above."}
          </div>
        </div>
      ) : viewMode === "table" ? (
        <AttendanceTableView
          records={records}
          role={role}
          onMemberClick={onMemberClick}
          onQuickMark={onQuickMark}
          logType={logType}
          selectedDate={selectedDate}
        />
      ) : (
        <AttendanceGridView
          records={records}
          role={role}
          onMemberClick={onMemberClick}
          onQuickMark={onQuickMark}
          selectedDate={selectedDate}
        />
      )}
    </div>
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
  selectedDate,
  onGradeChange,
  onSectionChange,
  onMemberClick,
  onQuickMark,
  audience,
  livePulse,
  lastUpdatedAt,
  logType = "ALL",
}: DailyStackedLogViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
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

  const talabatRecords = useMemo(() => filteredRecords.filter((r) => r.role === "STUDENT"), [filteredRecords]);
  const facultyRecords = useMemo(() => filteredRecords.filter((r) => r.role === "FACULTY"), [filteredRecords]);

  const pct = (n: number) => (summary.total > 0 ? Math.round((n / summary.total) * 100) : 0);

  return (
    <div className="space-y-4">
      {/* ── Strict Subsystem Mode Notification Banner ── */}
      {logType === "HIKVISION" && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-emerald-900/90 border border-emerald-500/30 text-white flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xs font-black text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                Part 1: Hikvision Biometric Device Scan Stream
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">Live Hardware</span>
              </p>
              <p className="text-[11px] text-emerald-100/70">
                Displaying RFID card swipes, biometric facial scans, and terminal logs matched to scheduled event windows.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-black/30 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            <Fingerprint className="w-3.5 h-3.5" /> Hardware Biometrics Active
          </span>
        </div>
      )}

      {logType === "MANUAL" && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/90 via-indigo-950/80 to-blue-900/90 border border-blue-500/30 text-white flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <UserCheck className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xs font-black text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                Part 2: Manual Classroom Attendance Register
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-amber-400 text-slate-950 font-black">All Default Present</span>
              </p>
              <p className="text-[11px] text-blue-100/90 mt-0.5">
                All students are marked <span className="font-bold text-emerald-300">PRESENT by default</span>. Use the inline buttons (<span className="text-amber-300 font-bold">[P] Present, [L] Late, [A] Absent, [M] Medical, [Leave] Leave</span>) to change any student&apos;s status instantly.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-black/30 px-3 py-1.5 rounded-xl border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> One-Tap Quick Mark
          </span>
        </div>
      )}

      {/* Live Audience Split Banner */}
      {audience === "ALL" && talabatSummary && facultySummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-[16px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </span>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-900">Talabat Register</div>
                <div className="text-[11px] text-emerald-700 font-medium">{talabatSummary.present} present • {talabatSummary.late} late • {talabatSummary.absent} absent</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-emerald-900 tabular-nums">{talabatSummary.total}</div>
              <div className="text-[10px] font-bold text-emerald-700">{logType === "HIKVISION" ? "scans" : "students"}</div>
            </div>
          </div>
          <div className="rounded-[16px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </span>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-900">Faculty Register</div>
                <div className="text-[11px] text-indigo-700 font-medium">{facultySummary.present} present • {facultySummary.late} late • {facultySummary.absent} absent</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-indigo-900 tabular-nums">{facultySummary.total}</div>
              <div className="text-[10px] font-bold text-indigo-700">{logType === "HIKVISION" ? "scans" : "staff"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        <MetricCard
          active={activeTab === "ALL"}
          onClick={() => setActiveTab("ALL")}
          label={logType === "HIKVISION" ? "Total Scans" : logType === "MANUAL" ? "Total Manual" : "Total Logs"}
          value={summary.total}
          sub={logType === "HIKVISION" ? `${summary.total} scans recorded` : `${pct(summary.present + summary.late)}% marked`}
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
          sub={`${pct(summary.present)}% present`}
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
          sub="Late arrival"
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
          sub={logType === "HIKVISION" ? "Unscanned" : "Pending entry"}
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
          sub="Medical duty"
          icon={Stethoscope}
          activeClass="bg-rose-600 text-white border-rose-600 shadow-lg"
          inactiveClass="bg-white text-rose-800 border-gray-200 hover:border-rose-200"
          pulsing={changedKeys.has("medical")}
        />
        <MetricCard
          active={activeTab === "ON_LEAVE"}
          onClick={() => setActiveTab("ON_LEAVE")}
          label="Leave"
          value={summary.onLeave}
          sub="Official approved leave"
          icon={FileCheck2}
          activeClass="bg-purple-600 text-white border-purple-600 shadow-lg"
          inactiveClass="bg-white text-purple-800 border-gray-200 hover:border-purple-200"
          pulsing={changedKeys.has("onLeave")}
        />
      </div>

      {/* Search & Layout Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-[18px] bg-white border border-gray-200 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ITS, Employee ID, or class..."
            className="w-full pl-9 pr-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          {search && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
              {filteredRecords.length} matches
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {audience !== "FACULTY" && availableGrades.length > 0 && (
            <>
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
            </>
          )}

          {/* View Mode Switcher: Table vs Grid */}
          <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-emerald-950 font-black shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Switch to Professional Spreadsheet Table View"
            >
              <TableIcon className="w-3.5 h-3.5 text-emerald-700" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-emerald-950 font-black shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Switch to Bento Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-emerald-700" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Strictly Separated Sections */}
      <div className="space-y-6">
        {/* Talabat Attendance Section */}
        {(audience === "ALL" || audience === "STUDENT") && (
          <AttendanceSectionBlock
            role="STUDENT"
            title="Talabat (Students) Attendance Log"
            subtitle="Student classroom enrollments, biometric check-ins, and excused absences."
            icon={GraduationCap}
            records={talabatRecords}
            viewMode={viewMode}
            onMemberClick={onMemberClick}
            onQuickMark={onQuickMark}
            logType={logType}
            selectedDate={selectedDate}
          />
        )}

        {/* Faculty Attendance Section */}
        {(audience === "ALL" || audience === "FACULTY") && (
          <AttendanceSectionBlock
            role="FACULTY"
            title="Faculty & Staff Attendance Log"
            subtitle="Faculty assembly check-ins, departmental duty scans, and staff attendance records."
            icon={Briefcase}
            records={facultyRecords}
            viewMode={viewMode}
            onMemberClick={onMemberClick}
            onQuickMark={onQuickMark}
            logType={logType}
            selectedDate={selectedDate}
          />
        )}
      </div>
    </div>
  );
}
