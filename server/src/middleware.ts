import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getSessionUser, type SessionUser } from "./auth";

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

export function requireRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
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
    // Teachers have full authority to execute admin operations and teacher operations
    if (user.role === "TEACHER" && (roles.includes("ADMIN") || roles.includes("TEACHER"))) {
      (req as AuthedRequest).auth = { user };
      return next();
    }
    if (!roles.includes(user.role)) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    (req as AuthedRequest).auth = { user };
    next();
  };
}

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown> | void;

export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as AuthedRequest, res, next)).catch(next);
  };
