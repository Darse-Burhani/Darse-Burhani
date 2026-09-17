"use client";

import React from "react";

type RoleVariant = "default" | "admin" | "teacher" | "student" | "parent" | "gold";

interface FatimiLogoProps {
  size?: number;
  variant?: RoleVariant;
  className?: string;
}

const gradientMap: Record<RoleVariant, { id: string; stops: { offset: string; color: string }[] }> = {
  default: {
    id: "fatimiDefault",
    stops: [
      { offset: "0%", color: "#d4af37" },
      { offset: "50%", color: "#b8860b" },
      { offset: "100%", color: "#047857" },
    ],
  },
  gold: {
    id: "fatimiGold",
    stops: [
      { offset: "0%", color: "#fbbf24" },
      { offset: "50%", color: "#d4af37" },
      { offset: "100%", color: "#b8860b" },
    ],
  },
  admin: {
    id: "fatimiAdmin",
    stops: [
      { offset: "0%", color: "#d4af37" },
      { offset: "50%", color: "#b8860b" },
      { offset: "100%", color: "#047857" },
    ],
  },
  teacher: {
    id: "fatimiTeacher",
    stops: [
      { offset: "0%", color: "#fbbf24" },
      { offset: "50%", color: "#d4af37" },
      { offset: "100%", color: "#047857" },
    ],
  },
  student: {
    id: "fatimiStudent",
    stops: [
      { offset: "0%", color: "#34d399" },
      { offset: "50%", color: "#10b981" },
      { offset: "100%", color: "#047857" },
    ],
  },
  parent: {
    id: "fatimiParent",
    stops: [
      { offset: "0%", color: "#fbbf24" },
      { offset: "50%", color: "#d4af37" },
      { offset: "100%", color: "#047857" },
    ],
  },
};

export function FatimiLogo({ size = 36, variant = "default", className = "" }: FatimiLogoProps) {
  const grad = gradientMap[variant];
  const gradId = grad.id;
  const glowId = `${gradId}Glow`;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {grad.stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={grad.stops[0].color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={grad.stops[0].color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer glow */}
        <circle cx="50" cy="50" r="48" fill={`url(#${glowId})`} />

        {/* Outer octagon / 8-pointed star base */}
        <path
          d="M50 3L73 27L97 50L73 73L50 97L27 73L3 50L27 27Z"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2"
          opacity="0.5"
        />

        {/* 8-pointed star (Rub el Hizb) — outer */}
        <path
          d="M50 8L58 42L92 50L58 58L50 92L42 58L8 50L42 42Z"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1.8"
        />

        {/* Inner diamond */}
        <path
          d="M50 20L80 50L50 80L20 50Z"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1.2"
          opacity="0.7"
        />

        {/* Inner circle */}
        <circle
          cx="50"
          cy="50"
          r="14"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1"
          opacity="0.5"
        />

        {/* Central 8-pointed star */}
        <path
          d="M50 28L54 46L72 50L54 54L50 72L46 54L28 50L46 46Z"
          fill={`url(#${gradId})`}
          opacity="0.9"
        />

        {/* Center dot */}
        <circle cx="50" cy="50" r="4" fill={grad.stops[0].color} opacity="0.8" />

        {/* Decorative dots at octagon vertices */}
        <circle cx="50" cy="5" r="2.5" fill={grad.stops[0].color} opacity="0.6" />
        <circle cx="95" cy="50" r="2.5" fill={grad.stops[0].color} opacity="0.6" />
        <circle cx="50" cy="95" r="2.5" fill={grad.stops[0].color} opacity="0.6" />
        <circle cx="5" cy="50" r="2.5" fill={grad.stops[0].color} opacity="0.6" />

        {/* Diagonal decorative dots */}
        <circle cx="72" cy="28" r="1.8" fill={grad.stops[0].color} opacity="0.4" />
        <circle cx="28" cy="28" r="1.8" fill={grad.stops[0].color} opacity="0.4" />
        <circle cx="72" cy="72" r="1.8" fill={grad.stops[0].color} opacity="0.4" />
        <circle cx="28" cy="72" r="1.8" fill={grad.stops[0].color} opacity="0.4" />

        {/* Arabesque petals — 4 curved arcs */}
        <path
          d="M50 14Q60 30 50 42Q40 30 50 14Z"
          fill="none"
          stroke={grad.stops[0].color}
          strokeWidth="0.8"
          opacity="0.35"
        />
        <path
          d="M86 50Q70 60 58 50Q70 40 86 50Z"
          fill="none"
          stroke={grad.stops[0].color}
          strokeWidth="0.8"
          opacity="0.35"
        />
        <path
          d="M50 86Q40 70 50 58Q60 70 50 86Z"
          fill="none"
          stroke={grad.stops[0].color}
          strokeWidth="0.8"
          opacity="0.35"
        />
        <path
          d="M14 50Q30 40 42 50Q30 60 14 50Z"
          fill="none"
          stroke={grad.stops[0].color}
          strokeWidth="0.8"
          opacity="0.35"
        />
      </svg>
    </div>
  );
}

/**
 * A full-wordmark logo combining the Fatimi icon with "Darse Burhani" text.
 */
export function FatimiWordmark({
  size = 28,
  variant = "default",
  showTagline = false,
  tagline = "",
}: {
  size?: number;
  variant?: RoleVariant;
  showTagline?: boolean;
  tagline?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <FatimiLogo size={size} variant={variant} />
      <div className="flex flex-col">
        <span className="font-display font-bold text-white text-base leading-tight tracking-tight">
          Darse Burhani
        </span>
        {showTagline && tagline && (
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "rgba(212,175,55,0.7)" }}>
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}
