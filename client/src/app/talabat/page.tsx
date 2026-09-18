"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Star,
  TrendingUp,
  Users,
  Flame,
  BarChart3,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Heart,
  Brain,
  Shield,
  Clock,
  CalendarDays,
  BookOpen,
  BookMarked,
  Medal,
  GitBranch,
  User,
  Settings,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatPoints, getInitials } from "@/lib/utils";
import { PremiumTalabatCard } from "@/components/student/PremiumTalabatCard";
import { useFatimiTheme } from "@/context/FatimiThemeContext";
import { usePortalAccess } from "@/context/PortalAccessContext";

const skillCategories = [
  { key: "criticalThinking", label: "Critical Thinking", icon: Brain, color: "from-amber-400 to-amber-600" },
  { key: "collaboration", label: "Collaboration", icon: Users, color: "from-emerald-400 to-emerald-600" },
  { key: "leadership", label: "Leadership", icon: Shield, color: "from-blue-400 to-indigo-600" },
  { key: "resilience", label: "Resilience", icon: Heart, color: "from-rose-400 to-rose-600" },
];

const portalOptions = [
  { key: "attendance", label: "Attendance", href: "/talabat/attendance", icon: Clock, description: "Track your attendance & justify absences", chip: "Record" },
  { key: "calendar", label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays, description: "View the Fatimi academic calendar", chip: "Schedule" },
  { key: "library", label: "Library", href: "/talabat/library", icon: BookOpen, description: "Explore every rack, shelf & book", chip: "Books" },
  { key: "hifz", label: "Hifz", href: "/talabat/hifz", icon: BookMarked, description: "Follow your Qur'an memorisation journey", chip: "Qur'an" },
  { key: "badges", label: "Badges", href: "/talabat/badges", icon: Medal, description: "Collect achievements & milestones", chip: "Awards" },
  { key: "skillTree", label: "Skill Tree", href: "/talabat/skill-tree", icon: GitBranch, description: "Grow your 4C attribute skills", chip: "Growth" },
  { key: "profile", label: "Profile", href: "/talabat/profile", icon: User, description: "Manage your personal information", chip: "Profile" },
  { key: null, label: "Settings", href: "/talabat/settings", icon: Settings, description: "Security & account preferences", chip: "Account" },
];

