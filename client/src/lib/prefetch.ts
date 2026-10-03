/**
 * High-Performance Client-Side Route Prefetch Engine
 * Warms dynamic import chunks for instant transitions.
 */

// Route-chunk prefetch registry (avoids duplicate dynamic imports).
const prefetchedRoutes = new Set<string>();

/**
 * Prefetch dynamic import chunk for a given route path.
 */
export function prefetchRouteChunk(path: string) {
  if (prefetchedRoutes.has(path)) return;
  prefetchedRoutes.add(path);

  // Match and dynamically import route chunks
  if (path.startsWith("/admin/attendance-logs")) {
    import("@/app/admin/attendance-logs/page");
  } else if (path.startsWith("/admin/classes")) {
    import("@/app/admin/classes/page");
  } else if (path.startsWith("/admin/timetable")) {
    import("@/app/admin/timetable/page");
  } else if (path.startsWith("/admin/hifz")) {
    import("@/app/admin/hifz/page");
  } else if (path.startsWith("/admin/library")) {
    import("@/app/admin/library/page");
  } else if (path.startsWith("/admin/users")) {
    import("@/app/admin/users/page");
  } else if (path.startsWith("/teacher")) {
    import("@/app/teacher/page");
  } else if (path.startsWith("/talabat")) {
    import("@/app/talabat/page");
  }
}
