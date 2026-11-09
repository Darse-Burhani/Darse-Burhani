"use client";

import React from "react";

/**
 * Reusable Fatimi ornamental components: 8-fold star rosettes, corner
 * brackets, star dividers, and unique Fatimi architectural patterns.
 */

// ── 1. Large 8-fold star rosette (medallion) ──
export function FatimidRosette({
  size = 200,
  stroke = "#d4af37",
  opacity = 0.5,
  className = "",
}: {
  size?: number;
  stroke?: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer octagon */}
      <path
        d="M100 6L140 60L194 100L140 140L100 194L60 140L6 100L60 60Z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      {/* 8-pointed star (Rub el Hizb) */}
      <path
        d="M100 14L116 84L186 100L116 116L100 186L84 116L14 100L84 84Z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
      />
      {/* Inner diamond */}
      <path
        d="M100 40L160 100L100 160L40 100Z"
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        opacity="0.8"
      />
      {/* Inner circle */}
      <circle
        cx="100"
        cy="100"
        r="30"
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        opacity="0.7"
      />
      {/* Center star */}
      <path
        d="M100 66L108 92L134 100L108 108L100 134L92 108L66 100L92 92Z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
      />
      {/* Center dot */}
      <circle cx="100" cy="100" r="5" fill={stroke} opacity="0.9" />
      {/* Vertex dots */}
      <circle cx="100" cy="6" r="3" fill={stroke} opacity="0.7" />
      <circle cx="194" cy="100" r="3" fill={stroke} opacity="0.7" />
      <circle cx="100" cy="194" r="3" fill={stroke} opacity="0.7" />
      <circle cx="6" cy="100" r="3" fill={stroke} opacity="0.7" />
    </svg>
  );
}

// ── 2. Ornamental corner bracket (Manuscript border) ──
export function FatimiCornerBracket({
  size = 36,
  stroke = "#d4af37",
  opacity = 0.8,
  flipH = false,
  flipV = false,
  className = "",
}: {
  size?: number;
  stroke?: string;
  opacity?: number;
  flipH?: boolean;
  flipV?: boolean;
  className?: string;
}) {
  const transform = `${flipH ? "scale(-1,1) " : ""}${flipV ? "scale(1,-1) " : ""}`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      style={{ opacity, transform }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2 2L46 2" fill="none" stroke={stroke} strokeWidth="2" />
      <path d="M2 2L2 46" fill="none" stroke={stroke} strokeWidth="2" />
      <path d="M9 9L39 9" fill="none" stroke={stroke} strokeWidth="1" opacity="0.6" />
      <path d="M9 9L9 39" fill="none" stroke={stroke} strokeWidth="1" opacity="0.6" />
      <path d="M9 9L14 14L9 19L4 14Z" fill="none" stroke={stroke} strokeWidth="1.2" />
      <circle cx="46" cy="2" r="2.2" fill={stroke} opacity="0.8" />
      <circle cx="2" cy="46" r="2.2" fill={stroke} opacity="0.8" />
    </svg>
  );
}

// ── 3. Central Star Divider ──
export function FatimiStarDivider({
  className = "",
  maxWidth = "w-40",
}: {
  className?: string;
  maxWidth?: string;
}) {
  return (
    <div className={`flex items-center gap-2 mx-auto ${maxWidth} ${className}`}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d4af37]/60 to-[#d4af37]/60" />
      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"
          fill="none"
          stroke="#d4af37"
          strokeWidth="1.2"
        />
        <circle cx="12" cy="12" r="2" fill="#d4af37" opacity="0.9" />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#d4af37]/60 to-[#d4af37]/60" />
    </div>
  );
}

// ── 4. Theme 1 Pattern: Mishkat Hanging Lamp Filigree ──
export function MishkatFiligreePattern({
  className = "",
  stroke = "#fbbf24",
  opacity = 0.06,
}: {
  className?: string;
  stroke?: string;
  opacity?: number;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} style={{ opacity }}>
      <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="mishkatPattern" width="60" height="60" patternUnits="userSpaceOnUse">
            {/* Hanging lamp outline */}
            <path d="M30 5 L30 15 M20 15 Q30 10 40 15 L45 35 Q30 45 15 35 Z" fill="none" stroke={stroke} strokeWidth="0.75" />
            <circle cx="30" cy="25" r="3" fill={stroke} opacity="0.6" />
            {/* Radiant stars */}
            <path d="M30 48 L32 54 L38 56 L32 58 L30 64 L28 58 L22 56 L28 54 Z" fill="none" stroke={stroke} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mishkatPattern)" />
      </svg>
    </div>
  );
}

