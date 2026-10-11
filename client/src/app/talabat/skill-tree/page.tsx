"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/student/PageHeader";
import {
  SKILL_QUESTIONS_BY_AGE,
  SKILL_TOPICS,
  SKILL_META,
  AGE_GROUPS,
  type AgeGroupId,
  type SkillQuestion,
  getQuestionsForSkillAndAge,
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

export default function TalabatSkillTreePage() {
  const [skills, setSkills] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AttemptRecord[]>([]);

  // Age selection state (Junior 7-10, Middle 11-14, Senior 15-18+)
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroupId>("middle");

  // Quiz Modal State
  const [quizSkill, setQuizSkill] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ correct: number; total: number; pct: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Question Bank Explorer State
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerTopic, setExplorerTopic] = useState<string>("ALL");
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/talabat/skill-tree").then((x) => x.json());
      if (r.success) setSkills(r.data);
      const h = await fetch("/api/talabat/skill-tree/history").then((x) => x.json());
      if (h.success) setHistory(h.data);

      // Auto-detect student grade/age to set initial age group if possible
      const p = await fetch("/api/talabat/profile").then((x) => x.json()).catch(() => null);
      if (p?.grade) {
        const g = String(p.grade).trim().toLowerCase();
        if (["1", "2", "3", "4", "darajah 1", "darajah 2", "darajah 3", "darajah 4"].some((prefix) => g.includes(prefix))) {
          setSelectedAgeGroup("junior");
        } else if (["5", "6", "7", "8", "darajah 5", "darajah 6", "darajah 7", "darajah 8"].some((prefix) => g.includes(prefix))) {
          setSelectedAgeGroup("middle");
        } else {
          setSelectedAgeGroup("senior");
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

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
      const h = await fetch("/api/talabat/skill-tree/history").then((x) => x.json());
      if (h.success) setHistory(h.data);
    } catch (e: any) {
      setSaveError(e.message || "Failed to save score");
    } finally {
      setSaving(false);
    }
  };

  const activeQuizTopicMeta = quizSkill ? SKILL_TOPICS[quizSkill] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
              className="border-white/25 bg-white/10 text-white hover:bg-white/20 font-semibold"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              {showExplorer ? "Hide Question Bank" : "Explore Question Bank"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSkills}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* ════════════════════════════════════════════════════════════
          AGE GROUP SELECTION BAR (TOPIC & AGE WISE ARCHITECTURE)
      ════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Age-Adapted Curriculum
              </span>
              <span className="text-xs text-slate-500 font-medium">Select Student Age Group</span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
              Choose Age Group to Display Questions &amp; Tests
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            Active: <strong className="text-emerald-800">{activeAgeMeta.label} ({activeAgeMeta.ageRange})</strong>
          </span>
        </div>

        {/* Age Group Cards / Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {AGE_GROUPS.map((ag) => {
            const isSelected = selectedAgeGroup === ag.id;
            return (
              <button
                key={ag.id}
                type="button"
                onClick={() => {
                  setSelectedAgeGroup(ag.id);
                  if (quizSkill) {
                    setAnswers({});
                    setResult(null);
                  }
                }}
                className={`relative p-4 rounded-2xl text-left transition-all border-2 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "border-emerald-600 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 shadow-md ring-2 ring-emerald-600/10"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${ag.badgeBg}`}>
                      {ag.ageRange}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {ag.grades}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {ag.label} Tier
                  </h3>
                  <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                    {ag.tagline}
                  </p>
                  <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {ag.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">
                    5 questions per topic (20 total)
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 font-bold text-emerald-700">
                      <Check className="w-3.5 h-3.5" /> Selected
                    </span>
                  )}
                </div>
              </button>
            );
          })}
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
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">
                      Curriculum Question Bank Explorer
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
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
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
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
                            ? "bg-emerald-500 text-slate-950 shadow-sm"
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
                          <span className="font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-white text-[13px]">{q.topic}</span>
                          <span className="text-[11px] text-amber-300 font-serif dir-rtl" dir="rtl">
                            • {q.subtopic}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">
                          {activeAgeMeta.label} ({activeAgeMeta.ageRange})
                        </span>
                      </div>

                      <p className="text-[13px] text-slate-200 font-medium leading-relaxed mb-3">
                        {q.q}
                      </p>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 mb-3">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-xl border flex items-start gap-2 ${
                              optIdx === q.answer
                                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-semibold"
                                : "bg-black/20 border-white/5"
                            }`}
                          >
                            <span className="font-mono font-bold text-[10px] text-slate-400 mt-0.5">
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
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                        >
                          {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExp ? "Hide Educational Pedagogy" : "View Pedagogical Explanation"}
                        </button>
                        <span className="text-[10px] text-slate-400">
                          Correct Answer: Option {["A", "B", "C", "D"][q.answer]}
                        </span>
                      </div>

                      {isExp && (
                        <div className="mt-2.5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-[11.5px] leading-relaxed">
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
            <h2 className="text-lg font-extrabold text-slate-900">
              Assessed Skills — Topic-Wise Dashboard
            </h2>
            <p className="text-xs text-slate-500">
              Questions below are currently customized for <strong>{activeAgeMeta.label} ({activeAgeMeta.ageRange})</strong>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-white border border-slate-200 p-6" />
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
                  className="rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between bg-white"
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
                            <h3 className="font-extrabold text-base text-slate-900">{meta.label}</h3>
                            <span className="text-xs font-bold text-[#961212] font-alkanz dir-rtl" dir="rtl">
                              {meta.arabicLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">{meta.blurb}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl font-extrabold text-slate-900 font-mono">
                          {currentScore}%
                        </span>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          Current Score
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${meta.barGradient} transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, currentScore))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>Score Level</span>
                        <span>
                          {currentScore >= 80 ? "Mastery" : currentScore >= 60 ? "Proficient" : currentScore >= 40 ? "Developing" : "Beginner"}
                        </span>
                      </div>
                    </div>

                    {/* Age Tailored Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${activeAgeMeta.badgeBg.split(" ")[0]}`} />
                        {activeAgeMeta.label} Test ({questionsForThisSkill.length} Qs)
                      </span>

                      <Button
                        size="sm"
                        onClick={() => openQuiz(key)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
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
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-slate-900 mb-3">
          <History size={16} className="text-emerald-700" /> My Recent Assessment Scores
        </h2>
        {history.length === 0 ? (
          <Card className="rounded-2xl border border-slate-200">
            <CardContent className="p-6 text-center text-xs text-slate-500">
              No tests taken yet. Tap <strong>Take Q&amp;A Test</strong> on any skill card above to begin your assessment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {history.slice(0, 6).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs"
              >
                <div>
                  <p className="text-[13px] font-bold text-slate-900">
                    {SKILL_TOPICS[h.skill]?.label || h.skill}
                  </p>
                  <p className="text-[11.5px] text-slate-400">
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
          QUIZ MODAL (TOPIC-WISE & AGE-WISE QUESTION ENGINE)
      ════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {quizSkill && activeQuizTopicMeta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl my-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-900 to-slate-900 px-6 py-4 text-white rounded-t-3xl border-b border-emerald-800/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-emerald-200">
                        {activeAgeMeta.label} ({activeAgeMeta.ageRange})
                      </span>
                      <span className="text-xs text-amber-300 font-serif dir-rtl" dir="rtl">
                        {activeQuizTopicMeta.arabicLabel}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold mt-0.5">
                      {activeQuizTopicMeta.label} — Assessment
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={closeQuiz}
                    className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Sub-bar with In-Quiz Age Switcher */}
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-300 text-[11px]">Age Tier:</span>
                    {AGE_GROUPS.map((ag) => (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => {
                          setSelectedAgeGroup(ag.id);
                          setAnswers({});
                          setResult(null);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                          selectedAgeGroup === ag.id
                            ? "bg-white text-emerald-950"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {ag.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-emerald-200 font-medium">
                    {result ? "Result Complete" : `${answeredCount}/${questions.length} answered`}
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-5">
                {!result ? (
                  <>
                    <div className="space-y-4">
                      {questions.map((q, qi) => (
                        <div
                          key={q.id || qi}
                          className="rounded-2xl border border-slate-200/90 p-4 sm:p-5 bg-white shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-black text-white">
                                {qi + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{q.topic}</span>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {q.subtopic}
                            </span>
                          </div>

                          <p className="text-[13.5px] font-bold text-slate-900 leading-relaxed">
                            {q.q}
                          </p>

                          {/* 4 Options */}
                          <div className="space-y-2">
                            {q.options.map((opt, oi) => {
                              const active = answers[qi] === oi;
                              return (
                                <button
                                  key={oi}
                                  type="button"
                                  onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-xs sm:text-[13px] leading-relaxed transition-all cursor-pointer flex items-start gap-2.5 ${
                                    active
                                      ? "border-emerald-600 bg-emerald-50/80 font-bold text-emerald-950 ring-2 ring-emerald-600/20 shadow-xs"
                                      : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                  }`}
                                >
                                  <span
                                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold mt-0.5 ${
                                      active
                                        ? "bg-emerald-700 text-white"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {["A", "B", "C", "D"][oi]}
                                  </span>
                                  <span className="flex-1">{opt}</span>
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
                        className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {answeredCount < questions.length
                          ? `Answer all questions (${answeredCount}/${questions.length}) to see score`
                          : "Calculate My Score"}
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
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : result.pct >= 40
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-rose-400 bg-rose-50 text-rose-600"
                        }`}
                      >
                        {result.pct}%
                      </motion.div>
                      <h4 className="mt-3 text-lg font-extrabold text-slate-900">
                        You scored {result.correct} out of {result.total}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        {result.pct >= 80
                          ? "Outstanding mastery! You exemplify thoughtful, ethical decision-making."
                          : result.pct >= 60
                          ? "Very good performance! Review the explanations below to master the nuances."
                          : "Good effort! Read the answer rationales below and try again to improve your score."}
                      </p>
                    </div>

                    {/* Question by Question Review */}
                    <div className="space-y-3">
                      <h5 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
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
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
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
                              <span className="text-[11px] font-semibold text-slate-500">
                                {q.subtopic}
                              </span>
                            </div>

                            <p className="text-slate-800 font-medium">{q.q}</p>

                            <div className="text-[11.5px] space-y-1">
                              {!isCorrect && (
                                <p className="text-rose-700">
                                  <strong>Your Answer:</strong> Option {["A", "B", "C", "D"][answers[idx]]} ({q.options[answers[idx]]})
                                </p>
                              )}
                              <p className="text-emerald-800">
                                <strong>Ideal Answer:</strong> Option {["A", "B", "C", "D"][q.answer]} ({q.options[q.answer]})
                              </p>
                              <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200 text-slate-700 leading-relaxed mt-1">
                                <strong>Why:</strong> {q.explanation}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      {saveError && (
                        <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {saveError}
                        </div>
                      )}
                      {saved ? (
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4" /> Score saved to your profile!
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-xs"
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
                          className="text-xs font-bold h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
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
