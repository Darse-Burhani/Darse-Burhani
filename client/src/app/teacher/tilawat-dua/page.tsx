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
  Plus,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  Layers,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TilawatDuaViewer, type TilawatDuaItem } from "@/components/tilawat-dua/TilawatDuaViewer";
import { usePortalAccess } from "@/context/PortalAccessContext";
import Link from "next/link";

export default function TeacherTilawatDuaPage() {
  const { isPageAssigned } = usePortalAccess();
  const canManage = isPageAssigned("tilawat-dua");

  const [currentDua, setCurrentDua] = useState<TilawatDuaItem | null>(null);
  const [archiveList, setArchiveList] = useState<TilawatDuaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projectorMode, setProjectorMode] = useState(false);

  const fetchDua = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      const timestamp = Date.now();
      const resToday = await fetch(`/api/tilawat-dua/today?_t=${timestamp}`);
      const jsonToday = await resToday.json();
      if (jsonToday.success && jsonToday.data) {
        setCurrentDua(jsonToday.data);
      }

      const resArchive = await fetch(`/api/tilawat-dua?limit=15&_t=${timestamp}`);
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDua();
    // Re-check every 30s so new uploads instantly appear
    const interval = setInterval(() => fetchDua(true), 30000);
    const handleFocus = () => fetchDua(true);
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Academics Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Academics & Teaching"
        hubDescription="Assigned classes, weekly timetable, curriculum takhteet, and daily Tilawat Dua."
        tabs={[
          { label: "Classes & Darajahs", href: "/admin/classes", icon: BookOpen },
          { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
          { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
          { label: "Tilawat Dua", href: "/admin/tilawat-dua", icon: Sparkles, badge: "Daily" },
        ]}
      />

      {/* ── Top Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/60 p-6 sm:p-8 text-white border border-slate-700/60 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold tracking-wider uppercase border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Faculty & Classroom Presentation
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Faculty Tilawat Dua</h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Lead daily morning recitations. Present today's Tilawat Dua in crystal clear quality on your classroom projector or smart display.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDua(false)}
              disabled={loading || refreshing}
              className="bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700 text-xs px-3.5 py-2 rounded-xl"
              title="Check for newly uploaded PDF"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing || loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {canManage && (
              <Link href="/admin/tilawat-dua">
                <Button className="bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl border border-slate-700">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                  Manage & Upload
                </Button>
              </Link>
            )}

            {currentDua && (
              <Button
                onClick={() => setProjectorMode(true)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/40 active:scale-95 transition"
              >
                <Tv className="w-4 h-4 mr-2" />
                Launch Projector View
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Viewer Card ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          <p className="text-sm font-medium">Opening Tilawat Dua for display…</p>
        </div>
      ) : !currentDua ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Tilawat Dua Available</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
            No Tilawat Dua has been assigned for today yet.
          </p>
          {canManage && (
            <Link href="/admin/tilawat-dua">
              <Button className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Upload Daily Dua
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Viewer */}
          <TilawatDuaViewer
            dua={currentDua}
            initialProjectorMode={projectorMode}
            onCloseProjector={() => setProjectorMode(false)}
          />

          {/* Archive / Date Selector Carousel */}
          {archiveList.length > 1 && (
            <Card className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  Tilawat Dua Archive
                </h3>
                <span className="text-xs text-slate-400">Select any date to project</span>
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
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-200 shrink-0 min-w-[200px] ${
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

      {/* Standalone Fullscreen Projector Component */}
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
