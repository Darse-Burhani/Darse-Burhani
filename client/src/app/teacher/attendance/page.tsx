"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Users,
  Loader2,
  Save,
  RotateCcw,
  UserCheck,
  ClipboardCheck,
  ClipboardList,
  Check,
  X,
  Search,
  Mail,
  Send,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ManualAttendanceModal } from "@/components/attendance/ManualAttendanceModal";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EARLY_DEPARTURE" | "MEDICAL" | "EXCUSED";

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
    key: "MEDICAL",
    label: "Medical",
    icon: Stethoscope,
    idle: "text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300",
    active: "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30",
    dot: "bg-blue-400",
  },
  {
    key: "EXCUSED",
    label: "Excused",
    icon: ShieldCheck,
    idle: "text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300",
    active: "bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-500/30",
    dot: "bg-purple-400",
  },
  {
    key: "EARLY_DEPARTURE",
    label: "Early Dep.",
    icon: AlertTriangle,
    idle: "text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300",
    active: "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/30",
    dot: "bg-orange-400",
  },
];

interface RosterStudent {
  profileId: string;
  firstName: string;
  lastName: string;
  name: string;
  studentNumber: string;
  grade: string;
  section: string;
  avatarUrl: string | null;
  status: AttendanceStatus;
  checkInTime: string;
  justificationStatus: string;
  justification: string | null;
}

