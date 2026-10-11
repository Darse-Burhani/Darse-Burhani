"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  Brain,
  Users,
  Shield,
  Heart,
  ClipboardList,
  Palette,
  History,
  Award,
  GraduationCap,
  BookOpen,
  X,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { getSkillsRecords, type TalabatSkillRecord } from "@/lib/api";
import {
  AGE_GROUPS,
  SKILL_TOPICS,
  SKILL_QUESTIONS_BY_AGE,
  type AgeGroupId,
  type SkillQuestion,
} from "@/lib/skill-questions";

const SKILL_ORDER = ["criticalThinking", "collaboration", "leadership", "resilience"] as const;
const SKILL_LABELS: Record<string, string> = {
  criticalThinking: "Critical Thinking",
  collaboration: "Collaboration",
  leadership: "Leadership",
  resilience: "Resilience",
};
const SKILL_ICONS: Record<string, React.ElementType> = {
  criticalThinking: Brain,
  collaboration: Users,
  leadership: Shield,
  resilience: Heart,
};
const SKILL_BAR: Record<string, string> = {
  criticalThinking: "from-purple-500 to-purple-400",
  collaboration: "from-blue-500 to-blue-400",
  leadership: "from-amber-500 to-[#d4af37]",
  resilience: "from-rose-500 to-rose-400",
};

