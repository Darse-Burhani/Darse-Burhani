"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  Users,
  GraduationCap,
  Activity,
  Fingerprint,
  Mail,
  FileText,
  Briefcase,
  ClipboardCheck,
  Zap,
  CheckCircle2,
  UserCheck,
  FileSpreadsheet,
  Moon,
  Search,
  Filter,
  Check,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  Calendar,
  Building2,
  XCircle,
  HelpCircle,
  Edit3,
  Shield,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import {
  getAttendanceLogs,
  getAttendanceLogEvents,
  getExportAttendanceLogsUrl,
  pollHikvisionDevicesNow,
  pollHikvisionMonthToRender,
  powerSyncHikvisionAll,
  AttendanceLogsResponse,
  ScheduledEventWindow,
  AttendanceLogRecordItem,
  overrideAttendanceLog,
  overrideAttendanceRegistry,
} from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DayDetailDrawer } from "@/components/registry/DayDetailDrawer";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { getHijriFromDate } from "@/lib/fatimi-calendar";

export function formatScanTimeIST(timeStr?: string | Date | null): string {
  if (!timeStr) return "—";
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatScanDateIST(timeStr?: string | Date | null): string {
  if (!timeStr) return "—";
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatRelative(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function getTodayDateString(): string {
  // Always use the school's IST calendar day, even if an admin opens the page
  // from another timezone. en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type StatusFilterType =
  | "ALL"
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "NOT_MARKED"
  | "MEDICAL"
  | "ON_LEAVE";

type SortOptionType =
  | "time-desc"
  | "time-asc"
  | "name-asc"
  | "name-desc"
  | "status"
  | "type"
  | "class";

export default function AdminAttendanceHikPage() {
  const todayStr = getTodayDateString();
  const { data: session } = useSession();
  const isFaculty = session?.user?.role === "TEACHER";

  const [date, setDate] = useState<string>(todayStr);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [audience, setAudience] = useState<"STUDENT" | "FACULTY" | "ALL">("STUDENT");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("ALL");
  const [sortBy, setSortBy] = useState<SortOptionType>("time-desc");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [data, setData] = useState<AttendanceLogsResponse | null>(null);
  const [events, setEvents] = useState<ScheduledEventWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [pollingHardware, setPollingHardware] = useState<boolean>(false);
  const [pollingMonth, setPollingMonth] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // The selected schedule drives the audience toggle. E-Learning (and any other
  // faculty-only window) must never expose a Talabat/student toggle.
  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((ev) => ev.id === selectedEventId) ?? null : null),
    [events, selectedEventId]
  );
  const selectedEventIsFacultyOnly = selectedEvent?.audience === "FACULTY";

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      setSelectedEventId(eventId);
      const ev = events.find((e) => e.id === eventId);
      if (ev?.audience === "FACULTY") setAudience("FACULTY");
      else if (ev?.audience === "STUDENT" || ev?.audience === "ALL_STUDENTS") setAudience("STUDENT");
    },
    [events]
  );

  useEffect(() => {
    if (selectedEventIsFacultyOnly && audience !== "FACULTY") {
      setAudience("FACULTY");
    }
  }, [selectedEventIsFacultyOnly, audience]);

  // Live state
  const [isLive, setIsLive] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    role: "STUDENT" | "FACULTY";
    openOverride?: boolean;
  } | null>(null);

  // Quick Override Modal State (Accessible for ALL users: Students & Faculty)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<AttendanceLogRecordItem | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>("PRESENT");
  const [overrideSource, setOverrideSource] = useState<string>("MANUAL");
  const [overrideRemarks, setOverrideRemarks] = useState<string>("");
  const [savingOverride, setSavingOverride] = useState(false);

  const handleOpenOverride = (record: AttendanceLogRecordItem) => {
    setOverrideTarget(record);
    const initialStatus =
      record.status === "NOT_MARKED" || record.status === "ABSENT" ? "PRESENT" : record.status;
    setOverrideStatus(initialStatus);
    setOverrideSource(record.source === "SCAN" || record.source === "BIOMETRIC" ? "SCAN" : "MANUAL");
    setOverrideRemarks("");
    setOverrideModalOpen(true);
  };

  const handleSubmitOverride = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!overrideTarget) return;

    setSavingOverride(true);
    try {
      if (overrideTarget.role === "FACULTY") {
        await overrideAttendanceLog({
          teacherId: overrideTarget.memberId,
          date,
          status: overrideStatus,
          source: overrideSource,
          remarks: overrideRemarks.trim() || undefined,
        });
      } else {
        await overrideAttendanceRegistry({
          studentId: overrideTarget.memberId,
          date,
          status: overrideStatus,
          source: overrideSource,
          remarks: overrideRemarks.trim() || undefined,
        });
      }

      toast({
        title: "Attendance Overridden Successfully",
        description: `Updated ${overrideTarget.name} (${overrideTarget.role === "FACULTY" ? "Faculty" : "Student"}) to ${overrideStatus} for ${date}.`,
        variant: "success",
      });

      setOverrideModalOpen(false);
      setOverrideTarget(null);
      await loadAttendance(true);
    } catch (err: any) {
      toast({
        title: "Override Failed",
        description: err.message || "Failed to update attendance status",
        variant: "destructive",
      });
    } finally {
      setSavingOverride(false);
    }
  };

  // Fetch events
  useEffect(() => {
    getAttendanceLogEvents()
      .then((evs) => setEvents(evs))
      .catch((err) => console.error("Failed to load events", err));
  }, []);

  // Primary loader
  const loadAttendance = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await getAttendanceLogs({
          date,
          grade: selectedGrade || undefined,
          section: selectedSection || undefined,
          eventWindowId: selectedEventId || undefined,
          audience,
          logType: "HIKVISION",
        });
        setData(res);
        setLastUpdatedAt(new Date().toISOString());
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 900);
      } catch (err: any) {
        setError(err.message || "Failed to load Hikvision attendance logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date, selectedGrade, selectedSection, selectedEventId, audience]
  );

  useEffect(() => {
    loadAttendance(false);
  }, [loadAttendance]);

  // Live auto-refresh polling every 15s
  useEffect(() => {
    if (!isLive || date !== todayStr) return;
    tickRef.current = window.setInterval(() => {
      loadAttendance(true);
    }, 15000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isLive, date, todayStr, loadAttendance]);

  // Immediate Hardware Polling Handler (supports today or selected date)
  const handlePollDevicesNow = async () => {
    setPollingHardware(true);
    try {
      const res = await pollHikvisionDevicesNow(date);
      const devices = res.data?.devices || [];
      const unreachable = devices.filter((d) => !d.success);

      if (res.success) {
        if (unreachable.length > 0) {
          toast({
            variant: "destructive",
            title: "Some terminals did not answer",
            description: `${unreachable
              .map((d) => `${d.name || d.host}: ${d.error || "no response"}`)
              .join(" · ")}. The pull keeps running — refreshed scans appear within seconds.`,
          });
        } else {
          toast({
            variant: "success",
            title: "Hardware Scans Synchronized",
            description: `Pulled ${res.data.totalFetched} live scans for ${date === todayStr ? "today" : date} across ${devices.length} terminal(s) (${res.data.totalProcessed} processed into attendance).`,
          });
        }
        await loadAttendance(true);
      } else {
        toast({
          variant: "destructive",
          title: "Hardware Sync Warning",
          description: res.message || "Failed to poll devices",
        });
      }
    } catch (err: any) {
      const message = err.message || "Failed to communicate with Hikvision terminals";
      const timedOut = /timed out|504/i.test(message);
      toast({
        variant: "destructive",
        title: timedOut ? "Hardware Sync Timed Out" : "Connection Error",
        description: timedOut
          ? `${message} Terminals did not answer inside the sync window — the pull continues in the background and the table refreshes automatically.`
          : message,
      });
      // Partial results may still have landed: pull the table again shortly.
      if (timedOut) window.setTimeout(() => loadAttendance(true), 4000);
    } finally {
      setPollingHardware(false);
    }
  };

  // ⚡ Tri-Terminal Power-Sync Handler (Runs connection test, IST clock alignment & scans in parallel across all 3 terminals)
  const [powerSyncing, setPowerSyncing] = useState(false);
  const handlePowerSyncAll = async () => {
    setPowerSyncing(true);
    toast({
      variant: "default",
      title: "⚡ Power-Syncing All 3 Terminals",
      description: "Testing connection, synchronizing IST clocks, and pulling live punches across 192.168.0.4, 192.168.0.5, and 192.168.0.11...",
    });
    try {
      const res = await powerSyncHikvisionAll();
      if (res.success) {
        toast({
          variant: "success",
          title: "⚡ Tri-Terminal Power Sync Complete",
          description: res.message || "All 3 terminals connected and synchronized successfully.",
        });
        await loadAttendance(true);
      } else {
        toast({
          variant: "destructive",
          title: "Sync Notice",
          description: res.message || "Failed to power sync all terminals",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: err.message || "Failed to communicate with terminals",
      });
    } finally {
      setPowerSyncing(false);
    }
  };

  // Full Month Sync Handler (pulls entire month scans from Hikvision & pushes to Render)
  const handlePollMonthNow = async () => {
    setPollingMonth(true);
    const targetMonth = date.slice(0, 7);
    try {
      const res = await pollHikvisionMonthToRender(targetMonth);
      if (res.success) {
        toast({
          variant: "success",
          title: "Full Month Synchronized to Render",
          description: res.message || `Successfully rendered full month attendance for ${targetMonth} across terminals.`,
        });
        await loadAttendance(true);
      } else {
        toast({
          variant: "destructive",
          title: "Month Sync Notice",
          description: res.message || "Failed to sync full month scans",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Full Month Run Error",
        description: err.message || "Failed to communicate with Hikvision terminals or Render Cloud",
      });
    } finally {
      setPollingMonth(false);
    }
  };

  // Date controls (pure numeric timezone-safe arithmetic)
  const shiftDate = (currentDateStr: string, deltaDays: number): string => {
    const [y, m, d] = currentDateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
    const year = dt.getUTCFullYear();
    const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handlePrevDay = () => setDate((prev) => shiftDate(prev, -1));
  const handleNextDay = () => setDate((prev) => shiftDate(prev, 1));
  const handleToday = () => setDate(todayStr);

  // Open Drawer
  const handleMemberClick = (memberId: string, role: "STUDENT" | "FACULTY", openOverride = false) => {
    setSelectedMember({ id: memberId, role, openOverride });
    setDrawerOpen(true);
  };

  // Scanned biometric records from server
  const allRecords = useMemo(() => data?.records || [], [data?.records]);

  // Audience scoped records (for computing status counts)
  const audienceRecords = useMemo(() => {
    if (audience === "ALL") return allRecords;
    return allRecords.filter((r) => r.role === audience);
  }, [allRecords, audience]);

  // Aggregated KPI Stats
  const stats = useMemo(() => {
    // A member counts as scanned only when a real terminal scan produced the
    // check-in. Manual roll-call entries must not inflate the "Scanned" card.
    const isScanned = (r: AttendanceLogRecordItem) =>
      Boolean(r.checkInTime) && (r.source === "SCAN" || r.source === "BIOMETRIC" || r.verificationMethod === "BIOMETRIC");

    const studentsPunched = allRecords.filter((r) => r.role === "STUDENT" && isScanned(r)).length;
    const facultyPunched = allRecords.filter((r) => r.role === "FACULTY" && isScanned(r)).length;

    // Full Strength from server (total enrolled roster, independent of logType)
    const rosterStudents = data?.rosterSize?.students ?? allRecords.filter((r) => r.role === "STUDENT").length;
    const rosterFaculty = data?.rosterSize?.faculty ?? allRecords.filter((r) => r.role === "FACULTY").length;
    const rosterTotal = data?.rosterSize?.total ?? allRecords.length;

    // Global counts for the audience tabs, so they stay correct while the
    // table is scoped to Talabat or Faculty.
    const overallRosterStudents = data?.overallRosterSize?.students ?? rosterStudents;
    const overallRosterFaculty = data?.overallRosterSize?.faculty ?? rosterFaculty;
    const overallRosterTotal = data?.overallRosterSize?.total ?? rosterTotal;

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let medicalCount = 0;
    let leaveCount = 0;
    let notMarkedCount = 0;
    let holidayCount = 0;
    let exemptCount = 0;

    audienceRecords.forEach((r) => {
      if (r.status === "PRESENT") presentCount++;
      else if (r.status === "LATE") lateCount++;
      else if (r.status === "ABSENT") absentCount++;
      else if (r.status === "MEDICAL") medicalCount++;
      else if (r.status === "ON_LEAVE") leaveCount++;
      else if (r.status === "HOLIDAY") holidayCount++;
      else if (r.status === "EXEMPT" || (r as any).source === "NOT_APPLICABLE") exemptCount++;
      else notMarkedCount++;
    });

    // Hikvision view is full-strength: anyone with no scan and no approved
    // medical/leave is absent for the day, even if the register has not been
    // finalised yet. This is what makes the Absent KPI reliable at any hour.
    const effectiveAbsentCount = absentCount + notMarkedCount;

    // Arrival rate: (present + late) / full strength for selected audience
    const audienceFullStrength =
      audience === "STUDENT" ? rosterStudents
      : audience === "FACULTY" ? rosterFaculty
      : rosterTotal;
    const arrivedCount = presentCount + lateCount;
    const arrivalPct = audienceFullStrength > 0 ? Math.round((arrivedCount / audienceFullStrength) * 100) : 0;
    const presentPct = audienceFullStrength > 0 ? Math.round((presentCount / audienceFullStrength) * 100) : 0;

    return {
      totalPunched: studentsPunched + facultyPunched,
      studentPunched: studentsPunched,
      facultyPunched: facultyPunched,
      rosterStudents,
      rosterFaculty,
      rosterTotal,
      overallRosterStudents,
      overallRosterFaculty,
      overallRosterTotal,
      audienceFullStrength,
      arrivedCount,
      arrivalPct,
      presentPct,
      presentCount,
      lateCount,
      absentCount: effectiveAbsentCount,
      rawAbsentCount: absentCount,
      notMarkedCount,
      medicalCount,
      leaveCount,
      holidayCount,
    };
  }, [allRecords, audienceRecords, data, audience]);

  const handleStatusFilterChange = (newStatus: StatusFilterType) => {
    setStatusFilter(newStatus);
  };

  // Filter and Sort Records
  const displayRecords = useMemo(() => {
    let list = allRecords;

    // Role filter
    if (audience !== "ALL") {
      list = list.filter((r) => r.role === audience);
    }

    // Status filter
    if (statusFilter !== "ALL") {
      if (statusFilter === "NOT_MARKED") {
        list = list.filter(
          (r) =>
            r.status === "NOT_MARKED" ||
            (!r.checkInTime &&
              r.status !== "PRESENT" &&
              r.status !== "LATE" &&
              r.status !== "ABSENT" &&
              r.status !== "MEDICAL" &&
              r.status !== "ON_LEAVE")
        );
      } else if (statusFilter === "ABSENT") {
        // In the full-strength Hikvision view an unmarked member is absent:
        // no terminal scan, no approved leave, no medical exemption.
        list = list.filter((r) => r.status === "ABSENT" || r.status === "NOT_MARKED");
      } else {
        list = list.filter((r) => r.status === statusFilter);
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.its && r.its.toLowerCase().includes(q)) ||
          (r.designationOrClass && r.designationOrClass.toLowerCase().includes(q))
      );
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === "time-desc") {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "time-asc") {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === "type") {
        if (a.role !== b.role) return a.role === "STUDENT" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "class") {
        const classA = a.designationOrClass || a.className || "";
        const classB = b.designationOrClass || b.className || "";
        const cmp = classA.localeCompare(classB);
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "status") {
        const priority: Record<string, number> = {
          PRESENT: 1,
          LATE: 2,
          MEDICAL: 3,
          ON_LEAVE: 4,
          ABSENT: 5,
          NOT_MARKED: 6,
        };
        const pA = priority[a.status] || 99;
        const pB = priority[b.status] || 99;
        if (pA !== pB) return pA - pB;
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });
  }, [allRecords, audience, statusFilter, searchQuery, sortBy]);

  // Helper for Status Badge Styling (Differential Colors: Green, Orange, Red, Cyan, Purple)
  const getStatusBadge = (status: string, hasScan: boolean) => {
    switch (status) {
      case "PRESENT":
        return {
          label: "PRESENT",
          bg: "bg-emerald-600 text-white font-black border-emerald-500 shadow-xs",
          pill: "bg-emerald-50 text-emerald-900 border border-emerald-300 font-extrabold",
          dot: "bg-emerald-300",
          icon: CheckCircle2,
          colorCode: "emerald",
        };
      case "LATE":
        return {
          label: "LATE",
          bg: "bg-amber-500 text-white font-black border-amber-600 shadow-xs",
          pill: "bg-amber-50 text-amber-950 border border-amber-300 font-extrabold",
          dot: "bg-amber-400",
          icon: Clock,
          colorCode: "amber",
        };
      case "ABSENT":
        return {
          label: "ABSENT",
          bg: "bg-rose-600 text-white font-black border-rose-700 shadow-xs",
          pill: "bg-rose-50 text-rose-950 border border-rose-300 font-extrabold",
          dot: "bg-rose-300",
          icon: XCircle,
          colorCode: "rose",
        };
      case "MEDICAL":
        return {
          label: "MEDICAL",
          bg: "bg-cyan-600 text-white font-black border-cyan-700 shadow-xs",
          pill: "bg-cyan-50 text-cyan-950 border border-cyan-300 font-extrabold",
          dot: "bg-cyan-300",
          icon: Activity,
          colorCode: "cyan",
        };
      case "ON_LEAVE":
        return {
          label: "ON LEAVE",
          bg: "bg-purple-600 text-white font-black border-purple-700 shadow-xs",
          pill: "bg-purple-50 text-purple-950 border border-purple-300 font-extrabold",
          dot: "bg-purple-300",
          icon: Briefcase,
          colorCode: "purple",
        };
      case "HOLIDAY":
        return {
          label: "HOLIDAY",
          bg: "bg-slate-700 text-white font-black border-slate-600",
          pill: "bg-slate-100 text-slate-800 border border-slate-300 font-bold",
          dot: "bg-slate-400",
          icon: Calendar,
          colorCode: "slate",
        };
      case "EXEMPT":
      case "NOT_APPLICABLE":
        return {
          label: "EXEMPT · NOT ELIGIBLE",
          bg: "bg-slate-600 text-white font-black border-slate-500",
          pill: "bg-slate-100 text-slate-700 border border-slate-300 font-bold",
          dot: "bg-slate-400",
          icon: Shield,
          colorCode: "slate",
        };
      default:
        return {
          label: hasScan ? "SCANNED" : "UNSCANNED",
          bg: hasScan ? "bg-emerald-600 text-white font-black" : "bg-slate-100 text-slate-600 border border-slate-200 font-bold",
          pill: "bg-slate-100 text-slate-700 border border-slate-300",
          dot: "bg-slate-400",
          icon: HelpCircle,
          colorCode: "gray",
        };
    }
  };

  return (
    <div className="w-full max-w-full lg:max-w-[1440px] mx-auto p-2.5 sm:p-4 lg:p-6 space-y-3.5 sm:space-y-5 overflow-x-hidden">
      {/* ── Attendance Hub Navigation Tabs ── */}
      {!isFaculty && (
        <AdminHubTabs
          hubTitle="Attendance & Biometric Center"
          hubDescription="Real-time terminal monitoring, physical biometric scans, manual classroom registers, and automated sync."
          tabs={[
            { label: "Hikvision Scans", href: "/admin/attendance-hik", icon: Fingerprint, badge: "Hardware" },
            { label: "Manual Logs", href: "/admin/attendance-manual", icon: ClipboardCheck, badge: "Register" },
            { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
            { label: "Device Hub", href: "/admin/biometric", icon: Activity },
            { label: "Google Sheets", href: "/admin/google-sheets", icon: FileSpreadsheet, badge: "Sync" },
            { label: "Email Reports", href: "/admin/attendance-emails", icon: Mail },
          ]}
        />
      )}

      {/* ── Fatimi Luxury Hero Cockpit (Mobile Adaptive) ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#0d0d0d] via-[#1c1c1c] to-[#0d0d0d] p-4 sm:p-6 lg:p-8 shadow-[0_16px_40px_rgba(2,31,24,0.45)] text-white">
        <div className="pointer-events-none absolute -right-16 -bottom-16 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#d4af37]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-60 sm:w-80 h-60 sm:h-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#d4af37]/20 text-[#f5e6b3] border border-[#d4af37]/40 shadow-xs">
                <Fingerprint className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                Hikvision Hardware Scans
              </span>
              {isLive && date === todayStr && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className={`w-2 h-2 rounded-full bg-emerald-400 shrink-0 ${livePulse ? "animate-ping" : ""}`} />
                  Live Stream
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white flex flex-wrap items-baseline gap-2">
              <span>Hikvision Full-Strength Attendance</span>
              <span className="text-xs sm:text-sm font-arabic font-alkanz font-normal text-amber-300/80 tracking-normal" dir="rtl" lang="ar">سجلات البصمة والأجهزة</span>
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl font-medium leading-relaxed">
              Full enrolled strength with live terminal scans, absentees, medical exemptions and approved leave. All timestamps are recorded and displayed in Indian Standard Time (Asia/Kolkata).
            </p>
          </div>

          {/* Action Cockpit Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-1 lg:pt-0">
            <button
              type="button"
              onClick={handlePowerSyncAll}
              disabled={powerSyncing || pollingHardware || pollingMonth || refreshing}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 text-white font-black text-xs shadow-lg shadow-amber-600/25 hover:shadow-amber-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 min-h-[42px]"
              title="Parallel ping, IST clock alignment & simultaneous punch poll across all 3 Hikvision terminals (192.168.0.4, 192.168.0.5, 192.168.0.11)"
            >
              <Zap className={`w-4 h-4 shrink-0 text-amber-200 ${powerSyncing ? "animate-spin" : ""}`} />
              <span className="truncate">
                {powerSyncing ? "Power-Syncing 3 Terminals..." : "⚡ Power-Sync All 3"}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePollDevicesNow}
              disabled={pollingHardware || pollingMonth || refreshing}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 min-h-[42px]"
              title={date === todayStr ? "Poll MinMoe hardware terminals & sync all scans to Render" : `Poll MinMoe hardware terminals for ${date} & sync to Render`}
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${pollingHardware ? "animate-spin" : ""}`} />
              <span className="truncate">
                {pollingHardware
                  ? "Polling & Syncing..."
                  : date === todayStr
                  ? "Poll from Hik & Sync to Render"
                  : `Poll ${date} & Sync to Render`}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePollMonthNow}
              disabled={pollingMonth || pollingHardware || refreshing}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-700 hover:from-sky-500 hover:to-indigo-600 text-white font-black text-xs shadow-lg shadow-sky-700/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 min-h-[42px]"
              title={`Poll entire month (${date.slice(0, 7)}) scans from Hikvision terminals & push full month to Render`}
            >
              <Calendar className={`w-4 h-4 shrink-0 ${pollingMonth ? "animate-spin" : ""}`} />
              <span className="truncate">
                {pollingMonth ? "Syncing Month..." : "Render Full Month Run"}
              </span>
            </button>

            <a
              href="/api/admin/attendance-logs/export-faculty-excel"
              download="Faculty_Attendance_October_2026_Full_Month.xlsx"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border border-emerald-400/40 text-white font-bold text-xs shadow-md transition-all min-h-[42px]"
              title="Download October 2026 Full Month Faculty Biometric Attendance in Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>Faculty Excel (Full Month Oct)</span>
            </a>

            <a
              href={getExportAttendanceLogsUrl({ audience })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs shadow-sm transition-all min-h-[42px]"
            >
              <Download className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Live Terminal & Scan Stats Counter Cards (Responsive 2 / 3 / 4 / 7 column grid) */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/10">
          {/* Card 1: Full Strength */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 border border-[#d4af37]/40 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#f5e6b3] truncate">Full Strength</span>
              <Users className="w-3 h-3 text-[#d4af37] shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#f5e6b3] mt-0.5 truncate">
              {stats.audienceFullStrength}
            </div>
            <div className="text-[10px] text-[#d4af37]/70 font-bold truncate">
              {stats.overallRosterStudents} Students · {stats.overallRosterFaculty} Faculty
            </div>
          </div>

          {/* Card 2: Present */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 border-2 border-emerald-400 text-white min-w-0 shadow-lg shadow-emerald-950/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 truncate">Present</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5 truncate">
              {stats.presentCount}
            </div>
            <div className="text-[10px] text-emerald-100 font-extrabold truncate">{stats.presentPct}% of strength</div>
          </div>

          {/* Card 3: Absent (includes not-yet-scanned) */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-rose-500/15 border border-rose-400/40 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 truncate">Absent</span>
              <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-200 mt-0.5 truncate">
              {stats.absentCount}
            </div>
            <div className="text-[10px] text-rose-300/70 font-bold truncate">
              {stats.notMarkedCount} unscanned
            </div>
          </div>

          {/* Card 4: Medical */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-purple-500/15 border border-purple-400/40 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 truncate">Medical</span>
              <Activity className="w-3 h-3 text-purple-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-200 mt-0.5 truncate">
              {stats.medicalCount}
            </div>
            <div className="text-[10px] text-purple-300/70 font-bold truncate">Approved exemption</div>
          </div>

          {/* Card 5: On Leave */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-sky-500/15 border border-sky-400/40 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 truncate">On Leave</span>
              <Briefcase className="w-3 h-3 text-sky-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-200 mt-0.5 truncate">
              {stats.leaveCount}
            </div>
            <div className="text-[10px] text-sky-300/70 font-bold truncate">Approved leave</div>
          </div>

          {/* Card 6: Late */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 truncate">Late</span>
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-200 mt-0.5 truncate">
              {stats.lateCount}
            </div>
            <div className="text-[10px] text-amber-300/70 font-bold truncate">Scanned after cut-off</div>
          </div>

          {/* Card 7: Scanned */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/90 truncate">Scanned</span>
              <Fingerprint className="w-3 h-3 text-sky-300 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-200 mt-0.5 truncate">
              {stats.totalPunched}
            </div>
            <div className="text-[10px] text-sky-300/70 font-bold truncate">
              {stats.arrivalPct}% arrived · {audience === "STUDENT"
                ? `${stats.studentPunched} Students`
                : audience === "FACULTY"
                ? `${stats.facultyPunched} Faculty`
                : `${stats.studentPunched} T / ${stats.facultyPunched} F`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dynamic Schedule Tabs Bar (PWA APK touch-friendly & auto-generated when admin creates schedules) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Attendance Schedule Tabs
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {events.length} Active {events.length === 1 ? "Schedule" : "Schedules"}
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 hidden sm:inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Time Synced &amp; Auto-Scoped
          </span>
        </div>

        {/* Scrollable Tab Strip */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5 touch-pan-x">
          {/* Tab 0: Overview / All Schedules */}
          <button
            type="button"
            onClick={() => {
              setSelectedEventId("");
            }}
            className={`shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-black transition-all cursor-pointer shadow-xs min-h-[46px] touch-manipulation active:scale-[0.98] ${
              selectedEventId === ""
                ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${selectedEventId === "" ? "bg-amber-400" : "bg-slate-400"}`} />
            <div className="text-left">
              <div className="font-extrabold truncate">All Schedules (Overview)</div>
              <div className={`text-[10px] font-medium truncate ${selectedEventId === "" ? "text-slate-300" : "text-slate-400"}`}>
                Full Strength · All Roster
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
              selectedEventId === "" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {stats.audienceFullStrength}
            </span>
          </button>

          {/* Dynamic Tabs: One per configured attendance schedule */}
          {events.map((ev) => {
            const isSelected = selectedEventId === ev.id;
            const liveCount = data?.eventLiveCounts?.[ev.id] ?? 0;
            const isBoth = ev.audience === "BOTH" || /tilawat/i.test(ev.name);
            const isFacultyOnly = !isBoth && ev.audience === "FACULTY";

            const audienceTheme = isBoth
              ? {
                  pill: "bg-purple-100 text-purple-900 border-purple-300",
                  label: "Both (Students & Faculty)",
                  selectedBg: "bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 text-white border-purple-700 shadow-md ring-2 ring-purple-600/30",
                  activeDot: "bg-purple-300",
                }
              : isFacultyOnly
              ? {
                  pill: "bg-blue-100 text-blue-900 border-blue-300",
                  label: "Faculty Only",
                  selectedBg: "bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30",
                  activeDot: "bg-blue-300",
                }
              : {
                  pill: "bg-emerald-100 text-emerald-900 border-emerald-300",
                  label: "Students Only",
                  selectedBg: "bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30",
                  activeDot: "bg-emerald-300",
                };

            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  handleSelectEvent(ev.id);
                }}
                className={`shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-black transition-all cursor-pointer shadow-xs min-h-[46px] touch-manipulation active:scale-[0.98] ${
                  isSelected
                    ? audienceTheme.selectedBg
                    : "bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  ev.status === "ACTIVE"
                    ? "bg-emerald-400 animate-pulse ring-2 ring-emerald-400/50"
                    : isSelected
                    ? audienceTheme.activeDot
                    : "bg-slate-300"
                }`} />

                <div className="text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold truncate">{ev.name}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                      isSelected ? "bg-white/20 text-white border-white/30" : audienceTheme.pill
                    }`}>
                      {audienceTheme.label}
                    </span>
                  </div>
                  <div className={`text-[10px] font-mono truncate mt-0.5 ${
                    isSelected ? "text-white/80" : "text-slate-500"
                  }`}>
                    {ev.startTime} – {ev.lateEndTime || ev.endTime} IST
                  </div>
                </div>

                <div className="flex flex-col items-end gap-0.5 shrink-0 pl-1">
                  {ev.status === "ACTIVE" && (
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full animate-pulse ${
                      isSelected ? "bg-emerald-400 text-emerald-950" : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    }`}>
                      Live
                    </span>
                  )}
                  {liveCount > 0 && (
                    <span className={`text-[9.5px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                    }`}>
                      {liveCount} scans
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter, Audience, Status Toggles & Search Toolbar ── */}
      <div className="p-3.5 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        {/* Row 1: Date Navigation & Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date Picker & Quick Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {date !== todayStr && (
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Today
              </button>
            )}
          </div>

          {/* Window Schedule Time Sync Selector & Cockpit Display */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/70 text-slate-800 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 shrink-0">
                Window Schedule:
              </span>
              <select
                value={selectedEventId}
                onChange={(e) => handleSelectEvent(e.target.value)}
                className="bg-transparent text-xs font-black text-emerald-950 outline-none cursor-pointer pr-1"
              >
                <option value="">All Schedule Windows (Full Strength)</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.startTime} - {ev.lateEndTime || ev.endTime} IST)
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-black shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-emerald-300">
                {selectedEventId
                  ? events.find((e) => e.id === selectedEventId)?.name || "Selected Window"
                  : events[0]
                  ? `${events[0].name} (${events[0].startTime} - ${events[0].lateEndTime || events[0].endTime} IST)`
                  : "Tilawat al Dua (07:00 - 12:30 IST)"}
              </span>
              <span className="text-slate-400 font-normal">| Time Synced</span>
            </div>
          </div>
        </div>

        {/* Row 2: Audience Toggle Buttons (All, Students, Faculty) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Audience:</span>
            {selectedEventIsFacultyOnly && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-[9px] font-black normal-case tracking-normal">
                Faculty-only schedule
              </span>
            )}
          </div>

          <div
            className={`${
              selectedEventIsFacultyOnly ? "grid grid-cols-2 sm:flex" : "grid grid-cols-3 sm:flex"
            } items-center gap-1.5 w-full sm:w-auto`}
          >
            <button
              type="button"
              onClick={() => setAudience("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
                audience === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({stats.overallRosterTotal} enrolled)
            </button>

            {/* Talabat/student toggle is intentionally hidden for faculty-only
                schedules such as E-Learning, where only Asaatizah scan. */}
            {!selectedEventIsFacultyOnly && (
              <button
                type="button"
                onClick={() => setAudience("STUDENT")}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
                  audience === "STUDENT"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>Students ({stats.overallRosterStudents})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setAudience("FACULTY")}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
                audience === "FACULTY"
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              <span>Faculty ({stats.overallRosterFaculty})</span>
            </button>
          </div>
        </div>

        {/* Row 3: Status Filter Toggles (Present, Late, Absent, Not Marked, Medical, On Leave) */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter by Status:</span>
            </div>
            {statusFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold lowercase tracking-normal flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                reset status filter
              </button>
            )}
          </div>

          {/* Horizontally scrollable chips on mobile with touch drag, flex-wrap on desktop */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 touch-pan-x">
            {/* Chip: All */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("ALL")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span>All Statuses</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"}`}>
                {audienceRecords.length}
              </span>
            </button>

            {/* Chip: Present */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("PRESENT")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "PRESENT"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Present</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "PRESENT" ? "bg-white/20 text-white" : "bg-emerald-200 text-emerald-900 font-bold"}`}>
                {stats.presentCount}
              </span>
            </button>

            {/* Chip: Late */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("LATE")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "LATE"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-xs"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Late</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "LATE" ? "bg-slate-900/20 text-slate-950 font-black" : "bg-amber-200 text-amber-900 font-bold"}`}>
                {stats.lateCount}
              </span>
            </button>

            {/* Chip: Absent */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("ABSENT")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "ABSENT"
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
              }`}
            >
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Absent</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "ABSENT" ? "bg-white/20 text-white" : "bg-rose-200 text-rose-900 font-bold"}`}>
                {stats.absentCount}
              </span>
            </button>

            {/* Chip: Medical */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("MEDICAL")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "MEDICAL"
                  ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                  : "bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100"
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>Medical</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "MEDICAL" ? "bg-white/20 text-white" : "bg-cyan-200 text-cyan-900 font-bold"}`}>
                {stats.medicalCount}
              </span>
            </button>

            {/* Chip: On Leave */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("ON_LEAVE")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "ON_LEAVE"
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              <span>On Leave</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "ON_LEAVE" ? "bg-white/20 text-white" : "bg-purple-200 text-purple-900 font-bold"}`}>
                {stats.leaveCount}
              </span>
            </button>
          </div>
        </div>

        {/* Row 4: Search Box and Sort Type Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ITS, or grade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-full sm:w-auto">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs hover:border-slate-300">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-slate-500 font-medium shrink-0">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOptionType)}
                  aria-label="Sort attendance records"
                  className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer pr-2"
                >
                  <option value="time-desc">Scan Time (Newest First)</option>
                  <option value="time-asc">Scan Time (Oldest First)</option>
                  <option value="name-asc">Name (A → Z)</option>
                  <option value="name-desc">Name (Z → A)</option>
                  <option value="status">Status Priority</option>
                  <option value="type">Type (Students First)</option>
                  <option value="class">Class / Department</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hikvision Scans: Mobile Adaptive Display ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Container Header Banner */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider truncate">
              Full Strength Roster
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-300 shrink-0">
              {audience === "STUDENT" ? stats.studentPunched : audience === "FACULTY" ? stats.facultyPunched : stats.totalPunched} scanned / {stats.audienceFullStrength} enrolled
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-[10px] text-slate-400 font-mono">
            {statusFilter !== "ALL" && (
              <span className="text-amber-300 font-bold">
                Filtered: {statusFilter}
              </span>
            )}
            {lastUpdatedAt && (
              <span>Last synced: {formatScanTimeIST(lastUpdatedAt)}</span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-12 sm:p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading Hikvision attendance scans...</p>
          </div>
        ) : displayRecords.length === 0 ? (
          /* Empty State */
          <div className="p-10 sm:p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Fingerprint className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Full-Strength Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {statusFilter !== "ALL"
                ? `No attendance records found with status "${statusFilter}". Try selecting "All Statuses" or clearing your search.`
                : `No roster or terminal punches recorded yet for ${date === todayStr ? "today" : date}. Click "Poll ${date === todayStr ? "Today's" : date} Scans Now" to sync with physical terminals.`}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
              {statusFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Clear Status Filter
                </button>
              )}
              {date !== todayStr && (
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Go to Today
                </button>
              )}
              <button
                type="button"
                onClick={handlePollDevicesNow}
                disabled={pollingHardware}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${pollingHardware ? "animate-spin" : ""}`} />
                <span>{pollingHardware ? "Polling & Syncing..." : date === todayStr ? "Poll from Hik & Sync to Render" : `Poll ${date} & Sync to Render`}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── MOBILE VIEW: Responsive Touch Cards (Visible on screens < lg) ── */}
            <div className="block lg:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2.5">
              {displayRecords.map((r, i) => {
                const isFacultyMember = r.role === "FACULTY";
                const hasScan = Boolean(r.checkInTime);
                const hijri = getHijriFromDate(r.checkInTime || date);
                const badgeInfo = getStatusBadge(r.status, hasScan);
                const StatusIcon = badgeInfo.icon;

                return (
                  <div
                    key={r.id || r.memberId || i}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-emerald-500/40 shadow-xs transition-all space-y-3"
                  >
                    {/* Header Row: Avatar, Member Info, Role Badge & Status Pill */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-10 h-10 rounded-xl border border-slate-200 shrink-0 shadow-2xs">
                          <AvatarImage src={r.avatarUrl || undefined} />
                          <AvatarFallback
                            className={`text-[11px] font-black ${
                              isFacultyMember ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {getInitials(r.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-xs text-slate-900 truncate">
                              {r.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                                isFacultyMember
                                  ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {isFacultyMember ? "Faculty" : "Student"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-mono mt-0.5">
                            <span className="font-semibold text-slate-700">ITS: {r.its || "—"}</span>
                            <span>•</span>
                            <span className="truncate">{r.designationOrClass || "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wide shrink-0 shadow-2xs ${badgeInfo.bg}`}
                      >
                        <StatusIcon className="w-3 h-3 shrink-0" />
                        <span>{badgeInfo.label}</span>
                      </span>
                    </div>

                    {/* Schedule Window Time Sync Strip */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div className="truncate">
                          <span className="font-extrabold text-slate-900 text-[11px]">{r.scheduledEvent?.name || "Tilawat al Dua"}: </span>
                          <span className="font-mono text-[10.5px] font-bold text-slate-600">{r.scheduledEvent?.timeWindow || "07:00 - 12:30 IST"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                          r.scheduledEvent?.audience === "BOTH"
                            ? "bg-purple-100 text-purple-900 border border-purple-300"
                            : r.scheduledEvent?.audience === "FACULTY"
                            ? "bg-blue-100 text-blue-900 border border-blue-300"
                            : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        }`}>
                          {r.scheduledEvent?.audience === "BOTH" ? "Dual" : r.scheduledEvent?.audience === "FACULTY" ? "Faculty" : "Student"}
                        </span>
                        {hasScan && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            Synced
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Exact Scan Timestamp & Verification Mode (rendered only when punch exists) */}
                    {hasScan && (
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                        <div>
                          <div className="text-[10px] font-bold uppercase text-slate-400">Exact Scan Time (IST)</div>
                          <div className="mt-0.5 flex flex-col">
                            <span className="inline-flex items-center gap-1 font-mono font-black text-emerald-800 text-[11.5px]">
                              <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                              {formatScanTimeIST(r.checkInTime)}
                            </span>
                            <span className="text-[9.5px] font-medium text-slate-500">
                              {formatRelative(r.checkInTime)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold uppercase text-slate-400">Terminal &amp; Mode</div>
                          <div className="mt-0.5 flex flex-col">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 truncate">
                              <Fingerprint className="w-3 h-3 text-emerald-600 shrink-0" />
                              {r.biometricMethod === "FACIAL" ? "Facial Scan" : "Biometric Scan"}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-mono truncate">
                              {r.remarks?.includes("192.168.0.11")
                                ? "Terminal 3 (192.168.0.11)"
                                : r.remarks?.includes("192.168.0.5")
                                ? "Secondary (192.168.0.5)"
                                : "Main MinMoe (192.168.0.4)"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer Row: Hijri Date & Action Button */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {hijri.day} {hijri.monthNameShort} {hijri.year}H
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenOverride(r)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-xs min-h-[38px] touch-manipulation active:scale-[0.97] ${
                            isFacultyMember
                              ? "text-indigo-900 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300"
                              : "text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300"
                          }`}
                          title={`Direct Attendance Override for ${r.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5 shrink-0" />
                          <span>⚡ Override</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMemberClick(r.memberId, r.role, false)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer min-h-[38px] touch-manipulation active:scale-[0.97]"
                        >
                          <span>Audit / Logs</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP VIEW: High-Density Tabular Display (Visible on lg+) ── */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-black text-[10.5px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-center w-12">Photo</th>
                    <th
                      scope="col"
                      onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Click to sort by name"
                    >
                      <div className="flex items-center gap-1">
                        <span>Member Name &amp; Role</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono">ITS / ID</th>
                    <th
                      scope="col"
                      onClick={() => setSortBy("class")}
                      className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Click to sort by class"
                    >
                      <div className="flex items-center gap-1">
                        <span>Class / Dept</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3">Schedule Window &amp; Sync</th>
                    <th
                      scope="col"
                      onClick={() => setSortBy(sortBy === "time-desc" ? "time-asc" : "time-desc")}
                      className="px-4 py-3 text-center bg-emerald-50/60 border-x border-emerald-100 cursor-pointer hover:bg-emerald-100/60 transition-colors"
                      title="Click to sort by exact scan time"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Exact Scan Time (IST)</span>
                        <ArrowUpDown className="w-3 h-3 text-emerald-700" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3">Biometric Mode</th>
                    <th scope="col" className="px-3 py-3">Device / Terminal</th>
                    <th
                      scope="col"
                      onClick={() => setSortBy("status")}
                      className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Click to sort by status"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {displayRecords.map((r, i) => {
                    const isFacultyMember = r.role === "FACULTY";
                    const hasScan = Boolean(r.checkInTime);
                    const hijri = getHijriFromDate(r.checkInTime || date);
                    const badgeInfo = getStatusBadge(r.status, hasScan);

                    return (
                      <tr
                        key={r.id || r.memberId || i}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Photo */}
                        <td className="px-3 py-2.5 text-center">
                          <Avatar className="w-9 h-9 mx-auto rounded-xl border border-slate-200 shadow-2xs">
                            <AvatarImage src={r.avatarUrl || undefined} />
                            <AvatarFallback
                              className={`text-[10px] font-black ${
                                isFacultyMember ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
                              }`}
                            >
                              {getInitials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                        </td>

                        {/* Name & Role */}
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{r.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                                isFacultyMember
                                  ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {isFacultyMember ? "Faculty" : "Student"}
                            </span>
                          </div>
                        </td>

                        {/* ITS / ID */}
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-700">
                          {r.its || "—"}
                        </td>

                        {/* Class / Department */}
                        <td className="px-3 py-2.5 text-slate-600">
                          <div className="font-semibold text-slate-800">{r.designationOrClass || "—"}</div>
                          <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                            {hijri.day} {hijri.monthNameShort}
                          </div>
                        </td>

                        {/* Schedule Window & Time Sync */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-slate-900 text-[11px] truncate">
                                {r.scheduledEvent?.name || "Tilawat al Dua"}
                              </span>
                              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                r.scheduledEvent?.audience === "BOTH"
                                  ? "bg-purple-100 text-purple-900 border-purple-300"
                                  : r.scheduledEvent?.audience === "FACULTY"
                                  ? "bg-blue-100 text-blue-900 border-blue-300"
                                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
                              }`}>
                                {r.scheduledEvent?.audience === "BOTH" ? "Dual" : r.scheduledEvent?.audience === "FACULTY" ? "Faculty" : "Student"}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-600 mt-0.5">
                              {r.scheduledEvent?.timeWindow || "07:00 - 12:30 IST"}
                            </span>
                            {hasScan && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Synced (In-Window)
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Exact Scan Time (IST) - PROMINENT DISPLAY */}
                        <td className="px-4 py-2.5 text-center bg-emerald-50/30 border-x border-emerald-100/60">
                          {hasScan ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-mono shadow-xs whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                                <span>{formatScanTimeIST(r.checkInTime)}</span>
                              </span>
                              <span className="text-[9.5px] font-semibold text-slate-500 mt-1">
                                {formatRelative(r.checkInTime)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-sm select-none">—</span>
                          )}
                        </td>

                        {/* Biometric Mode */}
                        <td className="px-3 py-2.5 text-center">
                          {hasScan ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs whitespace-nowrap">
                              <Fingerprint className="w-3 h-3 text-emerald-600" />
                              <span>{r.biometricMethod === "FACIAL" ? "Facial Recognition" : "Biometric Scan"}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-sm select-none">—</span>
                          )}
                        </td>

                        {/* Device / Terminal */}
                        <td className="px-3 py-2.5 text-[11px] text-slate-600 font-mono">
                          {hasScan ? (
                            <>
                              <div className="font-bold text-slate-800 truncate">
                                {r.remarks?.includes("192.168.0.11")
                                  ? "Terminal 3"
                                  : r.remarks?.includes("192.168.0.5")
                                  ? "Secondary Terminal"
                                  : "Main Entrance MinMoe"}
                              </div>
                              <div className="text-[9.5px] text-slate-400">
                                {r.remarks?.includes("192.168.0.11")
                                  ? "192.168.0.11"
                                  : r.remarks?.includes("192.168.0.5")
                                  ? "192.168.0.5"
                                  : "192.168.0.4"}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-300 font-mono text-sm select-none">—</span>
                          )}
                        </td>

                        {/* Attendance Status */}
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-black border tracking-wide shadow-2xs whitespace-nowrap ${badgeInfo.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dot}`} />
                            <span>{badgeInfo.label}</span>
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenOverride(r)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-black transition-all cursor-pointer shadow-2xs border ${
                                isFacultyMember
                                  ? "text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                                  : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                              }`}
                              title={`Direct Attendance Override for ${r.name}`}
                            >
                              <Edit3 className="w-3 h-3 shrink-0" />
                              <span>Override</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMemberClick(r.memberId, r.role, false)}
                              className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
                            >
                              View Logs
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Quick Override Modal for ALL Users (PWA / Mobile APK Optimized) ── */}
      {overrideModalOpen && overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className={`p-4 sm:p-5 text-white flex items-center justify-between ${
              overrideTarget.role === "FACULTY"
                ? "bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900"
                : "bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900"
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-11 h-11 rounded-2xl border-2 border-white/30 shrink-0 shadow-sm">
                  <AvatarImage src={overrideTarget.avatarUrl || undefined} />
                  <AvatarFallback className="bg-white/20 text-white font-black text-sm">
                    {getInitials(overrideTarget.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-sm sm:text-base text-white truncate">
                      {overrideTarget.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                      {overrideTarget.role === "FACULTY" ? "Faculty" : "Student"}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 font-mono mt-0.5 truncate">
                    ITS: {overrideTarget.its || "—"} · {overrideTarget.designationOrClass || "—"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitOverride} className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Date of Override:</span>
                <span className="font-mono font-black text-slate-900">{formatScanDateIST(date)} ({date})</span>
              </div>

              {/* Status Selector: Visual Differential Chips */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select New Attendance Status:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "PRESENT", label: "Present", color: "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30", unselected: "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100", dot: "bg-emerald-400" },
                    { id: "LATE", label: "Late", color: "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500/30", unselected: "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100", dot: "bg-amber-400" },
                    { id: "ABSENT", label: "Absent", color: "bg-rose-600 text-white border-rose-700 ring-2 ring-rose-500/30", unselected: "bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100", dot: "bg-rose-400" },
                    { id: "MEDICAL", label: "Medical", color: "bg-cyan-600 text-white border-cyan-700 ring-2 ring-cyan-500/30", unselected: "bg-cyan-50 text-cyan-900 border-cyan-200 hover:bg-cyan-100", dot: "bg-cyan-400" },
                    { id: "ON_LEAVE", label: "On Leave", color: "bg-purple-600 text-white border-purple-700 ring-2 ring-purple-500/30", unselected: "bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100", dot: "bg-purple-400" },
                    { id: "EXEMPT", label: "Exempt", color: "bg-slate-700 text-white border-slate-800 ring-2 ring-slate-500/30", unselected: "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200", dot: "bg-slate-400" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setOverrideStatus(s.id)}
                      className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer min-h-[44px] touch-manipulation active:scale-[0.98] ${
                        overrideStatus === s.id ? s.color : s.unselected
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Verification Method:
                  </label>
                  <select
                    value={overrideSource}
                    onChange={(e) => setOverrideSource(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[44px]"
                  >
                    <option value="MANUAL">Manual Admin Entry</option>
                    <option value="SCAN">Hardware Biometric Scan</option>
                    <option value="MEDICAL_LEAVE">Medical Exemption</option>
                    <option value="LEAVE_APPROVED">Approved Leave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Target Schedule Window:
                  </label>
                  <div className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 truncate min-h-[44px] flex items-center">
                    {overrideTarget.scheduledEvent?.name || "Tilawat al Dua"} ({overrideTarget.scheduledEvent?.timeWindow || "07:00 - 12:30 IST"})
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Reason / Audit Remarks:
                </label>
                <input
                  type="text"
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  placeholder="e.g. Scanned late due to transport delay, official seminar, or verified arrival"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[44px]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all min-h-[46px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOverride}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 hover:from-emerald-700 hover:to-teal-900 text-white text-xs font-black shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-2 min-h-[46px] cursor-pointer disabled:opacity-50"
                >
                  {savingOverride ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Saving Override...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-emerald-200" />
                      <span>Save Status Override</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Student / Faculty Drawer ── */}
      {selectedMember && drawerOpen && (
        <DayDetailDrawer
          studentId={selectedMember.role === "STUDENT" ? selectedMember.id : undefined}
          teacherId={selectedMember.role === "FACULTY" ? selectedMember.id : undefined}
          role={selectedMember.role}
          targetDate={date}
          initialOverrideOpen={selectedMember.openOverride || false}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedMember(null);
          }}
          onOverrideSuccess={() => {
            loadAttendance(true);
          }}
        />
      )}
    </div>
  );
}
