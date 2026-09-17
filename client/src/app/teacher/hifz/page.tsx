"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  COMPLETED: { label: "Completed", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  IN_PROGRESS: { label: "In Progress", color: "text-blue-700", bgColor: "bg-blue-100" },
  WEAK: { label: "Weak", color: "text-amber-700", bgColor: "bg-amber-100" },
  NOT_STARTED: { label: "Not Started", color: "text-slate-600", bgColor: "bg-slate-100" },
  NEEDS_REVIEW: { label: "Needs Review", color: "text-red-700", bgColor: "bg-red-100" },
};

function ProgressRing({ progress, size = 64, strokeWidth = 5 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#teacherHifzGrad)"
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${offset} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]"
        />
        <defs>
          <linearGradient id="teacherHifzGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-900 tabular-nums">{progress}%</span>
      </div>
    </div>
  );
}

export default function TeacherHifzPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/admin/hifz");
      const data = await res.json();
      if (data.success) {
        setReports(data.data.reports);
        setError(null);
      } else {
        setError(data.error || "Failed to load reports");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const filtered = reports.filter((r) =>
    r.studentName.toLowerCase().includes(search.toLowerCase())
  );

  const totalParts = reports.reduce((sum, r) => sum + r.parts.length, 0);
  const completedParts = reports.reduce(
    (sum, r) => sum + r.parts.filter((p: any) => p.status === "COMPLETED").length,
    0
  );
  const inProgressParts = reports.reduce(
    (sum, r) => sum + r.parts.filter((p: any) => p.status === "IN_PROGRESS").length,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-amber-50/40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ── */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-700 p-6 sm:p-8 shadow-xl shadow-amber-500/20">
            <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="absolute -bottom-14 -right-10 w-52 h-52 rounded-full bg-rose-400/20 blur-3xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Hifz Reports</h1>
                <p className="text-sm text-amber-100/80 mt-1">Track Quran memorization progress across your talabat</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Talabat", value: reports.length, icon: FileSpreadsheet, chip: "bg-slate-100 text-slate-600" },
            { label: "Parts Completed", value: completedParts, icon: CheckCircle, chip: "bg-emerald-50 text-emerald-600" },
            { label: "In Progress", value: inProgressParts, icon: Clock, chip: "bg-blue-50 text-blue-600" },
            { label: "Total Parts", value: totalParts, icon: TrendingUp, chip: "bg-indigo-50 text-indigo-600" },
          ].map(({ label, value, icon: Icon, chip }) => (
            <Card key={label} className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", chip)}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
                    <p className="text-[11px] text-slate-400">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <label htmlFor="search-student" className="sr-only">Search talabat</label>
            <input
              type="text"
              id="search-student"
              name="search-student"
              placeholder="Search hafiz name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 h-10 rounded-full border border-slate-200 bg-white text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 shadow-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} className="h-10 rounded-full">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        {/* ── Reports ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-48 bg-white rounded-2xl ring-1 ring-slate-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <Card className="border-0 rounded-2xl shadow-sm">
            <CardContent className="p-16 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { setLoading(true); setError(null); fetchReports(); }}>
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-slate-100">
            <CardContent className="py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 text-lg">No hifz reports yet</p>
              <p className="text-slate-400 text-sm mt-1">Reports imported by the admin will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((report) => {
              const completedCount = report.parts.filter((p: any) => p.status === "COMPLETED").length;
              const inProgressCount = report.parts.filter((p: any) => p.status === "IN_PROGRESS").length;
              const weakCount = report.parts.filter((p: any) => p.status === "WEAK").length;
              const progress = report.parts.length > 0
                ? Math.round((completedCount / report.parts.length) * 100)
                : 0;
              const barGrad =
                progress >= 75 ? "linear-gradient(90deg, #059669, #10b981)" :
                progress >= 50 ? "linear-gradient(90deg, #0d9488, #2dd4bf)" :
                progress >= 25 ? "linear-gradient(90deg, #2563eb, #60a5fa)" :
                "linear-gradient(90deg, #cbd5e1, #e2e8f0)";

              return (
                <Card
                  key={report.id}
                  className={cn(
                    "border-0 rounded-2xl bg-white overflow-hidden group cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-0.5",
                    selectedReport === report.id && "ring-2 ring-amber-500"
                  )}
                  onClick={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
                >
                  <div className="h-1.5 transition-all duration-700" style={{ background: barGrad }} />

                  <CardContent className="p-5">
                    {/* Talib info */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-amber-500/20 shrink-0">
                          {report.studentName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 text-sm truncate">{report.studentName}</h3>
                          <p className="text-xs text-slate-400">
                            Grade {report.studentGrade}{report.studentSection}
                          </p>
                        </div>
                      </div>
                      <ProgressRing progress={progress} size={56} strokeWidth={4} />
                    </div>

                    {/* Status */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {report.isPublished ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px]">Published</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-0 text-[10px]">Draft</Badge>
                      )}
                      <Badge className="bg-amber-50 text-amber-700 border-0 text-[10px]">{report.parts.length} parts</Badge>
                    </div>

                    {/* Progress stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-2 bg-emerald-50 rounded-lg ring-1 ring-emerald-100">
                        <p className="text-lg font-bold text-emerald-600 tabular-nums">{completedCount}</p>
                        <p className="text-[9px] text-emerald-700">Done</p>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded-lg ring-1 ring-blue-100">
                        <p className="text-lg font-bold text-blue-600 tabular-nums">{inProgressCount}</p>
                        <p className="text-[9px] text-blue-600">Active</p>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded-lg ring-1 ring-amber-100">
                        <p className="text-lg font-bold text-amber-600 tabular-nums">{weakCount}</p>
                        <p className="text-[9px] text-amber-600">Weak</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
                      <span>Updated {new Date(report.updatedAt).toLocaleDateString()}</span>
                      {selectedReport === report.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>

                    {/* Expanded parts table */}
                    {selectedReport === report.id && report.parts.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <ClipboardList className="w-3 h-3" /> Parts detail
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="py-2 px-3 text-left font-bold text-slate-500 border-b text-[10px] uppercase">Part</th>
                                <th className="py-2 px-3 text-left font-bold text-slate-500 border-b text-[10px] uppercase">Status</th>
                                <th className="py-2 px-3 text-left font-bold text-slate-500 border-b text-[10px] uppercase">Review</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.parts.slice(0, 5).map((part: any) => {
                                const config = STATUS_CONFIG[part.status] || STATUS_CONFIG.NOT_STARTED;
                                return (
                                  <tr key={part.id} className="border-b border-slate-50">
                                    <td className="py-2 px-3 font-semibold tabular-nums">{part.partNumber}</td>
                                    <td className="py-2 px-3">
                                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", config.bgColor, config.color)}>
                                        {config.label}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 tabular-nums text-slate-600">{part.reviewCount}/{part.targetReviews}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {report.parts.length > 5 && (
                            <p className="text-center text-[11px] text-slate-400 py-2">
                              and {report.parts.length - 5} more parts…
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
