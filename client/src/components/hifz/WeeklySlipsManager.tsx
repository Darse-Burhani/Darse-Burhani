"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Send,
  Edit3,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
  Globe,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

function SlipCard({
  slip,
  onEdit,
  onPublish,
  onDelete,
}: {
  slip: any;
  onEdit: (slip: any) => void;
  onPublish: (slip: any) => void;
  onDelete: (id: string) => void;
}) {
  const studentName = fullName(slip.student?.user) || "Student";
  const muhaffizName = fullName(slip.faculty?.user) || "—";
  // Musa'id is now a hafiz talib (falls back to legacy teacher musaid)
  const musaidName = slip.musaidStudent ? fullName(slip.musaidStudent.user) : slip.musaid ? fullName(slip.musaid.user) : null;
  const musaidIsTeacher = !slip.musaidStudent && !!slip.musaid;
  const status = slip.status || "DRAFT";
  const cfg = slipStatus(status);
  const StatusIcon = cfg.icon;
  const mColor = marhalaColor(slip.marhala);
  const tier = perfTier(slip.overallPerformance);

  return (
    <div
      className="group bg-white rounded-2xl overflow-hidden ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.15)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer"
      onClick={() => onEdit(slip)}
      title="Open slip to review or edit"
    >
      <div className={cn("h-1.5 bg-gradient-to-r", mColor.grad)} />

      <div className="p-4">
        {/* Student header */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="w-10 h-10 rounded-xl shrink-0 group-hover:scale-105 transition-transform duration-500 shadow-sm ring-1 ring-black/5">
              {slip.student?.user?.avatarUrl && (
                <AvatarImage src={slip.student.user.avatarUrl} alt={studentName} className="object-cover" />
              )}
              <AvatarFallback className={cn("w-full h-full font-bold text-white text-sm", mColor.grad)}>
                {studentName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{studentName} <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">Hafiz Talabt</span></p>
              <p className="text-[11px] text-slate-400 truncate">
                {slip.student?.its ? `ITS ${slip.student.its}` : MARHALA_LABELS_SHORT[slip.marhala]} • {MARHALA_LABELS_SHORT[slip.marhala]}
              </p>
            </div>
          </div>
          <Badge className={cn(cfg.bgColor, cfg.color, "text-[10px] border-0 flex items-center gap-1 shrink-0")}>
            <StatusIcon className="w-3 h-3" />
            {cfg.label}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 bg-slate-50 rounded-xl text-center ring-1 ring-slate-100">
            <p className="text-sm font-bold text-slate-800 tabular-nums">{slip.totalMarks || 0}<span className="text-slate-400 font-semibold">/50</span></p>
            <p className="text-[10px] text-slate-400">Total</p>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl text-center ring-1 ring-slate-100">
            <p className={cn("text-sm font-bold tabular-nums", tier.color)}>{slip.overallPerformance || 0}%</p>
            <p className="text-[10px] text-slate-400">Performance</p>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl text-center ring-1 ring-slate-100">
            <p className="text-sm font-bold text-amber-500 tabular-nums">{slip.disciplineRating || 5}⭐</p>
            <p className="text-[10px] text-slate-400">Commitment</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ width: `${slip.overallPerformance || 0}%`, background: tier.grad }}
          />
        </div>

        {/* Staff line — Muhaffiz + Musa'id for all marhala */}
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
            {slip.faculty?.user ? (
              <>
                <Avatar className="w-4 h-4 rounded-full shrink-0">
                  {(slip.faculty.user?.avatarUrl || slip.faculty?.photoUrl) && (
                    <AvatarImage src={slip.faculty.user?.avatarUrl || slip.faculty?.photoUrl} alt={muhaffizName} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[8px] font-bold">
                    {muhaffizName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span>Muhaffiz: <strong className="font-medium text-emerald-700">{muhaffizName}</strong></span>
              </>
            ) : (
              <span className="text-amber-600">No Muhaffiz</span>
            )}
          </div>
          {musaidName ? (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
              <Avatar className="w-4 h-4 rounded-full shrink-0">
                {((slip.musaidStudent?.user?.avatarUrl || slip.musaid?.user?.avatarUrl || slip.musaid?.photoUrl)) && (
                  <AvatarImage src={slip.musaidStudent?.user?.avatarUrl || slip.musaid?.user?.avatarUrl || slip.musaid?.photoUrl} alt={musaidName} className="object-cover" />
                )}
                <AvatarFallback className="bg-sky-100 text-sky-800 text-[8px] font-bold">
                  {musaidName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span>
                Musa'id <span className="font-arabic text-blue-500">(المُسَاعِد)</span>: <strong className="font-medium text-blue-700">{musaidName}</strong>
                {musaidIsTeacher && <span className="text-[9px] text-sky-600 font-arabic"> (معلم)</span>}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 truncate">No Musa&apos;id assigned — add via Hifz Marhala assignment</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEdit(slip)}>
            <Edit3 className="w-3.5 h-3.5" /> Review
          </Button>
          {(status === "SUBMITTED" || status === "APPROVED") && (
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => onPublish(slip)}
            >
              <Globe className="w-3.5 h-3.5" /> Publish
            </Button>
          )}
          {status === "PUBLISHED" && (
            <div className="flex-1 flex items-center justify-center gap-1 text-[11px] text-purple-600 bg-purple-50 rounded-lg h-8 border border-purple-100">
              <Globe className="w-3 h-3" /> Live for parents
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
            onClick={() => onDelete(slip.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function WeeklySlipCommandBar({
  academicYear,
  weekNumber,
  selectedMarhala,
  onIssued,
}: {
  academicYear: string;
  weekNumber: number;
  selectedMarhala: string;
  onIssued: () => void;
}) {
  const [issuing, setIssuing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const issue = async () => {
    setIssuing(true);
    try {
      const res = await fetch("/api/admin/hifz-marhala/weekly-slips/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear,
          weekNumber,
          marhala: selectedMarhala !== "all" ? selectedMarhala : undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setLastResult(result.data);
        toast({ title: result.message || "Week opened", description: `${result.data.created} new slips • ${result.data.total} total`, variant: "success" });
        onIssued();
      } else {
        toast({ title: "Command failed", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not issue weekly command", variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white ring-1 ring-white/10 shadow-lg relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.14em] uppercase text-amber-300 flex items-center gap-2">
            <Send className="w-4 h-4" /> Weekly Slip Command — Admin Control
          </p>
          <p className="text-sm font-bold text-white mt-1">
            Issue Week <span className="text-amber-300">{weekNumber}</span> for {selectedMarhala === "all" ? "All Stages" : MARHALA_LABELS_SHORT[selectedMarhala as any]} · AY {academicYear}
          </p>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Creates a <b className="text-white">DRAFT slip for every assigned hafiz</b> — teacher sees it instantly as “Tap to fill”. Smooth joint flow.
          </p>
          {lastResult && (
            <p className="text-[11px] text-emerald-300 mt-1">
              ✅ Week {lastResult.weekNumber}: {lastResult.created} new · {lastResult.alreadyExisted} existed · total {lastResult.total}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={issue} disabled={issuing} className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-black shadow-md rounded-xl h-10">
            {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Issue Week Command
          </Button>
          <Button variant="ghost" onClick={onIssued} className="text-slate-200 hover:text-white hover:bg-white/10 h-10 rounded-xl text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh slip view
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WeeklySlipsManager() {
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekMode, setWeekMode] = useState<"all" | "week">("week");
  const [selectedMarhala, setSelectedMarhala] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [editingSlip, setEditingSlip] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchSlips = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (academicYear) params.set("academicYear", academicYear);
      if (weekMode === "week" && weekNumber) params.set("weekNumber", String(weekNumber));
      if (selectedMarhala && selectedMarhala !== "all") params.set("marhala", selectedMarhala);
      if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);
      const res = await fetch(`/api/admin/hifz-marhala/weekly-slips?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setSlips(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [academicYear, weekNumber, weekMode, selectedMarhala, selectedStatus]);

  useEffect(() => {
    fetchSlips();
  }, [fetchSlips]);

  // Live joint polling — when teacher fills, admin sees it without manual refresh
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchSlips();
    }, 10000);
    return () => clearInterval(t);
  }, [fetchSlips]);

  // Jump to the most recent week that already has slips instead of landing on an empty week 1
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/hifz-marhala/weekly-slips?academicYear=${academicYear}`);
        const result = await res.json();
        if (result.success && result.data?.length) {
          const maxWeek = Math.max(...result.data.map((s: any) => Number(s.weekNumber) || 1));
          setWeekNumber(maxWeek);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishIds = async (ids: string[], label: string) => {
    const res = await fetch("/api/admin/hifz-marhala/weekly-slips/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const result = await res.json();
    if (result.success) {
      toast({ title: "Published", description: `${result.count} slip(s) published — ${label}`, variant: "success" });
      fetchSlips();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const handlePublishSlip = async (slip: any) => {
    await publishIds([slip.id], `${fullName(slip.student?.user)} — week ${slip.weekNumber}`);
  };

  const handleBulkPublish = async () => {
    const target = weekMode === "all" ? "all weeks" : `week ${weekNumber}`;
    if (!confirm(`Publish all submitted slips for ${target} to parents?`)) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/hifz-marhala/weekly-slips/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear,
          weekNumber: weekMode === "week" ? weekNumber : undefined,
          marhala: selectedMarhala !== "all" ? selectedMarhala : undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Bulk published", description: `${result.count} slips published to parents`, variant: "success" });
        fetchSlips();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Bulk publish failed", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteSlip = async (id: string) => {
    if (!confirm("Delete this slip? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/hifz-marhala/weekly-slip?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Deleted", description: "Slip deleted successfully", variant: "success" });
        fetchSlips();
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const [teacherFilter, setTeacherFilter] = useState("all");
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/admin/hifz-marhala?academicYear=${academicYear}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setAllTeachers(j.data?.teachers || []); })
      .catch(() => {});
  }, [academicYear]);

  const filteredSlips = slips.filter((s) => {
    const name = fullName(s.student?.user).toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const teacherMatch = teacherFilter === "all" || s.facultyId === teacherFilter;
    return matchSearch && teacherMatch;
  });

  const submitted = slips.filter((s) => s.status === "SUBMITTED" || s.status === "APPROVED").length;
  const published = slips.filter((s) => s.status === "PUBLISHED").length;
  const drafts = slips.filter((s) => s.status === "DRAFT").length;
  const avgPerf = slips.length > 0
    ? Math.round(slips.reduce((sum, s) => sum + (s.overallPerformance || 0), 0) / slips.length)
    : 0;

  const publishableIds = (list: any[]) =>
    list.filter((s) => s.status === "SUBMITTED" || s.status === "APPROVED").map((s) => s.id);

  return (
    <div>
      {/* ── Weekly Command Bar (Admin → Teacher smooth flow) ── */}
      <WeeklySlipCommandBar academicYear={academicYear} weekNumber={weekNumber} selectedMarhala={selectedMarhala} onIssued={fetchSlips} />

      {/* ── Week Navigation + Controls ── */}
      <div className="flex flex-col xl:flex-row gap-3 mt-4 mb-6 items-start xl:items-center justify-between">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Week Navigation — segmented pill */}
          <div className="flex items-center bg-white rounded-full shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <button
              onClick={() => setWeekMode("all")}
              className={cn(
                "h-10 px-4 text-xs font-bold transition-all duration-300",
                weekMode === "all" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              All Weeks
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => { setWeekMode("week"); setWeekNumber(Math.max(1, weekNumber - 1)); }}
              className="h-10 px-2.5 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-30"
              disabled={weekMode === "all" || weekNumber <= 1}
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
                onChange={(e) => { setWeekMode("week"); setWeekNumber(Math.max(1, parseInt(e.target.value) || 1)); }}
                className="w-10 text-center font-bold text-slate-900 text-sm outline-none bg-transparent"
              />
            </div>
            <button
              onClick={() => { setWeekMode("week"); setWeekNumber(weekNumber + 1); }}
              className="h-10 px-2.5 text-slate-500 hover:bg-slate-50 transition-colors"
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

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-44 h-10 rounded-full text-xs shadow-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {["SUBMITTED", "APPROVED", "PUBLISHED", "DRAFT", "REJECTED"].map((k) => (
                <SelectItem key={k} value={k}>{slipStatus(k).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="w-44 h-10 rounded-full text-xs shadow-sm">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers (Muhaffiz)</SelectItem>
              {allTeachers.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{fullName(t.user)} {t.employeeId ? `· ${t.employeeId}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchSlips} disabled={loading} className="h-10 rounded-full">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full xl:w-auto">
          <div className="relative flex-1 xl:flex-none">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search talabat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 pl-4 h-10 rounded-full border border-slate-200 text-xs shadow-sm w-full xl:w-52 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white"
            />
          </div>
          <Button
            onClick={handleBulkPublish}
            disabled={publishing || submitted === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-10 rounded-full whitespace-nowrap shadow-md shadow-purple-500/20"
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Publish All ({submitted})
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Slips", value: slips.length, icon: Users, chip: "bg-slate-100 text-slate-600" },
          { label: "Awaiting Review", value: submitted, icon: Send, chip: "bg-blue-50 text-blue-600" },
          { label: "Published to Parents", value: published, icon: Globe, chip: "bg-purple-50 text-purple-600" },
          { label: "Avg Performance", value: `${avgPerf}%`, icon: BarChart3, chip: "bg-emerald-50 text-emerald-600" },
        ].map(({ label, value, icon: Icon, chip }) => (
          <Card key={label} className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100">
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

      {/* ── Content ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-56 bg-white rounded-2xl ring-1 ring-slate-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-0 rounded-2xl shadow-sm">
          <CardContent className="py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSlips} className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      ) : filteredSlips.length === 0 ? (
        <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100">
          <CardContent className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 text-lg mb-1">
              {weekMode === "all" ? "No slips yet" : `No slips for week ${weekNumber}`}
            </p>
            <p className="text-slate-400 text-sm">
              {weekMode === "all"
                ? "Slips submitted by muhaffizin will appear here for review"
                : `${selectedMarhala !== "all" ? MARHALA_LABELS_SHORT[selectedMarhala] : "All stages"} — week ${weekNumber}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {weekMode === "all" ? (
            <div className="space-y-8">
              {(() => {
                const weeks = [...new Set(filteredSlips.map((s) => s.weekNumber))].sort((a, b) => b - a);
                return weeks.map((week) => {
                  const weekSlips = filteredSlips.filter((s) => s.weekNumber === week);
                  const ids = publishableIds(weekSlips);
                  return (
                    <div key={week}>
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-bold tabular-nums">
                            {week}
                          </div>
                          <h3 className="font-bold text-sm text-slate-900">Week {week}</h3>
                          <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px]">{weekSlips.length} slips</Badge>
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <CalendarDays className="w-3 h-3" /> AY {weekSlips[0]?.academicYear}
                          </span>
                        </div>
                        {ids.length > 0 && (
                          <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-full" onClick={() => publishIds(ids, `week ${week}`)}>
                            <Sparkles className="w-3.5 h-3.5" /> Publish ({ids.length})
                          </Button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {weekSlips.map((slip) => (
                          <SlipCard key={slip.id} slip={slip} onEdit={setEditingSlip} onPublish={handlePublishSlip} onDelete={handleDeleteSlip} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : selectedMarhala !== "all" ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSlips.map((slip) => (
                <SlipCard key={slip.id} slip={slip} onEdit={setEditingSlip} onPublish={handlePublishSlip} onDelete={handleDeleteSlip} />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {MARHALA_ORDER.map((marhala) => {
                const marhalaSlips = filteredSlips.filter((s) => s.marhala === marhala);
                if (marhalaSlips.length === 0) return null;
                const color = marhalaColor(marhala);
                const ids = publishableIds(marhalaSlips);
                return (
                  <div key={marhala}>
                    <div className={cn("flex items-center justify-between p-3.5 rounded-2xl mb-3 border", color.soft, color.softBorder)}>
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-2.5 h-2.5 rounded-full bg-gradient-to-r", color.grad)} />
                        <h3 className={cn("font-bold text-sm", color.text)}>{MARHALA_LABELS[marhala]}</h3>
                        <Badge className="bg-white/80 text-slate-600 border-0 text-[10px]">{marhalaSlips.length} slips</Badge>
                      </div>
                      {ids.length > 0 && (
                        <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-full" onClick={() => publishIds(ids, MARHALA_LABELS_SHORT[marhala])}>
                          <Sparkles className="w-3.5 h-3.5" /> Publish ({ids.length})
                        </Button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {marhalaSlips.map((slip) => (
                        <SlipCard key={slip.id} slip={slip} onEdit={setEditingSlip} onPublish={handlePublishSlip} onDelete={handleDeleteSlip} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Review Modal ── */}
      {editingSlip && (
        <WeeklySlipFormModal
          student={{
            id: editingSlip.studentId,
            studentId: editingSlip.studentId,
            its: editingSlip.student?.its,
            name: fullName(editingSlip.student?.user) || "Student",
          }}
          marhala={editingSlip.marhala}
          academicYear={editingSlip.academicYear}
          weekNumber={editingSlip.weekNumber}
          existingSlip={editingSlip}
          muhaffizName={fullName(editingSlip.faculty?.user)}
          musaidName={editingSlip.musaidStudent ? fullName(editingSlip.musaidStudent.user) : editingSlip.musaid ? fullName(editingSlip.musaid.user) : undefined}
          isAdmin={true}
          onClose={() => setEditingSlip(null)}
          onSuccess={fetchSlips}
        />
      )}
    </div>
  );
}
