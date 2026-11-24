"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Sparkles,
  BookCheck,
  Printer,
  Copy,
  RotateCw,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  Award,
  Layers,
  ChevronRight,
  Info,
  Download,
  Check,
  Star,
  SlidersHorizontal,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import {
  QURAN_IKHTEBAAR_DATA,
  DARAJAH_LIST,
  getDarajahSyllabus,
  getRandomizedExamPaper,
  type NizamType,
  type QuestionItem,
} from "@/lib/quran-ikhtebaar-data";

export default function QuranIkhtebaarPage() {
  const [nizam, setNizam] = useState<NizamType>("OLD");
  const [selectedDarajah, setSelectedDarajah] = useState<number>(2); // Default to Darajah 2 (Saniya)
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [candidateName, setCandidateName] = useState("");
  const [candidateITS, setCandidateITS] = useState("");
  const [showMarkingGuide, setShowMarkingGuide] = useState(false);

  // Active Nizam configuration
  const nizamConfig = useMemo(() => QURAN_IKHTEBAAR_DATA[nizam], [nizam]);

  // Active Darajah syllabus
  const activeSyllabus = useMemo(
    () => getDarajahSyllabus(nizam, selectedDarajah),
    [nizam, selectedDarajah]
  );

  // Active 6 Questions
  const questions = useMemo(
    () => getRandomizedExamPaper(nizam, selectedDarajah, shuffleSeed),
    [nizam, selectedDarajah, shuffleSeed]
  );

  // Total Marks calculate
  const totalScore = useMemo(() => {
    return questions.reduce((sum, q) => sum + (scores[q.id] || 0), 0);
  }, [questions, scores]);

  const maxTotalMarks = useMemo(() => {
    return questions.reduce((sum, q) => sum + q.marks, 0) || 100;
  }, [questions]);

  // Score status
  const scorePercent = Math.round((totalScore / maxTotalMarks) * 100);
  const isPassed = activeSyllabus ? totalScore >= activeSyllabus.passingMarks : totalScore >= 65;

  // Handle Score Change
  const handleScoreChange = (qId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setScores((prev) => ({ ...prev, [qId]: clamped }));
  };

  // Regenerate questions
  const handleRegenerate = () => {
    setShuffleSeed((prev) => prev + 1);
    setScores({});
    toast({
      title: "تم توليد أسئلة جديدة بنجاح",
      description: `تم تحديث نموذج اختبار ${activeSyllabus?.nameAr} (${nizamConfig.titleAr})`,
      variant: "success",
    });
  };

  // Copy questions to clipboard
  const handleCopyQuestions = () => {
    if (!activeSyllabus) return;
    const textLines = [
      `بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ`,
      `دَرْسٌ بُرْهَانِيٌّ — جَالِيَاكُوت | اخْتِبَارُ القُرْآنِ المَجِيد`,
      `المنهج: ${nizamConfig.titleAr} (${nizamConfig.titleEn})`,
      `الدرجة: ${activeSyllabus.nameAr} (${activeSyllabus.nameEn})`,
      `المقرر: ${activeSyllabus.titleAr} — [${activeSyllabus.juzRangeAr}]`,
      `الدرجة الكبرى: ${activeSyllabus.totalMarks} | درجة النجاح: ${activeSyllabus.passingMarks}`,
      `--------------------------------------------------`,
      ...questions.map(
        (q, idx) =>
          `السؤال ${idx + 1} (${q.typeLabelAr} - [${q.marks} درجات]):\n` +
          `${q.promptAr}\n` +
          `«${q.ayahTextAr}»\n` +
          `[${q.surahNameAr} - الآية ${q.ayahStart}${q.ayahEnd ? ` إلى ${q.ayahEnd}` : ""} - الجزء ${q.juzNumber}]\n` +
          `ملحوظة الممتحن: ${q.examinerNotesAr}\n`
      ),
      `--------------------------------------------------`,
      `تاريخ الاختبار: ${new Date().toLocaleDateString("ar-EG")}`,
    ];

    navigator.clipboard.writeText(textLines.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({
      title: "تم نسخ الأسئلة بنجاح",
      description: "تم نسخ نموذج الاختبار بالكامل إلى الحافظة بصيغة نصية منسقة.",
      variant: "success",
    });
  };

  // Print paper
  const handlePrint = () => {
    window.print();
  };

  // Direct Download for Saniya Alif Excel
  const handleDownloadExcel = () => {
    window.open("/api/tilawat-dua/export-saniya-alif-excel", "_blank");
    toast({
      title: "جاري تحميل كشف الحضور",
      description: "يتم تحميل ملف Excel لحضور تلاوة الدعاء لدرجة ثانية ألف (٢٤ سبتمبر - ٢٤ نوفمبر)",
      variant: "success",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Academics Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Academics & Curriculum"
        hubDescription="Official class matrix, weekly timetables, Takhteet curriculum, Tilawat Dua, and Al Quran Majeed Ikhtebaar."
        tabs={[
          { label: "Classes & Darajahs", href: "/admin/classes", icon: BookOpen },
          { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
          { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
          { label: "Tilawat Dua", href: "/admin/tilawat-dua", icon: Sparkles, badge: "Daily" },
          { label: "Quran Ikhtebaar", href: "/admin/quran-ikhtebaar", icon: BookCheck, badge: "Syllabus" },
        ]}
      />

      {/* ── Header Banner with Fatimi Motif ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl print:hidden"
        style={{
          background: "linear-gradient(135deg, #091322 0%, #0d2036 50%, #044330 100%)",
        }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <BookCheck className="w-3.5 h-3.5" />
                الْمَكْتَبُ التَّعْلِيمِيُّ — الدَّرْسُ الْبُرْهَانِيُّ
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Star className="w-3 h-3 fill-amber-300" />
                منهج حِفْظِ الْقُرْآنِ الْمَجِيد
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>اخْتِبَارُ الْقُرْآنِ الْمَجِيد</span>
              <span className="text-base sm:text-lg font-normal text-slate-300">
                | Al Quran Majeed Ikhtebaar
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-light">
              منظومة امتحانات التلاوة والاستظهار والأحكام القرآنية بـ ٦ أسئلة منهجية وفق المنهجين
              (القديم والحديث) لجميع الدرجات من الأولى إلى العاشرة.
            </p>
          </div>

          {/* Quick Tilawat Dua Excel Download Pill */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Button
              onClick={handleDownloadExcel}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg border border-emerald-400/30 flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-[1.02]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>كشف حضور تلاوة الدعاء (ثانية ألف)</span>
              <Download className="w-3.5 h-3.5 opacity-80" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── 1. NIZAM TOGGLE (Old Nizam vs New Nizam) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              اختر المنهج المعتمد (Nizam Selection)
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            قم بالتبديل بين النظامين لمقارنة المناهج وتوزيع الأسئلة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* OLD NIZAM BUTTON */}
          <button
            type="button"
            onClick={() => setNizam("OLD")}
            className={`relative flex items-start gap-4 p-4 rounded-xl border-2 text-right transition-all cursor-pointer ${
              nizam === "OLD"
                ? "border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/10 dark:border-amber-400 dark:bg-amber-400/5"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                nizam === "OLD"
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <BookOpen className="w-5 h-5" />
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  النظام القديم (Old Nizam)
                </span>
                {nizam === "OLD" && (
                  <Badge className="bg-amber-500 text-white text-[11px] font-semibold">
                    المُفعَّل حالياً
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                المنهج المتبع تاريخياً: جزء عم وتبارك في الأولى، قد سمع والذاريات في الثانية صعوداً
                حتى الختم الشريف.
              </p>
            </div>
          </button>

          {/* NEW NIZAM BUTTON */}
          <button
            type="button"
            onClick={() => setNizam("NEW")}
            className={`relative flex items-start gap-4 p-4 rounded-xl border-2 text-right transition-all cursor-pointer ${
              nizam === "NEW"
                ? "border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/10 dark:border-emerald-400 dark:bg-emerald-400/5"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                nizam === "NEW"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  النظام الجديد (New Nizam)
                </span>
                {nizam === "NEW" && (
                  <Badge className="bg-emerald-600 text-white text-[11px] font-semibold">
                    المُفعَّل حالياً
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                المنهج المطور: جزء عم كامل في الأولى، تبارك وعم في الثانية، تثبيت ٥ أجزاء تدريجياً مع
                أحكام التجويد المتقنة.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── 2. DARAJAH SELECTOR (Grade 1 to Grade 10) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              اختر الدرجة الصفية (Darajah Toggle)
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            الدرجة المحددة: {activeSyllabus?.nameAr}
          </span>
        </div>

        {/* 10 Darajah Pills Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {DARAJAH_LIST.map((d) => {
            const isSelected = selectedDarajah === d.num;
            const syl = getDarajahSyllabus(nizam, d.num);

            return (
              <button
                key={d.num}
                type="button"
                onClick={() => {
                  setSelectedDarajah(d.num);
                  setScores({});
                }}
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "border-emerald-600 dark:border-emerald-400 bg-gradient-to-b from-emerald-500/10 to-emerald-500/20 text-emerald-900 dark:text-emerald-100 font-bold shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/30 scale-[1.02]"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/50"
                }`}
              >
                <span className="text-xs font-semibold">{d.nameAr}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                  Grade {d.num}
                </span>
                {syl && (
                  <span className="mt-1 text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 truncate max-w-full">
                    {syl.juzRangeAr.split("و")[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. ACTIVE SYLLABUS OVERVIEW & CONTROLS ── */}
      {activeSyllabus && (
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm print:hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-emerald-600 text-white font-semibold text-xs px-2.5 py-0.5">
                    {activeSyllabus.nameAr} ({activeSyllabus.nameEn})
                  </Badge>
                  <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs font-medium">
                    {nizamConfig.titleAr}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-medium">
                    المقرر: {activeSyllabus.juzRangeAr}
                  </Badge>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activeSyllabus.titleAr}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                  {activeSyllabus.descriptionAr}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={handleRegenerate}
                  variant="outline"
                  className="flex items-center gap-1.5 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 border-slate-300 dark:border-slate-700"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>توليد أسئلة جديدة</span>
                </Button>

                <Button
                  onClick={handleCopyQuestions}
                  variant="outline"
                  className="flex items-center gap-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "تم النسخ" : "نسخ الأسئلة"}</span>
                </Button>

                <Button
                  onClick={handlePrint}
                  className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 flex items-center gap-1.5 text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة ورقة الاختبار</span>
                </Button>
              </div>
            </div>

            {/* Candidate & Scoring Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
              <div className="md:col-span-4">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  اسم الطالب المُمتحن (Talab Name):
                </label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="مثال: حاتم بن شيخ قطب الدين"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  رقم الهوية / ITS:
                </label>
                <input
                  type="text"
                  value={candidateITS}
                  onChange={(e) => setCandidateITS(e.target.value)}
                  placeholder="مثال: 50463544"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Live Tally Scoreboard */}
              <div className="md:col-span-5 flex items-center justify-between sm:justify-end gap-4 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">مجموع درجات الممتحن</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {totalScore} <span className="text-xs font-normal text-slate-500">/ {maxTotalMarks}</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

                <div className="text-center">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">النسبة المئوية</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {scorePercent}%
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

                <div>
                  <Badge
                    className={
                      totalScore === 0
                        ? "bg-slate-200 text-slate-700 text-xs"
                        : isPassed
                        ? "bg-emerald-600 text-white text-xs font-bold"
                        : "bg-rose-600 text-white text-xs font-bold"
                    }
                  >
                    {totalScore === 0 ? "بانتظار الرصد" : isPassed ? "ناجح ومجاز" : "يحتاج مراجعة"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 4. THE 6 QUESTIONS CARD DECK ── */}
      <div className="space-y-4 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-6 bg-emerald-600 rounded-full" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              الأسئلة الستة المقررة للاختبار ({questions.length} أسئلة منهجية)
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            السؤال 1-6 مصنفة بحسب الأصول المعتمدة في امتحانات القرآن
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {questions.map((q, idx) => {
            const currentScore = scores[q.id] ?? "";

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* Gold Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-teal-500" />

                <div className="space-y-4">
                  {/* Question Header Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold text-sm flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                            السؤال {idx + 1}: {q.typeLabelAr}
                          </h4>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                            ({q.typeLabelEn})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 font-bold text-xs">
                        {q.marks} درجات
                      </Badge>

                      {/* Marks Awarded Input */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          الرصد:
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={q.marks}
                          value={currentScore}
                          onChange={(e) =>
                            handleScoreChange(q.id, parseInt(e.target.value, 10), q.marks)
                          }
                          placeholder={`/${q.marks}`}
                          className="w-12 text-center text-xs font-bold bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 rounded border border-slate-300 dark:border-slate-700 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {q.promptAr}
                    </p>
                  </div>

                  {/* Quranic Ayah Box in Traditional Fatimi Font */}
                  <div
                    className="p-5 sm:p-6 rounded-2xl text-center shadow-inner relative"
                    style={{
                      background: "linear-gradient(180deg, #fafbf9 0%, #f4f7f3 100%)",
                      border: "1px solid #d1dbd0",
                    }}
                  >
                    <div className="absolute top-2 right-3 text-amber-600/30 text-xs font-serif">
                      ۝
                    </div>
                    <div className="absolute bottom-2 left-3 text-amber-600/30 text-xs font-serif">
                      ۝
                    </div>

                    <p
                      dir="rtl"
                      className="text-lg sm:text-2xl font-serif text-slate-900 leading-loose tracking-wide px-2 select-text"
                      style={{
                        fontFamily: "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Lateef', serif",
                      }}
                    >
                      {q.ayahTextAr}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-center gap-3 text-xs text-slate-600 flex-wrap">
                      <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-md">
                        {q.surahNameAr} ({q.surahNameEn})
                      </span>
                      <span>•</span>
                      <span>
                        الآية {q.ayahStart}
                        {q.ayahEnd ? ` إلى ${q.ayahEnd}` : ""}
                      </span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">الجزء {q.juzNumber}</span>
                    </div>
                  </div>

                  {/* Examiner Guidance & Tajweed Rules */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-xl flex items-start gap-2">
                      <Info className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-0.5">
                          توجيه الممتحن:
                        </span>
                        <p className="text-emerald-800 dark:text-emerald-200 leading-relaxed">
                          {q.examinerNotesAr}
                        </p>
                      </div>
                    </div>

                    {q.tajweedFocus && (
                      <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl flex items-start gap-2">
                        <Award className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">
                            التركيز التجويدي:
                          </span>
                          <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                            {q.tajweedFocus}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── 5. OFFICIAL PRINTABLE PAPER (Shown only on Print) ── */}
      <div className="hidden print:block p-8 space-y-6 text-black bg-white">
        {/* Header */}
        <div className="text-center space-y-1 pb-4 border-b-2 border-black">
          <div className="text-sm font-bold">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
          <div className="text-xl font-extrabold tracking-wide">
            دَرْسٌ بُرْهَانِيٌّ — جَالِيَاكُوت | الْـمَكْتَبُ التَّعْلِيمِيُّ
          </div>
          <div className="text-base font-bold">
            وَرَقَةُ اخْتِبَارِ الْقُرْآنِ الْمَجِيد — {activeSyllabus?.nameAr}
          </div>
          <div className="text-xs text-gray-700">
            المنهج المعتمد: {nizamConfig.titleAr} | المقرر: {activeSyllabus?.titleAr} ({activeSyllabus?.juzRangeAr})
          </div>
        </div>

        {/* Student Meta Table */}
        <table className="w-full text-xs border border-black border-collapse my-3">
          <tbody>
            <tr>
              <td className="p-2 border border-black font-bold bg-gray-100 w-1/4">اسم الطالب (Talab):</td>
              <td className="p-2 border border-black w-1/4">{candidateName || "_______________________"}</td>
              <td className="p-2 border border-black font-bold bg-gray-100 w-1/4">رقم الهوية / ITS:</td>
              <td className="p-2 border border-black w-1/4">{candidateITS || "_______________________"}</td>
            </tr>
            <tr>
              <td className="p-2 border border-black font-bold bg-gray-100">التاريخ:</td>
              <td className="p-2 border border-black">{new Date().toLocaleDateString("en-GB")}</td>
              <td className="p-2 border border-black font-bold bg-gray-100">الدرجة الكبرى / النجاح:</td>
              <td className="p-2 border border-black">
                {activeSyllabus?.totalMarks} درجة / {activeSyllabus?.passingMarks} درجة
              </td>
            </tr>
          </tbody>
        </table>

        {/* Print Questions */}
        <div className="space-y-5">
          {questions.map((q, idx) => (
            <div key={q.id} className="border border-black p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center border-b border-gray-400 pb-1">
                <span className="font-bold text-sm">
                  السؤال {idx + 1}: {q.typeLabelAr} ({q.typeLabelEn})
                </span>
                <span className="font-bold text-xs">[{q.marks} درجات] | الرصد: [____]</span>
              </div>

              <div className="text-xs font-semibold">{q.promptAr}</div>

              <div
                dir="rtl"
                className="text-base font-serif p-3 bg-gray-50 rounded border border-gray-300 text-center leading-loose"
                style={{
                  fontFamily: "'Amiri', 'Traditional Arabic', serif",
                }}
              >
                {q.ayahTextAr}
              </div>

              <div className="flex justify-between text-[11px] text-gray-700">
                <span>
                  الموضع: {q.surahNameAr} — الآية {q.ayahStart} — الجزء {q.juzNumber}
                </span>
                <span>التركيز: {q.tajweedFocus || q.examinerNotesAr}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Examiner Signature Footer */}
        <div className="pt-8 flex justify-between items-end text-xs">
          <div className="text-center space-y-8">
            <div>توقيع الممتحن الأول: ____________________</div>
          </div>
          <div className="text-center space-y-2">
            <div className="font-bold">المجموع النهائي: [ ________ / {maxTotalMarks} ]</div>
            <div className="text-[11px]">النتيجة: [  ] ناجح ومجاز   [  ] إعادة اختبار</div>
          </div>
          <div className="text-center space-y-8">
            <div>اعتماد مسؤول المكتب: ____________________</div>
          </div>
        </div>
      </div>
    </div>
  );
}
