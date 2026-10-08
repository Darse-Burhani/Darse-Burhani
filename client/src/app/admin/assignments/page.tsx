"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  GraduationCap,
  Search,
  Brain,
  Users,
  Shield,
  Heart,
  UserCheck,
  Building2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentGrades,
  saveAssignmentGrade,
  getAssignmentStudents,
  getSkillAttempts,
  type AssignmentItem,
  type AssignmentGradeItem,
  type AssignmentStudentOption,
  type SkillAttemptItem,
} from "@/lib/api";

const SKILL_OPTIONS = [
  { value: "", label: "No skill link" },
  { value: "criticalThinking", label: "Critical Thinking (Fikr & Tahqeeq)" },
  { value: "collaboration", label: "Collaboration (Ta'awun)" },
  { value: "leadership", label: "Leadership (Qiyadah)" },
  { value: "resilience", label: "Resilience (Sabr & Istiqaamat)" },
];

const SKILL_ICONS: Record<string, React.ElementType> = {
  criticalThinking: Brain,
  collaboration: Users,
  leadership: Shield,
  resilience: Heart,
};

type Tab = "assignments" | "skilltests";

export default function AdminAssignmentsPage() {
  const [tab, setTab] = useState<Tab>("assignments");
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentItem | null>(null);
  const [audienceType, setAudienceType] = useState<"CLASS" | "STUDENT">("CLASS");
  const [targetStudent, setTargetStudent] = useState<AssignmentStudentOption | null>(null);
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [skillCategory, setSkillCategory] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [dueDate, setDueDate] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Grading
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grades, setGrades] = useState<AssignmentGradeItem[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<AssignmentStudentOption[]>([]);
  const [pickedStudent, setPickedStudent] = useState<AssignmentStudentOption | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [gradeSaving, setGradeSaving] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  // Skill attempts
  const [attempts, setAttempts] = useState<SkillAttemptItem[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");

  const selected = useMemo(() => assignments.find((a) => a.id === selectedId) || null, [assignments, selectedId]);

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      setAssignments(await getAssignments());
    } catch (e: any) {
      setError(e.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async (assignmentId: string) => {
    setGradesLoading(true);
    try {
      setGrades(await getAssignmentGrades(assignmentId));
    } catch {
      setGrades([]);
    } finally {
      setGradesLoading(false);
    }
  };

  const fetchAttempts = async () => {
    setAttemptsLoading(true);
    try {
      setAttempts(await getSkillAttempts(skillFilter ? { skill: skillFilter } : undefined));
    } catch {
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (tab === "skilltests") fetchAttempts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, skillFilter]);

  useEffect(() => {
    if (selectedId) {
      fetchGrades(selectedId);
      const curr = assignments.find((a) => a.id === selectedId);
      if (curr?.targetStudent) {
        setPickedStudent(curr.targetStudent);
      } else {
        setPickedStudent(null);
      }
    } else {
      setGrades([]);
      setPickedStudent(null);
    }
    setMarks("");
    setFeedback("");
    setGradeError(null);
  }, [selectedId, assignments]);

  // Student search for form and grading (debounced)
  useEffect(() => {
    const q = (studentSearchInput || studentQuery).trim();
    const t = setTimeout(async () => {
      try {
        setStudentOptions(await getAssignmentStudents(q || undefined));
      } catch {
        setStudentOptions([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [studentSearchInput, studentQuery, formOpen, selectedId]);

  const openCreate = () => {
    setEditing(null);
    setAudienceType("CLASS");
    setTargetStudent(null);
    setStudentSearchInput("");
    setTitle("");
    setDescription("");
    setSubject("");
    setSkillCategory("");
    setMaxMarks("100");
    setDueDate("");
    setGrade("");
    setSection("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (a: AssignmentItem) => {
    setEditing(a);
    if (a.targetStudentId && a.targetStudent) {
      setAudienceType("STUDENT");
      setTargetStudent(a.targetStudent);
    } else {
      setAudienceType("CLASS");
      setTargetStudent(null);
    }
    setStudentSearchInput("");
    setTitle(a.title);
    setDescription(a.description || "");
    setSubject(a.subject || "");
    setSkillCategory(a.skillCategory || "");
    setMaxMarks(String(a.maxMarks));
    setDueDate(a.dueDate ? a.dueDate.slice(0, 10) : "");
    setGrade(a.grade || "");
    setSection(a.section || "");
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (audienceType === "STUDENT" && !targetStudent) {
      setFormError("Please select a specific talib for this individual assignment.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        subject: subject.trim() || undefined,
        skillCategory: skillCategory || undefined,
        maxMarks: Number(maxMarks) || 100,
        dueDate: dueDate || undefined,
        grade: audienceType === "STUDENT" ? targetStudent?.grade || grade.trim() || undefined : grade.trim() || undefined,
        section: audienceType === "STUDENT" ? targetStudent?.section || section.trim() || undefined : section.trim() || undefined,
        targetStudentId: audienceType === "STUDENT" && targetStudent ? targetStudent.id : null,
      };
      if (editing) await updateAssignment(editing.id, payload);
      else await createAssignment(payload);
      setFormOpen(false);
      fetchAssignments();
    } catch (e: any) {
      setFormError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this assignment and all its awarded marks?")) return;
    try {
      await deleteAssignment(id);
      if (selectedId === id) setSelectedId(null);
      fetchAssignments();
    } catch (e: any) {
      setError(e.message || "Failed to delete");
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !pickedStudent) {
      setGradeError("Search and pick a student first.");
      return;
    }
    const m = Number(marks);
    if (!Number.isFinite(m) || m < 0 || m > selected.maxMarks) {
      setGradeError(`Marks must be between 0 and ${selected.maxMarks}.`);
      return;
    }
    setGradeSaving(true);
    setGradeError(null);
    try {
      await saveAssignmentGrade(selected.id, {
        studentId: pickedStudent.id,
        marks: m,
        feedback: feedback.trim() || undefined,
      });
      if (!selected.targetStudentId) {
        setPickedStudent(null);
      }
      setMarks("");
      setFeedback("");
      setStudentQuery("");
      fetchGrades(selected.id);
      fetchAssignments();
    } catch (e: any) {
      setGradeError(e.message || "Failed to save marks");
    } finally {
      setGradeSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-slate-900">
            <ClipboardList size={22} className="text-emerald-700" /> Academic & Skill Assignments
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Assign class-wide or specific individual talabat tasks, award marks, and review skill metrics.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
          {(["assignments", "skilltests"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-[13px] font-bold transition ${
                tab === t ? "bg-emerald-700 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t === "assignments" ? "Assignments" : "Skill test scores (15–20 yrs)"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {tab === "assignments" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: list + create */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-extrabold text-slate-800">Assignments ({assignments.length})</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchAssignments}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                  title="Refresh"
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-emerald-800 shadow-sm"
                >
                  <Plus size={15} /> New assignment
                </button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-white border border-slate-100" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-[13px] text-slate-500">
                  No assignments yet — click “New assignment” to post the first one.
                </CardContent>
              </Card>
            ) : (
              assignments.map((a) => {
                const active = a.id === selectedId;
                const isTargeted = Boolean(a.targetStudentId);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(active ? null : a.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {isTargeted ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100/90 px-2 py-0.5 text-[11px] font-extrabold text-amber-900 border border-amber-300">
                              <UserCheck size={11} /> Specific Talib: {a.targetStudent?.name || "Targeted Student"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              <Building2 size={11} /> Class: Gr {a.grade || "All"}{a.section ? `-${a.section}` : ""}
                            </span>
                          )}
                          {a.subject && (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              {a.subject}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[14.5px] font-extrabold text-slate-900">{a.title}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-slate-500">
                          <span>Max {a.maxMarks} marks</span>
                          {a.dueDate && <span>Due {new Date(a.dueDate).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</span>}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {a.gradedCount || 0} graded
                      </span>
                    </div>
                    <div className="mt-2.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11.5px] font-bold text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: grading panel */}
          <div>
            {!selected ? (
              <Card className="rounded-2xl border-dashed">
                <CardContent className="p-10 text-center">
                  <GraduationCap size={28} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-[13.5px] font-bold text-slate-700">Select an assignment to award marks</p>
                  <p className="mt-1 text-[12px] text-slate-500">Search any assigned talabat, enter marks, and add constructive feedback.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    {selected.targetStudent ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
                        <UserCheck size={11} /> Individual Assignment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        <Building2 size={11} /> Class Assignment (Gr {selected.grade || "All"}{selected.section ? `-${selected.section}` : ""})
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-[15px] font-extrabold text-slate-900">
                    Grading: {selected.title}
                    <span className="ml-2 text-[12px] font-bold text-slate-400">/ {selected.maxMarks} marks</span>
                  </h3>
                </div>

                <form onSubmit={handleSaveGrade} className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  {gradeError && (
                    <p className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-800">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" /> {gradeError}
                    </p>
                  )}
                  <div className="relative">
                    <label htmlFor="grade-student-search" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {selected.targetStudent ? "Assigned Talib" : "Find Talib (name / ITS)"}
                    </label>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="grade-student-search"
                        readOnly={Boolean(selected.targetStudent)}
                        value={pickedStudent ? `${pickedStudent.name} (${pickedStudent.its || "No ITS"} · Gr ${pickedStudent.grade}${pickedStudent.section})` : studentQuery}
                        onChange={(e) => {
                          if (!selected.targetStudent) {
                            setPickedStudent(null);
                            setStudentQuery(e.target.value);
                          }
                        }}
                        placeholder="Type talib name or ITS to search…"
                        className={`w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-8 text-[13.5px] focus:border-emerald-600 focus:outline-none ${
                          selected.targetStudent ? "bg-amber-50/60 font-bold text-amber-950" : ""
                        }`}
                      />
                      {pickedStudent && !selected.targetStudent && (
                        <button
                          type="button"
                          onClick={() => {
                            setPickedStudent(null);
                            setStudentQuery("");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {!pickedStudent && !selected.targetStudent && studentQuery.trim() && studentOptions.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                        {studentOptions.slice(0, 8).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setPickedStudent(s)}
                            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] hover:bg-emerald-50"
                          >
                            <span className="font-bold text-slate-800">{s.name}</span>
                            <span className="font-mono text-[11.5px] text-slate-500">{s.its} · Gr {s.grade}{s.section}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="grade-marks" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Marks (0–{selected.maxMarks})
                      </label>
                      <input
                        id="grade-marks"
                        type="number"
                        min={0}
                        max={selected.maxMarks}
                        step="0.5"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                        placeholder="e.g. 85"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] font-bold focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="grade-feedback" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Feedback (optional)
                      </label>
                      <input
                        id="grade-feedback"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        maxLength={300}
                        placeholder="Clear analysis, good effort…"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13.5px] focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={gradeSaving || !pickedStudent}
                    className="w-full rounded-xl bg-emerald-700 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-800 disabled:opacity-40 shadow-sm"
                  >
                    {gradeSaving ? "Saving…" : pickedStudent ? `Save marks for ${pickedStudent.name.split(" ")[0]}` : "Pick a student first"}
                  </button>
                </form>

                <div>
                  <h4 className="mb-2 text-[12.5px] font-extrabold text-slate-700">Graded Talabat ({grades.length})</h4>
                  {gradesLoading ? (
                    <div className="flex items-center gap-2 text-[13px] text-slate-400">
                      <Loader2 size={15} className="animate-spin" /> Loading marks…
                    </div>
                  ) : grades.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-[12.5px] text-slate-500">
                      No marks awarded yet for this assignment.
                    </p>
                  ) : (
                    <div className="max-h-[380px] space-y-2 overflow-y-auto pr-0.5">
                      {grades.map((g) => {
                        const pct = Math.round((g.marks / selected.maxMarks) * 100);
                        return (
                          <div key={g.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-slate-900">{g.studentName}</p>
                              <p className="font-mono text-[11px] text-slate-500">{g.its} · Gr {g.grade}{g.section}</p>
                              {g.feedback && <p className="mt-0.5 line-clamp-1 text-[11.5px] italic text-slate-600">“{g.feedback}”</p>}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[14px] font-black text-emerald-800">{g.marks}<span className="text-[11px] text-slate-400">/{selected.maxMarks}</span></p>
                              <p className="text-[11px] font-extrabold text-slate-500">{pct}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "skilltests" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSkillFilter("")}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${!skillFilter ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-500"}`}
            >
              All skills (Age 15–20)
            </button>
            {Object.keys(SKILL_ICONS).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSkillFilter(s)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${skillFilter === s ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-500"}`}
              >
                {{ criticalThinking: "Critical Thinking", collaboration: "Collaboration", leadership: "Leadership", resilience: "Resilience" }[s]}
              </button>
            ))}
            <button type="button" onClick={fetchAttempts} className="ml-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" title="Refresh">
              <RefreshCw size={15} className={attemptsLoading ? "animate-spin" : ""} />
            </button>
          </div>
          {attemptsLoading ? (
            <div className="flex items-center gap-2 py-8 text-[13px] text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Loading test scores…
            </div>
          ) : attempts.length === 0 ? (
            <Card className="rounded-2xl border border-dashed">
              <CardContent className="p-8 text-center text-[13px] text-slate-500">
                No Q&A attempts yet. Scores appear here once talabat take skill tests.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-slate-900">{a.studentName}</p>
                    <p className="text-[11.5px] text-slate-500">
                      {{ criticalThinking: "Critical Thinking", collaboration: "Collaboration", leadership: "Leadership", resilience: "Resilience" }[a.skill] || a.skill} · {a.correctAnswers}/{a.totalQuestions} correct · {new Date(a.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <Badge className={`shrink-0 text-[13px] font-black ${a.score >= 60 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : a.score >= 40 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
                    {a.score}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create/Edit modal with Class / Specific Talib targeting ── */}
      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-emerald-800 bg-emerald-900 px-5 py-4 text-white rounded-t-3xl">
                <h3 className="text-[15px] font-extrabold">{editing ? "Edit Assignment" : "New Assignment"}</h3>
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-1.5 text-emerald-200 hover:bg-white/10 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveAssignment} className="space-y-4 p-5">
                {formError && (
                  <p className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-800">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {formError}
                  </p>
                )}

                {/* Assignment Target Audience selector */}
                <div>
                  <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                    Assignment Target Audience *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAudienceType("CLASS");
                        setTargetStudent(null);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-[13px] font-bold transition ${
                        audienceType === "CLASS"
                          ? "border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-700/20"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Building2 size={16} /> Whole Class
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudienceType("STUDENT")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-[13px] font-bold transition ${
                        audienceType === "STUDENT"
                          ? "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-600/20"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <UserCheck size={16} /> Specific Talib
                    </button>
                  </div>
                </div>

                {/* If Specific Talib, show student picker */}
                {audienceType === "STUDENT" && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
                    <label htmlFor="target-student-picker" className="block text-[11.5px] font-bold uppercase tracking-wider text-amber-900">
                      Select Specific Talib *
                    </label>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="target-student-picker"
                        value={targetStudent ? `${targetStudent.name} (${targetStudent.its} · Gr ${targetStudent.grade}${targetStudent.section})` : studentSearchInput}
                        onChange={(e) => {
                          setTargetStudent(null);
                          setStudentSearchInput(e.target.value);
                        }}
                        placeholder="Search talib by name or ITS…"
                        className="w-full rounded-xl border border-amber-300 bg-white py-2 pl-9 pr-8 text-[13.5px] font-semibold focus:border-amber-600 focus:outline-none"
                      />
                      {targetStudent && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetStudent(null);
                            setStudentSearchInput("");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {!targetStudent && studentSearchInput.trim() && studentOptions.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-md">
                        {studentOptions.slice(0, 6).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setTargetStudent(s);
                              setGrade(s.grade);
                              setSection(s.section);
                              setStudentSearchInput("");
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-amber-50"
                          >
                            <span className="font-bold text-slate-800">{s.name}</span>
                            <span className="font-mono text-[11.5px] text-slate-500">{s.its} · Gr {s.grade}{s.section}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {targetStudent && (
                      <p className="text-[12px] font-semibold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Selected: {targetStudent.name} (Will only reflect to this talib)
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="asg-title" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Title *</label>
                  <input id="asg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                    placeholder="e.g. Surah Al-Mulk Revision / Comparative Monograph"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[14px] font-semibold focus:border-emerald-600 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="asg-desc" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Instructions / Description</label>
                  <textarea id="asg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000}
                    placeholder="Provide detailed instructions or rubrics for the talabat…"
                    className="w-full resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-[13.5px] focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="asg-subject" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Subject</label>
                    <input id="asg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={60}
                      placeholder="e.g. Hifz, Lisan ud-Dawat"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[13.5px] focus:border-emerald-600 focus:outline-none" />
                  </div>
                  <div>
                    <label htmlFor="asg-skill" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Skill Domain</label>
                    <select id="asg-skill" value={skillCategory} onChange={(e) => setSkillCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13.5px] focus:border-emerald-600 focus:outline-none">
                      {SKILL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="asg-max" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Max Marks</label>
                    <input id="asg-max" type="number" min={1} max={1000} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[13.5px] font-bold focus:border-emerald-600 focus:outline-none" />
                  </div>
                  <div>
                    <label htmlFor="asg-due" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Due Date</label>
                    <input id="asg-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[13.5px] focus:border-emerald-600 focus:outline-none" />
                  </div>
                </div>

                {/* Class & Section (shown if whole class) */}
                {audienceType === "CLASS" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="asg-grade" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Grade / Darajah (blank = all)</label>
                      <input id="asg-grade" value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} placeholder="e.g. 5"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[13.5px] focus:border-emerald-600 focus:outline-none" />
                    </div>
                    <div>
                      <label htmlFor="asg-section" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Section (blank = all)</label>
                      <input id="asg-section" value={section} onChange={(e) => setSection(e.target.value)} maxLength={10} placeholder="e.g. A"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[13.5px] focus:border-emerald-600 focus:outline-none" />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50 shadow-sm">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {saving ? "Saving…" : editing ? "Save changes" : "Post assignment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