// ── 5. Theme 2 Pattern: Floriated Kufic Calligraphic Grid ──
export function KuficGeometricPattern({
  className = "",
  stroke = "#eab308",
  opacity = 0.06,
}: {
  className?: string;
  stroke?: string;
  opacity?: number;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} style={{ opacity }}>
      <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kuficPattern" width="70" height="70" patternUnits="userSpaceOnUse">
            {/* Square Kufic interlocking lattice */}
            <path d="M0 35 L35 0 L70 35 L35 70 Z M15 35 L35 15 L55 35 L35 55 Z" fill="none" stroke={stroke} strokeWidth="0.8" />
            <path d="M35 5 L35 25 M35 45 L35 65 M5 35 L25 35 M45 35 L65 35" fill="none" stroke={stroke} strokeWidth="0.5" />
            <circle cx="35" cy="35" r="4" fill="none" stroke={stroke} strokeWidth="0.75" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kuficPattern)" />
      </svg>
    </div>
  );
}

// ── 6. Theme 3 Pattern: Rawdah Arabesque & Inlaid Marble ──
export function RawdahArabesquePattern({
  className = "",
  stroke = "#e2b170",
  opacity = 0.06,
}: {
  className?: string;
  stroke?: string;
  opacity?: number;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} style={{ opacity }}>
      <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="rawdahPattern" width="80" height="80" patternUnits="userSpaceOnUse">
            {/* 8-pointed star & floral curvature */}
            <path d="M40 8 L50 30 L72 40 L50 50 L40 72 L30 50 L8 40 L30 30 Z" fill="none" stroke={stroke} strokeWidth="0.75" />
            <circle cx="40" cy="40" r="12" fill="none" stroke={stroke} strokeWidth="0.5" />
            <circle cx="40" cy="40" r="3" fill={stroke} opacity="0.6" />
            <circle cx="0" cy="0" r="16" fill="none" stroke={stroke} strokeWidth="0.5" />
            <circle cx="80" cy="0" r="16" fill="none" stroke={stroke} strokeWidth="0.5" />
            <circle cx="0" cy="80" r="16" fill="none" stroke={stroke} strokeWidth="0.5" />
            <circle cx="80" cy="80" r="16" fill="none" stroke={stroke} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rawdahPattern)" />
      </svg>
    </div>
  );
}

// ── 7. Base Pattern Fallback ──
export function FatimiPattern({
  className = "",
  opacity = 0.03,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} style={{ opacity }}>
      <svg className="w-full h-full" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="baseFatimiPattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M40 0L80 40L40 80L0 40Z" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="15" fill="none" stroke="#d4af37" strokeWidth="0.4" />
            <path d="M40 25L55 40L40 55L25 40Z" fill="none" stroke="#d4af37" strokeWidth="0.3" />
            <circle cx="40" cy="40" r="5" fill="none" stroke="#d4af37" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#baseFatimiPattern)" />
      </svg>
    </div>
  );
}


