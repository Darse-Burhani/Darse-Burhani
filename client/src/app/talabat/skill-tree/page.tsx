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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/student/PageHeader";
import { SKILL_QUESTIONS, SKILL_META } from "@/lib/skill-questions";
import { submitSkillAttempt } from "@/lib/api";

const skillCategories = [
  { key: "criticalThinking", icon: Brain, color: "text-purple-600", bg: "bg-purple-100", barGradient: "from-purple-500 to-purple-400", glowColor: "shadow-purple-200" },
  { key: "collaboration", icon: Users, color: "text-blue-600", bg: "bg-blue-100", barGradient: "from-blue-500 to-blue-400", glowColor: "shadow-blue-200" },
  { key: "leadership", icon: Shield, color: "text-amber-600", bg: "bg-amber-100", barGradient: "from-amber-500 to-[#d4af37]", glowColor: "shadow-amber-200" },
  { key: "resilience", icon: Heart, color: "text-rose-600", bg: "bg-rose-100", barGradient: "from-rose-500 to-rose-400", glowColor: "shadow-rose-200" },
];

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

  const [quizSkill, setQuizSkill] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ correct: number; total: number; pct: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/talabat/skill-tree").then((x) => x.json());
      if (r.success) setSkills(r.data);
      const h = await fetch("/api/talabat/skill-tree/history").then((x) => x.json());
      if (h.success) setHistory(h.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const questions = useMemo(
    () => (quizSkill ? SKILL_QUESTIONS[quizSkill] || [] : []),
    [quizSkill]
  );

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
    setResult({ correct, total: questions.length, pct: Math.round((correct / questions.length) * 100) });
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

  const meta = quizSkill ? SKILL_META[quizSkill] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        icon={Sparkles}
        title="Skill Tree"
        subtitle="Test yourself with a quick Q&A — your score becomes your skill %"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSkills}
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-6">{Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="fatimi-card animate-pulse">
            <div className="fatimi-card-header" />
            <CardContent className="p-6"><div className="w-full h-32 bg-gray-200 rounded" /></CardContent>
          </Card>
        ))}</div>
      ) : skills ? (
        <>
          <div className="grid sm:grid-cols-2 gap-6">
            {skillCategories.map((skill, i) => {
              const value = skills[skill.key] || 0;
              const level = Math.floor(value / 10);
              return (
                <div key={skill.key} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                  <Card className="fatimi-card hover:shadow-lg transition-shadow">
                    <div className="fatimi-card-header" />
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl ${skill.bg} shadow-lg ${skill.glowColor}`}>
                            <skill.icon className={`w-6 h-6 ${skill.color}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{SKILL_META[skill.key]?.label}</h3>
                            <p className="text-sm text-gray-500">Level {level}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{value}<span className="text-sm text-gray-500">%</span></p>
                        </div>
                      </div>
                      <div className="w-full bg-emerald-100/60 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-4 rounded-full bg-gradient-to-r ${skill.barGradient} animate-progress`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] text-gray-500">0</span>
                        <span className="text-[10px] text-gray-500">100</span>
                      </div>
                      <div className="flex gap-1 mt-3">
                        {Array.from({ length: 10 }).map((_, j) => (
                          <div
                            key={j}
                            className="flex-1 h-1.5 rounded-full transition-all duration-300"
                            style={{
                              background: j < level
                                ? j === level - 1
                                  ? "linear-gradient(90deg, #059669, #d4af37)"
                                  : "#059669"
                                : "#e5e7eb"
                            }}
                          />
                        ))}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openQuiz(skill.key)}
                        className="mt-4 w-full bg-emerald-700 hover:bg-emerald-800 font-bold text-xs h-9 rounded-xl"
                      >
                        <ClipboardCheck className="w-4 h-4 mr-1.5" /> Take {SKILL_META[skill.key]?.label} Q&A test
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Recent attempts */}
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-slate-900 mb-3">
              <History size={16} className="text-emerald-700" /> My recent test scores
            </h2>
            {history.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6 text-center text-[13px] text-slate-500">
                  No tests taken yet — open any skill card and tap the Q&A test button.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {history.slice(0, 6).map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">{SKILL_META[h.skill]?.label || h.skill}</p>
                      <p className="text-[11.5px] text-slate-400">
                        {h.correctAnswers}/{h.totalQuestions} correct · {new Date(h.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <Badge className={`text-[13px] font-black ${h.score >= 60 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : h.score >= 40 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
                      {h.score}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <Card className="fatimi-card"><CardContent className="p-12 text-center text-gray-500">No skill data yet. Take a Q&A test to build your skills!</CardContent></Card>
      )}

      {/* ── Quiz modal ── */}
      <AnimatePresence>
        {quizSkill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-emerald-900 px-5 py-4 text-white rounded-t-3xl z-10">
                <div>
                  <h3 className="text-[15px] font-extrabold">{meta?.label} — Q&A test</h3>
                  <p className="text-[12px] text-emerald-200">
                    {result ? "Your result" : `${answeredCount}/${questions.length} answered`} · {questions.length} questions
                  </p>
                </div>
                <button type="button" onClick={closeQuiz} className="rounded-lg p-1.5 text-emerald-200 hover:bg-white/10 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {!result ? (
                  <>
                    {questions.map((q, qi) => (
                      <div key={qi} className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-[13.5px] font-bold text-slate-900">
                          <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-800">
                            {qi + 1}
                          </span>
                          {q.q}
                        </p>
                        <div className="mt-2.5 space-y-1.5">
                          {q.options.map((opt, oi) => {
                            const active = answers[qi] === oi;
                            return (
                              <button
                                key={oi}
                                type="button"
                                onClick={() => setAnswers((p) => ({ ...p, [qi]: oi }))}
                                className={`w-full rounded-xl border px-3 py-2 text-left text-[13px] transition active:scale-[0.99] ${
                                  active
                                    ? "border-emerald-600 bg-emerald-50 font-bold text-emerald-900 ring-2 ring-emerald-600/20"
                                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <span className="mr-2 font-mono text-[11px] font-bold text-slate-400">
                                  {["A", "B", "C", "D"][oi]}
                                </span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleCheck}
                      disabled={answeredCount < questions.length}
                      className="w-full rounded-xl bg-emerald-700 py-3 text-[14px] font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {answeredCount < questions.length
                        ? `Answer all questions (${answeredCount}/${questions.length})`
                        : "See my score"}
                    </button>
                  </>
                ) : (
                  <div className="py-2 text-center">
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 text-3xl font-black ${
                        result.pct >= 60 ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : result.pct >= 40 ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-rose-400 bg-rose-50 text-rose-600"
                      }`}
                    >
                      {result.pct}%
                    </motion.div>
                    <p className="mt-3 text-[15px] font-extrabold text-slate-900">
                      You scored {result.correct} out of {result.total}
                    </p>
                    <p className="mx-auto mt-1 max-w-[40ch] text-[13px] text-slate-500">
                      {result.pct >= 80
                        ? "Outstanding! You truly live this skill."
                        : result.pct >= 60
                        ? "Well done! A little polish and you'll be excellent."
                        : result.pct >= 40
                        ? "Fair start — retake the test after practising."
                        : "Don't give up — try again and watch your % grow."}
                    </p>

                    {saveError && (
                      <div className="mx-auto mt-3 flex max-w-md items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-800">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" /> {saveError}
                      </div>
                    )}
                    {saved ? (
                      <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] font-bold text-emerald-800">
                        <CheckCircle2 size={15} /> Score saved — your Skill Tree is updated!
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="mx-auto mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-700 px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {saving && <Loader2 size={15} className="animate-spin" />}
                        {saving ? "Saving…" : "Save my score"}
                      </button>
                    )}
                    <div className="mt-3 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAnswers({});
                          setResult(null);
                          setSaved(false);
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Retake test
                      </button>
                      <button
                        type="button"
                        onClick={closeQuiz}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-slate-700"
                      >
                        Back to Skill Tree
                      </button>
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
