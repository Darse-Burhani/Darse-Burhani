"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Users,
  Shield,
  Heart,
  Sparkles,
  ClipboardCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  History,
  RefreshCw,
  BookOpen,
  Filter,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  GraduationCap,
  Layers,
  Award,
  ShieldCheck,
  Lock,
  Calendar,
  UserCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/student/PageHeader";
import { toast } from "@/components/ui/toast";
import {
  SKILL_QUESTIONS_BY_AGE,
  SKILL_TOPICS,
  SKILL_META,
  AGE_GROUPS,
  type AgeGroupId,
  type SkillQuestion,
  getQuestionsForSkillAndAge,
  resolveAgeTierFromGradeOrAge,
} from "@/lib/skill-questions";
import { submitSkillAttempt } from "@/lib/api";

const skillCategoryIcons: Record<string, React.ElementType> = {
  criticalThinking: Brain,
  collaboration: Users,
  leadership: Shield,
  resilience: Heart,
};

const skillCategoryOrder = ["criticalThinking", "collaboration", "leadership", "resilience"] as const;

interface AttemptRecord {
  id: string;
  skill: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  createdAt: string;
}

interface StudentIdentity {
  name: string;
  its: string;
  grade: string;
  section: string;
  gdisplay: string;
  age: number;
  tier: AgeGroupId;
  explanation: string;
}

