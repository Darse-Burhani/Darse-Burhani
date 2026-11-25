"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  Check,
  BookMarked,
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  Maximize2,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { FatimiCornerBracket } from "@/components/FatimiOrnaments";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  QURAN_IKHTEBAAR_DATA,
  DARAJAH_LIST,
  getDarajahSyllabus,
  getRandomizedExamPaper,
  type NizamType,
  type QuestionItem,
} from "@/lib/quran-ikhtebaar-data";

interface MushafWord {
  id: number;
  text: string;
  lineNumber: number;
  pageNumber: number;
  verseKey: string;
  isEnd: boolean;
}

interface MushafPageData {
  pageNumber: number;
  lines: Record<number, MushafWord[]>;
}

const mushafPageCache = new Map<number, MushafPageData>();

const EASTERN_TO_WESTERN: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function getDisplayedAyahEnd(q: QuestionItem): number {
  const matches = Array.from(q.ayahTextAr.matchAll(/﴿([٠-٩0-9]+)﴾/g));
  if (matches.length === 0) return q.ayahStart;
  const nums = matches
    .map((m) =>
      parseInt(
        m[1].replace(/[٠-٩]/g, (d) => EASTERN_TO_WESTERN[d] ?? d),
        10
      )
    )
    .filter((n) => !isNaN(n));
  return nums.length > 0 ? Math.max(...nums) : q.ayahStart;
}

async function fetchMushafPage(pageNumber: number): Promise<MushafPageData> {
  const cached = mushafPageCache.get(pageNumber);
  if (cached) return cached;

  const res = await fetch(
    `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&word_fields=text_imlaei,line_number,page_number&per_page=50`
  );
  if (!res.ok) throw new Error("Failed to load Mushaf page");
  const json = await res.json();
  const verses = Array.isArray(json?.verses) ? json.verses : [];

  const lines: Record<number, MushafWord[]> = {};
  for (const v of verses) {
    const verseKey = String(v.verse_key || "");
    const words = Array.isArray(v.words) ? v.words : [];
    for (const w of words) {
      const ln = Number(w.line_number) || 1;
      if (!lines[ln]) lines[ln] = [];
      const isEnd = w.char_type_name === "end";
      const rawText = String(w.text_imlaei || w.text || "");
      lines[ln].push({
        id: Number(w.id),
        text: isEnd ? `﴿${rawText}﴾` : rawText,
        lineNumber: ln,
        pageNumber: Number(w.page_number) || pageNumber,
        verseKey,
        isEnd,
      });
    }
  }

  const data: MushafPageData = { pageNumber, lines };
  mushafPageCache.set(pageNumber, data);
  return data;
}

