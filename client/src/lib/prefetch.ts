// ── Intelligent Client-Side Route & Asset Prefetching Engine ──

type RouteImporter = () => Promise<unknown>;

const routeRegistry: Record<string, RouteImporter> = {
  // Public
  "/login": () => import("@/app/login/page"),
  "/fatimi-calendar": () => import("@/app/fatimi-calendar/page"),
  "/notifications": () => import("@/app/notifications/page"),
  "/terms": () => import("@/app/terms/page"),
  "/privacy": () => import("@/app/privacy/page"),

  // Admin
  "/admin": () => import("@/app/admin/page"),
  "/admin/attendance-schedule": () => import("@/app/admin/attendance-schedule/page"),
  "/admin/manual-attendance": () => import("@/app/admin/manual-attendance/page"),
  "/admin/attendance-logs": () => import("@/app/admin/attendance-logs/page"),
  "/admin/biometric": () => import("@/app/admin/biometric/page"),
  "/admin/attendance-emails": () => import("@/app/admin/attendance-emails/page"),
  "/admin/security": () => import("@/app/admin/security/page"),
  "/admin/classes": () => import("@/app/admin/classes/page"),
  "/admin/timetable": () => import("@/app/admin/timetable/page"),
  "/admin/students": () => import("@/app/admin/students/page"),
  "/admin/users": () => import("@/app/admin/users/page"),
  "/admin/parents": () => import("@/app/admin/parents/page"),
  "/admin/hifz": () => import("@/app/admin/hifz/page"),
  "/admin/hifz-marhala": () => import("@/app/admin/hifz-marhala/page"),
  "/admin/library": () => import("@/app/admin/library/page"),
  "/admin/library/overview": () => import("@/app/admin/library/overview/page"),
  "/admin/leave": () => import("@/app/admin/leave/page"),
  "/admin/tracking": () => import("@/app/admin/tracking/page"),
  "/admin/settings": () => import("@/app/admin/settings/page"),

  // Talabat (Student)
  "/talabat": () => import("@/app/talabat/page"),
  "/talabat/attendance": () => import("@/app/talabat/attendance/page"),
  "/talabat/scans": () => import("@/app/talabat/scans/page"),
  "/talabat/hifz": () => import("@/app/talabat/hifz/page"),
  "/talabat/hifz-marhala": () => import("@/app/talabat/hifz-marhala/page"),
  "/talabat/badges": () => import("@/app/talabat/badges/page"),
  "/talabat/library": () => import("@/app/talabat/library/page"),
  "/talabat/profile": () => import("@/app/talabat/profile/page"),
  "/talabat/leave-request": () => import("@/app/talabat/leave-request/page"),

  // Teacher / Faculty
  "/teacher": () => import("@/app/teacher/page"),
  "/teacher/attendance": () => import("@/app/teacher/attendance/page"),
  "/teacher/classes": () => import("@/app/teacher/classes/page"),
  "/teacher/hifz": () => import("@/app/teacher/hifz/page"),
  "/teacher/hifz-marhala": () => import("@/app/teacher/hifz-marhala/page"),
  "/teacher/hifz-weekly-slip": () => import("@/app/teacher/hifz-weekly-slip/page"),
  "/teacher/leave": () => import("@/app/teacher/leave/page"),
  "/teacher/profile": () => import("@/app/teacher/profile/page"),
  "/teacher/settings": () => import("@/app/teacher/settings/page"),
};

const prefetchedSet = new Set<string>();

/**
 * Prefetch a route dynamically in the background when the user hovers over a link.
 * Instant zero-latency transition upon click!
 */
export function prefetchRoute(href: string): void {
  if (!href || typeof href !== "string") return;
  const path = href.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";

  if (prefetchedSet.has(path)) return;

  const importer = routeRegistry[path];
  if (importer) {
    prefetchedSet.add(path);
    // Request idle callback or microtask to avoid competing with main thread rendering
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => {
        importer().catch(() => {});
      });
    } else {
      setTimeout(() => {
        importer().catch(() => {});
      }, 50);
    }
  }
}

/** Alias for backward compatibility */
export const prefetchRouteChunk = prefetchRoute;

