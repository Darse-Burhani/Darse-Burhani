"use client";

import { useState, useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
// PortalShell is the single navigation system; NavigationBar is legacy
// (notifications page only) and reuses these same tokens.
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

// All roles intentionally share one theme — role identity comes from
// labels/icons, not competing color schemes.
const THEMES: Record<PortalShellProps["role"], PortalTheme> = {
  ADMIN: PORTAL_THEME,
  TEACHER: PORTAL_THEME,
  STUDENT: PORTAL_THEME,
  PARENT: PORTAL_THEME,
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
  const { theme: activeFatimiTheme } = useFatimiTheme();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open to prevent background scrolling outside the box
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

        {/* Navigation */}
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

        {/* Bottom section */}
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

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-2xl animate-slide-in-left flex flex-col h-full overflow-hidden" style={{ background: theme.sidebar }}>
            <div className="h-[2px] w-full shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

            <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` }}>
                  <FatimiLogo size={26} variant="gold" />
                </div>
                <div>
                  <h1 className="font-bold text-white leading-tight">Darse Burhani</h1>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "rgba(212,175,55,0.75)" }}>{subtitle}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/70" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 relative z-10 scrollbar-thin">
              {navItems.map((item, index) => {
                const active = isActive(item.href);
                const prevCategory = index > 0 ? navItems[index - 1].category : undefined;
                const showCategoryHeader = item.category && item.category !== prevCategory;
                return (
                  <div key={item.href} className="space-y-1">
                    {showCategoryHeader && (
                      <div className="pt-3 pb-1 px-3 flex items-center gap-2">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-white/70">{item.category}</span>
                        <div className="h-[1px] flex-1 bg-white/10" />
                      </div>
                    )}
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                        active ? "bg-white/20 text-white shadow-sm ring-1 ring-white/20" : "text-white/85 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <item.icon
                        className="w-5 h-5 shrink-0"
                        style={active ? { color: theme.activeIcon } : undefined}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                          {item.badge}
                        </span>
                      )}
                      {active && !item.badge && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />}
                    </Link>
                  </div>
                );
              })}
              <Link
                href={settingsHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-white/85 hover:bg-white/10 hover:text-white"
              >
                <Settings className="w-5 h-5 shrink-0" />
                <span>Settings</span>
              </Link>
            </nav>

            {/* Mobile User Section */}
            {session?.user && (
              <div className="shrink-0 p-4 border-t border-white/10 relative z-10 bg-black/20 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-10 h-10 border-2" style={{ borderColor: GOLD }}>
                    {session.user.avatarUrl && <AvatarImage src={session.user.avatarUrl} />}
                    <AvatarFallback className="text-white text-sm" style={avatarFallbackGradient}>
                      {getInitials(session.user.firstName, session.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {session.user.firstName} {session.user.lastName}
                    </p>
                    <p className="text-xs text-white/70 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      {roleLabel}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
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
        <header className={cn("sticky top-0 z-30 h-16 bg-white/85 backdrop-blur-xl border-b", theme.border)}>
          {/* Gold accent line at top */}
          <div className="h-[2px] w-full" style={{ background: theme.headerLine }} />
          <div className="h-[calc(100%-2px)] flex items-center justify-between px-4 sm:px-6">
            {/* Left: mobile menu + section title + search */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={cn("lg:hidden p-2 rounded-xl text-gray-600 shrink-0", theme.hoverBg)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden lg:flex items-center gap-2.5 min-w-0">
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
                    "hidden md:flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 w-64 border transition-all text-left group shadow-2xs bg-white/70",
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

            {/* Right: actions + profile */}
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
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      {session?.user?.firstName} {session?.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{roleLabel}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
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
        </header>

        {/* Page Content */}
        <main className="relative flex-1">
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
      </div>
    </div>
  );
}
