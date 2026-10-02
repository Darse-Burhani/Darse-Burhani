"use client";

import { motion } from "framer-motion";
import {
  Award,
  Calendar,
  Droplets,
  Hash,
  MapPin,
  Phone,
  GraduationCap,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useFatimiTheme } from "@/context/FatimiThemeContext";

interface PremiumTalabatCardProps {
  /** Full payload from GET /api/talabat/dashboard */
  data: Record<string, any>;
}

/**
 * Clean, structured identity card for an individual talabat.
 * Displays official academic identity and profile details with clear hierarchy.
 */
export function PremiumTalabatCard({ data }: PremiumTalabatCardProps) {
  const { theme } = useFatimiTheme();
  const firstName = data.firstName || "";
  const lastName = data.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim() || "Talabat Student";
  const nameAr = data.nameAr || "";
  const grade = data.grade || "—";
  const section = data.section || "";
  const its = data.its || "—";
  const trNo = data.trNo || "—";

  const details = [
    { icon: Hash, label: "ITS Number", value: its },
    { icon: Hash, label: "TR Number", value: trNo },
    { icon: MapPin, label: "Watan", value: data.watan || "—" },
    { icon: MapPin, label: "Resident City", value: data.residentCity || "—" },
    { icon: Droplets, label: "Blood Group", value: data.bloodGroup || "—" },
    { icon: Calendar, label: "DOB (Hijri)", value: data.dobHijri || "—" },
    { icon: Award, label: "Hafiz Year", value: data.hafizYear || "—" },
    { icon: Phone, label: "Mobile", value: data.mobileNumber || "—" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="p-1 sm:p-1.5 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm"
    >
      <div
        className="relative rounded-2xl overflow-hidden text-white"
        style={{ background: theme.cardHeroGradient }}
      >
        {/* Subtle top hairline */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] z-10"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.goldAccent}, transparent)` }}
        />

        <div className="relative z-10 p-6 sm:p-8 space-y-6">
          {/* Identity Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            {/* Student Photo */}
            <div className="relative shrink-0">
              <div
                className="p-1 rounded-2xl shadow-md"
                style={{ background: `linear-gradient(135deg, ${theme.swatch.gold}, #f0d76e, ${theme.swatch.gold})` }}
              >
                <Avatar className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-emerald-950">
                  {data.avatarUrl && (
                    <AvatarImage
                      src={data.avatarUrl}
                      alt={fullName}
                      className="object-cover object-[50%_18%]"
                    />
                  )}
                  <AvatarFallback
                    className="rounded-xl bg-emerald-900 text-amber-300 text-xl sm:text-2xl font-bold"
                  >
                    {getInitials(firstName, lastName) || "TS"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Name & Academic Meta */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-200 bg-emerald-950/70 border border-amber-400/30">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-300" />
                  Grade {grade}{section}
                </span>

                {data.status && (
                  data.status === "HAFIZ" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-100 bg-amber-500/20 border border-amber-300/40">
                      <Award className="w-3.5 h-3.5 text-amber-300" />
                      Hafiz {data.hafizYear ? `(${data.hafizYear})` : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-100 bg-emerald-500/20 border border-emerald-400/30">
                      Sanah
                    </span>
                  )
                )}
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                {fullName}
              </h2>

              {nameAr && (
                <p className="text-base sm:text-lg text-emerald-100/90 font-medium" dir="rtl" lang="ar">
                  {nameAr}
                </p>
              )}
            </div>
          </div>

          {/* Structured Details Grid */}
          <div className="pt-5 border-t border-white/15">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {details.map((d) => (
                <div key={d.label} className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <d.icon className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="text-[11px] font-semibold text-emerald-100/75 truncate">{d.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate" title={String(d.value)}>
                    {String(d.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Subtle bottom hairline */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] z-10"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.goldAccent}, transparent)` }}
        />
      </div>
    </motion.div>
  );
}
