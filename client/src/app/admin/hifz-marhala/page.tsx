"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Users,
  BarChart3,
  Target,
  Plus,
  Trash2,
  GraduationCap,
  Tag,
  UserCheck,
  UserPlus,
  X,
  Check,
  ClipboardList,
  GitBranch,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import WeeklySlipsManager from "@/components/hifz/WeeklySlipsManager";
import MarhalaFlowMap from "@/components/hifz/MarhalaFlowMap";
import {
  MARHALA_ORDER,
  MARHALA_LABELS,
  MARHALA_LABELS_SHORT,
  marhalaColor,
  fullName,
  defaultAcademicYear,
} from "@/lib/hifz-marhala";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: "Draft", color: "text-slate-600", bgColor: "bg-slate-100" },
  SUBMITTED: { label: "Submitted", color: "text-blue-700", bgColor: "bg-blue-100" },
  REVIEWED: { label: "Reviewed", color: "text-amber-700", bgColor: "bg-amber-100" },
  APPROVED: { label: "Approved", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  REJECTED: { label: "Rejected", color: "text-red-700", bgColor: "bg-red-100" },
};

// ── Assign Muhaffiz modal ────────────────────────────
function QuickTagModal({
  assignment,
  teachers,
  students,
  onClose,
  onSave,
}: {
  assignment: any;
  teachers: any[];
  students: any[];
  onClose: () => void;
  onSave: (id: string, data: any) => Promise<void>;
}) {
  const [facultyId, setFacultyId] = useState(assignment.facultyId || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(assignment.id, { facultyId, musaidStudentId: null, musaidId: null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const studentName = fullName(assignment.student?.user) || "Student";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl ring-1 ring-black/10 animate-in fade-in-90 slide-in-from-bottom-4 duration-300 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 rounded-xl border border-white/20 shrink-0">
              {assignment.student?.user?.avatarUrl && (
                <AvatarImage src={assignment.student.user.avatarUrl} alt={studentName} className="object-cover" />
              )}
              <AvatarFallback className="bg-amber-400 text-emerald-950 font-bold text-sm">
                {studentName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-white text-sm">Assign Muhaffiz</h3>
              <p className="text-emerald-200/80 text-xs">{studentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100">
            <p className="text-xs text-slate-500">
              Stage: <span className="font-bold text-slate-800">{MARHALA_LABELS[assignment.marhala]}</span>
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                <UserCheck className="w-4 h-4 text-emerald-600" /> Muhaffiz — Primary Teacher
              </label>
              <Select value={facultyId} onValueChange={setFacultyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select muhaffiz..." />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-5 h-5 rounded-full shrink-0">
                          {(t.user?.avatarUrl || t.photoUrl) && (
                            <AvatarImage src={t.user?.avatarUrl || t.photoUrl} alt={fullName(t.user)} className="object-cover" />
                          )}
                          <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                            {fullName(t.user)?.charAt(0) || "T"}
                          </AvatarFallback>
                        </Avatar>
                        <span>{fullName(t.user)}{t.department ? ` — ${t.department}` : ""}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 btn-fatimi-primary" disabled={saving || !facultyId}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Assignment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Student card with Profile Pictures ───────────────────────────────────────────────
function StudentAssignmentCard({
  assignment,
  report,
  onTag,
  onDelete,
}: {
  assignment: any;
  report?: any;
  onTag: (assignment: any) => void;
  onDelete: (id: string) => void;
}) {
  const studentName = fullName(assignment.student?.user) || "Student";
  const muhaffizName = fullName(assignment.faculty?.user) || null;
  const status = report?.status || "DRAFT";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const mColor = marhalaColor(assignment.marhala);

  return (
    <div className="group relative p-4 bg-white rounded-2xl ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.15)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
      {/* Student header — with student profile picture */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-10 h-10 rounded-xl shadow-sm shrink-0 ring-1 ring-black/5">
            {assignment.student?.user?.avatarUrl && (
              <AvatarImage src={assignment.student.user.avatarUrl} alt={studentName} className="object-cover" />
            )}
            <AvatarFallback className={cn("w-full h-full font-bold text-white text-base", mColor.grad)}>
              {studentName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{studentName}</p>
            {assignment.student?.its && (
              <p className="text-[11px] text-slate-400">ITS: {assignment.student.its}</p>
            )}
          </div>
        </div>
        <Badge className={cn(config.bgColor, config.color, "text-[10px] border-0 shrink-0")}>
          {config.label}
        </Badge>
      </div>

      {/* Teacher tags with teacher profile picture */}
      <div className="space-y-1.5 mb-3">
        {muhaffizName ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 rounded-lg ring-1 ring-emerald-100">
            <Avatar className="w-5 h-5 rounded-full shrink-0">
              {(assignment.faculty?.user?.avatarUrl || assignment.faculty?.photoUrl) && (
                <AvatarImage src={assignment.faculty?.user?.avatarUrl || assignment.faculty?.photoUrl} alt={muhaffizName} className="object-cover" />
              )}
              <AvatarFallback className="bg-emerald-200 text-emerald-800 text-[9px] font-bold">
                {muhaffizName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-emerald-800 font-medium truncate">{muhaffizName}</span>
            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] ml-auto shrink-0">Muhaffiz</Badge>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 rounded-lg border border-dashed border-amber-200">
            <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-600">No Muhaffiz yet</span>
          </div>
        )}
      </div>

      {/* Performance */}
      {report && (
        <div className="mb-3 p-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-400">Overall Performance</span>
            <span className={cn("text-xs font-bold tabular-nums", (report.overallPerformance || 0) >= 60 ? "text-emerald-600" : "text-amber-600")}>
              {report.totalMarks || 0}/50 ({report.overallPerformance || 0}%)
            </span>
          </div>
          <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                width: `${report.overallPerformance || 0}%`,
                background: (report.overallPerformance || 0) >= 60
                  ? "linear-gradient(90deg, #059669, #10b981)"
                  : "linear-gradient(90deg, #d97706, #f59e0b)",
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => onTag(assignment)}
        >
          <Tag className="w-3 h-3" />
          {muhaffizName ? "Edit" : "Assign"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-slate-300 hover:text-red-500 hover:bg-red-50"
          onClick={() => onDelete(assignment.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function AdminHifzMarhalaPage() {
  const [data, setData] = useState<{ assignments: any[]; reports: any[]; students: any[]; teachers: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(defaultAcademicYear());
  const [stats, setStats] = useState<any>(null);
  const [activeMarhalaTab, setActiveMarhalaTab] = useState("MARHALA_1");
  const [activeMainTab, setActiveMainTab] = useState("assignments");
  const [tagModalAssignment, setTagModalAssignment] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  // Academic year is fixed to the current year — admins no longer type it in
  const [newAssignment, setNewAssignment] = useState({ studentId: "", marhala: "MARHALA_1", facultyId: "" });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedAcademicYear) params.set("academicYear", selectedAcademicYear);
      const res = await fetch(`/api/admin/hifz-marhala?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [selectedAcademicYear]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAcademicYear) params.set("academicYear", selectedAcademicYear);
      const res = await fetch(`/api/admin/hifz-marhala/stats?${params.toString()}`);
      const result = await res.json();
      if (result.success) setStats(result.data);
    } catch {}
  }, [selectedAcademicYear]);

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [fetchData, fetchStats]);

  const handleAssign = async () => {
    if (!newAssignment.studentId || !newAssignment.facultyId) {
      toast({ title: "Missing fields", description: "Select a talib and a muhaffiz to continue", variant: "destructive" });
      return;
    }
    setSavingStudent(true);
    try {
      const res = await fetch("/api/admin/hifz-marhala/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: [{
            studentId: newAssignment.studentId,
            marhala: newAssignment.marhala,
            facultyId: newAssignment.facultyId,
            musaidId: null,
            musaidStudentId: null,
            academicYear: selectedAcademicYear, // fixed to the page's academic year
          }],
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Talib added", description: "Student assigned to marhala successfully", variant: "success" });
        setShowAddForm(false);
        setNewAssignment({ studentId: "", marhala: "MARHALA_1", facultyId: "" });
        fetchData();
        fetchStats();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Assignment failed", variant: "destructive" });
    } finally {
      setSavingStudent(false);
    }
  };

  const handleQuickTag = async (id: string, payload: any) => {
    try {
      const res = await fetch("/api/admin/hifz-marhala/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Updated", description: "Assignment updated successfully", variant: "success" });
        fetchData();
        fetchStats();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Update failed", variant: "destructive" });
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Remove this talib from the marhala?")) return;
    try {
      const res = await fetch(`/api/admin/hifz-marhala/assign?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Removed", description: "Assignment deleted successfully", variant: "success" });
        fetchData();
        fetchStats();
      }
    } catch {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    }
  };

  // ── Derived data ──
  const filteredAssignments = (data?.assignments || []).filter((a) => {
    const studentName = fullName(a.student?.user).toLowerCase();
    return search === "" || studentName.includes(search.toLowerCase());
  });

  const getReportForStudent = (studentId: string, marhala: string) =>
    data?.reports.find((r) => r.studentId === studentId && r.marhala === marhala);

  const getAssignmentForReport = (report: any) =>
    data?.assignments.find(
      (a) => a.studentId === report.studentId && a.marhala === report.marhala && a.isActive !== false
    );

  const getMarhalaAssignments = (marhala: string) =>
    filteredAssignments.filter((a) => a.marhala === marhala);

  const statsByMarhala = stats?.marhalaStats || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ── */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-950 p-6 sm:p-8 shadow-xl shadow-emerald-900/20">
            <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="absolute -bottom-14 -right-10 w-52 h-52 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-amber-300" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Hifz Marhala Management</h1>
                  <p className="text-sm text-emerald-100/70 mt-1">Assign talabat to the five marhalas and set Muhaffiz / Musa&apos;id</p>
                </div>
              </div>
              <Badge className="bg-white/10 text-emerald-100 border border-white/15 text-xs px-3 py-1.5">
                AY {selectedAcademicYear}
              </Badge>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          </div>
        </div>

        {/* ── Controls bar ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              className="btn-fatimi-primary h-10 rounded-full text-sm shadow-md"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="w-4 h-4" /> Add Student
            </Button>
            <Button variant="outline" size="sm" onClick={() => { fetchData(); fetchStats(); }} disabled={loading} className="h-10 rounded-full">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search hafiz name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 pl-4 h-10 rounded-full border border-slate-200 text-xs shadow-sm w-full sm:w-64 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white"
            />
          </div>
        </div>

        {/* ── Add Student form — streamlined without musaid ── */}
        {showAddForm && (
          <div className="mb-6 p-1.5 rounded-3xl bg-emerald-900/90 ring-1 ring-emerald-950/40 shadow-lg">
            <div className="p-5 rounded-[calc(1.5rem-0.375rem)] bg-emerald-50/95">
              <h3 className="font-bold text-emerald-950 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-emerald-700" />
                </span>
                Add Talib to a Marhala
                <Badge className="bg-emerald-600 text-white border-0 text-[10px] ml-1">AY {selectedAcademicYear}</Badge>
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Talib (Hafiz Name) *</label>
                  <Select value={newAssignment.studentId} onValueChange={(v) => setNewAssignment({ ...newAssignment, studentId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select talib..." />
                    </SelectTrigger>
                    <SelectContent>
                      {data?.students.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-5 h-5 rounded-full shrink-0">
                              {s.user?.avatarUrl && (
                                <AvatarImage src={s.user.avatarUrl} alt={fullName(s.user)} className="object-cover" />
                              )}
                              <AvatarFallback className="bg-amber-100 text-amber-800 text-[9px] font-bold">
                                {fullName(s.user)?.charAt(0) || "S"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{fullName(s.user)}{s.its ? ` — ${s.its}` : ""}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Marhala Stage *</label>
                  <Select value={newAssignment.marhala} onValueChange={(v) => setNewAssignment({ ...newAssignment, marhala: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARHALA_ORDER.map((m) => (
                        <SelectItem key={m} value={m}>{MARHALA_LABELS_SHORT[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Muhaffiz (Primary Teacher) *</label>
                  <Select value={newAssignment.facultyId} onValueChange={(v) => setNewAssignment({ ...newAssignment, facultyId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select muhaffiz..." />
                    </SelectTrigger>
                    <SelectContent>
                      {data?.teachers.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-5 h-5 rounded-full shrink-0">
                              {(t.user?.avatarUrl || t.photoUrl) && (
                                <AvatarImage src={t.user?.avatarUrl || t.photoUrl} alt={fullName(t.user)} className="object-cover" />
                              )}
                              <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                {fullName(t.user)?.charAt(0) || "T"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{fullName(t.user)}{t.department ? ` (${t.department})` : ""}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button onClick={handleAssign} className="btn-fatimi-primary" disabled={savingStudent}>
                  {savingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Assignment
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Marhala stat strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {statsByMarhala.map((s: any) => {
            const color = marhalaColor(s.marhala);
            return (
              <button
                key={s.marhala}
                onClick={() => { setActiveMarhalaTab(s.marhala); setActiveMainTab("assignments"); }}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-md cursor-pointer",
                  color.soft, color.softBorder,
                  activeMarhalaTab === s.marhala && activeMainTab === "assignments" ? cn("ring-2 ring-offset-1 shadow-md", color.ring) : ""
                )}
              >
                <p className={cn("text-xs font-bold mb-2", color.text)}>{MARHALA_LABELS_SHORT[s.marhala]}</p>
                <div className="grid grid-cols-2 gap-1 text-center">
                  <div className="bg-white/80 rounded-lg p-1.5">
                    <p className="text-base font-bold text-slate-900 tabular-nums">{s.assigned}</p>
                    <p className="text-[10px] text-slate-400">Huffaz</p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-1.5">
                    <p className={cn("text-base font-bold tabular-nums", color.text)}>{s.avgPerformance}%</p>
                    <p className="text-[9px] text-slate-400">Performance</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Main tabs ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-48 bg-white rounded-2xl ring-1 ring-slate-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <Card className="border-0 rounded-2xl shadow-sm">
            <CardContent className="p-16 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
            <div className="p-1.5 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm mb-5 inline-block w-full">
              <TabsList className="bg-transparent p-0 h-auto gap-1 w-full justify-start overflow-x-auto">
                <TabsTrigger
                  value="assignments"
                  className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-xl px-4 py-2.5 text-xs"
                >
                  <Users className="w-4 h-4" /> Assignments ({filteredAssignments.length})
                </TabsTrigger>
                <TabsTrigger
                  value="flow-map"
                  className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-xl px-4 py-2.5 text-xs"
                >
                  <GitBranch className="w-4 h-4" /> Flow Map <span className="font-arabic mr-1">خريطة المراحل</span>
                </TabsTrigger>
                <TabsTrigger
                  value="weekly-slips"
                  className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-xl px-4 py-2.5 text-xs"
                >
                  <ClipboardList className="w-4 h-4" /> Weekly Slips
                </TabsTrigger>
                <TabsTrigger
                  value="reports"
                  className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-xl px-4 py-2.5 text-xs"
                >
                  <BarChart3 className="w-4 h-4" /> Reports ({data?.reports.length || 0})
                </TabsTrigger>
                <TabsTrigger
                  value="stats"
                  className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-xl px-4 py-2.5 text-xs"
                >
                  <Target className="w-4 h-4" /> Statistics
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ===== ASSIGNMENTS TAB ===== */}
            <TabsContent value="assignments" className="space-y-0 mt-0">
              {/* Marhala pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {MARHALA_ORDER.map((m) => {
                  const color = marhalaColor(m);
                  const count = getMarhalaAssignments(m).length;
                  const isActive = activeMarhalaTab === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setActiveMarhalaTab(m)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap text-xs font-bold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                        isActive
                          ? `bg-gradient-to-r ${color.grad} text-white shadow-md`
                          : `${color.soft} ${color.text} ${color.softBorder} border hover:shadow-sm`
                      )}
                    >
                      {MARHALA_LABELS_SHORT[m]}
                      <span className={cn(
                        "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums",
                        isActive ? "bg-white/25 text-white" : "bg-white text-slate-700"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {MARHALA_ORDER.map((marhala) => {
                if (activeMarhalaTab !== marhala) return null;
                const marhalaAssignments = getMarhalaAssignments(marhala);
                const withMuhaffiz = marhalaAssignments.filter((a) => a.facultyId);
                const withMusaid = marhalaAssignments.filter((a) => a.musaidId);
                const withoutMuhaffiz = marhalaAssignments.filter((a) => !a.facultyId);
                const color = marhalaColor(marhala);

                if (marhalaAssignments.length === 0) {
                  return (
                    <Card key={marhala} className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100">
                      <CardContent className="py-16 text-center">
                        <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400">No huffaz in {MARHALA_LABELS[marhala]} yet</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-4 rounded-full"
                          onClick={() => {
                            setNewAssignment({ ...newAssignment, marhala });
                            setShowAddForm(true);
                          }}
                        >
                          <Plus className="w-4 h-4" /> Add Student to This Stage
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <div key={marhala} className="space-y-6">
                    <div className={cn("p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 border", color.soft, color.softBorder)}>
                      <div>
                        <h3 className={cn("text-base font-bold", color.text)}>{MARHALA_LABELS[marhala]}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {marhalaAssignments.length} huffaz ·
                          <span className="text-emerald-600 mx-1">{withMuhaffiz.length} with Muhaffiz</span>·
                          <span className="text-blue-600 mx-1">{withMusaid.length} with Musa&apos;id</span>
                          {withoutMuhaffiz.length > 0 && (
                            <span className="text-amber-600 mx-1">{withoutMuhaffiz.length} unassigned</span>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn("text-xs h-8 rounded-full border", color.softBorder, color.text)}
                        onClick={() => {
                          setNewAssignment({ ...newAssignment, marhala });
                          setShowAddForm(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Student
                      </Button>
                    </div>

                    {withoutMuhaffiz.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                            Without Muhaffiz ({withoutMuhaffiz.length})
                          </h4>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {withoutMuhaffiz.map((assignment) => (
                            <StudentAssignmentCard
                              key={assignment.id}
                              assignment={assignment}
                              report={getReportForStudent(assignment.student?.id, assignment.marhala)}
                              onTag={setTagModalAssignment}
                              onDelete={handleDeleteAssignment}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {withMuhaffiz.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                            Assigned to Muhaffiz ({withMuhaffiz.length})
                          </h4>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {withMuhaffiz.map((assignment) => (
                            <StudentAssignmentCard
                              key={assignment.id}
                              assignment={assignment}
                              report={getReportForStudent(assignment.student?.id, assignment.marhala)}
                              onTag={setTagModalAssignment}
                              onDelete={handleDeleteAssignment}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>

            {/* ===== FLOW MAP TAB ===== */}
            <TabsContent value="flow-map" className="mt-0">
              <MarhalaFlowMap assignments={data?.assignments || []} academicYear={selectedAcademicYear} />
            </TabsContent>

            {/* ===== WEEKLY SLIPS TAB ===== */}
            <TabsContent value="weekly-slips" className="mt-0">
              <WeeklySlipsManager />
            </TabsContent>

            {/* ===== REPORTS TAB ===== */}
            <TabsContent value="reports" className="mt-0">
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                <button
                  onClick={() => setActiveMarhalaTab("all")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap text-xs font-bold transition-all duration-300",
                    activeMarhalaTab === "all"
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:shadow-sm"
                  )}
                >
                  All Stages
                  <span className={cn(
                    "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                    activeMarhalaTab === "all" ? "bg-white/25 text-white" : "bg-white text-slate-700"
                  )}>
                    {data?.reports.length || 0}
                  </span>
                </button>
                {MARHALA_ORDER.map((m) => {
                  const color = marhalaColor(m);
                  const count = (data?.reports || []).filter((r) => r.marhala === m).length;
                  const isActive = activeMarhalaTab === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setActiveMarhalaTab(m)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap text-xs font-bold transition-all duration-300",
                        isActive
                          ? `bg-gradient-to-r ${color.grad} text-white shadow-md`
                          : `${color.soft} ${color.text} ${color.softBorder} border hover:shadow-sm`
                      )}
                    >
                      {MARHALA_LABELS_SHORT[m]}
                      <span className={cn(
                        "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                        isActive ? "bg-white/25 text-white" : "bg-white text-slate-700"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(() => {
                const filteredReports = (data?.reports || []).filter((r) =>
                  activeMarhalaTab === "all" || r.marhala === activeMarhalaTab
                );
                if (filteredReports.length === 0) {
                  return (
                    <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100">
                      <CardContent className="py-16 text-center">
                        <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400">No reports yet</p>
                      </CardContent>
                    </Card>
                  );
                }
                return (
                  <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wide">Hafiz</th>
                              <th className="p-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wide">Stage</th>
                              <th className="p-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wide">ITS</th>
                              <th className="p-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wide">Muhaffiz</th>
                              <th className="p-3 text-center font-bold text-slate-500 text-xs uppercase tracking-wide">Total</th>
                              <th className="p-3 text-center font-bold text-slate-500 text-xs uppercase tracking-wide">Performance</th>
                              <th className="p-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wide">Status</th>
                              <th className="p-3 text-center font-bold text-slate-500 text-xs uppercase tracking-wide">Staff</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredReports.map((report: any) => {
                              const config = STATUS_CONFIG[report.status] || STATUS_CONFIG.DRAFT;
                              const mColor = marhalaColor(report.marhala);
                              const reportAssignment = getAssignmentForReport(report);
                              const musaidName = reportAssignment?.musaid ? fullName(reportAssignment.musaid.user) : null;
                              return (
                                <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                  <td className="p-3 font-semibold text-slate-900">
                                    <div className="flex items-center gap-2.5">
                                      <Avatar className="w-7 h-7 rounded-lg shrink-0 shadow-xs">
                                        {report.student?.user?.avatarUrl && (
                                          <AvatarImage src={report.student.user.avatarUrl} alt={fullName(report.student?.user) || report.name} className="object-cover" />
                                        )}
                                        <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px] font-bold">
                                          {(fullName(report.student?.user) || report.name || "S").charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>{fullName(report.student?.user) || report.name || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <Badge className={cn(mColor.soft, mColor.text, "text-[10px] border", mColor.softBorder)}>
                                      {MARHALA_LABELS_SHORT[report.marhala]}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-slate-400 text-xs tabular-nums">{report.its || "—"}</td>
                                  <td className="p-3 text-slate-600 text-xs">
                                    <div className="flex items-center gap-2">
                                      {report.faculty?.user && (
                                        <Avatar className="w-5 h-5 rounded-full shrink-0">
                                          {(report.faculty.user.avatarUrl || report.faculty.photoUrl) && (
                                            <AvatarImage src={report.faculty.user.avatarUrl || report.faculty.photoUrl} alt={fullName(report.faculty.user)} className="object-cover" />
                                          )}
                                          <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[8px] font-bold">
                                            {fullName(report.faculty.user)?.charAt(0) || "T"}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      <span>{fullName(report.faculty?.user) || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-bold text-center tabular-nums">{report.totalMarks || 0}/50</td>
                                  <td className="p-3 text-center">
                                    <span className={cn("font-bold text-sm tabular-nums", (report.overallPerformance || 0) >= 60 ? "text-emerald-600" : "text-amber-600")}>
                                      {report.overallPerformance || 0}%
                                    </span>
                                    <div className="w-16 h-1.5 bg-slate-200/70 rounded-full mx-auto mt-1 overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                          width: `${report.overallPerformance || 0}%`,
                                          background: (report.overallPerformance || 0) >= 60 ? "#10b981" : "#f59e0b",
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <Badge className={cn(config.bgColor, config.color, "border-0 text-[10px]")}>
                                      {config.label}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-center">
                                    {reportAssignment ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => setTagModalAssignment(reportAssignment)}
                                        title="Edit muhaffiz and musa'id assignment"
                                      >
                                        <User className="w-3 h-3" />
                                        {reportAssignment.facultyId ? "Edit" : "Assign"}
                                        {musaidName ? <span className="text-slate-400"> · {musaidName}</span> : null}
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-slate-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </TabsContent>

            {/* ===== STATS TAB ===== */}
            <TabsContent value="stats" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total Assigned Huffaz", value: stats?.totalStudents || 0, icon: Users, chip: "bg-blue-50 text-blue-600" },
                  { label: "Approved Reports", value: stats?.totalApproved || 0, icon: CheckCircle, chip: "bg-emerald-50 text-emerald-600" },
                  { label: "Overall Avg Performance", value: `${stats?.avgPerformance || 0}%`, icon: Target, chip: "bg-amber-50 text-amber-600" },
                ].map(({ label, value, icon: Icon, chip }) => (
                  <Card key={label} className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", chip)}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
                          <p className="text-xs text-slate-400">{label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {statsByMarhala.map((s: any) => {
                  const color = marhalaColor(s.marhala);
                  return (
                    <Card key={s.marhala} className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100 overflow-hidden">
                      <div className={cn("h-1.5 bg-gradient-to-r", color.grad)} />
                      <CardContent className="p-4">
                        <h3 className={cn("font-bold text-sm mb-3", color.text)}>{MARHALA_LABELS_SHORT[s.marhala]}</h3>
                        <div className="space-y-2 text-center">
                          <div className={cn("p-2 rounded-xl", color.soft)}>
                            <p className={cn("text-xl font-bold tabular-nums", color.text)}>{s.assigned}</p>
                            <p className="text-[10px] text-slate-400">Huffaz</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-blue-50 rounded-xl">
                              <p className="text-sm font-bold text-blue-600 tabular-nums">{s.submitted}</p>
                              <p className="text-[10px] text-blue-700">Submitted</p>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-xl">
                              <p className="text-sm font-bold text-emerald-600 tabular-nums">{s.approved}</p>
                              <p className="text-[10px] text-emerald-700">Approved</p>
                            </div>
                          </div>
                          <div className="p-2 bg-amber-50 rounded-xl">
                            <p className="text-lg font-bold text-amber-600 tabular-nums">{s.avgPerformance}%</p>
                            <p className="text-[10px] text-amber-700">Avg Performance</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ── Assign modal ── */}
      {tagModalAssignment && (
        <QuickTagModal
          assignment={tagModalAssignment}
          teachers={data?.teachers || []}
          students={data?.students || []}
          onClose={() => setTagModalAssignment(null)}
          onSave={handleQuickTag}
        />
      )}
    </div>
  );
}
