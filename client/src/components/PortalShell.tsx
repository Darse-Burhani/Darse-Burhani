"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Outlet } from "react-router-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
import { NotificationBell } from "@/components/NotificationBell";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { useFatimiTheme } from "@/context/FatimiThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { usePWA, isPWAStandalone } from "@/lib/pwa";
import { cn, getInitials } from "@/lib/utils";

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
  const [quickCommandOpen, setQuickCommandOpen] = useState(false);
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
    setQuickCommandOpen(false);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
    );
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setQuickCommandOpen(false);
    setProfileMenuOpen(false);
    setMobileSearchQuery("");
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen || quickCommandOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen, quickCommandOpen]);

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
      navItems.find((n) => n?.href?.includes("attendance-hik") || n?.href?.includes("attendance")) ??
      navItems[1] ??
      navItems[0] ??
      null
    );
  }, [navItems]);

  const timetableItem = useMemo<PortalNavItem | null>(() => {
    return (
      navItems.find((n) => n?.href?.includes("timetable") || n?.href?.includes("classes")) ??
      navItems[2] ??
      navItems[1] ??
      navItems[0] ??
      null
    );
  }, [navItems]);

  const avatarFallbackGradient = { background: theme.avatarGradient };
  const settingsHref = `${rootPath}/settings`;

  return (
    <>
      <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: theme.content }}>
        {/* ─────────────────────────────────────────────────────────────
           1. DESKTOP SIDEBAR (lg and up)
           ───────────────────────────────────────────────────────────── */}
        <aside
          className={cn(
            "hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-300 shadow-2xl",
            sidebarCollapsed ? "w-[76px]" : "w-64"
          )}
          style={{ background: theme.sidebar, boxShadow: `0 0 50px ${theme.sidebarGlow}` }}
        >
          <div
            className="h-[2px] w-full shrink-0"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
          />

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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80 leading-tight mt-1 truncate">
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
                      className="w-full pt-2.5 pb-1 px-2.5 flex items-center justify-between gap-2 text-[10px] font-bold tracking-wider uppercase text-white/70 hover:text-white transition-colors cursor-pointer group"
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
                              "group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200",
                              active
                                ? "bg-white/20 text-white shadow-sm ring-1 ring-white/20 font-bold"
                                : "text-white/80 hover:bg-white/10 hover:text-white",
                              sidebarCollapsed && "justify-center px-2"
                            )}
                            title={sidebarCollapsed ? item.label : undefined}
                          >
                            <item.icon
                              className={cn(
                                "w-4 h-4 shrink-0 transition-transform duration-200",
                                !active && "group-hover:scale-110 opacity-90 group-hover:opacity-100"
                              )}
                              style={active ? { color: theme.activeIcon } : undefined}
                            />
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
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
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
            "flex-1 flex flex-col min-h-screen transition-all duration-300 min-w-0 max-w-full overflow-x-hidden",
            "lg:ml-64",
            sidebarCollapsed && "lg:ml-[76px]"
          )}
        >
          {/* Top Header Bar */}
          <header className={cn("sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b shadow-2xs", theme.border)}>
            <div className="h-[2px] w-full" style={{ background: theme.headerLine }} />

            {/* ── Desktop Header ── */}
            <div className="h-16 hidden lg:flex items-center justify-between px-6">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ring-1 ring-amber-400/30 shrink-0"
                    style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
                  >
                    {activeItem?.icon ? <activeItem.icon className="w-4 h-4 text-white" /> : <Activity className="w-4 h-4 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-slate-900 text-base tracking-tight leading-tight truncate">
                        {sectionTitle}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
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
                      "flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2 w-72 border transition-all text-left group shadow-2xs bg-slate-50/80 hover:bg-white hover:border-amber-400/40 cursor-pointer ml-2",
                      theme.border
                    )}
                    title="Quick jump (⌘K / Ctrl+K)"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Search className="w-4 h-4 text-emerald-700 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="text-xs text-slate-500 font-medium truncate">{searchPlaceholder}</span>
                    </div>
                    <kbd className="px-1.5 py-0.5 rounded-lg bg-white text-[10px] font-mono font-bold text-slate-600 border border-slate-200 shadow-2xs shrink-0">
                      ⌘K
                    </kbd>
                  </button>
                )}
              </div>

              {/* Right Utilities */}
              <div className="flex items-center gap-3">
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
                  <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-mono font-medium">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{istTime}</span>
                    <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">IST</span>
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
                      <div className={cn("absolute right-0 mt-2 w-60 bg-white rounded-2xl border shadow-xl z-50 py-1.5 animate-fade-in overflow-hidden", theme.border)}>
                        <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                        <div className={cn("px-4 py-3 border-b bg-slate-50/50", theme.border)}>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {session?.user?.firstName} {session?.user?.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{session?.user?.email}</p>
                        </div>
                        <div className="px-2 py-1.5 space-y-0.5">
                          {profileLinks.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className={cn("flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-xl transition-colors", theme.hoverBg)}
                              onClick={() => setProfileMenuOpen(false)}
                            >
                              <link.icon className="w-4 h-4 text-emerald-700" />
                              {link.label}
                            </Link>
                          ))}
                          <Link
                            href={settingsHref}
                            className={cn("flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-xl transition-colors", theme.hoverBg)}
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <Settings className="w-4 h-4 text-emerald-700" />
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
                                      "flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer",
                                      isActiveTheme
                                        ? "bg-amber-50 text-amber-900 border border-amber-300"
                                        : "text-slate-700 border border-transparent hover:bg-slate-50"
                                    )}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                                      style={{ background: t.sidebarGradient, boxShadow: `inset 0 0 0 2px ${t.swatch.gold}` }}
                                    />
                                    <span className="flex-1 text-left">{t.name}</span>
                                    {isActiveTheme && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 w-full rounded-xl transition-colors cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── REDESIGNED MOBILE APP BAR (below lg) ── */}
            <div className="h-14 lg:hidden flex items-center justify-between px-3 bg-white/95 backdrop-blur-xl border-b border-slate-100 safe-area-top">
              {/* Left: Brand / Menu Drawer Trigger + Title */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-amber-400/40 active:scale-95 transition-transform cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
                  aria-label="Open portal menu"
                >
                  <FatimiLogo size={20} variant="gold" glow={true} />
                </button>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-extrabold tracking-wider uppercase px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
                      {roleLabel}
                    </span>
                    {istTime && (
                      <span className="text-[9px] text-slate-500 font-mono font-semibold flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        {istTime}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate mt-0.5">
                    {sectionTitle}
                  </h2>
                </div>
              </div>

              {/* Right: Quick PWA Install + Search + Notifications + Profile */}
              <div className="flex items-center gap-1 shrink-0">
                {/* PWA 1-Tap Install Pill for Mobile */}
                {canInstall && (
                  <button
                    type="button"
                    onClick={installPWA}
                    className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-400 text-slate-950 text-[10px] font-black shadow-xs active:scale-95 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    <span>Install</span>
                  </button>
                )}

                {/* Live Biometric Pulse Badge */}
                <button
                  type="button"
                  onClick={() => setQuickCommandOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold active:scale-95 transition-all"
                  title="Live Biometric Terminals"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span>Live</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSearch}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-90 transition-all cursor-pointer"
                  aria-label="Quick search"
                >
                  <Search className="w-3.5 h-3.5 text-emerald-800" />
                </button>

                <NotificationBell />

                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(true)}
                  className="p-0.5 rounded-xl active:scale-90 transition-transform cursor-pointer"
                >
                  <Avatar className="w-7 h-7 ring-1 ring-amber-400/50 shadow-xs">
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
            <div className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto bg-slate-50/90 border-t border-slate-200/60 scrollbar-none touch-pan-x">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 shrink-0 mr-0.5">
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
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all duration-150 shrink-0 active:scale-95",
                      active
                        ? "bg-emerald-900 text-white shadow-xs ring-1 ring-amber-400/40"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
                    )}
                  >
                    <Icon className={cn("w-3 h-3", active ? "text-amber-300" : "text-emerald-700")} />
                    <span>{item.label.replace(/\(.*\)/, "").trim()}</span>
                    {item.badge && (
                      <span className="px-1 py-0.2 rounded-full text-[8.5px] font-black bg-amber-400/20 text-amber-700 border border-amber-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </header>

          {/* ─────────────────────────────────────────────────────────────
             3. MAIN PAGE CONTENT (Generous Mobile Bottom Clearance)
             ───────────────────────────────────────────────────────────── */}
          <main className="relative flex-1 pb-36 sm:pb-32 lg:pb-8 pt-2 sm:pt-4 px-2.5 sm:px-4 lg:px-8 max-w-full">
            <div className="min-h-[calc(100vh-8rem)] relative z-10 min-w-0 max-w-full overflow-x-hidden">
              <Outlet />
            </div>

            {/* Institutional Footer */}
            <div className="relative z-10 mt-8 mb-4">
              <InstitutionalFooter variant="minimal" />
            </div>
          </main>

          {/* ─────────────────────────────────────────────────────────────
             4. REDESIGNED MOBILE NATIVE BOTTOM APP DOCK (Fixed & Ergonomic)
             ───────────────────────────────────────────────────────────── */}
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 dark:bg-emerald-950/95 border-t border-amber-400/25 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl safe-area-bottom select-none"
            aria-label="Mobile Bottom App Bar"
          >
            <div className="px-2 py-1.5 flex items-center justify-around gap-1 text-white max-w-md mx-auto">
              {/* 1. Home */}
              <Link
                href={rootPath}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 active:scale-90",
                  isActive(rootPath)
                    ? "text-amber-300 font-bold"
                    : "text-white/70 hover:text-white"
                )}
              >
                <div className="relative">
                  <Home className="w-5 h-5" style={isActive(rootPath) ? { color: GOLD } : undefined} />
                  {isActive(rootPath) && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-1 font-medium">Home</span>
              </Link>

              {/* 2. Attendance / Scans */}
              {attendanceItem && (
                <Link
                  href={attendanceItem.href}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 active:scale-90",
                    isActive(attendanceItem.href)
                      ? "text-amber-300 font-bold"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <div className="relative">
                    <attendanceItem.icon className="w-5 h-5" style={isActive(attendanceItem.href) ? { color: GOLD } : undefined} />
                    {isActive(attendanceItem.href) && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight mt-1 font-medium truncate max-w-[58px]">
                    {attendanceItem.label.replace(/\(.*\)/, "").trim().split(" ")[0]}
                  </span>
                </Link>
              )}

              {/* 3. Center Glowing Fatimi Command Orb */}
              <div className="relative -top-3 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setQuickCommandOpen(!quickCommandOpen)}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-[0_8px_25px_rgba(212,175,55,0.5)] ring-2 ring-amber-400/90 active:scale-90 transition-all cursor-pointer",
                    quickCommandOpen ? "rotate-45" : ""
                  )}
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #b8860b)` }}
                  aria-label="Quick Launch Center"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-950/20 text-white">
                    {quickCommandOpen ? <X className="w-5 h-5 text-white" /> : <FatimiLogo size={22} variant="gold" />}
                  </div>
                </button>
                <span className="text-[9px] font-bold text-amber-300 tracking-tight mt-0.5">Actions</span>
              </div>

              {/* 4. Timetable / Classes */}
              {timetableItem && (
                <Link
                  href={timetableItem.href}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 active:scale-90",
                    isActive(timetableItem.href)
                      ? "text-amber-300 font-bold"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <div className="relative">
                    <timetableItem.icon className="w-5 h-5" style={isActive(timetableItem.href) ? { color: GOLD } : undefined} />
                    {isActive(timetableItem.href) && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight mt-1 font-medium truncate max-w-[58px]">
                    {timetableItem.label.replace(/\(.*\)/, "").trim().split(" ")[0]}
                  </span>
                </Link>
              )}

              {/* 5. Modules Menu Drawer */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer",
                  mobileMenuOpen
                    ? "text-amber-300 font-bold"
                    : "text-white/70 hover:text-white"
                )}
                aria-label="Open all modules"
              >
                <div className="relative">
                  <Grid3X3 className="w-5 h-5" style={mobileMenuOpen ? { color: GOLD } : undefined} />
                  {mobileMenuOpen && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#d4af37]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-1 font-medium">Menu</span>
              </button>
            </div>
          </nav>

          {/* ─────────────────────────────────────────────────────────────
             5. QUICK LAUNCH CENTER BOTTOM SHEET (Center Orb Popover)
             ───────────────────────────────────────────────────────────── */}
          {quickCommandOpen && (
            <>
              <div
                className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
                onClick={() => setQuickCommandOpen(false)}
              />
              <div className="lg:hidden fixed bottom-16 inset-x-3 max-w-sm mx-auto z-50 animate-spring-up safe-area-bottom">
                <div className="p-4 rounded-3xl bg-slate-950/98 border border-amber-400/40 shadow-[0_24px_70px_rgba(0,0,0,0.8)] text-white backdrop-blur-2xl">
                  {/* Sheet Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-400/20 text-amber-300">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white tracking-wide uppercase">Fatimi Launchpad</h3>
                        <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                          <Radio className="w-3 h-3 animate-pulse" />
                          <span>Hikvision Terminals Active</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickCommandOpen(false)}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center active:scale-95"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Action Matrix */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Link
                      href={role === "ADMIN" ? "/admin/attendance-hik" : role === "TEACHER" ? "/teacher/attendance-hik" : "/talabat/attendance"}
                      onClick={() => setQuickCommandOpen(false)}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-center active:scale-95 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-300 mb-1.5 group-hover:scale-110 transition-transform">
                        <Fingerprint className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">Hikvision Scans</span>
                      <span className="text-[9px] text-white/60 mt-0.5">Live Timestamps</span>
                    </Link>

                    <Link
                      href={role === "ADMIN" ? "/admin/attendance-manual" : role === "TEACHER" ? "/teacher/attendance" : "/talabat/attendance"}
                      onClick={() => setQuickCommandOpen(false)}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-center active:scale-95 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-300 mb-1.5 group-hover:scale-110 transition-transform">
                        <ClipboardCheck className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">Manual Logs</span>
                      <span className="text-[9px] text-white/60 mt-0.5">Roster Roll-Call</span>
                    </Link>

                    <Link
                      href={role === "ADMIN" ? "/admin/timetable" : role === "TEACHER" ? "/teacher/timetable" : "/talabat/timetable"}
                      onClick={() => setQuickCommandOpen(false)}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-center active:scale-95 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-cyan-500/20 text-cyan-300 mb-1.5 group-hover:scale-110 transition-transform">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">Timetable Matrix</span>
                      <span className="text-[9px] text-white/60 mt-0.5">AI Period Slots</span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleOpenSearch}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-center active:scale-95 transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/20 text-purple-300 mb-1.5 group-hover:scale-110 transition-transform">
                        <Search className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">Quick Search</span>
                      <span className="text-[9px] text-white/60 mt-0.5">⌘K Jump Anywhere</span>
                    </button>
                  </div>

                  {/* Terminal Status Footer */}
                  <div className="px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between text-[10px]">
                    <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      MinMoe 192.168.0.4 &amp; 0.5 Connected
                    </span>
                    <span className="text-amber-300 font-mono font-bold">IST 05:30</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─────────────────────────────────────────────────────────────
             6. FULL MOBILE APP DRAWER (All Modules Categorized)
             ───────────────────────────────────────────────────────────── */}
          {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
                onClick={() => setMobileMenuOpen(false)}
              />

              <aside className="relative ml-auto w-full max-w-sm bg-slate-950 text-white h-full shadow-2xl flex flex-col z-10 border-l border-amber-400/30 animate-slide-left safe-area-bottom">
                {/* Drawer Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md ring-1 ring-amber-400/40"
                      style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
                    >
                      <FatimiLogo size={20} variant="gold" glow={true} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-white">Darse Burhani</h3>
                      <p className="text-[10px] text-amber-300 font-semibold">{portalName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-white/10 bg-black/20">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
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
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-2 scrollbar-none">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMobileCategoryFilter(cat)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors",
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
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]",
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
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold text-white/80 bg-white/10 hover:bg-white/15 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Settings</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 transition-colors cursor-pointer"
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
             7. MOBILE PROFILE MODAL
             ───────────────────────────────────────────────────────────── */}
          {profileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex items-end">
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
                onClick={() => setProfileMenuOpen(false)}
              />
              <div className="relative w-full max-w-sm mx-auto bg-slate-950 text-white rounded-t-3xl border-t border-amber-400/40 p-4 shadow-2xl z-10 animate-slide-up safe-area-bottom">
                <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-3" />
                <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-3">
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {session?.user?.firstName} {session?.user?.lastName}
                    </p>
                    <p className="text-xs text-white/60 truncate">{session?.user?.email}</p>
                    <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 mt-1">
                      {roleLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-7 h-7 rounded-full bg-white/10 text-white/70 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 mb-3">
                  {profileLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white/90 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <link.icon className="w-4 h-4 text-emerald-400" />
                      <span>{link.label}</span>
                    </Link>
                  ))}
                  <Link
                    href={settingsHref}
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white/90 bg-white/5 hover:bg-white/10 transition-colors"
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
                            "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer",
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
                  className="w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-500/30 active:scale-95 transition-all cursor-pointer mt-3"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
