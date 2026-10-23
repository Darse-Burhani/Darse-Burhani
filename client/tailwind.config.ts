import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Theme-aware green family ──────────────────────────────────
        // emerald/teal/green compile to `rgb(var(--db-c-*) / <alpha-value>)`,
        // so the active [data-fatimi-theme] repaints every green utility
        // (text/bg/border/ring/gradient/shadow + hover & opacity modifiers)
        // without a single per-class override. Defaults live in :root
        // (emerald green theme); twilight-palace redefines them to sunset.
        emerald: {
          50: "rgb(var(--db-c-emerald-50) / <alpha-value>)",
          100: "rgb(var(--db-c-emerald-100) / <alpha-value>)",
          200: "rgb(var(--db-c-emerald-200) / <alpha-value>)",
          300: "rgb(var(--db-c-emerald-300) / <alpha-value>)",
          400: "rgb(var(--db-c-emerald-400) / <alpha-value>)",
          500: "rgb(var(--db-c-emerald-500) / <alpha-value>)",
          600: "rgb(var(--db-c-emerald-600) / <alpha-value>)",
          700: "rgb(var(--db-c-emerald-700) / <alpha-value>)",
          800: "rgb(var(--db-c-emerald-800) / <alpha-value>)",
          900: "rgb(var(--db-c-emerald-900) / <alpha-value>)",
          950: "rgb(var(--db-c-emerald-950) / <alpha-value>)",
        },
        teal: {
          50: "rgb(var(--db-c-teal-50) / <alpha-value>)",
          100: "rgb(var(--db-c-teal-100) / <alpha-value>)",
          200: "rgb(var(--db-c-teal-200) / <alpha-value>)",
          300: "rgb(var(--db-c-teal-300) / <alpha-value>)",
          400: "rgb(var(--db-c-teal-400) / <alpha-value>)",
          500: "rgb(var(--db-c-teal-500) / <alpha-value>)",
          600: "rgb(var(--db-c-teal-600) / <alpha-value>)",
          700: "rgb(var(--db-c-teal-700) / <alpha-value>)",
          800: "rgb(var(--db-c-teal-800) / <alpha-value>)",
          900: "rgb(var(--db-c-teal-900) / <alpha-value>)",
          950: "rgb(var(--db-c-teal-950) / <alpha-value>)",
        },
        green: {
          50: "rgb(var(--db-c-green-50) / <alpha-value>)",
          100: "rgb(var(--db-c-green-100) / <alpha-value>)",
          200: "rgb(var(--db-c-green-200) / <alpha-value>)",
          300: "rgb(var(--db-c-green-300) / <alpha-value>)",
          400: "rgb(var(--db-c-green-400) / <alpha-value>)",
          500: "rgb(var(--db-c-green-500) / <alpha-value>)",
          600: "rgb(var(--db-c-green-600) / <alpha-value>)",
          700: "rgb(var(--db-c-green-700) / <alpha-value>)",
          800: "rgb(var(--db-c-green-800) / <alpha-value>)",
          900: "rgb(var(--db-c-green-900) / <alpha-value>)",
          950: "rgb(var(--db-c-green-950) / <alpha-value>)",
        },
        // Brand scale — emerald-based so every `darse-burhani-*` utility
        // renders on-theme (deep emerald + champagne gold). Canonical shell
        // is PortalShell; NavigationBar reuses these same tokens.
        // Brand scale — vibrant emerald-based palette with radiant jewel undertones
        // (tracks the emerald family 1:1, so it inherits the same theme remap)
        "darse-burhani": {
          50: "rgb(var(--db-c-emerald-50) / <alpha-value>)",
          100: "rgb(var(--db-c-emerald-100) / <alpha-value>)",
          200: "rgb(var(--db-c-emerald-200) / <alpha-value>)",
          300: "rgb(var(--db-c-emerald-300) / <alpha-value>)",
          400: "rgb(var(--db-c-emerald-400) / <alpha-value>)",
          500: "rgb(var(--db-c-emerald-500) / <alpha-value>)", // Bright vibrant emerald
          600: "rgb(var(--db-c-emerald-600) / <alpha-value>)",
          700: "rgb(var(--db-c-emerald-700) / <alpha-value>)",
          800: "rgb(var(--db-c-emerald-800) / <alpha-value>)",
          900: "rgb(var(--db-c-emerald-900) / <alpha-value>)",
          950: "rgb(var(--db-c-emerald-950) / <alpha-value>)",
        },
        admin: {
          primary: "#6366f1",
          secondary: "#818cf8",
          accent: "#a5b4fc",
          light: "#eef2ff",
          dark: "#4338ca",
          vibrant: "#4f46e5",
        },
        teacher: {
          primary: "#f59e0b",
          secondary: "#fbbf24",
          accent: "#fde68a",
          light: "#fffbeb",
          dark: "#d97706",
          vibrant: "#eab308",
        },
        student: {
          primary: "rgb(var(--db-c-emerald-500) / <alpha-value>)",
          secondary: "rgb(var(--db-c-emerald-400) / <alpha-value>)",
          accent: "rgb(var(--db-c-emerald-300) / <alpha-value>)",
          light: "rgb(var(--db-c-emerald-50) / <alpha-value>)",
          dark: "rgb(var(--db-c-emerald-600) / <alpha-value>)",
          vibrant: "rgb(var(--db-c-student-vibrant) / <alpha-value>)",
        },
        parent: {
          primary: "#ec4899",
          secondary: "#f472b6",
          accent: "#f9a8d4",
          light: "#fdf2f8",
          dark: "#db2777",
          vibrant: "#f43f5e",
        },
        fatimi: {
          deep: "rgb(var(--db-c-emerald-700) / <alpha-value>)",
          "deep-dark": "rgb(var(--db-c-emerald-900) / <alpha-value>)",
          gold: "#d4af37",
          "gold-bright": "#facc15",
          "gold-light": "#fef08a",
          "gold-dark": "#b8860b",
          bg: "rgb(var(--db-c-green-50) / <alpha-value>)",
          border: "rgb(var(--db-c-emerald-200) / <alpha-value>)",
          accent: "rgb(var(--db-c-emerald-500) / <alpha-value>)",
          obsidian: "rgb(var(--db-c-fatimi-obsidian) / <alpha-value>)",
          emerald: "rgb(var(--db-c-emerald-600) / <alpha-value>)",
          luminous: "rgb(var(--db-c-emerald-400) / <alpha-value>)",
        },
        // Premium luminous jewel tokens
        luminous: {
          emerald: "rgb(var(--db-c-emerald-500) / <alpha-value>)",
          gold: "#f59e0b",
          amber: "#fbbf24",
          cyan: "#06b6d4",
          sky: "#0ea5e9",
          indigo: "#6366f1",
          rose: "#f43f5e",
          purple: "#a855f7",
        },
        // ── 60-30-10 DESIGN RULE SYSTEM TOKENS ──
        // (repainted to the DARK GOLD 70-30-10 theme to match the sign-in page)
        rule: {
          // 60% Dominant Background & Base Surfaces
          bg: {
            canvas: "#0d0d0d",
            surface: "#141414",
            subtle: "#1c1c1c",
            muted: "#2a2a2a",
            darkCanvas: "#0d0d0d",
            darkSurface: "#141414",
          },
          // 30% Secondary Structure & Content Typography
          text: {
            primary: "#f5f0e8",
            body: "#e8e0d0",
            secondary: "#c9c0ae",
            muted: "#9a9280",
            inverted: "#0d0d0d",
            lightGold: "#fef08a",
          },
          border: {
            DEFAULT: "#2a2a2a",
            strong: "#333333",
            subtle: "#1c1c1c",
            gold: "#d4af37",
          },
          // 10% Intentional Accent & Focal Highlight (Important Text & Actions)
          highlight: {
            DEFAULT: "#f3b833",
            bright: "#fcd468",
            hover: "#ef9a33",
            dark: "#dc6b27",
            light: "#fff8e7",
            border: "#f3d9a0",
            gold: "#f59e0b",
            "gold-bright": "#facc15",
            "gold-light": "#fef3c7",
            "gold-border": "#fde68a",
            critical: "#f43f5e",
            "critical-light": "#ffe4e6",
            "critical-border": "#fecdd3",
          },
        },
        glass: {
          light: "rgba(255, 255, 255, 0.75)",
          DEFAULT: "rgba(255, 255, 255, 0.3)",
          dark: "var(--db-glass-dark)",
          card: "rgba(255, 255, 255, 0.85)",
        },
      },
      fontFamily: {
        serif: ["'Cormorant Garamond'", "Georgia", "Cambria", "'Times New Roman'", "serif"],
        heading: ["'Cormorant Garamond'", "Georgia", "'Plus Jakarta Sans'", "serif"],
        display: ["'Cormorant Garamond'", "Georgia", "'Plus Jakarta Sans'", "serif"],
        info: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
        body: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
        sans: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
        error: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        alert: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        arabic: ["'Al-Kanz'", "Arial", "sans-serif"],
        alkanz: ["'Al-Kanz'", "Arial", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
        smooth: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        glow: "0 0 20px rgb(var(--db-c-emerald-600) / 0.15)",
        "glow-lg": "0 0 40px rgb(var(--db-c-emerald-600) / 0.2)",
        "glow-amber": "0 0 20px rgba(245, 158, 11, 0.15)",
        "glow-emerald": "0 0 20px rgb(var(--db-c-emerald-500) / 0.15)",
        "glow-pink": "0 0 20px rgba(236, 72, 153, 0.15)",
        "fatimi-glow": "0 0 30px rgba(212, 175, 55, 0.15)",
        inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
        "inner-lg": "inset 0 4px 8px 0 rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02)",
        "card-hover": "0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05)",
        premium: "0 20px 60px -15px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.05)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "bounce-in": "bounce-in 0.5s ease-out",
        "streak-flare": "streak-flare 0.6s ease-out",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-up-fade": "slide-up-fade 0.4s ease-out",
        "spin-slow": "spin 3s linear infinite",
        wiggle: "wiggle 1s ease-in-out infinite",
        "gradient-x": "gradient-x 15s ease infinite",
        "gradient-y": "gradient-y 15s ease infinite",
        "gradient-xy": "gradient-xy 15s ease infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgb(var(--db-c-emerald-600) / 0.5)" },
          "50%": { boxShadow: "0 0 20px rgb(var(--db-c-emerald-600) / 0.8)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "streak-flare": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.2)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up-fade": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-5deg)" },
          "75%": { transform: "rotate(5deg)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "gradient-y": {
          "0%, 100%": { backgroundPosition: "50% 0%" },
          "50%": { backgroundPosition: "50% 100%" },
        },
        "gradient-xy": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "25%": { backgroundPosition: "100% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          "75%": { backgroundPosition: "0% 100%" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-pattern": "url('/images/hero-pattern.svg')",
        "shimmer-gradient": "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
