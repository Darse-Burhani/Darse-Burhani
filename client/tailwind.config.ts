import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand scale — emerald-based so every `darse-burhani-*` utility
        // renders on-theme (deep emerald + champagne gold). Canonical shell
        // is PortalShell; NavigationBar reuses these same tokens.
        "darse-burhani": {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#059669",
          600: "#047857",
          700: "#065f46",
          800: "#064e3b",
          900: "#022c22",
          950: "#01140f",
        },
        admin: {
          primary: "#6366f1",
          secondary: "#818cf8",
          accent: "#a5b4fc",
          light: "#eef2ff",
          dark: "#4338ca",
        },
        teacher: {
          primary: "#f59e0b",
          secondary: "#fbbf24",
          accent: "#fde68a",
          light: "#fffbeb",
          dark: "#d97706",
        },
        student: {
          primary: "#10b981",
          secondary: "#34d399",
          accent: "#6ee7b7",
          light: "#ecfdf5",
          dark: "#059669",
        },
        parent: {
          primary: "#ec4899",
          secondary: "#f472b6",
          accent: "#f9a8d4",
          light: "#fdf2f8",
          dark: "#db2777",
        },
        fatimi: {
          deep: "#047857",
          "deep-dark": "#064e3b",
          gold: "#d4af37",
          "gold-dark": "#b8860b",
          bg: "#f0fdf4",
          border: "#a7f3d0",
          accent: "#059669",
        },
        glass: {
          light: "rgba(255, 255, 255, 0.7)",
          DEFAULT: "rgba(255, 255, 255, 0.25)",
          dark: "rgba(255, 255, 255, 0.1)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "'Al-Kanz'", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "'Al-Kanz'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "Fira Code", "monospace"],
        arabic: ["'Al-Kanz'", "Arial", "sans-serif"],
        alkanz: ["'Al-Kanz'", "Arial", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        glow: "0 0 20px rgba(5, 150, 105, 0.15)",
        "glow-lg": "0 0 40px rgba(5, 150, 105, 0.2)",
        "glow-amber": "0 0 20px rgba(245, 158, 11, 0.15)",
        "glow-emerald": "0 0 20px rgba(16, 185, 129, 0.15)",
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
          "0%, 100%": { boxShadow: "0 0 5px rgba(5, 150, 105, 0.5)" },
          "50%": { boxShadow: "0 0 20px rgba(5, 150, 105, 0.8)" },
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
