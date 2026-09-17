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
