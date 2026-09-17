"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import {
  Users,
  School,
  Activity,
  Award,
  TrendingUp,
  Settings,
  Shield,
  Clock,
  BookOpen,
  BarChart3,
  ChevronRight,
  Sparkles,
  Zap,
  AlertTriangle,
  Wifi,
  Heart,
  UserCheck,
  Link2,
  Unlink,
  RefreshCw,
  Fingerprint,
  ClipboardList,
  Mail,
  CalendarDays,
  Layers,
  ShieldCheck,
  Megaphone,
  FileText,
  ArrowUpRight,
  CheckCircle2,
  SlidersHorizontal,
  GraduationCap,
  ShoppingBag,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const ChartSection = lazy(() => import("@/components/admin/ChartSection"));

function StatSkeleton() {
  return (
    <div className="p-1 rounded-[1.75rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 animate-pulse">
      <div className="bg-white rounded-[calc(1.75rem-0.25rem)] p-5">
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
    <div className="p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 animate-pulse">
      <div className="bg-white rounded-[calc(2rem-0.375rem)] p-6">
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

const tierColors: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-800 border-amber-300",
  SILVER: "bg-slate-100 text-slate-700 border-slate-300",
  GOLD: "bg-yellow-100 text-yellow-800 border-yellow-300",
  PLATINUM: "bg-indigo-100 text-indigo-800 border-indigo-300",
  DIAMOND: "bg-cyan-100 text-cyan-800 border-cyan-300",
};

export default function AdminDashboard() {
  const [monitoring, setMonitoring] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [pointRules, setPointRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<boolean>(false);

  const fetchData = async () => {
    setError(null);
    setDismissedAlerts(false);
    try {
      const [monitoringSettled, statsSettled, rulesSettled] = await Promise.allSettled([
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
        fetch("/api/admin/point-rules").then(async (r) => {
          const json = await r.json().catch(() => null);
          if (!r.ok || !json?.success) {
            throw new Error(json?.error || `Rules config returned HTTP ${r.status}`);
          }
          return json;
        }),
      ]);

      if (monitoringSettled.status === "fulfilled" && monitoringSettled.value?.success) {
        setMonitoring(monitoringSettled.value.data);
      } else {
        const reason = monitoringSettled.status === "rejected" ? monitoringSettled.reason?.message : "Failed to load monitoring feed";
        throw new Error(reason);
      }

      if (statsSettled.status === "fulfilled" && statsSettled.value?.success) {
        setStats(statsSettled.value.data);
      }
      if (rulesSettled.status === "fulfilled" && rulesSettled.value?.success) {
        setPointRules(rulesSettled.value.data.slice(0, 4));
      }
    } catch (err: any) {
      console.error("Admin dashboard fetch error:", err);
      setError(err?.message || "Failed to communicate with server telemetry. Please verify connection and retry.");
    }
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  };

  const handleOpenCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  };

  const o = monitoring?.overview;

  const statCards = o
    ? [
        {
          title: "Total Talabat",
          value: o.totalStudents.toLocaleString(),
          change: "Directory",
          icon: GraduationCap,
          iconBg: "bg-emerald-50 text-[#047857] border border-emerald-200/60",
          href: "/admin/students",
          subtitle: "Registered learners",
        },
        {
          title: "Active Faculty",
          value: o.activeTeachers.toString(),
          change: "Staff",
          icon: School,
          iconBg: "bg-amber-50 text-amber-800 border border-amber-200/60",
          href: "/admin/users",
          subtitle: "Teachers & staff",
        },
        {
          title: "Attendance Rate",
          value: o.attendanceRate,
          change: `${o.presentToday} Present`,
          icon: Clock,
          iconBg: "bg-emerald-50 text-[#047857] border border-emerald-200/60",
          href: "/admin/biometric",
          subtitle: "Today's scans",
        },
        {
          title: "Average Points",
          value: stats?.avgPoints ?? "—",
          change: "Conduct & Merits",
          icon: TrendingUp,
          iconBg: "bg-amber-50 text-amber-800 border border-amber-200/60",
          href: "/admin/point-matrix",
          subtitle: "School average",
        },
        {
          title: "At-Risk Talabat",
          value: o.atRiskCount.toString(),
          change: o.atRiskCount > 0 ? "Review" : "All Clear",
          icon: AlertTriangle,
          iconBg: o.atRiskCount > 0 ? "bg-red-50 text-red-600 border border-red-200/60" : "bg-emerald-50 text-[#047857] border border-emerald-200/60",
          href: "/admin/tracking",
          subtitle: "Needs intervention",
        },
        {
          title: "Active Sessions",
          value: o.activeSessions.toString(),
          change: "Security",
          icon: Wifi,
          iconBg: "bg-slate-50 text-slate-600 border border-slate-200/60",
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
      {/* ── 1. Executive Hero Banner (Doppelrand) ── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="p-1 sm:p-2 rounded-[2.5rem] bg-emerald-950/15 ring-1 ring-emerald-900/25 shadow-2xl">
          <div
            className="relative overflow-hidden rounded-[calc(2.5rem-0.375rem)] p-6 sm:p-8 text-white"
            style={{ background: "linear-gradient(135deg, #022c22 0%, #047857 55%, #065f46 100%)" }}
          >
            {/* Top glowing hairline */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shrink-0 border border-amber-300/40"
                  style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
                >
                  <Shield className="w-8 h-8 text-white fill-white/20" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 bg-black/25 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                      Command Center
                    </span>
                    <span className="text-xs text-emerald-200">
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Admin Executive Command
                  </h1>
                  <p className="text-emerald-100 text-xs sm:text-sm mt-0.5 font-medium">
                    School telemetry, biometrics, academic administration &amp; governance
                  </p>
                </div>
              </div>

              {/* Quick Action Dock */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleOpenCommandPalette}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition-all shadow-sm cursor-pointer"
                  title="Search or jump anywhere (⌘K / Ctrl+K)"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Command Menu</span>
                  <kbd className="px-2 py-0.5 rounded-md bg-black/30 text-[10px] font-mono font-bold text-amber-200 border border-white/20">
                    ⌘K
                  </kbd>
                </button>

                <Link href="/admin/settings">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-2xl text-xs font-semibold h-10 px-4"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                    Portal Locks
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="border-white/20 text-white hover:bg-white/10 rounded-2xl text-xs font-semibold h-10 px-4"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
                  Sync
                </Button>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-80" />
          </div>
        </div>
      </motion.div>

      {/* ── System Warning / Error Banner ── */}
      {(error || (!dismissedAlerts && monitoring?.systemAlerts?.length > 0)) && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <div className="p-1 rounded-[2rem] bg-amber-950/5 ring-1 ring-amber-900/15">
            <div
              className={`relative overflow-hidden rounded-[calc(2rem-0.25rem)] border p-4 sm:p-5 shadow-lg ${
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
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 border shadow-sm ${
                      error
                        ? "bg-red-100 text-red-600 border-red-200/70"
                        : "bg-amber-100 text-amber-700 border-amber-200/70"
                    }`}
                  >
                    <AlertTriangle className={`w-5 h-5 ${error ? "text-red-600 animate-pulse" : "text-amber-600"}`} />
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
                          : (monitoring?.systemAlerts?.[0]?.title || "Subsystem Operational Alert")}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
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
                        className="h-8 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold shadow-sm"
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
                    className={`h-8 rounded-xl bg-white text-xs font-semibold shadow-sm ${
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

      {/* ── Full-Page Recovery State ── */}
      {!o && !loading && error && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-1 sm:p-1.5 rounded-[2.5rem] bg-red-950/5 ring-1 ring-red-900/10 max-w-xl mx-auto"
        >
          <div className="rounded-[calc(2.5rem-0.375rem)] bg-white p-8 sm:p-10 text-center space-y-5 border border-red-200 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600 shadow-inner">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900 font-display">
                Unable to Load Executive Telemetry
              </h2>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                {error}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-[#022c22] hover:bg-[#047857] text-white rounded-2xl shadow-md text-xs font-semibold h-10 px-5"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Retry Synchronization
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="rounded-2xl border-gray-300 text-xs font-semibold h-10 px-5"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── 2. Real-Time Telemetry & Systems Strip (Doppelrand) ── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
          <div className="rounded-[calc(2rem-0.375rem)] p-4 bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/50 border border-emerald-200/50">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{ background: "linear-gradient(135deg, #022c22, #047857)" }}
                >
                  <Activity className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                    Operational Heartbeat &amp; Device Infrastructure
                  </h2>
                  <p className="text-xs text-gray-500">Live synchronization with campus terminals and databases</p>
                </div>
              </div>

              {/* Status Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href="/admin/biometric"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition-colors shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Biometrics Active
                </Link>

                <Link
                  href="/admin/attendance-schedule"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-100/90 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Scan Windows Set
                </Link>

                <Link
                  href="/admin/security"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition-colors shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  RBAC &amp; Audit Safe
                </Link>

                <Link
                  href="/admin/settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#fef3c7] text-[#92400e] border border-amber-200 hover:bg-amber-200 transition-colors shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#b45309]" />
                  Locks Guarded
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 3. Executive KPI Cards Strip ── */}
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
              <div className="p-1 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 h-full transition-all duration-300 group-hover:ring-amber-400/50 group-hover:shadow-md">
                <div className="bg-white rounded-[calc(2rem-0.25rem)] p-5 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className={`p-2.5 rounded-2xl shrink-0 ${stat.iconBg}`}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold shrink-0 px-2 py-0.5 bg-emerald-50 text-[#047857] border-emerald-200/60 group-hover:bg-[#047857] group-hover:text-white transition-colors"
                      >
                        {stat.change}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{stat.title}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1 num-tabular font-display tracking-tight">{stat.value}</p>
                  </div>
                  <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-gray-100 text-[11px] font-semibold text-gray-400 group-hover:text-[#047857] transition-colors">
                    <span>{stat.subtitle}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </motion.div>
      )}

      {/* ── 4. The 4 Administrative Domain Command Hubs (All 18 Tools) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="h-7 w-1.5 rounded-full"
            style={{ background: "linear-gradient(180deg, #d4af37, #047857)" }}
          />
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#047857]" />
              Administrative Command Centers
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Instant one-click access across all 18 core portals, curricula, and system controls
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* ── HUB 1: Operations & Attendance ── */}
          <div className="p-1 sm:p-1.5 rounded-[2.25rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
            <div className="bg-white rounded-[calc(2.25rem-0.375rem)] p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
                    style={{ background: "linear-gradient(135deg, #022c22, #047857)" }}
                  >
                    <Fingerprint className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">Attendance &amp; Operations</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Biometrics &amp; scanning</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link href="/admin/biometric" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-emerald-50 text-[#047857] group-hover:bg-[#047857] group-hover:text-white transition-colors shrink-0">
                      <Fingerprint className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-[#047857] truncate">
                        Biometric Live Console
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Device terminals &amp; live logs</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#047857] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/attendance-schedule" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-700 truncate">
                        Attendance Schedule
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Scan windows &amp; grace limits</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/attendance-emails" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                        Email Dispatcher
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Weekly &amp; monthly parent reports</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/tracking" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-purple-50 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-purple-700 truncate">
                        Individual Tracking
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Student attendance telemetry</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/procurement" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-teal-700 truncate">
                        Procurement &amp; Supplies
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Faculty requisitions &amp; fulfillment</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Terminals Online
                </span>
                <Link href="/admin/biometric" className="text-emerald-700 hover:underline font-bold">
                  Live Feed &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* ── HUB 2: Academics & Takhteet ── */}
          <div className="p-1 sm:p-1.5 rounded-[2.25rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
            <div className="bg-white rounded-[calc(2.25rem-0.375rem)] p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
                    style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}
                  >
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">Academics &amp; Takhteet</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Syllabus &amp; programs</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link href="/admin/classes" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-emerald-50 text-[#047857] group-hover:bg-[#047857] group-hover:text-white transition-colors shrink-0">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-[#047857] truncate">
                        Classes
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Darajah &amp; section enrollment</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#047857] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/timetable" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <CalendarDays className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-700 truncate">
                        Timetable Matrix
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Weekly schedules &amp; periods</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/hifz" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-emerald-700 truncate">
                        Quran &amp; Hifz Program
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Murajaat, jadeed &amp; sanad</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/takhteet" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                      <ClipboardList className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-indigo-700 truncate">
                        Takhteet Curriculum
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Portion targets &amp; syllabus pace</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span className="text-amber-800 font-bold">Curriculum Syllabus</span>
                <Link href="/admin/classes" className="text-amber-700 hover:underline font-bold">
                  Manage &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* ── HUB 3: Talabat & Community ── */}
          <div className="p-1 sm:p-1.5 rounded-[2.25rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
            <div className="bg-white rounded-[calc(2.25rem-0.375rem)] p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
                    style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)" }}
                  >
                    <GraduationCap className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">Community &amp; People</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Talabat, faculty &amp; parents</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link href="/admin/students" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-violet-50 text-violet-700 group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-violet-700 truncate">
                        Talabat Directory
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Student profiles &amp; ITS info</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-violet-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/parents" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                      <Heart className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-rose-700 truncate">
                        Parents Directory
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Guardians &amp; student links</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/users" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-emerald-50 text-[#047857] group-hover:bg-[#047857] group-hover:text-white transition-colors shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-[#047857] truncate">
                        Staff &amp; Users
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">System logins &amp; credentials</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#047857] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/portal-assignments" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-cyan-50 text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white transition-colors shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-cyan-700 truncate">
                        Portal Assignments
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Teacher roles &amp; permissions</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-cyan-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span className="text-indigo-800 font-bold">User Management</span>
                <Link href="/admin/users" className="text-indigo-700 hover:underline font-bold">
                  Directory &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* ── HUB 4: Systems & Governance ── */}
          <div className="p-1 sm:p-1.5 rounded-[2.25rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
            <div className="bg-white rounded-[calc(2.25rem-0.375rem)] p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-gray-100">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
                    style={{ background: "linear-gradient(135deg, #064e3b, #047857)" }}
                  >
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">Systems &amp; Security</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Library, points &amp; governance</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link href="/admin/library" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-amber-700 truncate">
                        Darse Burhani Library
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Catalog, circulation &amp; shelves</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/point-matrix" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-yellow-50 text-[#b8860b] group-hover:bg-[#b8860b] group-hover:text-white transition-colors shrink-0">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-[#b8860b] truncate">
                        Conduct &amp; Merit Matrix
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Merit points, badges &amp; tiers</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#b8860b] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/notifications" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                      <Megaphone className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-rose-700 truncate">
                        Broadcast Studio
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Push notices &amp; announcements</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link href="/admin/security" className="hub-tool-item group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-emerald-50 text-[#047857] group-hover:bg-[#047857] group-hover:text-white transition-colors shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-[#047857] truncate">
                        Security &amp; Audit Logs
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">Audit trails &amp; auth sessions</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#047857] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span className="text-emerald-800 font-bold">Governance</span>
                <Link href="/admin/settings" className="text-emerald-700 hover:underline font-bold">
                  Portal Locks &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Analytics, Attendance Telemetry & System Activity ── */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Attendance Telemetry & Early Warning Desk */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 space-y-6"
        >
          {/* Section: Attendance Today */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
              <div className="bg-white rounded-[calc(2rem-0.375rem)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-50 text-[#047857] border border-emerald-200/60">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">Today's Attendance</h3>
                  </div>
                  <Link
                    href="/admin/biometric"
                    className="text-xs text-[#047857] hover:underline font-bold flex items-center gap-1"
                  >
                    Live Logs <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {o && o.totalAttendanceRecords > 0 ? (
                  <div className="space-y-4">
                    <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
                      {o.presentToday > 0 && (
                        <div
                          className="bg-[#047857] transition-all"
                          style={{ width: `${(o.presentToday / o.totalAttendanceRecords) * 100}%` }}
                        />
                      )}
                      {o.lateToday > 0 && (
                        <div
                          className="bg-amber-500 transition-all"
                          style={{ width: `${(o.lateToday / o.totalAttendanceRecords) * 100}%` }}
                        />
                      )}
                      {o.earlyDepartureToday > 0 && (
                        <div
                          className="bg-orange-500 transition-all"
                          style={{ width: `${(o.earlyDepartureToday / o.totalAttendanceRecords) * 100}%` }}
                        />
                      )}
                      {o.absentToday > 0 && (
                        <div
                          className="bg-red-500 transition-all"
                          style={{ width: `${(o.absentToday / o.totalAttendanceRecords) * 100}%` }}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { label: "Present", count: o.presentToday, color: "bg-[#047857]" },
                        { label: "Late Arrivals", count: o.lateToday, color: "bg-amber-500" },
                        { label: "Absent", count: o.absentToday, color: "bg-red-500" },
                        { label: "Early Departures", count: o.earlyDepartureToday, color: "bg-orange-500" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                          <div className={`w-2 h-2 rounded-full ${item.color}`} />
                          <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                          <span className="text-xs font-bold text-gray-900 ml-auto num-tabular">{item.count}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Overall Campus Turnout</span>
                      <span className="font-bold text-[#047857] text-sm num-tabular">{o.attendanceRate}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    No attendance records clocked yet today.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: At-Risk Early Warning */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
              <div className="bg-white rounded-[calc(2rem-0.375rem)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200/60">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h3 className="font-display font-bold text-gray-900 text-sm">At-Risk Talabat Desk</h3>
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
                        className="flex items-center gap-3 p-3 rounded-2xl bg-red-50/60 border border-red-100 hover:border-red-300 transition-colors block"
                      >
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="bg-red-100 text-red-700 text-xs font-bold">
                            {getInitials(s.name.split(" ")[0], s.name.split(" ")[1] || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                          <p className="text-[11px] text-gray-500 font-medium">
                            Grade {s.grade}
                            {s.section} &bull; {new Date(s.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-200/80 text-red-800">
                          Attention
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2.5"
                      style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)" }}
                    >
                      <ShieldCheck className="w-5 h-5 text-[#047857]" />
                    </div>
                    <p className="text-xs font-bold text-gray-800">All Clear</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">No students flagged for academic or attendance risk this week</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: Parent Linkage */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
              <div className="bg-white rounded-[calc(2rem-0.375rem)] p-6">
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
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#047857]" />
                        <span className="text-xs text-gray-700 font-semibold">Linked to Parent</span>
                      </div>
                      <span className="text-xs font-bold text-[#047857] num-tabular">{o.linkedStudents}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
                      <div className="flex items-center gap-2">
                        <Unlink className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-gray-700 font-semibold">Unlinked Talabat</span>
                      </div>
                      <span className="text-xs font-bold text-amber-700 num-tabular">{o.unlinkedStudents}</span>
                    </div>

                    {o.unlinkedStudents > 0 && (
                      <Link href="/admin/parents" className="block pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 rounded-2xl text-xs font-bold h-9"
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
            <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
              <div className="bg-white rounded-[calc(2rem-0.375rem)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 text-[#047857] border border-emerald-200/60">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                        Conduct &amp; Merit Points by Category (Last 30 Days)
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">Distribution of positive vs corrective deeds</p>
                    </div>
                  </div>
                  <Link
                    href="/admin/point-matrix"
                    className="text-xs text-[#047857] hover:underline font-bold flex items-center gap-1"
                  >
                    Rules Matrix <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <Suspense fallback={<div className="h-[250px] bg-gray-100 animate-pulse rounded-2xl" />}>
                  <ChartSection chartData={chartData} />
                </Suspense>
              </div>
            </div>
          )}

          {/* Section: Top Student Performers Podium */}
          {loading ? (
            <SectionSkeleton />
          ) : (
            <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
              <div className="bg-white rounded-[calc(2rem-0.375rem)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-50 text-[#b8860b] border border-amber-200/60">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                        Top Student Performers Podium
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">Highest aggregate merits and conduct</p>
                    </div>
                  </div>
                  <Link
                    href="/admin/point-matrix"
                    className="text-xs text-[#b8860b] hover:underline font-bold flex items-center gap-1"
                  >
                    Points Matrix <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {monitoring?.topPerformers?.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    {monitoring.topPerformers.map((s: any, i: number) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-amber-300 transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs"
                          style={{
                            background:
                              i === 0
                                ? "linear-gradient(135deg, #d4af37, #b8860b)"
                                : i === 1
                                ? "linear-gradient(135deg, #94a3b8, #64748b)"
                                : "linear-gradient(135deg, #047857, #064e3b)",
                          }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">Talabat {i + 1}</p>
                          <p className="text-[11px] text-gray-500 font-medium">
                            Grade {s.grade}
                            {s.section}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-[#b8860b] num-tabular">{s.points} pts</p>
                          <Badge className={`text-[9px] font-bold border ${tierColors[s.tier] || "bg-gray-100 text-gray-600"}`}>
                            {s.tier}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-6 text-xs">No student conduct records logged yet</p>
                )}
              </div>
            </div>
          )}

          {/* Section: Recent Activity & System Logs */}
          <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
            <div className="bg-white rounded-[calc(2rem-0.375rem)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-[#047857] border border-emerald-200/60">
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
                  className="text-xs text-[#047857] hover:underline font-bold flex items-center gap-1"
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
                      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-emerald-50/40 transition-colors border border-transparent hover:border-emerald-100"
                    >
                      <Avatar className="w-8 h-8 shrink-0 ring-1 ring-gray-200">
                        <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-bold">
                          {getInitials(item.user.split(" ")[0], item.user.split(" ")[1] ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-900">
                          <span className="font-bold">{item.user}</span> {item.action}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-medium">{item.detail}</p>
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
