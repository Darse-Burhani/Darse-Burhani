"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  School,
  Search,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Activity,
  Mail,
  Filter,
  BarChart3,
  Flame,
  Star,
  Award,
  Zap,
  RefreshCw,
  Download,
  Shield,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Building2,
  Sparkles,
  Info,
  X,
  Send,
  Radio,
  SlidersHorizontal,
  FileCheck2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, formatTime, getInitials } from "@/lib/utils";

type PersonType = "student" | "teacher";
type EvaluationFilter = "ALL" | "EXEMPLARY" | "CONSISTENT" | "AT_RISK" | "CRITICAL";

interface MetricRecord {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  earlyDepartureDays?: number;
  attendanceRate: number;
  punctualityRate: number;
  streakDays?: number;
}

interface CheckInRecord {
  id: string;
  date: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EARLY_DEPARTURE" | string;
  checkInTime?: string | null;
  method?: string;
  justification?: string | null;
  justificationStatus?: string | null;
}

interface TrackedIndividual {
  id: string;
  userId: string;
  studentId?: string;
  employeeId?: string;
  its?: string;
  name: string;
  email: string;
  grade?: string;
  section?: string;
  department?: string;
  avatarUrl?: string | null;
  streakDays?: number;
  totalPoints?: number;
  tier?: string;
  metrics: MetricRecord;
  recentRecords?: CheckInRecord[];
  classesSummary?: Array<{ id: string; name: string; subject?: string; grade?: string; section?: string }>;
}

interface EvaluatedIndividual extends TrackedIndividual {
  evaluation: EvaluationResult;
}

interface EvaluationResult {
  tier: "EXEMPLARY" | "CONSISTENT" | "AT_RISK" | "CRITICAL";
  badgeLabel: string;
  badgeClass: string;
  score: number;
  diagnosis: string;
  recommendation: string;
  color: string;
}

function evaluateIndividual(metrics?: MetricRecord | null): EvaluationResult {
  if (!metrics || typeof metrics.attendanceRate !== "number" || metrics.totalDays === 0) {
    return {
      tier: "CONSISTENT",
      badgeLabel: "Pending Baseline",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      score: 100,
      diagnosis: "New profile or no attendance sessions logged in current tracking window.",
      recommendation: "Record initial biometric verification or import baseline roster records.",
      color: "#64748b",
    };
  }

  const { attendanceRate = 100, punctualityRate = 100, absentDays = 0, lateDays = 0, streakDays = 0 } = metrics;
  const score = Math.round(attendanceRate * 0.65 + punctualityRate * 0.35);

  if (attendanceRate >= 95 && punctualityRate >= 90) {
    return {
      tier: "EXEMPLARY",
      badgeLabel: "Exemplary Standing",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      score,
      diagnosis:
        streakDays >= 7
          ? `Flawless consistency with an active ${streakDays}-day unbroken attendance streak.`
          : "Maintains highest-tier daily attendance and prompt on-time arrivals.",
      recommendation: "Eligible for positive conduct points and attendance badge commendations.",
      color: "#059669",
    };
  } else if (attendanceRate >= 85) {
    return {
      tier: "CONSISTENT",
      badgeLabel: "Consistent Standard",
      badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
      score,
      diagnosis:
        lateDays > 2
          ? `Acceptable overall presence, though ${lateDays} delayed entries were logged.`
          : "Standard institutional attendance thresholds met without major alerts.",
      recommendation: lateDays > 2 ? "Remind of morning arrival time window." : "Keep current pace.",
      color: "#0d9488",
    };
  } else if (attendanceRate >= 70 || lateDays >= 4) {
    return {
      tier: "AT_RISK",
      badgeLabel: "Attention Needed",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      score,
      diagnosis:
        absentDays > 3
          ? `Elevated absences (${absentDays} sessions missed). Punctuality is at ${punctualityRate}%.`
          : `Repeated late check-ins (${lateDays} delays) degrading instructional time.`,
      recommendation: "Recommend counselor or teacher check-in; verify absent justifications.",
      color: "#d97706",
    };
  } else {
    return {
      tier: "CRITICAL",
      badgeLabel: "Critical Intervention",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      score,
      diagnosis: `Severe attendance deficit (${attendanceRate}% attendance, ${absentDays} absences). Urgent intervention required.`,
      recommendation: "Issue administrative attendance summons and notify parent/guardian immediately.",
      color: "#e11d48",
    };
  }
}