export default function QuranIkhtebaarPage() {
  const [nizam, setNizam] = useState<NizamType>("OLD");
  const [selectedDarajah, setSelectedDarajah] = useState<number>(2);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Mushaf Page Popup State
  const [activeMushafQuestion, setActiveMushafQuestion] = useState<QuestionItem | null>(null);
  const [mushafLoading, setMushafLoading] = useState(false);
  const [mushafError, setMushafError] = useState<string | null>(null);
  const [mushafPage, setMushafPage] = useState<MushafPageData | null>(null);
  const [highlightBounds, setHighlightBounds] = useState<{
    surah: number;
    ayahStart: number;
    ayahEnd: number;
  } | null>(null);
  const firstHighlightRef = useRef<HTMLSpanElement | null>(null);

  const nizamConfig = useMemo(() => QURAN_IKHTEBAAR_DATA[nizam], [nizam]);

  const activeSyllabus = useMemo(
    () => getDarajahSyllabus(nizam, selectedDarajah),
    [nizam, selectedDarajah]
  );

  const questions = useMemo(
    () => getRandomizedExamPaper(nizam, selectedDarajah, shuffleSeed, seenIds),
    [nizam, selectedDarajah, shuffleSeed, seenIds]
  );

  const maxTotalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + q.marks, 0) || 60,
    [questions]
  );

  const handleScoreChange = (qId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setScores((prev) => ({ ...prev, [qId]: clamped }));
  };

  const handleRegenerate = () => {
    setSeenIds((prev) => {
      const next = [...prev, ...questions.map((q) => q.id)];
      return next.length > 24 ? questions.map((q) => q.id) : next;
    });
    setShuffleSeed((prev) => prev + 1);
    setScores({});
    toast({
      title: "New question set ready",
      description: `${activeSyllabus?.nameEn} · ${nizamConfig.titleEn} (6 distinct Juz)`,
      variant: "success",
    });
  };

  const handleCopyQuestions = () => {
    if (!questions.length) return;
    const textLines = questions.map(
      (q, idx) =>
        `Question ${idx + 1} (${q.marks} Marks)\n` +
        `${q.promptEn}\n` +
        `${q.ayahTextAr}\n` +
        `[${q.surahNameEn} · Ayah ${q.ayahStart}${q.ayahEnd ? `–${q.ayahEnd}` : ""} · Juz ${q.juzNumber}]`
    );

    navigator.clipboard.writeText(textLines.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({
      title: "Copied 6 questions",
      description: "All 6 examination questions copied to clipboard.",
      variant: "success",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const openMushafPopup = useCallback(async (q: QuestionItem) => {
    setActiveMushafQuestion(q);
    setMushafLoading(true);
    setMushafError(null);
    setMushafPage(null);
    setHighlightBounds({
      surah: q.surahNumber,
      ayahStart: q.ayahStart,
      ayahEnd: getDisplayedAyahEnd(q),
    });

    try {
      const verseKey = `${q.surahNumber}:${q.ayahStart}`;
      const keyRes = await fetch(
        `https://api.quran.com/api/v4/verses/by_key/${verseKey}?words=true&word_fields=text_imlaei,line_number,page_number`
      );
      if (!keyRes.ok) throw new Error("Could not locate Mushaf page");
      const keyJson = await keyRes.json();
      const startPage = Number(keyJson?.verse?.page_number) || 1;
      const pageData = await fetchMushafPage(startPage);
      setMushafPage(pageData);
    } catch {
      setMushafError("Unable to load full Mushaf page offline. Showing question Ayah.");
    } finally {
      setMushafLoading(false);
    }
  }, []);

  const closeMushafPopup = useCallback(() => {
    setActiveMushafQuestion(null);
  }, []);

  useEffect(() => {
    if (!activeMushafQuestion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMushafPopup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeMushafQuestion, closeMushafPopup]);

  useEffect(() => {
    if (!mushafLoading && mushafPage && firstHighlightRef.current) {
      firstHighlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [mushafLoading, mushafPage]);

  const isQuestionWord = (wordVerseKey: string): boolean => {
    if (!highlightBounds) return false;
    const [s, a] = wordVerseKey.split(":").map(Number);
    return (
      s === highlightBounds.surah &&
      a >= highlightBounds.ayahStart &&
      a <= highlightBounds.ayahEnd
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-7 pb-28 sm:pb-32 lg:pb-14 space-y-5 min-w-0 selection:bg-[#f3b833]/30 selection:text-[#221c12]">
      {/* ── Academics Hub Navigation Tabs ── */}
      <div className="print:hidden">
        <AdminHubTabs
          hubTitle="Academics & Curriculum"
          hubDescription="Classes, weekly timetable, Takhteet, Tilawat Dua, and Quran Ikhtebaar."
          tabs={[
            { label: "Classes & Darajahs", href: "/admin/classes", icon: BookOpen },
            { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
            { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
            { label: "Tilawat Dua", href: "/admin/tilawat-dua", icon: Sparkles, badge: "Daily" },
            { label: "Quran Ikhtebaar", href: "/admin/quran-ikhtebaar", icon: BookCheck, badge: "Syllabus" },
          ]}
        />
      </div>

      {/* ── 1. NIZAM & DARAJAH CONTROLS ── */}
      <section
        aria-label="Curriculum and Darajah selector"
        className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e7e0d0] shadow-[0_2px_10px_-3px_rgba(34,28,18,0.06)] space-y-4 print:hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#221c12]">
            <SlidersHorizontal className="w-4 h-4 text-[#a37a1a]" />
            <span>Select Curriculum &amp; Darajah</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nizam Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-[#f4efe5] border border-[#e7e0d0]">
              {(["OLD", "NEW"] as const).map((type) => {
                const active = nizam === type;
                const cfg = QURAN_IKHTEBAAR_DATA[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setNizam(type);
                      setSeenIds([]);
                      setScores({});
                    }}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3b833] ${
                      active
                        ? "bg-[#221c14] text-[#fcd468] shadow-sm border border-[#f3b833]/30"
                        : "text-[#3d3426] hover:text-[#221c12] hover:bg-white/70"
                    }`}
                  >
                    <span>{cfg.titleEn}</span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className={`font-alkanz text-sm font-normal ${
                        active ? "text-[#fcd468]" : "text-[#7a5a13]"
                      }`}
                      style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                    >
                      {cfg.titleAr}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Paper Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRegenerate}
                variant="outline"
                className="min-h-[44px] px-3.5 text-xs sm:text-[13px] font-semibold border-[#e7e0d0] text-[#221c12] hover:bg-[#faf7f0] flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#a37a1a]" />
                <span>Shuffle</span>
              </Button>

              <Button
                onClick={handleCopyQuestions}
                variant="outline"
                className="min-h-[44px] px-3.5 text-xs sm:text-[13px] font-semibold border-[#e7e0d0] text-[#221c12] hover:bg-[#faf7f0] flex items-center gap-1.5"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#a37a1a]" />
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>

              <Button
                onClick={handlePrint}
                className="min-h-[44px] px-3.5 bg-[#221c14] hover:bg-[#332a1e] text-[#faf7f0] text-xs sm:text-[13px] font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-[#f3b833]" />
                <span>Print</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 4 Darajah Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {DARAJAH_LIST.map((d) => {
            const isSelected = selectedDarajah === d.num;
            const syl = getDarajahSyllabus(nizam, d.num);

            return (
              <button
                key={d.num}
                type="button"
                onClick={() => {
                  setSelectedDarajah(d.num);
                  setSeenIds([]);
                  setScores({});
                }}
                className={`min-h-[84px] flex flex-col justify-between p-3.5 rounded-xl text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3b833] ${
                  isSelected
                    ? "border-2 border-[#f3b833] bg-[#fff8e7] shadow-sm"
                    : "border border-[#e7e0d0] bg-[#faf7f0]/75 hover:bg-[#faf7f0] hover:border-[#d4c8ae]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-[13px] sm:text-sm font-extrabold text-[#221c12] leading-tight">
                    {d.nameEn} ({d.shortName})
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className={`font-alkanz text-base font-bold shrink-0 ${
                      isSelected ? "text-[#a37a1a]" : "text-[#7a5a13]"
                    }`}
                    style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                  >
                    {d.nameAr}
                  </span>
                </div>

                {syl && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 w-full">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-[#221c14] text-[#fcd468]"
                          : "bg-white text-[#3d3426] border border-[#e7e0d0]"
                      }`}
                    >
                      {syl.juzRangeEn}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#f3b833] shrink-0" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 2. THE 6 QUESTIONS (10 MARKS EACH · DISTINCT JUZ) ── */}
      <section aria-label="Examination questions" className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-base sm:text-lg font-bold text-[#221c12] flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-[#a37a1a]" />
            <span>Examination Questions ({questions.length} × 10 Marks)</span>
          </h2>
          <span className="text-xs font-medium text-[#5c503e]">
            Tap any verse to open Mushaf page
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {questions.map((q, idx) => {
            const currentScore = scores[q.id] ?? "";

            return (
              <article
                key={q.id}
                className="bg-white rounded-2xl border border-[#e7e0d0] p-4 sm:p-6 shadow-[0_2px_10px_-3px_rgba(34,28,18,0.05)] space-y-3.5"
              >
                {/* Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[#f0eadb]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-[#221c14] text-[#fcd468] font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <h3 className="font-bold text-sm sm:text-base text-[#221c12]">
                      Question {idx + 1}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[#fff8e7] text-[#7a5a13] border border-[#f3b833]/40 tabular-nums">
                      {q.marks} Marks
                    </span>

                    <div className="flex items-center gap-1.5 bg-[#faf7f0] px-2.5 py-1 rounded-lg border border-[#e7e0d0]">
                      <label
                        htmlFor={`score-${q.id}`}
                        className="text-xs font-semibold text-[#5c503e]"
                      >
                        Score:
                      </label>
                      <input
                        id={`score-${q.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={q.marks}
                        value={currentScore}
                        onChange={(e) =>
                          handleScoreChange(q.id, parseInt(e.target.value, 10), q.marks)
                        }
                        placeholder={`/${q.marks}`}
                        className="w-14 min-h-[36px] text-center text-base sm:text-sm font-bold bg-white text-[#221c12] rounded-md border border-[#e7e0d0] py-1 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#f3b833]"
                      />
                    </div>
                  </div>
                </div>

                {/* Humanized English Prompt */}
                <p className="text-[13px] sm:text-sm font-medium text-[#3d3426]">
                  {q.promptEn}
                </p>

                {/* Clickable Misri Mushaf Ayah Box */}
                <button
                  type="button"
                  onClick={() => openMushafPopup(q)}
                  className="group relative w-full text-left rounded-2xl px-5 py-6 sm:px-8 sm:py-7 bg-[#fffdf8] hover:bg-[#fff9eb] border border-[#e7e0d0] hover:border-[#f3b833] shadow-inner transition-colors cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3b833]"
                >
                  <div className="absolute top-2.5 left-2.5 pointer-events-none opacity-60">
                    <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} />
                  </div>
                  <div className="absolute top-2.5 right-2.5 pointer-events-none opacity-60">
                    <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} flipH />
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 pointer-events-none opacity-60">
                    <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} flipV />
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 pointer-events-none opacity-60">
                    <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} flipH flipV />
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-quran text-[22px] sm:text-[26px] lg:text-[30px] text-[#221c12] text-center leading-[2.35] tracking-normal px-2 select-text"
                    style={{
                      fontFamily: "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                    }}
                  >
                    {q.ayahTextAr}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#f0eadb] flex items-center justify-center gap-2 text-xs text-[#5c503e] flex-wrap">
                    <span className="font-semibold text-[#221c12] bg-[#f7f3ea] px-2.5 py-0.5 rounded-md border border-[#e7e0d0]">
                      {q.surahNameEn}
                    </span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-alkanz text-sm font-bold text-[#7a5a13]"
                      style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                    >
                      {q.surahNameAr}
                    </span>
                    <span>·</span>
                    <span className="tabular-nums">
                      Ayah {q.ayahStart}
                      {q.ayahEnd ? `–${q.ayahEnd}` : ""}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-[#221c12] tabular-nums">Juz {q.juzNumber}</span>
                    <span className="inline-flex items-center gap-1 ml-1 text-xs font-semibold text-[#7a5a13] group-hover:underline">
                      <Maximize2 className="w-3.5 h-3.5" />
                      Open Mushaf page
                    </span>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── 3. MUSHAF PAGE POPUP MODAL (HIGHLIGHTS ONLY THE QUESTION) ── */}
      <AnimatePresence>
        {activeMushafQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={closeMushafPopup}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 print:hidden"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${activeMushafQuestion.surahNameEn} Mushaf Page`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl bg-[#fffdf8] sm:rounded-3xl border border-[#e7e0d0] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Top Bar with Back Option */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#221c14] text-[#faf7f0] border-b border-[#f3b833]/30 shrink-0">
                <button
                  type="button"
                  onClick={closeMushafPopup}
                  className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f3b833] hover:bg-[#e5a922] text-[#191510] text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="text-center min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#fcd468] truncate">
                    {activeMushafQuestion.surahNameEn} · Ayah {activeMushafQuestion.ayahStart}
                  </div>
                  <div className="text-[11px] text-[#e7e0d0]/85 tabular-nums">
                    Juz {activeMushafQuestion.juzNumber}
                    {mushafPage ? ` · Page ${mushafPage.pageNumber}` : ""}
                  </div>
                </div>

                <span
                  dir="rtl"
                  lang="ar"
                  className="font-alkanz text-sm font-bold text-[#fcd468] hidden sm:inline shrink-0"
                  style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                >
                  {activeMushafQuestion.surahNameAr}
                </span>
              </div>

              {/* Scrollable Mushaf Content */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
                {mushafLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#5c503e]">
                    <Loader2 className="w-7 h-7 animate-spin text-[#a37a1a]" />
                    <span className="text-xs font-medium">Loading Mushaf page…</span>
                  </div>
                )}

                {!mushafLoading && mushafError && (
                  <div className="space-y-4">
                    <div className="text-xs text-center text-[#7a5a13] bg-[#fff8e7] px-3 py-2 rounded-xl border border-[#f3b833]/40">
                      {mushafError}
                    </div>
                    <div className="rounded-2xl p-6 bg-[#fff8e7] border border-[#f3b833]/50">
                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-quran text-2xl sm:text-3xl text-[#221c12] text-center leading-[2.35]"
                        style={{
                          fontFamily: "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                        }}
                      >
                        {activeMushafQuestion.ayahTextAr}
                      </p>
                    </div>
                  </div>
                )}

                {!mushafLoading && !mushafError && mushafPage && (() => {
                  const lineNumbers = Object.keys(mushafPage.lines)
                    .map(Number)
                    .sort((a, b) => a - b);
                  let attachedRef = false;

                  return (
                    <div className="rounded-2xl border border-[#e7e0d0] bg-[#fffdf8] p-3.5 sm:p-6 shadow-inner space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#5c503e] pb-2 border-b border-[#f0eadb]">
                        <span className="tabular-nums">Page {mushafPage.pageNumber}</span>
                        <span>15-Line Misri Mushaf</span>
                      </div>

                      <div dir="rtl" lang="ar" className="space-y-1">
                        {lineNumbers.map((ln) => {
                          const words = mushafPage.lines[ln] || [];
                          return (
                            <div
                              key={`${mushafPage.pageNumber}-${ln}`}
                              className="font-quran text-[19px] sm:text-[23px] lg:text-[25px] text-[#221c12] leading-[2.2] text-center flex flex-wrap justify-center gap-x-1.5"
                              style={{
                                fontFamily:
                                  "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                              }}
                            >
                              {words.map((w) => {
                                const highlighted = isQuestionWord(w.verseKey);
                                const shouldAttachRef = highlighted && !attachedRef;
                                if (shouldAttachRef) attachedRef = true;

                                return (
                                  <span
                                    key={w.id}
                                    ref={shouldAttachRef ? firstHighlightRef : undefined}
                                    className={
                                      highlighted
                                        ? "bg-[#fef08a]/85 text-[#221c12] rounded-md px-1"
                                        : "px-0.5"
                                    }
                                  >
                                    {w.text}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. OFFICIAL PRINTABLE PAPER (Shown only on Print) ── */}
      <div className="hidden print:block p-6 space-y-5 text-black bg-white">
        <div className="text-center space-y-1 pb-3 border-b-2 border-black">
          <div dir="rtl" lang="ar" className="font-quran text-base font-bold">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </div>
          <div className="text-lg font-extrabold">
            Darse Burhani · Al-Quran al-Majeed Ikhtebaar ({activeSyllabus?.nameEn})
          </div>
          <div className="text-xs text-gray-800">
            Aljamea Syllabus (1447–1448 H) · {nizamConfig.titleEn} · {activeSyllabus?.juzRangeEn}
          </div>
        </div>

        <table className="w-full text-xs border border-black border-collapse">
          <tbody>
            <tr>
              <td className="p-2 border border-black font-bold bg-gray-100 w-1/4">Student Name:</td>
              <td className="p-2 border border-black w-1/4">______________________</td>
              <td className="p-2 border border-black font-bold bg-gray-100 w-1/4">ITS Number:</td>
              <td className="p-2 border border-black w-1/4">______________________</td>
            </tr>
            <tr>
              <td className="p-2 border border-black font-bold bg-gray-100">Date:</td>
              <td className="p-2 border border-black">{new Date().toLocaleDateString("en-GB")}</td>
              <td className="p-2 border border-black font-bold bg-gray-100">Total / Passing Marks:</td>
              <td className="p-2 border border-black">
                {activeSyllabus?.totalMarks} / {activeSyllabus?.passingMarks}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="space-y-3.5">
          {questions.map((q, idx) => (
            <div key={q.id} className="border border-black p-3 rounded-lg space-y-1.5 break-inside-avoid">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1">
                <span className="font-bold text-xs">Question {idx + 1}</span>
                <span className="font-bold text-xs">
                  [{q.marks} Marks] · Score: [____]
                </span>
              </div>

              <div className="text-xs text-gray-800">{q.promptEn}</div>

              <div
                dir="rtl"
                lang="ar"
                className="font-quran text-xl p-2.5 bg-gray-50 rounded border border-gray-300 text-center leading-[2.3]"
                style={{
                  fontFamily: "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                }}
              >
                {q.ayahTextAr}
              </div>

              <div className="flex justify-between text-[11px] text-gray-700">
                <span>
                  {q.surahNameEn} · Ayah {q.ayahStart}{q.ayahEnd ? `–${q.ayahEnd}` : ""} · Juz {q.juzNumber}
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  className="font-alkanz text-xs"
                  style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                >
                  {q.surahNameAr}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 flex justify-between items-end text-xs">
          <div>Examiner Signature: ____________________</div>
          <div className="text-center font-bold">
            Final Score: [ ____ / {maxTotalMarks} ] &nbsp;|&nbsp; [ ] Pass &nbsp;[ ] Retest
          </div>
          <div>Academic Head: ____________________</div>
        </div>
      </div>
    </div>
  );
}
