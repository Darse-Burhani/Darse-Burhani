"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Palette,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Search,
  GraduationCap,
  Users,
  Sparkles,
  Trophy,
  Filter,
  CheckCircle2,
  Layers,
  Tag,
  BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import {
  getAllHobbies,
  addHobby,
  deleteHobby,
  getAssignmentStudents,
  type HobbyItem,
  type AssignmentStudentOption,
} from "@/lib/api";

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

const levelStyle: Record<string, string> = {
  Beginner: "bg-sky-50 text-sky-800 border-sky-300",
  Intermediate: "bg-indigo-50 text-indigo-800 border-indigo-300",
  Advanced: "bg-amber-50 text-amber-900 border-amber-300 font-bold",
};

const POPULAR_HOBBIES = [
  { name: "Arabic Calligraphy", category: "Arts & Calligraphy", level: "Intermediate" },
  { name: "Quran Qirat & Tajweed", category: "Deeni & Qirat", level: "Advanced" },
  { name: "Lisan al-Dawat Poetry", category: "Literature & Language", level: "Intermediate" },
  { name: "Cricket & Athletics", category: "Sports & Fitness", level: "Intermediate" },
  { name: "Football", category: "Sports & Fitness", level: "Beginner" },
  { name: "Computer Coding & Tech", category: "Technology", level: "Intermediate" },
  { name: "Public Speaking & Bayaan", category: "Oratory & Speech", level: "Advanced" },
  { name: "Electronics & Robotics", category: "Technology", level: "Beginner" },
  { name: "Islamic Illumination / Tazhib", category: "Arts & Calligraphy", level: "Beginner" },
  { name: "Table Tennis", category: "Sports & Fitness", level: "Intermediate" },
];

interface StudentGroup {
  studentId: string;
  studentName: string;
  its: string;
  avatarUrl: string | null;
  grade: string;
  section: string;
  hobbies: HobbyItem[];
}

