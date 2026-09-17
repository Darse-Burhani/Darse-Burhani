"use client";

import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  Calendar,
  Droplets,
  Flame,
  Hash,
  MapPin,
  Medal,
  Phone,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, getTierColor } from "@/lib/utils";
import { useFatimiTheme } from "@/context/FatimiThemeContext";

const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
const tierThresholds = [0, 500, 1000, 2500, 5000];

interface PremiumTalabatCardProps {
  /** Full payload from GET /api/talabat/dashboard */
  data: Record<string, any>;
}

/**
 * Premium, dynamic identity card for an individual talabat. Rendered from the
 * live dashboard payload so photo, name, tier and every detail stay in sync
 * with the database.
 */
export function PremiumTalabatCard({ data }: PremiumTalabatCardProps) {
  const { theme } = useFatimiTheme();
  const firstName = data.firstName || "";
  const lastName = data.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const nameAr = data.nameAr || "";
  const grade = data.grade || "—";
  const section = data.section || "";
  const its = data.its || "—";
  const trNo = data.trNo || "—";
  const tier = data.tier || "BRONZE";
  const totalPoints = data.totalPoints ?? data.currentPoints ?? 0;

  const tierIdx = Math.max(0, tierOrder.findIndex((t) => t === tier));
  const nextTierIdx = Math.min(tierIdx + 1, tierThresholds.length - 1);
  const tierProgress =
    tierIdx >= tierThresholds.length - 1
      ? 100
      : Math.min(
          100,
          Math.round(
            ((totalPoints - tierThresholds[tierIdx]) /
              (tierThresholds[nextTierIdx] - tierThresholds[tierIdx])) *
              100,
          ),
        );

  const tierColor = getTierColor(tier);

  const stats = [
    { icon: Star, label: "Points", value: `${data.currentPoints ?? 0}`, sub: `${totalPoints} lifetime`, color: "text-amber-300" },
    { icon: Flame, label: "Streak", value: `${data.streakDays ?? 0}`, sub: "days burning", color: "text-orange-300" },
    { icon: TrendingUp, label: "Rank", value: `#${data.rank ?? "—"}`, sub: `of ${data.totalStudents ?? 0} talabat`, color: "text-emerald-200" },
  ];

  const details = [
    { icon: MapPin, label: "Watan", value: data.watan || "—" },
    { icon: MapPin, label: "Resident City", value: data.residentCity || "—" },
    { icon: Droplets, label: "Blood Group", value: data.bloodGroup || "—" },
    { icon: Calendar, label: "DOB (Hijri)", value: data.dobHijri || "—" },
    { icon: Award, label: "Hafiz Year", value: data.hafizYear || "—" },
    { icon: Hash, label: "ITS No.", value: its },
    { icon: Hash, label: "TR No.", value: trNo },
    { icon: Phone, label: "Mobile", value: data.mobileNumber || "—" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8"
    >
      <div
        className="relative rounded-[1.75rem] p-[1.5px] overflow-hidden shadow-2xl transition-all duration-500"
        style={{
          background: `linear-gradient(135deg, ${theme.swatch.gold}99, ${theme.swatch.primary}44, ${theme.swatch.gold}66)`,
          boxShadow: `0 20px 50px ${theme.accentGlow}`,
        }}
      >
        {/* Card body */}
        <div
          className="relative rounded-[1.75rem] overflow-hidden transition-all duration-500"
          style={{ background: theme.cardHeroGradient }}
        >
          {/* Subtle top hairline */}
          <div className="absolute top-0 left-0 right-0 h-[2px] z-10"
            style={{ background: `linear-gradient(90deg, transparent, ${theme.goldAccent}, transparent)` }} />

          <div className="relative z-10 p-6 sm:p-8">
            {/* ── Identity row ── */}
            <div className="flex flex-col md:flex-row gap-6 md:items-center">
              {/* Photo */}
              <div className="relative flex-shrink-0 self-start md:self-center">
                <div className="absolute -inset-1.5 rounded-3xl opacity-60 blur-md"
                  style={{ background: "linear-gradient(135deg, #d4af37, transparent, #10b981)" }} />
                <div className="relative rounded-3xl p-[2px]"
                  style={{ background: "linear-gradient(135deg, #d4af37, #f0d76e, #d4af37)" }}>
                  <Avatar className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#043426]">
                    {data.avatarUrl && (
                      <AvatarImage src={data.avatarUrl} alt={fullName} className="object-cover" />
                    )}
                    <AvatarFallback
                      className="rounded-3xl bg-gradient-to-br from-[#047857] to-[#043426] text-2xl font-bold"
                      style={{ color: "#d4af37" }}
                    >
                      {getInitials(firstName, lastName) || "T"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {/* Tier badge */}
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 18 }}
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-lg border"
                  style={{ background: "linear-gradient(135deg, #b8860b, #d4af37)", borderColor: "#f0d76e", boxShadow: "0 4px 16px rgba(212,175,55,0.45)" }}
                >
                  <Medal className="w-3 h-3" /> {tier}
                </motion.div>
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight" style={{ letterSpacing: "-0.02em" }}>
                  {fullName}
                </h2>
                {nameAr && (
                  <p className="text-lg text-emerald-100/80 mt-0.5" dir="rtl" lang="ar">
                    {nameAr}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-white/10 border border-white/15">
                    Grade {grade}{section}
                  </span>
                  {data.status && (
                    data.status === "HAFIZ" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-100 bg-amber-500/20 border border-amber-300/40">
                        Hafiz {data.hafizYear ? `(${data.hafizYear})` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-100 bg-emerald-500/20 border border-emerald-400/30">
                        Sanah
                      </span>
                    )
                  )}
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-white/10 border border-white/15 font-mono">
                    ITS {its}
                  </span>
                  {trNo !== "—" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-white/10 border border-white/15 font-mono">
                      TR {trNo}
                    </span>
                  )}
                </div>
              </div>

              {/* Tier progress */}
              <div className="md:w-64 flex-shrink-0">
                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                  <span className="text-emerald-100/90 font-medium flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" style={{ color: tierColor }} />
                    {tierIdx >= tierThresholds.length - 1 ? "Top tier reached!" : `Next: ${tierOrder[nextTierIdx]}`}
                  </span>
                  <span className="text-emerald-100/90 font-semibold tabular-nums">{tierProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/15 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${tierProgress}%` }}
                    transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${tierColor}, #f0d76e, ${tierColor})` }}
                  />
                </div>
                <p className="text-[10px] text-emerald-100/60 mt-1.5 text-right tabular-nums">
                  {totalPoints.toLocaleString()} lifetime points
                </p>
              </div>
            </div>

            {/* ── Quick stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.07, duration: 0.4 }}
                  className="rounded-2xl bg-white/[0.07] border border-white/10 backdrop-blur-sm px-4 py-3 hover:bg-white/[0.11] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/60">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold text-white mt-1 tabular-nums">{s.value}</p>
                  <p className="text-[10px] text-emerald-100/50">{s.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* ── Personal details ── */}
            {details.some((d) => d.value !== "—") && (
              <>
                <div className="my-6 border-t border-white/15" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
                  {details.map((d, i) => (
                    <motion.div
                      key={d.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 + i * 0.05, duration: 0.35 }}
                      className="min-w-0"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <d.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#d4af37" }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/55 truncate">{d.label}</span>
                      </div>
                      <p className="text-sm font-medium text-white truncate" title={String(d.value)}>
                        {String(d.value)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Gold bottom hairline */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] z-10"
            style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </div>
    </motion.div>
  );
}
