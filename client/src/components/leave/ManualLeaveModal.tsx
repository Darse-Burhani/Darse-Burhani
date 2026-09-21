"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Stethoscope,
  User,
  HeartPulse,
  FileText,
  Search,
  CheckCircle2,
  Loader2,
  AlertCircle,
  GraduationCap,
  Users,
  ShieldCheck,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/toast";

interface RosterStudent {
  id: string;
  name: string;
  studentId: string;
  its: string;
  grade: string;
  section: string;
  className: string;
  avatarUrl?: string | null;
}

interface RosterTeacher {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  avatarUrl?: string | null;
}

interface ManualLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}

const leaveCategories = [
  {
    type: "MEDICAL",
    label: "Medical / Sick Leave",
    icon: Stethoscope,
    description: "Illness, medical consultations, recovery",
    color: "text-rose-600 bg-rose-50 border-rose-200 hover:border-rose-300",
    badge: "Excused on Biometrics",
  },
  {
    type: "PERSONAL",
    label: "Personal Leave",
    icon: User,
    description: "Personal or family obligations",
    color: "text-blue-600 bg-blue-50 border-blue-200 hover:border-blue-300",
    badge: "Excused",
  },
  {
    type: "FAMILY_EMERGENCY",
    label: "Family Emergency",
    icon: HeartPulse,
    description: "Urgent family situations or bereavement",
    color: "text-amber-600 bg-amber-50 border-amber-200 hover:border-amber-300",
    badge: "Urgent",
  },
  {
    type: "OTHER",
    label: "Official Duty / Other",
    icon: FileText,
    description: "School representation, official duty, or travel",
    color: "text-purple-600 bg-purple-50 border-purple-200 hover:border-purple-300",
    badge: "Official",
  },
];

