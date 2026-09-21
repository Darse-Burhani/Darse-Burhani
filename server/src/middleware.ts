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
    // Strict role check: user's role must be explicitly listed in permitted roles
    if (roles.includes(user.role)) {
      (req as AuthedRequest).auth = { user };
      return next();
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
