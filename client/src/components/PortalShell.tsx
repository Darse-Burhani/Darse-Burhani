"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Outlet } from "react-router-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Grid3X3,
  Home,
  LogOut,
  Search,
  Settings,
  Sparkles,
  X,
  Zap,
  Radio,
  FileSpreadsheet,
  Layers,
  Clock,
  CheckCircle2,
  Download,
  CalendarDays,
  ClipboardCheck,
  Fingerprint,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Menu,
  Palette,
} from "lucide-react";
import { FatimiLogo } from "@/components/FatimiLogo";
import { FatimiPattern, FatimidRosette } from "@/components/FatimiOrnaments";
import { NotificationBell } from "@/components/NotificationBell";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { useFatimiTheme } from "@/context/FatimiThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { usePWA, isPWAStandalone } from "@/lib/pwa";
import { cn, getInitials } from "@/lib/utils";
import { formatTalabatEmail } from "@/lib/student-email";

export interface PortalNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  shortcut?: string;
  category?: string;
  badge?: string;
}

interface PortalShellProps {
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  portalName: string;
  subtitle: string;
  roleLabel: string;
  navItems: PortalNavItem[];
  searchPlaceholder?: string;
  profileLinks?: { label: string; href: string; icon: React.ElementType }[];
}

const GOLD = "#d4af37";
const GOLD_DARK = "#b8860b";

function rootPathFor(role: PortalShellProps["role"]) {
  return role === "STUDENT" ? "/talabat" : `/${role.toLowerCase()}`;
}

