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
  Camera,
  Eye,
  Printer,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials, timeAgo, formatPoints } from "@/lib/utils";
import { isRabiAlAkhirDate } from "@/lib/fatimi-calendar";
import { ParentNotificationCenter } from "@/components/parent/ParentNotificationCenter";
import { ParentLeaveManager } from "@/components/parent/ParentLeaveManager";

type ParentTab = "overview" | "tracking" | "timetable" | "leave";

const TABS: Array<{ id: ParentTab; label: string; labelAr: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", labelAr: "نظرة عامة", icon: Heart },
  { id: "tracking", label: "Attendance", labelAr: "الحضور والغياب", icon: Navigation },
  { id: "timetable", label: "Class Timetable & Masool", labelAr: "الجدول والمسؤول", icon: BookOpen },
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

  // Class Timetable & Masool State
  const [timetableData, setTimetableData] = useState<any>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);

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

  // ── Tracking feed for the selected child (attendance scans, omitting Rabi ul Akhar) ──
  const fetchTracking = useCallback(async () => {
    if (!selectedChild) return;
    setTrackingLoading(true);
    try {
      const res = await fetch(
        `/api/parent/activity?childId=${encodeURIComponent(selectedChild.studentProfileId || selectedChild.id)}&limit=50`
      );
      const json = await res.json();
      if (json.success && json.data) {
        const acts = Array.isArray(json.data) ? json.data : json.data.activities || [];
        setTrackingLogs(
          acts.filter((a: any) => a.type === "ATTENDANCE" && !isRabiAlAkhirDate(a.createdAt))
        );
      }
    } catch {
    } finally {
      setTrackingLoading(false);
    }
  }, [selectedChild]);

  useEffect(() => {
    if (activeTab === "tracking") fetchTracking();
  }, [activeTab, fetchTracking]);

  // Fetch Class Timetable & Masool for selected child
  const fetchTimetable = useCallback(async () => {
    if (!selectedChild) return;
    setTimetableLoading(true);
    try {
      const childId = selectedChild.id || selectedChild.studentProfileId;
      const res = await fetch(`/api/parent/timetable?studentId=${encodeURIComponent(childId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTimetableData(json.data);
      } else {
        setTimetableData(null);
      }
    } catch {
      setTimetableData(null);
    } finally {
      setTimetableLoading(false);
    }
  }, [selectedChild]);

  useEffect(() => {
    if (activeTab === "timetable") {
      fetchTimetable();
    }
  }, [activeTab, fetchTimetable]);

  // Last-7-days strip derived from tracking scans (excluding Rabi ul Akhar days)
  const weekStrip = useMemo(() => {
    const days: Array<{ date: Date; label: string; present: boolean; time: string | null }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const isRabi = isRabiAlAkhirDate(d);
      const next = new Date(d.getTime() + 86400000);
      const match = !isRabi
        ? trackingLogs.find((a: any) => {
            const t = new Date(a.createdAt).getTime();
            return t >= d.getTime() && t < next.getTime();
          })
        : null;
      days.push({
        date: d,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        present: !isRabi && (!!match || (selectedChild?.isCheckedIn && i === 0)),
        time: !isRabi
          ? (match?.checkInTime
              ? new Date(match.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : selectedChild?.isCheckedIn && i === 0 && selectedChild?.lastCheckIn
              ? new Date(selectedChild.lastCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : null)
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
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="p-1 sm:p-1.5 rounded-3xl bg-black/[0.04] ring-1 ring-black/[0.08] shadow-2xl">
          <div
            className="relative overflow-hidden rounded-[1.4rem] sm:rounded-[1.6rem] p-6 sm:p-9 text-white"
            style={{
              background: "linear-gradient(135deg, #0d0d0d 0%, #151515 50%, #1c1813 100%)",
              boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 20px 40px -15px rgba(0, 0, 0, 0.4)",
            }}
          >
            {/* Top glowing champagne hairline */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-90" />
            <div className="absolute -right-12 -top-12 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 h-60 w-60 rounded-full bg-emerald-400/5 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4 sm:gap-5">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-300/40 shadow-lg relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #d4af37 0%, #b8972e 100%)" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                  <Heart className="h-8 w-8 text-stone-950 fill-stone-950/20 relative z-10" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="rounded-full border border-amber-300/40 bg-black/40 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 backdrop-blur-xs">
                      Parent Guardian Portal
                    </span>
                    <span className="text-xs text-stone-300 font-medium">
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
                    Afzalus Salam, {parentProfile?.firstName || "Parent"}!
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-stone-300 font-medium">
                    Monitoring {children.length} {children.length === 1 ? "child" : "children"} · Live campus attendance, daily Hifz &amp; activity
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
                  className="h-10 gap-2 rounded-xl border-white/20 bg-white/10 px-4 text-xs font-semibold text-white shadow-xs hover:bg-white/20 backdrop-blur-xs transition-all active:scale-[0.98]"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-amber-300" : ""}`} strokeWidth={1.75} />
                  Live Sync
                </Button>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-90" />
          </div>
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
                    className={`w-full rounded-2xl p-1 text-left transition-all relative overflow-hidden ${
                      isSelected
                        ? "bg-amber-400/20 ring-1 ring-amber-400/60 shadow-lg"
                        : "bg-black/[0.03] ring-1 ring-black/[0.05] hover:ring-amber-400/30"
                    }`}
                  >
                    <div
                      className={`rounded-[calc(1rem-2px)] p-3.5 transition-all flex items-center gap-3.5 ${
                        isSelected
                          ? "bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                          : "bg-white text-stone-900 hover:bg-stone-50/50 shadow-xs"
                      }`}
                    >
                      <div className="relative">
                        <Avatar className={`h-14 w-14 shrink-0 rounded-2xl border-2 ${isHafiz ? "border-amber-400" : isSelected ? "border-amber-400/80" : "border-slate-200"}`}>
                          {child.avatarUrl ? (
                            <AvatarImage src={child.avatarUrl} alt={child.firstName} />
                          ) : null}
                          <AvatarFallback className="rounded-2xl bg-gradient-to-br from-stone-800 to-stone-950 text-base font-bold text-amber-300 font-display">
                            {getInitials(child.firstName, child.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        {isHafiz && (
                          <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-stone-950 rounded-full p-0.5 shadow-sm ring-1 ring-black/10">
                            <Crown className="w-3.5 h-3.5" strokeWidth={2} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`flex items-center gap-1.5 truncate text-base font-extrabold ${isSelected ? "text-white" : "text-gray-900"}`}>
                          {child.firstName} {child.lastName}
                        </p>
                        <p className={`text-xs font-semibold ${isSelected ? "text-amber-200/90" : "text-stone-500"}`}>
                          ITS: {child.its} · Gr {child.grade}{child.section ? `-${child.section}` : ""}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            child.isCheckedIn
                              ? isSelected ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/40" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : isSelected ? "bg-white/10 text-stone-300 border border-white/10" : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${child.isCheckedIn ? "animate-pulse bg-emerald-400" : "bg-slate-400"}`} />
                            {child.isCheckedIn ? "On Campus" : "Awaiting Scan"}
                          </span>
                          {isHafiz && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSelected ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-amber-50 text-amber-900 border border-amber-200"
                            }`}>
                              Hafiz
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="shrink-0 p-1.5 rounded-xl bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40 shadow-xs">
                          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ═══ Navigation Tabs ═══ */}
          <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md py-2">
            <div className="p-1 rounded-2xl bg-stone-900/5 ring-1 ring-black/[0.06] shadow-xs">
              <div className="flex gap-1.5 overflow-x-auto rounded-[calc(1rem-2px)] bg-white/95 p-1.5 border border-amber-100/60">
                {TABS.map((t) => {
                  const active = activeTab === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`group flex flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all active:scale-[0.98] ${
                        active
                          ? "bg-stone-900 text-amber-300 shadow-md ring-1 ring-amber-400/40"
                          : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform ${
                          active
                            ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40 group-hover:scale-105"
                            : "bg-stone-100 text-stone-500 group-hover:text-stone-900"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2 : 1.75} />
                      </div>
                      <div className="flex flex-col text-left leading-none">
                        <span>{t.label}</span>
                        <span className={`text-[10px] mt-0.5 font-normal ${active ? "text-amber-400/70" : "text-stone-400"}`}>
                          {t.labelAr}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
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
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-center min-w-[110px]">
                            <span className="block text-[11px] font-bold uppercase text-emerald-700">7-Day Attendance</span>
                            <span className="text-lg font-black text-emerald-800">
                              {selectedChild.attendanceRateLast7 ?? 100}%
                            </span>
                          </div>
                          <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-3.5 text-center min-w-[110px]">
                            <span className="block text-[11px] font-bold uppercase text-teal-700">Campus Status</span>
                            <span className="flex items-center justify-center gap-1 text-sm font-black text-teal-800 mt-0.5">
                              {selectedChild.isCheckedIn ? "Checked In" : "Not Present"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats 4-Grid (Tier Rank and Streak removed) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {[
                        { label: "Today's Merits", value: `+${selectedChild.pointsToday || 0}`, icon: TrendingUp, box: "bg-amber-50 text-amber-700 border-amber-200" },
                        { label: "Total Points", value: formatPoints(selectedChild.currentPoints || 0), icon: Award, box: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                        { label: "Attendance Status", value: selectedChild.isCheckedIn ? "Checked In" : "Pending", icon: Clock, box: "bg-teal-50 text-teal-700 border-teal-200" },
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

                    {/* Recent Classroom, Library & Attendance Activity Live Feed */}
                    <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden w-full">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-5">
                          <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                            <Activity size={16} className="text-emerald-700" />
                            Recent Activity, Library &amp; Attendance
                          </CardTitle>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            Live Feed
                          </span>
                        </CardHeader>
                        <CardContent className="p-5 space-y-2.5">
                          {selectedChild.recentActivity?.length ? (
                            selectedChild.recentActivity.slice(0, 5).map((act: any) => {
                              const isLib = act.type === "LIBRARY";
                              const isAtt = act.type === "ATTENDANCE";
                              return (
                                <div key={act.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                                  <div
                                    className={`rounded-xl border p-2 shrink-0 ${
                                      isLib
                                        ? "border-indigo-200 bg-indigo-100/70 text-indigo-700"
                                        : isAtt
                                        ? "border-emerald-200 bg-emerald-100/70 text-emerald-700"
                                        : "border-amber-200 bg-amber-100/70 text-amber-700"
                                    }`}
                                  >
                                    {isLib ? <BookOpen size={16} /> : isAtt ? <Clock size={16} /> : <Award size={16} />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="truncate text-xs sm:text-sm font-bold text-gray-900">{act.title}</p>
                                      <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(new Date(act.createdAt))}</span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{act.detail}</p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="py-6 text-center text-xs text-gray-400">No activity logs recorded yet today.</p>
                          )}
                          <Link href="/parent/activity" className="flex items-center justify-center gap-1 pt-1 text-xs font-bold text-emerald-800 hover:underline">
                            View Full Activity Log <ChevronRight size={14} />
                          </Link>
                        </CardContent>
                      </Card>
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
                    TAB 3: LEAVE APPLICATIONS
                ───────────────────────────────────────────────────────────── */}
                {activeTab === "leave" && (
                  <div className="space-y-4">
                    <ParentLeaveManager
                      childrenList={leaveChildren}
                    />
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    TAB 4: CLASS TIMETABLE & MASOOL
                ───────────────────────────────────────────────────────────── */}
                {activeTab === "timetable" && (
                  <div className="space-y-6">
                    {timetableLoading ? (
                      <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                        <p className="text-xs text-slate-500 mt-2 font-medium">Loading class timetable and masool details...</p>
                      </div>
                    ) : !timetableData?.class ? (
                      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-800">No Timetable Assigned Yet</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          Class allocation for {selectedChild.firstName} is being finalized for academic year 1448 H.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Masool & Class Banner */}
                        <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/60 via-white to-emerald-50/50 p-6 shadow-xs">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                            <div className="flex items-start gap-4">
                              <Avatar className="w-14 h-14 ring-2 ring-amber-400 shrink-0">
                                {timetableData.class.masool?.avatarUrl && (
                                  <AvatarImage src={timetableData.class.masool.avatarUrl} alt={timetableData.class.masool.name} />
                                )}
                                <AvatarFallback className="bg-[#1c1c1c] text-amber-300 font-bold text-sm">
                                  {getInitials(timetableData.class.masool?.name || "Masool")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full">
                                    Official Class Masool (مسؤول الصف)
                                  </span>
                                  <span className="text-xs font-bold text-emerald-800 font-mono">
                                    Class {timetableData.class.name} • 1448 H
                                  </span>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mt-1">
                                  {timetableData.class.masool?.name || "Assigned Faculty Masool"}
                                </h3>
                                <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-3 flex-wrap">
                                  {timetableData.class.masool?.its && (
                                    <span className="font-mono">ITS: <strong>{timetableData.class.masool.its}</strong></span>
                                  )}
                                  {timetableData.class.masool?.email && (
                                    <span>Email: <strong>{timetableData.class.masool.email}</strong></span>
                                  )}
                                  <span>Room: <strong>{timetableData.class.roomNumber}</strong></span>
                                </div>
                              </div>
                            </div>

                            <Button
                              onClick={() => window.print()}
                              variant="outline"
                              size="sm"
                              className="text-xs font-bold gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" /> Print Timetable
                            </Button>
                          </div>
                        </div>

                        {/* Badal Duties / Substitute Notice for today if any */}
                        {timetableData.badalToday && timetableData.badalToday.length > 0 && (
                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs">
                            <div className="font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-700" /> Today&apos;s Substitution Notice
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {timetableData.badalToday.map((b: any) => (
                                <p key={b.id} className="text-slate-800 font-medium">
                                  Period {b.period} ({b.startTime}–{b.endTime}) {b.subject}: <strong>{b.badalTeacher}</strong> is taking class today in place of {b.originalTeacher}.
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Full Weekly Timetable Grid */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-black text-slate-900">
                                Weekly Lesson Schedule — Class {timetableData.class.name}
                              </h4>
                              <p className="text-xs text-slate-500">
                                6 Days (Monday to Saturday) • 9 Academic Periods Daily
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono border-emerald-300 text-emerald-800 bg-emerald-50">
                              30 Weekly Periods
                            </Badge>
                          </div>

                          {/* Mobile Swipe Hint */}
                          <div className="lg:hidden px-3.5 py-2 bg-amber-50/90 border-b border-amber-200/70 text-[11px] text-amber-950 font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className="animate-pulse">👉</span> Swipe horizontally to view all periods
                            </span>
                            <span className="font-mono text-[10px] text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full border border-amber-300">
                              Mon – Sat
                            </span>
                          </div>

                          <div className="overflow-x-auto touch-pan-x scrollbar-thin">
                            <table className="w-full border-collapse min-w-[900px]">
                              <thead>
                                <tr className="bg-[#1c1c1c] text-white">
                                  <th className="p-3 text-left text-xs font-black uppercase tracking-wider border-r border-emerald-900/60 w-28">
                                    Day / Period
                                  </th>
                                  {[
                                    { period: 1, time: "10:30 – 11:00", label: "P1" },
                                    { period: 2, time: "11:00 – 11:30", label: "P2" },
                                    { period: 3, time: "11:30 – 12:00", label: "P3" },
                                    { period: 4, time: "12:00 – 12:30", label: "P4" },
                                    { period: 5, time: "12:30 – 13:00", label: "P5" },
                                    { period: 6, time: "14:15 – 14:45", label: "P6" },
                                    { period: 7, time: "14:45 – 15:15", label: "P7" },
                                    { period: 8, time: "15:15 – 15:45", label: "P8" },
                                    { period: 9, time: "15:45 – 16:15", label: "P9" },
                                  ].map((p) => (
                                    <th key={p.period} className="p-2.5 text-center border-r border-emerald-900/60 last:border-r-0 min-w-[110px]">
                                      <div className="text-xs font-black text-amber-300">{p.label}</div>
                                      <div className="text-[10px] font-mono opacity-80 mt-0.5">{p.time}</div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { day: 1, name: "Monday" },
                                  { day: 2, name: "Tuesday" },
                                  { day: 3, name: "Wednesday" },
                                  { day: 4, name: "Thursday" },
                                  { day: 5, name: "Friday" },
                                  { day: 6, name: "Saturday" },
                                ].map((d) => (
                                  <tr key={d.day} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                    <td className="p-3 font-black text-xs text-slate-900 border-r border-slate-200/80 bg-slate-50/80">
                                      {d.name}
                                    </td>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pNum) => {
                                      const slot = (timetableData.slots || []).find(
                                        (s: any) => s.dayOfWeek === d.day && s.period === pNum
                                      );
                                      return (
                                        <td key={pNum} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                                          {slot ? (
                                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-200/70 shadow-2xs">
                                              <div className="text-xs font-black text-slate-900 leading-tight">
                                                {slot.subject}
                                              </div>
                                              <div className="text-[11px] text-emerald-800 font-semibold mt-1 truncate" title={slot.teacherName}>
                                                {slot.teacherName}
                                              </div>
                                              <div className="text-[9px] font-mono text-slate-400 mt-1">
                                                {slot.roomNumber || `Room ${timetableData.class.name}`}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="h-14 flex items-center justify-center text-[10px] text-slate-300 font-medium">
                                              —
                                            </div>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
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
