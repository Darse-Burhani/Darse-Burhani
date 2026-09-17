import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";

function getBcrypt(): any {
  return (bcrypt as any).default || bcrypt;
}

const compare = (s: string, hashStr: string): Promise<boolean> => getBcrypt().compare(s, hashStr);
const hash = (s: string, salt: number | string): Promise<string> => getBcrypt().hash(s, salt);

import prisma from "./lib/prisma";
import { logAuditEvent, getClientIp } from "./lib/security";

export type Role = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatarUrl: string | null;
}

export const COOKIE_NAME = "sis_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (seconds)

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("NEXTAUTH_SECRET is missing or too short (min 16 chars). Set it in .env");
  }
  return secret;
}

export function signSession(user: SessionUser): string {
  return jwt.sign({ ...user }, getSecret(), { expiresIn: SESSION_MAX_AGE });
}

export function getSessionUser(req: Request): SessionUser | null {
  let token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getSecret()) as SessionUser;
    if (!payload || !payload.id || !payload.role) return null;
    return {
      id: payload.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// ── Handlers ──

export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    await loginHandlerInner(req, res);
  } catch (error) {
    // Express 4 does not forward rejected promises from async handlers — an
    // unhandled rejection would crash the process (and vite-node would restart
    // it in a loop). Return a clean 500 instead so a transient DB outage doesn't
    // take the whole backend down (see other routes for the same convention).
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

/**
 * Normalise a name for fuzzy login matching:
 * - lowercase
 * - drop the "bhai" honorific token (students often omit it when typing)
 * - strip everything but letters/digits
 * e.g. "Burhanuddin bhai Mulla Mustafa bhai Pehelwan" -> "burhanuddinmullamustafapehelwan"
 */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bbhai\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

async function loginHandlerInner(req: Request, res: Response): Promise<void> {
  const { email: identifier, username, password, portalRole } = (req.body ?? {}) as {
    email?: string;
    username?: string;
    password?: string;
    portalRole?: string;
  };
  const loginId = (identifier ?? username ?? "").trim();
  if (!loginId || !password) {
    res.status(400).json({ success: false, error: "Name / ITS number / email and password are required" });
    return;
  }

  // Strict Admin Login Security Rule: Admin authentication strictly requires a verified email address
  if (portalRole === "ADMIN" && !loginId.includes("@")) {
    res.status(400).json({
      success: false,
      error: "Administrator login strictly requires a verified administrator email address.",
    });
    return;
  }

  const userSelect = {
    id: true,
    email: true,
    passwordHash: true,
    firstName: true,
    lastName: true,
    role: true,
    avatarUrl: true,
    isActive: true,
  } as const;

  interface LoginUser {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
  }

  // ── Flexible login matching (Email / ITS / Full Name with or without @darseburhani.edu) ──
  let user: LoginUser | null = null;
  let loginError: string | null = null;

  // 1. Direct email lookup (case-insensitive on user.email or teacherProfile.tEmail)
  if (loginId.includes("@")) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: loginId, mode: "insensitive" } },
          { teacherProfile: { tEmail: { equals: loginId, mode: "insensitive" } } },
        ],
      },
      select: userSelect,
    });
  }

  // 2. Direct ITS Number lookup (if loginId is digits or digits@domain)
  if (!user) {
    const rawId = loginId.includes("@") ? loginId.split("@")[0].trim() : loginId;
    if (/^\d+$/.test(rawId)) {
      const studentProfile = await prisma.studentProfile.findFirst({
        where: {
          OR: [
            { studentId: rawId },
            { its: rawId },
          ],
        },
        select: { user: { select: userSelect } },
      });
      if (studentProfile?.user) {
        user = studentProfile.user as LoginUser;
      } else {
        const teacherProfile = await prisma.teacherProfile.findFirst({
          where: {
            OR: [
              { employeeId: rawId },
              { its: rawId },
            ],
          },
          select: { user: { select: userSelect } },
        });
        user = (teacherProfile?.user as LoginUser | undefined) ?? null;
      }
    }
  }

  // 3. Name-based lookup (Full Name / First + Last / with or without @darseburhani.edu)
  // Optimized: pre-filter at DB level to avoid loading all students
  if (!user) {
    const rawName = loginId.includes("@") ? loginId.split("@")[0].trim() : loginId;
    const wanted = normalizeName(rawName);

    if (wanted.length >= 2) {
      const tokens = rawName.split(/\s+/).filter((t) => t.length >= 2 && !/^bhai$/i.test(t));
      const firstToken = tokens[0] || rawName.substring(0, 4);
      const students = await prisma.studentProfile.findMany({
        where: {
          user: {
            role: "STUDENT",
            isActive: true,
            OR: [
              { firstName: { contains: firstToken, mode: "insensitive" } },
              { lastName: { contains: firstToken, mode: "insensitive" } },
              { firstName: { contains: rawName.split(/\s+/)[0] || "", mode: "insensitive" } },
            ],
          },
        },
        take: 50,
        select: {
          user: {
            select: { ...userSelect, passwordHash: true },
          },
        },
      });

      // Priority 1: Full name match (with/without spaces/dots/bhai)
      const byFullName = students.filter((s) => {
        const full = `${s.user.firstName} ${s.user.lastName}`;
        return (
          normalizeName(full) === wanted ||
          normalizeName(`${s.user.firstName}${s.user.lastName}`) === wanted
        );
      });

      // Priority 2: First name + Surname (e.g. "Abdeali Calcuttawala" matching "Abdeali bhai Aliasgar bhai Calcuttawala")
      const byFirstAndSurname = byFullName.length === 0
        ? students.filter((s) => {
            const parts = `${s.user.firstName} ${s.user.lastName}`
              .split(" ")
              .filter(Boolean)
              .filter((x) => !/^bhai$/i.test(x));
            if (parts.length >= 2) {
              const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
              return normalizeName(firstLast) === wanted;
            }
            return false;
          })
        : [];

      // Priority 3: First name match (only if unique)
      const byFirstName = byFullName.length === 0 && byFirstAndSurname.length === 0
        ? students.filter((s) => normalizeName(s.user.firstName) === wanted)
        : [];

      const matches = byFullName.length > 0
        ? byFullName
        : byFirstAndSurname.length > 0
        ? byFirstAndSurname
        : byFirstName;

      if (matches.length === 1) {
        user = matches[0].user as LoginUser;
      } else if (matches.length > 1) {
        loginError = "Multiple talabat share this name — please use your full name, ITS number, or exact email.";
      }
    }
  }

  if (loginError) {
    res.status(401).json({ success: false, error: loginError });
    return;
  }

  if (!user || !user.isActive) {
    const isAdminAttempt = portalRole === "ADMIN";
    logAuditEvent({
      action: isAdminAttempt ? "ADMIN_LOGIN_FAILED" : "LOGIN_FAILED",
      category: "AUTH",
      severity: isAdminAttempt ? "CRITICAL" : "WARN",
      status: "FAILED",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      details: { identifier: loginId, reason: !user ? "User not found" : "User inactive", portalRole },
    });
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  // Strict Admin Portal Authorization Rule: Non-admin users cannot authenticate via Admin Portal
  if (portalRole === "ADMIN" && user.role !== "ADMIN") {
    logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      action: "ADMIN_LOGIN_UNAUTHORIZED",
      category: "SECURITY",
      severity: "CRITICAL",
      status: "BLOCKED",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      details: {
        reason: "Non-admin user attempted to authenticate via Admin Portal",
        actualRole: user.role,
        requestedPortal: portalRole,
      },
    });
    res.status(403).json({
      success: false,
      error: "Access Denied: Strict Administrator privileges required. Non-admin accounts are prohibited from logging into the Admin Portal.",
    });
    return;
  }

  const isPasswordValid = await compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const isAdminAccount = user.role === "ADMIN" || portalRole === "ADMIN";
    logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      action: isAdminAccount ? "ADMIN_PASSWORD_FAILED" : "LOGIN_FAILED",
      category: "AUTH",
      severity: isAdminAccount ? "CRITICAL" : "WARN",
      status: "FAILED",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      details: { reason: "Incorrect password", portalRole },
    });
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as Role,
    avatarUrl: user.avatarUrl,
  };

  logAuditEvent({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    userRole: user.role,
    action: "LOGIN_SUCCESS",
    category: "AUTH",
    severity: "INFO",
    status: "SUCCESS",
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"],
  });

  setSessionCookie(res, signSession(sessionUser));
  res.json({ success: true, data: { user: sessionUser } });
}

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  try {
    await changePasswordHandlerInner(req, res);
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

async function changePasswordHandlerInner(req: Request, res: Response): Promise<void> {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const { currentPassword, newPassword } = (req.body ?? {}) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: "Current and new password are required" });
    return;
  }
  if (newPassword.trim().length < 8) {
    res.status(400).json({ success: false, error: "New password must be at least 8 characters (include 1 number & 1 letter)" });
    return;
  }
  if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
    res.status(400).json({ success: false, error: "Password must contain at least 1 letter and 1 number" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  const isPasswordValid = await compare(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    logAuditEvent({
      userId: sessionUser.id,
      userEmail: sessionUser.email,
      userName: `${sessionUser.firstName} ${sessionUser.lastName}`,
      userRole: sessionUser.role,
      action: "PASSWORD_CHANGE_FAILED",
      category: "AUTH",
      severity: "WARN",
      status: "FAILED",
      ipAddress: getClientIp(req),
      details: { reason: "Incorrect current password" },
    });
    res.status(401).json({ success: false, error: "Current password is incorrect" });
    return;
  }

  const newPasswordHash = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      passwordHash: newPasswordHash,
      plainPassword: newPassword,
    },
  });

  logAuditEvent({
    userId: sessionUser.id,
    userEmail: sessionUser.email,
    userName: `${sessionUser.firstName} ${sessionUser.lastName}`,
    userRole: sessionUser.role,
    action: "PASSWORD_CHANGED",
    category: "AUTH",
    severity: "INFO",
    status: "SUCCESS",
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, data: { message: "Password updated" } });
}

export async function sessionHandler(req: Request, res: Response): Promise<void> {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      res.json({ success: true, data: null });
      return;
    }

    try {
      // Re-read the user from the database so name/avatar/role always match
      // the latest data instead of the stale claims frozen in the session cookie.
      const fresh = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
          isActive: true,
        },
      });

      if (!fresh || !fresh.isActive) {
        res.json({ success: true, data: null });
        return;
      }

      const user: SessionUser = {
        id: fresh.id,
        email: fresh.email,
        firstName: fresh.firstName,
        lastName: fresh.lastName,
        role: fresh.role as Role,
        avatarUrl: fresh.avatarUrl,
      };
      res.json({ success: true, data: { user } });
    } catch (error) {
      console.error("Session database fetch error:", error);
      // Fall back to cookie claims if database is temporarily unavailable
      res.json({ success: true, data: { user: sessionUser } });
    }
  } catch (error) {
    console.error("Session handler error:", error);
    res.json({ success: true, data: null });
  }
}

export function logoutHandler(_req: Request, res: Response): void {
  clearSessionCookie(res);
  res.json({ success: true });
}
