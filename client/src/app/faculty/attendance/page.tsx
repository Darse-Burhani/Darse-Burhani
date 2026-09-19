"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Clock,
  ClipboardList,
  Loader2,
  RotateCcw,
  Save,
  Search,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn, getInitials } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EARLY_DEPARTURE";

const STATUSES: {
  key: AttendanceStatus;
  label: string;
  icon: React.ElementType;
  idle: string;
  active: string;
  dot: string;
}[] = [
  {
    key: "PRESENT",
    label: "Present",
    icon: CheckCircle2,
    idle: "text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300",
    active: "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/30",
    dot: "bg-emerald-400",
  },
  {
    key: "LATE",
    label: "Late",
    icon: Clock,
    idle: "text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300",
    active: "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/30",
    dot: "bg-amber-400",
  },
  {
    key: "ABSENT",
    label: "Absent",
    icon: XCircle,
    idle: "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300",
    active: "bg-red-500 text-white border-red-500 shadow-sm shadow-red-500/30",
    dot: "bg-red-400",
  },
  {
    key: "EARLY_DEPARTURE",
    label: "Early Dep.",
    icon: ClipboardList,
    idle: "text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300",
    active: "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/30",
    dot: "bg-orange-400",
  },
];

interface ClassOption {
  id: string;
  name: string;
  grade: string;
  section: string;
  subject: string;
  academicYear: string;
  students: {
    id: string;
    profileId: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    grade: string;
    section: string;
  }[];
}

interface RosterStudent {
  profileId: string;
  name: string;
  studentNumber: string;
  grade: string;
  section: string;
  avatarUrl: string | null;
  status: AttendanceStatus;
  checkInTime: string;
}

