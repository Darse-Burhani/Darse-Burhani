"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Send,
  CheckCircle,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Users,
  TrendingUp,
  Sparkles,
  FileText,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import WeeklySlipFormModal from "@/components/hifz/WeeklySlipFormModal";
import {
  MARHALA_ORDER,
  MARHALA_LABELS,
  MARHALA_LABELS_SHORT,
  marhalaColor,
  slipStatus,
  fullName,
  perfTier,
  defaultAcademicYear,
} from "@/lib/hifz-marhala";

// ── Student slip card ──────────────────────────────────────────
function StudentSlipCard({
  studentData,
  weekNumber,
  onOpen,
}: {
  studentData: any;
  weekNumber: number;
  onOpen: (studentData: any) => void;
}) {
  const { student, marhala, currentSlip, prevSlip, muhaffiz, musaid, musaidStudent, isMusaid } = studentData;
  const studentName = fullName(student?.user) || "Student";
  const status = currentSlip?.status || null;
  const cfg = status ? slipStatus(status) : null;
  const StatusIcon = cfg?.icon;
  const mColor = marhalaColor(marhala);
  const hasSlip = !!currentSlip;
  const tier = perfTier(currentSlip?.overallPerformance);
  const staffNames = [fullName(muhaffiz?.user), fullName(musaidStudent?.user) || fullName(musaid?.user)].filter(Boolean);
  const muhaffizName = fullName(muhaffiz?.user);
  const musaidName = fullName(musaidStudent?.user) || fullName(musaid?.user);

  return (
    <div
      className={cn(
        "group bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-0.5",
        hasSlip ? "ring-1 ring-slate-200 hover:ring-slate-300" : "ring-1 ring-dashed ring-slate-300 hover:ring-amber-400"
      )}
      onClick={() => onOpen(studentData)}
    >
      <div className={cn("h-1 bg-gradient-to-r", mColor.grad)} />

      <div className="p-4">
        {/* Student info */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform duration-500 shrink-0", mColor.grad)}>
              {studentName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{studentName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {student?.grade && (
                  <span className="text-[11px] text-slate-400">Grade {student.grade}{student.section || ""}</span>
                )}
                {isMusaid && (
                  <Badge className="bg-blue-50 text-blue-600 border-0 text-[9px] px-1.5">Musa'id</Badge>
                )}
              </div>
            </div>
          </div>
          {cfg ? (
            <Badge className={cn(cfg.bgColor, cfg.color, "text-[10px] border-0 flex items-center gap-1 shrink-0")}>
              {StatusIcon && <StatusIcon className="w-3 h-3" />}
              {cfg.label === "Submitted to Admin" ? "Submitted" : cfg.label}
            </Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-600 border-0 text-[10px] shrink-0">Not Filled</Badge>
          )}
        </div>

        {/* Previous week reference */}
        {prevSlip && !hasSlip && (
          <div className="mb-3 p-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Last week — Week {weekNumber - 1}</p>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span>Juz <b>{prevSlip.currentJuz || "—"}</b></span>
              <span>Page <b>{prevSlip.currentSafah || "—"}</b></span>
              <span className="font-bold text-slate-800">{prevSlip.totalMarks || 0}/50</span>
            </div>
          </div>
        )}

        {/* Current slip data */}
        {hasSlip ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-slate-50 rounded-lg text-center ring-1 ring-slate-100">
                <p className="text-sm font-bold text-slate-800 tabular-nums">{currentSlip.totalMarks || 0}<span className="text-slate-400">/50</span></p>
                <p className="text-[9px] text-slate-400">Total</p>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-center ring-1 ring-slate-100">
                <p className={cn("text-sm font-bold tabular-nums", tier.color)}>{currentSlip.overallPerformance || 0}%</p>
                <p className="text-[9px] text-slate-400">Perf.</p>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-center ring-1 ring-slate-100">
                <p className="text-sm font-bold text-amber-500 tabular-nums">{currentSlip.disciplineRating || 5}⭐</p>
                <p className="text-[9px] text-slate-400">Rated</p>
              </div>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ width: `${currentSlip.overallPerformance || 0}%`, background: tier.grad }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-3 rounded-xl bg-amber-50/70 border border-dashed border-amber-200">
            <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Tap to fill week {weekNumber} slip
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {muhaffizName ? (
            <p className="text-[10px] text-slate-400 truncate">
              {muhaffizName}{musaidName ? ` · Musa'id ${musaidName}` : ""}
            </p>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            variant={hasSlip ? "outline" : "default"}
            className={cn("h-8 text-xs shrink-0", !hasSlip && "btn-fatimi-primary")}
            onClick={(e) => { e.stopPropagation(); onOpen(studentData); }}
          >
            {hasSlip ? (
              <><Edit3 className="w-3.5 h-3.5" /> Edit</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Fill Slip</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function TeacherHifzWeeklySlipPage() {
  const [data, setData] = useState<{ students: any[]; teacherProfile: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [selectedMarhala, setSelectedMarhala] = useState("all");
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState<any>(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (academicYear) params.set("academicYear", academicYear);
      params.set("weekNumber", String(weekNumber));
      if (selectedMarhala && selectedMarhala !== "all") params.set("marhala", selectedMarhala);
      const res = await fetch(`/api/teacher/hifz-weekly-slip?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || "Failed to load data");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [academicYear, weekNumber, selectedMarhala]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live joint polling — when admin issues a new week, teacher sees it instantly
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 12000);
    return () => clearInterval(t);
  }, [fetchData]);

  // Jump to the most recent week that already has slips
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams();
        if (academicYear) params.set("academicYear", academicYear);
        const res = await fetch(`/api/teacher/hifz-weekly-slip/weeks?${params.toString()}`);
        const result = await res.json();
        if (result.success && result.data?.length) {
          setWeekNumber(Math.max(...result.data.map((w: number) => Number(w) || 1)));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allStudents = data?.students || [];

  const filteredStudents = allStudents.filter((s) => {
    const name = fullName(s.student?.user).toLowerCase();
    return search === "" || name.includes(search.toLowerCase());
  });

  const filled = allStudents.filter((s) => s.currentSlip).length;
  const submitted = allStudents.filter((s) => s.currentSlip?.status === "SUBMITTED").length;
  const avgPerf = filled > 0
    ? Math.round(allStudents.filter((s) => s.currentSlip).reduce((sum, s) => sum + (s.currentSlip?.overallPerformance || 0), 0) / filled)
    : 0;
  const notFilled = allStudents.filter((s) => !s.currentSlip);
  const marhalas = [...new Set(filteredStudents.map((s) => s.marhala))].sort(
    (a, b) => MARHALA_ORDER.indexOf(a) - MARHALA_ORDER.indexOf(b)
  );

  // Submit every already-filled draft slip for this week to admin
  const handleBatchSubmit = async () => {
    const draftStudents = allStudents.filter((s) => s.currentSlip?.status === "DRAFT");
    if (draftStudents.length === 0) return;
    if (!confirm(`Submit ${draftStudents.length} draft slip(s) for week ${weekNumber} to admin?`)) return;
    setBatchSubmitting(true);
    try {
      const res = await fetch("/api/teacher/hifz-weekly-slip/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear,
          weekNumber,
          status: "SUBMITTED",
          slips: draftStudents.map((s) => ({
            studentId: s.student?.id,
            marhala: s.marhala,
            ...s.currentSlip,
          })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Submitted", description: `${draftStudents.length} slips sent to admin`, variant: "success" });
        fetchData();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Batch submit failed", variant: "destructive" });
    } finally {
      setBatchSubmitting(false);
    }
  };

  const draftsCount = allStudents.filter((s) => s.currentSlip?.status === "DRAFT").length;

  return (
    <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-amber-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ── */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-950 p-6 sm:p-8 shadow-xl shadow-emerald-900/20">
            <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="absolute -bottom-14 -right-10 w-52 h-52 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-amber-300" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Weekly Hifz Slip</h1>
                  <p className="text-sm text-emerald-100/70 mt-1">
                    Fill, review and submit weekly slips for your talabat
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-white/10 text-emerald-100 border border-white/15 text-xs px-3 py-1.5">
                  AY {academicYear}
                </Badge>
                <Badge className="bg-amber-400 text-emerald-950 border-0 text-xs font-bold px-3 py-1.5">
                  Week {weekNumber}
                </Badge>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Week navigation — segmented pill */}
            <div className="flex items-center bg-white rounded-full shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <button
                onClick={() => setWeekNumber(Math.max(1, weekNumber - 1))}
                className="h-10 px-3 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30"
                disabled={weekNumber <= 1}
                aria-label="Previous week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <span className="text-[11px] text-slate-400 uppercase tracking-wide">Week</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 text-center font-bold text-slate-900 text-sm outline-none bg-transparent"
                />
              </div>
              <button
                onClick={() => setWeekNumber(weekNumber + 1)}
                className="h-10 px-3 hover:bg-slate-50 text-slate-500 transition-colors"
                aria-label="Next week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <Select value={selectedMarhala} onValueChange={setSelectedMarhala}>
              <SelectTrigger className="w-40 h-10 rounded-full text-xs shadow-sm">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {MARHALA_ORDER.map((m) => (
                  <SelectItem key={m} value={m}>{MARHALA_LABELS_SHORT[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-10 rounded-full">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
            </Button>

            {draftsCount > 0 && (
              <Button
                onClick={handleBatchSubmit}
                disabled={batchSubmitting}
                className="h-10 rounded-full text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
              >
                {batchSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit {draftsCount} Draft{draftsCount > 1 ? "s" : ""}
              </Button>
            )}
          </div>

          <div className="relative w-full sm:w-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search talabat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 pl-4 h-10 rounded-full border border-slate-200 text-xs shadow-sm w-full sm:w-56 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white"
            />
          </div>
        </div>

        {/* ── Stats + week progress ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: "My Talabat", value: allStudents.length, icon: Users, chip: "bg-slate-100 text-slate-600" },
            { label: "Slips Filled", value: filled, icon: CheckCircle, chip: "bg-emerald-50 text-emerald-600" },
            { label: "Submitted", value: submitted, icon: Send, chip: "bg-blue-50 text-blue-600" },
            { label: "Avg Performance", value: `${avgPerf}%`, icon: TrendingUp, chip: "bg-amber-50 text-amber-600" },
          ].map(({ label, value, icon: Icon, chip }) => (
            <Card key={label} className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", chip)}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
                    <p className="text-[11px] text-slate-400">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Week progress bar */}
        {allStudents.length > 0 && (
          <div className="mb-6 p-4 bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Week {weekNumber} completion
              </p>
              <p className="text-xs text-slate-400 tabular-nums">{filled} / {allStudents.length} slips completed</p>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ width: allStudents.length > 0 ? `${(filled / allStudents.length) * 100}%` : "0%" }}
              />
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-56 bg-white rounded-2xl ring-1 ring-slate-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <Card className="border-0 rounded-2xl shadow-sm">
            <CardContent className="py-16 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">Retry</Button>
            </CardContent>
          </Card>
        ) : filteredStudents.length === 0 ? (
          <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100">
            <CardContent className="py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 text-lg mb-1">No talabat assigned to you yet</p>
              <p className="text-slate-400 text-sm">Once the admin assigns students to your marhala, they appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {marhalas.map((marhala) => {
              const marhalaStudents = filteredStudents.filter((s) => s.marhala === marhala);
              if (marhalaStudents.length === 0) return null;
              const color = marhalaColor(marhala);
              const marhalaFilled = marhalaStudents.filter((s) => s.currentSlip).length;
              const avgPerfM = marhalaFilled > 0
                ? Math.round(marhalaStudents.filter((s) => s.currentSlip).reduce((sum, s) => sum + (s.currentSlip?.overallPerformance || 0), 0) / marhalaFilled)
                : 0;
              const pct = marhalaStudents.length > 0 ? Math.round((marhalaFilled / marhalaStudents.length) * 100) : 0;

              return (
                <div key={marhala}>
                  <div className={cn("flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl mb-4 border", color.soft, color.softBorder)}>
                    <div>
                      <h3 className={cn("font-bold text-sm", color.text)}>{MARHALA_LABELS[marhala]}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {marhalaStudents.length} students · {marhalaFilled} filled · avg {avgPerfM}%
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-white/70 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]", color.grad)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={cn("text-xs font-bold tabular-nums", color.text)}>{pct}%</span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {marhalaStudents.map((s) => (
                      <StudentSlipCard
                        key={`${s.student?.id}-${s.marhala}`}
                        studentData={s}
                        weekNumber={weekNumber}
                        onOpen={setOpenModal}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {notFilled.length > 0 && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 px-1 pb-4">
                <UserCheck className="w-3.5 h-3.5" />
                {notFilled.length} slip{notFilled.length > 1 ? "s" : ""} still pending for week {weekNumber} — fill them before submitting to admin.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Slip Modal ── */}
      {openModal && (
        <WeeklySlipFormModal
          student={{
            id: openModal.student?.id || openModal.assignment?.studentId,
            studentId: openModal.student?.id || openModal.assignment?.studentId,
            its: openModal.student?.its,
            grade: openModal.student?.grade,
            section: openModal.student?.section,
            name: fullName(openModal.student?.user) || "Student",
          }}
          marhala={openModal.marhala}
          academicYear={academicYear}
          weekNumber={weekNumber}
          existingSlip={openModal.currentSlip}
          prevSlip={openModal.prevSlip}
          muhaffizName={fullName(openModal.muhaffiz?.user)}
          musaidName={
            openModal.musaidStudent
              ? fullName(openModal.musaidStudent.user)
              : openModal.musaid
                ? fullName(openModal.musaid.user)
                : undefined
          }
          isAdmin={false}
          onClose={() => setOpenModal(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
