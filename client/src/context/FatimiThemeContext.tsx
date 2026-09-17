"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type FatimiThemeId = "fatimi-rawdah-marmar" | "green";

export interface FatimiThemeConfig {
  id: FatimiThemeId;
  name: string;
  nameArabic: string;
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
  name: "Deep Emerald & Mint",
  nameArabic: "زمردي هادئ",
  subtitle: "Pristine Deep Forest Emerald & Fresh Mint",
  badge: "Green",
  swatch: {
    primary: "#064e3b",
    secondary: "#022c22",
    gold: "#10b981",
    surface: "#fbfdfc",
  },
  sidebarGradient: "linear-gradient(180deg, #011f18 0%, #022c22 55%, #064e3b 100%)",
  contentGradient: "linear-gradient(180deg, #fbfdfc 0%, #ffffff 100%)",
  cardHeroGradient: "linear-gradient(135deg, #064e3b 0%, #047857 55%, #059669 100%)",
  headerLine: "linear-gradient(90deg, #022c22, #10b981, #022c22)",
  goldAccent: "#10b981",
  primaryColor: "#064e3b",
  secondaryColor: "#022c22",
  accentGlow: "rgba(16, 185, 129, 0.2)",
  badgeClass: "bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold",
  btnPrimaryClass:
    "bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#059669] hover:from-[#047857] hover:to-[#064e3b] text-white font-semibold shadow-sm",
  borderTint: "border-emerald-200",
  lightBgTint: "bg-emerald-50/40",
};

export const FATIMI_THEMES: Record<string, FatimiThemeConfig> = {
  "fatimi-rawdah-marmar": GREEN_THEME,
  "green": GREEN_THEME,
  "fatimi-mishkat-nur": GREEN_THEME,
  "fatimi-kufa-zari": GREEN_THEME,
};

interface FatimiThemeContextValue {
  currentThemeId: FatimiThemeId;
  theme: FatimiThemeConfig;
  setTheme: (id: FatimiThemeId) => void;
  availableThemes: FatimiThemeConfig[];
}

const FatimiThemeContext = createContext<FatimiThemeContextValue | null>(null);

const STORAGE_KEY = "db_fatimi_active_theme";

export function FatimiThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentThemeId] = useState<FatimiThemeId>("fatimi-rawdah-marmar");

  const applyThemeToDOM = () => {
    const root = document.documentElement;
    root.setAttribute("data-fatimi-theme", "fatimi-rawdah-marmar");
    if (document.body) {
      document.body.setAttribute("data-fatimi-theme", "fatimi-rawdah-marmar");
    }

    // Direct CSS variable injection for instantaneous DOM reactivity
    root.style.setProperty("--fatimi-primary", GREEN_THEME.swatch.primary);
    root.style.setProperty("--fatimi-secondary", GREEN_THEME.swatch.secondary);
    root.style.setProperty("--fatimi-gold", GREEN_THEME.swatch.gold);
    root.style.setProperty("--fatimi-surface", GREEN_THEME.swatch.surface);
    root.style.setProperty("--fatimi-sidebar-bg", GREEN_THEME.sidebarGradient);
    root.style.setProperty("--fatimi-banner-bg", GREEN_THEME.cardHeroGradient);
    root.style.setProperty("--fatimi-header-line", GREEN_THEME.headerLine);
    root.style.setProperty("--fatimi-glow", GREEN_THEME.accentGlow);
    root.style.setProperty("--fatimi-accent", GREEN_THEME.goldAccent);
  };

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    applyThemeToDOM();
  }, []);

  const value: FatimiThemeContextValue = {
    currentThemeId,
    theme: GREEN_THEME,
    setTheme: () => {},
    availableThemes: [GREEN_THEME],
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
      availableThemes: [GREEN_THEME],
    };
  }
  return context;
}
