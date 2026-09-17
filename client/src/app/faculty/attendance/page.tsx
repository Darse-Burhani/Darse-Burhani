"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
            Manual Attendance
          </h1>
          <p className="text-gray-500 mt-1">
            Select a class and date to mark the roster, or edit a previously saved day.
          </p>
        </div>
        {roster.length > 0 && (
          <Button variant="teacher" onClick={save} loading={saving} className="sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            Save Attendance
          </Button>
        )}
      </motion.div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="classId" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Class
            </label>
            {loadingClasses ? (
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            ) : (
              <select
                id="classId"
                name="classId"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400"
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
            <label htmlFor="date" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400"
            />
          </div>
          <div className="lg:col-span-1">
            <label htmlFor="roster-search" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="roster-search"
                name="roster-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or ITS number…"
                className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!classId || !selectedClass ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            {loadingClasses ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
            ) : (
              <>
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm">No classes assigned. Ask an admin to create a class.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : roster.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            {loadingRoster ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
            ) : (
              <>
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm">No talabat enrolled in this class yet.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid sm:grid-cols-4 gap-4 mb-6"
          >
            {STATUSES.map((cfg) => (
              <Card key={cfg.key} className="fatimi-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{cfg.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{summary[cfg.key]}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                </CardContent>
              </Card>
            ))}
          </motion.div>

          <Card className="fatimi-card mb-6">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-5 text-emerald-500" />
                {selectedClass.name} · {date}
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {selectedClass.academicYear}
                </Badge>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")} disabled={saving}>
                  <UserCheck className="w-4 h-4 mr-1.5" /> All Present
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAll("ABSENT")} disabled={saving}>
                  <XCircle className="w-4 h-4 mr-1.5" /> All Absent
                </Button>
                <Button variant="ghost" size="sm" onClick={resetAll} disabled={saving}>
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRoster ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRoster.map((s, i) => (
                    <motion.div
                      key={s.profileId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="py-3 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {s.avatarUrl ? (
                          <img
                            src={s.avatarUrl}
                            alt={s.name}
                            className="w-11 h-11 rounded-xl object-cover border-2 border-emerald-200"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold border-2 border-emerald-200">
                            {getInitials(s.name.split(" ")[0] || "", s.name.split(" ")[1] || "")}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-500">
                            {s.studentNumber}
                            {s.grade ? ` · Grade ${s.grade}${s.section ? `-${s.section}` : ""}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {STATUSES.map((cfg) => {
                          const Icon = cfg.icon;
                          const active = s.status === cfg.key;
                          return (
                            <button
                              key={cfg.key}
                              type="button"
                              onClick={() => setStatus(s.profileId, cfg.key)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all",
                                active ? cfg.active : cn("bg-white/80", cfg.idle),
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {cfg.label}
                            </button>
                          );
                        })}
                        <div className="flex items-center gap-1.5 ml-1">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          <label htmlFor={`check-in-${s.profileId}`} className="sr-only">Check-in time</label>
                          <input
                            type="time"
                            id={`check-in-${s.profileId}`}
                            name="checkInTime"
                            value={s.checkInTime}
                            disabled={s.status === "ABSENT" || saving}
                            onChange={(e) => setCheckIn(s.profileId, e.target.value)}
                            className="h-9 w-28 rounded-xl border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {filteredRoster.length === 0 && (
                    <div className="py-12 text-center text-gray-500">
                      <p className="text-sm">No talabat match “{query}”.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sticky save bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="sticky bottom-4"
          >
            <Card className="shadow-xl">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  <Check className="w-4 h-4 inline text-emerald-500 mr-1" />
                  {presentCount} of {roster.length} present
                  <span className="text-gray-500 ml-2 hidden sm:inline">
                    {summary.ABSENT} absent · {summary.EARLY_DEPARTURE} early departure
                  </span>
                </div>
                <Button variant="teacher" onClick={save} loading={saving} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Save Attendance
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}