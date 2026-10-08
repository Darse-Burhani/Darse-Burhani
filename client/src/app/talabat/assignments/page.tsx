"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/student/PageHeader";
import { getAssignments } from "@/lib/api";
import type { AssignmentItem } from "@/lib/api";

const SKILL_LABELS: Record<string, string> = {
  criticalThinking: "Critical Thinking",
  collaboration: "Collaboration",
  leadership: "Leadership",
  resilience: "Resilience",
};

type Filter = "ALL" | "GRADED" | "PENDING";

export default function TalabatAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  const fetchData = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setAssignments(await getAssignments());
    } catch (e: any) {
      setError(e.message || "Failed to load assignments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const visible = useMemo(() => {
    if (filter === "GRADED") return assignments.filter((a) => a.myGrade);
    if (filter === "PENDING") return assignments.filter((a) => !a.myGrade);
    return assignments;
  }, [assignments, filter]);

  const graded = assignments.filter((a) => a.myGrade);
  const avgPct = graded.length
    ? Math.round(
        graded.reduce((s, a) => s + (a.myGrade!.marks / a.maxMarks) * 100, 0) / graded.length
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={ClipboardList}
        title="Assignments"
        subtitle="Tasks from your teachers — with marks once graded"
        actions={
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
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Assigned", value: assignments.length, icon: ClipboardList },
          { label: "Graded", value: graded.length, icon: CheckCircle2 },
          { label: "Average", value: avgPct === null ? "—" : `${avgPct}%`, icon: Award },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs">
            <s.icon className="mx-auto h-4 w-4 text-emerald-700" />
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className="text-xl font-extrabold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["ALL", "GRADED", "PENDING"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition ${
              filter === f ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200 hover:text-slate-800"
            }`}
          >
            {f === "ALL" ? `All (${assignments.length})` : f === "GRADED" ? `Graded (${graded.length})` : `Awaiting marks (${assignments.length - graded.length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-800">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-slate-100" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">No assignments here yet</p>
            <p className="mt-1 text-xs text-slate-500">
              {filter === "ALL" ? "Your teachers have not posted any assignments." : "Nothing in this view."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((a, i) => {
            const pct = a.myGrade ? Math.round((a.myGrade.marks / a.maxMarks) * 100) : null;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Card className="overflow-hidden rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {a.isPersonalized && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-extrabold shadow-xs">
                              ⭐ Assigned Specifically to You
                            </Badge>
                          )}
                          {a.subject && (
                            <Badge variant="outline" className="text-[11px]">
                              <BookOpen size={11} className="mr-1" /> {a.subject}
                            </Badge>
                          )}
                          {a.skillCategory && SKILL_LABELS[a.skillCategory] && (
                            <Badge className="bg-violet-50 text-violet-800 border-violet-200 text-[11px]">
                              {SKILL_LABELS[a.skillCategory]}
                            </Badge>
                          )}
                          {!a.isPersonalized && (a.grade || a.section) && (
                            <span className="text-[11px] font-semibold text-slate-400">
                              Grade {a.grade || "All"}{a.section ? `-${a.section}` : ""}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-[15.5px] font-extrabold text-slate-900">{a.title}</h3>
                        {a.description && (
                          <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-slate-500">{a.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-slate-400">
                          {a.dueDate && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={12} />
                              Due {new Date(a.dueDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                          <span>Max marks {a.maxMarks}</span>
                        </div>
                        {a.myGrade?.feedback && (
                          <p className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[12.5px] leading-relaxed text-amber-950">
                            <span className="font-bold">Teacher feedback: </span>
                            {a.myGrade.feedback}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 sm:w-[130px] sm:text-center">
                        {a.myGrade ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-xl font-black text-emerald-800">
                              {a.myGrade.marks}
                              <span className="text-xs font-bold text-emerald-600">/{a.maxMarks}</span>
                            </p>
                            <p className={`mt-0.5 text-[12px] font-extrabold ${pct! >= 50 ? "text-emerald-700" : "text-amber-700"}`}>
                              {pct}%
                            </p>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-200/60">
                              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                            <Clock size={16} className="mx-auto text-slate-400" />
                            <p className="mt-1 text-[11.5px] font-bold text-slate-500">Awaiting marks</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
