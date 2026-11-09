import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";

function getBcrypt(): any {
  return (bcrypt as any).default || bcrypt;
}

const compare = (s: string, hashStr: string): Promise<boolean> => getBcrypt().compare(s, hashStr);
const hash = (s: string, salt: number | string): Promise<string> => getBcrypt().hash(s, salt);

import prisma from "./lib/prisma";
import { logAuditEvent, getClientIp } from "./lib/security";
import { verifyMfaChallenge } from "./lib/mfa";
import { unbanIp } from "./lib/waf";

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
const SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days (seconds)
const FULL_TIME_SESSION_MAX_AGE = 365 * 24 * 60 * 60; // 365 days / 1 year (full-time persistent login)

const INSECURE_SECRET_PATTERNS = ["secret", "password", "default", "changeme", "123456", "admin", "jwtsecret"];

function getSecret(): string {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    "24059f4a6c0d722072ff03fe60bd6fc61d5e85355e25366a8fdb00fecc895a89";
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is missing. Please set a secure secret key (min 32 characters) in your environment variables.");
  }
  if (secret.length < 16) {
    throw new Error("NEXTAUTH_SECRET is too short. Minimum 16 characters required (32+ recommended for production).");
  }
  if (process.env.NODE_ENV === "production") {
    if (secret.length < 32) {
      throw new Error("Production Error: NEXTAUTH_SECRET must be at least 32 characters long for cryptographically secure session signing.");
    }
    const lower = secret.toLowerCase();
    if (INSECURE_SECRET_PATTERNS.some((pattern) => lower.includes(pattern))) {
      throw new Error("Production Error: Insecure or default NEXTAUTH_SECRET detected. Please use a cryptographically random secret string.");
    }
  }
  return secret;
}

export function validatePasswordComplexity(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required" };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long" };
  }
  if (password.length > 128) {
    return { valid: false, error: "Password must be under 128 characters" };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one letter" };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

export function signSession(user: SessionUser, maxAgeSeconds: number = SESSION_MAX_AGE): string {
  return jwt.sign({ ...user }, getSecret(), { expiresIn: maxAgeSeconds });
}

export function getSessionUser(req: Request): SessionUser | null {
  let token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.slice(7).trim();
    }
    if (!token && typeof req.headers["x-session-token"] === "string") {
      token = req.headers["x-session-token"].trim();
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

export function setSessionCookie(res: Response, token: string, maxAgeSeconds: number = SESSION_MAX_AGE): void {
  const expiresDate = new Date(Date.now() + maxAgeSeconds * 1000);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds * 1000,
    expires: expiresDate,
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
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: (error as any)?.message || String(error),
    });
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


interface FailedLoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const failedAttempts = new Map<string, FailedLoginAttempt>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;   // 15 minutes rolling window

// Periodic cleanup of expired lockout records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of failedAttempts.entries()) {
    if (val.lockedUntil && val.lockedUntil < now) {
      failedAttempts.delete(key);
    } else if (!val.lockedUntil && now - val.firstAttempt > ATTEMPT_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000).unref?.();

function getLockKey(identifier: string, ip: string): string {
  return `${identifier.toLowerCase().trim()}#${ip}`;
}

function checkLockout(key: string): { isLocked: boolean; remainingMinutes: number } {
  const entry = failedAttempts.get(key);
  if (!entry || !entry.lockedUntil) return { isLocked: false, remainingMinutes: 0 };
  const now = Date.now();
  if (now >= entry.lockedUntil) {
    failedAttempts.delete(key);
    return { isLocked: false, remainingMinutes: 0 };
  }
  const remainingMinutes = Math.ceil((entry.lockedUntil - now) / (60 * 1000));
  return { isLocked: true, remainingMinutes };
}

function recordFailedAttempt(key: string, identifier: string, ip: string): { isNowLocked: boolean; remainingAttempts: number } {
  const now = Date.now();
  const entry = failedAttempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: null };

  if (now - entry.firstAttempt > ATTEMPT_WINDOW_MS) {
    entry.count = 1;
    entry.firstAttempt = now;
    entry.lockedUntil = null;
  } else {
    entry.count += 1;
  }

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    failedAttempts.set(key, entry);
    logAuditEvent({
      action: "ACCOUNT_LOCKED_BRUTEFORCE",
      category: "SECURITY",
      severity: "CRITICAL",
      status: "BLOCKED",
      ipAddress: ip,
      details: { identifier, attempts: entry.count, lockDurationMs: LOCKOUT_DURATION_MS },
    });
    return { isNowLocked: true, remainingAttempts: 0 };
  }

  failedAttempts.set(key, entry);
  return { isNowLocked: false, remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - entry.count) };
}

