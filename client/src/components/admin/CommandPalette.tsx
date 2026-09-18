"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Activity,
  BarChart3,
  Clock,
  Mail,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  Grid3X3,
  Users,
  GraduationCap,
  Heart,
  Layers,
  UserCheck,
  Fingerprint,
  Settings,
  Keyboard,
  ArrowRight,
  Sparkles,
  Command,
  X,
  ShieldCheck,
  ShoppingBag,
  Barcode,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavCommand {
  id: string;
  title: string;
  category: "Navigation" | "Attendance" | "Academics" | "People" | "Library" | "Actions";
  href: string;
  icon: React.ElementType;
  shortcut?: string;
  keywords?: string[];
}

const COMMANDS: NavCommand[] = [
  // ── Navigation Hubs ──
  {
    id: "dashboard",
    title: "Dashboard Overview",
    category: "Navigation",
    href: "/admin",
    icon: Activity,
    shortcut: "G D",
    keywords: ["home", "main", "stats", "executive", "kpi"],
  },
  {
    id: "security",
    title: "Security & Access Command Center",
    category: "Navigation",
    href: "/admin/security",
    icon: ShieldCheck,
    shortcut: "G K",
    keywords: ["security", "audit", "rbac", "sessions", "lock", "defense", "policies"],
  },
  {
    id: "tracking",
    title: "Individual Attendance Tracking",
    category: "Navigation",
    href: "/admin/tracking",
    icon: BarChart3,
    shortcut: "G X",
    keywords: ["track", "attendance", "student", "teacher", "individual", "performance", "rate"],
  },
  {
    id: "settings",
    title: "System Settings",
    category: "Navigation",
    href: "/admin/settings",
    icon: Settings,
    shortcut: "G S",
    keywords: ["profile", "account", "smtp", "config"],
  },

  // ── Attendance Hub ──
  {
    id: "biometric",
    title: "Attendance & Biometric Live Feed",
    category: "Attendance",
    href: "/admin/biometric",
    icon: Fingerprint,
    shortcut: "G A",
    keywords: ["fingerprint", "hikvision", "terminal", "scans", "live"],
  },
  {
    id: "attendance-schedule",
    title: "Attendance Schedule & Timing (All Students & Classes)",
    category: "Attendance",
    href: "/admin/attendance-schedule",
    icon: Clock,
    shortcut: "G T",
    keywords: ["schedule", "timing", "scan window", "grace period", "hours", "tilawat al dua", "excel"],
  },
  {
    id: "attendance-emails",
    title: "Attendance Email Reports (Weekly & Monthly)",
    category: "Attendance",
    href: "/admin/attendance-emails",
    icon: Mail,
    shortcut: "G E",
    keywords: ["send email", "weekly report", "monthly report", "parents", "pdf", "dispatch"],
  },
  {
    id: "procurement",
    title: "Procurement & Supplies Requisitions",
    category: "Attendance",
    href: "/admin/procurement",
    icon: ShoppingBag,
    shortcut: "G P",
    keywords: ["procurement", "supplies", "stationery", "office", "classroom", "requisition", "order", "fulfill", "items"],
  },

  // ── Academics Hub ──
  {
    id: "classes",
    title: "Classes & Students",
    category: "Academics",
    href: "/admin/classes",
    icon: BookOpen,
    shortcut: "G C",
    keywords: ["darajah", "section", "enrollment", "classrooms"],
  },
  {
    id: "timetable",
    title: "Master Timetable Matrix",
    category: "Academics",
    href: "/admin/timetable",
    icon: CalendarDays,
    keywords: ["periods", "weekly slots", "rooms", "schedule"],
  },
  {
    id: "takhteet",
    title: "Takhteet Curriculum Planner",
    category: "Academics",
    href: "/admin/takhteet",
    icon: ClipboardList,
    keywords: ["curriculum", "syllabus", "planning", "portion", "progress"],
  },
  {
    id: "hifz",
    title: "Quran & Hifz Management",
    category: "Academics",
    href: "/admin/hifz",
    icon: FileText,
    shortcut: "G H",
    keywords: ["quran", "ajza", "juz", "murajaat", "jadeed", "report card", "publish"],
  },
  {
    id: "hifz-marhala",
    title: "Hifz Marhala — Assignments, Weekly Slips & Reports",
    category: "Academics",
    href: "/admin/hifz-marhala",
    icon: GraduationCap,
    keywords: ["marhala", "stages", "muhaffiz", "musaid", "tag", "assign", "halaqah", "hifz", "weekly", "slips", "publish"],
  },

  // ── People Hub ──
  {
    id: "students",
    title: "Talabat (Student) Directory",
    category: "People",
    href: "/admin/students",
    icon: GraduationCap,
    shortcut: "G T",
    keywords: ["students", "talabat", "its", "roster", "blood group", "registration"],
  },
  {
    id: "parents",
    title: "Parents Directory & Student Links",
    category: "People",
    href: "/admin/parents",
    icon: Heart,
    shortcut: "G P",
    keywords: ["guardian", "father", "mother", "family", "contact"],
  },
  {
    id: "users",
    title: "All Users & System Accounts",
    category: "People",
    href: "/admin/users",
    icon: Users,
    shortcut: "G U",
    keywords: ["accounts", "staff", "admin", "roles", "credentials", "directory"],
  },
  {
    id: "passwords",
    title: "User Passwords & Credential Vault",
    category: "People",
    href: "/admin/passwords",
    icon: KeyRound,
    shortcut: "G W",
    keywords: ["passwords", "credentials", "login", "reset", "vault", "keys", "export"],
  },
  {
    id: "portal-assignments",
    title: "Teacher Portal Access & Permissions",
    category: "People",
    href: "/admin/portal-assignments",
    icon: UserCheck,
    keywords: ["faculty", "permissions", "teacher roles", "access control"],
  },

  // ── Library Hub ──
  {
    id: "makhzan",
    title: "Makhzan Warehouse & Barcode Hub",
    category: "Library",
    href: "/admin/makhzn",
    icon: Barcode,
    shortcut: "G M",
    keywords: ["makhzan", "warehouse", "barcode", "scanner", "issue", "inventory", "stock", "talabat", "faculty"],
  },
  {
    id: "library",
    title: "Library Catalog & Circulation",
    category: "Library",
    href: "/admin/library",
    icon: BookOpen,
    shortcut: "G L",
    keywords: ["books", "isbn", "borrow", "return", "circulation", "checkout"],
  },
  {
    id: "library-shelves",
    title: "Library Shelves & Location Colors",
    category: "Library",
    href: "/admin/library/shelves",
    icon: Layers,
    keywords: ["racks", "shelves", "colors", "physical location"],
  },

  // ── Gamification ──
  {
    id: "point-matrix",
    title: "Point Matrix & Conduct Rules",
    category: "Navigation",
    href: "/admin/point-matrix",
    icon: Grid3X3,
    shortcut: "G M",
    keywords: ["points", "rewards", "conduct", "badges", "tiers", "matrix"],
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Pending two-key sequence (e.g. 'g' then 'd')
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const keyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Global Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;

      // 1. Trigger Command Palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // 2. Open with '/' when not typing
      if (!isInput && e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // 3. Open Cheat Sheet with '?'
      if (!isInput && e.key === "?" && !open) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // 4. Escape closes palette/modal
      if (e.key === "Escape") {
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        }
        return;
      }

      // Ignore standard key navigation if inside input or if palette is open
      if (isInput || open || showShortcutsModal) return;

      // 5. Sequential Hotkeys (G then key)
      if (e.key.toLowerCase() === "g" && !pendingKey) {
        setPendingKey("g");
        if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);
        keyTimeoutRef.current = setTimeout(() => setPendingKey(null), 1000);
        return;
      }

      if (pendingKey === "g") {
        setPendingKey(null);
        if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);

        const key = e.key.toLowerCase();
        const keyMap: Record<string, string> = {
          d: "/admin", // Dashboard
          a: "/admin/biometric", // Attendance Hub
          t: "/admin/attendance-schedule", // Timing / Schedule
          e: "/admin/attendance-emails", // Attendance Emails
          c: "/admin/classes", // Classes
          h: "/admin/hifz", // Hifz
          s: "/admin/students", // Students
          u: "/admin/users", // Users
          p: "/admin/parents", // Parents
          l: "/admin/library", // Library
          m: "/admin/point-matrix", // Matrix
          x: "/admin/tracking", // Individual Tracking
        };

        if (keyMap[key]) {
          e.preventDefault();
          router.push(keyMap[key]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, showShortcutsModal, pendingKey, router]);

  // Focus search input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [open]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((cmd) => {
      const matchTitle = cmd.title.toLowerCase().includes(q);
      const matchCategory = cmd.category.toLowerCase().includes(q);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchCategory || matchKeywords;
    });
  }, [query]);

  // Navigate filtered commands with Arrow keys
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        setOpen(false);
        router.push(selected.href);
      }
    }
  };

  const handleSelectCommand = (cmd: NavCommand) => {
    setOpen(false);
    router.push(cmd.href);
  };

  return (
    <>
      {/* ── Key Sequence Notification Badge (When 'G' is pressed) ── */}
      <AnimatePresence>
        {pendingKey === "g" && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#093b2a] text-white rounded-full shadow-2xl border border-[#d4af37] flex items-center gap-2 text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#fde047]" />
            <span>
              Press key: <strong>D</strong> (Dashboard), <strong>A</strong> (Attendance), <strong>C</strong> (Classes), <strong>H</strong> (Hifz), <strong>U</strong> (Users)...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Command Palette Modal ── */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[75vh]"
            >
              {/* Search Bar Header */}
              <div className="flex items-center px-4 py-3.5 border-b border-gray-200 bg-gray-50/70">
                <Search className="w-5 h-5 text-emerald-700 mr-3 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Type a command, page, or search (e.g. attendance, classes, hifz)..."
                  className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none font-medium"
                />
                <kbd className="hidden sm:inline-block px-2 py-1 rounded bg-white border border-gray-200 text-[10px] font-mono text-gray-500 shadow-2xs">
                  ESC to close
                </kbd>
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto p-2 divide-y divide-gray-50">
                {filteredCommands.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <Search className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                    <p className="text-sm font-medium">No results found for “{query}”</p>
                  </div>
                ) : (
                  filteredCommands.map((cmd, idx) => {
                    const isSelected = idx === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onClick={() => handleSelectCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                          isSelected
                            ? "bg-emerald-50 text-emerald-950 shadow-2xs"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-emerald-700 text-white"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate leading-tight">{cmd.title}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{cmd.category}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {cmd.shortcut && (
                            <kbd className="px-2 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-mono font-bold text-gray-600 shadow-2xs">
                              {cmd.shortcut}
                            </kbd>
                          )}
                          <ArrowRight
                            className={`w-4 h-4 transition-transform ${
                              isSelected ? "text-emerald-700 translate-x-0.5" : "text-gray-300 opacity-0"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Bottom Quick Help Bar */}
              <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px]">
                      ↑
                    </kbd>{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px]">
                      ↓
                    </kbd>{" "}
                    to navigate
                  </span>
                  <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px]">
                      ↵
                    </kbd>{" "}
                    to open
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowShortcutsModal(true);
                  }}
                  className="text-emerald-700 hover:underline font-bold flex items-center gap-1"
                >
                  <Keyboard className="w-3.5 h-3.5" /> Shortcuts Sheet (?)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Shortcuts Cheat Sheet Modal ── */}
      <AnimatePresence>
        {showShortcutsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-gray-200"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-emerald-700" />
                  Admin Navigation Keyboard Shortcuts
                </h3>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="text-gray-500 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-2 text-emerald-800">
                    Global Shortcuts
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between">
                      <span>Command Search</span>
                      <kbd className="px-2 py-0.5 rounded bg-white border font-mono font-bold">⌘K or /</kbd>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between">
                      <span>Shortcuts Help</span>
                      <kbd className="px-2 py-0.5 rounded bg-white border font-mono font-bold">?</kbd>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between">
                      <span>Cycle Sub-Tabs</span>
                      <kbd className="px-2 py-0.5 rounded bg-white border font-mono font-bold">[ and ]</kbd>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between">
                      <span>Close Modals</span>
                      <kbd className="px-2 py-0.5 rounded bg-white border font-mono font-bold">ESC</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-2 text-emerald-800">
                    Quick Jump Sequences (Press 'G' then key)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 font-medium">
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Dashboard</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G D</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Attendance Center</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G A</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Attendance Timing</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G T</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Attendance Emails</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G E</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Classes</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G C</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Quran &amp; Hifz</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G H</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Talabat (Students)</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G S</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Users Directory</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G U</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Parents</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G P</kbd>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span>Library Catalog</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white border font-mono font-bold">G L</kbd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={() => setShowShortcutsModal(false)}>
                  Got it
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