export default function AdminHobbiesPage() {
  const [hobbies, setHobbies] = useState<HobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"individual" | "specific">("individual");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");

  // Form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<AssignmentStudentOption[]>([]);
  const [pickedStudent, setPickedStudent] = useState<AssignmentStudentOption | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<string>("Beginner");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      setHobbies(await getAllHobbies());
    } catch (e: any) {
      setError(e.message || "Failed to load hobbies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const t = setTimeout(async () => {
      try {
        setStudentOptions(await getAssignmentStudents(studentQuery.trim() || undefined));
      } catch {
        setStudentOptions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [studentQuery, formOpen]);

  // Unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    hobbies.forEach((h) => {
      if (h.category?.trim()) set.add(h.category.trim());
    });
    return Array.from(set).sort();
  }, [hobbies]);

  // Unique grades for filter
  const grades = useMemo(() => {
    const set = new Set<string>();
    hobbies.forEach((h) => {
      const g = (h.grade || "").trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [hobbies]);

  // Filtered raw list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hobbies.filter((h) => {
      if (gradeFilter !== "ALL" && h.grade !== gradeFilter) return false;
      if (categoryFilter !== "ALL" && (h.category || "") !== categoryFilter) return false;
      if (levelFilter !== "ALL" && (h.level || "Beginner") !== levelFilter) return false;

      if (!q) return true;
      const haystack = `${h.name} ${h.category || ""} ${h.studentName || ""} ${h.its || ""} ${h.grade || ""}${h.section || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [hobbies, search, gradeFilter, categoryFilter, levelFilter]);

  // Grouped by student for individual view
  const studentGroups: StudentGroup[] = useMemo(() => {
    const map = new Map<string, StudentGroup>();
    for (const h of filtered) {
      const sId = h.studentId || h.studentName || "unknown";
      if (!map.has(sId)) {
        map.set(sId, {
          studentId: sId,
          studentName: h.studentName || "Unknown Talib",
          its: h.its || "",
          avatarUrl: h.avatarUrl || null,
          grade: h.grade || "",
          section: h.section || "",
          hobbies: [],
        });
      }
      map.get(sId)!.hobbies.push(h);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.grade !== b.grade) return (a.grade || "").localeCompare(b.grade || "");
      return a.studentName.localeCompare(b.studentName);
    });
  }, [filtered]);

  const studentCount = useMemo(() => new Set(hobbies.map((h) => h.studentId)).size, [hobbies]);
  const advancedCount = useMemo(() => hobbies.filter((h) => h.level === "Advanced").length, [hobbies]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedStudent) {
      setFormError("Search and select a talabat first.");
      return;
    }
    if (!name.trim()) {
      setFormError("Hobby or skill name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await addHobby({
        studentId: pickedStudent.id,
        name: name.trim(),
        category: category.trim() || undefined,
        level,
      });
      setFormOpen(false);
      setPickedStudent(null);
      setName("");
      setCategory("");
      setLevel("Beginner");
      setStudentQuery("");
      fetchAll();
    } catch (e: any) {
      setFormError(e.message || "Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, hobbyName: string) => {
    if (!confirm(`Remove "${hobbyName}" from this talabat's portfolio?`)) return;
    setDeletingId(id);
    try {
      await deleteHobby(id);
      setHobbies((prev) => prev.filter((h) => h.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to remove entry");
    } finally {
      setDeletingId(null);
    }
  };

  const openAddForStudent = (student: StudentGroup) => {
    setPickedStudent({
      id: student.studentId,
      name: student.studentName,
      its: student.its || "",
      grade: student.grade,
      section: student.section,
    });
    setName("");
    setCategory("");
    setLevel("Beginner");
    setFormError(null);
    setFormOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100 text-pink-700 shadow-xs">
              <Palette size={22} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black text-slate-900 tracking-tight">
                Talabat Hobbies &amp; Skills Portfolio
              </h1>
              <p className="text-[12.5px] text-slate-500">
                Detailed extracurricular talent profiles, individual skill registries, and specific mastery levels.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("individual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "individual"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users size={14} /> Individual Talabat ({studentGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("specific")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "specific"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers size={14} /> Specific Entries ({filtered.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setPickedStudent(null);
              setStudentQuery("");
              setName("");
              setCategory("");
              setLevel("Beginner");
              setFormError(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Hobby / Skill
          </button>
        </div>
      </div>

      {/* Stats KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Total Recorded Entries</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-black text-slate-900">{hobbies.length}</p>
            <span className="text-[11px] font-semibold text-slate-500">Skills &amp; Hobbies</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Talabat with Portfolios</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-black text-emerald-700">{studentCount}</p>
            <span className="text-[11px] font-semibold text-slate-500">Students</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Advanced Mastery</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-black text-amber-700">{advancedCount}</p>
            <span className="text-[11px] font-semibold text-amber-800">Advanced</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Active Talent Categories</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-black text-pink-700">{categories.length}</p>
            <span className="text-[11px] font-semibold text-slate-500">Domains</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search talabat name, ITS, specific skill (e.g. Calligraphy, Qirat, Coding)…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-10 text-[13px] focus:border-pink-500 focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={fetchAll}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Grade filter */}
          <div className="flex items-center gap-2">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-pink-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Grades</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  Darajah {g}
                </option>
              ))}
            </select>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-pink-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Level filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-pink-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Levels</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(gradeFilter !== "ALL" || categoryFilter !== "ALL" || levelFilter !== "ALL" || search) && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs text-slate-500">
            <span>Filters active:</span>
            {gradeFilter !== "ALL" && (
              <Badge variant="outline" className="text-[10.5px]">
                Darajah {gradeFilter}
              </Badge>
            )}
            {categoryFilter !== "ALL" && (
              <Badge variant="outline" className="text-[10.5px]">
                {categoryFilter}
              </Badge>
            )}
            {levelFilter !== "ALL" && (
              <Badge variant="outline" className="text-[10.5px]">
                {levelFilter}
              </Badge>
            )}
            <button
              type="button"
              onClick={() => {
                setGradeFilter("ALL");
                setCategoryFilter("ALL");
                setLevelFilter("ALL");
                setSearch("");
              }}
              className="text-pink-600 hover:underline font-bold ml-auto cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-white border border-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2">
          <CardContent className="p-12 text-center">
            <GraduationCap size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-base font-bold text-slate-800">No hobbies or skills found</p>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {search || gradeFilter !== "ALL" || categoryFilter !== "ALL"
                ? "Try adjusting your search criteria or resetting filters."
                : "Talabat can record their skills from their portal, or you can add one directly using the button above."}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "individual" ? (
        /* ── VIEW 1: INDIVIDUAL TALABAT PORTFOLIOS ── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studentGroups.map((group) => {
            const advancedInGroup = group.hobbies.filter((h) => h.level === "Advanced").length;
            return (
              <div
                key={group.studentId}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md transition-all hover:border-pink-300"
              >
                {/* Student Identity Header */}
                <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
                  <div className="relative shrink-0">
                    <ProfilePhoto
                      src={group.avatarUrl}
                      alt={group.studentName}
                      className="h-11 w-11 rounded-full ring-2 ring-pink-100 object-cover"
                      previewable={true}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[14px] font-black text-slate-900 group-hover:text-pink-700 transition-colors">
                      {group.studentName}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {group.its && (
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          ITS {group.its}
                        </span>
                      )}
                      {(group.grade || group.section) && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          Darajah {group.grade}{group.section}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-50 text-pink-700 border border-pink-200">
                      {group.hobbies.length} {group.hobbies.length === 1 ? "Skill" : "Skills"}
                    </span>
                  </div>
                </div>

                {/* Specific Hobbies List for this Individual */}
                <div className="mt-3 flex-1 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Specific Talents &amp; Hobbies
                  </p>
                  <div className="space-y-1.5">
                    {group.hobbies.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 hover:bg-pink-50/50 p-2 border border-slate-100 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800">{h.name}</p>
                          {h.category && (
                            <p className="text-[10.5px] text-slate-500 flex items-center gap-1 truncate">
                              <Tag size={10} className="text-slate-400 shrink-0" />
                              {h.category}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {h.level && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9.5px] border ${
                                levelStyle[h.level] || "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {h.level}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(h.id, h.name)}
                            disabled={deletingId === h.id}
                            title="Remove this hobby"
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            {deletingId === h.id ? (
                              <Loader2 size={12} className="animate-spin text-rose-600" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer: Quick Add Action */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {advancedInGroup > 0 ? `🌟 ${advancedInGroup} Advanced Mastery` : "Active Contributor"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openAddForStudent(group)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 hover:text-pink-900 hover:underline cursor-pointer"
                  >
                    <Plus size={12} /> Add for Talib
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── VIEW 2: SPECIFIC HOBBIES MATRIX / FLAT CATALOG ── */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Talabat / Student</th>
                  <th className="py-3 px-4">Darajah</th>
                  <th className="py-3 px-4">Specific Hobby / Skill</th>
                  <th className="py-3 px-4">Category Domain</th>
                  <th className="py-3 px-4">Proficiency Level</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <ProfilePhoto
                          src={h.avatarUrl}
                          alt={h.studentName || "Talib"}
                          className="h-8 w-8 rounded-full ring-1 ring-slate-200 object-cover"
                          previewable={true}
                        />
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{h.studentName || "Unknown"}</p>
                          {h.its && <p className="font-mono text-[10px] text-slate-400">ITS {h.its}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {h.grade ? (
                        <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px]">
                          Darajah {h.grade}{h.section}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {h.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {h.category ? (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10.5px]">
                          <Tag size={10} className="text-slate-400" />
                          {h.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">General</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {h.level && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] border ${levelStyle[h.level] || ""}`}>
                          {h.level}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id, h.name)}
                        disabled={deletingId === h.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove entry"
                      >
                        {deletingId === h.id ? (
                          <Loader2 size={13} className="animate-spin text-rose-600" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Hobby Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 text-pink-700">
                  <Palette size={18} />
                </div>
                <h3 className="text-base font-black text-slate-900">Add Hobby or Specific Skill</h3>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
                  {formError}
                </div>
              )}

              {/* Student Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Talabat (Student) <span className="text-rose-500">*</span>
                </label>
                {pickedStudent ? (
                  <div className="flex items-center justify-between rounded-xl bg-pink-50 border border-pink-200 p-2.5">
                    <div>
                      <p className="text-xs font-black text-pink-900">{pickedStudent.name}</p>
                      <p className="text-[10px] text-pink-700">
                        {pickedStudent.grade ? `Darajah ${pickedStudent.grade}${pickedStudent.section || ""}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickedStudent(null)}
                      className="text-xs text-pink-700 hover:underline font-bold"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Type name or ITS to search student…"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-pink-500 focus:bg-white focus:outline-none"
                    />
                    {studentOptions.length > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
                        {studentOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setPickedStudent(opt);
                              setStudentQuery("");
                            }}
                            className="w-full p-2 text-left hover:bg-pink-50 flex items-center justify-between text-xs cursor-pointer"
                          >
                            <span className="font-bold text-slate-800">{opt.name}</span>
                            <span className="text-[10px] text-slate-400">
                              {opt.grade ? `Darajah ${opt.grade}${opt.section || ""}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Quick Suggestions</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {POPULAR_HOBBIES.map((pop) => (
                    <button
                      key={pop.name}
                      type="button"
                      onClick={() => {
                        setName(pop.name);
                        setCategory(pop.category);
                        setLevel(pop.level);
                      }}
                      className="rounded-lg bg-slate-100 hover:bg-pink-100 hover:text-pink-900 px-2 py-1 text-[10.5px] font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      {pop.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Skill Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Skill or Hobby Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arabic Calligraphy (Khatt Ruq'ah), Coding in Python, Qirat"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>

              {/* Category & Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category Domain</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Arts, Sports, Tech"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Proficiency Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold focus:border-pink-500 focus:outline-none cursor-pointer"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Save to Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
