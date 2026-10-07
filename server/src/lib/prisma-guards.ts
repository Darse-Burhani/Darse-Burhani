import type { Request, Response, NextFunction } from "express";
import prisma from "./prisma";

const MIGRATION_MESSAGE =
  "Database update pending: the new skills tables are missing. Run 'npx prisma migrate deploy' on the server, then rebuild and restart.";

/**
 * True when the Prisma error means a table from a not-yet-applied
 * migration was queried (P2021) or the generated client predates it.
 */
export function isMissingTableError(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  if (code === "P2021") return true;
  const msg = String((e as { message?: unknown })?.message || "");
  return (
    /does not exist/i.test(msg) &&
    /assignment|student_hobb|skill_assessment/i.test(msg)
  );
}

function tablesReady(): boolean {
  const p = prisma as unknown as Record<string, unknown>;
  return Boolean(
    p.assignment && p.assignmentGrade && p.skillAssessmentAttempt && p.studentHobby
  );
}

/** 503 when the generated Prisma client predates the skills migration. */
export function requireMigratedTables(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!tablesReady()) {
    res.status(503).json({
      success: false,
      code: "MIGRATION_PENDING",
      error: MIGRATION_MESSAGE,
    });
    return;
  }
  next();
}

/** Maps a caught DB error to 503 (migration pending) or 500. */
export function sendDbError(
  res: Response,
  error: unknown,
  context: string,
  fallback: string,
  status = 500
): Response {
  if (isMissingTableError(error)) {
    console.error(
      `${context}: skills tables missing — migration not applied.`,
      (error as Error)?.message
    );
    return res.status(503).json({
      success: false,
      code: "MIGRATION_PENDING",
      error: MIGRATION_MESSAGE,
    });
  }
  console.error(`${context}:`, error);
  return res.status(status).json({ success: false, error: fallback });
}