export default function FacultyAttendancePage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [query, setQuery] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  );

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data.length > 0) {
          const data = res.data as ClassOption[];
          setClasses(data);
          setClassId(data[0].id);
        }
      })
      .catch(() => toast({ title: "Failed to load classes", variant: "destructive" }))
      .finally(() => setLoadingClasses(false));
  }, []);

  const loadRoster = useCallback(async () => {
    if (!classId || !selectedClass) return;
    setLoadingRoster(true);
    try {
      const res = await fetch(`/api/attendance?classId=${classId}&date=${date}`);
      const json = await res.json();
      const existing: any[] = json.success && Array.isArray(json.data) ? json.data : [];
      const map = new Map<string, any>(existing.map((r: any) => [r.student?.id, r]));

      setRoster(
        selectedClass.students.map((s) => {
          const record = map.get(s.id);
          return {
            profileId: s.profileId,
            name: `${s.firstName} ${s.lastName}`,
            studentNumber: s.studentNumber || "",
            grade: s.grade || "",
            section: s.section || "",
            avatarUrl: s.avatarUrl || null,
            status: (record?.status as AttendanceStatus) || "PRESENT",
            checkInTime: record?.checkInTime
              ? new Date(record.checkInTime).toTimeString().slice(0, 5)
              : "",
          };
        }),
      );
    } catch {
      toast({ title: "Failed to load attendance", variant: "destructive" });
    } finally {
      setLoadingRoster(false);
    }
  }, [classId, date, selectedClass]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Live biometric scan ingestion: roster updates instantly when talabat scan on hardware
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/biometric/events/stream");
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === "MATCHED" || ev.type === "DUPLICATE") {
            loadRoster();
          }
        } catch {}
      };
    } catch {}
    return () => {
      es?.close();
    };
  }, [loadRoster]);

  const setStatus = (profileId: string, status: AttendanceStatus) => {
    setRoster((prev) => prev.map((s) => (s.profileId === profileId ? { ...s, status } : s)));
  };

  const setCheckIn = (profileId: string, checkInTime: string) => {
    setRoster((prev) => prev.map((s) => (s.profileId === profileId ? { ...s, checkInTime } : s)));
  };

  const setAll = (status: AttendanceStatus) => {
    setRoster((prev) => prev.map((s) => ({ ...s, status })));
  };

  const resetAll = () => {
    setRoster((prev) => prev.map((s) => ({ ...s, status: "PRESENT", checkInTime: "" })));
  };

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EARLY_DEPARTURE: 0,
    };
    roster.forEach((s) => {
      counts[s.status] += 1;
    });
    return counts;
  }, [roster]);

  const filteredRoster = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((s) =>
      `${s.name} ${s.studentNumber}`.toLowerCase().includes(q),
    );
  }, [roster, query]);

  const save = async () => {
    if (!classId || roster.length === 0) return;
    setSaving(true);
    try {
      const records = roster.map((s) => ({
        studentId: s.profileId,
        status: s.status,
        checkInTime: s.checkInTime ? `${date}T${s.checkInTime}` : null,
      }));
      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, date, records }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Attendance saved",
          description: `${json.data.count} record${json.data.count === 1 ? "" : "s"} saved for ${date}`,
          variant: "success",
        });
        loadRoster();
      } else {
        toast({ title: json.error || "Failed to save attendance", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save attendance", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const presentCount = summary.PRESENT + summary.LATE;

    return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── High-End Header Banner ── */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 border border-emerald-500/20 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-black tracking-widest uppercase mb-3">
              <ClipboardList className="w-3.5 h-3.5 text-emerald-300" />
              Faculty Attendance Portal
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Classroom Attendance
            </h1>
            <p className="text-emerald-100/80 text-sm mt-1.5 max-w-2xl font-medium leading-relaxed">
              Mark live roster attendance for your assigned classes. Changes sync immediately to administrative dashboards and parental reports.
            </p>
          </div>

          {roster.length > 0 && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 cursor-pointer shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Class Attendance ({roster.length})
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-1.5 rounded-2xl bg-gradient-to-b from-gray-200/60 to-gray-100/30 border border-gray-200 shadow-xs">
        <div className="p-5 rounded-[calc(1rem-0.125rem)] bg-white grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="classId" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5 block">
              Active Class
            </label>
            {loadingClasses ? (
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            ) : (
              <select
                id="classId"
                name="classId"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {classes.length === 0 && <option value="">No classes assigned</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.subject} · Grade {c.grade}
                    {c.section ? `-${c.section}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="date" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5 block">
              Session Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-1">
            <label htmlFor="roster-search" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5 block">
              Search Talabat
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="roster-search"
                name="roster-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type student name or ITS number…"
                className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {!classId || !selectedClass ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-gray-200 text-gray-500 shadow-xs">
          {loadingClasses ? (
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
          ) : (
            <>
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-bold text-gray-700">No classes assigned to your faculty profile.</p>
            </>
          )}
        </div>
      ) : roster.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-gray-200 text-gray-500 shadow-xs">
          {loadingRoster ? (
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
          ) : (
            <>
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-bold text-gray-700">No talabat enrolled in this class yet.</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATUSES.map((cfg) => (
              <div key={cfg.key} className="p-1.5 rounded-2xl bg-gradient-to-b from-gray-200/50 to-gray-100/20 border border-gray-200 shadow-xs">
                <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-white flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{cfg.label}</p>
                    <p className="text-2xl font-black text-gray-950 mt-1">{summary[cfg.key]}</p>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full ${cfg.dot}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-1.5 rounded-3xl bg-gradient-to-b from-gray-200/70 to-gray-100/30 border border-gray-200 shadow-sm">
            <div className="rounded-[calc(1.5rem-0.125rem)] bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-950">{selectedClass.name} · {date}</h2>
                    <p className="text-[11px] text-gray-500 font-medium">Academic Year: {selectedClass.academicYear}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAll("PRESENT")}
                    disabled={saving}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1" /> All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setAll("ABSENT")}
                    disabled={saving}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> All Absent
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={saving}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                  </button>
                </div>
              </div>

              {loadingRoster ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRoster.map((s) => (
                    <div
                      key={s.profileId}
                      className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-gray-50/70 p-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {s.avatarUrl ? (
                          <img
                            src={s.avatarUrl}
                            alt={s.name}
                            className="w-10 h-10 rounded-xl object-cover border border-emerald-200 shadow-xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center text-xs font-black border border-emerald-200 shadow-xs">
                            {getInitials(s.name.split(" ")[0] || "", s.name.split(" ")[1] || "")}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-950 truncate">{s.name}</p>
                          <p className="text-[11px] text-gray-500 font-mono">
                            ITS: {s.studentNumber || "—"}
                            {s.grade ? ` · Grade ${s.grade}${s.section ? `-${s.section}` : ""}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {STATUSES.map((cfg) => {
                            const Icon = cfg.icon;
                            const active = s.status === cfg.key;
                            return (
                              <button
                                key={cfg.key}
                                type="button"
                                onClick={() => setStatus(s.profileId, cfg.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center gap-1.5 border active:scale-[0.96] cursor-pointer ${
                                  active
                                    ? cfg.active
                                    : cfg.idle
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-1.5 ml-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <label htmlFor={`check-in-${s.profileId}`} className="sr-only">Check-in time</label>
                          <input
                            type="time"
                            id={`check-in-${s.profileId}`}
                            name="checkInTime"
                            value={s.checkInTime}
                            disabled={s.status === "ABSENT" || saving}
                            onChange={(e) => setCheckIn(s.profileId, e.target.value)}
                            className="h-8 w-24 rounded-lg border border-gray-200 bg-white px-2 text-xs font-mono font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredRoster.length === 0 && (
                    <div className="py-12 text-center text-gray-500">
                      <p className="text-sm font-bold">No talabat match “{query}”.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-4 z-20">
            <div className="p-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
                <div className="text-xs font-medium text-slate-300">
                  <span className="font-extrabold text-emerald-400 mr-2">{presentCount} of {roster.length} present</span>
                  <span className="text-slate-400 hidden sm:inline">
                    • {summary.ABSENT} absent • {summary.EARLY_DEPARTURE} early departure
                  </span>
                </div>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98] cursor-pointer"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Attendance
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}