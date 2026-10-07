"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Fingerprint,
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

type ParentTab = "overview" | "tracking" | "hifz" | "leave";

const TABS: Array<{ id: ParentTab; label: string; labelAr: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", labelAr: "نظرة عامة", icon: Heart },
  { id: "tracking", label: "Live Tracking", labelAr: "الحضور والبصمة", icon: Navigation },
  { id: "hifz", label: "Hifz & Daily Work", labelAr: "الحفظ واليومية", icon: BookOpen },
  { id: "leave", label: "Leave Applications", labelAr: "الإجازات", icon: CalendarDays },
];

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
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        present: !!match || (selectedChild?.isCheckedIn && i === 0),
        time: match?.checkInTime
          ? new Date(match.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : (selectedChild?.isCheckedIn && i === 0 && selectedChild?.lastCheckIn)
          ? new Date(selectedChild.lastCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : null,
      });
    }
    return days;
  }, [trackingLogs, selectedChild]);

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
      {/* ═══ Top Hero Banner ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/20"
          style={{ background: "linear-gradient(135deg, #01241c 0%, #034433 50%, #065f46 100%)" }}
        >
          <div className="absolute -right-12 -top-12 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-300/40 shadow-lg"
                style={{ background: "linear-gradient(135deg, #d4af37, #997b1e)" }}
              >
                <Heart className="h-8 w-8 text-white fill-white/20" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-300/40 bg-black/30 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-300">
                    Parent Guardian Portal
                  </span>
                  <span className="text-xs text-emerald-200/90 font-medium">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Afzalus Salam, {parentProfile?.firstName || "Parent"}!
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-emerald-100/80 font-medium">
                  Monitoring {children.length} {children.length === 1 ? "child" : "children"} · Live campus attendance, daily Hifz & activity
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
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
                className="h-10 gap-2 rounded-2xl border-white/25 bg-white/10 px-4 text-xs font-semibold text-white shadow-sm hover:bg-white/20 backdrop-blur"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
                Live Sync
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
        <Card className="rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/20 p-10 text-center">
          <CardContent className="mx-auto max-w-md space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-800 shadow-inner">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">No Talabat Linked Yet</h3>
              <p className="mt-1.5 text-xs text-gray-500">
                Share your registered ITS ID (<strong>{parentProfile?.its || "—"}</strong>) with the school administration to link your family.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ═══ Child Selection Cards ═══ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-gray-900">
                <GraduationCap className="h-5 w-5 text-emerald-700" />
                Select Child to View ({children.length})
              </h2>
              <span className="text-xs font-medium text-gray-500">Real-time status updated</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => {
                const isSelected = selectedChild?.id === child.id;
                const isHafiz = child.status === "HAFIZ" || !!child.hafizYear;
                return (
                  <motion.button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full rounded-2xl p-4 text-left transition-all relative overflow-hidden ${
                      isSelected
                        ? "bg-gradient-to-br from-emerald-800 to-teal-900 text-white shadow-lg ring-2 ring-emerald-500"
                        : "border border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <Avatar className={`h-14 w-14 shrink-0 rounded-2xl border-2 ${isHafiz ? "border-amber-400" : isSelected ? "border-emerald-300" : "border-slate-200"}`}>
                          {child.avatarUrl ? (
                            <AvatarImage src={child.avatarUrl} alt={child.firstName} />
                          ) : null}
                          <AvatarFallback className="rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-900 text-base font-bold text-white">
                            {getInitials(child.firstName, child.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        {isHafiz && (
                          <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 rounded-full p-0.5 shadow">
                            <Crown className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`flex items-center gap-1.5 truncate text-base font-extrabold ${isSelected ? "text-white" : "text-gray-900"}`}>
                          {child.firstName} {child.lastName}
                        </p>
                        <p className={`text-xs font-semibold ${isSelected ? "text-emerald-200" : "text-emerald-800"}`}>
                          ITS: {child.its} · Gr {child.grade}{child.section ? `-${child.section}` : ""}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            child.isCheckedIn
                              ? isSelected ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isSelected ? "bg-white/10 text-white/70" : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${child.isCheckedIn ? "animate-pulse bg-emerald-400" : "bg-slate-400"}`} />
                            {child.isCheckedIn ? "On Campus" : "Awaiting Scan"}
                          </span>
                          {isHafiz && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isSelected ? "bg-amber-400/20 text-amber-200" : "bg-amber-100 text-amber-900"
                            }`}>
                              Hafiz
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="shrink-0 p-1.5 rounded-full bg-white/20 text-emerald-200">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ═══ Navigation Tabs ═══ */}
          <div className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md py-2">
            <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {TABS.map((t) => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                      active
                        ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/20"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ Tab Content ═══ */}
          {selectedChild && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedChild.id}-${activeTab}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* ─────────────────────────────────────────────────────────────
                    TAB 1: OVERVIEW
                ───────────────────────────────────────────────────────────── */}
                {activeTab === "overview" && (
                  <div className="space-y-5">
                    {/* Live Campus Attendance Hero Card */}
                    <div
                      className={`rounded-3xl border p-6 shadow-sm transition-all ${
                        selectedChild.isCheckedIn
                          ? "border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-4">
                          <div
                            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                              selectedChild.isCheckedIn
                                ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                                : "border border-slate-200 bg-slate-100 text-slate-400"
                            }`}
                          >
                            {selectedChild.isCheckedIn ? (
                              <CheckCircle2 className="h-8 w-8" />
                            ) : (
                              <Clock className="h-8 w-8" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`px-2.5 py-0.5 text-xs font-bold ${
                                  selectedChild.isCheckedIn
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {selectedChild.isCheckedIn ? "Campus Arrival Verified" : "Awaiting Check-in"}
                              </Badge>
                              {selectedChild.method && (
                                <Badge variant="outline" className="text-[11px] font-semibold border-slate-300">
                                  <Fingerprint className="w-3 h-3 mr-1 text-emerald-600" />
                                  {selectedChild.method}
                                </Badge>
                              )}
                            </div>

                            <h3 className="mt-1.5 text-xl font-bold text-gray-900">
                              {selectedChild.isCheckedIn
                                ? `${selectedChild.firstName} is safely on campus at Darse Burhani`
                                : `No biometric scan recorded for ${selectedChild.firstName} today`}
                            </h3>

                            <p className="mt-0.5 text-xs sm:text-sm text-gray-600">
                              {selectedChild.lastCheckIn ? (
                                <>
                                  Check-in at{" "}
                                  <strong className="text-emerald-800">
                                    {new Date(selectedChild.lastCheckIn).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </strong>{" "}
                                  via {selectedChild.gate || "Main Gate MinMoe terminal"}
                                </>
                              ) : (
                                "Biometric terminal scans reflect live here the second your child scans at the gate."
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Quick metrics */}
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-center min-w-[100px]">
                            <span className="block text-[11px] font-bold uppercase text-emerald-700">7-Day Rate</span>
                            <span className="text-lg font-black text-emerald-800">
                              {selectedChild.attendanceRateLast7 ?? 100}%
                            </span>
                          </div>
                          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3.5 text-center min-w-[100px]">
                            <span className="block text-[11px] font-bold uppercase text-amber-700">Streak</span>
                            <span className="flex items-center justify-center gap-1 text-lg font-black text-amber-800">
                              <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
                              {selectedChild.streakDays || 0}d
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats 4-Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {[
                        { label: "Today's Merits", value: `+${selectedChild.pointsToday || 0}`, icon: TrendingUp, box: "bg-amber-50 text-amber-700 border-amber-200" },
                        { label: "Total Points", value: formatPoints(selectedChild.currentPoints || 0), icon: Award, box: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                        { label: "Tier Rank", value: selectedChild.tier || "BRONZE", icon: Shield, box: "bg-violet-50 text-violet-700 border-violet-200" },
                        { label: "Blood Group", value: selectedChild.bloodGroup || "—", icon: Droplet, box: "bg-rose-50 text-rose-600 border-rose-200" },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                          <div className={`shrink-0 rounded-xl border p-2.5 ${s.box}`}>
                            <s.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="block text-[11px] font-bold uppercase text-gray-400">{s.label}</span>
                            <span className="text-lg font-extrabold text-gray-900">{s.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 2-Column: Daily Hifz Snapshot + Recent Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      {/* Daily Hifz / Hafiz Card */}
                      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden lg:col-span-1">
                        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 p-4 text-white flex items-center justify-between">
                          <p className="flex items-center gap-2 text-sm font-bold">
                            <BookOpen size={16} className="text-amber-300" />
                            Daily Hifz & Evaluation
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("hifz")}
                            className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-300 transition"
                          >
                            Details
                          </button>
                        </div>

                        <CardContent className="p-5 space-y-3">
                          {selectedChild.status === "HAFIZ" || selectedChild.hafizYear ? (
                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1.5">
                              <Crown className="w-8 h-8 text-amber-600 mx-auto" />
                              <p className="font-bold text-amber-900 text-sm">Certified Hafiz Al-Quran</p>
                              <p className="text-xs text-amber-700">
                                Completed full Quran memorization ({selectedChild.hafizYear ? `Sanah ${selectedChild.hafizYear} H` : "Alhamdulillah"})
                              </p>
                            </div>
                          ) : selectedChild.todayHifzEvaluation ? (
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-slate-500">Today's Sabaq:</span>
                                <span className="text-slate-900 font-semibold">{selectedChild.todayHifzEvaluation.sabaqSurah || "Regular Sabaq"}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Score:</span>
                                <span className="text-emerald-700 font-bold">{selectedChild.todayHifzEvaluation.totalMarks}/30</span>
                              </div>
                              {selectedChild.todayHifzEvaluation.teacherRemarks && (
                                <p className="p-2 rounded-lg bg-emerald-50 text-emerald-900 text-[11px]">
                                  <strong>Teacher note:</strong> {selectedChild.todayHifzEvaluation.teacherRemarks}
                                </p>
                              )}
                            </div>
                          ) : selectedChild.latestHifzSlip ? (
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between font-bold">
                                <span className="text-slate-500">Current Position:</span>
                                <span className="text-slate-900 font-semibold">Juz {selectedChild.latestHifzSlip.currentJuz || "—"} · Safah {selectedChild.latestHifzSlip.currentSafah || "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Performance:</span>
                                <span className="text-emerald-700 font-bold">{selectedChild.latestHifzSlip.overallPerformance}%</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 text-center py-4">No daily Hifz record yet today.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Recent Activity Live Feed */}
                      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-5">
                          <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                            <Activity size={16} className="text-emerald-700" />
                            Recent Classroom Activity & Merits
                          </CardTitle>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            Live Feed
                          </span>
                        </CardHeader>
                        <CardContent className="p-5 space-y-2.5">
                          {selectedChild.recentActivity?.length ? (
                            selectedChild.recentActivity.slice(0, 4).map((act: any) => (
                              <div key={act.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                                <div className="rounded-xl border border-amber-200 bg-amber-100/70 p-2 text-amber-700 shrink-0">
                                  <Award size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-xs sm:text-sm font-bold text-gray-900">{act.title}</p>
                                    <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(new Date(act.createdAt))}</span>
                                  </div>
                                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{act.detail}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="py-6 text-center text-xs text-gray-400">No merit logs recorded yet today.</p>
                          )}
                          <Link href="/parent/activity" className="flex items-center justify-center gap-1 pt-1 text-xs font-bold text-emerald-800 hover:underline">
                            View Full Activity Log <ChevronRight size={14} />
                          </Link>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    TAB 2: LIVE TRACKING & BIOMETRICS
                ───────────────────────────────────────────────────────────── */}
                {activeTab === "tracking" && (
                  <div className="space-y-5">
                    {/* Live Campus Banner */}
                    <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50/30 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-base font-extrabold text-gray-900">
                          <MapPin size={18} className="text-emerald-700" />
                          Today's Campus Access & Gate Scans
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchTracking}
                          className="h-8 gap-1.5 text-xs font-bold border-slate-200"
                        >
                          <RefreshCw size={13} className={trackingLoading ? "animate-spin text-emerald-700" : ""} />
                          Refresh Scans
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase text-gray-400">Status</p>
                          <p className={`mt-1 flex items-center gap-2 text-sm font-extrabold ${selectedChild.isCheckedIn ? "text-emerald-700" : "text-slate-500"}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${selectedChild.isCheckedIn ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
                            {selectedChild.isCheckedIn ? "On Campus" : "Awaiting Scan"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase text-gray-400">Check-in Time</p>
                          <p className="mt-1 text-sm font-extrabold text-gray-900">
                            {selectedChild.lastCheckIn
                              ? new Date(selectedChild.lastCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase text-gray-400">Gate / Terminal</p>
                          <p className="mt-1 text-sm font-extrabold text-gray-900">{selectedChild.gate || "Main Gate MinMoe"}</p>
                        </div>
                      </div>
                    </div>

                    {/* 7-Day Attendance Strip */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="flex items-center gap-2 text-base font-extrabold text-gray-900">
                          <Calendar size={18} className="text-emerald-700" />
                          7-Day Attendance History
                        </h3>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                          {selectedChild.daysPresentLast7 ?? 0}/7 Days Present · {selectedChild.attendanceRateLast7 ?? 100}% Rate
                        </span>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {weekStrip.map((d, i) => (
                          <div
                            key={i}
                            className={`rounded-2xl border p-3 text-center transition-all ${
                              d.present ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50/60"
                            }`}
                          >
                            <p className="text-[11px] font-bold uppercase text-gray-400">{d.label}</p>
                            <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${
                              d.present ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-200 text-slate-400"
                            }`}>
                              {d.present ? <Check size={16} /> : "—"}
                            </div>
                            <p className="mt-1 text-[10px] font-semibold text-gray-500">
                              {d.date.toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                            </p>
                            <p className="truncate text-[10px] font-bold text-emerald-700">{d.time || ""}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Raw Scans Feed */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-gray-900 mb-4">
                        <Clock size={18} className="text-emerald-700" />
                        Live Gate Scans Feed
                      </h3>

                      {trackingLogs.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                          No scan logs in the recent buffer. Gate scans appear automatically.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {trackingLogs.map((log: any) => (
                            <div key={log.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 text-xs">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                                  <Fingerprint size={16} />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{log.title || "Biometric Check-in"}</p>
                                  <p className="text-slate-500 text-[11px]">{log.detail || "Verified at terminal"}</p>
                                </div>
                              </div>
                              <span className="font-mono text-slate-500 font-semibold">{timeAgo(new Date(log.createdAt))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    TAB 3: HIFZ & DAILY WORK TRACKING
                ───────────────────────────────────────────────────────────── */}
                {activeTab === "hifz" && (
                  <div className="space-y-5">
                    {selectedChild.status === "HAFIZ" || selectedChild.hafizYear ? (
                      <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white relative">
                        <div className="p-8 sm:p-12 text-center relative z-10 space-y-4">
                          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                            <Crown className="w-10 h-10 text-amber-400" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-amber-300 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
                            Certified Hafiz Al-Quran
                          </span>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                            مَا شَاءَ اللَّهُ لَا قُوَّةَ إِلَّا بِاللَّهِ
                          </h2>
                          <p className="text-sm text-emerald-100/90 max-w-md mx-auto">
                            {selectedChild.firstName} has completed the memorization of the Holy Quran. Daily beginner evaluations and ikhtebaar testing are not applicable.
                          </p>
                          {selectedChild.hafizYear && (
                            <Badge className="bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1">
                              Certified Year: {selectedChild.hafizYear} H
                            </Badge>
                          )}
                        </div>
                      </Card>
                    ) : (
                      <>
                        {/* Daily Evaluation Card */}
                        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/10 to-amber-50/20 p-6 shadow-sm">
                          <div className="flex items-center justify-between border-b border-amber-100 pb-3 mb-4">
                            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                              <BookOpen className="w-5 h-5 text-amber-600" />
                              Today's Daily Evaluation (اليومية)
                            </h3>
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold">
                              Live Feedback
                            </Badge>
                          </div>

                          {selectedChild.todayHifzEvaluation ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-3.5 rounded-2xl bg-white border border-amber-100 shadow-xs">
                                  <span className="text-[11px] font-bold text-amber-800 uppercase">Sabaq (سبق)</span>
                                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                                    {selectedChild.todayHifzEvaluation.sabaqSurah || "Sabaq recitation"}
                                  </p>
                                  <p className="text-xs text-slate-500">{selectedChild.todayHifzEvaluation.sabaqLines || 0} Lines recited</p>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-white border border-blue-100 shadow-xs">
                                  <span className="text-[11px] font-bold text-blue-800 uppercase">Sabqi (سبقي)</span>
                                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                                    {selectedChild.todayHifzEvaluation.sabqiJuz ? `Juz ${selectedChild.todayHifzEvaluation.sabqiJuz}` : "Sabqi Revision"}
                                  </p>
                                  <p className="text-xs text-slate-500">Marks: {selectedChild.todayHifzEvaluation.sabqiMarks || 0}/10</p>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
                                  <span className="text-[11px] font-bold text-emerald-800 uppercase">Muraja'at (مراجعة)</span>
                                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                                    {selectedChild.todayHifzEvaluation.murajaatJuz ? `Juz ${selectedChild.todayHifzEvaluation.murajaatJuz}` : "Dhor"}
                                  </p>
                                  <p className="text-xs text-slate-500">Marks: {selectedChild.todayHifzEvaluation.murajaatMarks || 0}/10</p>
                                </div>
                              </div>

                              {selectedChild.todayHifzEvaluation.teacherRemarks && (
                                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900">
                                  <strong>Muhaffiz Remarks: </strong> {selectedChild.todayHifzEvaluation.teacherRemarks}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="py-6 text-center text-xs text-slate-400">
                              No daily evaluation recorded yet for today.
                            </p>
                          )}
                        </div>

                        {/* Latest Weekly Slip */}
                        {selectedChild.latestHifzSlip && (
                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <FileText className="w-5 h-5 text-emerald-700" />
                                Weekly Hifz Slip (Week {selectedChild.latestHifzSlip.weekNumber})
                              </h3>
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold">
                                {selectedChild.latestHifzSlip.overallPerformance}% Score
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div className="p-3 rounded-xl bg-slate-50">
                                <span className="text-slate-400 block font-bold">Current Juz</span>
                                <span className="text-sm font-black text-slate-900">Juz {selectedChild.latestHifzSlip.currentJuz || "—"}</span>
                              </div>
                              <div className="p-3 rounded-xl bg-slate-50">
                                <span className="text-slate-400 block font-bold">Safah</span>
                                <span className="text-sm font-black text-slate-900">Page {selectedChild.latestHifzSlip.currentSafah || "—"}</span>
                              </div>
                              <div className="p-3 rounded-xl bg-slate-50">
                                <span className="text-slate-400 block font-bold">Discipline Rating</span>
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  {Array.from({ length: selectedChild.latestHifzSlip.disciplineRating || 5 }).map((_, i) => (
                                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  ))}
                                </div>
                              </div>
                              <div className="p-3 rounded-xl bg-slate-50">
                                <span className="text-slate-400 block font-bold">Muhaffiz</span>
                                <span className="text-xs font-bold text-slate-800">{selectedChild.latestHifzSlip.muhaffizName}</span>
                              </div>
                            </div>

                            {selectedChild.latestHifzSlip.teacherNotes && (
                              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                                <strong className="text-slate-900">Teacher Notes: </strong>
                                {selectedChild.latestHifzSlip.teacherNotes}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    TAB 4: LEAVE APPLICATIONS
                ───────────────────────────────────────────────────────────── */}
                {activeTab === "leave" && (
                  <div className="space-y-4">
                    <ParentLeaveManager
                      childrenList={leaveChildren}
                      defaultChildId={selectedChild.studentProfileId || selectedChild.id}
                      onSuccess={() => fetchDashboard(false)}
                    />
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
