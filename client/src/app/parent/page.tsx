"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Clock,
  Award,
  TrendingUp,
  ChevronRight,
  Shield,
  Activity,
  CheckCircle2,
  Calendar,
  CalendarDays,
  Sparkles,
  BookOpen,
  Users,
  GraduationCap,
  Droplet,
  Copy,
  Check,
  RefreshCw,
  Crown,
  Flame,
  Star,
  MapPin,
  FileText,
  Navigation,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials, timeAgo, formatPoints } from "@/lib/utils";
import { ParentNotificationCenter } from "@/components/parent/ParentNotificationCenter";
import { ParentLeaveManager } from "@/components/parent/ParentLeaveManager";

type ParentTab = "overview" | "tracking" | "leave" | "hifz";

const TABS: Array<{ id: ParentTab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: Heart },
  { id: "tracking", label: "Talabat Tracking", icon: Navigation },
  { id: "leave", label: "Leave Applications", icon: CalendarDays },
  { id: "hifz", label: "Hifz & Merits", icon: BookOpen },
];

const activityIcons: Record<string, any> = {
  POINTS: Award,
  ATTENDANCE: Clock,
};

export default function ParentDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ParentTab>("overview");
  const [trackingLogs, setTrackingLogs] = useState<any[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const fetchDashboard = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const res = await fetch("/api/parent/dashboard");
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          if (!selectedChildId && json.data.children?.length > 0) {
            setSelectedChildId(json.data.children[0].id);
          }
          if (isManual) {
            toast({ variant: "default", title: "Refreshed", description: "Parent portal data is up to date." });
          }
        }
      } catch {
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [selectedChildId]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const children: any[] = useMemo(() => data?.children || [], [data]);
  const parentProfile = data?.parent;

  const selectedChild = useMemo(() => {
    if (!children.length) return null;
    return children.find((c) => c.id === selectedChildId) || children[0];
  }, [children, selectedChildId]);

  // ── Tracking feed for the selected child (attendance scans) ──
  const fetchTracking = useCallback(async () => {
    if (!selectedChild) return;
    setTrackingLoading(true);
    try {
      const res = await fetch(
        `/api/parent/activity?childId=${encodeURIComponent(selectedChild.studentProfileId || selectedChild.id)}&limit=30`
      );
      const json = await res.json();
      if (json.success && json.data) {
        const acts = Array.isArray(json.data) ? json.data : json.data.activities || [];
        setTrackingLogs(acts.filter((a: any) => a.type === "ATTENDANCE"));
      }
    } catch {
    } finally {
      setTrackingLoading(false);
    }
  }, [selectedChild]);

  useEffect(() => {
    if (activeTab === "tracking") fetchTracking();
  }, [activeTab, fetchTracking]);

  // Last-7-days strip derived from tracking scans
  const weekStrip = useMemo(() => {
    const days: Array<{ date: Date; label: string; present: boolean; time: string | null }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d.getTime() + 86400000);
      const match = trackingLogs.find((a: any) => {
        const t = new Date(a.createdAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      days.push({
        date: d,
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        present: !!match,
        time: match?.checkInTime
          ? new Date(match.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : null,
      });
    }
    return days;
  }, [trackingLogs]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast({ variant: "default", title: "Copied", description: `${label} copied to clipboard.` });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const leaveChildren = useMemo(
    () =>
      children.map((c: any) => ({
        studentProfileId: c.studentProfileId,
        firstName: c.firstName,
        lastName: c.lastName,
        grade: c.grade,
        its: c.its,
      })),
    [children]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ═══ Compact hero ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-[1.75rem] p-5 text-white shadow-xl sm:p-7"
          style={{ background: "linear-gradient(135deg, #022c22 0%, #047857 55%, #065f46 100%)" }}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 opacity-10">
            <svg viewBox="0 0 100 100" className="h-full w-full fill-amber-300">
              <polygon points="50,0 63,38 100,50 63,62 50,100 37,62 0,50 37,38" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/40 shadow-lg"
                style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}>
                <Heart className="h-7 w-7 fill-white/20 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-300/30 bg-black/25 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-widest text-amber-300">
                    Parent Guardian Portal
                  </span>
                  <span className="text-[12px] text-emerald-200">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white sm:text-[1.7rem]">
                  Salam, {parentProfile?.firstName || "Parent"}!
                </h1>
                <p className="mt-0.5 text-[13px] font-medium text-emerald-100">
                  {children.length} {children.length === 1 ? "talabat assigned" : "talabat assigned"} · live campus tracking, leave & Hifz below.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ParentNotificationCenter
                childrenList={children}
                onChildSelect={(cId) => setSelectedChildId(cId)}
                onRefreshData={() => fetchDashboard(false)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDashboard(true)}
                disabled={refreshing || loading}
                className="h-10 gap-1.5 rounded-2xl border-white/25 bg-white/10 px-4 text-xs font-semibold text-white shadow-sm hover:bg-white/20"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-90" />
        </div>
      </motion.div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl border border-emerald-100 bg-white p-4" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-3xl border border-emerald-100 bg-white" />
        </div>
      ) : children.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-[1.75rem] border-2 border-dashed border-emerald-200 bg-emerald-50/20 p-10 text-center">
            <CardContent className="mx-auto max-w-md space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-800 shadow-inner">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-gray-900">No Talabat Assigned Yet</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                  Your parent account is registered, but no students are linked yet.
                </p>
              </div>
              <div className="space-y-2 rounded-2xl border border-emerald-100 bg-white p-4 text-left text-xs text-gray-600 shadow-xs">
                <p className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <Shield className="h-3.5 w-3.5 text-[#d4af37]" /> How to link your children:
                </p>
                <p>1. Share your registered ITS ID (<b>{parentProfile?.its || "—"}</b>) with the Darse Burhani admin.</p>
                <p>2. The admin links your children to your family account.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* ═══ Child switcher ═══ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-gray-900">
                <GraduationCap className="h-4 w-4 text-[#047857]" />
                My Children ({children.length})
              </h2>
              <span className="hidden text-xs font-medium text-gray-500 sm:block">Select a child to track</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => {
                const isSelected = selectedChild?.id === child.id;
                const isHafiz = child.status === "HAFIZ";
                return (
                  <motion.button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className={`w-full rounded-[1.4rem] p-3 text-left transition-all ${
                      isSelected
                        ? "bg-emerald-700 text-white shadow-lg ring-2 ring-emerald-500"
                        : "border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className={`h-12 w-12 shrink-0 rounded-xl border-2 ${isHafiz ? "border-amber-400" : "border-white/40"}`}>
                        {child.avatarUrl ? (
                          <AvatarImage src={child.avatarUrl} alt={child.firstName} loading="lazy" decoding="async" />
                        ) : null}
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-[#047857] to-[#064e3b] text-sm font-black text-white">
                          {getInitials(child.firstName, child.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className={`flex items-center gap-1.5 truncate text-[14.5px] font-extrabold ${isSelected ? "text-white" : "text-gray-900"}`}>
                          {child.firstName} {child.lastName}
                          {isHafiz && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                        </p>
                        <p className={`font-mono text-[12px] font-semibold ${isSelected ? "text-emerald-100" : "text-emerald-800"}`}>
                          ITS: {child.its} · Gr {child.grade}{child.section ? `-${child.section}` : ""}
                        </p>
                        <p className={`mt-0.5 flex items-center gap-1.5 text-[11.5px] font-bold ${child.isCheckedIn ? (isSelected ? "text-emerald-200" : "text-emerald-700") : isSelected ? "text-white/70" : "text-gray-400"}`}>
                          <span className={`h-2 w-2 rounded-full ${child.isCheckedIn ? "animate-pulse bg-emerald-400" : "bg-gray-300"}`} />
                          {child.isCheckedIn ? "On campus now" : "Not checked in today"}
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-200" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ═══ Tabs ═══ */}
          <div className="sticky top-0 z-20 -mx-1 bg-gradient-to-b from-[#f4f6f5] via-[#f4f6f5]/95 to-transparent px-1 pb-2 pt-1">
            <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {TABS.map((t) => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-[13px] font-bold transition active:scale-[0.98] ${
                      active ? "bg-emerald-700 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={15} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedChild && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedChild.id}-${activeTab}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "overview" && (
                  <div className="space-y-5">
                    {/* Live safety banner */}
                    <div className={`flex flex-col gap-4 rounded-[1.4rem] border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${
                      selectedChild.isCheckedIn ? "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50/50" : "border-slate-200 bg-white"
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                          selectedChild.isCheckedIn ? "bg-emerald-600 text-white ring-4 ring-emerald-200" : "border border-slate-200 bg-slate-100 text-slate-400"
                        }`}>
                          {selectedChild.isCheckedIn ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
                        </div>
                        <div>
                          <Badge className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${selectedChild.isCheckedIn ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                            {selectedChild.isCheckedIn ? "Checked in on campus" : "Awaiting arrival"}
                          </Badge>
                          <h3 className="mt-1 font-display text-lg font-extrabold leading-tight text-gray-900">
                            {selectedChild.isCheckedIn
                              ? `${selectedChild.firstName} is safely at Darse Burhani`
                              : `No scan recorded for ${selectedChild.firstName} today`}
                          </h3>
                          <p className="mt-0.5 text-[12.5px] text-gray-500">
                            {selectedChild.lastCheckIn ? (
                              <>Arrival {new Date(selectedChild.lastCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Gate {selectedChild.gate || "Main Gate"}</>
                            ) : (
                              "Live biometric scans appear here the moment your child checks in."
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <div className="min-w-[96px] rounded-2xl border border-slate-200 bg-white p-3 text-center">
                          <span className="block text-[10px] font-bold uppercase text-gray-400">7-day rate</span>
                          <span className="text-base font-extrabold text-[#047857]">{selectedChild.attendanceRateLast7 ?? 100}%</span>
                        </div>
                        <div className="min-w-[96px] rounded-2xl border border-slate-200 bg-white p-3 text-center">
                          <span className="block text-[10px] font-bold uppercase text-gray-400">Streak</span>
                          <span className="flex items-center justify-center gap-1 text-base font-extrabold text-amber-700">
                            <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />{selectedChild.streakDays || 0}d
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { label: "Today's merits", value: `+${selectedChild.pointsToday || 0}`, icon: TrendingUp, box: "bg-amber-50 text-amber-700 border-amber-200" },
                        { label: "Total points", value: formatPoints(selectedChild.currentPoints || 0), icon: Award, box: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                        { label: "Tier", value: selectedChild.tier || "BRONZE", icon: Shield, box: "bg-violet-50 text-violet-700 border-violet-200" },
                        { label: "Blood group", value: selectedChild.bloodGroup || "—", icon: Droplet, box: "bg-rose-50 text-rose-600 border-rose-200" },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-white p-4">
                          <div className={`shrink-0 rounded-xl border p-2.5 ${s.box}`}><s.icon className="h-5 w-5" /></div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-gray-400">{s.label}</span>
                            <span className="text-lg font-extrabold text-gray-900">{s.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                      {/* Hifz mini */}
                      <Card className="overflow-hidden rounded-[1.4rem] lg:col-span-1">
                        <div className="flex items-center justify-between bg-gradient-to-r from-[#047857] to-[#065f46] p-4 text-white">
                          <p className="flex items-center gap-2 text-[13.5px] font-bold"><BookOpen size={16} className="text-amber-300" /> Hifz weekly slip</p>
                          <button type="button" onClick={() => setActiveTab("hifz")} className="rounded-lg bg-amber-400 px-2.5 py-1 text-[11.5px] font-bold text-gray-950 hover:bg-amber-300">
                            Open
                          </button>
                        </div>
                        <CardContent className="space-y-3 p-5 text-[13px]">
                          {selectedChild.latestHifzSlip ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-800">
                                  Week {selectedChild.latestHifzSlip.weekNumber}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  {Array.from({ length: selectedChild.latestHifzSlip.disciplineRating || 5 }).map((_, i) => (
                                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  ))}
                                </span>
                              </div>
                              <p className="font-extrabold text-gray-900">
                                Juz {selectedChild.latestHifzSlip.currentJuz || "—"} · Safah {selectedChild.latestHifzSlip.currentSafah || "—"}
                              </p>
                              <p className="text-gray-500">
                                Score {selectedChild.latestHifzSlip.totalMarks || 0}/50 ({selectedChild.latestHifzSlip.overallPerformance || 0}%)
                              </p>
                              {selectedChild.latestHifzSlip.teacherNotes && (
                                <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[12px] leading-relaxed text-amber-950">
                                  {selectedChild.latestHifzSlip.teacherNotes}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="py-4 text-center text-[12.5px] text-gray-400">No published Hifz slips yet.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Recent activity */}
                      <Card className="rounded-[1.4rem] lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-5">
                          <CardTitle className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
                            <Activity size={16} className="text-[#047857]" /> Recent activity
                          </CardTitle>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            Live feed
                          </span>
                        </CardHeader>
                        <CardContent className="space-y-2.5 p-5">
                          {selectedChild.recentActivity?.length ? (
                            selectedChild.recentActivity.slice(0, 4).map((act: any) => {
                              const Icon = activityIcons[act.type] || Award;
                              return (
                                <div key={act.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                                  <div className="rounded-xl border border-amber-200 bg-amber-100/70 p-2 text-amber-700"><Icon size={15} /></div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="truncate text-[13px] font-bold text-gray-900">{act.title}</p>
                                      <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(new Date(act.createdAt))}</span>
                                    </div>
                                    <p className="mt-0.5 truncate text-[12px] text-gray-500">{act.detail}</p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="py-6 text-center text-[12.5px] text-gray-400">No recent activity yet.</p>
                          )}
                          <Link href="/parent/activity" className="flex items-center justify-center gap-1 pt-1 text-[12.5px] font-bold text-emerald-800 hover:underline">
                            View complete log <ChevronRight size={14} />
                          </Link>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Student identity strip */}
                    <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-gray-400">ITS</p>
                          <button type="button" onClick={() => copyToClipboard(selectedChild.its, "ITS ID")}
                            className="mt-0.5 flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono font-bold text-emerald-800">
                            {selectedChild.its} {copiedText === selectedChild.its ? <Check size={12} /> : <Copy size={12} className="opacity-60" />}
                          </button>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-gray-400">Class</p>
                          <p className="mt-0.5 font-bold text-gray-900">Grade {selectedChild.grade}{selectedChild.section ? `-${selectedChild.section}` : ""}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-gray-400">Watan</p>
                          <p className="mt-0.5 font-semibold text-gray-800">{selectedChild.watan || selectedChild.residentCity || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-gray-400">Hifz status</p>
                          <Badge className={`mt-0.5 text-[11px] ${selectedChild.status === "HAFIZ" ? "border-amber-300 bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                            {selectedChild.status === "HAFIZ" ? `Hafiz ${selectedChild.hafizYear ? `(${selectedChild.hafizYear})` : ""}` : "Sanah student"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "tracking" && (
                  <div className="space-y-5">
                    {/* Today timeline */}
                    <div className="rounded-[1.4rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-gray-900">
                          <MapPin size={16} className="text-emerald-700" /> Today — live campus tracking
                        </h3>
                        <button type="button" onClick={fetchTracking}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                          <RefreshCw size={13} className={trackingLoading ? "animate-spin text-emerald-700" : ""} /> Refresh scans
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase text-gray-400">Status</p>
                          <p className={`mt-1 flex items-center gap-1.5 text-[14px] font-extrabold ${selectedChild.isCheckedIn ? "text-emerald-700" : "text-slate-500"}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${selectedChild.isCheckedIn ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
                            {selectedChild.isCheckedIn ? "On campus" : "Not arrived"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase text-gray-400">Arrival scan</p>
                          <p className="mt-1 text-[14px] font-extrabold text-gray-900">
                            {selectedChild.lastCheckIn
                              ? new Date(selectedChild.lastCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase text-gray-400">Gate</p>
                          <p className="mt-1 text-[14px] font-extrabold text-gray-900">{selectedChild.gate || "Main Gate"}</p>
                        </div>
                      </div>
                    </div>

                    {/* 7-day strip */}
                    <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-gray-900">
                          <Calendar size={16} className="text-emerald-700" /> 7-day attendance trail
                        </h3>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-800">
                          {selectedChild.daysPresentLast7 ?? 0}/7 present · {selectedChild.attendanceRateLast7 ?? 100}%
                        </span>
                      </div>
                      {trackingLoading ? (
                        <div className="mt-4 grid grid-cols-7 gap-2">
                          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-[86px] animate-pulse rounded-2xl bg-slate-100" />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
                          {weekStrip.map((d, i) => (
                            <div key={i} className={`rounded-2xl border p-2 text-center sm:p-3 ${
                              d.present ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                            }`}>
                              <p className="text-[11px] font-bold uppercase text-gray-400">{d.label}</p>
                              <p className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-extrabold sm:h-8 sm:w-8 ${
                                d.present ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"
                              }`}>
                                {d.present ? <Check size={15} /> : "–"}
                              </p>
                              <p className="mt-1 truncate text-[10px] font-semibold text-gray-500">
                                {d.date.toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                              </p>
                              <p className="truncate text-[10px] font-bold text-emerald-700">{d.time || ""}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent scans */}
                    <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 sm:p-6">
                      <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-gray-900">
                        <Clock size={16} className="text-emerald-700" /> Recent biometric scans
                      </h3>
                      {trackingLoading ? (
                        <div className="mt-4 space-y-2">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-[64px] animate-pulse rounded-2xl bg-slate-100" />
                          ))}
                        </div>
                      ) : trackingLogs.length === 0 ? (
                        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-[12.5px] text-gray-500">
                          No scans in the recent window. New check-ins will appear here automatically.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {trackingLogs.slice(0, 8).map((a: any) => (
                            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                              <div className="rounded-xl border border-emerald-200 bg-emerald-100/60 p-2 text-emerald-700">
                                <Clock size={15} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-bold text-gray-900">{a.title}</p>
                                <p className="truncate text-[12px] text-gray-500">{a.detail}</p>
                              </div>
                              <span className="shrink-0 text-[11px] font-medium text-gray-400">
                                {new Date(a.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={() => setActiveTab("leave")}
                        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-bold text-emerald-800 transition hover:bg-emerald-100">
                        <FileText size={14} /> Absent a day? Apply for leave <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "leave" && (
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 sm:p-6">
                    <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-gray-900">
                      <CalendarDays size={16} className="text-emerald-700" />
                      Leave applications for {selectedChild.firstName}
                    </h3>
                    <p className="mt-1 text-[12.5px] text-gray-500">
                      Parents apply for holidays and emergencies here. Medical leave is handled by the school medical desk and never appears here.
                    </p>
                    <div className="mt-4">
                      <ParentLeaveManager childrenList={leaveChildren} />
                    </div>
                  </div>
                )}

                {activeTab === "hifz" && (
                  <div className="space-y-5">
                    <Card className="overflow-hidden rounded-[1.4rem]">
                      <div className="flex items-center justify-between bg-gradient-to-r from-[#047857] to-[#065f46] p-5 text-white">
                        <div className="flex items-center gap-2.5">
                          <BookOpen size={20} className="text-amber-300" />
                          <div>
                            <h3 className="font-display text-[16px] font-bold">Hifz progress & weekly slip</h3>
                            <p className="text-[12px] text-emerald-100">Official Quran memorization evaluation</p>
                          </div>
                        </div>
                        <Link href="/parent/hifz">
                          <Button size="sm" className="h-8 gap-1 rounded-xl bg-amber-400 px-3.5 text-xs font-bold text-gray-950 hover:bg-amber-300">
                            Full record <ChevronRight size={14} />
                          </Button>
                        </Link>
                      </div>
                      <CardContent className="space-y-4 p-5 sm:p-6">
                        {selectedChild.latestHifzSlip ? (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-[#047857]">
                                <Calendar size={14} /> Week {selectedChild.latestHifzSlip.weekNumber} report
                              </span>
                              <span className="flex items-center gap-0.5">
                                {Array.from({ length: selectedChild.latestHifzSlip.disciplineRating || 5 }).map((_, i) => (
                                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                                ))}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-center">
                                <span className="block text-[10px] font-bold uppercase text-gray-400">Juz / Safah</span>
                                <span className="text-base font-black text-[#047857]">
                                  {selectedChild.latestHifzSlip.currentJuz || "—"} / {selectedChild.latestHifzSlip.currentSafah || "—"}
                                </span>
                              </div>
                              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3.5 text-center">
                                <span className="block text-[10px] font-bold uppercase text-gray-400">Sabaq</span>
                                <span className="text-base font-black text-amber-800">{selectedChild.latestHifzSlip.sabaqLines || 0} lines</span>
                              </div>
                              <div className="col-span-2 rounded-2xl border border-violet-100 bg-violet-50/60 p-3.5 text-center sm:col-span-1">
                                <span className="block text-[10px] font-bold uppercase text-gray-400">Score</span>
                                <span className="text-base font-black text-violet-900">
                                  {selectedChild.latestHifzSlip.totalMarks || 0}/50 ({selectedChild.latestHifzSlip.overallPerformance || 0}%)
                                </span>
                              </div>
                            </div>
                            {selectedChild.latestHifzSlip.teacherNotes && (
                              <div className="space-y-1.5 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950">
                                <p className="flex items-center gap-1.5 font-bold text-amber-900">
                                  <Sparkles size={14} className="text-amber-600" /> Muhaffiz feedback ({selectedChild.latestHifzSlip.muhaffizName}):
                                </p>
                                <p>{selectedChild.latestHifzSlip.teacherNotes}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                            <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
                            <p className="text-xs font-medium text-gray-500">No published Hifz slips yet for this student.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {selectedChild.recentBadges?.length > 0 && (
                      <Card className="rounded-[1.4rem]">
                        <CardHeader className="border-b border-slate-100 p-5">
                          <CardTitle className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                            <Award size={16} className="text-amber-500" /> Earned badges & honors
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap gap-2">
                            {selectedChild.recentBadges.map((badge: any, idx: number) => (
                              <Badge key={idx} variant="outline"
                                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold ${
                                  badge.tier === "GOLD" ? "border-amber-300 bg-amber-50 text-amber-900"
                                  : badge.tier === "SILVER" ? "border-slate-300 bg-slate-50 text-slate-800"
                                  : "border-orange-200 bg-orange-50 text-orange-900"
                                }`}>
                                <Crown size={12} className="text-amber-600" /> {badge.name}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="rounded-[1.4rem] bg-gradient-to-br from-[#022c22] to-[#047857] p-6 text-white">
                      <h4 className="flex items-center gap-1.5 text-sm font-bold">
                        <Sparkles size={16} className="text-amber-300" /> Parent quick actions
                      </h4>
                      <p className="mt-1 text-xs text-emerald-100">
                        Questions about {selectedChild.firstName}? Use Hifz reports or the school calendar.
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Link href="/parent/hifz" className="flex-1">
                          <Button size="sm" className="h-9 w-full rounded-xl bg-white text-xs font-bold text-[#047857] hover:bg-emerald-50">
                            <BookOpen size={14} className="mr-1" /> Hifz reports
                          </Button>
                        </Link>
                        <Link href="/fatimi-calendar" className="flex-1">
                          <Button size="sm" variant="outline" className="h-9 w-full rounded-xl border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20">
                            <Calendar size={14} className="mr-1" /> School calendar
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}
    </div>
  );
}
