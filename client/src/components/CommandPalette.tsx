"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Command,
  Clock,
  Fingerprint,
  BookOpen,
  GraduationCap,
  Users,
  ShieldAlert,
  Download,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Calendar,
  FileSpreadsheet,
  Moon,
  Zap,
  X,
  PlusCircle,
} from "lucide-react";
import { prefetchRouteChunk } from "@/lib/prefetch";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Actions" | "Navigation" | "Portals" | "Tools";
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  keywords?: string[];
  badge?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { data: session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const role = (session?.user as any)?.role || "STUDENT";

  // Global keydown handler for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Command registry
  const allCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Quick Actions
      {
        id: "act-attendance-logs",
        title: "Live Attendance Scans & Logs",
        subtitle: "View real-time student and faculty scan roster",
        category: "Actions",
        icon: Activity,
        href: "/admin/attendance-logs",
        keywords: ["attendance", "scans", "live", "biometric", "roster"],
        badge: "Live",
      },
      {
        id: "act-manual-attendance",
        title: "Record Manual Attendance",
        subtitle: "Mark attendance override for student or faculty",
        category: "Actions",
        icon: PlusCircle,
        href: "/admin/attendance-logs",
        keywords: ["manual", "mark", "override", "absent", "present"],
      },
      {
        id: "act-biometric-terminals",
        title: "Hikvision Biometric Terminals",
        subtitle: "Check live cloud status and restart terminal listener",
        category: "Actions",
        icon: Fingerprint,
        href: "/admin/biometric",
        keywords: ["hikvision", "terminal", "devices", "lan", "stream"],
      },
      {
        id: "act-hifz-marhala",
        title: "Hifz Marhala Progression Matrix",
        subtitle: "Track Quran memorization milestones and stages",
        category: "Actions",
        icon: BookOpen,
        href: "/admin/hifz-marhala",
        keywords: ["hifz", "quran", "marhala", "juz", "memorization"],
      },
      {
        id: "act-library-catalog",
        title: "Library Catalog & 3D Shelves",
        subtitle: "Scan barcodes, issue books, and manage inventory",
        category: "Tools",
        icon: BookOpen,
        href: "/admin/library",
        keywords: ["books", "library", "shelves", "makhzn", "isbn"],
      },
      {
        id: "act-library-tv",
        title: "Library Wall TV Display",
        subtitle: "Fullscreen dynamic signage for library hall",
        category: "Tools",
        icon: ExternalLink,
        href: "/library/tv",
        keywords: ["tv", "signage", "display", "fullscreen"],
      },
      {
        id: "act-fatimi-calendar",
        title: "Fatimi Hijri Calendar",
        subtitle: "Misri calendar dates, miqaats, and academic schedule",
        category: "Tools",
        icon: Calendar,
        href: "/fatimi-calendar",
        keywords: ["calendar", "hijri", "fatimi", "miqaat", "date"],
      },

      // Navigation
      {
        id: "nav-classes",
        title: "Classes & Divisions",
        subtitle: "Manage grade sections and student enrollments",
        category: "Navigation",
        icon: GraduationCap,
        href: "/admin/classes",
        keywords: ["classes", "grades", "sections", "talabat"],
      },
      {
        id: "nav-timetable",
        title: "Master Academic Timetable",
        subtitle: "Period schedules, room allotments, and faculty slots",
        category: "Navigation",
        icon: Clock,
        href: "/admin/timetable",
        keywords: ["timetable", "periods", "schedule", "routine"],
      },
      {
        id: "nav-users",
        title: "User Accounts & Credentials",
        subtitle: "Admin, teacher, student, and parent profile administration",
        category: "Navigation",
        icon: Users,
        href: "/admin/users",
        keywords: ["users", "passwords", "accounts", "its", "credentials"],
      },
      {
        id: "nav-leave-mgmt",
        title: "Leave & Medical Approvals",
        subtitle: "Review pending student and faculty leave requests",
        category: "Navigation",
        icon: ShieldAlert,
        href: "/admin/leave",
        keywords: ["leave", "medical", "absent", "permission", "sick"],
      },

      // Portals
      {
        id: "portal-admin",
        title: "Admin Executive Console",
        subtitle: "Full operational overview and institutional control",
        category: "Portals",
        icon: Zap,
        href: "/admin",
        keywords: ["admin", "portal", "dashboard"],
      },
      {
        id: "portal-teacher",
        title: "Teacher & Faculty Portal",
        subtitle: "Daily class takhteet, attendance, and hifz logs",
        category: "Portals",
        icon: GraduationCap,
        href: "/teacher",
        keywords: ["teacher", "faculty", "ustad"],
      },
      {
        id: "portal-talabat",
        title: "Talabat (Student) Space",
        subtitle: "Personal attendance, achievements, and library books",
        category: "Portals",
        icon: Users,
        href: "/talabat",
        keywords: ["talabat", "student", "my space"],
      },
      {
        id: "portal-parent",
        title: "Parent Portal",
        subtitle: "Track child attendance, reports, and notices",
        category: "Portals",
        icon: Sparkles,
        href: "/parent",
        keywords: ["parent", "family", "child"],
      },
    ];

    return items;
  }, [role]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const clean = query.toLowerCase().trim();
    return allCommands.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(clean);
      const matchSubtitle = item.subtitle?.toLowerCase().includes(clean);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(clean));
      return matchTitle || matchSubtitle || matchKeywords;
    });
  }, [allCommands, query]);

  // Handle execution
  const executeCommand = (cmd: CommandItem) => {
    setOpen(false);
    if (cmd.action) {
      cmd.action();
    } else if (cmd.href) {
      prefetchRouteChunk(cmd.href);
      navigate(cmd.href);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      executeCommand(filteredCommands[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-24 px-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
          onClick={() => setOpen(false)}
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-slate-950/95 border border-emerald-500/30 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden text-white backdrop-blur-2xl"
        >
          {/* Top Gold Hairline Glow */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-90 pointer-events-none" />

          {/* Search Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
            <Search className="w-5 h-5 text-amber-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search tools, portals, live attendance, hifz marhala, library..."
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-gray-500 outline-none font-medium"
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300 border border-white/10">
                ESC
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Command List */}
          <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-white/5 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
            {filteredCommands.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Search className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold">No commands found for "{query}"</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Try searching for attendance, hifz, classes, or library</p>
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => {
                      setSelectedIndex(idx);
                      if (cmd.href) prefetchRouteChunk(cmd.href);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-r from-emerald-950/90 via-teal-900/60 to-emerald-950/40 border border-emerald-500/40 text-white shadow-lg"
                        : "hover:bg-white/5 text-gray-300 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/30"
                            : "bg-white/10 text-amber-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold truncate text-white">{cmd.title}</p>
                          {cmd.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {cmd.badge}
                            </span>
                          )}
                        </div>
                        {cmd.subtitle && (
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{cmd.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">
                        {cmd.category}
                      </span>
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isSelected ? "text-amber-400 translate-x-0.5" : "text-gray-600"
                        }`}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with Shortcuts and Fast Telemetry */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-black/40 border-t border-white/10 text-[11px] text-gray-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-gray-300">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-gray-300">↵</kbd> Select
              </span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Darse Burhani Fast Engine</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
