"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Save,
  Send,
  Loader2,
  Sparkles,
  Award,
  Clock,
  Share2,
  Check,
  Star,
  MessageSquare,
  X,
  Plus,
  Zap,
  User,
  Eye,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  MARHALA_LABELS,
  MARHALA_LABELS_AR,
  ROLE_LABELS_AR,
  marhalaColor,
  slipStatus,
  fullName,
  perfTier,
} from "@/lib/hifz-marhala";

const QUICK_FEEDBACK_CHIPS = [
  "Excellent memorization, may Allah bless it 🌟",
  "Outstanding tajweed and letter articulation ✨",
  "Good memorization with some similar-verse revision needed",
  "Please increase daily tasmee' and revision at home 📖",
  "Blessed effort and noticeable progress this week 👏",
  "Needs better consolidation of old memorization (sabiqi)",
];

const PRESETS = [
  { name: "Excellent", murajaat: 20, juzhali: 20, jadeed: 10, rating: 5, note: QUICK_FEEDBACK_CHIPS[0], tone: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300" },
  { name: "Distinguished", murajaat: 18, juzhali: 18, jadeed: 9, rating: 5, note: QUICK_FEEDBACK_CHIPS[1], tone: "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100 hover:border-teal-300" },
  { name: "Very Good", murajaat: 16, juzhali: 16, jadeed: 8, rating: 4, note: QUICK_FEEDBACK_CHIPS[4], tone: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 hover:border-blue-300" },
  { name: "Follow-up", murajaat: 12, juzhali: 12, jadeed: 6, rating: 3, note: QUICK_FEEDBACK_CHIPS[3], tone: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300" },
];

interface WeeklySlipFormModalProps {
  student: {
    id?: string;
    studentId?: string;
    its?: string;
    grade?: string;
    section?: string;
    name?: string;
    user?: { firstName?: string; lastName?: string };
  };
  marhala: string;
  academicYear: string;
  weekNumber: number;
  existingSlip?: any;
  prevSlip?: {
    currentJuz?: number | null;
    currentSafah?: number | null;
    totalMarks?: number | null;
    overallPerformance?: number | null;
    murajaatSabqi?: string | null;
  } | null;
  muhaffizName?: string;
  musaidName?: string;
  isAdmin?: boolean;
  teachers?: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function WeeklySlipFormModal({
  student,
  marhala,
  academicYear,
  weekNumber,
  existingSlip,
  prevSlip,
  muhaffizName,
  musaidName,
  isAdmin = false,
  teachers,
  onClose,
  onSuccess,
}: WeeklySlipFormModalProps) {
  const studentName =
    student.name ||
    fullName(student.user) ||
    "Student";
  const studentArabicName = (student as any)?.nameAr || (existingSlip?.student as any)?.nameAr || null;

  const [formData, setFormData] = useState({
    currentJuz: existingSlip?.currentJuz ?? prevSlip?.currentJuz ?? "",
    currentSafah: existingSlip?.currentSafah ?? (prevSlip?.currentSafah ? prevSlip.currentSafah + 1 : ""),
    sabaqLines: existingSlip?.sabaqLines ?? 15,
    murajaatSabqi: existingSlip?.murajaatSabqi ?? prevSlip?.murajaatSabqi ?? "",
    disciplineRating: existingSlip?.disciplineRating ?? 5,
    murajaatMarks: existingSlip?.murajaatMarks ?? 20,
    juzhaliMarks: existingSlip?.juzhaliMarks ?? 20,
    jadeedMarks: existingSlip?.jadeedMarks ?? 10,
    teacherNotes: existingSlip?.teacherNotes ?? "",
    adminNotes: existingSlip?.adminNotes ?? "",
    facultyId: existingSlip?.facultyId ?? "",
  });
  const [adminTeachers, setAdminTeachers] = useState<any[]>(teachers || []);
  // Load teachers for admin re-assign if not provided
  useEffect(() => {
    if (isAdmin && !teachers?.length) {
      fetch("/api/admin/hifz-marhala?academicYear=" + academicYear)
        .then((r) => r.json())
        .then((j) => {
          if (j.success && j.data?.teachers) setAdminTeachers(j.data.teachers);
        })
        .catch(() => {});
    }
  }, [isAdmin, teachers, academicYear]);

  const [saving, setSaving] = useState<null | "DRAFT" | "SUBMITTED" | "PUBLISHED">(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  const totalMarks =
    (Number(formData.murajaatMarks) || 0) +
    (Number(formData.juzhaliMarks) || 0) +
    (Number(formData.jadeedMarks) || 0);

  const overallPerformance = totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0;
  const tier = perfTier(overallPerformance);
  const mColor = marhalaColor(marhala);
  const statusCfg = existingSlip?.status ? slipStatus(existingSlip.status) : null;

  const clamp = (v: string, max: number) => {
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(n, max));
  };

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setFormData((prev) => ({
      ...prev,
      murajaatMarks: preset.murajaat,
      juzhaliMarks: preset.juzhali,
      jadeedMarks: preset.jadeed,
      disciplineRating: preset.rating,
      teacherNotes: prev.teacherNotes ? `${prev.teacherNotes} — ${preset.note}` : preset.note,
    }));
    toast({ title: "Quick rating applied", description: preset.name, variant: "success" });
  };

  const handleAutoIncrementSafah = () => {
    const prev = Number(prevSlip?.currentSafah) || 0;
    setFormData((p) => ({
      ...p,
      currentSafah: prev + 1,
      currentJuz: prevSlip?.currentJuz || p.currentJuz,
    }));
    toast({ title: "Auto continue", description: `Next page set (${prev + 1})`, variant: "success" });
  };

  const handleAddSnippet = (snippet: string) => {
    setFormData((prev) => ({
      ...prev,
      teacherNotes: prev.teacherNotes ? `${prev.teacherNotes} | ${snippet}` : snippet,
    }));
  };

  const handleSave = async (status: "DRAFT" | "SUBMITTED" | "PUBLISHED") => {
    setSaving(status);
    try {
      const endpoint = isAdmin ? "/api/admin/hifz-marhala/weekly-slip" : "/api/teacher/hifz-weekly-slip";
      const payload = isAdmin
        ? { id: existingSlip?.id, status, ...formData, totalMarks, overallPerformance, facultyId: formData.facultyId || undefined }
        : {
            studentId: student.id || student.studentId,
            marhala,
            academicYear,
            weekNumber,
            status,
            prevJuz: prevSlip?.currentJuz,
            prevSafah: prevSlip?.currentSafah,
            ...formData,
          };
      const method = isAdmin ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: status === "PUBLISHED" ? "Published to parents 🎉" : status === "SUBMITTED" ? "Submitted to admin" : "Draft saved",
          description: `Week ${weekNumber} slip for ${studentName}`,
          variant: "success",
        });
        onSuccess();
        onClose();
      } else {
        toast({ title: "Error", description: result.error || "Failed to save slip", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const slipText = useMemo(
    () =>
      `📊 *Weekly Hifz Slip — Dar-e-Burhani* 📖
━━━━━━━━━━━━━━━━
👤 *Hafiz Talabt (حفظ طلبة):* ${studentName}${studentArabicName ? ` (${studentArabicName})` : ""}${student.its ? ` · ITS: ${student.its}` : ""}
👨‍🏫 *Muhaffiz (المُحَفِّظ):* ${muhaffizName || "—"}${musaidName ? ` | *Musa'id (المُسَاعِد):* ${musaidName}` : ""}
📌 *Marhala (المرحلة):* ${MARHALA_LABELS[marhala] || marhala} (${MARHALA_LABELS_AR[marhala] || ""})
📅 *Week (الأسبوع):* ${weekNumber} | AY ${academicYear}

📖 *New Memorization — Sabaq (سبق):*
- Current Juz (الجزء): ${formData.currentJuz || "—"} | Page (الصفحة): ${formData.currentSafah || "—"}
- Amount: ${formData.sabaqLines || 0} lines / pages

🔄 *Revision — Sabiqi (سبقي):* ${formData.murajaatSabqi || "Scheduled revision completed"}
⭐ *Commitment (الالتزام):* ${"⭐".repeat(Number(formData.disciplineRating) || 5)}

🎯 *Marks (الدرجات — out of 50):*
- Revision / Murajaat (مراجعة) (20): ${formData.murajaatMarks}
- Current Juz / Juzhali (الجزء الحالي) (20): ${formData.juzhaliMarks}
- New / Jadeed (جديد) (10): ${formData.jadeedMarks}
🏆 *Total (المجموع):* ${totalMarks}/50 (*${overallPerformance}%*)

📝 *Teacher Notes (ملاحظات المعلم):*
${formData.teacherNotes || "Good and blessed effort, may Allah reward it."}
━━━━━━━━━━━━━━━━
_Dar-e-Burhani — Quran Memorization Progress Tracker_`,
    [studentName, studentArabicName, student.its, marhala, weekNumber, academicYear, formData, totalMarks, overallPerformance, muhaffizName, musaidName]
  );

  const handleCopyWhatsAppCard = () => {
    navigator.clipboard.writeText(slipText);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
    toast({ title: "WhatsApp card copied", description: "Paste it to the parent directly", variant: "success" });
  };

  const printSlip = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const stars = "⭐".repeat(Number(formData.disciplineRating) || 5);
    // Al-Kanz is served from /Al-Kanz.ttf (same origin) — embed it so printed Arabic matches the app
    w.document.write(`<!DOCTYPE html><html><head><title>Weekly Hifz Slip — ${studentName} — Week ${weekNumber}</title>
    <style>
      @font-face{font-family:'Al-Kanz';src:url('/Al-Kanz.ttf') format('truetype');font-display:swap;}
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#f8fafc}
      .ar{font-family:'Al-Kanz',Arial,sans-serif;direction:rtl;unicode-bidi:isolate}
      .bracket-ar{font-family:'Al-Kanz',Arial,sans-serif;unicode-bidi:isolate;color:#047857}
      .card{max-width:640px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)}
      .hdr{background:linear-gradient(135deg,#065f46,#022c22);color:#fff;padding:26px;text-align:center;position:relative}
      .hdr:after{content:"";position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#d4af37,transparent)}
      .hdr h1{font-size:22px;letter-spacing:.5px}
      .hdr h1 .ar{font-size:26px}
      .hdr p{color:#a7f3d0;font-size:12px;margin-top:4px}
      .bd{padding:24px}
      .row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
      .row:last-child{border-bottom:none}
      .lbl{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
      .lbl .bracket-ar{text-transform:none;letter-spacing:0;font-size:13px}
      .val{font-weight:700;color:#0f172a}
      .val .bracket-ar{font-size:15px}
      .sec{margin-top:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
      .sec h3{font-size:13px;color:#065f46;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
      .sec h3 .bracket-ar{text-transform:none;letter-spacing:0;font-size:14px}
      .marks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}
      .mk{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
      .mk b{display:block;font-size:20px;color:#065f46}
      .mk span{font-size:11px;color:#64748b}
      .mk .bracket-ar{display:block;font-size:12px;color:#047857;margin-top:2px}
      .tot{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#065f46,#047857);color:#fff;border-radius:12px;padding:14px 18px;margin-top:14px}
      .tot .pct{font-size:24px;font-weight:800;color:#fcd34d}
      .note{margin-top:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:13px;color:#78350f}
      .ft{text-align:center;padding:14px;color:#94a3b8;font-size:11px;border-top:1px solid #f1f5f9}
    </style></head><body>
    <div class="card">
      <div class="hdr">
        <h1>📖 Weekly Hifz Slip <span class="ar">(سجل الحفظ الأسبوعي)</span></h1>
        <p>Dar-e-Burhani · Week ${weekNumber} · ${MARHALA_LABELS[marhala] || marhala} <span class="ar">(${MARHALA_LABELS_AR[marhala] || ""})</span> · AY ${academicYear}</p>
      </div>
      <div class="bd">
        <div class="row"><span class="lbl">Hafiz Talabt <span class="bracket-ar">(حفظ طلبة)</span></span><span class="val">${studentName}${studentArabicName ? ` <span class="bracket-ar">(${studentArabicName})</span>` : ""}${student.its ? ` · ITS ${student.its}` : ""}</span></div>
        <div class="row"><span class="lbl">Muhaffiz <span class="bracket-ar">(المُحَفِّظ)</span></span><span class="val">${muhaffizName || "—"}</span></div>
        <div class="row"><span class="lbl">Musa'id <span class="bracket-ar">(المُسَاعِد)</span></span><span class="val">${musaidName || "— (not assigned)"}</span></div>
        <div class="row"><span class="lbl">Current Juz / Page <span class="bracket-ar">(الجزء / الصفحة)</span></span><span class="val">${formData.currentJuz || "—"} / ${formData.currentSafah || "—"}</span></div>
        <div class="row"><span class="lbl">New lines this week <span class="bracket-ar">(السطور الجديدة)</span></span><span class="val">${formData.sabaqLines || 0}</span></div>
        <div class="row"><span class="lbl">Sabiqi revision <span class="bracket-ar">(مراجعة سبقي)</span></span><span class="val" style="max-width:60%;text-align:right">${formData.murajaatSabqi || "—"}</span></div>
        <div class="row"><span class="lbl">Commitment <span class="bracket-ar">(الالتزام)</span></span><span class="val">${stars}</span></div>
        <div class="sec">
          <h3>Marks out of 50 <span class="bracket-ar">(الدرجات من ٥٠)</span></h3>
          <div class="marks">
            <div class="mk"><b>${formData.murajaatMarks || 0}</b><span>Revision · 20</span><span class="bracket-ar">مراجعة</span></div>
            <div class="mk"><b>${formData.juzhaliMarks || 0}</b><span>Current Juz · 20</span><span class="bracket-ar">الجزء الحالي</span></div>
            <div class="mk"><b>${formData.jadeedMarks || 0}</b><span>New · 10</span><span class="bracket-ar">جديد</span></div>
          </div>
          <div class="tot"><span>Total — ${tier.label} <span class="ar">(المجموع)</span></span><span class="pct">${totalMarks}/50 · ${overallPerformance}%</span></div>
        </div>
        <div class="note"><b>Teacher notes <span class="bracket-ar">(ملاحظات المعلم)</span>:</b> ${formData.teacherNotes || "Good and blessed effort, may Allah reward it."}</div>
      </div>
      <div class="ft">Darse Burhani · Generated ${new Date().toLocaleDateString()}</div>
    </div></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-50 rounded-[1.75rem] shadow-2xl ring-1 ring-black/10 flex flex-col animate-in fade-in-90 slide-in-from-bottom-4 duration-300">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-950 px-5 sm:px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-12 h-12 rounded-2xl border border-white/20 shadow-md shrink-0">
                {((student as any).user?.avatarUrl || (student as any).avatarUrl || existingSlip?.student?.user?.avatarUrl) && (
                  <AvatarImage
                    src={(student as any).user?.avatarUrl || (student as any).avatarUrl || existingSlip?.student?.user?.avatarUrl}
                    alt={studentName}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 text-emerald-950 font-bold text-lg rounded-2xl">
                  {studentName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-amber-50 truncate">
                    Weekly Hifz Slip <span className="font-arabic text-amber-200">(سجل الحفظ الأسبوعي)</span>
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-emerald-950">
                    Week {weekNumber} <span className="font-arabic">الأسبوع</span>
                  </span>
                  {statusCfg && (
                    <Badge className={cn(statusCfg.bgColor, statusCfg.color, "text-[10px] border-0")}>
                      {statusCfg.label}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-emerald-200/80 truncate">
                  {studentName}
                  {studentArabicName ? <span className="font-arabic text-emerald-100/90"> ({studentArabicName})</span> : null}
                  {student.its ? ` · ITS ${student.its}` : ""} · {MARHALA_LABELS[marhala] || marhala}
                  <span className="font-arabic text-emerald-100/90"> ({MARHALA_LABELS_AR[marhala] || ""})</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={printSlip}
                className="text-emerald-200 hover:text-white hover:bg-white/10 text-xs hidden sm:inline-flex"
                title="Print slip"
              >
                <Printer className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyWhatsAppCard}
                className="text-amber-200 hover:text-white hover:bg-white/10 text-xs hidden md:inline-flex"
                title="Copy as WhatsApp card"
              >
                {copiedWhatsApp ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                {copiedWhatsApp ? "Copied" : "WhatsApp"}
              </Button>
              <button onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* gold hairline */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        </div>

        {/* ── Content ── */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Teacher identity strip — bilingual */}
          {(muhaffizName || musaidName) && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {muhaffizName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-emerald-800 font-medium shadow-sm">
                  <User className="w-3 h-3 text-emerald-600" /> Muhaffiz <span className="font-arabic text-emerald-700">(المُحَفِّظ)</span>: {muhaffizName}
                </span>
              )}
              {musaidName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 font-medium shadow-sm">
                  <User className="w-3 h-3 text-blue-600" /> Musa&apos;id <span className="font-arabic text-blue-700">(المُسَاعِد)</span>: {musaidName}
                </span>
              )}
            </div>
          )}

          {/* Previous week carryover */}
          {prevSlip && (
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-l from-indigo-50 via-blue-50 to-emerald-50 shadow-sm">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-indigo-500 via-blue-500 to-emerald-500" />
              <div className="p-4 pl-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-indigo-200 shadow-sm flex items-center justify-center">
                      <Clock className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                        Continue from last week
                        <Badge className="bg-indigo-600 text-white border-0 text-[10px]">Week {weekNumber - 1}</Badge>
                      </h4>
                      <p className="text-xs text-indigo-700/80">Loaded automatically — pick up where you left off</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoIncrementSafah}
                    className="bg-white hover:bg-indigo-100 text-indigo-800 border-indigo-300 text-xs h-8 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Auto +1 Page
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { l: "Juz", v: prevSlip.currentJuz || "—", c: "text-indigo-700" },
                    { l: "Page", v: prevSlip.currentSafah || "—", c: "text-indigo-700" },
                    { l: "Prev Total", v: `${prevSlip.totalMarks || 0}/50`, c: "text-slate-800" },
                    { l: "Prev Perf.", v: `${prevSlip.overallPerformance || 0}%`, c: (prevSlip.overallPerformance || 0) >= 60 ? "text-emerald-600" : "text-amber-600" },
                  ].map((x) => (
                    <div key={x.l} className="p-2.5 rounded-xl bg-white/90 border border-indigo-100 text-center shadow-sm">
                      <p className="text-xs text-gray-500 mb-0.5">{x.l}</p>
                      <p className={cn("text-base font-bold", x.c)}>{x.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" /> Quick Rating Presets
              </Label>
              <span className="text-xs text-slate-400">One click to fill marks</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-1 cursor-pointer",
                    p.tone
                  )}
                >
                  <span>{p.name}</span>
                  <span className="font-normal opacity-80 tabular-nums">
                    {p.murajaat}+{p.juzhali}+{p.jadeed} = {p.murajaat + p.juzhali + p.jadeed}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sabaq section — double-bezel */}
          <div className="p-1.5 rounded-2xl bg-slate-200/60 ring-1 ring-black/5">
            <div className="p-4 rounded-[calc(1rem-0.2rem)] bg-white space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                </span>
                Sabaq &amp; Murajaat <span className="font-arabic text-emerald-700">(سبق ومراجعة)</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Current Juz (1–30)</Label>
                  <Input
                    type="number" min={1} max={30}
                    value={formData.currentJuz}
                    onChange={(e) => setFormData({ ...formData, currentJuz: e.target.value })}
                    className="text-center font-bold bg-slate-50 h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Current Page (1–20)</Label>
                  <Input
                    type="number" min={1} max={20}
                    value={formData.currentSafah}
                    onChange={(e) => setFormData({ ...formData, currentSafah: e.target.value })}
                    className="text-center font-bold bg-slate-50 h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">New Lines / Pages</Label>
                  <Input
                    type="number" min={0}
                    value={formData.sabaqLines}
                    onChange={(e) => setFormData({ ...formData, sabaqLines: e.target.value })}
                    className="text-center font-bold bg-slate-50 h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Commitment &amp; Tajweed</Label>
                  <div className="flex items-center justify-center gap-1 h-10 bg-slate-50 rounded-xl border border-slate-200 px-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, disciplineRating: star })}
                        className="hover:scale-125 transition-transform"
                        aria-label={`Rate ${star}`}
                      >
                        <Star className={cn("w-4 h-4", star <= Number(formData.disciplineRating) ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">
                Revision Parts — Sabiqi &amp; Past <span className="font-arabic text-emerald-700">(مراجعة سبقي)</span>
              </Label>
                <Input
                  value={formData.murajaatSabqi}
                  onChange={(e) => setFormData({ ...formData, murajaatSabqi: e.target.value })}
                  placeholder="e.g. Revise Juz 1 to 3 completely with consolidation"
                  className="bg-slate-50 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Marks section — double-bezel, live total */}
          <div className="p-1.5 rounded-2xl bg-emerald-900/90 ring-1 ring-emerald-950/40">
            <div className="p-4 rounded-[calc(1rem-0.2rem)] bg-emerald-50/95 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-white border border-emerald-200 flex items-center justify-center">
                    <Award className="w-3.5 h-3.5 text-emerald-700" />
                  </span>
                  Marks &amp; Weekly Performance <span className="font-arabic text-emerald-700">(الدرجات والأداء الأسبوعي)</span>
                </h4>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-extrabold text-emerald-900 tabular-nums">{totalMarks}<span className="text-emerald-700/60 text-sm font-bold">/50</span></span>
                  <Badge className={cn(
                    "text-xs font-bold px-3 py-1 border-0 text-white",
                    overallPerformance >= 80 ? "bg-emerald-600" : overallPerformance >= 60 ? "bg-teal-600" : overallPerformance >= 40 ? "bg-amber-500" : "bg-red-500"
                  )}>
                    {overallPerformance}%
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "murajaatMarks" as const, label: "Revision", ar: ROLE_LABELS_AR.SABIQI, max: 20 },
                  { key: "juzhaliMarks" as const, label: "Current Juz", ar: "الجزء الحالي", max: 20 },
                  { key: "jadeedMarks" as const, label: "New", ar: ROLE_LABELS_AR.JADEED, max: 10 },
                ].map((f) => (
                  <div key={f.key} className="p-3 bg-white rounded-xl border border-emerald-100 text-center shadow-sm">
                    <Label className="text-xs font-bold text-slate-600 block mb-1">
                      {f.label} <span className="font-arabic text-emerald-700">({f.ar})</span> ({f.max})
                    </Label>
                    <Input
                      type="number" min={0} max={f.max}
                      value={formData[f.key]}
                      onChange={(e) => setFormData({ ...formData, [f.key]: clamp(e.target.value, f.max) })}
                      className="text-center font-bold text-lg h-10"
                    />
                  </div>
                ))}
              </div>
              <div className="h-2.5 bg-emerald-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{ width: `${overallPerformance}%`, background: tier.grad }}
                />
              </div>
              <p className="text-[11px] text-emerald-800/70 text-right">{tier.label} · Overall Performance {overallPerformance}%</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-700" /> Notes for Parents <span className="font-arabic text-emerald-700">(ملاحظات لولي الأمر)</span>
              </Label>
              <span className="text-xs text-slate-400">Tap a phrase to insert</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FEEDBACK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAddSnippet(chip)}
                  className="text-xs bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-900 border border-slate-200 hover:border-amber-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer shadow-sm"
                >
                  + {chip}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={formData.teacherNotes}
              onChange={(e) => setFormData({ ...formData, teacherNotes: e.target.value })}
              placeholder="Write notes about strengths, improvements and guidance for parents..."
              className="w-full p-3 rounded-2xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
            />
          </div>

          {/* Admin: re-assign to teacher (smooth joint flow) */}
          {isAdmin && (
            <div className="p-1.5 rounded-2xl bg-indigo-50 ring-1 ring-indigo-200">
              <div className="p-3.5 rounded-[calc(1rem-0.2rem)] bg-white space-y-3">
                <Label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" /> Re-assign Muhaffiz <span className="font-arabic text-indigo-700">(المُحَفِّظ)</span> — Admin smooth flow
                </Label>
                <select
                  value={formData.facultyId || ""}
                  onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                  className="w-full h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">— Keep current ({muhaffizName || "unassigned"}) —</option>
                  {adminTeachers.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {(t.user?.firstName || "") + " " + (t.user?.lastName || "")} {t.department ? `— ${t.department}` : ""} — {t.employeeId || t.id.slice(0,6)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Assigning here instantly moves this slip (and future drafts for this hafiz) to the chosen teacher. Teacher gets notified.</p>
              </div>
            </div>
          )}

          {/* Admin internal notes */}
          {isAdmin && (
            <div className="p-1.5 rounded-2xl bg-amber-100/70 ring-1 ring-amber-900/10">
              <div className="p-3.5 rounded-[calc(1rem-0.2rem)] bg-amber-50/80 space-y-1.5">
                <Label className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Admin Notes — internal only
                </Label>
                <Input
                  value={formData.adminNotes}
                  onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
                  placeholder="Guidance notes for the muhaffiz or admin..."
                  className="bg-white text-xs"
                />
              </div>
            </div>
          )}

          {/* Read-only hint for admin when viewing a submitted slip */}
          {isAdmin && existingSlip && !existingSlip.status?.match(/^(SUBMITTED|APPROVED|PUBLISHED)$/) && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
              <Eye className="w-3.5 h-3.5" /> You are viewing a draft slip created by the teacher. Edits will update it in place.
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <Button variant="ghost" onClick={onClose} disabled={saving !== null} className="text-slate-500">
              Close
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleSave("DRAFT")}
                disabled={saving !== null}
                className="text-xs"
              >
                <Save className="w-3.5 h-3.5" /> Save as Draft
              </Button>

              {!isAdmin ? (
                <Button
                  onClick={() => handleSave("SUBMITTED")}
                  disabled={saving !== null}
                  className="btn-fatimi-primary text-xs"
                >
                  {saving === "SUBMITTED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit to Admin
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => handleSave(existingSlip?.status && existingSlip.status !== "DRAFT" ? existingSlip.status : "SUBMITTED")}
                    disabled={saving !== null}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    {saving !== null && saving !== "PUBLISHED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Edits
                  </Button>
                  <Button
                    onClick={() => handleSave("PUBLISHED")}
                    disabled={saving !== null}
                    className="btn-fatimi-gold text-xs"
                  >
                    {saving === "PUBLISHED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Publish to Parents
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
