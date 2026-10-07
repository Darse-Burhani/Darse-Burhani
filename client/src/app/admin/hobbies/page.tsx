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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Beginner: "bg-sky-50 text-sky-800 border-sky-200",
  Intermediate: "bg-violet-50 text-violet-800 border-violet-200",
  Advanced: "bg-amber-50 text-amber-800 border-amber-200",
};

export default function AdminHobbiesPage() {
  const [hobbies, setHobbies] = useState<HobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hobbies;
    return hobbies.filter((h) =>
      `${h.name} ${h.category || ""} ${h.studentName || ""} ${h.level || ""}`.toLowerCase().includes(q)
    );
  }, [hobbies, search]);

  const studentCount = useMemo(() => new Set(hobbies.map((h) => h.studentId)).size, [hobbies]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedStudent) {
      setFormError("Search and pick a talabat first.");
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
      setFormError(e.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this hobby / skill?")) return;
    setDeletingId(id);
    try {
      await deleteHobby(id);
      setHobbies((prev) => prev.filter((h) => h.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to remove");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-slate-900">
            <Palette size={22} className="text-pink-600" /> Hobbies & Skills
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            View every talabat hobby & skill — add or remove entries for any student.
          </p>
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
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-pink-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-pink-700 sm:self-auto"
        >
          <Plus size={15} /> Add for a talabat
        </button>
      </div>

      {/* Stats + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2.5">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entries</p>
            <p className="text-lg font-extrabold text-slate-900">{hobbies.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Talabat</p>
            <p className="text-lg font-extrabold text-slate-900">{studentCount}</p>
          </div>
        </div>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hobby, category, student…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-[13.5px] focus:border-pink-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={fetchAll}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white border border-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center">
            <GraduationCap size={28} className="mx-auto text-slate-300" />
            <p className="mt-2 text-[13.5px] font-bold text-slate-700">No hobbies found</p>
            <p className="mt-1 text-[12px] text-slate-500">
              {search ? "Try a different search." : "Talabat can add their own from Hobbies & Skills in their portal."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => (
            <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-extrabold text-slate-900">{h.name}</p>
                  <p className="mt-0.5 truncate text-[12px] font-semibold text-emerald-800">
                    {h.studentName}
                    {(h.grade || h.section) && (
                      <span className="font-normal text-slate-400"> · Gr {h.grade}{h.section}</span>
                    )}
                  </p>
                  {h.category && <p className="text-[11.5px] text-slate-500">{h.category}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  disabled={deletingId === h.id}
                  title="Remove"
                  className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  {deletingId === h.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
              {h.level && (
                <Badge variant="outline" className={`mt-2 text-[11px] ${levelStyle[h.level] || ""}`}>
                  {h.level}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-3xl border-b border-slate-100 bg-pink-700 px-5 py-4 text-white">
              <div>
                <h3 className="text-[15px] font-extrabold">Add hobby / skill</h3>
                <p className="text-[12px] text-pink-200">For any talabat student</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-1.5 text-pink-200 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3.5 p-5">
              {formError && (
                <p className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-800">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> {formError}
                </p>
              )}
              <div className="relative">
                <label htmlFor="hb-student" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Talabat (name / ITS) *
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="hb-student"
                    value={pickedStudent ? `${pickedStudent.name} · ${pickedStudent.its}` : studentQuery}
                    onChange={(e) => {
                      setPickedStudent(null);
                      setStudentQuery(e.target.value);
                    }}
                    placeholder="Type to search…"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-8 text-[13.5px] focus:border-pink-600 focus:outline-none"
                  />
                  {pickedStudent && (
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
                {!pickedStudent && studentQuery.trim() && studentOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {studentOptions.slice(0, 8).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPickedStudent(s)}
                        className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] hover:bg-pink-50"
                      >
                        <span className="font-bold text-slate-800">{s.name}</span>
                        <span className="font-mono text-[11.5px] text-slate-500">{s.its} · Gr {s.grade}{s.section}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="hb-name" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Hobby / skill *
                </label>
                <input
                  id="hb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Swimming, Naat recitation"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[14px] focus:border-pink-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="hb-cat" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Category
                </label>
                <input
                  id="hb-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Sports, Arts, Deeni, Tech"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[14px] focus:border-pink-600 focus:outline-none"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Level</span>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`rounded-xl border px-2 py-2 text-[12.5px] font-bold transition ${
                        level === l ? "border-pink-600 bg-pink-50 text-pink-900 ring-2 ring-pink-600/20" : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-pink-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-pink-700 disabled:opacity-50">
                  {saving ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
