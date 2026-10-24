"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  Plus,
  Loader2,
  Search,
  X,
  BookOpen,
  Calendar,
  Users,
  Award,
  CheckCircle2,
  Clock,
  ChevronRight,
  Edit3,
  Trash2,
  Star,
  FileText,
  Filter,
  BarChart3,
  User,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  skillCategory: string | null;
  maxMarks: number;
  dueDate: string | null;
  grade: string | null;
  section: string | null;
  targetStudentId: string | null;
  targetStudent: { id: string; name: string; its: string; grade: string; section: string } | null;
  createdAt: string;
  gradedCount: number;
}

interface Student {
  id: string;
  name: string;
  its: string;
  grade: string;
  section: string;
}

interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  its: string;
  grade: string;
  section: string;
  marks: number;
  feedback: string | null;
  updatedAt: string;
}

const SKILL_LABELS: Record<string, string> = {
  criticalThinking: "Critical Thinking",
  collaboration: "Collaboration",
  leadership: "Leadership",
  resilience: "Resilience",
};

const SKILL_COLORS: Record<string, string> = {
  criticalThinking: "bg-purple-100 text-purple-700",
  collaboration: "bg-blue-100 text-blue-700",
  leadership: "bg-amber-100 text-amber-700",
  resilience: "bg-emerald-100 text-emerald-700",
};

const GRADE_SECTIONS = [
  { label: "Grade 1 – Section A", grade: "1", section: "A" },
  { label: "Grade 1 – Section B", grade: "1", section: "B" },
  { label: "Grade 2 – Section A", grade: "2", section: "A" },
  { label: "Grade 2 – Section B", grade: "2", section: "B" },
  { label: "Grade 3 – Section A", grade: "3", section: "A" },
  { label: "Grade 3 – Section B", grade: "3", section: "B" },
  { label: "Grade 4 – Section A", grade: "4", section: "A" },
  { label: "Grade 4 – Section B", grade: "4", section: "B" },
];

type View = "list" | "create" | "grades" | "monthly-stack";