export function PortalShell({
  role,
  portalName,
  subtitle,
  roleLabel,
  navItems,
  searchPlaceholder,
  profileLinks = [],
}: PortalShellProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { canInstall, installPWA } = usePWA();
  const isStandalone = useMemo(() => isPWAStandalone(), []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState<string>("ALL");
  const [istTime, setIstTime] = useState<string>("");
  const { theme: activeFatimiTheme, currentThemeId, setTheme, availableThemes } = useFatimiTheme();

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setIstTime(timeString);
    };
    updateTime();
    const timer = setInterval(updateTime, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
    );
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    setMobileSearchQuery("");
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const rootPath = rootPathFor(role);

  // Theme blend
  const theme = useMemo(() => {
    return {
      sidebar: activeFatimiTheme.sidebarGradient,
      sidebarGlow: activeFatimiTheme.accentGlow,
      content: activeFatimiTheme.contentGradient,
      headerLine: activeFatimiTheme.headerLine,
      ambientGlow: activeFatimiTheme.accentGlow,
      activeIcon: activeFatimiTheme.goldAccent,
      breadcrumb: activeFatimiTheme.goldAccent,
      goldAccent: activeFatimiTheme.goldAccent,
      primary: activeFatimiTheme.primaryColor,
      secondary: activeFatimiTheme.secondaryColor,
      border: activeFatimiTheme.borderTint || "border-gray-200",
      hoverBg: activeFatimiTheme.lightBgTint ? `hover:${activeFatimiTheme.lightBgTint}` : "hover:bg-gray-50",
      badge: activeFatimiTheme.badgeClass,
      avatarGradient: `linear-gradient(135deg, ${activeFatimiTheme.swatch.primary}, ${activeFatimiTheme.swatch.secondary})`,
    };
  }, [activeFatimiTheme]);

  const activeItem = useMemo(() => {
    const match = navItems.find((n) => {
      if (n.href === rootPath) {
        return pathname === rootPath || pathname === `${rootPath}/`;
      }
      return pathname.startsWith(n.href);
    });
    return match ?? navItems[0];
  }, [navItems, pathname, rootPath]);

  const sectionTitle = activeItem?.label ?? portalName;

  const isActive = (href: string) =>
    href === rootPath
      ? pathname === rootPath || pathname === `${rootPath}/`
      : pathname.startsWith(href);

  // Category accordions for desktop sidebar
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const categorizedNavItems = useMemo(() => {
    const groups: { category: string; items: PortalNavItem[] }[] = [];
    const map = new Map<string, PortalNavItem[]>();
    for (const item of navItems) {
      const cat = item.category || "General";
      if (!map.has(cat)) {
        map.set(cat, []);
        groups.push({ category: cat, items: map.get(cat)! });
      }
      map.get(cat)!.push(item);
    }
    return groups;
  }, [navItems]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of navItems) {
      if (item.category) set.add(item.category);
    }
    return ["ALL", ...Array.from(set)];
  }, [navItems]);

  // Mobile horizontal sibling action chips
  const mobileHorizonItems = useMemo(() => {
    // If active item belongs to a category, show items in that category, or top 6 items
    const activeCat = activeItem?.category;
    if (activeCat) {
      const siblings = navItems.filter((i) => i.category === activeCat);
      if (siblings.length >= 2) return siblings;
    }
    return navItems.slice(0, 7);
  }, [navItems, activeItem]);

  // Filter items for mobile drawer
  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      const matchesCategory =
        mobileCategoryFilter === "ALL" || item.category === mobileCategoryFilter;
      const q = mobileSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.label.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [navItems, mobileCategoryFilter, mobileSearchQuery]);

  // Primary hubs for bottom navigation dock (null-safe — some portals pass
  // fewer nav items, so never assume index 1/2 exist)
  const attendanceItem = useMemo<PortalNavItem | null>(() => {
    return (
      navItems.find((n) => n?.href?.includes("attendance-hik") || n?.href?.includes("attendance") || n?.href?.includes("tracking")) ??
      navItems[1] ??
      navItems[0] ??
      null
    );
  }, [navItems]);

  const timetableItem = useMemo<PortalNavItem | null>(() => {
    return (
      navItems.find((n) => n?.href?.includes("timetable") || n?.href?.includes("classes") || n?.href?.includes("leave")) ??
      navItems[2] ??
      navItems[1] ??
      navItems[0] ??
      null
    );
  }, [navItems]);

  const avatarFallbackGradient = { background: theme.avatarGradient };
  const settingsHref = `${rootPath}/settings`;

  const displayUserEmail = session?.user?.role === "STUDENT"
    ? formatTalabatEmail(session?.user?.firstName, session?.user?.lastName, session?.user?.email)
    : session?.user?.email;

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col lg:flex-row" style={{ background: theme.content }}>
        {/* ─────────────────────────────────────────────────────────────
           1. DESKTOP SIDEBAR (lg and up)
           ───────────────────────────────────────────────────────────── */}
        <aside
          className={cn(
            "hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-300 shadow-2xl bg-slate-950",
            sidebarCollapsed ? "w-[76px]" : "w-64"
          )}
          style={{ background: theme.sidebar, boxShadow: `0 0 50px ${theme.sidebarGlow}` }}
        >
          <div
            className="h-[2px] w-full shrink-0"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
          />

          {/* Fatimi Architectural Watermark */}
          <FatimiPattern opacity={0.035} />

          {/* Desktop Brand Header */}
          <div
            className={cn(
              "h-16 flex items-center border-b border-white/10 relative z-10 shrink-0",
              sidebarCollapsed ? "justify-center px-2" : "px-4 gap-3"
            )}
          >
            <Link
              href={rootPath}
              className={cn(
                "flex items-center gap-3 group transition-transform duration-200 active:scale-95",
                sidebarCollapsed && "justify-center"
              )}
              title="Darse Burhani Portal Home"
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-amber-400/40 shrink-0 transition-transform duration-300 group-hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
              >
                <FatimiLogo size={24} variant="gold" glow={true} />
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-white text-base tracking-tight leading-none block group-hover:text-amber-300 transition-colors">
                      Darse Burhani
                    </span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 leading-tight mt-1 truncate">
                    {subtitle || "Mahad al Zahra"}
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Desktop Nav Accordions */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 relative z-10 scrollbar-thin">
            {categorizedNavItems.map((group) => {
              const isCollapsed = !sidebarCollapsed && !!collapsedCategories[group.category];

              return (
                <div key={group.category} className="space-y-1">
                  {!sidebarCollapsed ? (
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.category)}
                      className="w-full pt-2.5 pb-1 px-2.5 flex items-center justify-between gap-2 text-[10px] font-bold tracking-wider uppercase text-slate-200 hover:text-white transition-colors cursor-pointer group"
                      title={`Toggle ${group.category} section`}
                    >
                      <span className="truncate">{group.category}</span>
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 text-white/50 group-hover:text-white transition-transform duration-200 shrink-0",
                          isCollapsed && "-rotate-90"
                        )}
                      />
                    </button>
                  ) : (
                    <div className="my-2 mx-auto w-6 h-[1px] bg-white/15" />
                  )}

                  {(!isCollapsed || sidebarCollapsed) && (
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200",
                              active
                                ? "text-amber-300 font-extrabold"
                                : "text-white/80 hover:bg-white/10 hover:text-white",
                              sidebarCollapsed && "justify-center px-2"
                            )}
                            title={sidebarCollapsed ? item.label : undefined}
                          >
                            {active && (
                              <motion.div
                                layoutId="desktopActiveNavIndicator"
                                className="absolute inset-0 rounded-xl bg-slate-900 ring-1 ring-amber-400/40 shadow-sm"
                                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                              />
                            )}
                            <div className="relative z-10 flex items-center gap-2.5 w-full min-w-0">
                              <div
                                className={cn(
                                  "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200",
                                  active
                                    ? "bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/40"
                                    : "text-white/70 group-hover:text-white group-hover:scale-105"
                                )}
                              >
                                <item.icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </div>
                              {!sidebarCollapsed && (
                                <span className="truncate flex-1 min-w-0">{item.label}</span>
                              )}
                              {!sidebarCollapsed && item.badge && (
                                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30 shrink-0">
                                  {item.badge}
                                </span>
                              )}
                              {!sidebarCollapsed && item.shortcut && !item.badge && (
                                <kbd className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white border border-white/20 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                                  {item.shortcut}
                                </kbd>
                              )}
                              {active && !sidebarCollapsed && !item.shortcut && !item.badge && (
                                <span
                                  className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}` }}
                                />
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Desktop Sidebar Footer & Collapse Toggle */}
          <div className="shrink-0 p-3 border-t border-white/10 relative z-10 flex items-center justify-between">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/60 text-xs font-bold transition-colors cursor-pointer"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Collapse Menu</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────────
           2. MAIN APP SHELL (Desktop + Mobile)
           ───────────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex-1 flex flex-col min-h-[100dvh] transition-all duration-300 min-w-0 max-w-full overflow-x-hidden",
            "lg:ml-64",
            sidebarCollapsed && "lg:ml-[76px]"
          )}
        >
          {/* Top Header Bar */}
          <header className={cn("sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b shadow-2xs", theme.border)}>
            <div className="h-[2px] w-full" style={{ background: theme.headerLine }} />

            {/* ── Desktop Header ── */}
            <div className="h-16 hidden lg:flex items-center justify-between px-6 relative">
              {/* Subtle Fatimi Architectural Heritage Watermark */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <FatimidRosette size={140} opacity={0.03} stroke="#d4af37" className="absolute right-48 top-0 pointer-events-none" />
              </div>

              <div className="flex items-center gap-4 flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1 rounded-2xl bg-amber-400/10 ring-1 ring-amber-400/25 shrink-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shadow-inner"
                      style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
                    >
                      {activeItem?.icon ? (
                        <activeItem.icon className="w-4 h-4 text-white" strokeWidth={1.75} />
                      ) : (
                        <Activity className="w-4 h-4 text-white" strokeWidth={1.75} />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-slate-900 text-base tracking-tight leading-tight truncate">
                        {sectionTitle}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-[0.16em] uppercase bg-amber-50 text-amber-950 border border-amber-300/80 shadow-2xs shrink-0">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {searchPlaceholder && (
                  <button
                    type="button"
                    onClick={handleOpenSearch}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-full px-4 py-2 w-72 border transition-all duration-300 text-left group shadow-2xs bg-slate-50/90 hover:bg-white hover:border-amber-400/50 hover:shadow-xs cursor-pointer ml-3",
                      theme.border
                    )}
                    title="Quick jump (⌘K / Ctrl+K)"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Search className="w-3.5 h-3.5 text-amber-700 group-hover:scale-110 transition-transform shrink-0" strokeWidth={1.75} />
                      <span className="text-xs text-slate-600 font-medium truncate">{searchPlaceholder}</span>
                    </div>
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white text-[10px] font-mono font-bold text-slate-600 border border-slate-200/90 shadow-2xs shrink-0">
                      ⌘K
                    </kbd>
                  </button>
                )}
              </div>

              {/* Right Utilities */}
              <div className="flex items-center gap-3 relative z-10">
                {/* PWA Install Button for Desktop */}
                {canInstall && (
                  <button
                    type="button"
                    onClick={installPWA}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                    title="Install App for Desktop"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-700" />
                    <span>Install App</span>
                  </button>
                )}

                {/* Live IST Clock */}
                {istTime && (
                  <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-mono font-medium shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{istTime}</span>
                    <span className="text-[10px] text-slate-500 font-sans uppercase font-extrabold">IST</span>
                  </div>
                )}

                <NotificationBell />

                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className={cn("flex items-center gap-2.5 p-1.5 rounded-2xl transition-all hover:bg-slate-100/80 border border-transparent hover:border-slate-200 cursor-pointer", theme.hoverBg)}
                  >
                    <Avatar className="w-9 h-9 ring-2 ring-amber-400/40 shadow-xs">
                      {(session?.user?.avatarUrl || session?.user?.role === "ADMIN") && (
                        <AvatarImage
                          src={session.user.avatarUrl || "/logo.png"}
                          alt={`${session.user.firstName || ""} ${session.user.lastName || ""}`.trim() || "User profile"}
                        />
                      )}
                      <AvatarFallback className="text-white text-xs font-bold" style={avatarFallbackGradient}>
                        {session?.user ? getInitials(session.user.firstName, session.user.lastName) : "DB"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left hidden md:block">
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {session?.user?.firstName} {session?.user?.lastName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium capitalize">{role.toLowerCase()}</p>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {profileMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                      <div className={cn("absolute right-0 mt-2 w-64 bg-white rounded-2xl border shadow-xl z-50 py-1.5 animate-fade-in overflow-hidden flex flex-col", theme.border)}>
                        <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                        <div className={cn("px-4 py-3 border-b bg-slate-50/50", theme.border)}>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {session?.user?.firstName} {session?.user?.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{displayUserEmail}</p>
                        </div>
                        <div className="px-2 py-1.5 space-y-0.5 max-h-[50vh] overflow-y-auto">
                          {profileLinks.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className={cn("flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-xl transition-colors", theme.hoverBg)}
                              onClick={() => setProfileMenuOpen(false)}
                            >
                              <link.icon className="w-4 h-4 text-amber-700" strokeWidth={1.75} />
                              {link.label}
                            </Link>
                          ))}
                          <Link
                            href={settingsHref}
                            className={cn("flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-xl transition-colors", theme.hoverBg)}
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <Settings className="w-4 h-4 text-amber-700" strokeWidth={1.75} />
                            Settings
                          </Link>
                          <div className="px-2 pt-2 mt-1 border-t border-slate-100">
                            <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <Palette className="w-3 h-3" />
                              Appearance
                            </p>
                            <div className="space-y-0.5">
                              {availableThemes.map((t) => {
                                const isActiveTheme = currentThemeId === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTheme(t.id)}
                                    aria-pressed={isActiveTheme}
                                    className={cn(
                                      "flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer",
                                      isActiveTheme
                                        ? "bg-amber-50 text-amber-900 border border-amber-300"
                                        : "text-slate-700 border border-transparent hover:bg-slate-50"
                                    )}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                                      style={{ background: t.sidebarGradient, boxShadow: `inset 0 0 0 2px ${t.swatch.gold}` }}
                                    />
                                    <span className="flex-1 text-left text-[11px]">{t.name}</span>
                                    {isActiveTheme && <CheckCircle2 className="w-3 h-3 text-amber-500" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Dedicated Fixed Sign Out Footer */}
                        <div className="p-2 border-t border-slate-100 bg-slate-50/70">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              signOut({ callbackUrl: "/login" });
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100/70 w-full rounded-xl transition-colors cursor-pointer"
                          >
                            <LogOut className="w-4 h-4 text-rose-600" />
                            <span>Sign out</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── REDESIGNED MOBILE APP BAR (below lg) ── */}
            <div className="min-h-[3.75rem] sm:min-h-[4.25rem] h-auto lg:hidden flex items-center justify-between px-3 sm:px-4 bg-white/95 backdrop-blur-xl border-b border-slate-200/70 pt-[max(env(safe-area-inset-top,0px),0.5rem)] pb-2 shadow-2xs">
              {/* Left: Hamburger Drawer Trigger + Brand Logo + Title */}
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-800 bg-slate-100 hover:bg-slate-200/80 active:scale-90 transition-all cursor-pointer border border-slate-200/80 shrink-0 touch-target-44"
                  aria-label="Open portal navigation menu"
                >
                  <Menu className="w-5 h-5 text-slate-800" strokeWidth={1.85} />
                </button>

                <Link
                  href={rootPath}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-amber-400/50 active:scale-95 transition-transform"
                  style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
                  aria-label="Portal home"
                >
                  <FatimiLogo size={20} variant="gold" glow={true} />
                </Link>

                <div className="flex flex-col min-w-0 flex-1 pl-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-300/60 shrink-0 shadow-2xs">
                      {roleLabel}
                    </span>
                    {istTime && (
                      <span className="hidden sm:flex text-[9px] text-slate-500 font-mono font-semibold items-center gap-1 truncate">
                        <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" strokeWidth={1.75} />
                        {istTime}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate mt-0.5">
                    {sectionTitle}
                  </h2>
                </div>
              </div>

              {/* Right: PWA Install + Quick Search + Notifications + Profile */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Mobile PWA Download/Install Button — unobtrusive header action */}
                {canInstall && !isStandalone && (
                  <button
                    type="button"
                    onClick={installPWA}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 text-[11px] font-black transition-all cursor-pointer shadow-xs shrink-0 touch-target-44"
                    title="Install App"
                    aria-label="Install App"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="hidden xs:inline">App</span>
                  </button>
                )}

                {/* Live Biometric Pulse Badge for Tablet */}
                <Link
                  href={attendanceItem?.href || rootPath}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-300/80 text-[10px] font-bold active:scale-95 transition-all shadow-2xs hover:bg-emerald-100"
                  title="Live Biometric Terminals"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span>Live Attendance</span>
                </Link>

                <button
                  type="button"
                  onClick={handleOpenSearch}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-90 transition-all cursor-pointer border border-slate-200/70 touch-target-44"
                  aria-label="Quick search"
                >
                  <Search className="w-4 h-4 text-slate-800" strokeWidth={1.85} />
                </button>

                <div className="relative flex items-center justify-center touch-target-44">
                  <NotificationBell />
                </div>

                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(true)}
                  className="p-0.5 rounded-2xl active:scale-90 transition-transform cursor-pointer touch-target-44 flex items-center justify-center"
                  aria-label="User profile and appearance"
                >
                  <Avatar className="w-8 h-8 ring-1 ring-amber-400/60 shadow-xs">
                    {(session?.user?.avatarUrl || session?.user?.role === "ADMIN") && (
                      <AvatarImage
                        src={session.user.avatarUrl || "/logo.png"}
                        alt={session.user.firstName || "Profile"}
                      />
                    )}
                    <AvatarFallback className="text-white text-[10px] font-bold" style={avatarFallbackGradient}>
                      {session?.user ? getInitials(session.user.firstName, session.user.lastName) : "DB"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </div>
            </div>

            {/* ── REDESIGNED MOBILE HORIZON ACTION RIBBON ── */}
            <div className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto bg-slate-50/95 border-b border-slate-200/70 scrollbar-none touch-pan-x">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 shrink-0 mr-1">
                Quick:
              </span>
              {mobileHorizonItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-200 shrink-0 active:scale-95",
                      active
                        ? "bg-slate-900 text-amber-300 ring-1 ring-amber-400/50 shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80 shadow-2xs"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", active ? "text-amber-300" : "text-amber-600")} strokeWidth={1.85} />
                    <span>{item.label.replace(/\(.*\)/, "").trim()}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black bg-amber-400/20 text-amber-800 border border-amber-300/80">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </header>

          {/* ─────────────────────────────────────────────────────────────
             3. MAIN PAGE CONTENT (Generous bottom clearance for mobile dock)
             ───────────────────────────────────────────────────────────── */}
          <main className="relative flex-1 pb-28 sm:pb-32 lg:pb-8 pt-2 sm:pt-4 px-2.5 sm:px-4 lg:px-8 max-w-full min-w-0">
            <Outlet />
          </main>

          {/* ─────────────────────────────────────────────────────────────
             4. INSTITUTIONAL FOOTER (Sticky Bottom with Mobile Clearance)
             ───────────────────────────────────────────────────────────── */}
          <div className="relative z-10 mt-auto shrink-0 pb-24 lg:pb-0">
            <InstitutionalFooter variant="minimal" />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
           5. ERGONOMIC NATIVE MOBILE ACCESS DOCK (Thumb Reachable, True Fixed)
           ───────────────────────────────────────────────────────────── */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 select-none max-w-md mx-auto px-4 pb-[max(env(safe-area-inset-bottom,0px),0.65rem)] pointer-events-none"
          aria-label="Mobile Bottom App Bar"
        >
          <div className="pointer-events-auto rounded-3xl bg-slate-950/95 text-white backdrop-blur-2xl border border-amber-400/30 shadow-[0_10px_35px_rgba(0,0,0,0.6)] px-2 py-1.5 flex items-center justify-between gap-1 mb-1 relative overflow-hidden">
            {/* 1. Home */}
            <Link
              href={rootPath}
              className={cn(
                "relative flex-1 min-h-[46px] flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 active:scale-95",
                isActive(rootPath) ? "text-amber-300 font-extrabold" : "text-slate-300 hover:text-white"
              )}
            >
              {isActive(rootPath) && (
                <motion.div
                  layoutId="mobileActiveDockPill"
                  className="absolute inset-0 rounded-2xl bg-amber-400/20 border border-amber-400/40"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="relative">
                  <Home className="w-5 h-5" strokeWidth={2} style={isActive(rootPath) ? { color: GOLD } : undefined} />
                  {isActive(rootPath) && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 font-bold">Home</span>
              </div>
            </Link>

            {/* 2. Attendance / Primary Module */}
            {attendanceItem && (
              <Link
                href={attendanceItem.href}
                className={cn(
                  "relative flex-1 min-h-[46px] flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 active:scale-95",
                  isActive(attendanceItem.href) ? "text-amber-300 font-extrabold" : "text-slate-300 hover:text-white"
                )}
              >
                {isActive(attendanceItem.href) && (
                  <motion.div
                    layoutId="mobileActiveDockPill"
                    className="absolute inset-0 rounded-2xl bg-amber-400/20 border border-amber-400/40"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <div className="relative">
                    <attendanceItem.icon className="w-5 h-5" strokeWidth={2} style={isActive(attendanceItem.href) ? { color: GOLD } : undefined} />
                    {isActive(attendanceItem.href) && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 font-bold truncate max-w-[70px]">
                    {attendanceItem.label.replace(/\(.*\)/, "").trim().split(" ")[0]}
                  </span>
                </div>
              </Link>
            )}

            {/* 3. Timetable / Secondary Module */}
            {timetableItem && (
              <Link
                href={timetableItem.href}
                className={cn(
                  "relative flex-1 min-h-[46px] flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 active:scale-95",
                  isActive(timetableItem.href) ? "text-amber-300 font-extrabold" : "text-slate-300 hover:text-white"
                )}
              >
                {isActive(timetableItem.href) && (
                  <motion.div
                    layoutId="mobileActiveDockPill"
                    className="absolute inset-0 rounded-2xl bg-amber-400/20 border border-amber-400/40"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <div className="relative">
                    <timetableItem.icon className="w-5 h-5" strokeWidth={2} style={isActive(timetableItem.href) ? { color: GOLD } : undefined} />
                    {isActive(timetableItem.href) && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 font-bold truncate max-w-[70px]">
                    {timetableItem.label.replace(/\(.*\)/, "").trim().split(" ")[0]}
                  </span>
                </div>
              </Link>
            )}

            {/* 4. Modules Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                "relative flex-1 min-h-[46px] flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 active:scale-95 cursor-pointer",
                mobileMenuOpen ? "text-amber-300 font-extrabold" : "text-slate-300 hover:text-white"
              )}
              aria-label="Open all modules"
            >
              {mobileMenuOpen && (
                <motion.div
                  layoutId="mobileActiveDockPill"
                  className="absolute inset-0 rounded-2xl bg-amber-400/20 border border-amber-400/40"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="relative">
                  <Grid3X3 className="w-5 h-5" strokeWidth={2} style={mobileMenuOpen ? { color: GOLD } : undefined} />
                  {mobileMenuOpen && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 font-bold">All</span>
              </div>
            </button>
          </div>
        </nav>

          {/* ─────────────────────────────────────────────────────────────
             7. FULL MOBILE APP DRAWER (Slide-in from Left)
             ───────────────────────────────────────────────────────────── */}
          {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
                onClick={() => setMobileMenuOpen(false)}
              />

              <aside className="relative mr-auto w-full max-w-[85vw] sm:max-w-sm bg-slate-950 text-white h-full shadow-2xl flex flex-col z-10 border-r border-amber-400/30 animate-slide-left safe-area-bottom overflow-hidden">
                {/* Fatimi Background Pattern */}
                <FatimiPattern opacity={0.035} />

                {/* Drawer Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40 relative overflow-hidden">
                  <FatimidRosette size={140} opacity={0.045} stroke="#f3b833" className="absolute -right-8 -top-8 pointer-events-none" />
                  <div className="flex items-center gap-2.5 relative z-10">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md ring-1 ring-amber-400/40"
                      style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
                    >
                      <FatimiLogo size={20} variant="gold" glow={true} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-white">Darse Burhani</h3>
                      <p className="text-[10px] text-amber-300 font-semibold mt-0.5">{portalName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center active:scale-95 touch-target-44 relative z-10"
                    aria-label="Close navigation menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Optional PWA Install Action in Drawer */}
                {canInstall && (
                  <div className="px-3 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        installPWA();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs active:scale-98 transition-all"
                    >
                      <Download className="w-4 h-4" strokeWidth={2} />
                      <span>Install Darse Burhani App</span>
                    </button>
                  </div>
                )}

                {/* Search Bar */}
                <div className="p-3 border-b border-white/10 bg-black/20">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
                      id="mobile-nav-search-input"
                      name="mobileNavSearch"
                      aria-label="Search modules & pages"
                      type="text"
                      placeholder="Search modules & pages..."
                      value={mobileSearchQuery}
                      onChange={(e) => setMobileSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/50 outline-none focus:border-amber-400"
                    />
                    {mobileSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMobileSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-2 scrollbar-none touch-pan-x">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMobileCategoryFilter(cat)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors",
                          mobileCategoryFilter === cat
                            ? "bg-amber-400 text-slate-950 shadow-xs"
                            : "bg-white/10 text-white/70 hover:bg-white/15"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nav Items List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
                  {filteredNavItems.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] min-h-[44px]",
                          active
                            ? "bg-white/20 text-white ring-1 ring-amber-400/40"
                            : "text-white/80 hover:bg-white/10"
                        )}
                      >
                        <div
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            active ? "bg-amber-400 text-slate-950" : "bg-white/10 text-white"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            {item.badge}
                          </span>
                        )}
                        {active && !item.badge && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* User Section at bottom */}
                {session?.user && (
                  <div className="p-3 border-t border-white/10 bg-black/40">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <Avatar className="w-8 h-8 ring-1 ring-amber-400/40">
                        {(session.user.avatarUrl || session.user.role === "ADMIN") && (
                          <AvatarImage
                            src={session.user.avatarUrl || "/logo.png"}
                            alt={session.user.firstName || "Profile"}
                          />
                        )}
                        <AvatarFallback className="text-white text-xs font-bold" style={avatarFallbackGradient}>
                          {getInitials(session.user.firstName, session.user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {session.user.firstName} {session.user.lastName}
                        </p>
                        <p className="text-[10px] text-white/60 truncate">{roleLabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={settingsHref}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white/80 bg-white/10 hover:bg-white/15 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Settings</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
             8. UNIFIED MOBILE PROFILE BOTTOM SHEET
             ───────────────────────────────────────────────────────────── */}
          {profileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex items-end">
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
                onClick={() => setProfileMenuOpen(false)}
              />
              <div className="relative w-full max-w-sm mx-auto bg-slate-950 text-white rounded-t-3xl border-t border-amber-400/40 p-4 shadow-2xl z-10 animate-spring-up safe-area-bottom overflow-hidden">
                {/* Fatimi Watermark Rosette */}
                <FatimidRosette size={180} opacity={0.045} stroke="#f3b833" className="absolute -right-12 -bottom-12 pointer-events-none" />

                <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-3" />
                <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-3">
                  <div
                    onClick={(e) => {
                      if (session?.user?.avatarUrl) {
                        e.stopPropagation();
                        setAvatarLightboxOpen(true);
                        setProfileMenuOpen(false);
                      }
                    }}
                    className={session?.user?.avatarUrl ? "cursor-pointer transition-transform hover:scale-105 active:scale-95" : ""}
                    title={session?.user?.avatarUrl ? "Click to view full photo" : ""}
                  >
                    <Avatar className="w-12 h-12 ring-2 ring-amber-400/50 shadow-md">
                      {(session?.user?.avatarUrl || session?.user?.role === "ADMIN") && (
                        <AvatarImage
                          src={session.user.avatarUrl || "/logo.png"}
                          alt={session.user.firstName || "Profile"}
                        />
                      )}
                      <AvatarFallback className="text-white text-sm font-bold" style={avatarFallbackGradient}>
                        {session?.user ? getInitials(session.user.firstName, session.user.lastName) : "DB"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {session?.user?.firstName} {session?.user?.lastName}
                    </p>
                    <p className="text-xs text-white/60 truncate">{displayUserEmail}</p>
                    <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 mt-1">
                      {roleLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center touch-target-44"
                    aria-label="Close profile menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1 mb-3">
                  {profileLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white/90 bg-white/5 hover:bg-white/10 transition-colors min-h-[44px]"
                    >
                      <link.icon className="w-4 h-4 text-emerald-400" />
                      <span>{link.label}</span>
                    </Link>
                  ))}
                  <Link
                    href={settingsHref}
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white/90 bg-white/5 hover:bg-white/10 transition-colors min-h-[44px]"
                  >
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span>Portal Settings</span>
                  </Link>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5 px-1 mb-1.5">
                    <Palette className="w-3 h-3" />
                    Appearance
                  </p>
                  <div className="space-y-1">
                    {availableThemes.map((t) => {
                      const isActiveTheme = currentThemeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id)}
                          aria-pressed={isActiveTheme}
                          className={cn(
                            "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[40px]",
                            isActiveTheme
                              ? "bg-amber-400/15 text-amber-300 border border-amber-400/40"
                              : "text-white/90 bg-white/5 hover:bg-white/10 border border-transparent"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="w-4 h-4 rounded-full shrink-0 border border-white/20"
                            style={{ background: t.sidebarGradient, boxShadow: `inset 0 0 0 2px ${t.swatch.gold}` }}
                          />
                          <span className="flex-1 text-left">{t.name}</span>
                          {isActiveTheme && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-500/30 active:scale-95 transition-all cursor-pointer mt-3 min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}

          {/* Lightbox Modal for Avatar Viewing */}
          {avatarLightboxOpen && (
            <div
              className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
              onClick={() => setAvatarLightboxOpen(false)}
            >
              <div
                className="relative max-w-sm w-full bg-slate-950 rounded-3xl p-6 border border-amber-400/40 shadow-2xl flex flex-col items-center gap-4 animate-scale-up"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setAvatarLightboxOpen(false)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full overflow-hidden ring-4 ring-amber-400/50 shadow-2xl">
                  <ProfilePhoto
                    src={session?.user?.avatarUrl || "/logo.png"}
                    alt={`${session?.user?.firstName || ""} ${session?.user?.lastName || ""}`}
                    loading="eager"
                    previewable={false}
                    fit="cover"
                  />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-white tracking-wide">
                    {session?.user?.firstName} {session?.user?.lastName}
                  </h3>
                  <p className="text-xs text-amber-300 font-medium">{displayUserEmail}</p>
                </div>
              </div>
            </div>
          )}
      </div>
    </>
  );
}
