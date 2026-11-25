"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { FatimiCornerBracket } from "@/components/FatimiOrnaments";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  QURAN_IKHTEBAAR_DATA,
  DARAJAH_LIST,
  OFFICIAL_ALJAMEA_QURAN_SYLLABUS,
  getDarajahSyllabus,
  getRandomizedExamPaper,
  type NizamType,
} from "@/lib/quran-ikhtebaar-data";

export default function QuranIkhtebaarPage() {
  const [nizam, setNizam] = useState<NizamType>("OLD");
  const [selectedDarajah, setSelectedDarajah] = useState<number>(2);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  const nizamConfig = useMemo(() => QURAN_IKHTEBAAR_DATA[nizam], [nizam]);

  const activeSyllabus = useMemo(
    () => getDarajahSyllabus(nizam, selectedDarajah),
    [nizam, selectedDarajah]
  );

  const officialInfo = useMemo(
    () => OFFICIAL_ALJAMEA_QURAN_SYLLABUS[selectedDarajah] || null,
    [selectedDarajah]
  );

  const questions = useMemo(
    () => getRandomizedExamPaper(nizam, selectedDarajah, shuffleSeed),
    [nizam, selectedDarajah, shuffleSeed]
  );

  const maxTotalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + q.marks, 0) || 100,
    [questions]
  );

  const handleScoreChange = (qId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setScores((prev) => ({ ...prev, [qId]: clamped }));
  };

  const handleRegenerate = () => {
    setShuffleSeed((prev) => prev + 1);
    setScores({});
    toast({
      title: "New question set ready",
      description: `${activeSyllabus?.nameEn} · ${nizamConfig.titleEn}`,
      variant: "success",
    });
  };

  const handleCopyQuestions = () => {
    if (!questions.length) return;
    const textLines = questions.map(
      (q, idx) =>
        `Q${idx + 1} (${q.marks} Marks)\n` +
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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-7 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] lg:pb-12 space-y-4 sm:space-y-5 min-w-0">
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
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e7e0d0] shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#221c12]">
            <SlidersHorizontal className="w-4 h-4 text-[#b8972e]" />
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
                    onClick={() => setNizam(type)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${active
                      ? "bg-[#221c14] text-[#fcd468] shadow-sm border border-[#f3b833]/30"
                      : "text-[#3d3426] hover:text-[#221c12] hover:bg-white/60"
                      }`}
                  >
                    <span>{cfg.titleEn}</span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className={`font-alkanz text-sm font-normal ${active ? "text-[#fcd468]" : "text-[#7a5a13]"}`}
                      style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                    >
                      {cfg.titleAr}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Compact Paper Actions */}
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleRegenerate}
                variant="outline"
                className="min-h-[38px] text-xs font-semibold border-[#e7e0d0] text-[#221c12] hover:bg-[#faf7f0] flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#b8972e]" />
                <span>Shuffle</span>
              </Button>

              <Button
                onClick={handleCopyQuestions}
                variant="outline"
                className="min-h-[38px] text-xs font-semibold border-[#e7e0d0] text-[#221c12] hover:bg-[#faf7f0] flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5 text-[#b8972e]" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>

              <Button
                onClick={handlePrint}
                className="min-h-[38px] bg-[#221c14] hover:bg-[#332a1e] text-[#faf7f0] text-xs font-semibold flex items-center gap-1.5"
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
                  setScores({});
                }}
                className={`min-h-[78px] flex flex-col justify-between p-3 sm:p-3.5 rounded-xl text-left transition-all cursor-pointer ${isSelected
                  ? "border-2 border-[#f3b833] bg-[#fff8e7] shadow-sm"
                  : "border border-[#e7e0d0] bg-[#faf7f0]/70 hover:bg-[#faf7f0] hover:border-[#d4c8ae]"
                  }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-xs sm:text-sm font-extrabold text-[#221c12]">
                    {d.nameEn} ({d.shortName})
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className={`font-alkanz text-base font-bold ${isSelected ? "text-[#a37a1a]" : "text-[#7a5a13]"
                      }`}
                    style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                  >
                    {d.nameAr}
                  </span>
                </div>

                {syl && (
                  <div className="mt-2 flex items-center justify-between gap-2 w-full">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${isSelected
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
      </div>

      {/* ── 2. THE 6 QUESTIONS (MISRI MUSHAF + AL-KANZ DISPLAY) ── */}
      <div className="space-y-4 print:hidden">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base sm:text-lg font-bold text-[#221c12] flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-[#b8972e]" />
            <span>Examination Questions ({questions.length})</span>
          </h3>
          <span className="text-xs text-[#6b5f4b]">Misri Mushaf Script</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {questions.map((q, idx) => {
            const currentScore = scores[q.id] ?? "";

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: idx * 0.04 }}
                className="bg-white rounded-2xl border border-[#e7e0d0] p-4 sm:p-6 shadow-sm space-y-4"
              >
                {/* Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#f0eadb]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-[#221c14] text-[#fcd468] font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="font-bold text-sm sm:text-base text-[#221c12]">
                      Question {idx + 1}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#fff8e7] text-[#7a5a13] border border-[#f3b833]/40">
                      {q.marks} Marks
                    </span>

                    <div className="flex items-center gap-1.5 bg-[#faf7f0] px-2.5 py-1 rounded-lg border border-[#e7e0d0]">
                      <label className="text-[11px] font-semibold text-[#6b5f4b]">Score:</label>
                      <input
                        type="number"
                        min={0}
                        max={q.marks}
                        value={currentScore}
                        onChange={(e) =>
                          handleScoreChange(q.id, parseInt(e.target.value, 10), q.marks)
                        }
                        placeholder={`/${q.marks}`}
                        className="w-12 text-center text-xs font-bold bg-white text-[#221c12] rounded border border-[#e7e0d0] py-1 focus:outline-none focus:ring-1 focus:ring-[#f3b833]"
                      />
                    </div>
                  </div>
                </div>

                {/* Humanized English Prompt */}
                <p className="text-xs sm:text-sm font-medium text-[#3d3426]">
                  {q.promptEn}
                </p>

                {/* Misri Mushaf Ayah Box with Amiri Quran Font */}
                <div className="relative rounded-2xl px-5 py-6 sm:px-8 sm:py-7 bg-[#fffdf8] border border-[#e7e0d0] shadow-inner overflow-hidden">
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
                    className="font-quran text-2xl sm:text-[28px] lg:text-[32px] text-[#221c12] text-center leading-[2.4] tracking-normal px-3 select-text"
                    style={{
                      fontFamily: "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                    }}
                  >
                    {q.ayahTextAr}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#f0eadb] flex items-center justify-center gap-2.5 text-xs text-[#6b5f4b] flex-wrap">
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
                    <span>
                      Ayah {q.ayahStart}
                      {q.ayahEnd ? `–${q.ayahEnd}` : ""}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-[#221c12]">Juz {q.juzNumber}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── 3. OFFICIAL PRINTABLE PAPER (Shown only on Print) ── */}
      <div className="hidden print:block p-6 space-y-5 text-black bg-white">
        <div className="text-center space-y-1 pb-3 border-b-2 border-black">
          <div dir="rtl" lang="ar" className="font-alkanz text-base font-bold">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </div>
          <div className="text-lg font-extrabold">
            Darse Burhani · Al-Quran al-Majeed Ikhtebaar ({activeSyllabus?.nameEn})
          </div>
          <div className="text-xs text-gray-800">
            Aljamea Syllabus (1447–1448 H) · {nizamConfig.titleEn} · Hifz: {activeSyllabus?.juzRangeEn}
          </div>
          <div className="text-[11px] text-gray-700">
            Uloom: {officialInfo?.uloomQuran.bookNameEn} ({officialInfo?.uloomQuran.ajzaaEn}) · Tajweed:{" "}
            {officialInfo?.tajweed.topics.map((t) => t.en).join(", ")}
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
                <span className="font-bold text-xs">
                  Question {idx + 1}
                </span>
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
                <span dir="rtl" lang="ar" className="font-alkanz text-xs" style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}>
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