export default function TeacherAssignmentsPage() {
  const [view, setView] = useState<View>("list");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<{ classes: Array<{ id: string; name: string; grade: string; section: string; studentCount: number }>; subjects: string[] }>({ classes: [], subjects: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  // Grade/marks modal state
  const [gradingAssignment, setGradingAssignment] = useState<Assignment | null>(null);
  const [assignmentGrades, setAssignmentGrades] = useState<Grade[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [gradeStudentId, setGradeStudentId] = useState("");
  const [gradeMarks, setGradeMarks] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  // Create form state
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject: "",
    skillCategory: "",
    maxMarks: "100",
    dueDate: "",
    grade: "",
    section: "",
    targetStudentId: "",
    scope: "class" as "class" | "student",
  });
  const [studentSearch, setStudentSearch] = useState("");

  const fetchAssignments = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/assignments");
      const json = await res.json();
      if (json.success) setAssignments(json.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load assignments." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStudents = async (q = "") => {
    try {
      const res = await fetch(`/api/assignments/students${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const json = await res.json();
      if (json.success) setStudents(json.data);
    } catch {
      // silent
    }
  };

  const fetchGrades = async (assignmentId: string) => {
    setLoadingGrades(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/grades`);
      const json = await res.json();
      if (json.success) setAssignmentGrades(json.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load grades." });
    } finally {
      setLoadingGrades(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const res = await fetch("/api/assignments/meta");
      const json = await res.json();
      if (json.success && json.data) {
        setMeta(json.data);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchStudents();
    fetchMeta();
  }, []);

  useEffect(() => {
    if (studentSearch.length >= 2) {
      const t = setTimeout(() => fetchStudents(studentSearch), 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentSearch]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchQ =
        !searchQ ||
        a.title.toLowerCase().includes(searchQ.toLowerCase()) ||
        (a.subject || "").toLowerCase().includes(searchQ.toLowerCase());
      const matchSubject = !filterSubject || (a.subject || "") === filterSubject;
      return matchQ && matchSubject;
    });
  }, [assignments, searchQ, filterSubject]);

  const subjects = useMemo(() => {
    const s = new Set(assignments.map((a) => a.subject).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [assignments]);

  // Group assignments into Monthly Stacks
  const monthlyStacks = useMemo(() => {
    const map = new Map<string, { monthKey: string; monthLabel: string; assignments: Assignment[] }>();

    filteredAssignments.forEach((a) => {
      const dateToUse = a.dueDate ? new Date(a.dueDate) : new Date(a.createdAt);
      const validDate = isNaN(dateToUse.getTime()) ? new Date() : dateToUse;
      const monthKey = `${validDate.getFullYear()}-${String(validDate.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = validDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      if (!map.has(monthKey)) {
        map.set(monthKey, { monthKey, monthLabel, assignments: [] });
      }
      map.get(monthKey)!.assignments.push(a);
    });

    return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredAssignments]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Assignment title is required." });
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject: form.subject.trim() || null,
        skillCategory: form.skillCategory || null,
        maxMarks: parseInt(form.maxMarks) || 100,
        dueDate: form.dueDate || null,
      };
      if (form.scope === "student" && form.targetStudentId) {
        payload.targetStudentId = form.targetStudentId;
      } else {
        payload.grade = form.grade || null;
        payload.section = form.section || null;
      }
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create");
      toast({ title: "Assignment Created", description: `"${form.title}" has been scheduled.` });
      setForm({ title: "", description: "", subject: "", skillCategory: "", maxMarks: "100", dueDate: "", grade: "", section: "", targetStudentId: "", scope: "class" });
      setView("list");
      fetchAssignments();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete assignment "${title}"?`)) return;
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete");
      toast({ title: "Deleted", description: `"${title}" removed.` });
      fetchAssignments();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const openGrades = (a: Assignment) => {
    setGradingAssignment(a);
    setAssignmentGrades([]);
    setGradeStudentId("");
    setGradeMarks("");
    setGradeFeedback("");
    fetchGrades(a.id);
    setView("grades");
  };

  const handleSaveGrade = async () => {
    if (!gradingAssignment || !gradeStudentId) return;
    setSavingGrade(true);
    try {
      const res = await fetch(`/api/assignments/${gradingAssignment.id}/grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: gradeStudentId, marks: parseFloat(gradeMarks), feedback: gradeFeedback }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save grade");
      toast({ title: "Marks Saved" });
      setGradeStudentId("");
      setGradeMarks("");
      setGradeFeedback("");
      fetchGrades(gradingAssignment.id);
      fetchAssignments();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSavingGrade(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const isDue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const gradeMap = useMemo(() => {
    const m = new Map<string, Grade>();
    for (const g of assignmentGrades) m.set(g.studentId, g);
    return m;
  }, [assignmentGrades]);

  // Students relevant to this assignment
  const relevantStudents = useMemo(() => {
    if (!gradingAssignment) return students;
    if (gradingAssignment.targetStudentId) {
      return students.filter((s) => s.id === gradingAssignment.targetStudentId);
    }
    return students.filter((s) => {
      const gm = !gradingAssignment.grade || s.grade.toLowerCase() === (gradingAssignment.grade || "").toLowerCase();
      const sm = !gradingAssignment.section || s.section.toLowerCase() === (gradingAssignment.section || "").toLowerCase();
      return gm && sm;
    });
  }, [gradingAssignment, students]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assignments</h1>
              <p className="text-sm text-slate-500">Create, schedule, and grade tasks for your talabat</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher: List vs Monthly Stack */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  view === "list" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                List View
              </button>
              <button
                type="button"
                onClick={() => setView("monthly-stack")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  view === "monthly-stack" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Monthly Stack ({monthlyStacks.length})
              </button>
            </div>

            {view !== "list" && view !== "monthly-stack" && (
              <Button variant="outline" size="sm" onClick={() => setView("list")} className="gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setView("create")}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
            >
              <Plus className="h-4 w-4" /> New Assignment
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fetchAssignments(true)} className="gap-1.5" disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* — LIST VIEW — */}
        <AnimatePresence mode="wait">
          {view === "list" && (
            <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: assignments.length, icon: ClipboardList, color: "from-slate-400 to-slate-600" },
                  { label: "Graded", value: assignments.filter((a) => a.gradedCount > 0).length, icon: CheckCircle2, color: "from-emerald-400 to-emerald-600" },
                  { label: "Scheduled", value: assignments.filter((a) => a.dueDate && !isDue(a.dueDate)).length, icon: Calendar, color: "from-blue-400 to-blue-600" },
                  { label: "Overdue", value: assignments.filter((a) => isDue(a.dueDate)).length, icon: Clock, color: "from-red-400 to-rose-600" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-md`}>
                      <s.icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    placeholder="Search by title or subject…"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                  {searchQ && (
                    <button onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {subjects.length > 0 && (
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      className="rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none"
                      value={filterSubject}
                      onChange={(e) => setFilterSubject(e.target.value)}
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* List */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No assignments yet</p>
                  <p className="text-sm mt-1">Create your first assignment using the button above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAssignments.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900 text-sm truncate">{a.title}</h3>
                          {a.skillCategory && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SKILL_COLORS[a.skillCategory] || "bg-slate-100 text-slate-600"}`}>
                              {SKILL_LABELS[a.skillCategory] || a.skillCategory}
                            </span>
                          )}
                          {isDue(a.dueDate) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Overdue</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {a.subject && (
                            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{a.subject}</span>
                          )}
                          {a.dueDate && (
                            <span className={`flex items-center gap-1 ${isDue(a.dueDate) ? "text-red-500 font-medium" : ""}`}>
                              <Calendar className="h-3 w-3" />Due {formatDate(a.dueDate)}
                            </span>
                          )}
                          {(a.grade || a.section) && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {a.grade && `Grade ${a.grade}`}{a.section && ` – ${a.section}`}
                            </span>
                          )}
                          {a.targetStudent && (
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{a.targetStudent.name}</span>
                          )}
                          <span className="flex items-center gap-1"><Award className="h-3 w-3" />Max {a.maxMarks} marks</span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            <span className={a.gradedCount > 0 ? "text-emerald-600 font-medium" : ""}>{a.gradedCount} graded</span>
                          </span>
                        </div>
                        {a.description && (
                          <p className="text-xs text-slate-400 line-clamp-1">{a.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openGrades(a)}
                          className="gap-1.5 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Star className="h-3.5 w-3.5" /> Marks
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(a.id, a.title)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* — MONTHLY STACK VIEW (MONTH-BY-MONTH DECKS WITH POINT MATRIX INTEGRATION) — */}
          {view === "monthly-stack" && (
            <motion.div key="monthly-stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              {/* Notice Banner */}
              <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-50 via-indigo-50/50 to-purple-50 border border-amber-200/80 shadow-xs flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-700">
                  <span className="font-extrabold text-slate-900">Monthly Stack Assignment Marks &amp; Point Matrix Integration: </span>
                  Assignments are stacked chronologically by academic month. As soon as you enter and save marks for enrolled talabat, merit points are automatically computed and awarded directly to the official <strong className="text-indigo-900 font-bold">Point Matrix</strong>.
                </div>
              </div>

              {monthlyStacks.length === 0 ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 p-8">
                  <Layers className="h-10 w-10 mx-auto mb-3 opacity-30 text-indigo-400" />
                  <p className="font-semibold text-slate-700">No Monthly Stacks Available</p>
                  <p className="text-xs text-slate-400 mt-1">Create an assignment with a scheduled due date to start stacking tasks by month.</p>
                  <Button
                    size="sm"
                    onClick={() => setView("create")}
                    className="mt-4 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Plus className="h-4 w-4" /> Create First Assignment
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {monthlyStacks.map((stack) => {
                    const totalInMonth = stack.assignments.length;
                    const gradedInMonth = stack.assignments.filter((a) => a.gradedCount > 0).length;
                    const completionPct = totalInMonth > 0 ? Math.round((gradedInMonth / totalInMonth) * 100) : 0;

                    return (
                      <div
                        key={stack.monthKey}
                        className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                      >
                        {/* Month Deck Header */}
                        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 font-black shadow-md">
                              <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-white">{stack.monthLabel}</h3>
                                <span className="text-[10px] uppercase tracking-wider font-mono bg-white/10 px-2 py-0.5 rounded-full text-amber-300">
                                  {totalInMonth} Task{totalInMonth === 1 ? "" : "s"}
                                </span>
                              </div>
                              <p className="text-xs text-indigo-200/80">Monthly Academic Homework &amp; Sabaq Stack</p>
                            </div>
                          </div>

                          {/* Progress Metrics */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs font-bold text-white">{gradedInMonth} of {totalInMonth} Graded</div>
                              <div className="text-[10px] text-emerald-300 font-mono">{completionPct}% Evaluated</div>
                            </div>
                            <div className="w-20 bg-white/20 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-400 h-full rounded-full transition-all"
                                style={{ width: `${completionPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Assignments Deck in this Month */}
                        <div className="p-4 sm:p-5 divide-y divide-slate-100 space-y-3">
                          {stack.assignments.map((a) => (
                            <div
                              key={a.id}
                              className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-bold text-slate-900">{a.title}</h4>
                                  {a.subject && (
                                    <span className="text-[10.5px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {a.subject}
                                    </span>
                                  )}
                                  {a.grade && (
                                    <span className="text-[10.5px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700">
                                      Class {a.grade}{a.section || ""}
                                    </span>
                                  )}
                                  {isDue(a.dueDate) && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-black">
                                      Due Passed
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                  <span>Due: {formatDate(a.dueDate) || "Flexible"}</span>
                                  <span>•</span>
                                  <span>Max Marks: {a.maxMarks}</span>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-semibold">{a.gradedCount} graded</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => openGrades(a)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 shadow-sm rounded-xl cursor-pointer"
                                >
                                  <Star className="h-3.5 w-3.5 text-amber-300" />
                                  Enter Marks &amp; Award Points
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* — CREATE VIEW — */}
          {view === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">New Assignment</h2>
                    <p className="text-sm text-slate-500">Schedule a task for your class or individual talib</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Assignment Title <span className="text-red-500">*</span></label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="e.g. Chapter 3 Comprehension Exercise"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      rows={3}
                      placeholder="Instructions, requirements, or notes…"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  {/* Subject + Skill */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-medium text-slate-700">Subject</label>
                        {meta.subjects.length > 0 && (
                          <span className="text-[11px] font-semibold text-indigo-600">Assigned Subjects</span>
                        )}
                      </div>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="e.g. Arabic, Quran, Math"
                        value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                      />
                      {meta.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {meta.subjects.map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, subject: sub }))}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                form.subject === sub
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-indigo-50/70 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100"
                              }`}
                            >
                              + {sub}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Skill Category</label>
                      <select
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        value={form.skillCategory}
                        onChange={(e) => setForm((f) => ({ ...f, skillCategory: e.target.value }))}
                      >
                        <option value="">None</option>
                        {Object.entries(SKILL_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Max marks + Due date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Max Marks</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={form.maxMarks}
                        onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Due Date (Schedule deadline)</label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={form.dueDate}
                        onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Scope toggle */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Assign To</label>
                    <div className="flex rounded-xl overflow-hidden border border-slate-200">
                      {[
                        { key: "class", label: "Entire Class / Grade", icon: Users },
                        { key: "student", label: "Specific Talib", icon: User },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setForm((f) => ({ ...f, scope: opt.key as any, targetStudentId: "", grade: "", section: "" }))}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${form.scope === opt.key ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                        >
                          <opt.icon className="h-4 w-4" />{opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Class/grade fields */}
                  {form.scope === "class" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-sm font-medium text-slate-700">Target Class</label>
                          {meta.classes.length > 0 && (
                            <span className="text-[11px] font-semibold text-emerald-600">Assigned Classes</span>
                          )}
                        </div>
                        <select
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          value={`${form.grade}-${form.section}`}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "-") return setForm((f) => ({ ...f, grade: "", section: "" }));
                            const [g, s] = val.split("-");
                            setForm((f) => ({ ...f, grade: g, section: s }));
                          }}
                        >
                          <option value="-">All Classes (broadcast to all)</option>
                          {meta.classes.length > 0 && (
                            <optgroup label="⭐ My Assigned Classes">
                              {meta.classes.map((cls) => (
                                <option key={`assigned-${cls.id}`} value={`${cls.grade}-${cls.section}`}>
                                  Class {cls.name} (Grade {cls.grade}{cls.section} • {cls.studentCount} Talabat)
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="All Darajah Classes">
                            {GRADE_SECTIONS.map((gs) => (
                              <option key={`${gs.grade}-${gs.section}`} value={`${gs.grade}-${gs.section}`}>{gs.label}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Specific student search */}
                  {form.scope === "student" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Search Talib</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="Name, ITS or grade…"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                        />
                      </div>
                      {students.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm">
                          {students.slice(0, 20).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => { setForm((f) => ({ ...f, targetStudentId: s.id })); setStudentSearch(s.name); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-indigo-50 transition-colors ${form.targetStudentId === s.id ? "bg-indigo-50" : ""}`}
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{s.name}</p>
                                <p className="text-xs text-slate-400">ITS: {s.its} · Grade {s.grade}{s.section}</p>
                              </div>
                              {form.targetStudentId === s.id && <CheckCircle2 className="ml-auto h-4 w-4 text-indigo-500" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setView("list")}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? "Creating…" : "Create Assignment"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* — GRADES VIEW — */}
          {view === "grades" && gradingAssignment && (
            <motion.div key="grades" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{gradingAssignment.title}</h2>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      {gradingAssignment.subject && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{gradingAssignment.subject}</span>}
                      <span className="flex items-center gap-1"><Award className="h-3 w-3" />Max {gradingAssignment.maxMarks} marks</span>
                      {gradingAssignment.dueDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Due {formatDate(gradingAssignment.dueDate)}</span>}
                      <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{gradingAssignment.gradedCount} graded so far</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grade entry */}
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Enter Marks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Select Talib</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      value={gradeStudentId}
                      onChange={(e) => setGradeStudentId(e.target.value)}
                    >
                      <option value="">Choose talib…</option>
                      {relevantStudents.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} (ITS: {s.its})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Marks (0–{gradingAssignment.maxMarks})</label>
                    <input
                      type="number"
                      min="0"
                      max={gradingAssignment.maxMarks}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder={`0–${gradingAssignment.maxMarks}`}
                      value={gradeMarks}
                      onChange={(e) => setGradeMarks(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Feedback (optional)</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Brief note…"
                      value={gradeFeedback}
                      onChange={(e) => setGradeFeedback(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSaveGrade}
                  disabled={savingGrade || !gradeStudentId || !gradeMarks}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  size="sm"
                >
                  {savingGrade ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save Marks
                </Button>
              </div>

              {/* Grades table */}
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-semibold text-slate-800">Graded Students ({assignmentGrades.length})</h3>
                </div>
                {loadingGrades ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                  </div>
                ) : assignmentGrades.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No marks entered yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {assignmentGrades.map((g) => {
                      const pct = Math.round((g.marks / gradingAssignment.maxMarks) * 100);
                      const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-500";
                      return (
                        <div key={g.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                              {g.studentName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{g.studentName}</p>
                              <p className="text-xs text-slate-400">ITS: {g.its} · {g.grade}{g.section}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {g.feedback && <p className="text-xs text-slate-400 max-w-32 truncate">{g.feedback}</p>}
                            <div className="text-right">
                              <p className={`text-sm font-bold ${color}`}>{g.marks} / {gradingAssignment.maxMarks}</p>
                              <p className={`text-xs ${color}`}>{pct}%</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