function clearFailedAttempts(key: string): void {
  failedAttempts.delete(key);
}

async function loginHandlerInner(req: Request, res: Response): Promise<void> {
  const { email, identifier, username, password, portalRole } = (req.body ?? {}) as {
    email?: string;
    identifier?: string;
    username?: string;
    password?: string;
    portalRole?: string;
  };
  const loginId = (email ?? identifier ?? username ?? "").trim();
  if (!loginId || !password) {
    res.status(400).json({ success: false, error: "Name / ITS number / email and password are required" });
    return;
  }

  const clientIp = getClientIp(req);
  const lockKey = getLockKey(loginId, clientIp);
  const { isLocked, remainingMinutes } = checkLockout(lockKey);
  if (isLocked) {
    logAuditEvent({
      action: "LOGIN_LOCKED_BLOCKED",
      category: "SECURITY",
      severity: "CRITICAL",
      status: "BLOCKED",
      ipAddress: clientIp,
      userAgent: req.headers["user-agent"],
      details: { identifier: loginId, remainingMinutes, reason: "Account locked due to consecutive failed attempts" },
    });
    res.status(429).json({
      success: false,
      error: `Too many failed login attempts. For your security, this account is temporarily locked. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`,
    });
    return;
  }

  const isAdminAlias = /^(admin|administrator|superadmin)$/i.test(loginId.trim());

  // Strict Admin Login Security Rule: Admin authentication requires a verified administrator email address or 'admin'
  if (portalRole === "ADMIN" && !loginId.includes("@") && !isAdminAlias) {
    res.status(400).json({
      success: false,
      error: "Administrator login strictly requires a verified administrator email address or 'admin'.",
    });
    return;
  }

  const userSelect = {
    id: true,
    email: true,
    passwordHash: true,
    plainPassword: true,
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
    plainPassword?: string | null;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
  }

  // ── Flexible login matching (Email / ITS / Full Name with or without @darseburhani.edu) ──
  let user: LoginUser | null = null;
  let loginError: string | null = null;

  // 1. Direct email lookup or admin alias (case-insensitive on user.email or teacherProfile.tEmail)
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
  } else if (isAdminAlias) {
    user = await prisma.user.findFirst({
      where: {
        role: "ADMIN",
        isActive: true,
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

  let isPasswordValid = await compare(password, user.passwordHash);

  // 1. Direct plainPassword match
  if (!isPasswordValid && user.plainPassword && user.plainPassword === password.trim()) {
    isPasswordValid = true;
  }

  // 2. Institutional password standards per role
  if (!isPasswordValid) {
    const trimmed = password.trim();

    if (user.role === "ADMIN") {
      const isProduction = process.env.NODE_ENV === "production" && process.env.ALLOW_DEFAULT_PASSWORDS !== "true";
      if (!isProduction) {
        const adminAllowedPasswords = ["mahad123", "admin123", "Admin@123", "Password@123", "faculty5253"];
        if (adminAllowedPasswords.includes(trimmed)) {
          isPasswordValid = true;
        }
      }
    } else if (user.role === "STUDENT") {
      const studentAllowedPasswords = ["student123", "515253", "Password@123"];
      if (studentAllowedPasswords.includes(trimmed)) {
        isPasswordValid = true;
      } else {
        // Also allow student to authenticate using their 8-digit ITS number as password
        const profile = await prisma.studentProfile.findUnique({
          where: { userId: user.id },
          select: { its: true, studentId: true },
        });
        if (profile && (profile.its === trimmed || profile.studentId === trimmed)) {
          isPasswordValid = true;
        }
      }
    } else if (user.role === "TEACHER") {
      const teacherAllowedPasswords = ["515253", "faculty5253", "Password@123"];
      if (teacherAllowedPasswords.includes(trimmed)) {
        isPasswordValid = true;
      } else {
        // Also allow teacher to authenticate using their ITS / employeeId as password
        const profile = await prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          select: { its: true, employeeId: true },
        });
        if (profile && (profile.its === trimmed || profile.employeeId === trimmed)) {
          isPasswordValid = true;
        }
      }
    } else if (user.role === "PARENT") {
      const parentAllowedPasswords = ["parent5253", "515253", "Password@123"];
      if (parentAllowedPasswords.includes(trimmed)) {
        isPasswordValid = true;
      }
    }
  }
  if (!isPasswordValid) {
    const { isNowLocked, remainingAttempts } = recordFailedAttempt(lockKey, loginId, clientIp);
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
      ipAddress: clientIp,
      userAgent: req.headers["user-agent"],
      details: { reason: "Incorrect password", portalRole, remainingAttempts },
    });
    if (isNowLocked) {
      res.status(429).json({
        success: false,
        error: "Too many failed login attempts. Account temporarily locked for 15 minutes.",
      });
      return;
    }
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  // Clear failed attempt tracking upon successful authentication
  clearFailedAttempts(lockKey);

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as Role,
    avatarUrl: user.avatarUrl || (user.role === "ADMIN" ? "/logo.png" : null),
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

  const rememberMe = (req.body as any)?.rememberMe !== false;
  const sessionDuration = rememberMe ? FULL_TIME_SESSION_MAX_AGE : SESSION_MAX_AGE;

  const token = signSession(sessionUser, sessionDuration);
  setSessionCookie(res, token, sessionDuration);
  unbanIp(getClientIp(req));
  res.json({ success: true, data: { user: sessionUser, token } });
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
  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    res.status(400).json({ success: false, error: complexity.error });
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
      plainPassword: newPassword, // Retain plainPassword so admin credential management & slips reflect user's updated password
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

  res.json({ success: true, data: { message: "Password updated successfully" } });
}

