"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LogOut,
  User,
  Settings,
  Menu,
  X,
  ChevronDown,
  School,
  Users,
  Star,
  Heart,
  Shield,
  BarChart3,
  BookOpen,
  Grid3X3,
  Clock,
  CalendarDays,
  ClipboardList,
  FileText,
  UserCheck,
  Library,
  MoreHorizontal,
  Megaphone,
  Package,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { FatimiLogo } from "@/components/FatimiLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";

import { usePortalAccess } from "@/context/PortalAccessContext";

// LEGACY top-bar — PortalShell is the canonical navigation system.
// This bar survives only for the cross-role /notifications page. It
// intentionally reuses the same emerald/gold tokens (no per-role colors)
// so the UI speaks one visual language.
const UNIFIED_GRADIENT = "from-emerald-600 to-teal-700";
const portalConfig: Record<
  string,
  {
    name: string;
    color: string;
    gradient: string;
    logoVariant: "admin" | "teacher" | "student" | "parent";
    icon: React.ElementType;
    navItems: { label: string; href: string; icon: React.ElementType }[];
  }
> = {
  ADMIN: {
    name: "Admin Portal",
    color: "admin-primary",
    gradient: UNIFIED_GRADIENT,
    logoVariant: "admin",
    icon: School,
    navItems: [
      { label: "Dashboard", href: "/admin", icon: Activity },
      { label: "Tracking", href: "/admin/tracking", icon: BarChart3 },
      { label: "Classes", href: "/admin/classes", icon: BookOpen },
      { label: "Takhteet", href: "/admin/timetable", icon: ClipboardList },
      { label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays },
      { label: "Hifz", href: "/admin/hifz", icon: FileText },
      { label: "Point Matrix", href: "/admin/point-matrix", icon: Grid3X3 },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Broadcasts", href: "/admin/notifications", icon: Megaphone },
      { label: "Portal Access", href: "/admin/portal-assignments", icon: UserCheck },
    ],
  },
  TEACHER: {
    name: "Teacher Dashboard",
    color: "teacher-primary",
    gradient: UNIFIED_GRADIENT,
    logoVariant: "teacher",
    icon: Users,
    navItems: [
      { label: "Dashboard", href: "/teacher", icon: Activity },
      { label: "My Classes", href: "/teacher/classes", icon: BookOpen },
    ],
  },
  STUDENT: {
    name: "Talabat Portal",
    color: "student-primary",
    gradient: UNIFIED_GRADIENT,
    logoVariant: "student",
    icon: Star,
    navItems: [
      { label: "Dashboard", href: "/talabat", icon: Activity },
      { label: "Attendance", href: "/talabat/attendance", icon: Clock },
      { label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays },
      { label: "Library", href: "/talabat/library", icon: BookOpen },
      { label: "Profile", href: "/talabat/profile", icon: User },
      { label: "Badges", href: "/talabat/badges", icon: Shield },
      { label: "Skill Tree", href: "/talabat/skill-tree", icon: BarChart3 },
      { label: "Hifz", href: "/talabat/hifz", icon: BookOpen },
    ],
  },
  PARENT: {
    name: "Parent Portal",
    color: "parent-primary",
    gradient: UNIFIED_GRADIENT,
    logoVariant: "parent",
    icon: Heart,
    navItems: [
      { label: "Dashboard", href: "/parent", icon: Activity },
      { label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays },
      { label: "Activity", href: "/parent/activity", icon: Clock },
      { label: "Hifz Reports", href: "/parent/hifz", icon: BookOpen },
    ],
  },
};

