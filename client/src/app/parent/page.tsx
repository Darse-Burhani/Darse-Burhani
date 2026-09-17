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
  AlertCircle,
  Calendar,
  Sparkles,
  Loader2,
  BookOpen,
  Users,
  GraduationCap,
  MapPin,
  Droplet,
  Copy,
  Check,
  Phone,
  RefreshCw,
  Eye,
  ExternalLink,
  Crown,
  Share2,
  Flame,
  Star,
  Building2,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials, timeAgo, formatPoints, getTierStyle } from "@/lib/utils";
import { ParentNotificationCenter } from "@/components/parent/ParentNotificationCenter";

const activityIcons: Record<string, any> = {
  POINTS: Award,
  ATTENDANCE: Clock,
  BADGE: Award,
  CHECK_IN: Clock,
};

const activityColors: Record<string, string> = {
  POINTS: "text-amber-700 bg-amber-100/80 border border-amber-200",
  ATTENDANCE: "text-emerald-700 bg-emerald-100/80 border border-emerald-200",
};

export default function ParentDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (isManual = false) => {
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
  }, [selectedChildId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const children: any[] = useMemo(() => data?.children || [], [data]);
  const parentProfile = data?.parent;

  const selectedChild = useMemo(() => {
    if (!children.length) return null;
    return children.find((c) => c.id === selectedChildId) || children[0];
  }, [children, selectedChildId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast({ variant: "default", title: "Copied", description: `${label} copied to clipboard.` });
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ══════════════════ HERO BANNER (Doppelrand) ══════════════════ */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="p-1 sm:p-2 rounded-[2.5rem] bg-emerald-950/15 ring-1 ring-emerald-900/25 shadow-2xl">
          <div
            className="relative overflow-hidden rounded-[calc(2.5rem-0.375rem)] text-white p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #022c22 0%, #047857 55%, #065f46 100%)" }}
          >
            {/* Fatimi Star Watermark Motif */}
            <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
              <svg viewBox="0 0 100 100" className="w-full h-full fill-amber-300">
                <polygon points="50,0 63,38 100,50 63,62 50,100 37,62 0,50 37,38" />
              </svg>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-300/40"
                  style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
                >
                  <Heart className="w-8 h-8 text-white fill-white/20" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 bg-black/25 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                      Parent Guardian Portal
                    </span>
                    <span className="text-xs text-emerald-200">
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
                    Salam, {parentProfile?.firstName || "Parent"}!
                  </h1>
                  <p className="text-emerald-100 text-xs sm:text-sm mt-0.5 font-medium">
                    {children.length} {children.length === 1 ? "Talabat (Student) assigned" : "Talabat (Students) assigned"} to your family account.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
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
                  className="bg-white/10 hover:bg-white/20 text-white border-white/25 rounded-2xl shadow-sm h-10 px-4 text-xs font-semibold gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Gold Accent Hairline Strip */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-90" />
          </div>
        </div>
      </motion.div>

      {/* ══════════════════ LOADING SKELETON ══════════════════ */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-white rounded-3xl border border-emerald-100 animate-pulse p-4" />
            ))}
          </div>
          <div className="h-48 bg-white rounded-3xl border border-emerald-100 animate-pulse" />
        </div>
      ) : children.length === 0 ? (
        /* ══════════════════ EMPTY STATE: NO CHILDREN ASSIGNED ══════════════════ */
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="p-1.5 rounded-[2.5rem] bg-emerald-950/5 ring-1 ring-emerald-900/10">
            <Card className="rounded-[calc(2.5rem-0.375rem)] border-2 border-dashed border-emerald-200 bg-emerald-50/20 text-center p-10">
              <CardContent className="space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center shadow-inner">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-gray-900 text-xl">No Talabat (Students) Assigned Yet</h3>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    Your parent account is registered, but no talabat students have been linked to your profile by the administration.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-emerald-100 text-xs text-gray-600 text-left space-y-2 shadow-xs">
                  <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#d4af37]" /> How to Link Your Children:
                  </p>
                  <p>1. Provide your registered ITS ID (<b>{parentProfile?.its || "—"}</b>) or phone to Darse Burhani Admin.</p>
                  <p>2. The administration will link your children to your Family Account in the Admin Directory.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ══════════════════ ASSIGNED TALABAT SWITCHER ══════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-gray-900 text-base flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#047857]" />
                Assigned Talabat ({children.length})
              </h2>
              <span className="text-xs text-gray-500 font-medium">Click on a student card to switch active view</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {children.map((child) => {
                const isSelected = selectedChild?.id === child.id;
                const isHafiz = child.status === "HAFIZ";

                return (
                  <div
                    key={child.id}
                    className={`p-1 rounded-[2rem] transition-all duration-300 ${
                      isSelected
                        ? "bg-gradient-to-b from-emerald-600/30 to-emerald-900/10 shadow-lg ring-2 ring-emerald-600"
                        : "bg-emerald-950/5 hover:bg-emerald-950/10"
                    }`}
                  >
                    <motion.button
                      type="button"
                      onClick={() => setSelectedChildId(child.id)}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      className="p-4 rounded-[calc(2rem-0.25rem)] text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden bg-white w-full cursor-pointer h-full"
                    >
                      {/* Top Status & Sanah */}
                      <div className="flex items-center justify-between gap-2 w-full mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${child.isCheckedIn ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                          <span className={`text-[11px] font-bold ${child.isCheckedIn ? "text-emerald-700" : "text-gray-500"}`}>
                            {child.isCheckedIn ? "Present on Campus" : "Awaiting Scan"}
                          </span>
                        </div>
                        <Badge className="text-[10px] bg-emerald-50 text-[#047857] border-emerald-200 font-extrabold uppercase">
                          Grade {child.grade}{child.section ? `-${child.section}` : ""}
                        </Badge>
                      </div>

                      {/* Avatar & Core Bio */}
                      <div className="flex items-center gap-3.5 w-full">
                        <Avatar className={`w-14 h-14 rounded-2xl border-2 shadow-sm shrink-0 ${
                          isHafiz ? "border-amber-400 ring-2 ring-amber-200" : "border-[#047857] ring-2 ring-emerald-100"
                        }`}>
                          {child.avatarUrl ? (
                            <AvatarImage
                              src={child.avatarUrl}
                              alt={child.firstName}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-[#047857] to-[#064e3b] text-white font-black text-base rounded-2xl">
                            {getInitials(child.firstName, child.lastName)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-display font-bold text-gray-900 text-base truncate">
                              {child.firstName} {child.lastName}
                            </h3>
                            {isHafiz && (
                              <span title="Hafiz Al-Quran">
                                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-xs font-semibold text-emerald-800 mt-0.5">
                            ITS: {child.its}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate font-medium">
                            {child.watan ? `${child.watan} • ` : ""}{child.currentPoints} Pts • {child.tier}
                          </p>
                        </div>
                      </div>

                      {/* Selected Indicator Bottom Pill */}
                      {isSelected && (
                        <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between w-full text-[11px] font-bold text-[#047857]">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Currently Viewing
                          </span>
                          <span className="text-[10px] bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Active
                          </span>
                        </div>
                      )}
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedChild && (
            <motion.div
              key={selectedChild.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* ══════════════════ PILLAR 1: LIVE CAMPUS SAFETY & BIOMETRIC ATTENDANCE ══════════════════ */}
              <div className="p-1 sm:p-1.5 rounded-[2.5rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-md">
                <div className="rounded-[calc(2.5rem-0.375rem)] border border-emerald-600/20 bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/40 p-6 sm:p-7">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Check-in Status */}
                    <div className="flex items-start sm:items-center gap-4">
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                          selectedChild.isCheckedIn
                            ? "bg-emerald-600 text-white ring-4 ring-emerald-200"
                            : "bg-gray-100 text-gray-400 border border-gray-200"
                        }`}
                      >
                        {selectedChild.isCheckedIn ? (
                          <CheckCircle2 className="w-8 h-8 text-white" />
                        ) : (
                          <Clock className="w-8 h-8" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={selectedChild.isCheckedIn ? "success" : "secondary"}
                            className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 ${
                              selectedChild.isCheckedIn ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {selectedChild.isCheckedIn ? "Checked In on Campus" : "Awaiting Morning Arrival"}
                          </Badge>
                          <span className="text-xs text-gray-500 font-medium">Live Biometric Terminal Sync</span>
                        </div>

                        <h3 className="font-display font-extrabold text-gray-900 text-xl leading-tight">
                          {selectedChild.isCheckedIn
                            ? `${selectedChild.firstName} is Safely at Darse Burhani`
                            : `No Scan Recorded for ${selectedChild.firstName} Today`}
                        </h3>

                        <p className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                          {selectedChild.lastCheckIn ? (
                            <>
                              <span className="font-bold text-emerald-800">
                                Morning Arrival: {new Date(selectedChild.lastCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span>•</span>
                              <span>Gate: {selectedChild.gate || "Main Gate"}</span>
                            </>
                          ) : (
                            "Attendance scan will update here in real-time when verified at the biometric terminal."
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Quick Stats & Navigation */}
                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center min-w-[105px] shadow-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">7-Day Rate</span>
                        <span className="text-base font-extrabold text-[#047857]">
                          {selectedChild.attendanceRateLast7 ?? 100}%
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center min-w-[105px] shadow-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Streak</span>
                        <span className="text-base font-extrabold text-amber-700 flex items-center justify-center gap-1">
                          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                          {selectedChild.streakDays || 0}d
                        </span>
                      </div>

                      <Link href="/parent/activity">
                        <Button variant="outline" size="sm" className="rounded-2xl border-emerald-200 text-[#047857] hover:bg-emerald-50 h-11 px-4 font-bold text-xs shadow-xs">
                          <Clock className="w-3.5 h-3.5 mr-1.5" /> Full Scan Log
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════════════ STATS CARDS ROW ══════════════════ */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-1 rounded-[1.75rem] bg-emerald-950/5 ring-1 ring-emerald-900/10">
                  <div className="bg-white rounded-[calc(1.75rem-0.25rem)] p-4 flex items-center gap-3.5 h-full">
                    <div className="p-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Today's Merits</span>
                      <span className="text-xl font-extrabold text-gray-900 num-tabular">+{selectedChild.pointsToday || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="p-1 rounded-[1.75rem] bg-emerald-950/5 ring-1 ring-emerald-900/10">
                  <div className="bg-white rounded-[calc(1.75rem-0.25rem)] p-4 flex items-center gap-3.5 h-full">
                    <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Points</span>
                      <span className="text-xl font-extrabold text-gray-900 num-tabular">{formatPoints(selectedChild.currentPoints || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-1 rounded-[1.75rem] bg-emerald-950/5 ring-1 ring-emerald-900/10">
                  <div className="bg-white rounded-[calc(1.75rem-0.25rem)] p-4 flex items-center gap-3.5 h-full">
                    <div className="p-3 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Tier Standing</span>
                      <span className="text-base font-extrabold text-purple-900">{selectedChild.tier || "BRONZE"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-1 rounded-[1.75rem] bg-emerald-950/5 ring-1 ring-emerald-900/10">
                  <div className="bg-white rounded-[calc(1.75rem-0.25rem)] p-4 flex items-center gap-3.5 h-full">
                    <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                      <Droplet className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Blood Group</span>
                      <span className="text-base font-extrabold text-gray-900 font-mono">{selectedChild.bloodGroup || "O+"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════════════ TWO COLUMN CORE CONTENT ══════════════════ */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── LEFT 2 COLUMNS: HIFZ MILESTONES & ACTIVITY FEED ── */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Latest Hifz Weekly Slip Card */}
                  <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
                    <Card className="rounded-[calc(2rem-0.375rem)] border-0 bg-white shadow-none overflow-hidden">
                      <div className="p-5 bg-gradient-to-r from-[#047857] to-[#065f46] text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <BookOpen className="w-5 h-5 text-amber-300" />
                          <div>
                            <h3 className="font-display font-bold text-base">Hifz Progress &amp; Weekly Slip</h3>
                            <p className="text-[11px] text-emerald-100">Official Quran memorization evaluation</p>
                          </div>
                        </div>
                        <Link href="/parent/hifz">
                          <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-gray-950 font-bold text-xs h-8 px-3.5 rounded-xl gap-1 shadow-sm">
                            Full Hifz Record <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>

                      <CardContent className="p-6 space-y-4">
                        {selectedChild.latestHifzSlip ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-[#047857] border border-emerald-200">
                                <Calendar className="w-3.5 h-3.5" /> Week {selectedChild.latestHifzSlip.weekNumber} Report
                              </span>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: selectedChild.latestHifzSlip.disciplineRating || 5 }).map((_, i) => (
                                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center">
                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Current Juz / Page</span>
                                <span className="text-base font-black text-[#047857]">
                                  Juz {selectedChild.latestHifzSlip.currentJuz || "—"} • Pg {selectedChild.latestHifzSlip.currentSafah || "—"}
                                </span>
                              </div>

                              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 text-center">
                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Sabaq (New Hifz)</span>
                                <span className="text-base font-black text-amber-800">
                                  {selectedChild.latestHifzSlip.sabaqLines || 0} Lines/Pages
                                </span>
                              </div>

                              <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 text-center col-span-2 sm:col-span-1">
                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Score / Evaluation</span>
                                <span className="text-base font-black text-purple-900">
                                  {selectedChild.latestHifzSlip.totalMarks || 0}/50 ({selectedChild.latestHifzSlip.overallPerformance || 0}%)
                                </span>
                              </div>
                            </div>

                            {selectedChild.latestHifzSlip.teacherNotes && (
                              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs leading-relaxed text-amber-950 space-y-1.5">
                                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Muhaffiz Feedback ({selectedChild.latestHifzSlip.muhaffizName}):
                                </p>
                                <p>{selectedChild.latestHifzSlip.teacherNotes}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-6 text-center border border-dashed border-gray-200 rounded-2xl space-y-2">
                            <BookOpen className="w-8 h-8 text-gray-400 mx-auto" />
                            <p className="text-xs text-gray-500 font-medium">No published Hifz weekly slips yet for this student.</p>
                            <Link href="/parent/hifz">
                              <Button variant="outline" size="sm" className="text-xs h-8 rounded-xl">
                                Check Hifz Dashboard
                              </Button>
                            </Link>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent Activity Timeline */}
                  <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
                    <Card className="rounded-[calc(2rem-0.375rem)] border-0 bg-white shadow-none overflow-hidden">
                      <CardHeader className="p-6 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-[#047857]" />
                          Recent Merits &amp; Activity Log
                        </CardTitle>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Feed
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        {selectedChild.recentActivity?.length > 0 ? (
                          <div className="space-y-3">
                            {selectedChild.recentActivity.slice(0, 5).map((act: any) => {
                              const Icon = activityIcons[act.type] || Award;
                              return (
                                <div
                                  key={act.id}
                                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-gray-50/70 hover:bg-emerald-50/40 transition-colors border border-gray-100"
                                >
                                  <div className={`p-2.5 rounded-xl shrink-0 ${activityColors[act.type] || "bg-gray-100 text-gray-700"}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <h4 className="text-xs font-bold text-gray-900 truncate">
                                        {act.title}
                                      </h4>
                                      <span className="text-[10px] text-gray-400 font-medium shrink-0">
                                        {timeAgo(new Date(act.createdAt))}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {act.detail}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center text-xs text-gray-400 py-8">No recent activity logs recorded yet.</p>
                        )}

                        <Link href="/parent/activity" className="block mt-4">
                          <Button variant="ghost" size="sm" className="w-full text-xs text-emerald-800 hover:bg-emerald-50 font-bold rounded-xl">
                            View Complete Activity Log <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* ── RIGHT 1 COLUMN: TALABAT DETAILS & BADGES ── */}
                <div className="space-y-6">
                  {/* Talabat Academic & Personal Identity */}
                  <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
                    <Card className="rounded-[calc(2rem-0.375rem)] border-0 bg-white shadow-none overflow-hidden">
                      <div className="p-4 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-950">
                        <span className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-[#d4af37]" /> Student Profile
                        </span>
                        <span className="text-[10px] text-emerald-700 uppercase bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {selectedChild.relationship || "Assigned"}
                        </span>
                      </div>

                      <CardContent className="p-5 space-y-3.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">ITS Identifier:</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedChild.its, "ITS ID")}
                            className="font-mono font-bold text-[#047857] hover:underline flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer"
                          >
                            <span>{selectedChild.its}</span>
                            {copiedText === selectedChild.its ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 opacity-60" />}
                          </button>
                        </div>

                        {selectedChild.trNo && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">TR Registration:</span>
                            <span className="font-mono font-semibold text-gray-800">{selectedChild.trNo}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Grade &amp; Section:</span>
                          <span className="font-bold text-gray-900">
                            Grade {selectedChild.grade} - Section {selectedChild.section || "A"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Hometown / Watan:</span>
                          <span className="font-semibold text-gray-800">{selectedChild.watan || selectedChild.residentCity || "Unassigned"}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Hifz Status:</span>
                          <Badge className={`text-[10px] ${selectedChild.status === "HAFIZ" ? "bg-amber-100 text-amber-900 border-amber-300 font-bold" : "bg-gray-100 text-gray-700"}`}>
                            {selectedChild.status === "HAFIZ" ? `Hafiz (${selectedChild.hafizYear || "Quran"})` : "Student (Sanah)"}
                          </Badge>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Linked Parent:</span>
                          <span className="font-semibold text-gray-800">
                            {parentProfile?.firstName} {parentProfile?.lastName}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent Badges & Medals */}
                  {selectedChild.recentBadges?.length > 0 && (
                    <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
                      <Card className="rounded-[calc(2rem-0.375rem)] border-0 bg-white shadow-none overflow-hidden">
                        <CardHeader className="p-5 border-b border-gray-100">
                          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-amber-500" />
                            Earned Badges &amp; Honors
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap gap-2">
                            {selectedChild.recentBadges.map((badge: any, idx: number) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={`text-xs py-1 px-2.5 rounded-xl font-bold flex items-center gap-1.5 ${
                                  badge.tier === "GOLD"
                                    ? "bg-amber-50 text-amber-900 border-amber-300"
                                    : badge.tier === "SILVER"
                                    ? "bg-slate-50 text-slate-800 border-slate-300"
                                    : "bg-orange-50 text-orange-900 border-orange-200"
                                }`}
                              >
                                <Crown className="w-3 h-3 text-amber-600" />
                                {badge.name}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Quick Shortcuts */}
                  <div className="p-1.5 rounded-[2rem] bg-emerald-950/15 ring-1 ring-emerald-900/20">
                    <div className="p-6 rounded-[calc(2rem-0.375rem)] bg-gradient-to-br from-[#022c22] to-[#047857] text-white space-y-3">
                      <h4 className="font-bold text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-300" /> Parent Quick Actions
                      </h4>
                      <p className="text-xs text-emerald-100">
                        Need updates or have questions regarding {selectedChild.firstName}?
                      </p>
                      <div className="pt-2 flex flex-col gap-2">
                        <Link href="/parent/hifz">
                          <Button size="sm" className="w-full bg-white text-[#047857] hover:bg-emerald-50 font-bold text-xs h-9 rounded-xl shadow-sm">
                            <BookOpen className="w-3.5 h-3.5 mr-1" /> View Hifz Reports
                          </Button>
                        </Link>
                        <Link href="/fatimi-calendar">
                          <Button size="sm" variant="outline" className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 rounded-xl font-semibold">
                            <Calendar className="w-3.5 h-3.5 mr-1" /> School &amp; Miqaat Calendar
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
