import crypto from "node:crypto";
import prisma from "./prisma";
import { logAuditEvent } from "./security";

// In-memory store for pending MFA session challenges (expires in 5 minutes)
interface PendingMfaChallenge {
  userId: string;
  code: string;
  expiresAt: number;
  attempts: number;
  type: "EMAIL" | "TOTP";
}

const pendingMfaChallenges = new Map<string, PendingMfaChallenge>();

// Clean up expired challenges periodically
if (typeof setInterval !== "undefined") {
  const mfaCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, item] of pendingMfaChallenges.entries()) {
      if (now > item.expiresAt) {
        pendingMfaChallenges.delete(key);
      }
    }
  }, 60000);
  if (mfaCleanup.unref) mfaCleanup.unref();
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 */
export function generateSecureOtp(): string {
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

/**
 * Generate a set of 8-character alphanumeric backup recovery codes.
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Creates an MFA challenge ticket for an authenticating user.
 */
export function createMfaChallenge(userId: string, type: "EMAIL" | "TOTP" = "EMAIL"): { ticket: string; code: string } {
  const ticket = `mfa_${crypto.randomBytes(16).toString("hex")}`;
  const code = generateSecureOtp();
  pendingMfaChallenges.set(ticket, {
    userId,
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    attempts: 0,
    type,
  });
  return { ticket, code };
}

/**
 * Verifies a submitted MFA challenge code.
 */
export function verifyMfaChallenge(ticket: string, code: string): { valid: boolean; userId?: string; error?: string } {
  const challenge = pendingMfaChallenges.get(ticket);
  if (!challenge) {
    return { valid: false, error: "MFA challenge expired or invalid. Please sign in again." };
  }

  if (Date.now() > challenge.expiresAt) {
    pendingMfaChallenges.delete(ticket);
    return { valid: false, error: "Verification code has expired. Please sign in again." };
  }

  challenge.attempts += 1;
  if (challenge.attempts > 5) {
    pendingMfaChallenges.delete(ticket);
    return { valid: false, error: "Too many failed attempts. Please sign in again." };
  }

  // Constant-time string comparison to prevent timing attacks
  const inputBuffer = Buffer.from(code.trim());
  const expectedBuffer = Buffer.from(challenge.code.trim());

  if (inputBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(inputBuffer, expectedBuffer)) {
    return { valid: false, error: "Invalid verification code. Please check and try again." };
  }

  pendingMfaChallenges.delete(ticket);
  return { valid: true, userId: challenge.userId };
}
