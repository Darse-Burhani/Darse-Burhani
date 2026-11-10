"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSession, signOut } from "next-auth/react";
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
  Zap,
  X,
  ClipboardCheck,
  MessageSquare,
  Cake,
  Heart,
  KeyRound,
  UserCheck,
  Barcode,
  Grid3X3,
  SlidersHorizontal,
  Palette,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  CalendarCheck,
  Award,
  Bell,
  Mail,
  LogOut,
  User,
} from "lucide-react";
import { prefetchRouteChunk } from "@/lib/prefetch";
import { usePWA, isPWAStandalone } from "@/lib/pwa";
import { useFatimiTheme } from "@/context/FatimiThemeContext";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Actions" | "Operations" | "Academics" | "Attendance" | "People" | "Tools" | "Account";
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  keywords?: string[];
  badge?: string;
  shortcut?: string;
  roleFilter?: ("ADMIN" | "TEACHER" | "STUDENT" | "PARENT")[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { canInstall, installPWA } = usePWA();
  const { setTheme, availableThemes, currentThemeId } = useFatimiTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const role = (session?.user as any)?.role || "STUDENT";
  const isStandalone = useMemo(() => isPWAStandalone(), []);

  // Global keydown handler for Cmd+K / Ctrl+K and single-letter navigation
  useEffect(() => {
    let pendingKey: string | null = null;
    let pendingTimer: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      // Quick two-key jumps (e.g. 'g' then 'd') when NOT focused on an input
      if (!isInput && !open && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "g") {
          pendingKey = "g";
          clearTimeout(pendingTimer);
          pendingTimer = setTimeout(() => {
            pendingKey = null;
          }, 1200);
          return;
        }

        if (pendingKey === "g") {
          pendingKey = null;
          clearTimeout(pendingTimer);
          if (k === "d") {
            const home = role === "STUDENT" ? "/talabat" : `/${role.toLowerCase()}`;
            navigate(home);
          } else if (k === "t") {
            if (role === "ADMIN") navigate("/admin/timetable");
            else if (role === "TEACHER") navigate("/teacher/timetable");
            else if (role === "PARENT") navigate("/parent/timetable");
            else navigate("/talabat/timetable");
          } else if (k === "a") {
            if (role === "ADMIN") navigate("/admin/attendance-hik");
            else if (role === "TEACHER") navigate("/teacher/attendance");
            else if (role === "PARENT") navigate("/parent/tracking");
            else navigate("/talabat/attendance");
          } else if (k === "c") {
            navigate("/fatimi-calendar");
          } else if (k === "l") {
            if (role === "ADMIN") navigate("/admin/leave");
            else if (role === "TEACHER") navigate("/teacher/leave");
            else if (role === "PARENT") navigate("/parent/leave");
            else navigate("/talabat/leave-request");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(pendingTimer);
    };
  }, [open, role, navigate]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setSelectedCategory("ALL");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Centralized command registry
  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // ────────────────────────────
    // 1. ADMIN COMMANDS
    // ────────────────────────────
    if (role === "ADMIN") {
      list.push(
        {
          id: "adm-dashboard",
          title: "Executive Dashboard",
          subtitle: "Institutional overview, enrollment KPIs, and live status",
          category: "Operations",
          icon: Activity,
          href: "/admin",
          shortcut: "G D",
          keywords: ["home", "stats", "executive", "kpi"],
        },
        {
          id: "adm-attendance-hik",
          title: "Hikvision Attendance & Hardware Scans",
          subtitle: "Live biometric scans stream and device check-in events",
          category: "Attendance",
          icon: Fingerprint,
          href: "/admin/attendance-hik",
          badge: "Live",
          shortcut: "G A",
          keywords: ["hikvision", "attendance", "scans", "terminal", "logs"],
        },
        {
          id: "adm-manual-attendance",
          title: "Manual Attendance Station",
          subtitle: "One-click classroom roll-call and manual overrides roster",
          category: "Attendance",
          icon: ClipboardCheck,
          href: "/admin/manual-attendance",
          badge: "Roster",
          keywords: ["manual", "override", "absent", "present", "mark", "tablet"],
        },
        {
          id: "adm-biometric",
          title: "Biometric Hardware Terminals Hub",
          subtitle: "Device IPs, LAN ping, synchronization, and telemetry",
          category: "Attendance",
          icon: Fingerprint,
          href: "/admin/biometric",
          badge: "Hardware",
          keywords: ["terminal", "device", "ip", "lan", "hardware", "biometric"],
        },
        {
          id: "adm-maktabat-attendance",
          title: "Maktabat Library Attendance Desk",
          subtitle: "Rapid barcode scanning and library session attendance",
          category: "Attendance",
          icon: UserCheck,
          href: "/admin/library/attendance",
          keywords: ["library", "maktabat", "reading", "study hall"],
        },
        {
          id: "adm-google-sheets",
          title: "Google Sheets Cloud Sync",
          subtitle: "Daily & monthly attendance registry synced with Drive",
          category: "Attendance",
          icon: FileSpreadsheet,
          href: "/admin/google-sheets",
          badge: "Cloud",
          keywords: ["google", "sheets", "sync", "export", "drive", "excel"],
        },
        {
          id: "adm-leave",
          title: "Leave & Medical Approvals",
          subtitle: "Review pending student and faculty leave requests",
          category: "Attendance",
          icon: CalendarCheck,
          href: "/admin/leave",
          shortcut: "G L",
          keywords: ["leave", "medical", "approvals", "sick", "absence"],
        },
        {
          id: "adm-attendance-schedule",
          title: "Attendance Timing & Scan Windows",
          subtitle: "Define morning, period, and evening grace periods",
          category: "Attendance",
          icon: Clock,
          href: "/admin/attendance-schedule",
          keywords: ["schedule", "timing", "hours", "grace"],
        },
        {
          id: "adm-tracking",
          title: "Individual Attendance Telemetry",
          subtitle: "Per-student deep dive, heatmap, and attendance percent",
          category: "Attendance",
          icon: Layers,
          href: "/admin/tracking",
          keywords: ["tracking", "telemetry", "heatmap", "individual", "stats"],
        },
        {
          id: "adm-classes",
          title: "Classes & Divisions",
          subtitle: "Manage grade sections and student enrollments",
          category: "Academics",
          icon: BookOpen,
          href: "/admin/classes",
          keywords: ["classes", "grades", "sections", "enrollment"],
        },
        {
          id: "adm-timetable",
          title: "Master Academic Timetable",
          subtitle: "Weekly periods, room allotments, and faculty badal slots",
          category: "Academics",
          icon: Calendar,
          href: "/admin/timetable",
          shortcut: "G T",
          keywords: ["timetable", "periods", "slots", "rooms", "badal"],
        },
        {
          id: "adm-takhteet",
          title: "Takhteet Curriculum Planner",
          subtitle: "Syllabus tracking, portion progress, and class takhteet",
          category: "Academics",
          icon: Layers,
          href: "/admin/takhteet",
          keywords: ["takhteet", "curriculum", "syllabus", "planning"],
        },
        {
          id: "adm-students",
          title: "Talabat (Student) Directory",
          subtitle: "All enrolled students, ITS numbers, and profile files",
          category: "People",
          icon: GraduationCap,
          href: "/admin/students",
          keywords: ["talabat", "students", "its", "roster", "directory"],
        },
        {
          id: "adm-waras",
          title: "Waras Mubarak (Salgirah) Hub",
          subtitle: "Birthday greetings, milad milestones, and notification cards",
          category: "People",
          icon: Cake,
          href: "/admin/waras-mubarak",
          keywords: ["waras", "salgirah", "birthday", "greetings"],
        },
        {
          id: "adm-parents",
          title: "Parents Directory & Student Links",
          subtitle: "Parent user accounts, phone contacts, and student relations",
          category: "People",
          icon: Heart,
          href: "/admin/parents",
          keywords: ["parents", "father", "mother", "guardian"],
        },
        {
          id: "adm-users",
          title: "User Accounts & Administration",
          subtitle: "Admin, teacher, and student account permissions",
          category: "People",
          icon: Users,
          href: "/admin/users",
          keywords: ["users", "accounts", "roles", "directory"],
        },
        {
          id: "adm-passwords",
          title: "User Passwords & Credential Vault",
          subtitle: "Institutional password resets and credential audits",
          category: "People",
          icon: KeyRound,
          href: "/admin/passwords",
          keywords: ["passwords", "reset", "vault", "credentials"],
        },
        {
          id: "adm-portal-assign",
          title: "Teacher Portal Access & Permissions",
          subtitle: "Assign specific modules and classes to faculty members",
          category: "People",
          icon: UserCheck,
          href: "/admin/portal-assignments",
          keywords: ["permissions", "portal access", "assignments"],
        },
        {
          id: "adm-makhzn",
          title: "Makhzan & Barcode Hub",
          subtitle: "Asset barcodes, item tagging, and distribution",
          category: "Tools",
          icon: Barcode,
          href: "/admin/makhzn",
          keywords: ["makhzn", "barcode", "assets", "stock"],
        },
        {
          id: "adm-library",
          title: "Library Catalog & 3D Shelves",
          subtitle: "Scan barcodes, issue books, and manage circulation",
          category: "Tools",
          icon: BookOpen,
          href: "/admin/library",
          keywords: ["library", "books", "shelves", "makhzn"],
        },
        {
          id: "adm-procurement",
          title: "Procurement & Desk Requisitions",
          subtitle: "Stationery requests, classroom items, and approvals",
          category: "Operations",
          icon: ShoppingBag,
          href: "/admin/procurement",
          keywords: ["procurement", "requisition", "supplies", "orders"],
        },
        {
          id: "adm-security",
          title: "Security & Access Command Center",
          subtitle: "Active sessions, IP defenses, audit logs, and access policies",
          category: "Operations",
          icon: ShieldCheck,
          href: "/admin/security",
          keywords: ["security", "audit", "sessions", "ip", "firewall"],
        },
        {
          id: "adm-whatsapp",
          title: "24/7 Cloud WhatsApp Gateway",
          subtitle: "WhatsApp hotline connectivity, notification bot, and status",
          category: "Tools",
          icon: MessageSquare,
          href: "/admin/whatsapp",
          badge: "Cloud",
          keywords: ["whatsapp", "gateway", "bot", "messages"],
        },
        {
          id: "adm-mailflare",
          title: "Mailflare Communications & IT Support",
          subtitle: "System webmail, email delivery logs, and IT tickets",
          category: "Tools",
          icon: Mail,
          href: "/admin/mailflare",
          keywords: ["mailflare", "email", "support", "inbox"],
        },
        {
          id: "adm-settings",
          title: "Institutional Portal Settings",
          subtitle: "Institution profile, academic year, and lock controls",
          category: "Account",
          icon: SlidersHorizontal,
          href: "/admin/settings",
          keywords: ["settings", "config", "locks", "system"],
        }
      );
    }

    // ────────────────────────────
    // 2. TEACHER COMMANDS
    // ────────────────────────────
    if (role === "TEACHER") {
      list.push(
        {
          id: "tch-dashboard",
          title: "Teacher Dashboard",
          subtitle: "Overview of today's schedule, takhteet, and classes",
          category: "Operations",
          icon: Activity,
          href: "/teacher",
          shortcut: "G D",
          keywords: ["home", "dashboard", "schedule"],
        },
        {
          id: "tch-classes",
          title: "My Classes & Enrollments",
          subtitle: "View assigned grade divisions and student rosters",
          category: "Academics",
          icon: BookOpen,
          href: "/teacher/classes",
          keywords: ["classes", "divisions", "talabat", "students"],
        },
        {
          id: "tch-timetable",
          title: "Timetable Matrix & Substitution Slots",
          subtitle: "Weekly schedule, room assignments, and badal periods",
          category: "Academics",
          icon: Calendar,
          href: "/teacher/timetable",
          shortcut: "G T",
          keywords: ["timetable", "periods", "schedule", "badal"],
        },
        {
          id: "tch-takhteet",
          title: "Takhteet Curriculum Planner",
          subtitle: "Portion coverage, daily lessons, and curriculum status",
          category: "Academics",
          icon: Layers,
          href: "/teacher/takhteet",
          keywords: ["takhteet", "curriculum", "lessons", "portion"],
        },
        {
          id: "tch-attendance",
          title: "Manual Classroom Roll-Call",
          subtitle: "Mark daily attendance, absent, and present students",
          category: "Attendance",
          icon: ClipboardCheck,
          href: "/teacher/attendance",
          shortcut: "G A",
          keywords: ["attendance", "rollcall", "manual", "mark"],
        },
        {
          id: "tch-my-attendance",
          title: "My Personal Attendance Record",
          subtitle: "Faculty biometric punches, duty hours, and logs",
          category: "Attendance",
          icon: Activity,
          href: "/teacher/my-attendance",
          keywords: ["my attendance", "punches", "faculty duty"],
        },
        {
          id: "tch-scans",
          title: "Hikvision Biometric Scans Roster",
          subtitle: "Real-time hardware verification logs",
          category: "Attendance",
          icon: Fingerprint,
          href: "/teacher/attendance-hik",
          keywords: ["scans", "hikvision", "biometric"],
        },
        {
          id: "tch-medical",
          title: "Medical Duty Station",
          subtitle: "First-aid, health clinic logs, and sick leaves",
          category: "Operations",
          icon: Stethoscope,
          href: "/teacher/medical-duty",
          keywords: ["medical", "clinic", "health", "first aid"],
        },
        {
          id: "tch-procurement",
          title: "Desk Requisition & Stationery",
          subtitle: "Request classroom materials and stationery supplies",
          category: "Operations",
          icon: ShoppingBag,
          href: "/teacher/procurement",
          keywords: ["requisition", "supplies", "stationery"],
        },
        {
          id: "tch-leave",
          title: "Leave Applications & Approvals",
          subtitle: "Review student leave and submit faculty leave requests",
          category: "Attendance",
          icon: CalendarCheck,
          href: "/teacher/leave",
          shortcut: "G L",
          keywords: ["leave", "vacation", "permission"],
        },
        {
          id: "tch-tilawat",
          title: "Tilawat Dua & Morning Prayers",
          subtitle: "Classroom projector display and recitation guide",
          category: "Academics",
          icon: BookOpen,
          href: "/teacher/tilawat-dua",
          keywords: ["tilawat", "dua", "morning", "projector"],
        },
        {
          id: "tch-profile",
          title: "Teacher Profile & Preferences",
          subtitle: "Personal details, credentials, and settings",
          category: "Account",
          icon: User,
          href: "/teacher/profile",
          keywords: ["profile", "settings", "credentials"],
        }
      );
    }

    // ────────────────────────────
    // 3. STUDENT (TALABAT) COMMANDS
    // ────────────────────────────
    if (role === "STUDENT") {
      list.push(
        {
          id: "stu-dashboard",
          title: "Talabat Space Dashboard",
          subtitle: "Overview of your attendance, timetable, and badges",
          category: "Operations",
          icon: Activity,
          href: "/talabat",
          shortcut: "G D",
          keywords: ["home", "dashboard", "talabat"],
        },
        {
          id: "stu-timetable",
          title: "My Class Timetable",
          subtitle: "Weekly schedule, periods, subjects, and room allotments",
          category: "Academics",
          icon: Calendar,
          href: "/talabat/timetable",
          shortcut: "G T",
          keywords: ["timetable", "schedule", "routine", "periods"],
        },
        {
          id: "stu-attendance",
          title: "Attendance & Telemetry",
          subtitle: "Daily scan records, attendance percent, and punch timings",
          category: "Attendance",
          icon: Clock,
          href: "/talabat/attendance",
          shortcut: "G A",
          keywords: ["attendance", "scans", "punches", "present", "absent"],
        },
        {
          id: "stu-leave",
          title: "Leave Requests & Applications",
          subtitle: "Submit leave request and track sanction status",
          category: "Attendance",
          icon: CalendarCheck,
          href: "/talabat/leave-request",
          shortcut: "G L",
          keywords: ["leave", "request", "medical", "permission"],
        },
        {
          id: "stu-yearly-profile",
          title: "Yearly Academic Profile (1447 H)",
          subtitle: "Personal progress dossier, achievements, and identity",
          category: "Academics",
          icon: GraduationCap,
          href: "/talabat/yearly-profile",
          keywords: ["profile", "1447", "yearly", "progress"],
        },
        {
          id: "stu-library",
          title: "Library Catalog & Borrowed Books",
          subtitle: "Search available books and view your issued loans",
          category: "Tools",
          icon: BookOpen,
          href: "/talabat/library",
          keywords: ["library", "books", "borrow", "makhzn"],
        },
        {
          id: "stu-assignments",
          title: "My Assignments & Submissions",
          subtitle: "Homework tasks, subject deadlines, and review status",
          category: "Academics",
          icon: ClipboardCheck,
          href: "/talabat/assignments",
          keywords: ["assignments", "homework", "tasks"],
        },
        {
          id: "stu-hobbies",
          title: "Hobbies & Practical Skills",
          subtitle: "Extra-curricular talents, achievements, and interests",
          category: "Academics",
          icon: Palette,
          href: "/talabat/hobbies",
          keywords: ["hobbies", "skills", "talents"],
        },
        {
          id: "stu-skill-tree",
          title: "Talabat Skill Tree",
          subtitle: "Track your academic competencies and mastery tiers",
          category: "Academics",
          icon: Sparkles,
          href: "/talabat/skill-tree",
          keywords: ["skill tree", "mastery", "levels"],
        },
        {
          id: "stu-badges",
          title: "Badges & Honors",
          subtitle: "Earned awards, attendance medals, and recognitions",
          category: "Academics",
          icon: Award,
          href: "/talabat/badges",
          keywords: ["badges", "medals", "awards"],
        },
        {
          id: "stu-tilawat",
          title: "Tilawat Dua & Duas",
          subtitle: "Sacred morning recitations and daily prayers",
          category: "Academics",
          icon: BookOpen,
          href: "/talabat/tilawat-dua",
          keywords: ["tilawat", "dua", "morning"],
        },
        {
          id: "stu-support",
          title: "IT Support & Helpdesk",
          subtitle: "Request technical help or institutional email assistance",
          category: "Tools",
          icon: Mail,
          href: "/talabat/support",
          keywords: ["support", "it", "helpdesk", "email"],
        },
        {
          id: "stu-profile",
          title: "My Account Profile",
          subtitle: "Student credentials, ITS info, and profile settings",
          category: "Account",
          icon: User,
          href: "/talabat/profile",
          keywords: ["profile", "its", "credentials", "account"],
        }
      );
    }

    // ────────────────────────────
    // 4. PARENT COMMANDS
    // ────────────────────────────
    if (role === "PARENT") {
      list.push(
        {
          id: "par-dashboard",
          title: "Parent Portal Dashboard",
          subtitle: "Child overview, attendance summary, and institutional updates",
          category: "Operations",
          icon: Activity,
          href: "/parent",
          shortcut: "G D",
          keywords: ["home", "dashboard", "parent"],
        },
        {
          id: "par-tracking",
          title: "Child Attendance & Biometric Scans",
          subtitle: "Live entrance & exit telemetry, presence records, and logs",
          category: "Attendance",
          icon: Fingerprint,
          href: "/parent/tracking",
          badge: "Live",
          shortcut: "G A",
          keywords: ["attendance", "scans", "child", "presence"],
        },
        {
          id: "par-activity",
          title: "Activity & Check-In History",
          subtitle: "Detailed timeline of daily attendance and scanner events",
          category: "Attendance",
          icon: Clock,
          href: "/parent/activity",
          keywords: ["activity", "timeline", "history", "checkin"],
        },
        {
          id: "par-timetable",
          title: "Child Class Timetable",
          subtitle: "Daily periods, subject schedule, and classroom timings",
          category: "Academics",
          icon: Calendar,
          href: "/parent/timetable",
          shortcut: "G T",
          keywords: ["timetable", "schedule", "subjects"],
        },
        {
          id: "par-library",
          title: "Library Books & Reading Record",
          subtitle: "Books issued by your child and due dates",
          category: "Tools",
          icon: BookOpen,
          href: "/parent/library",
          keywords: ["library", "books", "reading"],
        },
        {
          id: "par-leave",
          title: "Submit Leave Application",
          subtitle: "Apply for student absence, medical leaves, and permissions",
          category: "Attendance",
          icon: CalendarCheck,
          href: "/parent/leave",
          shortcut: "G L",
          keywords: ["leave", "sick", "absence", "application"],
        },
        {
          id: "par-settings",
          title: "Family Account Settings",
          subtitle: "Parent credentials, notifications, and contact details",
          category: "Account",
          icon: SlidersHorizontal,
          href: "/parent/settings",
          keywords: ["settings", "profile", "contact", "phone"],
        }
      );
    }

    // ────────────────────────────
    // 5. UNIVERSAL COMMANDS (All Roles)
    // ────────────────────────────
    list.push(
      {
        id: "uni-fatimi-calendar",
        title: "Fatimi Hijri Calendar",
        subtitle: "Misri calendar dates, holy miqaats, and academic schedule",
        category: "Tools",
        icon: Calendar,
        href: "/fatimi-calendar",
        shortcut: "G C",
        keywords: ["calendar", "hijri", "fatimi", "miqaat", "date"],
      },
      {
        id: "uni-notifications",
        title: "Notification Center",
        subtitle: "View announcements, leaves, attendance, and reminders",
        category: "Account",
        icon: Bell,
        href: "/notifications",
        keywords: ["notifications", "broadcasts", "alerts", "inbox"],
      }
    );

    // PWA Install Action if browser supports it
    if (canInstall && !isStandalone) {
      list.push({
        id: "uni-install-app",
        title: "Install Darse Burhani App",
        subtitle: "Install as native standalone application on your device",
        category: "Tools",
        icon: Download,
        badge: "PWA",
        action: () => {
          installPWA();
        },
        keywords: ["install", "app", "pwa", "desktop", "mobile"],
      });
    }

    // Quick Theme Switcher
    list.push({
      id: "uni-toggle-theme",
      title: "Cycle Fatimi Architectural Theme",
      subtitle: "Switch between Gold, Emerald, Royal, and Midnight themes",
      category: "Tools",
      icon: Palette,
      action: () => {
        const ids = availableThemes.map((t) => t.id);
        const currentIndex = ids.indexOf(currentThemeId);
        const nextId = ids[(currentIndex + 1) % ids.length];
        setTheme(nextId);
      },
      keywords: ["theme", "color", "appearance", "dark", "light", "palette"],
    });

    // Sign Out
    list.push({
      id: "uni-sign-out",
      title: "Sign Out of Portal",
      subtitle: "Safely end your authenticated academic session",
      category: "Account",
      icon: LogOut,
      action: () => {
        signOut({ callbackUrl: "/login" });
      },
      keywords: ["logout", "sign out", "exit", "disconnect"],
    });

    return list;
  }, [role, canInstall, isStandalone, installPWA, availableThemes, currentThemeId, setTheme]);

  // Extract unique categories for filter pills
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of allCommands) {
      cats.add(c.category);
    }
    return ["ALL", ...Array.from(cats)];
  }, [allCommands]);

  // Filter commands by search query and category
  const filteredCommands = useMemo(() => {
    let result = allCommands;

    if (selectedCategory !== "ALL") {
      result = result.filter((item) => item.category === selectedCategory);
    }

    if (!query.trim()) return result;

    const clean = query.toLowerCase().trim();
    return result.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(clean);
      const matchSubtitle = item.subtitle?.toLowerCase().includes(clean);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(clean));
      const matchShortcut = item.shortcut?.toLowerCase().includes(clean);
      return matchTitle || matchSubtitle || matchKeywords || matchShortcut;
    });
  }, [allCommands, query, selectedCategory]);

  // Handle command execution
  const executeCommand = (cmd: CommandItem) => {
    setOpen(false);
    if (cmd.action) {
      cmd.action();
    } else if (cmd.href) {
      prefetchRouteChunk(cmd.href);
      navigate(cmd.href);
    }
  };

  // Keyboard navigation within the command palette
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1)
      );
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      executeCommand(filteredCommands[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
          onClick={() => setOpen(false)}
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-slate-950/98 border border-amber-400/40 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden text-white backdrop-blur-2xl flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Gold Hairline Glow */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-90 pointer-events-none" />

          {/* Search Header */}
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 shrink-0">
            <Search className="w-5 h-5 text-amber-400 shrink-0" strokeWidth={2} />
            <input
              id="centralized-command-palette-search"
              name="commandPaletteQuery"
              aria-label="Search modules and commands"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={`Search ${role.toLowerCase()} tools, attendance, timetable, library...`}
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500 outline-none font-medium"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                ESC
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer touch-target-44"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Filter Pills Bar */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-black/20 overflow-x-auto scrollbar-none shrink-0">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-400 text-slate-950 shadow-xs"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Results Command List */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
            {filteredCommands.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Search className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-300">No actions found for "{query}"</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Try searching for attendance, timetable, or profile
                </p>
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
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/40 border border-amber-400/40 text-white shadow-md"
                        : "hover:bg-white/5 text-slate-300 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 ring-1 ring-amber-300"
                            : "bg-white/10 text-amber-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.85} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold truncate text-white">
                            {cmd.title}
                          </p>
                          {cmd.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              {cmd.badge}
                            </span>
                          )}
                        </div>
                        {cmd.subtitle && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {cmd.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cmd.shortcut && (
                        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/15">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:inline">
                        {cmd.category}
                      </span>
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isSelected ? "text-amber-400 translate-x-0.5" : "text-slate-600"
                        }`}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with Shortcuts and Navigation Help */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-black/40 border-t border-white/10 text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300">↑↓</kbd>
                <span className="hidden xs:inline">Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300">↵</kbd>
                <span className="hidden xs:inline">Select</span>
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300">G + key</kbd>
                <span>Jump</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Darse Burhani Spotlight</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CommandPalette;
