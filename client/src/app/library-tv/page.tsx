"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Library, Loader2, Layers, RefreshCw } from "lucide-react";

interface TvShelf {
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  totalBooks: number;
  availableBooks: number;
  borrowedBooks: number;
  label: string;
  categories: { name: string; count: number }[];
  books: { title: string; author: string | null; coverImage: string | null; status: string; barcode: string | null }[];
}

interface TvData {
  shelves: TvShelf[];
  stats: { totalShelves: number; totalBooks: number; totalAvailable: number; unassignedBooks: number };
}

const COLOR_HEX: Record<string, string> = {
  Red: "#ef4444",
  Blue: "#3b82f6",
  Green: "#22c55e",
  Yellow: "#eab308",
  Orange: "#f97316",
  Purple: "#a855f7",
  Pink: "#ec4899",
  "Light Blue": "#38bdf8",
  White: "#e2e8f0",
};

const ROTATE_MS = 12000;
const REFRESH_MS = 60000;

function clock(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function dateLine(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function LibraryTvPage() {
  const [data, setData] = useState<TvData | null>(null);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/public/library-tv");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-rotate between racks
  const racks = useMemo(() => {
    const map = new Map<string, TvShelf[]>();
    for (const s of data?.shelves ?? []) {
      const rack = s.rackNumber || "Unlabeled";
      if (!map.has(rack)) map.set(rack, []);
      map.get(rack)!.push(s);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, shelves]) => ({
        label,
        shelves: shelves.sort((a, b) => (a.shelfNumber ?? "").localeCompare(b.shelfNumber ?? "")),
      }));
  }, [data]);

  useEffect(() => {
    if (racks.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % racks.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [racks.length]);

  const rack = racks[Math.min(index, Math.max(0, racks.length - 1))];
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-[#0b1d17] text-white overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }} />
        <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #d4af37 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 flex flex-col h-screen p-6 lg:p-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
              <Library className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "inherit" }}>
                Darse Burhani <span className="text-[#d4af37]">Library</span>
              </h1>
              <p className="text-sm text-emerald-100/90">{dateLine()}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-5xl font-bold tabular-nums text-emerald-100">{clock()}</div>
              <div className="text-xs text-emerald-100/90 mt-1 flex items-center justify-end gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" /> Live
              </div>
            </div>
          </div>
        </header>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Shelving Units", value: stats.totalShelves, color: "text-teal-300", border: "border-teal-400/20" },
              { label: "Total Books", value: stats.totalBooks, color: "text-emerald-300", border: "border-emerald-400/20" },
              { label: "Available Now", value: stats.totalAvailable, color: "text-lime-300", border: "border-lime-400/20" },
              { label: "Unassigned", value: stats.unassignedBooks, color: "text-amber-300", border: "border-amber-400/20" },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl border ${s.border} bg-white/5 backdrop-blur px-5 py-3 flex items-center justify-between`}>
                <span className="text-sm text-emerald-100/70">{s.label}</span>
                <span className={`text-4xl font-bold tabular-nums ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Rack display */}
        <div className="flex-1 min-h-0 flex flex-col">
          {data === null ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-400" />
            </div>
          ) : error || racks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-emerald-100/50">
              <Layers className="w-16 h-16" />
              <p className="text-xl">No shelves configured yet</p>
              <p className="text-sm text-emerald-100/40">Assign rack/shelf numbers to books to display them here</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-emerald-300" />
                  </div>
                  <h2 className="text-2xl font-bold uppercase tracking-wider">
                    {rack?.label}
                    <span className="ml-3 text-sm font-normal text-emerald-100/50 normal-case">
                      {rack?.shelves.length} shelf{rack?.shelves.length !== 1 ? "ves" : ""} · {rack?.shelves.reduce((a, s) => a + s.totalBooks, 0)} books
                    </span>
                  </h2>
                </div>
                {/* Progress dots */}
                <div className="flex items-center gap-2">
                  {racks.map((r, i) => (
                    <button
                      key={r.label}
                      onClick={() => setIndex(i)}
                      className={`h-2.5 rounded-full transition-all duration-500 ${i === index ? "w-8 bg-[#d4af37]" : "w-2.5 bg-white/20 hover:bg-white/40"}`}
                      aria-label={`Show rack ${r.label}`}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={rack?.label}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="grid grid-cols-2 xl:grid-cols-3 gap-4 flex-1 min-h-0"
                >
                  {rack?.shelves.map((shelf) => {
                    const hex = COLOR_HEX[shelf.locationColor ?? ""] ?? "#10b981";
                    const pct = shelf.totalBooks > 0 ? (shelf.availableBooks / shelf.totalBooks) * 100 : 0;
                    const covers = shelf.books.slice(0, 6);
                    return (
                      <div
                        key={shelf.label}
                        className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 flex flex-col overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-sm" style={{ background: hex }} />
                            <span className="font-mono font-bold text-lg">{shelf.label}</span>
                          </div>
                          <span className={`text-sm font-bold ${pct > 50 ? "text-lime-300" : pct > 0 ? "text-amber-300" : "text-rose-300"}`}>
                            {shelf.availableBooks} / {shelf.totalBooks}
                          </span>
                        </div>

                        {/* Availability bar */}
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: pct > 50 ? "#22c55e" : pct > 0 ? "#f59e0b" : "#f43f5e" }} />
                        </div>

                        {/* Categories */}
                        <div className="flex flex-wrap gap-1.5 mb-3 min-h-[22px]">
                          {shelf.categories.slice(0, 3).map((c) => (
                            <span key={c.name} className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-100/80">
                              {c.name} · {c.count}
                            </span>
                          ))}
                        </div>

                        {/* Book covers */}
                        <div className="flex-1 flex items-end gap-2 min-h-0">
                          {covers.length === 0 ? (
                            <span className="text-sm text-emerald-100/40">No books</span>
                          ) : (
                            covers.map((b, i) => (
                              <div key={`${b.title}-${i}`} className="flex-1 min-w-0 group">
                                <div
                                  className="rounded-md overflow-hidden border border-white/10 aspect-[3/4.4] bg-gradient-to-br from-emerald-800/60 to-teal-900/60 flex items-end"
                                  title={b.title}
                                >
                                  {b.coverImage ? (
                                    <img src={b.coverImage} alt={`Book cover of ${b.title}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                  ) : (
                                    <div className="w-full p-1">
                                      <div className="text-[9px] leading-tight font-medium text-emerald-100 line-clamp-3">{b.title}</div>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-1.5 text-[10px] text-emerald-100/60 truncate">{b.title}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="pt-4 mt-4 flex items-center justify-between border-t border-white/10">
          <div className="flex items-center gap-2 text-sm text-emerald-100/50">
            <BookOpen className="w-4 h-4" />
            Darse Burhani Library · Welcome — please ask the librarian for help
          </div>
          <div className="text-sm text-emerald-100/40">Auto-refreshes every minute</div>
        </footer>
      </div>
    </div>
  );
}