export function ManualLeaveModal({
  isOpen,
  onClose,
  onSuccess,
  isAdmin = true,
}: ManualLeaveModalProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [selectedStudent, setSelectedStudent] = useState<RosterStudent | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<RosterTeacher | null>(null);

  // Roster lists
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [teachers, setTeachers] = useState<RosterTeacher[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Leave Form Fields
  const [category, setCategory] = useState<string>("MEDICAL");
  const [isSingleDay, setIsSingleDay] = useState(false);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Roster when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setLoadingRoster(true);
    const endpoint = isAdmin ? "/api/admin/leave/roster" : "/api/teacher/leave/roster";

    fetch(endpoint)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setStudents(res.data.students || []);
          setTeachers(res.data.teachers || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load roster for manual leave:", err);
      })
      .finally(() => {
        setLoadingRoster(false);
      });
  }, [isOpen, isAdmin]);

  // Handle single day sync
  useEffect(() => {
    if (isSingleDay) {
      setEndDate(startDate);
    }
  }, [isSingleDay, startDate]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students.slice(0, 15);
    const q = searchQuery.toLowerCase().trim();
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.its.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q) ||
          `grade ${s.grade}`.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [students, searchQuery]);

  // Filtered Teachers
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers.slice(0, 15);
    const q = searchQuery.toLowerCase().trim();
    return teachers
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.employeeId.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [teachers, searchQuery]);

  // Duration in days
  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === "STUDENT" && !selectedStudent) {
      setError("Please select a student to record leave for.");
      return;
    }

    if (role === "TEACHER" && !selectedTeacher) {
      setError("Please select a faculty member to record leave for.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Please specify valid start and end dates.");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a reason or explanation for this leave.");
      return;
    }

    setSubmitting(true);

    try {
      const endpoint = isAdmin ? "/api/admin/leave/manual" : "/api/teacher/leave/manual";
      const payload: any = {
        role,
        studentId: role === "STUDENT" ? selectedStudent?.id : undefined,
        teacherId: role === "TEACHER" ? selectedTeacher?.id : undefined,
        type: category,
        startDate,
        endDate: isSingleDay ? startDate : endDate,
        reason: reason.trim(),
        notes: adminNotes.trim() || undefined,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to record manual leave.");
      }

      toast({
        title: "Leave Recorded & Approved",
        description: `Leave recorded for ${role === "STUDENT" ? selectedStudent?.name : selectedTeacher?.name}. Attendance records updated.`,
      });

      // Reset Form
      setSelectedStudent(null);
      setSelectedTeacher(null);
      setReason("");
      setAdminNotes("");
      setSearchQuery("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while saving the leave.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-8"
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Record Manual Leave</h2>
                <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Auto-Approved
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Directly excusing learners or faculty from biometric scans and attendance registers
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Form Body ── */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── 1. Target Role Tabs (Admin only) ── */}
          {isAdmin && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                1. Select Recipient Role
              </label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100/80 rounded-2xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setRole("STUDENT");
                    setSelectedTeacher(null);
                    setSearchQuery("");
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                    role === "STUDENT"
                      ? "bg-white text-emerald-950 shadow-sm border border-emerald-500/20"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <GraduationCap className={`w-4 h-4 ${role === "STUDENT" ? "text-emerald-600" : ""}`} />
                  <span>Talabat (Student)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("TEACHER");
                    setSelectedStudent(null);
                    setSearchQuery("");
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                    role === "TEACHER"
                      ? "bg-white text-purple-950 shadow-sm border border-purple-500/20"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Users className={`w-4 h-4 ${role === "TEACHER" ? "text-purple-600" : ""}`} />
                  <span>Faculty (Teacher/Staff)</span>
                </button>
              </div>
            </div>
          )}

          {/* ── 2. Person Selector ── */}
          <div className="space-y-2" ref={dropdownRef}>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span>2. Select {role === "STUDENT" ? "Student" : "Faculty Member"}</span>
              {loadingRoster && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
            </label>

            {/* Selected pill */}
            {role === "STUDENT" && selectedStudent ? (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-200/70 text-emerald-900 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                    {selectedStudent.avatarUrl ? (
                      <img src={selectedStudent.avatarUrl} alt={selectedStudent.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedStudent.name.slice(0, 2)
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">{selectedStudent.name}</h4>
                    <p className="text-xs text-emerald-700 font-medium">
                      Grade {selectedStudent.grade}-{selectedStudent.section} • ITS: {selectedStudent.its}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-200/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : role === "TEACHER" && selectedTeacher ? (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-200/70 text-purple-900 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                    {selectedTeacher.avatarUrl ? (
                      <img src={selectedTeacher.avatarUrl} alt={selectedTeacher.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedTeacher.name.slice(0, 2)
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-purple-950">{selectedTeacher.name}</h4>
                    <p className="text-xs text-purple-700 font-medium">
                      {selectedTeacher.department} • Emp ID: {selectedTeacher.employeeId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTeacher(null)}
                  className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-200/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchDropdownOpen(true);
                    }}
                    onFocus={() => setSearchDropdownOpen(true)}
                    placeholder={
                      role === "STUDENT"
                        ? "Search student by name, ITS, or grade (e.g. Murtaza, 30349542)..."
                        : "Search faculty by name or employee ID..."
                    }
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                {/* Dropdown list */}
                {searchDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl z-30 max-h-56 overflow-y-auto p-1.5 space-y-1">
                    {role === "STUDENT" ? (
                      filteredStudents.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-400">No matching students found</div>
                      ) : (
                        filteredStudents.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudent(s);
                              setSearchDropdownOpen(false);
                              setSearchQuery("");
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-left transition-colors group"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs">
                                {s.name.slice(0, 2)}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-gray-900 group-hover:text-emerald-950">
                                  {s.name}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  Grade {s.grade}-{s.section} • ITS: {s.its}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Select
                            </span>
                          </button>
                        ))
                      )
                    ) : filteredTeachers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">No matching faculty found</div>
                    ) : (
                      filteredTeachers.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTeacher(t);
                            setSearchDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-left transition-colors group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs">
                              {t.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-900 group-hover:text-purple-950">
                                {t.name}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {t.department} • Emp ID: {t.employeeId}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Select
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 3. Category Selector ── */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              3. Select Leave Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {leaveCategories.map((c) => {
                const isSelected = category === c.type;
                const Icon = c.icon;
                return (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => setCategory(c.type)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/30"
                        : "bg-white border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-gray-500"}`} />
                        <span className="text-xs font-bold">{c.label}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          isSelected ? "bg-emerald-500 text-slate-950" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.badge}
                      </span>
                    </div>
                    <p className={`text-[11px] ${isSelected ? "text-slate-300" : "text-gray-500"}`}>
                      {c.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 4. Date Selection ── */}
          <div className="space-y-3 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                4. Schedule Dates
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleDay(false)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                    !isSingleDay ? "bg-white text-gray-900 shadow-xs border border-gray-200" : "text-gray-500"
                  }`}
                >
                  Date Range
                </button>
                <button
                  type="button"
                  onClick={() => setIsSingleDay(true)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                    isSingleDay ? "bg-white text-gray-900 shadow-xs border border-gray-200" : "text-gray-500"
                  }`}
                >
                  Single Day
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-gray-500">
                  {isSingleDay ? "Leave Date" : "Start Date"}
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {!isSingleDay && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-500">End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60">
              <span>Total Duration:</span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-[11px]">
                {durationDays} {durationDays === 1 ? "Day" : "Days"}
              </span>
            </div>
          </div>

          {/* ── 5. Reason & Notes ── */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                5. Reason / Symptoms / Notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason (e.g. Doctor appointment, fever and rest advised, family function, visa processing)..."
                className="w-full p-3 rounded-2xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500">
                Administrative Approval Remark (Optional)
              </label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g. Verified with parent on phone / Approved by Principal"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* ── Submit Action ── */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Recording Leave...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorize & Record Leave</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
