"use client";

import React, { useState } from "react";

type RoleVariant = "default" | "admin" | "teacher" | "student" | "parent" | "gold";

interface FatimiLogoProps {
  size?: number;
  variant?: RoleVariant;
  className?: string;
  glow?: boolean;
  useSvg?: boolean;
  alt?: string;
}

const gradientMap: Record<
  RoleVariant,
  { id: string; primary: string; secondary: string; accent: string; stops: { offset: string; color: string }[] }
> = {
  default: {
    id: "fatimiDefault",
    primary: "#d4af37",
    secondary: "#b8860b",
    accent: "#047857",
    stops: [
      { offset: "0%", color: "#fef08a" },
      { offset: "35%", color: "#d4af37" },
      { offset: "75%", color: "#b8860b" },
      { offset: "100%", color: "#065f46" },
    ],
  },
  gold: {
    id: "fatimiGold",
    primary: "#fbbf24",
    secondary: "#d4af37",
    accent: "#b45309",
    stops: [
      { offset: "0%", color: "#fffbeb" },
      { offset: "30%", color: "#fcd34d" },
      { offset: "65%", color: "#d4af37" },
      { offset: "100%", color: "#92400e" },
    ],
  },
  admin: {
    id: "fatimiAdmin",
    primary: "#d4af37",
    secondary: "#b8860b",
    accent: "#047857",
    stops: [
      { offset: "0%", color: "#fde047" },
      { offset: "40%", color: "#d4af37" },
      { offset: "75%", color: "#b8860b" },
      { offset: "100%", color: "#047857" },
    ],
  },
  teacher: {
    id: "fatimiTeacher",
    primary: "#38bdf8",
    secondary: "#0284c7",
    accent: "#0369a1",
    stops: [
      { offset: "0%", color: "#e0f2fe" },
      { offset: "40%", color: "#38bdf8" },
      { offset: "75%", color: "#0284c7" },
      { offset: "100%", color: "#075985" },
    ],
  },
  student: {
    id: "fatimiStudent",
    primary: "#34d399",
    secondary: "#10b981",
    accent: "#047857",
    stops: [
      { offset: "0%", color: "#ecfdf5" },
      { offset: "40%", color: "#34d399" },
      { offset: "75%", color: "#059669" },
      { offset: "100%", color: "#064e3b" },
    ],
  },
  parent: {
    id: "fatimiParent",
    primary: "#fbbf24",
    secondary: "#f59e0b",
    accent: "#d97706",
    stops: [
      { offset: "0%", color: "#fffbeb" },
      { offset: "40%", color: "#fbbf24" },
      { offset: "75%", color: "#d97706" },
      { offset: "100%", color: "#b45309" },
    ],
  },
};

/**
 * Main Fatimi Brand Emblem.
 * By default renders the official high-resolution /logo.png with fallback to sacred geometry SVG.
 */
export function FatimiLogo({
  size = 36,
  variant = "default",
  className = "",
  glow = true,
  useSvg = false,
  alt = "Darse Burhani Logo",
}: FatimiLogoProps) {
  const [imgError, setImgError] = useState(false);
  const grad = gradientMap[variant] || gradientMap.default;
  const gradId = grad.id;
  const glowId = `${gradId}Glow`;

  if (!useSvg && !imgError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
        style={{ width: size, height: size }}
      >
        {glow && (
          <div
            className="absolute inset-0 rounded-full blur-[6px] opacity-40 transition-opacity"
            style={{
              background: `radial-gradient(circle, ${grad.primary} 0%, transparent 70%)`,
            }}
          />
        )}
        <img
          src="/logo.png"
          alt={alt}
          width={size}
          height={size}
          loading="eager"
          decoding="async"
          onError={() => setImgError(true)}
          className="relative z-10 w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(212,175,55,0.35)]"
        />
      </div>
    );
  }

  // Pure SVG Sacred Geometry Variant
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {grad.stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={grad.primary} stopOpacity={glow ? "0.3" : "0"} />
            <stop offset="100%" stopColor={grad.secondary} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer radial ambient aura */}
        {glow && <circle cx="50" cy="50" r="48" fill={`url(#${glowId})`} />}

        {/* Primary 8-Pointed Star (Rub-el-Hizb) Silhouette */}
        <path
          d="M50 4L63.5 22.5L86 22.5L78.5 44L96 50L78.5 56L86 77.5L63.5 77.5L50 96L36.5 77.5L14 77.5L21.5 56L4 50L21.5 44L14 22.5L36.5 22.5Z"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2.2"
          strokeLinejoin="round"
          opacity="0.95"
        />

        {/* Interlocking Rotated Square 1 (Square) */}
        <rect
          x="20"
          y="20"
          width="60"
          height="60"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1.2"
          opacity="0.6"
        />

        {/* Interlocking Rotated Square 2 (Diamond 45 deg) */}
        <rect
          x="20"
          y="20"
          width="60"
          height="60"
          transform="rotate(45 50 50)"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1.2"
          opacity="0.6"
        />

        {/* Inner Geometric Sacred Ring */}
        <circle
          cx="50"
          cy="50"
          r="16"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* Central Core Starburst */}
        <path
          d="M50 36L53.5 46.5L64 50L53.5 53.5L50 64L46.5 53.5L36 50L46.5 46.5Z"
          fill={`url(#${gradId})`}
          opacity="0.95"
        />

        {/* Center Golden Bindu/Nucleus */}
        <circle cx="50" cy="50" r="3.2" fill="#ffffff" opacity="0.9" />
        <circle cx="50" cy="50" r="1.8" fill={grad.primary} />

        {/* 8 Cardinal Vertex Accent Pips */}
        <circle cx="50" cy="7" r="1.6" fill={grad.primary} />
        <circle cx="93" cy="50" r="1.6" fill={grad.primary} />
        <circle cx="50" cy="93" r="1.6" fill={grad.primary} />
        <circle cx="7" cy="50" r="1.6" fill={grad.primary} />
        <circle cx="80" cy="20" r="1.2" fill={grad.primary} opacity="0.75" />
        <circle cx="80" cy="80" r="1.2" fill={grad.primary} opacity="0.75" />
        <circle cx="20" cy="80" r="1.2" fill={grad.primary} opacity="0.75" />
        <circle cx="20" cy="20" r="1.2" fill={grad.primary} opacity="0.75" />
      </svg>
    </div>
  );
}

/**
 * A full-wordmark logo combining the Fatimi icon with "Darse Burhani (Nisab)" text.
 */
export function FatimiWordmark({
  size = 34,
  variant = "gold",
  showTagline = true,
  tagline = "Mahad al Zahra",
  theme = "dark",
  className = "",
}: {
  size?: number;
  variant?: RoleVariant;
  showTagline?: boolean;
  tagline?: string;
  theme?: "dark" | "light";
  className?: string;
}) {
  const isDark = theme === "dark";

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div
        className="rounded-2xl p-1.5 flex items-center justify-center shadow-md ring-1 ring-amber-400/30 shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #022c22 0%, #064e3b 100%)"
            : "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
        }}
      >
        <FatimiLogo size={size} variant={variant} />
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className={`font-display font-extrabold tracking-tight text-base sm:text-lg leading-tight truncate ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Darse Burhani <span className="text-amber-400 font-semibold text-xs sm:text-sm font-sans">(Nisab)</span>
        </span>
        {showTagline && tagline && (
          <span
            className={`text-[10.5px] font-bold tracking-wider uppercase truncate ${
              isDark ? "text-amber-300/80" : "text-emerald-800"
            }`}
          >
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}