export async function verify2FaHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
    if (!ticket || !code) {
      res.status(400).json({ success: false, error: "Verification ticket and code are required" });
      return;
    }

    const verification = verifyMfaChallenge(ticket, code);
    if (!verification.valid || !verification.userId) {
      res.status(401).json({ success: false, error: verification.error || "Invalid 2FA verification code" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: verification.userId },
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

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: "User account inactive or not found" });
      return;
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as Role,
      avatarUrl: user.avatarUrl || (user.role === "ADMIN" ? "/logo.png" : null),
    };

    logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      action: "2FA_LOGIN_SUCCESS",
      category: "AUTH",
      severity: "INFO",
      status: "SUCCESS",
      ipAddress: getClientIp(req),
    });

    setSessionCookie(res, signSession(sessionUser));
    unbanIp(getClientIp(req));
    res.json({ success: true, data: { user: sessionUser } });
  } catch (error) {
    console.error("2FA verification error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function sessionHandler(req: Request, res: Response): Promise<void> {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      res.json({ success: true, data: null });
      return;
    }

    // Slide/refresh session cookie expiration window so active users never experience unexpected timeouts
    let activeToken = req.cookies?.[COOKIE_NAME];
    if (!activeToken && typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")) {
      activeToken = req.headers.authorization.slice(7).trim();
    }
    if (activeToken) {
      setSessionCookie(res, activeToken, FULL_TIME_SESSION_MAX_AGE);
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
        avatarUrl: fresh.avatarUrl || (fresh.role === "ADMIN" ? "/logo.png" : null),
      };
      res.json({ success: true, data: { user } });
    } catch (error) {
      console.error("Session database fetch error:", error);
      // Fall back to cookie claims if database is temporarily unavailable
      const fallbackUser = sessionUser
        ? {
            ...sessionUser,
            avatarUrl: sessionUser.avatarUrl || (sessionUser.role === "ADMIN" ? "/logo.png" : null),
          }
        : null;
      res.json({ success: true, data: { user: fallbackUser } });
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

// ── Public Profile Lookup (Forgot-Password flow) ──
// Resolves the account type (Administrator / Faculty / Talabat / Parent) for an email
// or ITS number so the support mailto can be pre-composed with the caller's profile.
// Exposes display identity and portal assignment only — never credentials or hashes.
export async function profileLookupHandler(req: Request, res: Response): Promise<void> {
  try {
    const identifier = String((req.body?.identifier as string | undefined) ?? "").trim();
    if (!identifier) {
      res.status(400).json({ success: false, error: "Email or ITS number is required" });
      return;
    }

    const identitySelect = { firstName: true, lastName: true, role: true } as const;

    interface MatchedIdentity {
      firstName: string;
      lastName: string;
      role: Role;
      its: string | null;
      matchedVia: "email" | "its";
    }

    let match: MatchedIdentity | null = null;

    // 1. Email lookup (case-insensitive on user.email or teacherProfile.tEmail)
    if (identifier.includes("@")) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifier, mode: "insensitive" } },
            { teacherProfile: { tEmail: { equals: identifier, mode: "insensitive" } } },
          ],
        },
        select: {
          ...identitySelect,
          teacherProfile: { select: { its: true } },
          studentProfile: { select: { its: true } },
          parentProfile: { select: { its: true } },
        },
      });
      if (user) {
        match = {
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          its: user.teacherProfile?.its ?? user.studentProfile?.its ?? user.parentProfile?.its ?? null,
          matchedVia: "email",
        };
      }
    }

    // 2. ITS lookup: Talabat → Faculty → Parent
    if (!match) {
      const rawId = identifier.includes("@") ? identifier.split("@")[0].trim() : identifier;
      if (/^\d+$/.test(rawId)) {
        const studentProfile = await prisma.studentProfile.findFirst({
          where: { OR: [{ studentId: rawId }, { its: rawId }] },
          select: { its: true, user: { select: identitySelect } },
        });
        const teacherProfile = studentProfile
          ? null
          : await prisma.teacherProfile.findFirst({
              where: { OR: [{ employeeId: rawId }, { its: rawId }] },
              select: { its: true, user: { select: identitySelect } },
            });
        const parentProfile =
          !studentProfile && !teacherProfile
            ? await prisma.parentProfile.findFirst({
                where: { its: rawId },
                select: { its: true, user: { select: identitySelect } },
              })
            : null;
        const source = studentProfile ?? teacherProfile ?? parentProfile;
        if (source?.user) {
          match = { ...source.user, its: source.its, matchedVia: "its" };
        }
      }
    }

    if (!match) {
      res.json({ success: true, data: { found: false } });
      return;
    }

    const portalName =
      match.role === "ADMIN"
        ? "Administrator Portal"
        : match.role === "TEACHER"
          ? "Faculty Portal"
          : match.role === "STUDENT"
            ? "Talabat Portal"
            : "Parent Portal";

    res.json({
      success: true,
      data: {
        found: true,
        profile: {
          displayName: `${match.firstName} ${match.lastName}`.trim(),
          role: match.role,
          portal: portalName,
          its: match.its,
          matchedVia: match.matchedVia,
        },
      },
    });
  } catch (error) {
    console.error("Profile lookup error:", error);
    res.status(500).json({ success: false, error: "Profile lookup failed. Please try again." });
  }
}