export default function TeacherAttendancePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [query, setQuery] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justifications, setJustifications] = useState<any[]>([]);
  const [loadingJustifications, setLoadingJustifications] = useState(true);
  const [handlingId, setHandlingId] = useState<string | null>(null);

  // Email report state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPeriodType, setEmailPeriodType] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [emailNote, setEmailNote] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  const handleSendClassEmails = async () => {
    if (!classId || roster.length === 0) return;
    setEmailSending(true);
    try {
      const studentIds = roster.map((s) => s.profileId);
      const res = await fetch("/api/admin/attendance/email-reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds,
          periodType: emailPeriodType,
          customNote: emailNote.trim() || undefined,
          sendToParents: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: "Attendance Emails Sent",
          description: `Dispatched ${json.data.sentCount} email${json.data.sentCount !== 1 ? "s" : ""} to parents.`,
          variant: "success",
        });
        setEmailModalOpen(false);
        setEmailNote("");
      } else {
        toast({ title: json.error || "Failed to send emails", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to connect to email service", variant: "destructive" });
    } finally {
      setEmailSending(false);
    }
  };

  const fetchJustifications = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/attendance/justifications");
      const json = await res.json();
      if (json.success) setJustifications(json.data);
    } catch {
      // silent
    } finally {
      setLoadingJustifications(false);
    }
  }, []);

  useEffect(() => {
    fetchJustifications();
  }, [fetchJustifications]);

  const handleJustification = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setHandlingId(id);
    try {
      const res = await fetch("/api/attendance/justification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId: id, decision }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: decision === "APPROVED" ? "Justification approved" : "Justification declined",
          variant: "success",
        });
        setJustifications((prev) => prev.filter((j) => j.id !== id));
      } else {
        toast({ title: json.error || "Failed to update justification", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update justification", variant: "destructive" });
    } finally {
      setHandlingId(null);
    }
  };

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  );

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data.length > 0) {
          setClasses(res.data);
          setClassId(res.data[0].id);
        }
      })
      .catch(() => toast({ title: "Failed to load classes", variant: "destructive" }))
      .finally(() => setLoadingClasses(false));
  }, []);

  const loadRoster = useCallback(async () => {
    if (!classId) return;
    setLoadingRoster(true);
    try {
      const students = selectedClass?.students || [];
      const res = await fetch(`/api/attendance?classId=${classId}&date=${date}`);
      const json = await res.json();
      const existing: any[] = json.success && Array.isArray(json.data) ? json.data : [];
      const map = new Map<string, any>(existing.map((r: any) => [r.student?.id, r]));

      setRoster(
        students.map((s: any) => {
          const record = map.get(s.profileId);
          return {
            profileId: s.profileId,
            firstName: s.firstName || "",
            lastName: s.lastName || "",
            name: `${s.firstName} ${s.lastName}`,
            studentNumber: s.studentNumber || "",
            grade: s.grade || "",
            section: s.section || "",
            avatarUrl: s.avatarUrl || null,
            status: (record?.status as AttendanceStatus) || "PRESENT",
            checkInTime: record?.checkInTime
              ? new Date(record.checkInTime).toTimeString().slice(0, 5)
              : "",
            justificationStatus: record?.justificationStatus || "NONE",
            justification: record?.justification || null,
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
    setRoster((prev) =>
      prev.map((s) => (s.profileId === profileId ? { ...s, status } : s)),
    );
  };

  const cycleStatus = (profileId: string) => {
    setRoster((prev) =>
      prev.map((s) => {
        if (s.profileId !== profileId) return s;
        const order: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EARLY_DEPARTURE"];
        const next = order[(order.indexOf(s.status) + 1) % order.length];
        return { ...s, status: next };
      }),
    );
  };

  const filteredRoster = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((s) =>
      `${s.name} ${s.studentNumber}`.toLowerCase().includes(q),
    );
  }, [roster, query]);

  const setCheckIn = (profileId: string, checkInTime: string) => {
    setRoster((prev) =>
      prev.map((s) => (s.profileId === profileId ? { ...s, checkInTime } : s)),
    );
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
      MEDICAL: 0,
      EXCUSED: 0,
      EARLY_DEPARTURE: 0,
    };
    roster.forEach((s) => {
      if (counts[s.status] !== undefined) {
        counts[s.status] += 1;
      }
    });
    return counts;
  }, [roster]);

  const save = async () => {
    if (!classId || roster.length === 0) return;
    setSaving(true);
    try {
      const records = roster.map((s) => ({
        studentId: s.profileId,
        status: s.status,
        ...(s.checkInTime ? { checkInTime: `${date}T${s.checkInTime}` } : {}),
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

  const markedCount = roster.filter((s) => s.status !== "ABSENT").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
            Mark Attendance
          </h1>
          <p className="text-gray-500 mt-1">
            Select a class and date, then mark each talabat present, late, absent, or early departure.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            onClick={() => setManualModalOpen(true)}
            className="text-emerald-800 border-emerald-300 hover:bg-emerald-50 font-bold"
          >
            <Clock className="w-4 h-4 mr-2 text-emerald-600" />
            Multi-Schedule Manual Entry
          </Button>
          {roster.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setEmailModalOpen(true)}
                className="text-amber-800 border-amber-300 hover:bg-amber-50"
              >
                <Mail className="w-4 h-4 mr-2 text-amber-600" />
                Email Reports to Parents
              </Button>
              <Button variant="teacher" onClick={save} loading={saving} className="sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                Save Attendance
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Pending Justifications */}
      {!loadingJustifications && justifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <Card className="fatimi-card border-amber-200 bg-amber-50/40">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardList className="w-4 h-5 text-amber-600" />
                Absence Justifications
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                  {justifications.length} pending
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-amber-100">
                {justifications.map((j) => (
                  <div key={j.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{j.studentName}</p>
                        <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700">
                          {j.status === "ABSENT" ? "Absent" : "Early Dep."}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {j.className} ·{" "}
                          {new Date(j.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        “{j.justification}”
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Submitted {j.justificationSubmittedAt ? new Date(j.justificationSubmittedAt).toLocaleString() : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleJustification(j.id, "REJECTED")}
                        disabled={handlingId === j.id}
                      >
                        {handlingId === j.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleJustification(j.id, "APPROVED")}
                        disabled={handlingId === j.id}
                      >
                        {handlingId === j.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-5 grid sm:grid-cols-2 gap-4">
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
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
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
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
            />
          </div>
          <div className="sm:col-span-2">
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
                className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!classId || !selectedClass ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            {loadingClasses ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-600" />
            ) : (
              <>
                <ClipboardCheck className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                <p className="text-sm">No classes assigned. Ask an admin to create a class.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : roster.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            {loadingRoster ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-600" />
            ) : (
              <>
                <Users className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                <p className="text-sm">No talabat enrolled in this class yet.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary + quick actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
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
                <CalendarDays className="w-4 h-5 text-amber-600" />
                {selectedClass.name} · {date}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAll("PRESENT")}
                  disabled={saving}
                >
                  <UserCheck className="w-4 h-4 mr-1.5" /> All Present
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAll("ABSENT")}
                  disabled={saving}
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> All Absent
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAll}
                  disabled={saving}
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRoster ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
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
                        <button
                          type="button"
                          onClick={() => cycleStatus(s.profileId)}
                          title="Click to cycle status"
                          className="relative shrink-0"
                        >
                          {s.avatarUrl ? (
                            <img
                              src={s.avatarUrl}
                              alt={s.name}
                              className="w-11 h-11 rounded-xl object-cover border-2 border-amber-200"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold border-2 border-amber-200">
                              {getInitials(s.firstName, s.lastName)}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${STATUSES.find((c) => c.key === s.status)?.dot}`}
                          />
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-500">
                            {s.studentNumber}
                            {s.grade ? ` · Grade ${s.grade}${s.section ? `-${s.section}` : ""}` : ""}
                          </p>
                          {s.justificationStatus === "PENDING" && (
                            <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                              ⏳ Justification pending
                            </p>
                          )}
                          {s.justificationStatus === "APPROVED" && (
                            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                              ✓ Absence justified
                            </p>
                          )}
                          {s.justificationStatus === "REJECTED" && (
                            <p className="text-[10px] text-red-600 font-medium mt-0.5">
                              ✕ Justification rejected
                            </p>
                          )}
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
                            className="h-9 w-28 rounded-xl border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40"
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
                  <Badge variant="success" className="mr-2 text-[10px]">Present</Badge>
                  {summary.PRESENT + summary.LATE} of {roster.length} present
                  <span className="text-gray-500 ml-2 hidden sm:inline">
                    ({markedCount}/{roster.length} marked)
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

      {/* ── Class Email Dispatch Modal ── */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-600" />
                Email Attendance Reports to Parents
              </h3>
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="text-gray-500 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4">
              Send personalized attendance reports for all{" "}
              <strong>{roster.length} talabat</strong> in{" "}
              <strong>{selectedClass?.name || "this class"}</strong> directly to their parents.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase tracking-wide">
                  Report Frequency / Period:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailPeriodType("WEEKLY")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      emailPeriodType === "WEEKLY"
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    📅 Weekly Report (Past 7 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPeriodType("MONTHLY")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      emailPeriodType === "MONTHLY"
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    📊 Monthly Report (Current Month)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase tracking-wide">
                  Teacher's Note / Remark (Optional):
                </label>
                <textarea
                  rows={3}
                  value={emailNote}
                  onChange={(e) => setEmailNote(e.target.value)}
                  placeholder="e.g. Jazakallah for ensuring punctual attendance. Please review this week's attendance summary."
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="teacher"
                size="sm"
                disabled={emailSending}
                onClick={handleSendClassEmails}
                className="font-bold"
              >
                {emailSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                Send Reports to {roster.length} Talabat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Schedule Manual Attendance Modal */}
      <ManualAttendanceModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        initialScheduleType="CLASS_PERIOD"
        initialClassId={classId}
        initialDate={date}
        onSuccess={() => loadRoster()}
      />
    </div>
  );
}
