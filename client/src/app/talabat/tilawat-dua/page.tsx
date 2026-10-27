"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Tv,
  Sparkles,
  Download,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TilawatDuaViewer, type TilawatDuaItem } from "@/components/tilawat-dua/TilawatDuaViewer";

export default function TalabatTilawatDuaPage() {
  const [currentDua, setCurrentDua] = useState<TilawatDuaItem | null>(null);
  const [archiveList, setArchiveList] = useState<TilawatDuaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectorMode, setProjectorMode] = useState(false);

  // Load today's Tilawat Dua & archive
  const fetchDua = async () => {
    try {
      setLoading(true);
      // 1. Fetch today's primary Tilawat Dua
      const resToday = await fetch("/api/tilawat-dua/today");
      const jsonToday = await resToday.json();
      if (jsonToday.success && jsonToday.data) {
        setCurrentDua(jsonToday.data);
      }

      // 2. Fetch recent archive
      const resArchive = await fetch("/api/tilawat-dua?limit=10");
      const jsonArchive = await resArchive.json();
      if (jsonArchive.success && Array.isArray(jsonArchive.data)) {
        setArchiveList(jsonArchive.data);
        if (!jsonToday.data && jsonArchive.data.length > 0) {
          setCurrentDua(jsonArchive.data[0]);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDua();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/60 p-6 sm:p-8 text-white border border-slate-700/60 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold tracking-wider uppercase border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Daily Spiritual Recitation
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Daily Tilawat Dua</h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Recite today's assigned Tilawat Dua, or project it directly onto your classroom smart board or projector screen.
            </p>
          </div>

          {currentDua && (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setProjectorMode(true)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/40 active:scale-95 transition"
              >
                <Tv className="w-4 h-4 mr-2" />
                Display on Projector
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Viewer Card ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          <p className="text-sm font-medium">Opening today's Tilawat Dua…</p>
        </div>
      ) : !currentDua ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Tilawat Dua Published Yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            Today's Tilawat Dua will appear here as soon as it is published by administration.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Viewer Container */}
          <TilawatDuaViewer
            dua={currentDua}
            initialProjectorMode={projectorMode}
            onCloseProjector={() => setProjectorMode(false)}
          />

          {/* Archive / Date Selector Carousel if multiple Duas exist */}
          {archiveList.length > 1 && (
            <Card className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  Recent Tilawat Duas
                </h3>
                <span className="text-xs text-slate-400">Click any date to switch</span>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {archiveList.map((dua) => {
                  const isSelected = dua.id === currentDua.id;
                  const dateStr = new Date(dua.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <button
                      key={dua.id}
                      type="button"
                      onClick={() => setCurrentDua(dua)}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-200 shrink-0 min-w-[180px] ${
                        isSelected
                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-950 dark:text-amber-200 shadow-sm ring-1 ring-amber-400"
                          : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-xs font-bold truncate">{dua.title}</span>
                      <span className="text-[11px] text-slate-500 mt-1">{dateStr}</span>
                      {dua.isDailyDefault && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                          ★ Today's Default
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Fullscreen Projector Component */}
      {projectorMode && currentDua && (
        <TilawatDuaViewer
          dua={currentDua}
          initialProjectorMode={true}
          onCloseProjector={() => setProjectorMode(false)}
        />
      )}
    </div>
  );
}
