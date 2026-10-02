"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Users,
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
import { getInitials } from "@/lib/utils";
import { PremiumTalabatCard } from "@/components/student/PremiumTalabatCard";
import { useFatimiTheme } from "@/context/FatimiThemeContext";
import { usePortalAccess } from "@/context/PortalAccessContext";

const skillCategories = [
  { key: "criticalThinking", label: "Critical Thinking", icon: Brain },
  { key: "collaboration", label: "Collaboration", icon: Users },
  { key: "leadership", label: "Leadership", icon: Shield },
  { key: "resilience", label: "Resilience", icon: Heart },
];

const portalOptions = [
  { key: "attendance", label: "Attendance", href: "/talabat/attendance", icon: Clock, description: "Track your attendance & record logs", chip: "Record" },
  { key: "calendar", label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays, description: "View the Fatimi academic calendar", chip: "Schedule" },
  { key: "library", label: "Library", href: "/talabat/library", icon: BookOpen, description: "Explore every rack, shelf & book", chip: "Books" },
  { key: "hifz", label: "Hifz", href: "/talabat/hifz", icon: BookMarked, description: "Follow your Qur'an memorisation journey", chip: "Qur'an" },
  { key: "badges", label: "Badges", href: "/talabat/badges", icon: Medal, description: "Collect achievements & milestones", chip: "Awards" },
  { key: "skillTree", label: "Skill Tree", href: "/talabat/skill-tree", icon: GitBranch, description: "Track 4C attribute development", chip: "Growth" },
  { key: "profile", label: "Profile", href: "/talabat/profile", icon: User, description: "Manage your personal information", chip: "Profile" },
  { key: null, label: "Settings", href: "/talabat/settings", icon: Settings, description: "Security & account preferences", chip: "Account" },
];

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
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
  };

  const visibleOptions = portalOptions.filter((o) => !o.key || isModuleVisible(o.key, "STUDENT"));
  const can = (key: string) => isModuleVisible(key, "STUDENT");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {loading ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-gray-200" />
            <div className="space-y-2">
              <div className="w-48 h-6 bg-gray-200 rounded-xl" />
              <div className="w-32 h-4 bg-gray-200 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white border border-gray-100 p-6 h-36" />
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* ═══════════ Welcome Header Banner ═══════════ */}
          <motion.div {...fadeUp} transition={{ duration: 0.45, ease: "easeOut" }}>
            <div className="p-1 sm:p-1.5 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
              <div
                className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white"
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
                    <div className="relative shrink-0">
                      <Avatar className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 shadow-lg" style={{ borderColor: theme.swatch.gold }}>
                        {data.avatarUrl && (
                          <AvatarImage
                            src={data.avatarUrl}
                            alt={`${data.firstName} ${data.lastName}`}
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <AvatarFallback
                          className="text-xl sm:text-2xl font-bold rounded-2xl bg-emerald-900 text-amber-300"
                        >
                          {getInitials(data.firstName, data.lastName)}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-amber-200 bg-emerald-950/70 px-3 py-1 rounded-full border border-amber-400/30">
                          {today}
                        </span>
                        <span className="text-xs text-emerald-100 font-medium">Talabat Student Portal</span>
                      </div>

                      <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        {greeting}, {data.firstName}!
                      </h1>

                      <p className="text-xs sm:text-sm text-emerald-100 font-medium flex items-center gap-2 flex-wrap">
                        <span>Grade {data.grade}{data.section}</span>
                        <span className="text-amber-300">&bull;</span>
                        <span>Darse Burhani Academic Session</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${theme.swatch.gold}, transparent)` }}
                />
              </div>
            </div>
          </motion.div>

          {/* ═══════════ Student Academic Identity Card ═══════════ */}
          <PremiumTalabatCard data={data} />

          {/* ═══════════ Portal Options Hub ═══════════ */}
          <motion.div {...fadeUp} transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }} className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="h-6 w-1 rounded-full bg-emerald-700"
              />
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-gray-900">Explore the Talabat Portal</h2>
                <p className="text-xs sm:text-sm text-gray-600">Curricula, achievements, library, and attendance tools</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {visibleOptions.map((option, i) => (
                <motion.div
                  key={option.href}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.03, ease: "easeOut" }}
                >
                  <div className="p-1 rounded-2xl bg-emerald-950/5 ring-1 ring-emerald-900/10 h-full transition-all duration-200 hover:ring-amber-400/40 hover:shadow-md">
                    <Link
                      href={option.href}
                      className="group relative flex flex-col h-full bg-white rounded-xl p-5 overflow-hidden transition-all duration-200 justify-between"
                      style={{ border: `1px solid ${theme.swatch.gold}25` }}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3.5">
                          <div
                            className="p-2.5 rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-105 bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                          >
                            <option.icon className="w-5 h-5" />
                          </div>
                          <Badge variant="outline" className="text-[10px] font-bold border-amber-200/80 bg-amber-50/60 text-amber-800">
                            {option.chip}
                          </Badge>
                        </div>
                        <p className="font-bold text-sm text-gray-900 group-hover:text-emerald-900 transition-colors">
                          {option.label}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{option.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-emerald-800 group-hover:text-emerald-950 transition-colors">
                        <span>Launch</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ═══════════ Content Grid (Badges & 4C Skill Tree) ═══════════ */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column: Recent Badges */}
            <div className="space-y-6">
              {can("badges") && (
                <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}>
                  <div className="p-1 sm:p-1.5 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/15">
                    <Card
                      className="rounded-2xl border-0 bg-white overflow-hidden shadow-none"
                    >
                      <div
                        className="h-1 w-full"
                        style={{
                          background: `linear-gradient(90deg, ${theme.swatch.primary}, ${theme.swatch.gold}, ${theme.swatch.primary})`,
                        }}
                      />
                      <CardHeader className="pb-3 px-6 pt-6">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                          <Award className="w-5 h-5 text-amber-600" /> Recent Badges
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-6 pb-6">
                        {data.recentBadges && data.recentBadges.length > 0 ? (
                          <div className="space-y-3">
                            {data.recentBadges.map((badge: any) => (
                              <div
                                key={badge.name}
                                className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50/80 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-base shadow-xs"
                                    style={{
                                      background: badge.earned ? `linear-gradient(135deg, ${theme.swatch.primary}, ${theme.swatch.secondary})` : "#f3f4f6",
                                      color: badge.earned ? "#ffffff" : "#9ca3af",
                                    }}
                                  >
                                    <Sparkles className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{badge.name}</p>
                                    <p className="text-xs text-gray-600 font-medium">{badge.category || "Academic"}</p>
                                  </div>
                                </div>
                                {badge.earned ? (
                                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <span className="text-xs font-bold text-gray-600">{badge.progress || 0}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-gray-600 py-4 text-xs font-medium">No badges recorded yet</p>
                        )}
                        <Link href="/talabat/badges" className="block w-full mt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full font-bold group rounded-xl text-emerald-800 hover:text-emerald-950"
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
                <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}>
                  <div className="p-1 sm:p-1.5 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/15">
                    <Card
                      className="rounded-2xl border-0 bg-white overflow-hidden shadow-none"
                    >
                      <div
                        className="h-1 w-full"
                        style={{
                          background: `linear-gradient(90deg, ${theme.swatch.primary}, ${theme.swatch.gold}, ${theme.swatch.primary})`,
                        }}
                      />
                      <CardHeader className="flex flex-row items-center justify-between pb-3 px-6 pt-6">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                          <BarChart3 className="w-5 h-5 text-emerald-700" /> 4C Attribute Skill Development
                        </CardTitle>
                        <Link href="/talabat/skill-tree">
                          <Button variant="ghost" size="sm" className="font-bold rounded-xl text-xs text-emerald-800 hover:text-emerald-950">
                            Details <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </CardHeader>
                      <CardContent className="px-6 pb-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                          {skillCategories.map((skill) => {
                            const value = data.skillTree ? data.skillTree[skill.key] || 0 : 0;
                            return (
                              <div
                                key={skill.key}
                                className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white transition-all"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="p-2 rounded-lg bg-emerald-100/70 text-emerald-800"
                                    >
                                      <skill.icon className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-900">{skill.label}</span>
                                  </div>
                                  <span className="text-xs font-black text-gray-900 tabular-nums">{value}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${value}%` }}
                                    transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
                                    className="h-2.5 rounded-full bg-emerald-700"
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
        <Card className="rounded-2xl border border-gray-200 bg-white">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-10 h-10 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-600 font-medium">Failed to load dashboard</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