export default function AdminSkillsPage() {
  const [records, setRecords] = useState<TalabatSkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Question bank modal state
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [bankAgeGroup, setBankAgeGroup] = useState<AgeGroupId>("middle");
  const [bankTopic, setBankTopic] = useState<string>("ALL");

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = search.trim();
      setRecords(
        await getSkillsRecords({
          ...(q ? { q } : {}),
          ...(gradeFilter !== "ALL" ? { grade: gradeFilter } : {}),
        })
      );
    } catch (e: any) {
      setError(e.message || "Failed to load skills records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchRecords, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, gradeFilter]);

  const grades = useMemo(() => {
    const set = new Set(records.map((r) => r.grade).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [records]);

  const stats = useMemo(() => {
    const tested = records.filter((r) => r.attempts.length > 0).length;
    const withHobbies = records.filter((r) => r.hobbies.length > 0).length;
    const avgs = records.map((r) => r.assignmentStats.averagePct).filter((v): v is number => v !== null);
    return {
      total: records.length,
      tested,
      withHobbies,
      avgMarks: avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null,
    };
  }, [records]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-slate-900">
            <Sparkles size={22} className="text-emerald-700" /> Talabat Skills Records
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Every talabat's skill-tree %, Q&A test scores, assignment marks and hobbies — in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowQuestionBank(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <BookOpen size={15} />
          Question Bank (Topic &amp; Age Wise)
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Talabat", value: stats.total },
          { label: "Tested skills", value: stats.tested },
          { label: "With hobbies", value: stats.withHobbies },
          { label: "Avg assignment %", value: stats.avgMarks === null ? "—" : `${stats.avgMarks}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className="text-xl font-extrabold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + grade filter */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or ITS…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[13.5px] focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-bold text-slate-700 focus:border-emerald-600 focus:outline-none"
            aria-label="Filter by grade"
          >
            {grades.map((g) => (
              <option key={g} value={g}>
                {g === "ALL" ? "All grades" : `Grade ${g}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchRecords}
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-white" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center">
            <GraduationCap size={28} className="mx-auto text-slate-300" />
            <p className="mt-2 text-[13.5px] font-bold text-slate-700">No talabat found</p>
            <p className="mt-1 text-[12px] text-slate-500">Try a different search or grade filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {records.map((r) => {
            const isOpen = expanded === r.studentId;
            const skillVals = SKILL_ORDER.map((k) => r.skills[k] || 0);
            const overall = Math.round(skillVals.reduce((a, b) => a + b, 0) / skillVals.length);
            return (
              <div key={r.studentId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : r.studentId)}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50/60"
                >
                  <Avatar className="h-11 w-11 shrink-0 rounded-xl">
                    {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt={r.name} /> : null}
                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-[13px] font-black text-white">
                      {getInitials(r.name.split(" ")[0] || "T", r.name.split(" ").slice(1).join(" ") || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-extrabold text-slate-900">{r.name}</p>
                    <p className="font-mono text-[11.5px] text-slate-500">
                      {r.its} · Gr {r.grade}{r.section}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    {SKILL_ORDER.map((k) => (
                      <span
                        key={k}
                        title={`${SKILL_LABELS[k]}: ${r.skills[k] || 0}%`}
                        className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-black text-slate-700"
                      >
                        {r.skills[k] || 0}
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-700 px-2.5 py-1 text-[12px] font-black text-white">
                    {overall}%
                  </span>
                  <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
                        {/* Skill bars */}
                        <div>
                          <h4 className="mb-2 text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
                            Skill-tree levels
                          </h4>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {SKILL_ORDER.map((k) => {
                              const Icon = SKILL_ICONS[k];
                              const v = r.skills[k] || 0;
                              const latest = r.latestScores[k];
                              return (
                                <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800">
                                      <Icon size={14} className="text-emerald-700" />
                                      {SKILL_LABELS[k]}
                                    </span>
                                    <span className="font-mono text-[12.5px] font-black text-slate-900">
                                      {v}%
                                      {latest !== null && latest !== undefined && (
                                        <span className="ml-1.5 rounded-md bg-white px-1.5 py-0.5 text-[10.5px] text-slate-500 ring-1 ring-slate-200">
                                          test {latest}%
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70">
                                    <div
                                      className={`h-full rounded-full bg-gradient-to-r ${SKILL_BAR[k]}`}
                                      style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          {/* Assignments */}
                          <div>
                            <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
                              <ClipboardList size={13} /> Assignment marks
                              {r.assignmentStats.averagePct !== null && (
                                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px]">
                                  avg {r.assignmentStats.averagePct}%
                                </Badge>
                              )}
                            </h4>
                            {r.assignmentStats.marks.length === 0 ? (
                              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-[12px] text-slate-500">
                                No marks awarded yet ({r.assignmentStats.graded} graded of {r.totalAssignments} posted).
                              </p>
                            ) : (
                              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                                {r.assignmentStats.marks.map((m) => (
                                  <div key={m.assignmentId} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-[12.5px] font-bold text-slate-800">{m.title}</p>
                                      {m.subject && <p className="text-[11px] text-slate-400">{m.subject}</p>}
                                    </div>
                                    <span className="shrink-0 font-mono text-[12.5px] font-black text-emerald-800">
                                      {m.marks}/{m.maxMarks}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Q&A attempts + hobbies */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
                                <History size={13} /> Q&A test history
                              </h4>
                              {r.attempts.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-[12px] text-slate-500">
                                  No skill tests taken yet.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {r.attempts.slice(0, 8).map((a) => (
                                    <span
                                      key={a.id}
                                      title={`${SKILL_LABELS[a.skill] || a.skill} · ${a.correctAnswers}/${a.totalQuestions} · ${new Date(a.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}`}
                                      className={`rounded-lg border px-2 py-1 font-mono text-[11.5px] font-black ${
                                        a.score >= 60
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                          : a.score >= 40
                                          ? "border-amber-200 bg-amber-50 text-amber-800"
                                          : "border-rose-200 bg-rose-50 text-rose-700"
                                      }`}
                                    >
                                      {(SKILL_LABELS[a.skill] || a.skill).split(" ")[0]} {a.score}%
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
                                <Palette size={13} /> Hobbies & skills ({r.hobbies.length})
                              </h4>
                              {r.hobbies.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-[12px] text-slate-500">
                                  None added yet.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {r.hobbies.map((h) => (
                                    <span key={h.id} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[11.5px] font-bold text-violet-900 ring-1 ring-violet-200">
                                      <Award size={11} />
                                      {h.name}
                                      {h.level && <span className="font-medium text-violet-500">· {h.level}</span>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          ADMIN QUESTION BANK INSPECTOR (TOPIC & AGE WISE)
      ════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showQuestionBank && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl my-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-slate-900 text-white p-5 sm:px-6 rounded-t-3xl border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Curriculum Bank
                    </span>
                    <span className="text-xs text-slate-400">Topic-Wise &amp; Age-Group Adapted</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white mt-1">
                    Skills Q&amp;A Curriculum Repository
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuestionBank(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* ── 1. Age Group Selection Bar ── */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                    1. Select Student Age Group / Educational Tier:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {AGE_GROUPS.map((ag) => {
                      const isSelected = bankAgeGroup === ag.id;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => setBankAgeGroup(ag.id)}
                          className={`p-3.5 rounded-2xl text-left transition-all border-2 cursor-pointer ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-600/10"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${ag.badgeBg}`}>
                              {ag.ageRange}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                          </div>
                          <p className="font-extrabold text-sm text-slate-900">{ag.label} Tier</p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">{ag.grades}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 2. Topic Filter Tabs ── */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                    2. Filter by Skill Topic:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setBankTopic("ALL")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        bankTopic === "ALL"
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      All Topics ({Object.values(SKILL_QUESTIONS_BY_AGE[bankAgeGroup] || {}).flat().length})
                    </button>
                    {SKILL_ORDER.map((k) => {
                      const meta = SKILL_TOPICS[k];
                      const count = (SKILL_QUESTIONS_BY_AGE[bankAgeGroup]?.[k] || []).length;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setBankTopic(k)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            bankTopic === k
                              ? "bg-emerald-700 text-white shadow-xs"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {meta.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 3. Question Cards Display ── */}
                <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                  {(bankTopic === "ALL"
                    ? Object.values(SKILL_QUESTIONS_BY_AGE[bankAgeGroup] || {}).flat()
                    : SKILL_QUESTIONS_BY_AGE[bankAgeGroup]?.[bankTopic] || []
                  ).map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{q.topic}</span>
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {q.subtopic}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {AGE_GROUPS.find((ag) => ag.id === bankAgeGroup)?.label} Tier
                        </span>
                      </div>

                      <p className="text-[13px] font-bold text-slate-900 leading-relaxed">
                        {q.q}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                        {q.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                              oi === q.answer
                                ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold"
                                : "bg-slate-50/60 border-slate-200 text-slate-600"
                            }`}
                          >
                            <span className="font-mono font-bold text-[10px] text-slate-500 mt-0.5">
                              {["A", "B", "C", "D"][oi]}.
                            </span>
                            <span className="flex-1">{opt}</span>
                            {oi === q.answer && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-100 bg-emerald-50/30 -mx-4 -mb-4 p-3 rounded-b-2xl text-[11px] text-emerald-900 leading-relaxed">
                        <strong>Educational Pedagogy / Objective:</strong> {q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
