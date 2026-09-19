"use client";

import { useState, useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Grid3X3,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { FatimiLogo } from "@/components/FatimiLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { useFatimiTheme } from "@/context/FatimiThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

// ─────────────────────────────────────────────────
// Canonical portal shell — ONE theme for all roles (brand unity).
// ─────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD_DARK = "#b8860b";

interface PortalTheme {
  sidebar: string;
  sidebarGlow: string;
  content: string;
  headerLine: string;
  hoverBg: string;
  border: string;
  badge: string;
  activeIcon: string;
  breadcrumb: string;
  ambientGlow: string;
  avatarGradient: string;
}

const PORTAL_THEME: PortalTheme = {
  sidebar: "linear-gradient(180deg, #011f18 0%, #022c22 55%, #064e3b 100%)",
  sidebarGlow: "rgba(4, 120, 87, 0.45)",
  content: "linear-gradient(160deg, #f0fdf4 0%, #ffffff 45%, #ecfdf5 100%)",
  headerLine: `linear-gradient(90deg, #022c22, #10b981, #022c22)`,
  hoverBg: "hover:bg-emerald-50",
  border: "border-emerald-200",
  badge: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  activeIcon: "#10b981",
  breadcrumb: "#047857",
  ambientGlow: "rgba(16, 185, 129, 0.2)",
  avatarGradient: "linear-gradient(135deg, #064e3b, #022c22)",
};

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState<string>("ALL");
  const { theme: activeFatimiTheme } = useFatimiTheme();

  const handleOpenSearch = () => {
    setMobileMenuOpen(true);
    setTimeout(() => {
      const el = document.getElementById("portal-mobile-search-input");
      el?.focus();
    }, 150);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  };

  useEffect(() => {
    setMobileMenuOpen(false);
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

  // Dynamically blend active Fatimi theme
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

  // Extract unique categories for quick mobile filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of navItems) {
      if (item.category) set.add(item.category);
    }
    return ["ALL", ...Array.from(set)];
  }, [navItems]);

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

  // Primary workspace hub for bottom dock
  const hubItem = useMemo(() => {
    const preferred = navItems.find((n) => {
      const h = n.href.toLowerCase();
      return (
        h.includes("attendance") ||
        h.includes("classes") ||
        h.includes("hifz") ||
        h.includes("timetable")
      );
    });
    return preferred ?? navItems[1] ?? navItems[0];
  }, [navItems]);

  const avatarFallbackGradient = { background: theme.avatarGradient };
  const settingsHref = `${rootPath}/settings`;

  return (
    <div className="min-h-screen flex" style={{ background: theme.content }}>
      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-300 shadow-2xl",
          sidebarCollapsed ? "w-[76px]" : "w-64"
        )}
        style={{ background: theme.sidebar, boxShadow: `0 0 50px ${theme.sidebarGlow}` }}
      >
        <div className="h-[2px] w-full shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${theme.goldAccent}, transparent)` }} />

        <div className={cn(
          "h-16 flex items-center border-b border-white/10 relative z-10",
          sidebarCollapsed ? "justify-center px-2" : "px-5 gap-3"
        )}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0" style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}>
            <FatimiLogo size={26} variant="gold" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-white text-lg leading-tight tracking-tight">Darse Burhani</h1>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>{subtitle}</p>
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 relative z-10 scrollbar-thin">
          {navItems.map((item, index) => {
            const active = isActive(item.href);
            const prevCategory = index > 0 ? navItems[index - 1].category : undefined;
            const showCategoryHeader = item.category && item.category !== prevCategory;
            return (
              <div key={item.href} className="space-y-1">
                {showCategoryHeader && !sidebarCollapsed && (
                  <div className="pt-3 pb-1 px-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-white/70">{item.category}</span>
                    <div className="h-[1px] flex-1 bg-white/10" />
                  </div>
                )}
                {showCategoryHeader && sidebarCollapsed && (
                  <div className="my-2 mx-auto w-6 h-[1px] bg-white/15" />
                )}
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                    active
                      ? "bg-white/20 text-white shadow-sm ring-1 ring-white/20"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon
                    className={cn("w-5 h-5 shrink-0 transition-transform duration-200", !active && "group-hover:scale-110 opacity-90 group-hover:opacity-100")}
                    style={active ? { color: theme.activeIcon } : undefined}
                  />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {!sidebarCollapsed && item.badge && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                      {item.badge}
                    </span>
                  )}
                  {!sidebarCollapsed && item.shortcut && !item.badge && (
                    <kbd className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white border border-white/20 opacity-80 group-hover:opacity-100 transition-opacity">
                      {item.shortcut}
                    </kbd>
                  )}
                  {active && !sidebarCollapsed && !item.shortcut && !item.badge && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: theme.goldAccent, boxShadow: `0 0 8px ${theme.ambientGlow}` }} />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Desktop Bottom section */}
        <div className="p-3 space-y-1 border-t border-white/10 relative z-10">
          <Link
            href={settingsHref}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-white/80 hover:bg-white/10 hover:text-white",
              isActive(settingsHref) && "bg-white/20 text-white shadow-sm ring-1 ring-white/20",
              sidebarCollapsed && "justify-center px-2"
            )}
            title={sidebarCollapsed ? "Settings" : undefined}
          >
            <Settings
              className="w-5 h-5 shrink-0 opacity-90"
              style={isActive(settingsHref) ? { color: theme.activeIcon } : undefined}
            />
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/75 hover:bg-white/10 hover:text-white transition-colors font-medium",
              sidebarCollapsed && "justify-center px-2"
            )}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile Command Drawer & Navigation Center ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          {/* Backdrop with tap-to-dismiss */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside
            className="absolute inset-y-0 left-0 w-full max-w-[320px] sm:max-w-sm shadow-2xl animate-slide-in-left flex flex-col h-full overflow-hidden rounded-r-[2rem] border-r border-white/10"
            style={{ background: theme.sidebar }}
          >
            {/* Top gold accent hairline */}
            <div className="h-[2px] w-full shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

            {/* Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` }}
                >
                  <FatimiLogo size={24} variant="gold" />
                </div>
                <div>
                  <h1 className="font-bold text-white text-base leading-tight">Darse Burhani</h1>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "rgba(212,175,55,0.85)" }}>
                    {subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Instant Search Bar */}
            <div className="p-3 border-b border-white/10 shrink-0 bg-black/10">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <input
                  id="portal-mobile-search-input"
                  type="text"
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  placeholder="Filter pages & modules..."
                  className="w-full bg-white/10 text-white placeholder-white/50 text-xs rounded-2xl pl-9 pr-8 py-2.5 border border-white/15 focus:outline-none focus:ring-2 focus:ring-amber-400/80 transition-all"
                />
                {mobileSearchQuery && (
                  <button
                    onClick={() => setMobileSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              {categories.length > 2 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMobileCategoryFilter(cat)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all active:scale-95",
                        mobileCategoryFilter === cat
                          ? "bg-amber-400 text-emerald-950 shadow-sm"
                          : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation List */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1 relative z-10 scrollbar-thin">
              {filteredNavItems.length === 0 ? (
                <div className="py-12 text-center text-white/50 text-xs">
                  <p>No modules match &quot;{mobileSearchQuery}&quot;</p>
                  <button
                    onClick={() => {
                      setMobileSearchQuery("");
                      setMobileCategoryFilter("ALL");
                    }}
                    className="mt-2 text-amber-300 underline font-semibold text-xs"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredNavItems.map((item, index) => {
                  const active = isActive(item.href);
                  const prevCategory = index > 0 ? filteredNavItems[index - 1].category : undefined;
                  const showCategoryHeader =
                    mobileCategoryFilter === "ALL" &&
                    !mobileSearchQuery &&
                    item.category &&
                    item.category !== prevCategory;
                  return (
                    <div key={item.href} className="space-y-1">
                      {showCategoryHeader && (
                        <div className="pt-3 pb-1 px-3 flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase text-white/60">
                            {item.category}
                          </span>
                          <div className="h-[1px] flex-1 bg-white/10" />
                        </div>
                      )}
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
                          active
                            ? "bg-white/20 text-white shadow-sm ring-1 ring-white/20"
                            : "text-white/85 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200",
                            active ? "bg-white/15" : "bg-white/5 group-hover:scale-105"
                          )}
                        >
                          <item.icon
                            className="w-4 h-4"
                            style={active ? { color: theme.activeIcon } : undefined}
                          />
                        </div>
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30 shrink-0">
                            {item.badge}
                          </span>
                        )}
                        {active && !item.badge && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD, boxShadow: "0 0 6px #d4af37" }} />
                        )}
                      </Link>
                    </div>
                  );
                })
              )}
            </nav>

            {/* Mobile User Identity Section */}
            {session?.user && (
              <div className="shrink-0 p-3.5 border-t border-white/10 relative z-10 bg-black/25 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2.5">
                  <Avatar className="w-9 h-9 border-2" style={{ borderColor: GOLD }}>
                    {session.user.avatarUrl && <AvatarImage src={session.user.avatarUrl} />}
                    <AvatarFallback className="text-white text-xs font-semibold" style={avatarFallbackGradient}>
                      {getInitials(session.user.firstName, session.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {session.user.firstName} {session.user.lastName}
                    </p>
                    <p className="text-[10px] text-white/70 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" style={{ color: GOLD }} />
                      {roleLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={settingsHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold text-white/80 bg-white/10 hover:bg-white/15 transition-all active:scale-95"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </Link>

                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold text-red-300 bg-red-500/15 hover:bg-red-500/25 transition-all active:scale-95"
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

      {/* ── Main Content Area — pushed by the sidebar, no overlap ── */}
      <div className={cn(
        "flex-1 flex flex-col min-h-screen transition-all duration-300 min-w-0 max-w-full overflow-x-hidden",
        "lg:ml-64",
        sidebarCollapsed && "lg:ml-[76px]"
      )}>
        {/* Top Header Bar */}
        <header className={cn("sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b", theme.border)}>
          {/* Gold accent line at top */}
          <div className="h-[2px] w-full" style={{ background: theme.headerLine }} />

          {/* ── Desktop Header (lg and up) ── */}
          <div className="h-16 hidden lg:flex items-center justify-between px-6">
            {/* Left: Section title + search */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center fatimi-gold-accent shadow-sm shrink-0">
                  {activeItem?.icon ? <activeItem.icon className="w-4 h-4 text-white" /> : <Activity className="w-4 h-4 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-bold text-gray-900 text-base truncate">{sectionTitle}</h2>
                </div>
              </div>
              {searchPlaceholder && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
                    );
                  }}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 w-64 border transition-all text-left group shadow-2xs bg-white/70",
                    theme.border
                  )}
                  title="Search or jump anywhere (Cmd+K / Ctrl+K)"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Search
                      className="w-3.5 h-3.5 group-hover:scale-110 transition-transform shrink-0"
                      style={{ color: theme.breadcrumb }}
                    />
                    <span className="text-xs text-gray-500 truncate">{searchPlaceholder}</span>
                  </div>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-[10px] font-mono font-bold text-gray-600 border border-gray-200 shadow-2xs shrink-0">
                    ⌘K
                  </kbd>
                </button>
              )}
            </div>

            {/* Right: notifications + profile */}
            <div className="flex items-center gap-2">
              <NotificationBell />

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className={cn("flex items-center gap-3 p-1.5 rounded-xl transition-colors", theme.hoverBg)}
                >
                  <Avatar className="w-9 h-9 ring-2 ring-white shadow-sm">
                    {session?.user?.avatarUrl && <AvatarImage src={session.user.avatarUrl} />}
                    <AvatarFallback className="text-white text-sm" style={avatarFallbackGradient}>
                      {session?.user ? getInitials(session.user.firstName, session.user.lastName) : "DB"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      {session?.user?.firstName} {session?.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{roleLabel}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                    <div className={cn("absolute right-0 mt-2 w-56 bg-white rounded-xl border shadow-xl z-50 py-1.5 animate-fade-in overflow-hidden", theme.border)}>
                      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                      <div className={cn("px-4 py-3 border-b", theme.border)}>
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: theme.breadcrumb }} />
                          {session?.user?.firstName} {session?.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</p>
                      </div>
                      <div className="px-2 py-1">
                        {profileLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors", theme.hoverBg)}
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <link.icon className="w-4 h-4" style={{ color: theme.breadcrumb }} />
                            {link.label}
                          </Link>
                        ))}
                        <Link
                          href={settingsHref}
                          className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors", theme.hoverBg)}
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4" style={{ color: theme.breadcrumb }} />
                          Settings
                        </Link>
                        <button
                          onClick={() => signOut({ callbackUrl: "/login" })}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full rounded-lg transition-colors"
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

          {/* ── Mobile Premium App Header (below lg) ── */}
          <div className="h-14 lg:hidden flex items-center justify-between px-3 sm:px-4">
            {/* Left: Fatimi crest + Active page indicator */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ring-1 ring-black/5 active:scale-95 transition-transform"
                style={{ background: `linear-gradient(135deg, ${theme.goldAccent}, ${theme.primary})` }}
                aria-label="Open navigation drawer"
              >
                <FatimiLogo size={20} variant="gold" />
              </button>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-900 border border-amber-400/30 truncate">
                    {roleLabel}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium truncate">
                    {activeItem?.category || subtitle}
                  </span>
                </div>
                <h2 className="font-display font-bold text-gray-900 text-sm leading-tight truncate">
                  {sectionTitle}
                </h2>
              </div>
            </div>

            {/* Right: Quick search, notifications, profile */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleOpenSearch}
                className="w-9 h-9 rounded-2xl flex items-center justify-center text-gray-700 hover:text-gray-950 bg-gray-100/80 hover:bg-gray-200/80 active:scale-90 transition-all cursor-pointer"
                aria-label="Quick search"
              >
                <Search className="w-4 h-4 text-emerald-800" />
              </button>

              <NotificationBell />

              {/* Mobile Profile Trigger */}
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="p-1 rounded-2xl active:scale-90 transition-transform cursor-pointer"
                  aria-label="Open profile menu"
                >
                  <Avatar className="w-8 h-8 ring-2 ring-emerald-600/30 shadow-xs">
                    {session?.user?.avatarUrl && <AvatarImage src={session.user.avatarUrl} />}
                    <AvatarFallback className="text-white text-xs font-semibold" style={avatarFallbackGradient}>
                      {session?.user ? getInitials(session.user.firstName, session.user.lastName) : "DB"}
                    </AvatarFallback>
                  </Avatar>
                </button>

                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                    <div className={cn("absolute right-0 mt-2 w-56 bg-white rounded-3xl border shadow-2xl z-50 py-2 animate-fade-in overflow-hidden", theme.border)}>
                      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                      <div className={cn("px-4 py-3 border-b", theme.border)}>
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: theme.breadcrumb }} />
                          {session?.user?.firstName} {session?.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</p>
                      </div>
                      <div className="px-2 py-1">
                        {profileLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors", theme.hoverBg)}
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <link.icon className="w-4 h-4" style={{ color: theme.breadcrumb }} />
                            {link.label}
                          </Link>
                        ))}
                        <Link
                          href={settingsHref}
                          className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors", theme.hoverBg)}
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4" style={{ color: theme.breadcrumb }} />
                          Settings
                        </Link>
                        <button
                          onClick={() => signOut({ callbackUrl: "/login" })}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full rounded-lg transition-colors"
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
        </header>

        {/* Page Content */}
        <main className="relative flex-1 pb-28 lg:pb-8">
          <div className="min-h-[calc(100vh-4rem)]">
            {/* Ambient glows + geometric pattern */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
              <div className="absolute inset-0 overflow-hidden opacity-[0.02]">
                <svg className="w-full h-full" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <defs>
                    <pattern id="portalContentPattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                      <path d="M40 0L80 40L40 80L0 40Z" fill="none" stroke={GOLD} strokeWidth="0.5" />
                      <circle cx="40" cy="40" r="15" fill="none" stroke={GOLD} strokeWidth="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#portalContentPattern)" />
                </svg>
              </div>
              <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] rounded-full blur-3xl" style={{ background: theme.ambientGlow }} />
              <div className="absolute -bottom-40 -left-40 w-[25rem] h-[25rem] rounded-full blur-3xl" style={{ background: "rgba(212, 175, 55, 0.06)" }} />
            </div>
            <div className="relative z-10 min-w-0">
              <Outlet />
            </div>
          </div>
        </main>

        {/* ── Apple-tier Floating Mobile Navigation Island (Glass Dock) ── */}
        <nav
          className="lg:hidden fixed bottom-3 inset-x-3 max-w-sm sm:max-w-md mx-auto z-40 select-none"
          aria-label="Mobile Navigation"
        >
          <div className="p-1 rounded-[2rem] sm:rounded-full bg-emerald-950/30 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_16px_45px_rgba(0,0,0,0.38)]">
            <div className="bg-slate-900/95 dark:bg-emerald-950/95 rounded-[1.75rem] sm:rounded-full px-2 py-1.5 flex items-center justify-around gap-1 text-white">
              {/* 1. Home */}
              <Link
                href={rootPath}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl sm:rounded-full transition-all duration-200 active:scale-90",
                  isActive(rootPath)
                    ? "bg-white/15 text-white font-bold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="relative">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5" style={isActive(rootPath) ? { color: GOLD } : undefined} />
                  {isActive(rootPath) && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#d4af37]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 font-medium">Home</span>
              </Link>

              {/* 2. Primary Workspace Hub */}
              {hubItem && (
                <Link
                  href={hubItem.href}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl sm:rounded-full transition-all duration-200 active:scale-90",
                    isActive(hubItem.href)
                      ? "bg-white/15 text-white font-bold"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="relative">
                    <hubItem.icon className="w-4 h-4 sm:w-5 sm:h-5" style={isActive(hubItem.href) ? { color: GOLD } : undefined} />
                    {isActive(hubItem.href) && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#d4af37]" />
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 font-medium truncate max-w-[56px]">
                    {hubItem.label.replace(/\(.*\)/, "").trim().split(" ")[0]}
                  </span>
                </Link>
              )}

              {/* 3. Quick Search Trigger */}
              <button
                type="button"
                onClick={handleOpenSearch}
                className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl sm:rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200 active:scale-90 cursor-pointer"
                aria-label="Quick Search"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                <span className="text-[10px] tracking-tight mt-0.5 font-medium">Search</span>
              </button>

              {/* 4. Notifications / Alerts */}
              <Link
                href="/notifications"
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl sm:rounded-full transition-all duration-200 active:scale-90",
                  pathname.startsWith("/notifications")
                    ? "bg-white/15 text-white font-bold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="relative">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" style={pathname.startsWith("/notifications") ? { color: GOLD } : undefined} />
                  {pathname.startsWith("/notifications") && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#d4af37]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 font-medium">Alerts</span>
              </Link>

              {/* 5. Modules Drawer Trigger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl sm:rounded-full transition-all duration-200 active:scale-90 cursor-pointer",
                  mobileMenuOpen
                    ? "bg-white/20 text-white font-bold ring-1 ring-white/30"
                    : "text-white/80 hover:text-white hover:bg-white/5"
                )}
                aria-label="Open all modules"
              >
                <div className="relative">
                  <Grid3X3 className="w-4 h-4 sm:w-5 sm:h-5" style={mobileMenuOpen ? { color: GOLD } : undefined} />
                  {mobileMenuOpen && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#d4af37]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 font-medium">Menu</span>
              </button>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
