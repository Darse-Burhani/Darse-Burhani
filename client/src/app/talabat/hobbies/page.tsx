"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Palette,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/student/PageHeader";
import { getMyHobbies, addHobby, deleteHobby, type HobbyItem } from "@/lib/api";

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

const levelStyle: Record<string, string> = {
  Beginner: "bg-sky-50 text-sky-800 border-sky-200",
  Intermediate: "bg-violet-50 text-violet-800 border-violet-200",
  Advanced: "bg-amber-50 text-amber-800 border-amber-200",
};

export default function TalabatHobbiesPage() {
  const [hobbies, setHobbies] = useState<HobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<string>("Beginner");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setHobbies(await getMyHobbies());
    } catch (e: any) {
      setError(e.message || "Failed to load hobbies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Give your hobby or skill a name.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await addHobby({ name: name.trim(), category: category.trim() || undefined, level });
      setName("");
      setCategory("");
      setLevel("Beginner");
      setFormOpen(false);
      fetchData(true);
    } catch (e: any) {
      setFormError(e.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Palette}
        title="Hobbies & Skills"
        subtitle="Showcase what you love — sports, arts, coding, qirat and more"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setFormOpen(true)}
              className="bg-amber-400 text-gray-950 hover:bg-amber-300 font-bold"
            >
              <Plus className="h-4 w-4 mr-1" /> Add new
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[13px] text-emerald-900 flex items-start gap-2">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-emerald-700" />
        <p>
          Add up to 20 hobbies & skills. Your teachers and the admin office can view them to guide
          activities, teams and opportunities for you.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-slate-100" />
          ))}
        </div>
      ) : hobbies.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="p-12 text-center">
            <Palette className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">No hobbies added yet</p>
            <p className="mx-auto mt-1 max-w-[38ch] text-xs text-slate-500">
              Tap “Add new” to record your first hobby or skill — e.g. Football, Calligraphy, Hifz revision, Coding.
            </p>
            <Button size="sm" onClick={() => setFormOpen(true)} className="mt-4 bg-emerald-700 hover:bg-emerald-800 font-bold">
              <Plus className="h-4 w-4 mr-1" /> Add my first hobby
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hobbies.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
            >
              <Card className="rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[14.5px] font-extrabold text-slate-900">{h.name}</h3>
                      {h.category && <p className="mt-0.5 text-[12px] text-slate-500">{h.category}</p>}
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
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-900 px-5 py-4 text-white rounded-t-3xl">
              <div>
                <h3 className="text-[15px] font-extrabold">Add hobby / skill</h3>
                <p className="text-[12px] text-emerald-200"> {hobbies.length}/20 used</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-1.5 text-emerald-200 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4 p-5">
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-800">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {formError}
                </div>
              )}
              <div>
                <label htmlFor="hobby-name" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                  Name *
                </label>
                <input
                  id="hobby-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Football, Calligraphy, Coding"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[14px] focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="hobby-category" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                  Category (optional)
                </label>
                <input
                  id="hobby-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Sports, Arts, Deeni, Tech"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[14px] focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Level</span>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`rounded-xl border px-2 py-2 text-[12.5px] font-bold transition ${
                        level === l ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20" : "border-slate-200 text-slate-500 hover:border-slate-300"
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
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
