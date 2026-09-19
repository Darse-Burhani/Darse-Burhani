"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  Fingerprint,
  Radio,
  GraduationCap,
  ChevronDown,
} from "lucide-react";
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
    idle: "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300",
    active: "bg-emerald-500 text-white border-emerald-500 ring-2 ring-emerald-300 ring-offset-1",
    dot: "bg-emerald-400",
  },
  {
    key: "LATE",
    label: "Late",
    icon: Clock,
    idle: "bg-white text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300",
    active: "bg-amber-500 text-white border-amber-500 ring-2 ring-amber-300 ring-offset-1",
    dot: "bg-amber-400",
  },
  {
    key: "ABSENT",
    label: "Absent",
    icon: XCircle,
    idle: "bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300",
    active: "bg-red-500 text-white border-red-500 ring-2 ring-red-300 ring-offset-1",
    dot: "bg-red-400",
  },
  {
    key: "MEDICAL",
    label: "Medical",
    icon: Stethoscope,
    idle: "bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300",
    active: "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300 ring-offset-1",
    dot: "bg-blue-400",
  },
  {
    key: "EXCUSED",
    label: "Excused",
    icon: ShieldCheck,
    idle: "bg-white text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300",
    active: "bg-purple-600 text-white border-purple-600 ring-2 ring-purple-300 ring-offset-1",
    dot: "bg-purple-400",
  },
  {
    key: "EARLY_DEPARTURE",
    label: "Early Dep.",
    icon: AlertTriangle,
    idle: "bg-white text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300",
    active: "bg-orange-500 text-white border-orange-500 ring-2 ring-orange-300 ring-offset-1",
    dot: "bg-orange-400",
  },
];