export function NavigationBar() {
  const { data: session } = useSession();
  const { isModuleVisible } = usePortalAccess();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Close the overflow menu whenever the route changes
  useEffect(() => {
    setMoreMenuOpen(false);
  }, [pathname]);

  if (!session?.user) return null;

  const role = session.user.role as string;
  const config = portalConfig[role];
  const isAdmin = role === "ADMIN";
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT";
  const isParent = role === "PARENT";

  // Build teacher nav items dynamically based on Admin assigned pages & module visibility
  const teacherNavItems = isTeacher
    ? [
        { label: "Dashboard", href: "/teacher", icon: Activity },
        ...(isModuleVisible("classes", "TEACHER") ? [{ label: "Classes", href: "/teacher/classes", icon: BookOpen }] : []),
        ...(isModuleVisible("quran", "TEACHER") ? [{ label: "Quran (Hifz)", href: "/teacher/hifz", icon: FileText }] : []),
        ...(isModuleVisible("takhteet", "TEACHER") ? [{ label: "Takhteet", href: "/teacher/takhteet", icon: Layers }] : []),
        ...(isModuleVisible("attendance-logs", "TEACHER") ? [{ label: "Attendance Logs", href: "/admin/attendance-logs", icon: FileText }] : []),
        ...(isModuleVisible("attendance-schedule", "TEACHER") ? [{ label: "Attendance Schedule", href: "/admin/attendance-schedule", icon: Clock }] : []),
        ...(isModuleVisible("email-reports", "TEACHER") ? [{ label: "Email Reports", href: "/admin/attendance-emails", icon: FileSpreadsheet }] : []),
        ...(isModuleVisible("leave", "TEACHER") ? [{ label: "Leave", href: "/admin/leave", icon: UserCheck }] : []),
        ...(isModuleVisible("procurement", "TEACHER") ? [{ label: "Procurement", href: "/admin/procurement", icon: Package }] : []),
        ...(isModuleVisible("makhzan", "TEACHER") ? [{ label: "Makhzan", href: "/admin/library", icon: Package }] : []),
        ...(isModuleVisible("library", "TEACHER") ? [{ label: "Library", href: "/admin/library", icon: Library }] : []),
        { label: "Profile", href: "/teacher/profile", icon: User },
      ]
    : config?.navItems;

  // Constrain the top bar to the most important items; the rest live in a "More" menu
  const MAX_VISIBLE_NAV = 6;
  const allNavItemsRaw = isTeacher ? teacherNavItems : config?.navItems;
  // Locked modules must not appear — same rule as PortalShell.
  const moduleKeyForHref = (href: string): string | null => {
    if (href === "/teacher" || href === "/talabat") return "dashboard";
    if (href === "/fatimi-calendar") return "calendar";
    if (href === "/faculty/attendance") return "faculty";
    if (href === "/talabat/scans") return "scans";
    if (href === "/talabat/skill-tree") return "skillTree";
    if (href === "/talabat/library") return "library";
    if (href === "/talabat/badges") return "badges";
    if (href === "/talabat/hifz") return "hifz";
    if (href === "/talabat/attendance") return "attendance";
    if (href === "/talabat/profile") return "profile";
    if (href === "/teacher/classes") return "classes";
    if (href === "/admin/attendance-logs" || href === "/teacher/attendance") return "attendance-logs";
    if (href === "/admin/attendance-schedule") return "attendance-schedule";
    if (href === "/admin/attendance-emails") return "email-reports";
    if (href === "/admin/leave" || href === "/teacher/leave") return "leave";
    if (href === "/admin/procurement" || href === "/teacher/procurement") return "procurement";
    if (href === "/teacher/takhteet") return "takhteet";
    if (href === "/teacher/hifz" || href === "/teacher/hifz-reports") return "quran";
    if (href === "/teacher/profile") return "profile";
    return null;
  };
  const allNavItems = allNavItemsRaw?.filter((item) => {
    if (role !== "TEACHER" && role !== "STUDENT") return true;
    const k = moduleKeyForHref(item.href);
    return !k || isModuleVisible(k, role);
  });
  const navHasOverflow = (allNavItems?.length ?? 0) > MAX_VISIBLE_NAV;
  const visibleNavItems = navHasOverflow ? allNavItems!.slice(0, MAX_VISIBLE_NAV) : allNavItems;
  const overflowNavItems = navHasOverflow ? allNavItems!.slice(MAX_VISIBLE_NAV) : [];

  // STUDENT lives at /talabat, not /student — map role homes honestly.
  const roleHome = role === "STUDENT" ? "/talabat" : `/${role.toLowerCase()}`;
  const isNavActive = (href: string) =>
    pathname === href || (href !== roleHome && pathname.startsWith(href));

  // Single unified palette — one visual language across all roles.
  // (Previously four identical if/else branches; collapsed honestly.)
  const roleColors = {
    bg: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    hover: "hover:bg-emerald-50 hover:text-emerald-600",
    ring: "focus-visible:ring-emerald-500",
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Role Badge */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 shrink-0 group"
            >
              <div className="relative w-9 h-9">
                <div
                  className={`absolute inset-0 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${config?.gradient || "from-darse-burhani-500 to-emerald-700"}`}
                />
                <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden bg-gradient-to-br ${config?.gradient || "from-darse-burhani-500 to-emerald-700"}`}
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                >
                  <FatimiLogo size={24} variant={config?.logoVariant || "gold"} />
                </div>
              </div>
              <span className="font-display font-bold text-lg text-gray-900 hidden sm:block" style={{ letterSpacing: '-0.02em' }}>
                Darse Burhani
              </span>
            </Link>
            <Badge
              variant="secondary"
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 ${roleColors.bg}`}
            >
              {config && <config.icon className="w-3 h-3" />}
              {config?.name}
            </Badge>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {visibleNavItems?.map((item) => {
              const isActive = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? `${roleColors.active} shadow-sm`
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      "bg-[#d4af37]"
                    )} />
                  )}
                </Link>
              );
            })}

            {/* Overflow "More" menu */}
            {overflowNavItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setMoreMenuOpen((open) => !open);
                    setProfileMenuOpen(false);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={moreMenuOpen}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    overflowNavItems.some((i) => isNavActive(i.href))
                      ? `${roleColors.active} shadow-sm`
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  More
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", moreMenuOpen && "rotate-180")} />
                </button>

                {moreMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl border border-gray-100 shadow-xl z-50 py-1.5 animate-fade-in">
                      <p className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-50">
                        More Options
                      </p>
                      <div className="px-2 pt-1">
                        {overflowNavItems.map((item) => {
                          const isActive = isNavActive(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMoreMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors",
                                isActive
                                  ? `${roleColors.active} shadow-sm`
                                  : "hover:bg-gray-50",
                              )}
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                              {isActive && (
                                <span className={cn(
                                  "ml-auto w-1.5 h-1.5 rounded-full",
                                  "bg-[#d4af37]"
                                )} />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationBell />

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileMenuOpen(!profileMenuOpen);
                  setMoreMenuOpen(false);
                }}
                className={`flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-all ${roleColors.ring}`}
              >
                <Avatar className="w-8 h-8 ring-2 ring-white shadow-sm">
                  {session.user.avatarUrl && (
                    <AvatarImage src={session.user.avatarUrl} alt={`${session.user.firstName} ${session.user.lastName}`} />
                  )}
                  <AvatarFallback
                    className={`bg-gradient-to-br ${
                      config?.gradient ?? "from-gray-400 to-gray-600"
                    } text-white`}
                  >
                    {getInitials(
                      session.user.firstName,
                      session.user.lastName,
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900 leading-tight">
                    {session.user.firstName} {session.user.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{role === "STUDENT" ? "Talabat" : role.toLowerCase()}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-gray-100 shadow-xl z-50 py-1.5 animate-fade-in">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {session.user.firstName} {session.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {session.user.email}
                      </p>
                    </div>

                    {/* Portal-specific quick links */}
                    <div className="px-2 py-1.5 border-b border-gray-50">
                      <p className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Quick Links
                      </p>
                      {isAdmin && (
                        <>
                          <Link
                            href="/admin/tracking"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <BarChart3 className="w-4 h-4 text-emerald-500" />
                            Individual Tracking
                          </Link>
                          <Link
                            href="/admin/users"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <Users className="w-4 h-4 text-emerald-500" />
                            User Management
                          </Link>
                        </>
                      )}
                      {isTeacher && (
                        <>
                          {isModuleVisible("profile", "TEACHER") && (
                          <Link
                            href="/teacher/profile"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <User className="w-4 h-4 text-emerald-500" />
                            My Profile
                          </Link>
                          )}
                          {isModuleVisible("classes", "TEACHER") && (
                          <Link
                            href="/teacher/classes"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <BookOpen className="w-4 h-4 text-emerald-500" />
                            My Classes
                          </Link>
                          )}
                        </>
                      )}
                      {isParent && (
                        <>
                          <Link
                            href="/parent/activity"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <Activity className="w-4 h-4 text-emerald-500" />
                            Activity History
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="px-2 py-1">
                      <Link
                        href={`${roleHome}/settings`}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
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

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-lg animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {allNavItems?.map((item) => {
              const isActive = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? `${roleColors.active} shadow-sm`
                      : "text-gray-600 hover:bg-gray-50",
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <span className={cn(
                      "ml-auto w-1.5 h-1.5 rounded-full",
                      "bg-[#d4af37]"
                    )} />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Mobile profile section */}
          <div className="border-t border-gray-50 px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback
                  className={`bg-gradient-to-br ${config?.gradient ?? "from-gray-400 to-gray-600"} text-white`}
                >
                  {getInitials(session.user.firstName, session.user.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {session.user.firstName} {session.user.lastName}
                </p>
                <p className="text-xs text-gray-500">{role === "STUDENT" ? "Talabat" : role.toLowerCase()}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export function getPortalConfig(role: string) {
  return portalConfig[role];
}

