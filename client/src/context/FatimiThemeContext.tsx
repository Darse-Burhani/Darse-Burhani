"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type FatimiThemeId = "fatimi-rawdah-marmar" | "twilight-palace" | "green";

export interface FatimiThemeConfig {
  id: FatimiThemeId;
  name: string;
  nameArabic?: string;
  subtitle: string;
  badge: string;
  swatch: {
    primary: string;
    secondary: string;
    gold: string;
    surface: string;
  };
  sidebarGradient: string;
  contentGradient: string;
  cardHeroGradient: string;
  headerLine: string;
  goldAccent: string;
  primaryColor: string;
  secondaryColor: string;
  accentGlow: string;
  badgeClass: string;
  btnPrimaryClass: string;
  borderTint: string;
  lightBgTint: string;
}

export const GREEN_THEME: FatimiThemeConfig = {
  id: "fatimi-rawdah-marmar",
  name: "Midnight Gold",
  nameArabic: "ذهبي ليلي",
  subtitle: "Midnight Charcoal Canvas & Champagne Gold",
  badge: "Gold",
  swatch: {
    primary: "#0d0d0d",
    secondary: "#141414",
    gold: "#f3b833",
    surface: "#ffffff",
  },
  sidebarGradient: "linear-gradient(180deg, #0d0d0d 0%, #141414 55%, #1c1c1c 100%)",
  contentGradient: "#faf7f0",
  cardHeroGradient: "linear-gradient(135deg, #1c1c1c 0%, #141414 45%, #f3b833 130%)",
  headerLine: "linear-gradient(90deg, #e7e0d0, #f3b833, #e7e0d0)",
  goldAccent: "#f3b833",
  primaryColor: "#0d0d0d",
  secondaryColor: "#141414",
  accentGlow: "rgba(252, 212, 104, 0.18)",
  badgeClass: "bg-amber-50 text-amber-950 border border-amber-300 font-bold",
  btnPrimaryClass:
    "bg-gradient-to-r from-[#fcd468] via-[#f3b833] to-[#dc6b27] hover:from-[#ef9a33] hover:to-[#b8541e] text-[#1c1403] font-bold shadow-sm",
  borderTint: "border-slate-200",
  lightBgTint: "bg-amber-50/60",
};

// ── Twilight Palace ──
// Sign-in inspired theme: sunset palace photo palette — indigo sky, amber
// window-glow accents, and the same amber→sunset-orange action gradient.
export const SUNSET_THEME: FatimiThemeConfig = {
  id: "twilight-palace",
  name: "Twilight Palace",
  subtitle: "Sunset Indigo Sky & Warm Amber Glass",
  badge: "Sunset",
  swatch: {
    primary: "#1a2038",
    secondary: "#0c1026",
    gold: "#ebaa45",
    surface: "#ffffff",
  },
  sidebarGradient: "linear-gradient(180deg, #10142a 0%, #1a2038 55%, #2a3358 100%)",
  contentGradient: "#faf7f0",
  cardHeroGradient: "linear-gradient(135deg, #1a2038 0%, #2a3358 55%, #3d4771 100%)",
  headerLine: "linear-gradient(90deg, #e7e0d0, #ebaa45, #e7e0d0)",
  goldAccent: "#ebaa45",
  primaryColor: "#1a2038",
  secondaryColor: "#0c1026",
  accentGlow: "rgba(235, 170, 69, 0.18)",
  badgeClass: "bg-amber-50 text-amber-950 border border-amber-300 font-bold",
  btnPrimaryClass:
    "bg-gradient-to-r from-[#fcd468] via-[#ef9a33] to-[#dc6b27] hover:from-[#ef9a33] hover:to-[#dc6b27] text-[#1c1403] font-bold shadow-md",
  borderTint: "border-slate-200",
  lightBgTint: "bg-amber-50/60",
};

export const FATIMI_THEMES: Record<string, FatimiThemeConfig> = {
  "fatimi-rawdah-marmar": GREEN_THEME,
  "green": GREEN_THEME,
  "fatimi-mishkat-nur": GREEN_THEME,
  "fatimi-kufa-zari": GREEN_THEME,
  "twilight-palace": SUNSET_THEME,
};

// Distinct, selectable themes surfaced in the portal Appearance switcher.
export const AVAILABLE_THEMES: FatimiThemeConfig[] = [GREEN_THEME, SUNSET_THEME];

interface FatimiThemeContextValue {
  currentThemeId: FatimiThemeId;
  theme: FatimiThemeConfig;
  setTheme: (id: FatimiThemeId) => void;
  availableThemes: FatimiThemeConfig[];
}

const FatimiThemeContext = createContext<FatimiThemeContextValue | null>(null);

const STORAGE_KEY = "db_fatimi_active_theme_v3";

function readStoredThemeId(): FatimiThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FATIMI_THEMES[stored]) return stored as FatimiThemeId;
  } catch {
    // ignore storage failures (private mode etc.)
  }
  return "fatimi-rawdah-marmar";
}

export function FatimiThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentThemeId, setCurrentThemeId] = useState<FatimiThemeId>(readStoredThemeId);

  useEffect(() => {
    const active = FATIMI_THEMES[currentThemeId] ?? GREEN_THEME;
    const root = document.documentElement;
    root.setAttribute("data-fatimi-theme", active.id);
    if (document.body) {
      document.body.setAttribute("data-fatimi-theme", active.id);
    }

    // Direct CSS variable injection for instantaneous DOM reactivity
    root.style.setProperty("--fatimi-primary", active.swatch.primary);
    root.style.setProperty("--fatimi-secondary", active.swatch.secondary);
    root.style.setProperty("--fatimi-gold", active.swatch.gold);
    root.style.setProperty("--fatimi-surface", active.swatch.surface);
    root.style.setProperty("--fatimi-sidebar-bg", active.sidebarGradient);
    root.style.setProperty("--fatimi-banner-bg", active.cardHeroGradient);
    root.style.setProperty("--fatimi-header-line", active.headerLine);
    root.style.setProperty("--fatimi-glow", active.accentGlow);
    root.style.setProperty("--fatimi-accent", active.goldAccent);

    try {
      localStorage.setItem(STORAGE_KEY, active.id);
    } catch {
      // ignore storage failures
    }
  }, [currentThemeId]);

  const value: FatimiThemeContextValue = {
    currentThemeId,
    theme: FATIMI_THEMES[currentThemeId] ?? GREEN_THEME,
    setTheme: (id: FatimiThemeId) => {
      if (FATIMI_THEMES[id]) setCurrentThemeId(id);
    },
    availableThemes: AVAILABLE_THEMES,
  };

  return (
    <FatimiThemeContext.Provider value={value}>
      {children}
    </FatimiThemeContext.Provider>
  );
}

export function useFatimiTheme() {
  const context = useContext(FatimiThemeContext);
  if (!context) {
    return {
      currentThemeId: "fatimi-rawdah-marmar" as FatimiThemeId,
      theme: GREEN_THEME,
      setTheme: () => {},
      availableThemes: AVAILABLE_THEMES,
    };
  }
  return context;
}