// ── 8. Authentic Fatimi 12-Point Star Rosette (Photorealistic Girih Medallion) ──
export function FatimiGirihRosette12({
  size = 120,
  stroke = "url(#fatimiBronzeGoldGradient)",
  opacity = 1,
  className = "",
}: {
  size?: number;
  stroke?: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="fatimiBronzeGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff2cc" />
          <stop offset="25%" stopColor="#fcd468" />
          <stop offset="50%" stopColor="#f3b833" />
          <stop offset="75%" stopColor="#c59b27" />
          <stop offset="100%" stopColor="#8c5828" />
        </linearGradient>
        <radialGradient id="fatimiRosetteCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fcd468" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#c59b27" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1e1208" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Recessed Ground Glow */}
      <circle cx="100" cy="100" r="94" fill="url(#fatimiRosetteCoreGlow)" />

      {/* Outer 12-gon boundary ring */}
      <polygon
        points="
          100,6 147,19 181,53 194,100 181,147 147,181
          100,194 53,181 19,147 6,100 19,53 53,19
        "
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
        opacity="0.5"
      />

      {/* Primary 12-pointed star ribbons (3 interlaced squares & octagons) */}
      {/* Square 1 (0 deg) */}
      <rect x="25" y="25" width="150" height="150" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.65" />
      {/* Square 2 (30 deg) */}
      <rect x="25" y="25" width="150" height="150" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.65" transform="rotate(30 100 100)" />
      {/* Square 3 (60 deg) */}
      <rect x="25" y="25" width="150" height="150" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.65" transform="rotate(60 100 100)" />

      {/* Interlaced Girih Strapwork Petals (12 radiating kites) */}
      <g stroke={stroke} strokeWidth="1.2" fill="none" opacity="0.9">
        <path d="M100 16 L112 60 L100 82 L88 60 Z" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(30 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(60 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(90 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(120 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(150 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(180 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(210 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(240 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(270 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(300 100 100)" />
        <path d="M100 16 L112 60 L100 82 L88 60 Z" transform="rotate(330 100 100)" />
      </g>

      {/* Mid circular interlacing ring */}
      <circle cx="100" cy="100" r="42" fill="none" stroke={stroke} strokeWidth="1" opacity="0.75" />
      <circle cx="100" cy="100" r="26" fill="none" stroke={stroke} strokeWidth="0.8" opacity="0.6" />

      {/* Central 12-petaled daisy rosette (Floral Core) */}
      <g fill={stroke} opacity="0.85">
        <circle cx="100" cy="80" r="3.5" />
        <circle cx="110" cy="83" r="3.5" />
        <circle cx="117" cy="90" r="3.5" />
        <circle cx="120" cy="100" r="3.5" />
        <circle cx="117" cy="110" r="3.5" />
        <circle cx="110" cy="117" r="3.5" />
        <circle cx="100" cy="120" r="3.5" />
        <circle cx="90" cy="117" r="3.5" />
        <circle cx="83" cy="110" r="3.5" />
        <circle cx="80" cy="100" r="3.5" />
        <circle cx="83" cy="90" r="3.5" />
        <circle cx="90" cy="83" r="3.5" />
        {/* Core Center Dot */}
        <circle cx="100" cy="100" r="7" />
      </g>
    </svg>
  );
}

// ── 9. Seamless Fatimi Girih Vector Jali Pattern ──
export function FatimiGirihJaliPattern({
  className = "",
  stroke = "#f3b833",
  opacity = 0.08,
}: {
  className?: string;
  stroke?: string;
  opacity?: number;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} style={{ opacity }}>
      <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="fatimiGirihTile" width="120" height="120" patternUnits="userSpaceOnUse">
            {/* Center 12-pointed star */}
            <g transform="translate(60, 60)" stroke={stroke} strokeWidth="0.85" fill="none">
              <rect x="-30" y="-30" width="60" height="60" />
              <rect x="-30" y="-30" width="60" height="60" transform="rotate(30)" />
              <rect x="-30" y="-30" width="60" height="60" transform="rotate(60)" />
              <circle cx="0" cy="0" r="16" strokeWidth="0.6" />
              <circle cx="0" cy="0" r="3.5" fill={stroke} opacity="0.75" />
            </g>

            {/* Corner Quadrants */}
            <g transform="translate(0, 0)" stroke={stroke} strokeWidth="0.85" fill="none">
              <rect x="-24" y="-24" width="48" height="48" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(30)" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(60)" />
              <circle cx="0" cy="0" r="12" strokeWidth="0.6" />
            </g>
            <g transform="translate(120, 0)" stroke={stroke} strokeWidth="0.85" fill="none">
              <rect x="-24" y="-24" width="48" height="48" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(30)" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(60)" />
              <circle cx="0" cy="0" r="12" strokeWidth="0.6" />
            </g>
            <g transform="translate(0, 120)" stroke={stroke} strokeWidth="0.85" fill="none">
              <rect x="-24" y="-24" width="48" height="48" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(30)" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(60)" />
              <circle cx="0" cy="0" r="12" strokeWidth="0.6" />
            </g>
            <g transform="translate(120, 120)" stroke={stroke} strokeWidth="0.85" fill="none">
              <rect x="-24" y="-24" width="48" height="48" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(30)" />
              <rect x="-24" y="-24" width="48" height="48" transform="rotate(60)" />
              <circle cx="0" cy="0" r="12" strokeWidth="0.6" />
            </g>

            {/* Connecting Strapwork Lines */}
            <line x1="60" y1="0" x2="60" y2="120" stroke={stroke} strokeWidth="0.5" opacity="0.4" />
            <line x1="0" y1="60" x2="120" y2="60" stroke={stroke} strokeWidth="0.5" opacity="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fatimiGirihTile)" />
      </svg>
    </div>
  );
}

// ── 10. Turnkey Fatimi Bronze Card Component ──
export function FatimiBronzeCard({
  children,
  className = "",
  variant = "bronze",
  withGlow = true,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "bronze" | "subtle" | "bezel" | "watermark";
  withGlow?: boolean;
}) {
  const variantClass = {
    bronze: "fatimi-girih-bronze",
    subtle: "fatimi-girih-subtle",
    bezel: "fatimi-girih-bezel bg-[#160d05] text-[#fdf8ed]",
    watermark: "fatimi-girih-watermark bg-white border border-[#e7e0d0] text-[#221c12]",
  }[variant];

  return (
    <div
      className={`relative rounded-2xl transition-all duration-300 ${variantClass} ${
        withGlow ? "shadow-fatimi-bronze" : ""
      } ${className}`}
    >
      {/* Top golden hairline highlight */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#ffd885]/80 to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ── 11. Fatimi 12-Star Ornamental Section Divider ──
export function FatimiGirihDivider({
  className = "",
  maxWidth = "w-64",
  label,
}: {
  className?: string;
  maxWidth?: string;
  label?: string;
}) {
  return (
    <div className={`flex items-center gap-3 mx-auto ${maxWidth} ${className}`}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#c59b27]/60 to-[#f3b833]/80" />
      <div className="flex items-center gap-1.5 shrink-0">
        <FatimiGirihRosette12 size={22} opacity={0.9} />
        {label && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#ffd885] px-1 font-heading">
            {label}
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#c59b27]/60 to-[#f3b833]/80" />
    </div>
  );
}