const STATUS_DOT: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-400",
  LATE: "bg-amber-400",
  ABSENT: "bg-red-400",
  MEDICAL: "bg-blue-400",
  EXCUSED: "bg-purple-400",
  EARLY_DEPARTURE: "bg-orange-400",
};

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
  const presentPct = roster.length > 0 ? Math.round((summary.PRESENT / roster.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900">
        {/* subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
        {/* glow orbs */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 w-60 h-40 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
          >
            {/* Title block */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] bg-emerald-600 text-emerald-100 border border-emerald-500">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  Live Class Roster
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Mark Attendance
              </h1>
              <p className="text-emerald-200 text-sm max-w-md opacity-80">
                Select class and date · mark each talabat · records sync across all portals instantly.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setManualModalOpen(true)}
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm font-bold transition-all duration-300 active:scale-[0.97]"
              >
                <Fingerprint className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform duration-300" />
                Manual Entry
              </button>
              {roster.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(true)}
                    className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-400 text-white text-sm font-bold transition-all duration-300 active:scale-[0.97]"
                  >
                    <Mail className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                    Email Parents
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-sm font-black transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] disabled:opacity-60 shadow-lg shadow-amber-400/30"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                    )}
                    Save Attendance
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {/* ── Summary Stat Strip ── */}
          {roster.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-2"
            >
              {STATUSES.map((cfg) => (
                <div
                  key={cfg.key}
                  className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border border-white/20 bg-white/10"
                >
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <p className="text-xl font-black text-white leading-none">{summary[cfg.key]}</p>
                  <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider">{cfg.label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* ── Pending Justifications ── */}
        <AnimatePresence>
          {!loadingJustifications && justifications.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-2xl bg-amber-50 border border-amber-200 overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-2 bg-amber-100/60 border-b border-amber-200">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900">Absence Justifications</h3>
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-black">
                    {justifications.length} pending
                  </span>
                </div>
                <div className="divide-y divide-amber-100">
                  {justifications.map((j) => (
                    <div key={j.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{j.studentName}</p>
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                            {j.status === "ABSENT" ? "Absent" : "Early Dep."}
                          </span>
                          <span className="text-xs text-gray-500">
                            {j.className} ·{" "}
                            {new Date(j.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">"{j.justification}"</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleJustification(j.id, "REJECTED")}
                          disabled={handlingId === j.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {handlingId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleJustification(j.id, "APPROVED")}
                          disabled={handlingId === j.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {handlingId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Controls Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <div className="rounded-2xl bg-white border border-gray-200/80 shadow-sm p-5">
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Class selector */}
              <div>
                <label htmlFor="classId" className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5">
                  Class
                </label>
                {loadingClasses ? (
                  <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                ) : (
                  <div className="relative">
                    <select
                      id="classId"
                      name="classId"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full h-10 appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-8 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
                    >
                      {classes.length === 0 && <option value="">No classes assigned</option>}
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.subject} · Gr {c.grade}{c.section ? `-${c.section}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Date picker */}
              <div>
                <label htmlFor="date" className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
                />
              </div>

              {/* Search */}
              <div>
                <label htmlFor="roster-search" className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    id="roster-search"
                    name="roster-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or ITS number…"
                    className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Roster ── */}
        {!classId || !selectedClass ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-white border border-gray-200 p-16 text-center"
          >
            {loadingClasses ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-gray-600">No classes assigned. Ask an admin to create a class.</p>
              </>
            )}
          </motion.div>
        ) : roster.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-white border border-gray-200 p-16 text-center"
          >
            {loadingRoster ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-500">No talabat enrolled in this class yet.</p>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <div className="rounded-2xl bg-white border border-gray-200/80 shadow-sm overflow-hidden">
              {/* Roster Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedClass.name}</p>
                    <p className="text-[11px] text-gray-500">{date} · {filteredRoster.length} talabat</p>
                  </div>
                  {loadingRoster && <Loader2 className="w-4 h-4 animate-spin text-emerald-600 ml-1" />}
                </div>

                {/* Bulk actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Bulk:</span>
                  <button
                    type="button"
                    onClick={() => setAll("PRESENT")}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="w-3 h-3" /> All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setAll("ABSENT")}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" /> All Absent
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
              </div>

              {/* Roster Rows */}
              <div className="divide-y divide-gray-100/80">
                {loadingRoster ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                  </div>
                ) : (
                  filteredRoster.map((s, i) => (
                    <motion.div
                      key={s.profileId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.015, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 hover:bg-gray-50/60 transition-colors duration-150"
                    >
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => cycleStatus(s.profileId)}
                          title="Click to cycle status"
                          className="relative shrink-0 focus:outline-none"
                        >
                          {s.avatarUrl ? (
                            <img
                              src={s.avatarUrl}
                              alt={s.name}
                              className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs font-black text-white border-2 border-white shadow-sm">
                              {getInitials(s.firstName, s.lastName)}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${STATUS_DOT[s.status]}`}
                          />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                            {s.grade && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                                Gr {s.grade}{s.section ? `-${s.section}` : ""}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">{s.studentNumber}</p>
                          {s.justificationStatus === "PENDING" && (
                            <span className="inline-block text-[10px] text-amber-600 font-bold mt-0.5">⏳ Justification pending</span>
                          )}
                          {s.justificationStatus === "APPROVED" && (
                            <span className="inline-block text-[10px] text-emerald-700 font-bold mt-0.5">✓ Absence justified</span>
                          )}
                          {s.justificationStatus === "REJECTED" && (
                            <span className="inline-block text-[10px] text-red-600 font-bold mt-0.5">✕ Justification rejected</span>
                          )}
                        </div>
                      </div>

                      {/* Status Buttons */}
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
                                "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-all duration-200 active:scale-[0.96]",
                                active ? cfg.active : cfg.idle,
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {cfg.label}
                            </button>
                          );
                        })}

                        {/* Check-in time */}
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
                            className="h-8 w-28 rounded-xl border border-gray-200 bg-gray-50 px-2 text-[11px] font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 disabled:opacity-40 transition-colors"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
                {filteredRoster.length === 0 && !loadingRoster && (
                  <div className="py-12 text-center text-gray-400">
                    <p className="text-sm font-semibold">No talabat match "{query}".</p>
                  </div>
                )}
              </div>

              {/* ── Sticky Save Bar ── */}
              <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-4">
                  {/* Progress bar */}
                  <div className="hidden sm:flex flex-col gap-1 min-w-[140px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Attendance</span>
                      <span className="text-[10px] font-black text-emerald-700">{presentPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                        style={{ width: `${presentPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    <span className="font-black text-emerald-700">{summary.PRESENT + summary.LATE}</span> of{" "}
                    <span className="font-bold">{roster.length}</span> present
                    <span className="text-gray-400 ml-2 text-xs">({markedCount}/{roster.length} marked)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-black transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] disabled:opacity-60 shadow-md shadow-emerald-700/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Attendance
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Email Report Modal ── */}
      <AnimatePresence>
        {emailModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Email Attendance Reports to Parents</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Send personalized attendance reports for all{" "}
                  <strong className="text-gray-900">{roster.length} talabat</strong> in{" "}
                  <strong className="text-gray-900">{selectedClass?.name || "this class"}</strong> to their parents.
                </p>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-2">Report Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["WEEKLY", "MONTHLY"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEmailPeriodType(type)}
                        className={cn(
                          "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all",
                          emailPeriodType === type
                            ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        {type === "WEEKLY" ? "📅 Weekly (Past 7 Days)" : "📊 Monthly (Current Month)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-2">Teacher's Note (Optional)</label>
                  <textarea
                    rows={3}
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value)}
                    placeholder="e.g. Jazakallah for ensuring punctual attendance."
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 resize-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendClassEmails}
                  disabled={emailSending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-black transition-all disabled:opacity-60"
                >
                  {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to {roster.length} Parents
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Schedule-Driven Manual Attendance Modal ── */}
      <ManualAttendanceModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        initialDate={date}
        onSuccess={() => loadRoster()}
      />
    </div>
  );
}
