"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Zap,
  SlidersHorizontal,
  RefreshCw,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  Wind,
  Clock,
  Compass,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getHijriFromDate } from "@/lib/fatimi-calendar";

interface ActiveWindowData {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  audience?: string;
  enabled?: boolean;
}

interface ExecutiveFatimiHeaderProps {
  activeWindow?: ActiveWindowData | null;
  onRefresh: () => void;
  refreshing: boolean;
}

interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
}

export function ExecutiveFatimiHeader({
  activeWindow,
  onRefresh,
  refreshing,
}: ExecutiveFatimiHeaderProps) {
  const [hijri, setHijri] = useState(() => getHijriFromDate(new Date()));
  const [weather, setWeather] = useState<WeatherData>({
    temp: 28,
    condition: "Clear Sky",
    humidity: 42,
    windSpeed: 8,
    isDay: true,
  });
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Update Hijri date daily & fetch Galiakot ambient weather
  useEffect(() => {
    setHijri(getHijriFromDate(new Date()));

    // Open-Meteo public telemetry for Galiakot Campus, Rajasthan (23.5367° N, 74.0089° E)
    async function fetchCampusWeather() {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=23.5367&longitude=74.0089&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=Asia%2FKolkata"
        );
        if (res.ok) {
          const json = await res.json();
          const curr = json.current;
          if (curr) {
            const code = curr.weather_code;
            let condition = "Clear Sky";
            if (code >= 1 && code <= 3) condition = "Partly Cloudy";
            else if (code >= 45 && code <= 48) condition = "Misty Fog";
            else if (code >= 51 && code <= 67) condition = "Light Rain";
            else if (code >= 80 && code <= 99) condition = "Precipitation";

            setWeather({
              temp: Math.round(curr.temperature_2m),
              condition,
              humidity: Math.round(curr.relative_humidity_2m),
              windSpeed: Math.round(curr.wind_speed_10m),
              isDay: Boolean(curr.is_day),
            });
          }
        }
      } catch {
        // Fallback default remains active
      } finally {
        setWeatherLoading(false);
      }
    }

    fetchCampusWeather();
  }, []);

  const handleOpenCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  };

  const gregorianStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <div className="p-1 sm:p-1.5 rounded-3xl bg-black/[0.04] ring-1 ring-black/[0.08] shadow-2xl">
        <div
          className="relative overflow-hidden rounded-[1.4rem] sm:rounded-[1.6rem] p-6 sm:p-8 text-white"
          style={{
            background: "linear-gradient(135deg, #080706 0%, #15110d 50%, #1f1811 100%)",
            boxShadow:
              "inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 20px 40px -15px rgba(0, 0, 0, 0.6)",
          }}
        >
          {/* Top glowing gold filigree hairline */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-90" />

          {/* Ambient gold background halos */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-yellow-500/5 blur-3xl pointer-events-none" />

          {/* Main Flex Container */}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Brand Medallion & Calligraphic Ribbon */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              {/* Sacred Gold Shield Emblem */}
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-xl shrink-0 border border-amber-300/40 relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, #fde047 0%, #d4af37 50%, #92400e 100%)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
                <Shield
                  className="w-8 h-8 sm:w-10 sm:h-10 text-stone-950 fill-stone-950/20 relative z-10 drop-shadow"
                  strokeWidth={1.85}
                />
              </div>

              {/* Title & Calligraphic Details */}
              <div className="space-y-1.5 min-w-0">
                {/* Fatimi Calligraphic Hijri Ribbon */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/35 backdrop-blur-md shadow-xs">
                    <span className="font-arabic font-alkanz text-amber-300 text-sm sm:text-base font-bold leading-none tracking-wide">
                      {hijri.formattedAr || "٢٤ ربيع الآخر ١٤٤٧ هـ"}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-amber-400/60" />
                    <span className="text-[11px] font-semibold text-amber-200/90 tracking-tight">
                      {hijri.formatted || "24 Rabi al-Akhar 1447 H"}
                    </span>
                  </div>

                  <span className="text-xs text-stone-300/80 font-medium">
                    {gregorianStr}
                  </span>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Admin Executive Command
                </h1>
                <p className="text-stone-300/90 text-xs sm:text-sm font-medium max-w-xl">
                  Mahad al-Zahra · Unified Biometric Telemetry &amp; Academic Governance
                </p>
              </div>
            </div>

            {/* Right: Weather Telemetry, Active Window & Executive Actions */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3.5">
              {/* Weather & Active Window Pill Badges */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Galiakot Campus Ambient Weather Pill */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md shadow-xs text-xs font-semibold text-stone-200">
                  {weather.condition.includes("Rain") ? (
                    <CloudRain className="w-3.5 h-3.5 text-blue-300" />
                  ) : weather.condition.includes("Cloud") ? (
                    <CloudSun className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                  )}
                  <span>
                    Galiakot: <strong className="text-white">{weather.temp}°C</strong>
                  </span>
                  <span className="text-stone-400 text-[10px]">({weather.condition})</span>
                </div>

                {/* Active Attendance Window Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/35 backdrop-blur-md shadow-xs text-xs font-semibold text-amber-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  {activeWindow ? (
                    <span>
                      Window:{" "}
                      <strong className="text-white font-bold">{activeWindow.name}</strong>{" "}
                      <span className="text-amber-300/80 font-mono text-[11px]">
                        ({activeWindow.startTime} – {activeWindow.endTime})
                      </span>
                    </span>
                  ) : (
                    <span>
                      Schedule: <strong className="text-white">Active Scanning</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Dock */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleOpenCommandPalette}
                  className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-stone-950 text-xs font-black transition-all shadow-md hover:shadow-amber-400/20 cursor-pointer active:scale-[0.98]"
                  title="Search or jump anywhere (⌘K / Ctrl+K)"
                >
                  <Zap className="w-3.5 h-3.5 text-stone-950 group-hover:scale-110 transition-transform" strokeWidth={2} />
                  <span>Command Menu</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-stone-950/15 text-[10px] font-mono font-bold text-stone-950 border border-stone-950/20">
                    ⌘K
                  </kbd>
                </button>

                <Link
                  href="/admin/settings"
                  className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl text-xs font-bold border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all shadow-xs backdrop-blur-xs active:scale-[0.98]"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" strokeWidth={2} />
                  <span>Portal Locks</span>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-xl text-xs font-bold h-9 px-3.5 transition-all shadow-xs backdrop-blur-xs active:scale-[0.98]"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin text-amber-300" : ""}`}
                    strokeWidth={2}
                  />
                  <span>Sync</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom subtle gold transition strip */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-80" />
        </div>
      </div>
    </motion.div>
  );
}