function PrecisionGauge({
  pct,
  color,
  label,
  sublabel,
  size = 72,
  strokeWidth = 6,
}: {
  pct: number;
  color: string;
  label?: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const clampedPct = Math.min(100, Math.max(0, pct || 0));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-black text-gray-900 tracking-tight">{clampedPct}%</span>
        </div>
      </div>
      {label && <span className="text-[11px] font-bold text-gray-800 mt-1">{label}</span>}
      {sublabel && <span className="text-[10px] text-gray-500">{sublabel}</span>}
    </div>
  );
}

export default function IndividualTrackingPage() {
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<PersonType>("student");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rate" | "punctuality" | "name" | "absent" | "late">("rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [evalFilter, setEvalFilter] = useState<EvaluationFilter>("ALL");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const [students, setStudents] = useState<TrackedIndividual[]>([]);
  const [teachers, setTeachers] = useState<TrackedIndividual[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time synchronization telemetry
  const [autoSync, setAutoSync] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(
    async (isBackground = false) => {
      try {
        if (!isBackground) {
          setRefreshing(true);
        }
        setError(null);

        const endpoint = activeType === "student" ? "/api/admin/tracking/students" : "/api/admin/tracking/teachers";
        const res = await fetch(endpoint, { credentials: "include" });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `Tracking service returned HTTP ${res.status}`);
        }

        if (activeType === "student") {
          setStudents(json.data || []);
        } else {
          setTeachers(json.data || []);
        }

        setLastSyncTime(new Date());
        setSecondsAgo(0);
      } catch (err: any) {
        console.error("Individual tracking fetch error:", err);
        const msg = err?.message || "Failed to synchronize tracking ledger. Please verify server connection.";
        setError(msg);
        if (!isBackground) {
          toast({
            title: "Synchronization Error",
            description: msg,
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeType, toast],
  );

  // Initial fetch on type change
  useEffect(() => {
    setLoading(true);
    setSelectedPersonId(null);
    fetchData(false);
  }, [activeType, fetchData]);

  // Real-time background poll (every 20 seconds)
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoSync, fetchData]);

  // Seconds ago timer tick
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastSyncTime.getTime()) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lastSyncTime]);

  const rawList = activeType === "student" ? students : teachers;

  // Compute evaluations for each person
  const evaluatedList = useMemo(() => {
    return rawList.map((person) => {
      const evaluation = evaluateIndividual(person.metrics);
      return {
        ...person,
        evaluation,
      };
    });
  }, [rawList]);

  // Derived selected individual
  const selectedPerson = useMemo(() => {
    if (!selectedPersonId) return null;
    return evaluatedList.find((p) => p.id === selectedPersonId) || null;
  }, [evaluatedList, selectedPersonId]);

  const handleSendAlert = async (person: EvaluatedIndividual) => {
    if (!person?.userId) return;
    setSendingAlert(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: `Attendance Advisory: ${person.evaluation.badgeLabel}`,
          body: `Attendance status for ${person.name}: ${person.evaluation.diagnosis} (Attendance: ${person.metrics.attendanceRate}%, Punctuality: ${person.metrics.punctualityRate}%).`,
          type: person.evaluation.tier === "CRITICAL" || person.evaluation.tier === "AT_RISK" ? "WARNING" : "INFO",
          targetType: "SPECIFIC_USERS",
          targetUserIds: [person.userId],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to send notification advisory");
      }
      toast({
        title: "Notification Dispatched",
        description: `Direct attendance notification dispatched to ${person.name}.`,
      });
    } catch (err: any) {
      toast({
        title: "Dispatch Notice",
        description: err?.message || `Advisory queued for ${person.name}.`,
        variant: "destructive",
      });
    } finally {
      setSendingAlert(false);
    }
  };

  // Available grade options
  const gradeOptions = useMemo(() => {
    if (activeType !== "student") return [];
    const set = new Set<string>();
    for (const s of students) {
      if (s.grade) set.add(s.grade);
    }
    return Array.from(set).sort();
  }, [activeType, students]);

  // Filter and Sort
  const filteredList = useMemo(() => {
    let list = [...evaluatedList];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.its && p.its.toLowerCase().includes(q)) ||
          (p.studentId && p.studentId.toLowerCase().includes(q)) ||
          (p.employeeId && p.employeeId.toLowerCase().includes(q)) ||
          (p.email && p.email.toLowerCase().includes(q)),
      );
    }

    // Evaluation Filter
    if (evalFilter !== "ALL") {
      list = list.filter((p) => p.evaluation.tier === evalFilter);
    }

    // Grade Filter
    if (activeType === "student" && gradeFilter !== "ALL") {
      list = list.filter((p) => p.grade === gradeFilter);
    }

    // Sorting
    list.sort((a, b) => {
      let va = 0;
      let vb = 0;
      if (sortBy === "name") {
        const comp = a.name.localeCompare(b.name);
        return sortDir === "asc" ? comp : -comp;
      }
      if (sortBy === "rate") {
        va = a.metrics.attendanceRate;
        vb = b.metrics.attendanceRate;
      } else if (sortBy === "punctuality") {
        va = a.metrics.punctualityRate;
        vb = b.metrics.punctualityRate;
      } else if (sortBy === "absent") {
        va = a.metrics.absentDays;
        vb = b.metrics.absentDays;
      } else if (sortBy === "late") {
        va = a.metrics.lateDays;
        vb = b.metrics.lateDays;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return list;
  }, [evaluatedList, search, evalFilter, gradeFilter, sortBy, sortDir, activeType]);

  const handleSortToggle = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  // Aggregate stats
  const totalCount = evaluatedList.length;
  const avgAttendance = totalCount
    ? Math.round(evaluatedList.reduce((acc, p) => acc + p.metrics.attendanceRate, 0) / totalCount)
    : 100;
  const avgPunctuality = totalCount
    ? Math.round(evaluatedList.reduce((acc, p) => acc + p.metrics.punctualityRate, 0) / totalCount)
    : 100;
  const exemplaryCount = evaluatedList.filter((p) => p.evaluation.tier === "EXEMPLARY").length;
  const atRiskCount = evaluatedList.filter((p) => p.evaluation.tier === "AT_RISK").length;
  const criticalCount = evaluatedList.filter((p) => p.evaluation.tier === "CRITICAL").length;

  const handleExportCSV = () => {
    try {
      const headers = [
        "Name",
        activeType === "student" ? "ITS" : "Employee ID",
        activeType === "student" ? "Grade" : "Department",
        "Attendance Rate (%)",
        "Punctuality (%)",
        "Total Days",
        "Present",
        "Late",
        "Absent",
        "Auto Evaluation",
      ];
      const rows = filteredList.map((p) => [
        `"${p.name}"`,
        `"${p.its || p.employeeId || p.studentId || ""}"`,
        `"${p.grade ? `${p.grade} ${p.section || ""}` : p.department || ""}"`,
        p.metrics.attendanceRate,
        p.metrics.punctualityRate,
        p.metrics.totalDays,
        p.metrics.presentDays,
        p.metrics.lateDays,
        p.metrics.absentDays,
        `"${p.evaluation.badgeLabel}"`,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `individual-tracking-${activeType}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export Failed", description: "Unable to generate CSV.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      {/* ── 1. Executive Fatimi Header ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="fatimi-header-banner shadow-xl">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent shadow-lg shrink-0">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Behavioral & Attendance Analytics
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-100 border border-white/20">
                    <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    Live Sync
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Individual Tracking & Evaluation
                </h1>
                <p className="text-emerald-100/80 text-xs sm:text-sm mt-0.5 max-w-2xl">
                  Automated performance diagnosis, chronological biometric ledgers, and real-time behavioral tiers for
                  every talabat and faculty member.
                </p>
              </div>
            </div>

            {/* Quick Controls Bar */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Type Switcher */}
              <div className="flex items-center bg-black/30 p-1 rounded-xl border border-white/15 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveType("student")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeType === "student"
                      ? "bg-white text-emerald-950 shadow-md"
                      : "text-white/85 hover:text-white hover:bg-white/10",
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Talabat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveType("teacher")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeType === "teacher"
                      ? "bg-white text-emerald-950 shadow-md"
                      : "text-white/85 hover:text-white hover:bg-white/10",
                  )}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>Faculty</span>
                </button>
              </div>

              {/* CSV Export */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="border-white/20 text-white hover:bg-white/10 rounded-xl text-xs font-semibold h-9"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                Export CSV
              </Button>

              {/* Real-time Sync */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(false)}
                disabled={refreshing}
                className="border-white/20 text-white hover:bg-white/10 rounded-xl text-xs font-semibold h-9"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
                Sync
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 2. Prominent Error Alert Banner (if error happens) ── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          className="relative overflow-hidden rounded-2xl border border-red-200/90 bg-gradient-to-r from-red-50 via-rose-50/80 to-amber-50/50 p-4 sm:p-5 shadow-lg shadow-red-500/5"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-500 to-rose-600" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 border border-red-200/70 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-red-950 tracking-tight">
                    Individual Tracking Feed Interrupted
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-red-100/80 text-red-700 border-red-300">
                    Live Sync Error
                  </Badge>
                </div>
                <p className="text-xs text-red-800/90 leading-relaxed max-w-2xl">{error}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(false)}
                disabled={refreshing}
                className="h-8 rounded-xl bg-white hover:bg-red-50 text-red-700 border-red-200 text-xs font-semibold shadow-sm"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
                Retry Feed
              </Button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-100/60 transition-colors"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── 3. Realtime Telemetry Strip & Status Beacon ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-gray-700">Realtime Evaluation Active:</span>
          <span>Synced {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-gray-600 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
            />
            <span>Auto-poll (20s)</span>
          </label>
        </div>
      </div>

      {/* ── 4. Precision KPI Strip (Bento Metrics) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Roster */}
        <Card className="border-gray-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#047857] flex items-center justify-center shrink-0 border border-emerald-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Enrolled</p>
              <p className="text-xl font-extrabold text-gray-900 tracking-tight">{totalCount}</p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Attendance */}
        <Card className="border-gray-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Avg Attendance</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold text-gray-900 tracking-tight">{avgAttendance}%</span>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1 rounded">Roster</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Punctuality Index */}
        <Card className="border-gray-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Punctuality Score</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold text-gray-900 tracking-tight">{avgPunctuality}%</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded">On-Time</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exemplary Tier */}
        <Card
          onClick={() => setEvalFilter(evalFilter === "EXEMPLARY" ? "ALL" : "EXEMPLARY")}
          className={cn(
            "border-gray-200/80 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer",
            evalFilter === "EXEMPLARY" && "ring-2 ring-emerald-600 bg-emerald-50/30",
          )}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
              <Star className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Exemplary Tier</p>
              <p className="text-xl font-extrabold text-emerald-700 tracking-tight">{exemplaryCount}</p>
            </div>
          </CardContent>
        </Card>

        {/* Attention / Critical */}
        <Card
          onClick={() => setEvalFilter(evalFilter === "AT_RISK" || evalFilter === "CRITICAL" ? "ALL" : "AT_RISK")}
          className={cn(
            "border-gray-200/80 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer",
            (evalFilter === "AT_RISK" || evalFilter === "CRITICAL") && "ring-2 ring-amber-500 bg-amber-50/30",
          )}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">At-Risk & Critical</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold text-amber-800 tracking-tight">{atRiskCount}</span>
                {criticalCount > 0 && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 rounded">
                    {criticalCount} Critical
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. Filtering, Automated Evaluation Tabs & Search Toolbar ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeType === "student" ? "talabat by name, ITS, grade" : "faculty by name, ID, subject"}...`}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeType === "student" && gradeOptions.length > 0 && (
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Grades</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            )}

            {/* Sorting selector */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1">
              <span className="text-[11px] font-bold text-gray-400 px-1">Sort:</span>
              <button
                type="button"
                onClick={() => handleSortToggle("rate")}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                  sortBy === "rate" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-600 hover:text-gray-900",
                )}
              >
                <span>Attendance</span>
                {sortBy === "rate" && (
                  <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSortToggle("punctuality")}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                  sortBy === "punctuality"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                <span>Punctuality</span>
                {sortBy === "punctuality" && (
                  <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSortToggle("name")}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                  sortBy === "name" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-600 hover:text-gray-900",
                )}
              >
                <span>Name</span>
                {sortBy === "name" && (
                  <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Automated Evaluation Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
          <span className="text-[11px] font-bold text-gray-400 shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Evaluation:
          </span>
          {(
            [
              { key: "ALL", label: `All (${totalCount})` },
              { key: "EXEMPLARY", label: `Exemplary (≥95%) (${exemplaryCount})` },
              {
                key: "CONSISTENT",
                label: `Consistent (85-94%) (${
                  evaluatedList.filter((p) => p.evaluation.tier === "CONSISTENT").length
                })`,
              },
              { key: "AT_RISK", label: `Attention Needed (${atRiskCount})` },
              { key: "CRITICAL", label: `Critical (<70%) (${criticalCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setEvalFilter(tab.key)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border",
                evalFilter === tab.key
                  ? tab.key === "EXEMPLARY"
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                    : tab.key === "AT_RISK"
                    ? "bg-amber-600 text-white border-amber-700 shadow-sm"
                    : tab.key === "CRITICAL"
                    ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                    : "bg-[#022c22] text-white border-[#022c22] shadow-sm"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 6. Dual Split Workspace: Roster + Live Individual Dossier ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tracked Individuals Ledger */}
        <div className={cn("space-y-3", selectedPerson ? "lg:col-span-7" : "lg:col-span-12")}>
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Synchronizing attendance telemetry...
              </p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center space-y-3">
              <Info className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="text-base font-bold text-gray-800">No Matching Individuals</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No {activeType === "student" ? "students" : "teachers"} match the selected search or automated
                evaluation criteria.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setEvalFilter("ALL");
                  setGradeFilter("ALL");
                }}
                className="rounded-xl text-xs font-semibold"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            filteredList.map((person) => {
              const isSelected = selectedPerson?.id === person.id;
              const ev = person.evaluation;
              return (
                <motion.div
                  key={person.id}
                  layout
                  onClick={() => setSelectedPersonId(isSelected ? null : person.id)}
                  className={cn(
                    "bg-white rounded-2xl border transition-all cursor-pointer p-4 hover:shadow-md group relative overflow-hidden",
                    isSelected
                      ? "border-emerald-600 ring-2 ring-emerald-600/30 bg-emerald-50/10 shadow-md"
                      : "border-gray-200/80 hover:border-emerald-400/80",
                  )}
                >
                  {/* Left accent indicator */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: ev.color }}
                  />

                  <div className="flex items-center justify-between gap-4">
                    {/* Person Identity */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="w-11 h-11 rounded-xl border border-gray-200">
                          {person.avatarUrl && <img src={person.avatarUrl} alt={person.name} className="object-cover" />}
                          <AvatarFallback className="bg-gradient-to-br from-[#022c22] to-[#047857] text-white font-bold text-xs">
                            {getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white"
                          style={{ backgroundColor: ev.color }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-900 transition-colors truncate">
                            {person.name}
                          </h4>
                          <Badge variant="outline" className={cn("text-[10px] font-bold px-1.5 py-0.5", ev.badgeClass)}>
                            {ev.badgeLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {activeType === "student" ? (
                            <>
                              <span className="font-semibold text-gray-700">ITS: {person.its || person.studentId || "—"}</span>
                              {person.grade && <span className="ml-2">· Grade {person.grade} {person.section || ""}</span>}
                            </>
                          ) : (
                            <>
                              <span className="font-semibold text-gray-700">ID: {person.employeeId || "—"}</span>
                              {person.department && <span className="ml-2">· {person.department}</span>}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Performance Gauges & Metric Pills */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center justify-end gap-1 text-xs font-bold text-gray-900">
                          <span>{person.metrics.attendanceRate}%</span>
                          <span className="text-[10px] text-gray-400 font-normal">Att</span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-[11px] text-gray-500 mt-0.5">
                          <span className="text-emerald-700 font-semibold">{person.metrics.presentDays}P</span>
                          <span className="text-amber-700 font-semibold">{person.metrics.lateDays}L</span>
                          <span className="text-rose-700 font-semibold">{person.metrics.absentDays}A</span>
                        </div>
                      </div>

                      {/* Circular Gauge */}
                      <PrecisionGauge
                        pct={person.metrics.attendanceRate}
                        color={ev.color}
                        size={48}
                        strokeWidth={4}
                      />

                      <ChevronRight
                        className={cn(
                          "w-4 h-4 text-gray-500 group-hover:text-emerald-700 transition-transform",
                          isSelected && "rotate-90 text-emerald-700",
                        )}
                      />
                    </div>
                  </div>

                  {/* Diagnosis snippet */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="truncate pr-2 italic">“{ev.diagnosis}”</span>
                    {person.streakDays !== undefined && person.streakDays > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 shrink-0">
                        <Flame className="w-3 h-3 text-amber-600" />
                        {person.streakDays}d streak
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Right Column: Deep-Dive Individual Dossier Panel */}
        <AnimatePresence>
          {selectedPerson && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-5 sticky top-6 space-y-4"
            >
              <Card className="border-gray-200/90 shadow-xl bg-white rounded-2xl overflow-hidden">
                {/* Dossier Header */}
                <div className="fatimi-card-luxury p-5 bg-gradient-to-r from-emerald-950 via-[#047857] to-emerald-900 text-white relative">
                  <button
                    type="button"
                    onClick={() => setSelectedPersonId(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-3.5">
                    <Avatar className="w-14 h-14 rounded-2xl border-2 border-white/20 shadow-lg">
                      {selectedPerson.avatarUrl && (
                        <img src={selectedPerson.avatarUrl} alt={selectedPerson.name} className="object-cover" />
                      )}
                      <AvatarFallback className="bg-white text-emerald-950 font-black text-base">
                        {getInitials(selectedPerson.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white tracking-tight">{selectedPerson.name}</h3>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-bold border-white/30 bg-white/10 text-white")}
                        >
                          {selectedPerson.evaluation.badgeLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-emerald-100/80 mt-0.5">
                        {activeType === "student"
                          ? `ITS ${selectedPerson.its || selectedPerson.studentId} · Grade ${selectedPerson.grade || "N/A"} ${selectedPerson.section || ""}`
                          : `ID: ${selectedPerson.employeeId || "—"} · ${selectedPerson.department || "Faculty"}`}
                      </p>
                      <p className="text-[11px] text-emerald-100/90 mt-0.5">{selectedPerson.email}</p>
                    </div>
                  </div>
                </div>

                <CardContent className="p-5 space-y-5">
                  {/* Automated Evaluation Diagnosis Box */}
                  <div className="rounded-xl border border-gray-200/90 bg-gradient-to-br from-gray-50 to-emerald-50/30 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>Automated Compliance Diagnosis</span>
                      </div>
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: selectedPerson.evaluation.color }}
                      >
                        Score: {selectedPerson.evaluation.score}/100
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed">
                      {selectedPerson.evaluation.diagnosis}
                    </p>

                    <div className="pt-2 border-t border-gray-200/60 flex items-start gap-1.5 text-[11px] text-gray-600">
                      <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-gray-900">Next Action:</strong>{" "}
                        {selectedPerson.evaluation.recommendation}
                      </span>
                    </div>
                  </div>

                  {/* Dual Precision Gauges */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50/80 rounded-xl border border-gray-200/80">
                    <PrecisionGauge
                      pct={selectedPerson.metrics.attendanceRate}
                      color={selectedPerson.evaluation.color}
                      label="Attendance"
                      sublabel={`${selectedPerson.metrics.presentDays} of ${selectedPerson.metrics.totalDays} sessions`}
                      size={68}
                    />
                    <PrecisionGauge
                      pct={selectedPerson.metrics.punctualityRate}
                      color="#047857"
                      label="Punctuality"
                      sublabel={`${selectedPerson.metrics.lateDays} delays logged`}
                      size={68}
                    />
                  </div>

                  {/* Performance Metric Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <p className="text-[10px] uppercase font-bold text-emerald-800">Present</p>
                      <p className="text-lg font-black text-emerald-950 mt-0.5">
                        {selectedPerson.metrics.presentDays}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-[10px] uppercase font-bold text-amber-800">Late</p>
                      <p className="text-lg font-black text-amber-950 mt-0.5">
                        {selectedPerson.metrics.lateDays}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                      <p className="text-[10px] uppercase font-bold text-rose-800">Absent</p>
                      <p className="text-lg font-black text-rose-950 mt-0.5">
                        {selectedPerson.metrics.absentDays}
                      </p>
                    </div>
                  </div>

                  {/* Chronological Biometric Ledger */}
                  {selectedPerson.recentRecords && selectedPerson.recentRecords.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-emerald-700" />
                          Recent Check-In Ledger
                        </span>
                        <span className="text-[10px] text-gray-500 font-normal">Last 15 records</span>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {selectedPerson.recentRecords.map((rec) => {
                          const isPresent = rec.status === "PRESENT";
                          const isLate = rec.status === "LATE";
                          const isAbsent = rec.status === "ABSENT";
                          return (
                            <div
                              key={rec.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200/80 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {isPresent && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                                {isLate && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                                {isAbsent && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                                <div>
                                  <p className="font-semibold text-gray-900">{formatDate(rec.date)}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {rec.checkInTime ? formatTime(rec.checkInTime) : "No check-in recorded"}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-bold",
                                    isPresent && "bg-emerald-100 text-emerald-800 border-emerald-200",
                                    isLate && "bg-amber-100 text-amber-800 border-amber-200",
                                    isAbsent && "bg-rose-100 text-rose-800 border-rose-200",
                                  )}
                                >
                                  {rec.status}
                                </Badge>
                                {rec.justificationStatus === "PENDING" && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-bold">
                                    Review
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions Toolbar */}
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      onClick={() => window.open(`mailto:${selectedPerson.email}`)}
                      variant="outline"
                      className="flex-1 rounded-xl text-xs font-semibold h-9"
                    >
                      <Mail className="w-3.5 h-3.5 mr-1.5 text-gray-600" />
                      Email {activeType === "student" ? "Guardian" : "Faculty"}
                    </Button>
                    <Button
                      onClick={() => handleSendAlert(selectedPerson)}
                      disabled={sendingAlert}
                      className="flex-1 rounded-xl text-xs font-semibold h-9 bg-[#022c22] hover:bg-[#047857] text-white"
                    >
                      <Send className={cn("w-3.5 h-3.5 mr-1.5", sendingAlert && "animate-pulse")} />
                      {sendingAlert ? "Dispatching..." : "Send In-App Alert"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