function CountUp({ value, duration = 1.1, prefix = "", suffix = "" }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / (duration * 1000), 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function FatimiStatCard({
  icon: Icon,
  label,
  value,
  prefix,
  suffix,
  sub,
  theme,
  glowColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  sub?: string;
  theme: any;
  glowColor?: string;
}) {
  return (
    <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm transition-all duration-300 hover:shadow-md">
      <div
        className="group relative rounded-[calc(2rem-0.375rem)] bg-white p-5 sm:p-6 overflow-hidden h-full flex flex-col justify-between"
        style={{
          border: `1px solid ${theme.swatch.gold}35`,
          boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.8)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${theme.swatch.primary}, ${theme.swatch.gold}, ${theme.swatch.primary})`,
          }}
        />

        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div
              className="p-3 rounded-2xl shadow-sm group-hover:scale-105 transition-transform duration-300"
              style={{
                background: `linear-gradient(135deg, ${theme.swatch.surface}, #ffffff)`,
                border: `1px solid ${theme.swatch.gold}44`,
                color: theme.swatch.primary,
              }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60">
              Metric
            </span>
          </div>

          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-1 tabular-nums font-display tracking-tight">
            <CountUp value={value} prefix={prefix} suffix={suffix} />
          </p>
        </div>

        {sub && (
          <p className="text-xs text-gray-500 mt-3 pt-2.5 border-t border-gray-100 font-medium flex items-center justify-between">
            <span>{sub}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </p>
        )}
      </div>
    </div>
  );
}

export default function TalabatDashboard() {
  const { theme } = useFatimiTheme();
  const { isModuleVisible } = usePortalAccess();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/talabat/dashboard")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  const visibleOptions = portalOptions.filter((o) => !o.key || isModuleVisible(o.key, "STUDENT"));
  const can = (key: string) => isModuleVisible(key, "STUDENT");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {loading ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-3xl bg-gray-200" />
            <div className="space-y-2">
              <div className="w-48 h-6 bg-gray-200 rounded-xl" />
              <div className="w-32 h-4 bg-gray-200 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-white border border-gray-100 p-6 h-36" />
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* ═══════════ Doppelrand Hero Banner ═══════════ */}
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
            <div className="p-1 sm:p-2 rounded-[2.5rem] bg-emerald-950/10 ring-1 ring-emerald-900/20 shadow-2xl">
              <div
                className="relative overflow-hidden rounded-[calc(2.5rem-0.375rem)] p-6 sm:p-8 text-white transition-all duration-500"
                style={{
                  background: theme.cardHeroGradient,
                  boxShadow: `0 20px 50px ${theme.accentGlow}`,
                }}
              >
                {/* Subtle top hairline */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${theme.goldAccent}, transparent)` }}
                />

                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <Avatar className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl border-4 shadow-xl" style={{ borderColor: theme.swatch.gold }}>
                        {data.avatarUrl && (
                          <AvatarImage
                            src={data.avatarUrl}
                            alt={`${data.firstName} ${data.lastName}`}
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <AvatarFallback
                          className="text-2xl font-black rounded-3xl"
                          style={{
                            background: `linear-gradient(135deg, ${theme.swatch.primary}, ${theme.swatch.secondary})`,
                            color: "#ffffff",
                          }}
                        >
                          {getInitials(data.firstName, data.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-[#021812]"
                        style={{ background: "linear-gradient(135deg, #ffe082, #d4af37)" }}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#2b1900]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 bg-black/25 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                          {today}
                        </span>
                        <span className="text-xs text-emerald-200 font-medium">Talabat Student Portal</span>
                      </div>
                      <h1 className="font-display text-2xl sm:text-3xl font-black text-white mt-1" style={{ letterSpacing: "-0.02em" }}>
                        {greeting}, {data.firstName}!
                      </h1>
                      <p className="text-white/90 text-xs sm:text-sm mt-1 font-medium flex items-center gap-2 flex-wrap">
                        <span>Grade {data.grade}{data.section}</span>
                        <span className="opacity-50">&bull;</span>
                        <span className="font-bold text-[#ffe082]">{data.tier} Tier</span>
                        <span className="opacity-50">&bull;</span>
                        <span>#{data.rank} of {data.totalStudents} Talabat</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <Link href="/talabat/profile">
                      <Button
                        size="sm"
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl h-10 px-4 text-xs font-bold gap-1.5 shadow-sm"
                      >
                        <User className="w-4 h-4 text-amber-300" />
                        My Profile
                      </Button>
                    </Link>
                  </div>
                </div>

                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ background: `linear-gradient(90deg, transparent, ${theme.swatch.gold}, transparent)` }}
                />
              </div>
            </div>
          </motion.div>

          {/* ═══════════ Premium Identity Card (Dynamic) ═══════════ */}
          <PremiumTalabatCard data={data} />

          {/* ═══════════ Stats Grid ═══════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FatimiStatCard icon={Star} label="Current Points" value={data.currentPoints} sub={`${formatPoints(data.totalPoints)} lifetime merits`} theme={theme} />
            <FatimiStatCard icon={Flame} label="Active Streak" value={data.streakDays} suffix=" Days" sub="Consecutive daily engagement" theme={theme} />
            <FatimiStatCard icon={TrendingUp} label="Academic Rank" value={data.rank} prefix="#" sub={`Top standing among ${data.totalStudents} talabat`} theme={theme} />
          </div>

          {/* ═══════════ Portal Options Hub ═══════════ */}
          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }} className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="h-7 w-1.5 rounded-full"
                style={{ background: `linear-gradient(180deg, ${theme.swatch.gold}, ${theme.swatch.primary})` }}
              />
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-gray-900">Explore the Talabat Portal</h2>
                <p className="text-xs sm:text-sm text-gray-500">Curricula, achievements, library, and attendance tools</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
              {visibleOptions.map((option, i) => (
                <motion.div
                  key={option.href}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.03, ease: "easeOut" }}
                >
                  <div className="p-1 rounded-[1.75rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 h-full transition-all duration-300 hover:ring-amber-400/40 hover:shadow-md">
                    <Link
                      href={option.href}
                      className="group relative flex flex-col h-full bg-white rounded-[calc(1.75rem-0.25rem)] p-5 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 justify-between"
                      style={{ border: `1px solid ${theme.swatch.gold}25` }}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3.5">
                          <div
                            className="p-3 rounded-2xl shadow-xs transition-transform duration-300 group-hover:scale-105"
                            style={{
                              background: `linear-gradient(135deg, ${theme.swatch.surface}, #ffffff)`,
                              border: `1px solid ${theme.swatch.gold}44`,
                              color: theme.swatch.primary,
                            }}
                          >
                            <option.icon className="w-5 h-5" />
                          </div>
                          <Badge variant="outline" className="text-[10px] font-bold border-amber-200/80 bg-amber-50/60 text-amber-800">
                            {option.chip}
                          </Badge>
                        </div>
                        <p className="font-bold text-sm text-gray-900 group-hover:text-amber-900 transition-colors">
                          {option.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{option.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-emerald-800 group-hover:text-amber-800 transition-colors">
                        <span>Launch</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ═══════════ Content Grid (Badges & 4C Skill Tree) ═══════════ */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left column: Recent Badges */}
            <div className="space-y-6">
              {can("badges") && (
                <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}>
                  <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15">
                    <Card
                      className="rounded-[calc(2rem-0.375rem)] border-0 bg-white overflow-hidden shadow-none"
                    >
                      <div
                        className="h-1 w-full"
                        style={{
                          background: `linear-gradient(90deg, ${theme.swatch.primary}, ${theme.swatch.gold}, ${theme.swatch.primary})`,
                        }}
                      />
                      <CardHeader className="pb-3 px-6 pt-6">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                          <Award className="w-5 h-5 text-[#d4af37]" /> Recent Badges
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-6 pb-6">
                        {data.recentBadges.length > 0 ? (
                          <div className="space-y-3">
                            {data.recentBadges.map((badge: any) => (
                              <div
                                key={badge.name}
                                className="flex items-center justify-between p-3.5 rounded-2xl border transition-colors bg-white hover:bg-gray-50/80"
                                style={{ borderColor: "rgba(212, 175, 55, 0.2)" }}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg shadow-xs"
                                    style={{
                                      background: badge.earned ? `linear-gradient(135deg, ${theme.swatch.primary}, ${theme.swatch.secondary})` : "#f3f4f6",
                                      color: badge.earned ? "#ffffff" : "#9ca3af",
                                    }}
                                  >
                                    {badge.earned ? "⭐" : "🔒"}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{badge.name}</p>
                                    <p className="text-xs text-gray-500 font-medium">{badge.tier}</p>
                                  </div>
                                </div>
                                {badge.earned ? (
                                  <CheckCircle className="w-5 h-5" style={{ color: theme.swatch.primary }} />
                                ) : (
                                  <span className="text-xs font-bold text-gray-500">{badge.progress}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-gray-500 py-4 text-xs font-medium">No badges earned yet</p>
                        )}
                        <Link href="/talabat/badges" className="block w-full mt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full font-bold group rounded-xl"
                            style={{ color: theme.swatch.primary }}
                          >
                            View All Badges <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right column: 4C Skill Tree */}
            <div className="lg:col-span-2 space-y-6">
              {can("skillTree") && (
                <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}>
                  <div className="p-1 sm:p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/15">
                    <Card
                      className="rounded-[calc(2rem-0.375rem)] border-0 bg-white overflow-hidden shadow-none"
                    >
                      <div
                        className="h-1 w-full"
                        style={{
                          background: `linear-gradient(90deg, ${theme.swatch.primary}, ${theme.swatch.gold}, ${theme.swatch.primary})`,
                        }}
                      />
                      <CardHeader className="flex flex-row items-center justify-between pb-3 px-6 pt-6">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                          <BarChart3 className="w-5 h-5" style={{ color: theme.swatch.primary }} /> Skill Tree — 4C Attribute Map
                        </CardTitle>
                        <Link href="/talabat/skill-tree">
                          <Button variant="ghost" size="sm" style={{ color: theme.swatch.primary }} className="font-bold rounded-xl text-xs">
                            Details <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </CardHeader>
                      <CardContent className="px-6 pb-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                          {skillCategories.map((skill) => {
                            const value = data.skillTree[skill.key] || 0;
                            return (
                              <div
                                key={skill.key}
                                className="p-4 rounded-2xl border transition-all hover:-translate-y-0.5"
                                style={{
                                  background: `linear-gradient(135deg, ${theme.swatch.surface}, #ffffff)`,
                                  borderColor: `${theme.swatch.gold}35`,
                                }}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="p-2.5 rounded-xl shadow-xs"
                                      style={{
                                        background: `${theme.swatch.gold}20`,
                                        color: theme.swatch.primary,
                                      }}
                                    >
                                      <skill.icon className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-800">{skill.label}</span>
                                  </div>
                                  <span className="text-xs font-black text-gray-900 tabular-nums">{value}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${value}%` }}
                                    transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
                                    className="h-2.5 rounded-full"
                                    style={{
                                      background: `linear-gradient(90deg, ${theme.swatch.primary}, ${theme.swatch.gold})`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </>
      ) : (
        <Card className="rounded-3xl border border-gray-200 bg-white">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-10 h-10 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500 font-medium">Failed to load dashboard</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