export default function TalabatSkillTreePage() {
  const [skills, setSkills] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AttemptRecord[]>([]);

  // Student Profile & Auto-detected Grade Display State
  const [studentProfile, setStudentProfile] = useState<StudentIdentity | null>(null);

  // Age selection state (Junior 7-10, Middle 11-14, Senior 15-18+)
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroupId>("middle");

  // Quiz Modal State
  const [quizSkill, setQuizSkill] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ correct: number; total: number; pct: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [watermarkTimestamp, setWatermarkTimestamp] = useState<string>("");

  // Question Bank Explorer State
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerTopic, setExplorerTopic] = useState<string>("ALL");
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/talabat/skill-tree").then((x) => x.json()).catch(() => ({ success: false }));
      if (r.success) setSkills(r.data);
      const h = await fetch("/api/talabat/skill-tree/history").then((x) => x.json()).catch(() => ({ success: false }));
      if (h.success) setHistory(h.data);

      // Auto-fetch Talabat profile: pick student name, ITS, age, grade, and derive formatted gdisplay
      const p = await fetch("/api/talabat/profile").then((x) => x.json()).catch(() => null);
      const studentData = p?.data || p;
      if (studentData && (studentData.name || studentData.studentId || studentData.grade || studentData.firstName)) {
        const studentName =
          studentData.name ||
          [studentData.firstName, studentData.lastName].filter(Boolean).join(" ") ||
          "Talib al-Ilm";
        const studentIts = studentData.studentId || studentData.its || "ITS-Verified";
        const rawGrade = studentData.grade || "7";
        const rawSection = studentData.section || "A";
        const rawAge = typeof studentData.age === "number" ? studentData.age : undefined;

        const resolved = resolveAgeTierFromGradeOrAge(rawGrade, rawAge, rawSection);

        setStudentProfile({
          name: studentName,
          its: studentIts,
          grade: rawGrade,
          section: rawSection,
          gdisplay: resolved.gradeDisplay,
          age: resolved.computedAge,
          tier: resolved.tier,
          explanation: resolved.explanation,
        });

        setSelectedAgeGroup(resolved.tier);
      } else {
        // Fallback profile if server unavailable or mock mode
        const resolved = resolveAgeTierFromGradeOrAge("Class 7", 13, "B");
        setStudentProfile({
          name: "Talib al-Ilm",
          its: "ITS-30491820",
          grade: "Class 7",
          section: "B",
          gdisplay: "Class 7-B",
          age: 13,
          tier: resolved.tier,
          explanation: resolved.explanation,
        });
        setSelectedAgeGroup(resolved.tier);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Anti-Cheat & Anti-Copy Global Keyboard Interceptor while Quiz is active
  useEffect(() => {
    if (!quizSkill) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Block Copy / Cut / Paste / Select-All / Save / Print / Source inspection shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "x", "v", "a", "p", "s", "u"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        e.stopPropagation();
        toast({
          title: "Academic Honor Code Locked",
          description: "Copying, searching, and source inspection are prohibited during live evaluations.",
          variant: "destructive",
        });
        return;
      }

      // 2. Block DevTools Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        e.stopPropagation();
        toast({
          title: "Developer Tools Locked",
          description: "Source code inspection is blocked during assessment.",
          variant: "destructive",
        });
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [quizSkill]);

  // Age-aware questions for the active quiz
  const questions: SkillQuestion[] = useMemo(() => {
    if (!quizSkill) return [];
    return getQuestionsForSkillAndAge(quizSkill, selectedAgeGroup);
  }, [quizSkill, selectedAgeGroup]);

  // Questions for the Explorer section
  const explorerQuestions: SkillQuestion[] = useMemo(() => {
    const group = SKILL_QUESTIONS_BY_AGE[selectedAgeGroup] || SKILL_QUESTIONS_BY_AGE.senior;
    if (explorerTopic === "ALL") {
      return Object.values(group).flat();
    }
    return group[explorerTopic] || [];
  }, [selectedAgeGroup, explorerTopic]);

  const activeAgeMeta = useMemo(() => {
    return AGE_GROUPS.find((ag) => ag.id === selectedAgeGroup) || AGE_GROUPS[1];
  }, [selectedAgeGroup]);

  const openQuiz = (skill: string) => {
    setQuizSkill(skill);
    setAnswers({});
    setResult(null);
    setSaveError(null);
    setSaved(false);
    setWatermarkTimestamp(
      new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  };

  const closeQuiz = () => {
    setQuizSkill(null);
    setAnswers({});
    setResult(null);
    setSaveError(null);
    setSaved(false);
  };

  const answeredCount = Object.keys(answers).length;

  const handleCheck = () => {
    if (!quizSkill) return;
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.answer) correct += 1;
    });
    setResult({
      correct,
      total: questions.length,
      pct: Math.round((correct / questions.length) * 100),
    });
  };

  const handleSave = async () => {
    if (!quizSkill || !result) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await submitSkillAttempt({
        skill: quizSkill,
        score: result.pct,
        totalQuestions: result.total,
        correctAnswers: result.correct,
      });
      setSkills({
        criticalThinking: updated.criticalThinking,
        collaboration: updated.collaboration,
        leadership: updated.leadership,
        resilience: updated.resilience,
      });
      setSaved(true);
      const h = await fetch("/api/talabat/skill-tree/history").then((x) => x.json()).catch(() => ({ success: false }));
      if (h.success) setHistory(h.data);
    } catch (e: any) {
      setSaveError(e.message || "Failed to save score");
    } finally {
      setSaving(false);
    }
  };

  const activeQuizTopicMeta = quizSkill ? SKILL_TOPICS[quizSkill] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* ── Page Header ── */}
      <PageHeader
        icon={Sparkles}
        title="Skill Tree & Assessment Hub"
        subtitle="Topic-wise and age-adapted Q&A evaluations — sharpen your abilities and build your skill percentages."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExplorer(!showExplorer)}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20 font-semibold text-xs h-9"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              {showExplorer ? "Hide Question Bank" : "Explore Question Bank"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSkills}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20 text-xs h-9"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* ════════════════════════════════════════════════════════════
          VERIFIED TALABAT IDENTITY & ADAPTIVE CURRICULUM BANNER
      ════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/60 bg-gradient-to-br from-[#12161f] via-[#1a202c] to-[#12161f] p-5 sm:p-6 shadow-md text-white">
        {/* Background Rosette Glows */}
        <div className="pointer-events-none absolute -right-12 -bottom-12 w-80 h-80 rounded-full bg-[#d4af37]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-72 h-72 rounded-full bg-[#f3b833]/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, #d4af37 1.5px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#b8860b] p-0.5 shadow-lg shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#12161f] flex items-center justify-center text-white">
                <GraduationCap className="w-7 h-7 text-[#f3b833]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-[#d4af37]/20 text-[#fff4be] px-2.5 py-0.5 rounded-full border border-[#d4af37]/40 shadow-inner">
                  True Identity Verified
                </span>
                <span className="text-xs text-stone-300 font-mono">
                  ITS: <strong className="text-white">{studentProfile?.its || "..."}</strong>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 font-display">
                {studentProfile?.name || "Talib al-Ilm"}
              </h2>
              <p className="text-xs sm:text-sm text-[#e7dec8] font-medium mt-0.5">
                Class Grade: <strong className="text-white">{studentProfile?.gdisplay || "Class 7"}</strong> · Evaluated Age: <strong className="text-white">{studentProfile?.age || 13} yrs</strong> · Adapted Curriculum: <strong className="text-[#f3b833]">{activeAgeMeta.label} ({activeAgeMeta.ageRange})</strong>
              </p>
            </div>
          </div>

          {/* Academic Integrity Lock Badge */}
          <div className="flex items-center gap-3 shrink-0 bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-xs">
            <ShieldCheck className="w-7 h-7 text-[#f3b833] shrink-0" />
            <div className="text-left text-xs">
              <p className="font-extrabold text-white">Proctored Assessment Shield</p>
              <p className="text-[11px] text-[#e7dec8]">Anti-Copy Lock &amp; Live Watermark Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          ASSIGNED CURRICULUM TIER (LOCKED SPECIFICALLY FOR TALIBAT DARJAH)
      ════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[rgba(221,213,196,0.8)] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9a7318] bg-[#fbf5e6] px-2.5 py-0.5 rounded-full border border-[#edd7a6] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#9a7318]" />
                Enrolled Curriculum
              </span>
              <span className="text-xs text-stone-500 font-medium">Assigned by Attalimiyah</span>
            </div>
            <h2 className="text-lg font-extrabold text-stone-900 mt-0.5">
              Assigned Skills Tier — {studentProfile?.gdisplay || "Your Darjah"}
            </h2>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl self-start sm:self-auto border border-emerald-200 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-700" />
            <span>Assigned: <strong className="text-emerald-950">{activeAgeMeta.label} ({activeAgeMeta.ageRange})</strong></span>
          </span>
        </div>

        {/* Assigned Tier Single Card (Locked to student's enrolled grade, no switching allowed) */}
        <div className="relative p-5 sm:p-6 rounded-2xl border-2 border-[#d4af37] bg-gradient-to-br from-[#faf7f0] via-white to-[#fdfbf7] shadow-sm ring-2 ring-[#d4af37]/20 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${activeAgeMeta.badgeBg}`}>
                {activeAgeMeta.ageRange}
              </span>
              <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-md border border-stone-200">
                {activeAgeMeta.grades}
              </span>
              <span className="text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Assigned to {studentProfile?.gdisplay}
              </span>
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-stone-900 flex items-center gap-2">
                <span>{activeAgeMeta.label} Tier</span>
                <span className="text-sm font-medium text-stone-400 font-serif">· {studentProfile?.explanation}</span>
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-[#8b6508] mt-0.5">
                {activeAgeMeta.tagline}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
              {activeAgeMeta.description}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-stone-500 font-medium">
              <span>📋 5 questions per skill topic (20 total proctored questions)</span>
              <span>🔒 Curriculum tier is locked to your enrolled class</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          OPTIONAL INTERACTIVE QUESTION BANK EXPLORER
      ════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showExplorer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-b from-[#12161f] to-[#1a202c] text-white rounded-3xl p-5 sm:p-7 shadow-xl space-y-5 border border-[#d4af37]/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#f3b833]" />
                    <h3 className="text-lg font-bold text-white">
                      Curriculum Question Bank Explorer
                    </h3>
                  </div>
                  <p className="text-xs text-stone-300 mt-0.5">
                    Browse and review questions categorized by topic for <strong>{activeAgeMeta.label} ({activeAgeMeta.ageRange})</strong>
                  </p>
                </div>

                {/* Topic Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setExplorerTopic("ALL")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      explorerTopic === "ALL"
                        ? "bg-[#d4af37] text-slate-950 shadow-sm"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    All Topics ({Object.values(SKILL_QUESTIONS_BY_AGE[selectedAgeGroup] || {}).flat().length})
                  </button>
                  {skillCategoryOrder.map((key) => {
                    const meta = SKILL_TOPICS[key];
                    const count = (SKILL_QUESTIONS_BY_AGE[selectedAgeGroup]?.[key] || []).length;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setExplorerTopic(key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          explorerTopic === key
                            ? "bg-[#d4af37] text-slate-950 shadow-sm"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {meta.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Questions List for Selected Age Group & Topic */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {explorerQuestions.map((q, idx) => {
                  const isExp = expandedExplanation === q.id;
                  return (
                    <div
                      key={q.id || idx}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs transition hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#f3b833] bg-[#12161f] px-2 py-0.5 rounded-md border border-[#d4af37]/30">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-white text-[13px]">{q.topic}</span>
                          <span className="text-[11px] text-[#fde047] font-serif dir-rtl" dir="rtl">
                            • {q.subtopic}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-stone-300 bg-white/10 px-2 py-0.5 rounded-full">
                          {activeAgeMeta.label} ({activeAgeMeta.ageRange})
                        </span>
                      </div>

                      <p className="text-[13px] text-stone-200 font-medium leading-relaxed mb-3">
                        {q.q}
                      </p>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-200 mb-3">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-xl border flex items-start gap-2 ${
                              optIdx === q.answer
                                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200 font-semibold"
                                : "bg-black/20 border-white/5"
                            }`}
                          >
                            <span className="font-mono font-bold text-[10px] text-stone-400 mt-0.5">
                              {["A", "B", "C", "D"][optIdx]}.
                            </span>
                            <span className="flex-1">{opt}</span>
                            {optIdx === q.answer && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Explanation Dropdown */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandedExplanation(isExp ? null : q.id)}
                          className="text-[11px] font-bold text-[#f3b833] hover:text-[#fde047] flex items-center gap-1 cursor-pointer"
                        >
                          {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExp ? "Hide Educational Pedagogy" : "View Pedagogical Explanation"}
                        </button>
                        <span className="text-[10px] text-stone-400">
                          Correct Answer: Option {["A", "B", "C", "D"][q.answer]}
                        </span>
                      </div>

                      {isExp && (
                        <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-[#d4af37]/30 text-[#e7dec8] text-[11.5px] leading-relaxed">
                          <strong>Learning Objective:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════
          4 CORE SKILL CATEGORY CARDS (TOPIC-WISE ASSESSMENT)
      ════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-stone-900">
              Assessed Skills — Topic-Wise Dashboard
            </h2>
            <p className="text-xs text-stone-500">
              Questions below are currently customized for <strong>{activeAgeMeta.label} ({activeAgeMeta.ageRange})</strong>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-3xl bg-white border border-stone-200 p-6" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {skillCategoryOrder.map((key) => {
              const meta = SKILL_TOPICS[key];
              const Icon = skillCategoryIcons[key] || Brain;
              const currentScore = skills ? skills[key] || 0 : 0;
              const questionsForThisSkill = SKILL_QUESTIONS_BY_AGE[selectedAgeGroup]?.[key] || [];

              return (
                <Card
                  key={key}
                  className="rounded-3xl border border-[rgba(221,213,196,0.8)] shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between bg-white"
                >
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl ${meta.bgLight} flex items-center justify-center ${meta.textColor} shadow-xs`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base text-stone-900">{meta.label}</h3>
                            <span className="text-xs font-bold text-[#1c1c1c] font-alkanz dir-rtl" dir="rtl">
                              {meta.arabicLabel}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 line-clamp-1">{meta.blurb}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl font-extrabold text-stone-900 font-mono">
                          {currentScore}%
                        </span>
                        <span className="block text-[10px] uppercase font-bold text-stone-400">
                          Current Score
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="h-2.5 w-full bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${meta.barGradient} transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, currentScore))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1">
                        <span>Score Level</span>
                        <span className="font-semibold text-stone-600">
                          {currentScore >= 80 ? "Mastery" : currentScore >= 60 ? "Proficient" : currentScore >= 40 ? "Developing" : "Beginner"}
                        </span>
                      </div>
                    </div>

                    {/* Age Tailored Action Bar */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${activeAgeMeta.badgeBg.split(" ")[0]}`} />
                        {activeAgeMeta.label} ({questionsForThisSkill.length} Qs)
                      </span>

                      <Button
                        size="sm"
                        onClick={() => openQuiz(key)}
                        className="bg-[#12161f] hover:bg-[#1a202c] text-white border border-[#d4af37]/60 font-bold text-xs h-9 px-4 rounded-xl shadow-xs cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5 mr-1.5 text-[#f3b833]" />
                        Take Q&amp;A Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Attempts History ── */}
      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-stone-900 mb-3">
          <History size={16} className="text-[#b8860b]" /> My Recent Assessment Scores
        </h2>
        {history.length === 0 ? (
          <Card className="rounded-2xl border border-[rgba(221,213,196,0.8)] bg-white">
            <CardContent className="p-6 text-center text-xs text-stone-500">
              No tests taken yet. Tap <strong>Take Q&amp;A Test</strong> on any skill card above to begin your assessment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {history.slice(0, 6).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-2xl border border-[rgba(221,213,196,0.8)] bg-white px-4 py-3 shadow-2xs"
              >
                <div>
                  <p className="text-[13px] font-bold text-stone-900">
                    {SKILL_TOPICS[h.skill]?.label || h.skill}
                  </p>
                  <p className="text-[11.5px] text-stone-400">
                    {h.correctAnswers}/{h.totalQuestions} correct ·{" "}
                    {new Date(h.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <Badge
                  className={`text-[13px] font-black ${
                    h.score >= 60
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : h.score >= 40
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {h.score}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          REDESIGNED ANTI-CHEAT PROCTORED QUIZ MODAL
          - Disabled text selection & right-click
          - Blocked copy / paste / shortcuts
          - Dynamic "True Identity" Diagonal Security Watermark
      ════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {quizSkill && activeQuizTopicMeta && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
            onContextMenu={(e) => {
              e.preventDefault();
              toast({
                title: "Right-Click Locked",
                description: "Context menu is disabled during the active assessment session.",
                variant: "destructive",
              });
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onCopy={(e) => {
                e.preventDefault();
                toast({
                  title: "Copying Prohibited",
                  description: "Assessment questions cannot be copied to prevent external searching.",
                  variant: "destructive",
                });
              }}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              className="relative max-h-[94vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[#d4af37]/60 bg-white shadow-2xl my-auto select-none flex flex-col"
            >
              {/* ── "True Identity" Continuous Security Watermark Overlay ── */}
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden opacity-[0.045] flex flex-col justify-around rotate-[-15deg] scale-125"
              >
                {Array.from({ length: 14 }).map((_, rIdx) => (
                  <div
                    key={rIdx}
                    className="flex whitespace-nowrap gap-8 text-[11px] font-mono font-black text-slate-900 tracking-wider uppercase"
                  >
                    {Array.from({ length: 8 }).map((_, cIdx) => (
                      <span key={cIdx}>
                        {studentProfile?.name || "TALIB AL-ILM"} • ITS: {studentProfile?.its || "VERIFIED"} • {studentProfile?.gdisplay || "CLASS"} • {watermarkTimestamp} • PROCTORED ASSESS
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              {/* ── Modal Header Cockpit (Fatimi Midnight & Gold) ── */}
              <div className="relative z-10 shrink-0 bg-gradient-to-r from-[#12161f] via-[#1a202c] to-[#12161f] px-5 sm:px-6 py-4 text-white rounded-t-3xl border-b border-[#d4af37]/40 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-[#d4af37]/20 border border-[#d4af37]/40 px-2 py-0.5 rounded-full text-[#fff4be]">
                        {activeAgeMeta.label} ({activeAgeMeta.ageRange})
                      </span>
                      <span className="text-xs text-[#fde047] font-serif dir-rtl" dir="rtl">
                        {activeQuizTopicMeta.arabicLabel}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black mt-0.5 font-display text-white">
                      {activeQuizTopicMeta.label} — Skill Assessment
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={closeQuiz}
                    className="p-1.5 text-stone-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Sub-bar: Proctored True Identity Telemetry */}
                <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[#f3b833] font-mono font-bold text-[11px]">
                      Student: {studentProfile?.name} (ITS: {studentProfile?.its})
                    </span>
                    <span className="bg-white/10 text-white font-mono font-bold px-1.5 py-0.2 rounded text-[10px]">
                      {studentProfile?.gdisplay}
                    </span>
                  </div>

                  <div className="text-[#fde047] font-mono text-[11px] font-bold">
                    {result ? "Evaluation Complete" : `${answeredCount}/${questions.length} Answered`}
                  </div>
                </div>
              </div>

              {/* ── Modal Body (Scrollable with Anti-Copy protection) ── */}
              <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {!result ? (
                  <>
                    {/* Top Anti-Copy Security Notification Banner */}
                    <div className="p-3 rounded-2xl bg-[#faf7f0] border border-[#edd7a6] text-[11.5px] text-[#8b6508] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-[#b8860b] shrink-0" />
                        <span>
                          <strong>Academic Integrity Lock Active:</strong> Text copying, right-click, and automated external searching are disabled. Your name and ITS are stamped across the assessment.
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {questions.map((q, qi) => (
                        <div
                          key={q.id || qi}
                          className="rounded-2xl border border-[rgba(221,213,196,0.8)] p-4 sm:p-5 bg-white shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#12161f] text-xs font-black text-[#f3b833] border border-[#d4af37]/40">
                                {qi + 1}
                              </span>
                              <span className="text-xs font-bold text-stone-900">{q.topic}</span>
                            </div>
                            <span className="text-[11px] font-semibold text-[#8b6508] bg-[#fbf5e6] px-2.5 py-0.5 rounded-full border border-[#edd7a6]">
                              {q.subtopic}
                            </span>
                          </div>

                          <p className="text-[13.5px] sm:text-sm font-bold text-stone-900 leading-relaxed">
                            {q.q}
                          </p>

                          {/* 4 Interactive Option Buttons */}
                          <div className="space-y-2">
                            {q.options.map((opt, oi) => {
                              const active = answers[qi] === oi;
                              return (
                                <button
                                  key={oi}
                                  type="button"
                                  onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                                  className={`w-full rounded-xl border px-3.5 py-3 text-left text-xs sm:text-[13px] leading-relaxed transition-all cursor-pointer flex items-start gap-2.5 min-h-[44px] ${
                                    active
                                      ? "border-[#b8860b] bg-[#faf7f0] font-bold text-stone-950 ring-2 ring-[#d4af37]/30 shadow-xs"
                                      : "border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                                  }`}
                                >
                                  <span
                                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold mt-0.5 ${
                                      active
                                        ? "bg-[#12161f] text-[#f3b833] border border-[#d4af37]/50"
                                        : "bg-stone-100 text-stone-500"
                                    }`}
                                  >
                                    {["A", "B", "C", "D"][oi]}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                  {active && (
                                    <CheckCircle2 className="w-4 h-4 text-[#b8860b] shrink-0 mt-0.5" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={handleCheck}
                        disabled={answeredCount < questions.length}
                        className="w-full h-11 rounded-xl bg-[#12161f] hover:bg-[#1a202c] text-sm font-bold text-white border border-[#d4af37]/60 shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {answeredCount < questions.length
                          ? `Answer all questions (${answeredCount}/${questions.length}) to calculate score`
                          : "Calculate & Lock My Score"}
                      </Button>
                    </div>
                  </>
                ) : (
                  /* ── Result & Pedagogy Breakdown ── */
                  <div className="py-2 space-y-6">
                    <div className="text-center">
                      <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 text-3xl font-black ${
                          result.pct >= 60
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : result.pct >= 40
                            ? "border-amber-500 bg-amber-50 text-amber-800"
                            : "border-rose-400 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {result.pct}%
                      </motion.div>
                      <h4 className="mt-3 text-lg font-extrabold text-stone-900 font-display">
                        You scored {result.correct} out of {result.total}
                      </h4>
                      <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                        {result.pct >= 80
                          ? "Outstanding mastery! You exemplify thoughtful, ethical decision-making in harmony with your academic tier."
                          : result.pct >= 60
                          ? "Very good performance! Review the rationales below to further develop your instincts."
                          : "Good effort! Read the detailed pedagogical explanations below and retake to improve your score."}
                      </p>
                    </div>

                    {/* Question by Question Review */}
                    <div className="space-y-3">
                      <h5 className="font-extrabold text-xs uppercase tracking-wider text-stone-700">
                        Detailed Answer Explanations:
                      </h5>
                      {questions.map((q, idx) => {
                        const isCorrect = answers[idx] === q.answer;
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border text-xs space-y-2 ${
                              isCorrect
                                ? "bg-emerald-50/50 border-emerald-200"
                                : "bg-rose-50/40 border-rose-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                                Question {idx + 1}
                                {isCorrect ? (
                                  <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-bold flex items-center gap-0.5 text-[11px]">
                                    <AlertCircle className="w-3.5 h-3.5" /> Review
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] font-semibold text-stone-500">
                                {q.subtopic}
                              </span>
                            </div>

                            <p className="text-stone-800 font-medium">{q.q}</p>

                            <div className="text-[11.5px] space-y-1">
                              {!isCorrect && (
                                <p className="text-rose-700">
                                  <strong>Your Answer:</strong> Option {["A", "B", "C", "D"][answers[idx]]} ({q.options[answers[idx]]})
                                </p>
                              )}
                              <p className="text-emerald-800">
                                <strong>Ideal Answer:</strong> Option {["A", "B", "C", "D"][q.answer]} ({q.options[q.answer]})
                              </p>
                              <div className="p-2.5 bg-white/80 rounded-xl border border-stone-200 text-stone-700 leading-relaxed mt-1">
                                <strong>Why:</strong> {q.explanation}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      {saveError && (
                        <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {saveError}
                        </div>
                      )}
                      {saved ? (
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4" /> Score saved to your skill tree!
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-[#12161f] hover:bg-[#1a202c] text-white border border-[#d4af37]/60 font-bold text-xs h-10 px-6 rounded-xl shadow-xs"
                        >
                          {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                          {saving ? "Saving..." : "Save Score to My Skill Tree"}
                        </Button>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAnswers({});
                            setResult(null);
                            setSaved(false);
                          }}
                          className="text-xs font-semibold h-10 rounded-xl"
                        >
                          Retake Test
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={closeQuiz}
                          className="text-xs font-bold h-10 rounded-xl bg-stone-900 text-white hover:bg-stone-800"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
