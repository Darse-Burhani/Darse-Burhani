"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import {
  Users,
  School,
  Activity,
  Award,
  TrendingUp,
  Clock,
  BookOpen,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Wifi,
  Heart,
  UserCheck,
  Link2,
  Unlink,
  RefreshCw,
  Fingerprint,
  ClipboardList,
  CalendarDays,
  Layers,
  ShieldCheck,
  Megaphone,
  ArrowUpRight,
  ShoppingBag,
  X,
} from "lucide-react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

import { ExecutiveFatimiHeader } from "@/components/admin/ExecutiveFatimiHeader";
import { ExecutiveSheetSyncBar } from "@/components/admin/ExecutiveSheetSyncBar";
import {
  ExecutiveOperationalBento,
  UrgentLeaveItem,
  BadalItem,
} from "@/components/admin/ExecutiveOperationalBento";
import { getAdminLeaves, getSheetSyncStatus, SheetSyncStatusData } from "@/lib/api";

const ChartSection = lazy(() => import("@/components/admin/ChartSection"));

function StatSkeleton() {
  return (
    <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/10 animate-pulse">
      <div className="bg-white rounded-[calc(1rem-2px)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-200" />
          <div className="w-16 h-5 rounded-full bg-gray-200" />
        </div>
        <div className="w-24 h-4 rounded bg-gray-200 mb-2" />
        <div className="w-16 h-7 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/10 animate-pulse">
      <div className="bg-white rounded-2xl p-6">
        <div className="w-40 h-5 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [monitoring, setMonitoring] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [activeWindow, setActiveWindow] = useState<any | null>(null);
  const [urgentLeaves, setUrgentLeaves] = useState<UrgentLeaveItem[]>([]);
  const [badals, setBadals] = useState<BadalItem[]>([]);
  const [sheetStatus, setSheetStatus] = useState<SheetSyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<boolean>(false);

  const fetchData = async () => {
    setError(null);
    setDismissedAlerts(false);
    try {
      const todayStr = new Date().toISOString().split("T")[0];

      const [
        monitoringSettled,
        statsSettled,
        windowsSettled,
        leavesSettled,
        badalsSettled,
        sheetStatusSettled,
      ] = await Promise.allSettled([
        fetch("/api/admin/monitoring").then(async (r) => {
          const json = await r.json().catch(() => null);
          if (!r.ok || !json?.success) {
            throw new Error(json?.error || `Monitoring feed returned HTTP ${r.status}`);
          }
          return json;
        }),
        fetch("/api/admin/stats").then(async (r) => {
          const json = await r.json().catch(() => null);
          if (!r.ok || !json?.success) {
            throw new Error(json?.error || `Stats telemetry returned HTTP ${r.status}`);
          }
          return json;
        }),
        fetch("/api/admin/attendance/schedule/windows").then(async (r) => {
          if (!r.ok) return null;
          const json = await r.json().catch(() => null);
          return json?.data || json?.windows || (Array.isArray(json) ? json : null);
        }),
        getAdminLeaves({ status: "PENDING", limit: 5 }).catch(() => null),
        fetch(`/api/admin/timetable/badal?date=${todayStr}`).then(async (r) => {
          if (!r.ok) return null;
          const json = await r.json().catch(() => null);
          return json?.data || (Array.isArray(json) ? json : null);
        }),
        getSheetSyncStatus().catch(() => null),
      ]);

      if (monitoringSettled.status === "fulfilled" && monitoringSettled.value?.success) {
        setMonitoring(monitoringSettled.value.data);
      } else {
        const reason =
          monitoringSettled.status === "rejected"
            ? monitoringSettled.reason?.message
            : "Failed to load monitoring feed";
        throw new Error(reason);
      }

      if (statsSettled.status === "fulfilled" && statsSettled.value?.success) {
        setStats(statsSettled.value.data);
      }

      if (windowsSettled.status === "fulfilled" && windowsSettled.value) {
        const wins = windowsSettled.value;
        if (Array.isArray(wins)) {
          const currentWin =
            wins.find((w: any) => w.status === "ACTIVE" && w.enabled !== false) ||
            wins.find((w: any) => w.status === "UPCOMING" && w.enabled !== false) ||
            wins[0] ||
            null;
          setActiveWindow(currentWin);
        }
      }

      if (leavesSettled.status === "fulfilled" && leavesSettled.value) {
        const requests = leavesSettled.value.requests || [];
        const mapped: UrgentLeaveItem[] = requests.map((r: any) => {
          const startDateStr = r.startDate
            ? new Date(r.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "";
          const endDateStr = r.endDate
            ? new Date(r.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "";
          const dateRange = startDateStr === endDateStr ? startDateStr : `${startDateStr} - ${endDateStr}`;

          return {
            id: r.id,
            name: r.studentName || "Talabat Learner",
            its: r.its || null,
            role: "STUDENT" as const,
            gradeClass: r.grade
              ? `Darajah ${r.grade}${r.section ? ` (${r.section})` : ""}`
              : r.className || null,
            dateRange: dateRange || "Today",
            reason: r.reason || "Leave Request",
            submittedAt: r.createdAt
              ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Today",
            status: (r.status === "APPROVED" || r.status === "REJECTED" ? r.status : "PENDING") as
              | "PENDING"
              | "APPROVED"
              | "REJECTED",
          };
        });
        setUrgentLeaves(mapped);
      }

      if (badalsSettled.status === "fulfilled" && badalsSettled.value) {
        const rawBadals = badalsSettled.value;
        if (Array.isArray(rawBadals)) {
          const mapped: BadalItem[] = rawBadals.map((b: any) => ({
            id: b.id,
            period: b.period || 1,
            timeRange:
              b.startTime && b.endTime
                ? `${b.startTime} - ${b.endTime}`
                : `Period ${b.period || 1}`,
            className: b.className || "Class",
            subject: b.subject || "Subject",
            originalTeacherName: b.originalTeacherName || "Faculty Member",
            originalTeacherAvatar: b.originalTeacherAvatar || null,
            badalTeacherName: b.badalTeacherName || "Pending Assignment",
            badalTeacherAvatar: b.badalTeacherAvatar || null,
            status:
              b.isFulfilled || b.status === "FULFILLED" || b.status === "COMPLETED"
                ? "FULFILLED"
                : b.status === "CANCELLED"
                ? "CANCELLED"
                : "PENDING",
            reason: b.reason || "Duty Coverage",
          }));
          setBadals(mapped);
        }
      }

      if (sheetStatusSettled.status === "fulfilled" && sheetStatusSettled.value) {
        setSheetStatus(sheetStatusSettled.value);
      }
    } catch (err: any) {
      console.error("Admin dashboard fetch error:", err);
      setError(
        err?.message ||
          "Failed to communicate with server telemetry. Please verify connection and retry."
      );
    }
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  };

  const o = monitoring?.overview;

  const statCards = o
    ? [
        {
          title: "Total Talabat",
          value: o.totalStudents.toLocaleString(),
          change: "Directory",
          icon: Users,
          iconBg: "bg-amber-400/10 text-amber-700 ring-1 ring-amber-400/25",
          href: "/admin/students",
          subtitle: "Registered learners",
        },
        {
          title: "Active Faculty",
          value: o.activeTeachers.toString(),
          change: "Staff",
          icon: School,
          iconBg: "bg-amber-400/10 text-amber-700 ring-1 ring-amber-400/25",
          href: "/admin/users",
          subtitle: "Teachers & staff",
        },
        {
          title: "Attendance Rate",
          value: o.attendanceRate,
          change: `${o.presentToday} Present`,
          icon: Clock,
          iconBg: "bg-amber-400/10 text-amber-700 ring-1 ring-amber-400/25",
          href: "/admin/biometric",
          subtitle: "Today's scans",
        },
        {
          title: "Average Points",
          value: stats?.avgPoints ?? "—",
          change: "Conduct & Merits",
          icon: TrendingUp,
          iconBg: "bg-amber-400/10 text-amber-700 ring-1 ring-amber-400/25",
          href: "/admin/point-matrix",
          subtitle: "School average",
        },
        {
          title: "At-Risk Talabat",
          value: o.atRiskCount.toString(),
          change: o.atRiskCount > 0 ? "Review" : "All Clear",
          icon: AlertTriangle,
          iconBg:
            o.atRiskCount > 0
              ? "bg-red-500/10 text-red-600 ring-1 ring-red-500/25"
              : "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25",
          href: "/admin/tracking",
          subtitle: "Needs intervention",
        },
        {
          title: "Active Sessions",
          value: o.activeSessions.toString(),
          change: "Security",
          icon: Wifi,
          iconBg: "bg-stone-500/10 text-stone-700 ring-1 ring-stone-400/25",
          href: "/admin/security",
          subtitle: "Last 24h auth",
        },
      ]
    : [];

  const chartData = (monitoring?.pointsByCategory || []).reduce((acc: any[], p: any) => {
    const existing = acc.find((a) => a.category === p.category);
    if (existing) {
      if (p.actionType === "POSITIVE") existing.positive = p.totalPoints;
      else existing.negative = Math.abs(p.totalPoints);
    } else {
      acc.push({
        category: p.category,
        positive: p.actionType === "POSITIVE" ? p.totalPoints : 0,
        negative: p.actionType === "NEGATIVE" ? Math.abs(p.totalPoints) : 0,
      });
    }
    return acc;
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── 1. Fatimi Heritage Executive Header ── */}
      <ExecutiveFatimiHeader
        activeWindow={activeWindow}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* ── System Warning / Error Banner ── */}
      {(error || (!dismissedAlerts && monitoring?.systemAlerts?.length > 0)) && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15">
            <div
              className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-lg ${
                error
                  ? "border-red-200/90 bg-gradient-to-r from-red-50 via-rose-50/70 to-amber-50/40"
                  : "border-amber-200/90 bg-gradient-to-r from-amber-50 via-yellow-50/70 to-orange-50/40"
              }`}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  error
                    ? "bg-gradient-to-b from-red-500 to-rose-600"
                    : "bg-gradient-to-b from-amber-500 to-yellow-600"
                }`}
              />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border shadow-sm ${
                      error
                        ? "bg-red-100 text-red-600 border-red-200/70"
                        : "bg-amber-100 text-amber-700 border-amber-200/70"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-5 h-5 ${error ? "text-red-600 animate-pulse" : "text-amber-600"}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-bold tracking-tight ${
                          error ? "text-red-950" : "text-amber-950"
                        }`}
                      >
                        {error
                          ? "Telemetry Synchronization Notice"
                          : monitoring?.systemAlerts?.[0]?.title || "Subsystem Operational Alert"}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${
                          error
                            ? "bg-red-100/80 text-red-700 border-red-300"
                            : "bg-amber-100/80 text-amber-800 border-amber-300"
                        }`}
                      >
                        {error ? "Feed Offline" : "Action Needed"}
                      </Badge>
                    </div>
                    <p
                      className={`text-xs leading-relaxed max-w-2xl ${
                        error ? "text-red-800/90" : "text-amber-900/90"
                      }`}
                    >
                      {error || monitoring?.systemAlerts?.[0]?.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {monitoring?.systemAlerts?.[0]?.link && !error && (
                    <Link href={monitoring.systemAlerts[0].link}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold shadow-sm"
                      >
                        Inspect Terminals
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className={`h-9 rounded-xl bg-white text-xs font-semibold shadow-sm ${
                      error
                        ? "hover:bg-red-50 text-red-700 border-red-200"
                        : "hover:bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                    Re-sync Feed
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      if (error) setError(null);
                      else setDismissedAlerts(true);
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      error
                        ? "text-red-500 hover:text-red-700 hover:bg-red-100/60"
                        : "text-amber-400 hover:text-amber-700 hover:bg-amber-100/60"
                    }`}
                    title="Dismiss message"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── 2. Live Google Sheets Sync Status Bar ── */}
      <ExecutiveSheetSyncBar sheetStatus={sheetStatus} onSynced={fetchData} />

      {/* ── 3. Real-Time Operational Bento (Biometric Health, Leaves, Badal) ── */}
      <ExecutiveOperationalBento
        overview={monitoring?.overview}
        urgentLeaves={urgentLeaves}
        badals={badals}
        onDataChanged={fetchData}
      />

      {/* ── 4. Executive KPI Cards Strip ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          {statCards.map((stat) => (
            <Link key={stat.title} href={stat.href} className="block group">
              <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/10 h-full transition-all duration-300 group-hover:ring-amber-400/50 group-hover:shadow-lg group-hover:-translate-y-0.5">
                <div className="bg-white rounded-[calc(1rem-2px)] p-5 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${stat.iconBg}`}
                      >
                        <stat.icon className="w-4 h-4" strokeWidth={1.75} />
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-semibold shrink-0 px-2 py-0.5 bg-amber-50 text-amber-950 border-amber-300/80 group-hover:bg-amber-400 group-hover:text-stone-950 transition-colors"
                      >
                        {stat.change}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-black text-gray-900 mt-1 num-tabular font-display tracking-tight">
                      {stat.value}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-gray-100 text-xs font-semibold text-gray-500 group-hover:text-amber-800 transition-colors">
                    <span>{stat.subtitle}</span>
                    <div className="w-5 h-5 rounded-full bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                      <ArrowUpRight
                        className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                        strokeWidth={1.75}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </motion.div>
      )}

      {/* ── 5. The 4 Administrative Domain Command Hubs (All 18 Tools) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="h-7 w-1.5 rounded-full"
            style={{ background: "linear-gradient(180deg, #d4af37, #997b1e)" }}
          />
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-700" />
              Administrative Command Centers
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Direct access across core operations, curricula, community, and system governance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* ── HUB 1: Operations & Attendance ── */}
          <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm h-full flex flex-col">
            <div className="bg-white rounded-2xl p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 border border-amber-400/30"
                    style={{ background: "linear-gradient(135deg, #0d0d0d, #1c1813)" }}
                  >
                    <Fingerprint className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">
                      Attendance &amp; Operations
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Biometrics &amp; scanning</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/admin/biometric"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <Fingerprint className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-800">
                        Biometric Live Console
                      </p>
                      <p className="text-xs text-gray-500">Device terminals &amp; live logs</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/attendance-schedule"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-800">
                        Attendance Schedule
                      </p>
                      <p className="text-xs text-gray-500">Scan windows &amp; grace limits</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/tracking"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-800">
                        Individual Tracking
                      </p>
                      <p className="text-xs text-gray-500">Student attendance telemetry</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/procurement"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-800">
                        Procurement &amp; Supplies
                      </p>
                      <p className="text-xs text-gray-500">Faculty requisitions &amp; orders</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5 text-amber-800 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Terminals Online
                </span>
                <Link href="/admin/biometric" className="text-amber-700 hover:underline font-bold">
                  Live Feed &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* ── HUB 2: Academics & Takhteet ── */}
          <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm h-full flex flex-col">
            <div className="bg-white rounded-2xl p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 border border-amber-400/30"
                    style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}
                  >
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">
                      Academics &amp; Takhteet
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Syllabus &amp; programs</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/admin/classes"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-700">
                        Classes
                      </p>
                      <p className="text-xs text-gray-500">Darajah &amp; section enrollment</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/timetable"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <CalendarDays className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-700">
                        Timetable Matrix
                      </p>
                      <p className="text-xs text-gray-500">Weekly schedules &amp; periods</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/takhteet"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <ClipboardList className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-700">
                        Takhteet Curriculum
                      </p>
                      <p className="text-xs text-gray-500">Portion targets &amp; syllabus pace</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="text-amber-800 font-bold">Curriculum Syllabus</span>
                <Link href="/admin/classes" className="text-amber-700 hover:underline font-bold">
                  Manage &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* ── HUB 3: Talabat & Community ── */}
          <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm h-full flex flex-col">
            <div className="bg-white rounded-2xl p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 border border-amber-400/30"
                    style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)" }}
                  >
                    <Users className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">
                      Community &amp; People
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Talabat, faculty &amp; parents</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/admin/students"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-amber-800 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-900">
                        Talabat Directory
                      </p>
                      <p className="text-xs text-gray-500">Student profiles &amp; ITS info</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/parents"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-pink-700 group-hover:bg-pink-600 group-hover:text-white transition-colors shrink-0">
                      <Heart className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-900">
                        Parents Directory
                      </p>
                      <p className="text-xs text-gray-500">Guardians &amp; student links</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/users"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-amber-800 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-900">
                        Staff &amp; Users
                      </p>
                      <p className="text-xs text-gray-500">System logins &amp; credentials</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/portal-assignments"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-900">
                        Portal Assignments
                      </p>
                      <p className="text-xs text-gray-500">Teacher roles &amp; permissions</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="text-stone-800 font-bold">User Management</span>
                <Link href="/admin/users" className="text-stone-700 hover:underline font-bold">
                  Directory &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* ── HUB 4: Systems & Governance ── */}
          <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm h-full flex flex-col">
            <div className="bg-white rounded-2xl p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 border border-amber-400/30"
                    style={{ background: "linear-gradient(135deg, #161616, #221c15)" }}
                  >
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">
                      Systems &amp; Security
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Library, points &amp; governance</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/admin/library"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-stone-700 group-hover:bg-stone-700 group-hover:text-white transition-colors shrink-0">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-800">
                        Darse Burhani Library
                      </p>
                      <p className="text-xs text-gray-500">Catalog, circulation &amp; shelves</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/point-matrix"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-stone-700 group-hover:bg-stone-700 group-hover:text-white transition-colors shrink-0">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-800">
                        Conduct &amp; Merit Matrix
                      </p>
                      <p className="text-xs text-gray-500">Merit points, badges &amp; tiers</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/notifications"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-stone-700 group-hover:bg-stone-700 group-hover:text-white transition-colors shrink-0">
                      <Megaphone className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-800">
                        Broadcast Studio
                      </p>
                      <p className="text-xs text-gray-500">Push notices &amp; announcements</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/admin/security"
                    className="hub-tool-item group flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-100 text-stone-700 group-hover:bg-stone-700 group-hover:text-white transition-colors shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-stone-800">
                        Security &amp; Audit Logs
                      </p>
                      <p className="text-xs text-gray-500">Audit trails &amp; auth sessions</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="text-stone-800 font-bold">Governance</span>
                <Link href="/admin/settings" className="text-stone-700 hover:underline font-bold">
                  Portal Locks &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Analytics, Attendance Early Warning & System Activity ── */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Early Warning & Parent Linkage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 space-y-6"
        >
          {/* Section: At-Risk Early Warning */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm">
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200/60">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">
                      At-Risk Talabat Desk
                    </h3>
                  </div>
                  <Link
                    href="/admin/tracking"
                    className="text-xs text-red-600 hover:underline font-bold flex items-center gap-1"
                  >
                    Track <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {monitoring?.atRiskStudents?.length > 0 ? (
                  <div className="space-y-2.5">
                    {monitoring.atRiskStudents.map((s: any) => (
                      <Link
                        key={s.id}
                        href="/admin/tracking"
                        className="flex items-center gap-3 p-3 rounded-xl bg-red-50/60 border border-red-100 hover:border-red-300 transition-colors block"
                      >
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="bg-red-100 text-red-700 text-xs font-bold">
                            {getInitials(s.name.split(" ")[0], s.name.split(" ")[1] || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 font-medium">
                            Grade {s.grade}
                            {s.section} &bull; {new Date(s.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-200/80 text-red-800">
                          Attention
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2.5 border border-amber-200/60"
                      style={{ background: "linear-gradient(135deg, #fff8e7, #fef4dc)" }}
                    >
                      <ShieldCheck className="w-5 h-5 text-amber-700" />
                    </div>
                    <p className="text-xs font-bold text-gray-800">All Clear</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      No students flagged for academic or attendance risk this week
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: Parent Linkage */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm">
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-pink-50 text-pink-600 border border-pink-200/60">
                      <Heart className="w-4 h-4" />
                    </div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">Parent Linkage</h3>
                  </div>
                  <Link
                    href="/admin/parents"
                    className="text-xs text-pink-600 hover:underline font-bold flex items-center gap-1"
                  >
                    Manage <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {o ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-amber-800" />
                        <span className="text-xs text-gray-700 font-semibold">Linked to Parent</span>
                      </div>
                      <span className="text-xs font-bold text-amber-900 num-tabular">
                        {o.linkedStudents}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                      <div className="flex items-center gap-2">
                        <Unlink className="w-4 h-4 text-stone-600" />
                        <span className="text-xs text-gray-700 font-semibold">Unlinked Talabat</span>
                      </div>
                      <span className="text-xs font-bold text-stone-700 num-tabular">
                        {o.unlinkedStudents}
                      </span>
                    </div>

                    {o.unlinkedStudents > 0 && (
                      <Link href="/admin/parents" className="block pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl text-xs font-bold h-9"
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Remaining Families
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right Column: Conduct & Merit Points Chart, Top Performers, Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Section: Points by Category Chart */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm">
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                        Conduct &amp; Merit Points by Category (Last 30 Days)
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">
                        Distribution of positive vs corrective deeds
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/admin/point-matrix"
                    className="text-xs text-amber-700 hover:underline font-bold flex items-center gap-1"
                  >
                    Rules Matrix <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <Suspense fallback={<div className="h-[250px] bg-gray-100 animate-pulse rounded-xl" />}>
                  <ChartSection chartData={chartData} />
                </Suspense>
              </div>
            </div>
          )}

          {/* Section: Top Student Performers Podium */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm">
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                        Top Student Performers Podium
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">
                        Highest aggregate merits and conduct
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/admin/point-matrix"
                    className="text-xs text-amber-700 hover:underline font-bold flex items-center gap-1"
                  >
                    Points Matrix <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {monitoring?.topPerformers?.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    {monitoring.topPerformers.map((s: any, i: number) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 hover:border-amber-300 transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs"
                          style={{
                            background:
                              i === 0
                                ? "linear-gradient(135deg, #d4af37, #b8972e)"
                                : i === 1
                                ? "linear-gradient(135deg, #94a3b8, #64748b)"
                                : "linear-gradient(135deg, #c59b27, #78350f)",
                          }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">Talabat {i + 1}</p>
                          <p className="text-xs text-gray-500 font-medium">
                            Grade {s.grade}
                            {s.section}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-amber-700 num-tabular">
                            {s.points} pts
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-6 text-xs">
                    No student conduct records logged yet
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Section: Recent Activity & System Logs */}
          <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm">
            <div className="bg-white rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                      Recent Administrative Activity
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Live operational event feed</p>
                  </div>
                </div>
                <Link
                  href="/admin/security"
                  className="text-xs text-amber-700 hover:underline font-bold flex items-center gap-1"
                >
                  Audit Center <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="w-3/4 h-3 bg-gray-200 rounded" />
                        <div className="w-1/2 h-2.5 bg-gray-200 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentActivity?.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.recentActivity.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-amber-50/40 transition-colors border border-transparent hover:border-amber-200"
                    >
                      <Avatar className="w-8 h-8 shrink-0 ring-1 ring-gray-200">
                        <AvatarFallback className="bg-amber-100 text-amber-800 text-xs font-bold">
                          {getInitials(item.user.split(" ")[0], item.user.split(" ")[1] ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-900">
                          <span className="font-bold">{item.user}</span> {item.action}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-6 text-xs">No recent activity logged</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
