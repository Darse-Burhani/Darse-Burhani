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
  MessageCircle,
  Phone,
  Loader2,
  Library,
  BookMarked,
  AlertTriangle,
  UserCheck,
  Lock,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { toast } from "@/components/ui/toast";
import { getInitials, timeAgo, formatPoints } from "@/lib/utils";
import { isRabiAlAkhirDate } from "@/lib/fatimi-calendar";
import { ParentNotificationCenter } from "@/components/parent/ParentNotificationCenter";
import { ParentLeaveManager } from "@/components/parent/ParentLeaveManager";
import { usePortalAccess } from "@/context/PortalAccessContext";

type ParentTab = "overview" | "tracking" | "library" | "timetable" | "leave";

const TABS: Array<{ id: ParentTab; label: string; labelAr: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", labelAr: "نظرة عامة", icon: Heart },
  { id: "tracking", label: "Attendance", labelAr: "الحضور والغياب", icon: Navigation },
  { id: "library", label: "Library Books", labelAr: "الكتب المستعارة", icon: Library },
  { id: "timetable", label: "Class Timetable", labelAr: "الجدول الدراسي", icon: BookOpen },
  { id: "leave", label: "Leave Applications", labelAr: "الإجازات", icon: CalendarDays },
];

export default function ParentDashboard({ defaultTab }: { defaultTab?: ParentTab }) {
  const location = useLocation();
  const initialResolvedTab: ParentTab = useMemo(() => {
    if (defaultTab) return defaultTab;
    const path = (location.pathname || "").toLowerCase();
    if (path.includes("/tracking")) return "tracking";
    if (path.includes("/timetable")) return "timetable";
    if (path.includes("/library")) return "library";
    if (path.includes("/leave")) return "leave";
    const sp = new URLSearchParams(location.search);
    const tabParam = sp.get("tab") as ParentTab;
    if (tabParam && ["overview", "tracking", "library", "timetable", "leave"].includes(tabParam)) {
      return tabParam;
    }
    return "overview";
  }, [defaultTab, location.pathname, location.search]);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ParentTab>(initialResolvedTab);
  const [trackingLogs, setTrackingLogs] = useState<any[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialResolvedTab);
  }, [initialResolvedTab]);

  // Class Timetable & Masool State
  const [timetableData, setTimetableData] = useState<any>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableDay, setTimetableDay] = useState<number>(() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 6 ? d : 1;
  });
  const [timetableLayout, setTimetableLayout] = useState<"day" | "grid">("day");

  const { isModuleVisible } = usePortalAccess();

  const visibleTabs = useMemo(() => {
    return TABS.filter((tab) => {
      const modKey = tab.id === "overview" ? "dashboard" : tab.id;
      return isModuleVisible(modKey, "PARENT");
    });
  }, [isModuleVisible]);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

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

  // Fetch Library Loans for selected child
  const [libraryData, setLibraryData] = useState<any>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const fetchLibrary = useCallback(async (isManual = false) => {
    if (!selectedChild) return;
    if (isManual) setLibraryLoading(true);
    try {
      const childId = selectedChild.studentProfileId || selectedChild.id;
      const res = await fetch(`/api/parent/library?studentId=${encodeURIComponent(childId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setLibraryData(json.data);
        if (isManual) {
          toast({ variant: "default", title: "Library Synced", description: "Issued books and borrowing records are up to date." });
        }
      }
    } catch {
    } finally {
      if (isManual) setLibraryLoading(false);
    }
  }, [selectedChild]);

  useEffect(() => {
    if (activeTab === "library") {
      fetchLibrary();
    }
  }, [activeTab, fetchLibrary]);

  // Active and returned books with fallback to dashboard payload
  const activeIssuedBooks = useMemo(() => {
    if (libraryData?.activeLoans) return libraryData.activeLoans;
    return selectedChild?.issuedBooks || [];
  }, [libraryData, selectedChild]);

  const returnedBooksHistory = useMemo(() => {
    if (libraryData?.returnedLoans) return libraryData.returnedLoans;
    return selectedChild?.returnedBooks || [];
  }, [libraryData, selectedChild]);

  const activeLoansCount = activeIssuedBooks.length;
  const overdueLoansCount = activeIssuedBooks.filter((b: any) => b.isOverdue || (b.rawStatus === "ACTIVE" && new Date(b.dueAt).getTime() < Date.now())).length;

  // Last-7-days strip derived from tracking scans (excluding Rabi ul Akhar days)
  const weekStrip = useMemo(() => {
    const days: Array<{
      date: Date;
      label: string;
      present: boolean;
      time: string | null;
      compactTime: string | null;
      isToday: boolean;
      isWeekend: boolean;
    }> = [];
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

      const isToday = i === 0;
      const isWeekend = d.getDay() === 0; // Sunday
      const rawTime = !isRabi
        ? (match?.checkInTime
            ? new Date(match.checkInTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : selectedChild?.isCheckedIn && isToday && selectedChild?.lastCheckIn
            ? new Date(selectedChild.lastCheckIn).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : null)
        : null;

      const compactTime = rawTime
        ? rawTime.replace(/\s*AM/i, "a").replace(/\s*PM/i, "p").trim()
        : null;

      days.push({
        date: d,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        present: !isRabi && (!!match || (selectedChild?.isCheckedIn && isToday)),
        time: rawTime,
        compactTime,
        isToday,
        isWeekend,
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
                    <span className="rounded-full border border-amber-300/60 bg-stone-950 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-300 shadow-xs">
                      Parent Guardian Portal
                    </span>
                    <span className="text-xs text-stone-200 font-semibold">
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
                    Afzalus Salam, {parentProfile?.firstName || "Parent"}!
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-stone-200 font-semibold">
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
                <a
                  href={`https://wa.me/918955199220?text=${encodeURIComponent(
                    `Salam, I need assistance from Darse Burhani Administration regarding my child ${selectedChild?.firstName || "Student"} (ITS: ${selectedChild?.its || "—"}):`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 inline-flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-700 hover:bg-emerald-800 px-3.5 text-xs font-black text-white shadow-xs backdrop-blur-xs transition-all active:scale-[0.98]"
                  title="Official WhatsApp Helpline (+91 8955199220)"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-300" />
                  <span className="hidden sm:inline">Helpline</span>
                  <span className="font-mono text-[11px] text-emerald-200">+91 8955199220</span>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDashboard(true)}
                  disabled={refreshing || loading}
                  className="h-10 gap-2 rounded-xl border border-stone-700 bg-stone-900 hover:bg-stone-800 px-4 text-xs font-bold text-white shadow-xs backdrop-blur-xs transition-all active:scale-[0.98]"
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
              <h3 className="text-xl font-black text-slate-950">No Talabat Linked Yet</h3>
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
              <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
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
                          ? "bg-stone-950 text-white border border-amber-400/50"
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
                        <p className={`text-xs font-bold ${isSelected ? "text-amber-200" : "text-stone-600"}`}>
                          ITS: {child.its} · Gr {child.grade}{child.section ? `-${child.section}` : ""}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            child.isCheckedIn
                              ? isSelected ? "bg-emerald-950 text-emerald-200 border border-emerald-500/50" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : isSelected ? "bg-white/10 text-stone-300 border border-white/10" : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${child.isCheckedIn ? "animate-pulse bg-emerald-400" : "bg-slate-400"}`} />
                            {child.isCheckedIn ? "On Campus" : "Awaiting Scan"}
                          </span>
                          {isHafiz && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSelected ? "bg-amber-950 text-amber-200 border border-amber-500/50" : "bg-amber-50 text-amber-900 border border-amber-200"
                            }`}>
                              Hafiz
                            </span>
                          )}
                        </div>

                        {/* Prominently Highlighted Class Masool Name for All Talabt */}
                        <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-amber-400/20 text-amber-200 border border-amber-400/40 shadow-xs"
                            : "bg-gradient-to-r from-emerald-50 to-amber-50/50 text-emerald-950 border border-emerald-200/80"
                        }`}>
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className={`text-[10px] uppercase font-black tracking-wide ${isSelected ? "text-amber-300" : "text-amber-700"}`}>
                            مسؤول:
                          </span>
                          <span className="truncate font-black">
                            {child.academicClass?.masoolName || child.masoolName || "Faculty Masool"}
                          </span>
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
                {visibleTabs.length === 0 ? (
                  <div className="w-full py-2.5 px-4 text-center text-xs text-amber-900 font-bold flex items-center justify-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Portal Modules Managed by Administration</span>
                  </div>
                ) : (
                  visibleTabs.map((t) => {
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
                          <span className="flex items-center gap-1.5">
                            {t.label}
                            {t.id === "library" && (activeLoansCount > 0) && (
                              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                                overdueLoansCount > 0
                                  ? "bg-rose-600 text-white animate-pulse"
                                  : active
                                  ? "bg-amber-400 text-stone-950"
                                  : "bg-emerald-600 text-white"
                              }`}>
                                {activeLoansCount}
                              </span>
                            )}
                          </span>
                          <span className={`text-[10px] mt-0.5 font-semibold ${active ? "text-amber-300" : "text-stone-600"}`}>
                            {t.labelAr}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
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

                            <p className="mt-0.5 text-xs sm:text-sm text-slate-700 font-medium">
                              {selectedChild.lastCheckIn ? (
                                <>
                                  Check-in at{" "}
                                  <strong className="text-emerald-950 font-black">
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
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-center min-w-[110px]">
                            <span className="block text-xs font-black uppercase text-emerald-950">7-Day Attendance</span>
                            <span className="text-lg font-black text-emerald-950">
                              {selectedChild.attendanceRateLast7 ?? 100}%
                            </span>
                          </div>
                          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-3.5 text-center min-w-[110px]">
                            <span className="block text-xs font-black uppercase text-teal-950">Campus Status</span>
                            <span className="flex items-center justify-center gap-1 text-sm font-black text-teal-950 mt-0.5">
                              {selectedChild.isCheckedIn ? "Checked In" : "Not Present"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Highlighted Class & Masool Banner for Selected Child */}
                    <div className="rounded-3xl border border-amber-300/80 bg-stone-950 border border-amber-400/80 p-5 shadow-sm text-white">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-13 h-13 rounded-2xl bg-amber-400 text-stone-950 ring-2 ring-amber-300 flex items-center justify-center shrink-0 shadow-md">
                            <GraduationCap className="w-7 h-7" strokeWidth={2} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-stone-950 px-2.5 py-0.5 rounded-full shadow-xs">
                                مسؤول الصف • Class Masool
                              </span>
                              <span className="text-xs font-mono font-bold text-amber-200">
                                Class {selectedChild.academicClass?.name || `${selectedChild.grade} ${selectedChild.section}`.trim()} • 1448 H
                              </span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-extrabold text-white mt-1">
                              {selectedChild.academicClass?.masoolName || selectedChild.masoolName || "Faculty In-Charge"}
                            </h3>
                            <p className="text-xs text-stone-200 mt-0.5 font-medium">
                              Darajah Academic In-Charge for <strong className="text-amber-200">{selectedChild.firstName} {selectedChild.lastName}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                          <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900 border border-amber-400/40 text-amber-300 text-xs font-extrabold">
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            Academic Guidance
                          </span>
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
                            <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">{s.label}</span>
                            <span className="text-lg font-extrabold text-gray-900">{s.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ═══ Issued Library Books Quick Card on Overview ═══ */}
                    <Card className="rounded-3xl border-slate-200/90 shadow-sm overflow-hidden bg-white">
                      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-5 bg-stone-950 text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold shadow-sm shrink-0">
                            <Library className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                              Issued Library Books (الكتب المستعارة)
                            </CardTitle>
                            <p className="text-xs text-amber-200/90 font-medium">
                              Darse Burhani Maktabat • {selectedChild.firstName}&apos;s Active Loans
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            activeLoansCount > 0
                              ? overdueLoansCount > 0
                                ? "bg-rose-600 text-white animate-pulse"
                                : "bg-amber-400 text-stone-950"
                              : "bg-emerald-600 text-white"
                          }`}>
                            {activeLoansCount > 0
                              ? `${activeLoansCount} On Loan`
                              : "All Returned"}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("library")}
                            className="text-xs font-bold text-white border-white/20 bg-white/10 hover:bg-white/20"
                          >
                            View All <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5">
                        {activeIssuedBooks && activeIssuedBooks.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeIssuedBooks.map((loan: any) => {
                              const isOverdue = loan.isOverdue || (loan.rawStatus === "ACTIVE" && new Date(loan.dueAt).getTime() < Date.now());
                              const dueFormatted = new Date(loan.dueAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              });
                              const borrowedFormatted = new Date(loan.borrowedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              });
                              return (
                                <div
                                  key={loan.id}
                                  className={`p-4 rounded-2xl border transition-all ${
                                    isOverdue
                                      ? "bg-rose-50/70 border-rose-200 ring-1 ring-rose-300/50"
                                      : "bg-slate-50/70 border-slate-200/90 hover:border-amber-300"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div className={`w-11 h-14 rounded-lg flex items-center justify-center shrink-0 shadow-xs border ${
                                        isOverdue ? "bg-rose-100 border-rose-300 text-rose-700" : "bg-amber-100 border-amber-300 text-amber-900"
                                      }`}>
                                        <BookOpen className="w-6 h-6" />
                                      </div>
                                      <div className="min-w-0">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-800">
                                          {loan.category || "General"}
                                        </span>
                                        <h4 className="text-sm font-black text-slate-900 truncate mt-1" title={loan.title}>
                                          {loan.title}
                                        </h4>
                                        <p className="text-xs text-slate-600 font-medium truncate">
                                          By {loan.author || "Maktabat Darse Burhani"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs flex-wrap gap-2">
                                    <div className="text-slate-600 font-medium">
                                      Borrowed: <strong className="text-slate-900">{borrowedFormatted}</strong>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                                        isOverdue
                                          ? "bg-rose-600 text-white"
                                          : (loan.daysRemaining ?? 10) <= 3
                                          ? "bg-amber-500 text-white"
                                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                      }`}>
                                        {isOverdue ? `Overdue • Due: ${dueFormatted}` : `Due: ${dueFormatted}`}
                                      </span>
                                    </div>
                                  </div>

                                  {loan.barcode && (
                                    <div className="mt-2 text-[10px] font-mono text-slate-500">
                                      Barcode: <span className="font-bold text-slate-800">{loan.barcode}</span>
                                      {loan.location && (
                                        <span className="ml-2 text-slate-600 font-sans">• Shelf: <strong className="text-slate-800">{loan.location}</strong></span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <h5 className="text-sm font-bold text-emerald-950">No Books Currently Issued</h5>
                                <p className="text-xs text-emerald-800">
                                  {selectedChild.firstName} has returned all borrowed books. All library accounts are clear.
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveTab("library")}
                              className="text-xs font-bold border-emerald-300 text-emerald-900 hover:bg-emerald-100/50 shrink-0"
                            >
                              Borrowing History
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recent Classroom, Library & Attendance Activity Live Feed */}
                    <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden w-full">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-5">
                          <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                            <Activity size={16} className="text-emerald-700" />
                            Recent Activity, Library &amp; Attendance
                          </CardTitle>
                          <span className="rounded-full border border-emerald-300 bg-emerald-100/90 px-2.5 py-1 text-xs font-black text-emerald-950">
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
                                      <span className="shrink-0 text-xs font-semibold text-slate-600">{timeAgo(new Date(act.createdAt))}</span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{act.detail}</p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="py-6 text-center text-xs text-gray-400">No activity logs recorded yet today.</p>
                          )}
                          <Link href="/parent/activity" className="flex items-center justify-center gap-1 pt-1 text-xs font-black text-emerald-950 hover:underline">
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
                    <div className="rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-6 shadow-sm overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
                        <h3 className="flex items-center gap-2 text-sm sm:text-base font-black text-slate-900">
                          <Calendar size={18} className="text-emerald-700 shrink-0" />
                          7-Day Attendance History
                        </h3>
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-black text-amber-950 border border-amber-200/90 shadow-2xs">
                          {selectedChild.daysPresentLast7 ?? 0}/7 Days Present · {selectedChild.attendanceRateLast7 ?? 100}% Rate
                        </span>
                      </div>

                      {/* Responsive 7-Pill Strip */}
                      <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
                        {weekStrip.map((d: any, i: number) => {
                          const isSun = d.isWeekend || d.label === "Sun";
                          const isToday = d.isToday;
                          const isPresent = d.present;

                          return (
                            <div
                              key={i}
                              className={`rounded-2xl sm:rounded-3xl px-0.5 py-2 sm:px-2 sm:py-3 text-center transition-all flex flex-col items-center justify-between min-h-[116px] sm:min-h-[135px] relative overflow-hidden ${
                                isToday
                                  ? "border-2 border-amber-400 bg-gradient-to-b from-amber-50/90 via-white to-amber-50/40 shadow-xs ring-1 ring-amber-400/50"
                                  : isPresent
                                  ? "border border-amber-200/90 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 shadow-2xs"
                                  : isSun
                                  ? "border border-slate-200/80 bg-slate-50/50"
                                  : "border border-slate-200 bg-slate-50/60"
                              }`}
                            >
                              {/* Day Label */}
                              <span
                                className={`text-[10px] sm:text-[11px] font-black uppercase tracking-tight block ${
                                  isToday
                                    ? "text-amber-950"
                                    : isPresent
                                    ? "text-slate-800"
                                    : isSun
                                    ? "text-slate-600"
                                    : "text-slate-500"
                                }`}
                              >
                                {d.label}
                              </span>

                              {/* Status Circle (strictly sized to never clip or overflow card borders) */}
                              <div
                                className={`my-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black transition-transform ${
                                  isPresent
                                    ? "bg-gradient-to-br from-amber-400 to-amber-500 text-stone-950 shadow-xs ring-1 ring-amber-300"
                                    : isSun
                                    ? "bg-slate-200/80 text-slate-500"
                                    : "bg-slate-200 text-slate-400"
                                }`}
                              >
                                {isPresent ? (
                                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                                ) : (
                                  <span className="text-[11px] font-bold leading-none">—</span>
                                )}
                              </div>

                              {/* Date Number & Month (Clean 2-line vertical stack) */}
                              <div className="flex flex-col items-center justify-center leading-none">
                                <span className="text-[11px] sm:text-xs font-black text-slate-900">
                                  {d.date.getDate()}
                                </span>
                                <span className="text-[8.5px] sm:text-[9.5px] uppercase font-bold text-slate-600 mt-0.5">
                                  {d.date.toLocaleDateString("en-US", { month: "short" })}
                                </span>
                              </div>

                              {/* Verified Scan Time or Status (No truncation dots / no trailing '0.') */}
                              <div className="mt-1 w-full min-h-[14px] flex items-center justify-center">
                                {d.time ? (
                                  <span
                                    className="block text-[8px] sm:text-[10px] font-mono font-black text-amber-950 bg-amber-200/70 px-1 py-0.2 rounded-sm leading-none whitespace-nowrap"
                                    title={d.time}
                                  >
                                    <span className="sm:hidden">{d.compactTime || d.time.replace(/:\d\d\s*/, '').replace(/\s*(AM|PM)/i, (m: string) => m[0].toLowerCase())}</span>
                                    <span className="hidden sm:inline">{d.time}</span>
                                  </span>
                                ) : (
                                  <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 leading-none">
                                    {isSun ? "Off" : "—"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                    TAB: LIBRARY BOOKS & BORROWING LEDGER
                ───────────────────────────────────────────────────────────── */}
                {activeTab === "library" && (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="rounded-3xl border border-amber-300/80 bg-stone-950 p-6 shadow-sm text-white relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div className="flex items-start sm:items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center font-black shadow-md shrink-0 ring-2 ring-amber-300">
                            <Library className="w-7 h-7" strokeWidth={1.75} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-stone-950 px-2.5 py-0.5 rounded-full shadow-2xs">
                                مكتبة درس برهاني • Maktabat Ledger
                              </span>
                              <span className="text-xs font-mono font-bold text-amber-200">
                                Academic Year 1448 H
                              </span>
                            </div>
                            <h3 className="text-xl font-black text-white mt-1">
                              Issued Library Books for {selectedChild.firstName} {selectedChild.lastName}
                            </h3>
                            <div className="text-xs text-stone-300 mt-0.5 flex items-center gap-3 flex-wrap font-medium">
                              <span>Student: <strong className="text-white">{selectedChild.firstName} {selectedChild.lastName}</strong></span>
                              <span className="font-mono">ITS: <strong className="text-amber-300">{selectedChild.its}</strong></span>
                              <span>Class: <strong className="text-emerald-300">{selectedChild.className || `${selectedChild.grade} ${selectedChild.section}`.trim()}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fetchLibrary(true)}
                            disabled={libraryLoading}
                            className="w-full sm:w-auto text-xs font-bold bg-stone-900 border-amber-400/40 text-amber-300 hover:bg-stone-800 hover:text-white"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${libraryLoading ? "animate-spin" : ""}`} />
                            {libraryLoading ? "Syncing..." : "Sync Library Status"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Metrics 4-Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block">
                          Currently On Loan
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black text-slate-900">{activeLoansCount}</span>
                          <span className="text-xs font-bold text-slate-500">books</span>
                        </div>
                      </div>

                      <div className={`p-4 rounded-2xl border shadow-2xs ${
                        overdueLoansCount > 0 ? "bg-rose-50 border-rose-200 text-rose-950" : "bg-white border-slate-200"
                      }`}>
                        <span className={`text-[11px] font-extrabold uppercase tracking-wider block ${
                          overdueLoansCount > 0 ? "text-rose-800" : "text-slate-700"
                        }`}>
                          Overdue Books
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-2xl font-black ${overdueLoansCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            {overdueLoansCount}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {overdueLoansCount > 0 ? "action needed" : "all on time"}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block">
                          Returned History
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black text-emerald-800">{returnedBooksHistory.length}</span>
                          <span className="text-xs font-bold text-slate-500">completed</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block">
                          Total Borrowed
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black text-indigo-900">{activeLoansCount + returnedBooksHistory.length}</span>
                          <span className="text-xs font-bold text-slate-500">all time</span>
                        </div>
                      </div>
                    </div>

                    {/* Overdue Alert Banner if any */}
                    {overdueLoansCount > 0 && (
                      <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex items-start gap-3.5 shadow-xs">
                        <div className="p-2 rounded-xl bg-rose-200/80 text-rose-800 shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5 text-rose-700" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-rose-950">
                            Library Notice: {overdueLoansCount} Book(s) Overdue
                          </h4>
                          <p className="text-xs text-rose-800 mt-0.5 font-medium">
                            One or more books issued to {selectedChild.firstName} have exceeded the scheduled loan return date. Please ensure the book(s) are handed back to the library coordinator to avoid borrowing restrictions.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Section 1: Active Issued Books */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                        <div>
                          <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-emerald-700" />
                            Currently Issued Books (الكتب المستعارة حالياً)
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Books currently in possession of {selectedChild.firstName}
                          </p>
                        </div>
                        <Badge className="self-start sm:self-auto bg-stone-900 text-amber-300 text-xs font-bold">
                          {activeLoansCount} Active {activeLoansCount === 1 ? "Book" : "Books"}
                        </Badge>
                      </div>

                      <div className="p-5">
                        {activeIssuedBooks.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeIssuedBooks.map((loan: any) => {
                              const isOverdue = loan.isOverdue || (loan.rawStatus === "ACTIVE" && new Date(loan.dueAt).getTime() < Date.now());
                              const dueFormatted = new Date(loan.dueAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              });
                              const borrowedFormatted = new Date(loan.borrowedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              });
                              return (
                                <div
                                  key={loan.id}
                                  className={`rounded-2xl border p-5 transition-all ${
                                    isOverdue
                                      ? "bg-rose-50/70 border-rose-300 ring-1 ring-rose-300/60 shadow-xs"
                                      : "bg-slate-50/70 border-slate-200 hover:border-amber-400 hover:shadow-xs"
                                  }`}
                                >
                                  <div className="flex items-start gap-4">
                                    <div className={`w-14 h-20 rounded-xl flex flex-col items-center justify-center shrink-0 border shadow-xs ${
                                      isOverdue
                                        ? "bg-rose-100 border-rose-300 text-rose-800"
                                        : "bg-amber-100/80 border-amber-300 text-amber-900"
                                    }`}>
                                      <BookOpen className="w-7 h-7" />
                                      <span className="text-[9px] font-black uppercase mt-1 tracking-tight">Maktabat</span>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                                          {loan.category || "General"}
                                        </span>
                                        {loan.location && (
                                          <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                            Shelf: {loan.location}
                                          </span>
                                        )}
                                      </div>

                                      <h5 className="text-base font-black text-slate-900 mt-1.5 leading-snug">
                                        {loan.title}
                                      </h5>
                                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                                        Author: <strong className="text-slate-800">{loan.author || "Maktabat Darse Burhani"}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mt-4 pt-4 border-t border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Issue Date</span>
                                      <span className="font-bold text-slate-900 text-xs mt-0.5 block">{borrowedFormatted}</span>
                                    </div>
                                    <div className={`p-2.5 rounded-xl border ${
                                      isOverdue ? "bg-rose-100/80 border-rose-300" : "bg-emerald-50/80 border-emerald-200"
                                    }`}>
                                      <span className={`text-[10px] uppercase font-bold block ${
                                        isOverdue ? "text-rose-900" : "text-emerald-900"
                                      }`}>
                                        Return Due Date
                                      </span>
                                      <span className={`font-black text-xs mt-0.5 block ${
                                        isOverdue ? "text-rose-950 font-black" : "text-emerald-950"
                                      }`}>
                                        {dueFormatted}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-xs">
                                    <div className="font-mono text-[11px] text-slate-600">
                                      Barcode: <strong className="text-slate-900">{loan.barcode || "—"}</strong>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                                      isOverdue
                                        ? "bg-rose-600 text-white animate-pulse"
                                        : (loan.daysRemaining ?? 10) <= 3
                                        ? "bg-amber-500 text-white"
                                        : "bg-emerald-600 text-white"
                                    }`}>
                                      {isOverdue ? "Overdue" : `Due in ${loan.daysRemaining ?? 0} days`}
                                    </span>
                                  </div>

                                  {loan.garamat && loan.garamat.calculatedAmount > 0 && (
                                    <div className="mt-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-xs flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                        <span>Late Garamat ({loan.garamat.daysLate}d @ ₹10/day):</span>
                                      </div>
                                      <span className="font-mono font-black text-rose-950">
                                        ₹{loan.garamat.calculatedAmount} [{loan.garamat.status}]
                                      </span>
                                    </div>
                                  )}

                                  {loan.notes && !loan.notes.toLowerCase().includes("garamat") && !loan.notes.startsWith("{") && (
                                    <div className="mt-2.5 p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-950">
                                      <strong>Note:</strong> {loan.notes}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-12 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                              <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <h5 className="text-base font-bold text-slate-900">No Books Currently on Loan</h5>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                              All books issued to {selectedChild.firstName} have been returned in full. New books can be issued directly at the Maktabat.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Reading History (Returned Books) */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                        <div>
                          <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <BookMarked className="w-5 h-5 text-amber-700" />
                            Reading &amp; Borrowing History (سجل المطالعة السابق)
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Previously returned books and completed readings
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-full border border-slate-200">
                          {returnedBooksHistory.length} Returned
                        </span>
                      </div>

                      <div className="p-5">
                        {returnedBooksHistory.length > 0 ? (
                          <div className="space-y-3">
                            {returnedBooksHistory.map((loan: any) => {
                              const borrowedFormatted = new Date(loan.borrowedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              });
                              const returnedFormatted = loan.returnedAt
                                ? new Date(loan.returnedAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "Returned";
                              return (
                                <div
                                  key={loan.id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-12 rounded-lg bg-emerald-100/80 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                                      <Check className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                                        {loan.category || "General"}
                                      </span>
                                      <h5 className="text-sm font-black text-slate-900 mt-1">
                                        {loan.title}
                                      </h5>
                                      <p className="text-xs text-slate-600 font-medium">
                                        By {loan.author || "Maktabat Darse Burhani"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 shrink-0 sm:text-right text-xs">
                                    <div>
                                      <span className="text-[10px] font-mono text-slate-500 block">
                                        Barcode: {loan.barcode || "—"}
                                      </span>
                                      <span className="text-[11px] text-slate-600 mt-0.5 block">
                                        Issued: <strong className="text-slate-800">{borrowedFormatted}</strong> · Returned: <strong className="text-emerald-800">{returnedFormatted}</strong>
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs shrink-0">
                                      Returned &amp; Restocked
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            No completed borrowing history recorded yet for this academic term.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 3: Maktabat Reading Hall Visits */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden mt-6">
                      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                        <div>
                          <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-emerald-700" />
                            Maktabat Attendance &amp; Reading Sessions
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Librarian verified study sessions and library visits for {selectedChild.firstName}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          {libraryData?.attendances?.length ?? 0} Total Visits
                        </span>
                      </div>

                      <div className="p-5">
                        {libraryData?.attendances?.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {libraryData.attendances.map((att: any) => (
                              <div
                                key={att.id}
                                className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-xs flex items-center justify-between gap-3 text-xs hover:border-emerald-300 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2 border-emerald-500 ring-2 ring-emerald-100 shadow-2xs">
                                    <ProfilePhoto
                                      src={selectedChild?.avatarUrl}
                                      alt={selectedChild?.firstName || "Child"}
                                      className="w-full h-full"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">
                                      {new Date(att.date).toLocaleDateString("en-IN", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                      Marked Time: <strong className="text-emerald-800 font-bold">{new Date(att.checkInTime).toLocaleTimeString("en-IN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}</strong>
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                                  ✓ Arrived
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            No library attendance records logged yet for {selectedChild.firstName}.
                          </div>
                        )}
                      </div>
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
                      canApply={isModuleVisible("leave", "PARENT")}
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
                        {/* Class & Madrasah Helpdesk Banner */}
                        <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/50 p-6 shadow-xs">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-amber-300 ring-2 ring-amber-400 flex items-center justify-center shrink-0 shadow-md">
                                <BookOpen className="w-7 h-7" strokeWidth={1.75} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-2xs">
                                    Academic Schedule (الجدول الدراسي)
                                  </span>
                                  <span className="text-xs font-bold text-emerald-800 font-mono">
                                    Class {timetableData.class.name} • 1448 H
                                  </span>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mt-1">
                                  Class {timetableData.class.name} • Darajah Academic Division
                                </h3>
                                <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-3 flex-wrap">
                                  <span>Student: <strong className="text-slate-900">{selectedChild.firstName} {selectedChild.lastName}</strong></span>
                                  <span className="font-mono">ITS: <strong className="text-slate-900">{selectedChild.its}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Highlighted Class Masool (مسؤول الصف) */}
                            <div className="flex items-center gap-3.5 p-3.5 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-br from-stone-900 via-stone-900 to-emerald-950 text-white border-2 border-amber-400 shadow-md shrink-0 w-full md:w-auto">
                              <Avatar className="w-12 h-12 rounded-xl ring-2 ring-amber-400 shadow-sm shrink-0">
                                {(timetableData.masool?.avatarUrl || timetableData.class.masool?.avatarUrl || selectedChild.academicClass?.masoolAvatar) && (
                                  <AvatarImage src={timetableData.masool?.avatarUrl || timetableData.class.masool?.avatarUrl || selectedChild.academicClass?.masoolAvatar} alt="Class Masool" />
                                )}
                                <AvatarFallback className="bg-stone-800 text-amber-300 font-bold font-display rounded-xl">
                                  {getInitials(timetableData.masool?.name || timetableData.class.masool?.name || selectedChild.academicClass?.masoolName || "Masool")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-300 text-stone-950 px-2.5 py-0.5 rounded-full shadow-xs">
                                    مسؤول الصف • Class Masool
                                  </span>
                                  {(timetableData.masool?.its || selectedChild.academicClass?.masoolIts) && (
                                    <span className="text-[11px] font-mono text-amber-200/90 font-bold">
                                      ITS: {timetableData.masool?.its || selectedChild.academicClass?.masoolIts}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-base font-black text-amber-300 mt-0.5 tracking-tight truncate">
                                  {timetableData.masool?.name || timetableData.class.masool?.name || selectedChild.academicClass?.masoolName || selectedChild.masoolName || "Faculty In-Charge"}
                                </h4>
                                <p className="text-[11px] text-emerald-200 font-semibold truncate">
                                  Department of Attalimiyah • Class {timetableData.class.name}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Substitution Notice for today if any */}
                        {timetableData.badalToday && timetableData.badalToday.length > 0 && (
                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs">
                            <div className="font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-700" /> Today&apos;s Class Schedule Notice
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {timetableData.badalToday.map((b: any) => (
                                <p key={b.id} className="text-slate-800 font-medium">
                                  Period {b.period} ({b.startTime}–{b.endTime}) {b.subject}: Class is scheduled with designated faculty supervision.
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Timetable Container with Day View & Grid View */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-black text-slate-900">
                                Weekly Lesson Schedule — Class {timetableData.class.name}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                6 Days (Monday to Saturday) • 9 Academic Periods Daily
                              </p>
                            </div>
                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                              <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60">
                                <button
                                  type="button"
                                  onClick={() => setTimetableLayout("day")}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    timetableLayout === "day"
                                      ? "bg-stone-900 text-amber-300 shadow-xs"
                                      : "text-slate-600 hover:text-slate-900"
                                  }`}
                                >
                                  Day View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTimetableLayout("grid")}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    timetableLayout === "grid"
                                      ? "bg-stone-900 text-amber-300 shadow-xs"
                                      : "text-slate-600 hover:text-slate-900"
                                  }`}
                                >
                                  Full Grid
                                </button>
                              </div>
                              <Badge variant="outline" className="text-xs font-mono border-emerald-300 text-emerald-800 bg-emerald-50 hidden md:inline-flex">
                                30 Weekly Periods
                              </Badge>
                            </div>
                          </div>

                          {/* Day View Mode (Default & Mobile-Optimized) */}
                          {timetableLayout === "day" ? (
                            <div>
                              {/* Day Selector Pills */}
                              <div className="p-2 sm:p-3 bg-stone-50/80 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                                {[
                                  { day: 1, name: "Monday", short: "Mon", ar: "الإثنين" },
                                  { day: 2, name: "Tuesday", short: "Tue", ar: "الثلاثاء" },
                                  { day: 3, name: "Wednesday", short: "Wed", ar: "الأربعاء" },
                                  { day: 4, name: "Thursday", short: "Thu", ar: "الخميس" },
                                  { day: 5, name: "Friday", short: "Fri", ar: "الجمعة" },
                                  { day: 6, name: "Saturday", short: "Sat", ar: "السبت" },
                                ].map((d) => {
                                  const isSelected = timetableDay === d.day;
                                  return (
                                    <button
                                      key={d.day}
                                      type="button"
                                      onClick={() => setTimetableDay(d.day)}
                                      className={`flex-1 min-w-[58px] sm:min-w-[85px] py-2 px-2 rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                                        isSelected
                                          ? "bg-stone-900 text-amber-300 shadow-sm ring-1 ring-amber-400/50"
                                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
                                      }`}
                                    >
                                      <span className="text-xs font-black">{d.short}</span>
                                      <span className={`text-[9.5px] mt-0.5 ${isSelected ? "text-amber-200/80" : "text-slate-400"}`}>
                                        {d.ar}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Daily Period Cards */}
                              <div className="p-3.5 sm:p-5 space-y-2.5">
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
                                ].map((p) => {
                                  const slot = (timetableData.slots || []).find(
                                    (s: any) => s.dayOfWeek === timetableDay && s.period === p.period
                                  );
                                  return (
                                    <div
                                      key={p.period}
                                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        slot
                                          ? "bg-gradient-to-r from-emerald-50/40 via-white to-amber-50/30 border-emerald-200/90 shadow-2xs"
                                          : "bg-slate-50/50 border-slate-200/70 text-slate-400"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3.5">
                                        <div
                                          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 font-mono shadow-xs ${
                                            slot
                                              ? "bg-stone-900 text-amber-300 ring-1 ring-amber-400/40"
                                              : "bg-slate-200 text-slate-500"
                                          }`}
                                        >
                                          <span className="text-xs font-black leading-none">{p.label}</span>
                                          <span className="text-[9px] font-semibold opacity-70 mt-0.5">#{p.period}</span>
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                              {p.time}
                                            </span>
                                            {slot && (
                                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                {slot.roomNumber || `Room ${timetableData.class.name}`}
                                              </span>
                                            )}
                                          </div>
                                          <h5 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                                            {slot ? slot.subject : "Independent Study / Free Period"}
                                          </h5>
                                        </div>
                                      </div>

                                      {slot ? (
                                        <div className="flex items-center gap-2 self-start sm:self-center pl-14 sm:pl-0">
                                          <span className="text-xs text-stone-800 font-bold bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl">
                                            👨‍🏫 {slot.teacherName || "Assigned Faculty"}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-400 font-medium pl-14 sm:pl-0">No instruction scheduled</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            /* Full Weekly Grid Mode */
                            <div>
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
                          )}
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
