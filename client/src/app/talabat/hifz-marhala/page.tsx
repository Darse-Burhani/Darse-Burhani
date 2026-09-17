"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Edit3,
  Eye,
  Filter,
  Award,
  Target,
  Users,
  BarChart3,
  Save,
  Calendar,
  Copy,
  Check,
  Sparkles,
  Loader2 as LoaderIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/teacher/HifzMarhalaReportForm";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MARHALA_LABELS: Record<string, string> = {
  MARHALA_1: "Marhala 1 · Juz 1-6",
  MARHALA_2: "Marhala 2 · Juz 7-12",
  MARHALA_3: "Marhala 3 · Juz 13-18",
  MARHALA_4: "Marhala 4 · Juz 19-24",
  MARHALA_5: "Marhala 5 · Juz 25-30",
};

const MARHALA_ORDER = ["MARHALA_1", "MARHALA_2", "MARHALA_3", "MARHALA_4", "MARHALA_5"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  SUBMITTED: { label: "Submitted", color: "text-blue-700", bgColor: "bg-blue-100" },
  REVIEWED: { label: "Reviewed", color: "text-amber-700", bgColor: "bg-amber-100" },
  APPROVED: { label: "Approved", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  REJECTED: { label: "Rejected", color: "text-red-700", bgColor: "bg-red-100" },
};

const MARKS_CONFIG = [
  { key: "murajaatMarks", label: "Revision (20)", max: 20 },
  { key: "juzhaliMarks", label: "Current Juz (20)", max: 20 },
  { key: "jadeedMarks", label: "New (10)", max: 10 },
] as const;

function buildWeeklySlipWhatsAppText(slip: any) {
  const studentName = slip.student?.user
    ? `${slip.student.user.firstName || ""} ${slip.student.user.lastName || ""}`.trim()
    : "Student";
  const stars = "⭐".repeat(slip.disciplineRating || 5).slice(0, 5);
  return `📊 *Weekly Hifz Slip - Dar-e-Burhani* 📖\n━━━━━━━━━━━━━━━━\n👤 *Student:* ${studentName}\n📌 *Marhala:* ${MARHALA_LABELS[slip.marhala] || slip.marhala}\n📅 *Week:* ${slip.weekNumber} | Academic Year: ${slip.academicYear}\n\n📖 *New Memorization (Sabaq):*\n- Current Juz: ${slip.currentJuz || "—"} | Page: ${slip.currentSafah || "—"}\n- Amount: ${slip.sabaqLines || 0} lines / pages\n\n🔄 *Revision (Sabiqi / Past):* ${slip.murajaatSabqi || "Scheduled revision completed"}\n⭐ *Commitment Rating:* ${stars}\n\n🎯 *Detailed Marks (out of 50):*\n- Revision (20): ${slip.murajaatMarks || 0}\n- Current Juz (20): ${slip.juzhaliMarks || 0}\n- New Memorization (10): ${slip.jadeedMarks || 0}\n🏆 *Total:* ${slip.totalMarks || 0}/50 (*${slip.overallPerformance || 0}%*)\n\n📝 *Teacher Notes:*\n${slip.teacherNotes || "Good and blessed effort, may Allah reward it."}\n━━━━━━━━━━━━━━━━\n_Dar-e-Burhani - Quran Memorization Progress Tracker_`;
}

function TalabatWeeklySlipCard({ slip, copied, onCopy }: { slip: any; copied: boolean; onCopy: () => void }) {
  const stars = "⭐".repeat(slip.disciplineRating || 5).slice(0, 5);
  const perf = slip.overallPerformance || 0;
  const perfColor = perf >= 80 ? "#059669" : perf >= 60 ? "#2563eb" : "#d97706";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200 group">
      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white">
              <Calendar className="w-3.5 h-3.5" /> Week {slip.weekNumber}
            </span>
            {slip.publishedAt && (
              <span className="text-[11px] text-gray-400">Published: {new Date(slip.publishedAt).toLocaleDateString()}</span>
            )}
          </div>
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
            <CheckCircle className="w-3 h-3 ml-1" /> Published
          </Badge>
        </div>

        {slip.marhala && (
          <p className="text-xs text-gray-500 mb-3">
            Stage: <span className="font-medium text-gray-700">{MARHALA_LABELS[slip.marhala] || slip.marhala}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2.5 rounded-xl text-center bg-amber-50 border border-amber-100">
            <p className="text-xs text-gray-500 mb-0.5">Juz / Page</p>
            <p className="text-sm font-bold text-amber-700">{slip.currentJuz || "—"} / {slip.currentSafah || "—"}</p>
          </div>
          <div className="p-2.5 rounded-xl text-center bg-emerald-50 border border-emerald-100">
            <p className="text-xs text-gray-500 mb-0.5">New Memorization</p>
            <p className="text-sm font-bold text-emerald-700">{slip.sabaqLines || 0} lines</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600">Commitment & Tajweed</span>
          <span className="text-xs">{stars}</span>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">
            Revision {slip.murajaatMarks || 0} + Current {slip.juzhaliMarks || 0} + New {slip.jadeedMarks || 0}
          </span>
          <span className="text-sm font-bold" style={{ color: perfColor }}>{slip.totalMarks || 0}/50 ({perf}%)</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${perf}%`, background: `linear-gradient(90deg, #f59e0b, ${perfColor})` }} />
        </div>

        {slip.murajaatSabqi && (
          <p className="text-xs text-gray-600 mb-3 leading-relaxed">
            <span className="font-bold text-gray-800">Revision:</span> {slip.murajaatSabqi}
          </p>
        )}

        {slip.teacherNotes && (
          <div className="p-3 rounded-xl mb-3 text-xs leading-relaxed bg-amber-50 border border-amber-200 text-amber-900">
            <p className="font-bold mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Teacher Notes
            </p>
            {slip.teacherNotes}
          </div>
        )}

        {slip.faculty?.user && (
          <p className="text-[11px] text-gray-500 mb-3">
            Muhaffiz: <span className="font-medium text-gray-700">{slip.faculty.user.firstName} {slip.faculty.user.lastName}</span>
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="w-full h-9 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          {copied ? <Check className="w-3.5 h-3.5 ml-1.5" /> : <Copy className="w-3.5 h-3.5 ml-1.5" />}
          {copied ? "Copied — send via WhatsApp" : "Copy WhatsApp Card"}
        </Button>
      </div>
    </div>
  );
}

export default function TalabatHifzMarhalaPage() {
  const [data, setData] = useState<{ assignment: any; reports: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState("");
  const [editingReport, setEditingReport] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [weeklySlips, setWeeklySlips] = useState<any[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(true);
  const [copiedSlip, setCopiedSlip] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (academicYear) params.set("academicYear", academicYear);
      const res = await fetch(`/api/talabat/hifz-marhala?${params.toString()}`);
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
  }, [academicYear]);

  const fetchWeeklySlips = useCallback(async () => {
    try {
      const res = await fetch("/api/talabat/hifz-marhala/weekly-slips");
      const data = await res.json();
      if (data.success) setWeeklySlips(data.data || []);
    } catch {
      // Keep empty state on network failure
    } finally {
      setSlipsLoading(false);
    }
  }, []);

  const copySlipCard = async (slip: any) => {
    await navigator.clipboard.writeText(buildWeeklySlipWhatsAppText(slip));
    setCopiedSlip(slip.id);
    setTimeout(() => setCopiedSlip(null), 2500);
  };

  useEffect(() => {
    fetchData();
    fetchWeeklySlips();
  }, [fetchData, fetchWeeklySlips]);

  const currentYear = new Date().getFullYear();
  const defaultYear = `${currentYear}-${currentYear + 1}`;

  const handleEditClick = (report: any) => {
    setFormData({
      its: report.its || "",
      name: report.name || "",
      currentJuz: report.currentJuz || "",
      currentSafah: report.currentSafah || "",
      totalJadeedPages: report.totalJadeedPages || "",
      ajzaMatruka: report.ajzaMatruka || "",
      weakAjza: report.weakAjza || "",
      murajaatMarks: report.murajaatMarks || 0,
      juzhaliMarks: report.juzhaliMarks || 0,
      jadeedMarks: report.jadeedMarks || 0,
      notes: report.notes || "",
    });
    setEditingReport(report);
  };

  const handleNewReport = (marhala: string) => {
    setFormData({
      its: data?.assignment?.student?.its || "",
      name: "",
      currentJuz: "",
      currentSafah: "",
      totalJadeedPages: "",
      ajzaMatruka: "",
      weakAjza: "",
      murajaatMarks: 0,
      juzhaliMarks: 0,
      jadeedMarks: 0,
      notes: "",
    });
    setEditingReport({ marhala, isNew: true });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    MARKS_CONFIG.forEach((m) => {
      const val = parseInt(formData[m.key]) || 0;
      if (val < 0 || val > m.max) {
        errors[m.key] = `Must be between 0 and ${m.max}`;
      }
    });
    return errors;
  };

  const calculateTotals = () => {
    const total = (parseInt(formData.murajaatMarks) || 0) + (parseInt(formData.juzhaliMarks) || 0) + (parseInt(formData.jadeedMarks) || 0);
    return { total, performance: total > 0 ? Math.round((total / 50) * 100) : 0 };
  };

  const { total: totalMarks, performance: overallPerformance } = calculateTotals();

  const handleSave = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      toast({ title: "Validation error", description: "Please correct the marks", variant: "destructive" });
      return;
    }

    if (!data?.assignment?.facultyId) {
      toast({ title: "Error", description: "No teacher assigned to this stage", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        marhala: editingReport.marhala,
        academicYear: academicYear || defaultYear,
        ...formData,
        murajaatMarks: parseInt(formData.murajaatMarks as any) || 0,
        juzhaliMarks: parseInt(formData.juzhaliMarks as any) || 0,
        jadeedMarks: parseInt(formData.jadeedMarks as any) || 0,
        currentJuz: formData.currentJuz ? parseInt(formData.currentJuz as any) : null,
        currentSafah: formData.currentSafah ? parseInt(formData.currentSafah as any) : null,
        totalJadeedPages: formData.totalJadeedPages ? parseInt(formData.totalJadeedPages as any) : null,
        ajzaMatruka: formData.ajzaMatruka ? parseInt(formData.ajzaMatruka as any) : null,
        weakAjza: formData.weakAjza ? parseInt(formData.weakAjza as any) : null,
        totalMarks,
        overallPerformance,
      };

      if (editingReport.isNew) {
        await fetch("/api/talabat/hifz-marhala/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/talabat/hifz-marhala/report", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingReport.id, ...payload }),
        });
      }

      toast({ title: "Saved", description: "Your report was saved successfully", variant: "success" });
      setEditingReport(null);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to save the report", variant: "destructive" });
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-amber-50/30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="h-48 bg-gray-100 rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-amber-50/30">
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-600 text-xl font-medium">Failed to load data</p>
          <p className="text-gray-500 text-base mt-2">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 ml-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data?.assignment) {
    return (
      <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-amber-50/30">
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-500 text-xl">No stage assignment</p>
          <p className="text-gray-500 text-base mt-1">Contact the admin to assign you a hifz stage</p>
        </div>
      </div>
    );
  }

  const { assignment, reports } = data;
  const student = assignment.student;
  const studentName = `${student.user.firstName || ""} ${student.user.lastName || ""}`.trim() || "Hafiz";

  const latestReport = reports[0];
  const status = latestReport?.status || "DRAFT";
  const config = STATUS_CONFIG[status];

  const reportsByMarhala = MARHALA_ORDER.map((m) => ({
    marhala: m,
    report: reports.find((r) => r.marhala === m),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-amber-50/30">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="animate-fade-in mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-700 p-6 sm:p-8 shadow-xl shadow-amber-500/20">
            <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="absolute -bottom-14 -right-10 w-52 h-52 rounded-full bg-rose-400/20 blur-3xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">My Hifz Marhala Report</h1>
                <p className="text-sm text-amber-100/80 mt-1">Self-review &amp; submit your progress reports</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </div>

        {/* Student Profile Card — hafiz name front and center */}
        <Card className="mb-6 border-0 rounded-2xl shadow-sm ring-1 ring-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-blue-50 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 rounded-2xl ring-2 ring-emerald-400/30 shadow-md shadow-emerald-500/20 shrink-0">
                {student.user?.avatarUrl && (
                  <AvatarImage src={student.user.avatarUrl} alt={studentName} className="object-cover" />
                )}
                <AvatarFallback className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-2xl rounded-2xl">
                  {studentName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-900 truncate">{studentName}</h2>
                <div className="flex flex-wrap gap-2.5 mt-1.5 text-xs">
                  {student.its && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-200 text-slate-600"><Target className="w-3 h-3 text-emerald-600" /> ITS: {student.its}</span>}
                  {student.grade && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-200 text-slate-600"><Award className="w-3 h-3 text-emerald-600" /> Grade: {student.grade}{student.section}</span>}
                  {assignment.faculty && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-200 text-slate-600">
                      <Avatar className="w-4 h-4 rounded-full shrink-0">
                        {(assignment.faculty.user?.avatarUrl || assignment.faculty.photoUrl) && (
                          <AvatarImage src={assignment.faculty.user?.avatarUrl || assignment.faculty.photoUrl} alt={assignment.faculty.user?.firstName} className="object-cover" />
                        )}
                        <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[8px] font-bold">
                          {assignment.faculty.user?.firstName?.charAt(0) || "T"}
                        </AvatarFallback>
                      </Avatar>
                      Muhaffiz: {assignment.faculty.user.firstName} {assignment.faculty.user.lastName}
                    </span>
                  )}
                  {assignment.musaid && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-200 text-slate-600">
                      <Avatar className="w-4 h-4 rounded-full shrink-0">
                        {(assignment.musaid.user?.avatarUrl || assignment.musaid.photoUrl) && (
                          <AvatarImage src={assignment.musaid.user?.avatarUrl || assignment.musaid.photoUrl} alt={assignment.musaid.user?.firstName} className="object-cover" />
                        )}
                        <AvatarFallback className="bg-sky-100 text-sky-800 text-[8px] font-bold">
                          {assignment.musaid.user?.firstName?.charAt(0) || "M"}
                        </AvatarFallback>
                      </Avatar>
                      Musa'id: {assignment.musaid.user.firstName} {assignment.musaid.user.lastName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-200 text-slate-600"><BookOpen className="w-3 h-3 text-emerald-600" /> Stage: {MARHALA_LABELS[assignment.marhala]}</span>
                </div>
              </div>
              <div className="text-left shrink-0">
                <Badge className={cn(config.bgColor, config.color, "text-sm px-3 py-1.5 border-0")}>
                  {config.label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic Year Selector */}
        <div className="flex items-center gap-3 mb-6">
          <label htmlFor="academic-year" className="sr-only">Academic Year</label>
          <select
            id="academic-year"
            value={academicYear || defaultYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-base focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none shadow-sm w-64"
          >
            <option value={`${currentYear - 1}-${currentYear}`}>{currentYear - 1}-{currentYear}</option>
            <option value={`${currentYear}-${currentYear + 1}`}>{currentYear}-{currentYear + 1}</option>
            <option value={`${currentYear + 1}-${currentYear + 2}`}>{currentYear + 1}-{currentYear + 2}</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => { fetchData(); fetchWeeklySlips(); }}>
            <RefreshCw className="w-4 h-4 ml-1" /> Refresh
          </Button>
        </div>

        {/* Marhala Overview Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {reportsByMarhala.map((item, idx) => {
            const { marhala, report } = item;
            const rStatus = report?.status || "DRAFT";
            const rConfig = STATUS_CONFIG[rStatus];
            const perf = report?.overallPerformance || 0;

            return (
              <Card
                key={marhala}
                className={`border-0 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer ${editingReport?.marhala === marhala ? "ring-2 ring-amber-400" : ""}`}
                onClick={() => !report || (report.status === "DRAFT" || report.status === "SUBMITTED") ? handleEditClick(report || { marhala, isNew: true }) : null}
              >
                <div className={`h-1.5 ${rStatus === "APPROVED" ? "bg-emerald-500" : rStatus === "SUBMITTED" ? "bg-blue-500" : rStatus === "REVIEWED" ? "bg-amber-500" : rStatus === "REJECTED" ? "bg-red-500" : "bg-gray-300"}`} />
                <CardContent className="p-4 text-center">
                  <div className="mb-3">
                    <span className="text-xs text-gray-500 block mb-1">Stage</span>
                    <h3 className="font-bold text-gray-900">{MARHALA_LABELS[marhala].split(" ")[0]}</h3>
                  </div>
                  <ProgressRing progress={perf} size={80} strokeWidth={6} />
                  <div className="mt-3">
                    <Badge className={cn(rConfig.bgColor, rConfig.color, "text-xs")}>
                      {rConfig.label}
                    </Badge>
                    {report && (
                      <div className="mt-2 text-sm text-gray-500">
                        {report.totalMarks}/50 • {perf}%
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detailed Report View */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Stage Details & Progress</h2>
            
            <div className="space-y-4">
              {reportsByMarhala.map(({ marhala, report }) => {
                const rStatus = report?.status || "DRAFT";
                const rConfig = STATUS_CONFIG[rStatus];
                const canEdit = !report || rStatus === "DRAFT" || rStatus === "SUBMITTED";

                return (
                  <div
                    key={marhala}
                    className={`p-5 rounded-xl border transition-all ${editingReport?.marhala === marhala ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-amber-300"}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                          {MARHALA_ORDER.indexOf(marhala) + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{MARHALA_LABELS[marhala]}</h3>
                          <p className="text-sm text-gray-500">Juz {marhala === "MARHALA_1" ? "1-6" : marhala === "MARHALA_2" ? "7-12" : marhala === "MARHALA_3" ? "13-18" : marhala === "MARHALA_4" ? "19-24" : "25-30"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={cn(rConfig.bgColor, rConfig.color,"")}>
                          {rConfig.label}
                        </Badge>
                        {report && (
                          <div className="text-left">
                            <p className="font-bold text-amber-600">{report.totalMarks}/50</p>
                            <p className="text-xs text-gray-500">{report.overallPerformance}%</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {editingReport?.marhala === marhala ? (
                      // Edit Form
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid gap-3 md:grid-cols-3">
                          {MARKS_CONFIG.map((mark) => (
                            <div key={mark.key} className="space-y-1">
                              <label className="text-sm font-medium text-gray-700">{mark.label}</label>
                              <Input
                                type="number"
                                min={0}
                                max={mark.max}
                                value={formData[mark.key] || ""}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(mark.key, e.target.value)}
                                className="text-center text-xl font-bold"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Current Juz</label>
                            <Input
                              type="number"
                              min={0}
                              max={30}
                              value={formData.currentJuz || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("currentJuz", e.target.value)}
                              className="text-center text-xl font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Current Page</label>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={formData.currentSafah || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("currentSafah", e.target.value)}
                              className="text-center text-xl font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">New Pages</label>
                            <Input
                              type="number"
                              min={0}
                              value={formData.totalJadeedPages || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("totalJadeedPages", e.target.value)}
                              className="text-center text-xl font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Dropped Juz</label>
                            <Input
                              type="number"
                              min={0}
                              value={formData.ajzaMatruka || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("ajzaMatruka", e.target.value)}
                              className="text-center text-xl font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Weak Juz</label>
                            <Input
                              type="number"
                              min={0}
                              value={formData.weakAjza || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("weakAjza", e.target.value)}
                              className="text-center text-xl font-bold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">Notes</label>
                          <textarea
                            value={formData.notes || ""}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange("notes", e.target.value)}
                            rows={3}
                            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                            placeholder="Personal notes about your progress..."
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                          <Button variant="outline" onClick={() => setEditingReport(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSave} disabled={!canEdit}>
                            {editingReport.isNew ? <Save className="w-4 h-4 ml-1" /> : <Save className="w-4 h-4 ml-1" />}
                            {editingReport.isNew ? "Submit Report" : "Update Report"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                        {MARKS_CONFIG.map((mark) => (
                          <div key={mark.key} className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">{mark.label}</p>
                            <p className="text-2xl font-bold text-gray-900">{report?.[mark.key] || 0} / {mark.max}</p>
                          </div>
                        ))}
                        <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <p className="text-xs text-emerald-700">Total</p>
                          <p className="text-2xl font-bold text-emerald-700">{report?.totalMarks || 0} / 50</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs text-blue-700">Overall Performance</p>
                          <p className="text-2xl font-bold text-blue-700">{report?.overallPerformance || 0}%</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-xs text-purple-700">Current Juz</p>
                          <p className="text-2xl font-bold text-purple-700">{report?.currentJuz || 0}</p>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-xs text-amber-700">New Pages</p>
                          <p className="text-2xl font-bold text-amber-700">{report?.totalJadeedPages || 0}</p>
                        </div>
                      </div>
                    )}

                    {report && !editingReport?.marhala && (
                      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Submitted: {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : "—"}</span>
                          {report.reviewedAt && <span>Reviewed: {new Date(report.reviewedAt).toLocaleDateString()}</span>}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(report)}
                          disabled={!canEdit}
                          className=""
                        >
                          <Edit3 className="w-3.5 h-3.5 ml-1" />
                          {canEdit ? "Edit" : "View Only"}
                        </Button>
                      </div>
                    )}

                    {!report && !editingReport?.marhala && (
                      <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                        <p className="text-gray-500 mb-3">You haven't submitted a report for this stage yet</p>
                        <Button onClick={() => handleNewReport(marhala)}>
                          <Save className="w-4 h-4 ml-1" /> Create New Report
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Published Weekly Slips */}
        <Card className="border-0 shadow-sm overflow-hidden mt-8">
          <div className="flex items-center justify-between flex-wrap gap-2 px-6 pt-6 pb-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Published Weekly Slips
              </h2>
              <p className="text-sm text-gray-500 mt-1">Weekly hifz slips published for you by the school</p>
            </div>
            {weeklySlips.length > 0 && (
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                {weeklySlips.length} Slips
              </Badge>
            )}
          </div>
          <CardContent className="p-6">
            {slipsLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : weeklySlips.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-gray-400">No published weekly slips yet</p>
                <p className="text-gray-300 text-sm mt-1">They will appear here once the admin publishes them</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {weeklySlips.map((slip) => (
                  <TalabatWeeklySlipCard
                    key={slip.id}
                    slip={slip}
                    copied={copiedSlip === slip.id}
                    onCopy={() => copySlipCard(slip)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}