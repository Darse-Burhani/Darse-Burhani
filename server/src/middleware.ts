import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getSessionUser, type SessionUser } from "./auth";
import prisma from "./lib/prisma";
import { cache } from "./lib/cache";
import { toAssignedPageIds, normalizeCanonicalPageId } from "./routes/admin/portal-assignments";

declare global {
  namespace Express {
    interface Request {
      auth?: { user: SessionUser };
    }
  }
}

export interface AuthedRequest extends Request {
  auth?: { user: SessionUser };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).auth = { user };
  next();
}

/**
 * Maps request URL / base route to canonical portal page ID(s)
 */
export function getRouteRequiredPages(req: Request): string[] {
  const url = (req.originalUrl || req.baseUrl || req.path || "").toLowerCase();

  if (url.includes("/api/admin/users") || url.includes("/api/users")) return ["users", "passwords"];
  if (url.includes("/api/admin/students") || url.includes("/api/teacher/students") || url.includes("/api/students")) return ["students"];
  if (url.includes("/api/admin/parents") || url.includes("/api/admin/parent-student-links") || url.includes("/api/parents")) return ["parents"];
  if (url.includes("/api/admin/classes") || url.includes("/api/teacher/classes") || url.includes("/api/classes")) return ["classes"];
  if (url.includes("/api/admin/timetable") || url.includes("/api/timetable")) return ["timetable"];
  if (url.includes("/api/admin/point-rules") || url.includes("/api/points")) return ["point-matrix"];
  if (url.includes("/api/admin/notifications") || url.includes("/api/notifications")) return ["notifications"];
  if (url.includes("/api/admin/portal-assignments")) return ["portal-assignments"];
  if (url.includes("/api/admin/takhteet") || url.includes("/api/teacher/takhteet") || url.includes("/api/takhteet")) return ["takhteet"];
  if (url.includes("/api/admin/hifz-marhala") || url.includes("/api/teacher/hifz-marhala")) return ["hifz-marhala", "quran"];
  if (url.includes("/api/admin/hifz") || url.includes("/api/teacher/hifz") || url.includes("/api/teacher/hifz-weekly-slip")) return ["quran", "hifz-marhala"];
  if (url.includes("/api/admin/library/shelves") || url.includes("/api/admin/makhz")) return ["makhzan", "library"];
  if (url.includes("/api/admin/library")) return ["library", "makhzan"];
  if (
    url.includes("/api/admin/tracking") ||
    url.includes("/api/admin/stats") ||
    url.includes("/api/admin/analytics") ||
    url.includes("/api/admin/monitoring") ||
    url.includes("/api/admin/activity") ||
    url.includes("/api/teacher/portfolio")
  )
    return ["tracking"];
  if (url.includes("/api/admin/security")) return ["security"];
  if (url.includes("/api/admin/leave") || url.includes("/api/teacher/leave") || url.includes("/api/leave")) return ["leave"];
  if (url.includes("/api/admin/attendance-schedule") || url.includes("/api/attendance/schedule") || url.includes("/api/admin/attendance/schedule"))
    return ["attendance-schedule", "attendance-logs", "manual-attendance"];
  if (url.includes("/api/admin/attendance-emails") || url.includes("/api/admin/attendance/email-reports") || url.includes("/api/attendance/email-reports"))
    return ["email-reports", "attendance-logs"];
  if (url.includes("/api/admin/attendance-logs") || url.includes("/api/admin/attendance-registry") || url.includes("/api/attendance/logs"))
    return ["attendance-logs", "manual-attendance"];
  if (url.includes("/api/admin/attendance/manual") || url.includes("/api/attendance/manual") || url.includes("/api/attendance"))
    return ["manual-attendance", "attendance-logs"];
  if (url.includes("/api/biometric")) return ["biometric", "attendance-logs"];
  if (url.includes("/api/procurement")) return ["procurement"];
  if (url.includes("/api/medical") || url.includes("/api/attendance/medical")) return ["medical-duty"];
  if (url.includes("/api/admin/profile-permissions") || url.includes("/api/portal-permissions")) return ["settings", "portal-assignments"];

  return [];
}

/**
 * Checks if a teacher has been assigned authority for a specific page or the current request.
 */
export async function hasTeacherPageAuthority(userId: string, reqOrPages: Request | string[] | string): Promise<boolean> {
  try {
    const cachedAssignments = await cache.getOrSet<string[]>(
      `teacher_assignments:${userId}`,
      async () => {
        const profile = await prisma.teacherProfile.findFirst({
          where: { OR: [{ userId }, { id: userId }] },
          include: { portalAssignments: { where: { isActive: true } } },
        });
        if (!profile) return [];
        return profile.portalAssignments.map((a) => a.portalType);
      },
      { ttl: 30_000, tags: ["permissions"] }
    );

    if (!cachedAssignments || cachedAssignments.length === 0) return false;
    if (cachedAssignments.includes("ALL") || cachedAssignments.includes("*")) return true;

    const assignedPages = new Set(toAssignedPageIds(cachedAssignments));

    let targetPages: string[] = [];
    if (typeof reqOrPages === "string") {
      targetPages = normalizeCanonicalPageId(reqOrPages);
    } else if (Array.isArray(reqOrPages)) {
      targetPages = reqOrPages.flatMap((p) => normalizeCanonicalPageId(p));
    } else {
      targetPages = getRouteRequiredPages(reqOrPages);
    }

    if (targetPages.length === 0) {
      return false;
    }

    return targetPages.some(
      (p) =>
        assignedPages.has(p) ||
        p === "dashboard" ||
        p === "profile" ||
        (p === "quran" && assignedPages.has("quran")) ||
        (p === "passwords" && assignedPages.has("users"))
    );
  } catch (err) {
    console.error("Error checking teacher page authority:", err);
    return false;
  }
}

export function requireRole(...roles: string[]): RequestHandler {
  return async (req, res, next) => {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    // Admin has universal authority across all endpoints
    if (user.role === "ADMIN") {
      (req as AuthedRequest).auth = { user };
      return next();
    }
    // Direct role match
    if (roles.includes(user.role)) {
      (req as AuthedRequest).auth = { user };
      return next();
    }
    // If endpoint requires ADMIN but caller is a TEACHER, verify teacher page authority
    if (user.role === "TEACHER" && roles.includes("ADMIN")) {
      const hasAuth = await hasTeacherPageAuthority(user.id, req);
      if (hasAuth) {
        (req as AuthedRequest).auth = { user };
        return next();
      }
    }
    res.status(403).json({ success: false, error: "Forbidden: Insufficient permissions for this feature" });
  };
}

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown> | void;

export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as AuthedRequest, res, next)).catch(next);
  };

