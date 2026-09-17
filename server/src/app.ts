import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "node:url";
import { loginHandler, sessionHandler, logoutHandler, changePasswordHandler } from "./auth";

import pointsRoutes from "./routes/points";
import attendanceRoutes from "./routes/attendance";
import notificationsRoutes from "./routes/notifications";
import uploadRoutes from "./routes/upload";
import fatimiCalendarRoutes from "./routes/fatimi-calendar";
import biometricRoutes from "./routes/biometric";
import hikvisionRoutes from "./routes/hikvision";
import membersRoutes from "./routes/members";
import publicLibraryTvRoutes from "./routes/public/library-tv";
import procurementRoutes from "./routes/procurement";
import healthRoutes from "./lib/health";

// ── Admin routes ──
import adminClassesRoutes from "./routes/admin/classes";
import adminUsersRoutes from "./routes/admin/users";
import adminTimetableRoutes from "./routes/admin/timetable";
import adminPointRulesRoutes from "./routes/admin/point-rules";
import adminNotificationsRoutes from "./routes/admin/notifications";
import adminStatsRoutes from "./routes/admin/stats";
import adminStudentsRoutes from "./routes/admin/students";
import adminParentsRoutes from "./routes/admin/parents";
import adminParentStudentLinksRoutes from "./routes/admin/parent-student-links";
import adminPortalAssignmentsRoutes from "./routes/admin/portal-assignments";
import adminTakhteetRoutes from "./routes/admin/takhteet";
import adminMonitoringRoutes from "./routes/admin/monitoring";
import adminActivityRoutes from "./routes/admin/activity";
import adminHifzRoutes from "./routes/admin/hifz";
import adminHifzPublishRoutes from "./routes/admin/hifz/publish";
import adminHifzSendEmailsRoutes from "./routes/admin/hifz/send-emails";
import adminHifzImportRoutes from "./routes/admin/hifz/import";
import adminHifzMarhalaRoutes from "./routes/admin/hifz-marhala";
import adminLibraryRoutes from "./routes/admin/library";
import adminLibraryOverviewRoutes from "./routes/admin/library/overview";
import adminAnalyticsRoutes from "./routes/admin/analytics";
import adminLibraryStudentsRoutes from "./routes/admin/library/students";
import adminLibraryShelvesRoutes from "./routes/admin/library/shelves";
import adminLibraryReturnRoutes from "./routes/admin/library/return";
import adminLibraryOverdueRoutes from "./routes/admin/library/overdue";
import adminLibrarySendRemindersRoutes from "./routes/admin/library/overdue/send-reminders";
import adminLibraryHistoryRoutes from "./routes/admin/library/history";
import adminLibraryExportRoutes from "./routes/admin/library/export";
import adminLibraryCheckoutRoutes from "./routes/admin/library/checkout";
import adminLibraryBulkRoutes from "./routes/admin/library/bulk";
import adminLibraryAuditorRoutes from "./routes/admin/library/auditor";
import adminAttendanceEmailsRoutes from "./routes/admin/attendance-emails";
import adminAttendanceScheduleRoutes from "./routes/admin/attendance-schedule";
import adminProfilePermissionsRoutes from "./routes/admin/profile-permissions";
import adminTrackingRoutes from "./routes/admin/tracking";
import adminSecurityRoutes from "./routes/admin/security";
import adminLeaveRoutes from "./routes/admin/leave";
import adminAttendanceRegistryRoutes from "./routes/admin/attendance-registry";
import adminAttendanceLogsRoutes from "./routes/admin/attendance-logs";
import {
  securityHeadersMiddleware,
  sanitizeInputsMiddleware,
  requestTimeoutMiddleware,
  globalApiRateLimiter,
  createRateLimiter,
} from "./lib/security";

// ── Teacher routes ──
import teacherStudentsRoutes from "./routes/teacher/students";
import teacherPortfolioRoutes from "./routes/teacher/portfolio";
import teacherDashboardRoutes from "./routes/teacher/dashboard";
import teacherClassesRoutes from "./routes/teacher/classes";
import teacherJustificationsRoutes from "./routes/teacher/justifications";
import teacherTakhteetRoutes from "./routes/teacher/takhteet";
import teacherProfileRoutes from "./routes/teacher/profile";
import teacherLeaveRoutes from "./routes/teacher/leave";
import teacherHifzMarhalaRoutes from "./routes/teacher/hifz-marhala";
import teacherHifzWeeklySlipRoutes from "./routes/teacher/hifz-weekly-slip";

// ── Talabat (Student) routes ──
import talabatSkillTreeRoutes from "./routes/talabat/skill-tree";
import talabatBadgesRoutes from "./routes/talabat/badges";
import talabatProfileRoutes from "./routes/talabat/profile";
import talabatAttendanceRoutes from "./routes/talabat/attendance";
import talabatScansRoutes from "./routes/talabat/scans";
import talabatLibraryRoutes from "./routes/talabat/library";
import talabatDashboardRoutes from "./routes/talabat/dashboard";
import talabatHifzRoutes from "./routes/talabat/hifz";
import talabatLeaveRoutes from "./routes/talabat/leave";
import talabatHifzMarhalaRoutes from "./routes/talabat/hifz-marhala";

// ── Parent routes ──
import parentHifzRoutes from "./routes/parent/hifz";
import parentDashboardRoutes from "./routes/parent/dashboard";
import parentActivityRoutes from "./routes/parent/activity";
import parentProfileRoutes from "./routes/parent/profile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || path.join(repoRoot, "public", "uploads"));

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  // 1. Performance Compression Middleware (Gzip/Deflate for fast payload transport)
  app.use(
    compression({
      level: 6,
      threshold: 1024, // only compress responses > 1KB
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  // 2. Request Parsers with guarded limits
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // 3. Security Headers & Defense in Depth
  app.use(securityHeadersMiddleware);

  // 4. Input Sanitization (Blocks prototype pollution, null bytes, script tags)
  app.use(sanitizeInputsMiddleware);

  // 5. Static uploads with ETag caching
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      etag: true,
      lastModified: true,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  // 6. Health & Load Balancer Readiness Probe (exempt from rate limits)
  app.use("/api/health", healthRoutes);

  // Exempt auth session verification from rate limiter so client mounting / polling never gets blocked
  app.get("/api/auth/session", sessionHandler);

  // 7. Request Timeout Guard on API routes (30 seconds)
  app.use("/api", requestTimeoutMiddleware(30000));

  // 8. Global API Rate Limiter for load smoothing
  app.use("/api", globalApiRateLimiter);

  // ── Auth with rate limiting (20 attempts per minute) ──
  const authLimiter = createRateLimiter(60000, 20, "auth_login", { isAuthLockout: true });
  const passwordLimiter = createRateLimiter(60000, 10, "auth_password", { isAuthLockout: true });
  const adminLimiter = createRateLimiter(60000, 120, "admin_api");
  const uploadLimiter = createRateLimiter(60000, 60, "upload_api");

  app.post("/api/auth/login", authLimiter, loginHandler);
  app.post("/api/auth/logout", logoutHandler);
  app.post("/api/auth/change-password", passwordLimiter, changePasswordHandler);

  // Protect all admin APIs with dedicated rate limiter
  app.use("/api/admin", adminLimiter);
  app.use("/api/upload", uploadLimiter);

  // ── Top-level routes ──
  app.use("/api/points", pointsRoutes);
  app.use("/api/admin/attendance/schedule", adminAttendanceScheduleRoutes);
  app.use("/api/attendance/schedule", adminAttendanceScheduleRoutes);
  app.use("/api/admin/attendance/email-reports", adminAttendanceEmailsRoutes);
  app.use("/api/attendance/email-reports", adminAttendanceEmailsRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/fatimi-calendar", fatimiCalendarRoutes);
  app.use("/api/biometric", biometricRoutes);

  // Hikvision HTTP Event Listening — raw body parser
  app.use("/api/hikvision", express.raw({ type: () => true, limit: "15mb" }));
  app.use("/api/hikvision", hikvisionRoutes);

  // Fingerprint enrollment relayed from the local USB-reader bridge.
  app.use("/api/members", membersRoutes);
  app.use("/api/public/library-tv", publicLibraryTvRoutes);
  app.use("/api/procurement", procurementRoutes);

  // ── Admin routes ──
  app.use("/api/admin/classes", adminClassesRoutes);
  app.use("/api/admin/users", adminUsersRoutes);
  app.use("/api/admin/timetable", adminTimetableRoutes);
  app.use("/api/admin/point-rules", adminPointRulesRoutes);
  app.use("/api/admin/notifications", adminNotificationsRoutes);
  app.use("/api/admin/stats", adminStatsRoutes);
  app.use("/api/admin/students", adminStudentsRoutes);
  app.use("/api/admin/parents", adminParentsRoutes);
  app.use("/api/admin/parent-student-links", adminParentStudentLinksRoutes);
  app.use("/api/admin/profile-permissions", adminProfilePermissionsRoutes);
  app.use("/api/portal-permissions", adminProfilePermissionsRoutes);
  app.use("/api/admin/tracking", adminTrackingRoutes);
  app.use("/api/admin/portal-assignments", adminPortalAssignmentsRoutes);
  app.use("/api/admin/takhteet", adminTakhteetRoutes);
  app.use("/api/admin/monitoring", adminMonitoringRoutes);
  app.use("/api/admin/activity", adminActivityRoutes);
  app.use("/api/admin/analytics", adminAnalyticsRoutes);
  app.use("/api/admin/hifz", adminHifzRoutes);
  app.use("/api/admin/hifz/publish", adminHifzPublishRoutes);
  app.use("/api/admin/hifz/send-emails", adminHifzSendEmailsRoutes);
  app.use("/api/admin/hifz/import", adminHifzImportRoutes);
  app.use("/api/admin/hifz-marhala", adminHifzMarhalaRoutes);
  app.use("/api/admin/library/overview", adminLibraryOverviewRoutes);
  app.use("/api/admin/library", adminLibraryRoutes);
  app.use("/api/admin/library/students", adminLibraryStudentsRoutes);
  app.use("/api/admin/library/shelves", adminLibraryShelvesRoutes);
  app.use("/api/admin/library/return", adminLibraryReturnRoutes);
  app.use("/api/admin/library/overdue", adminLibraryOverdueRoutes);
  app.use("/api/admin/library/overdue/send-reminders", adminLibrarySendRemindersRoutes);
  app.use("/api/admin/library/history", adminLibraryHistoryRoutes);
  app.use("/api/admin/library/export", adminLibraryExportRoutes);
  app.use("/api/admin/library/checkout", adminLibraryCheckoutRoutes);
  app.use("/api/admin/library/bulk", adminLibraryBulkRoutes);
  app.use("/api/admin/library/auditor", adminLibraryAuditorRoutes);
  app.use("/api/admin/security", adminSecurityRoutes);
  app.use("/api/admin/leave", adminLeaveRoutes);
  app.use("/api/admin/attendance-registry", adminAttendanceRegistryRoutes);
  app.use("/api/admin/attendance-logs", adminAttendanceLogsRoutes);

  // ── Teacher routes ──
  app.use("/api/teacher/students", teacherStudentsRoutes);
  app.use("/api/teacher/portfolio", teacherPortfolioRoutes);
  app.use("/api/teacher/dashboard", teacherDashboardRoutes);
  app.use("/api/teacher/classes", teacherClassesRoutes);
  app.use("/api/teacher/attendance/justifications", teacherJustificationsRoutes);
  app.use("/api/teacher/takhteet", teacherTakhteetRoutes);
  app.use("/api/teacher/profile", teacherProfileRoutes);
  app.use("/api/teacher/leave", teacherLeaveRoutes);
  app.use("/api/teacher/hifz-marhala", teacherHifzMarhalaRoutes);
  app.use("/api/teacher/hifz-weekly-slip", teacherHifzWeeklySlipRoutes);

  // ── Talabat (Student) routes ──
  app.use("/api/talabat/skill-tree", talabatSkillTreeRoutes);
  app.use("/api/talabat/badges", talabatBadgesRoutes);
  app.use("/api/talabat/profile", talabatProfileRoutes);
  app.use("/api/talabat/attendance", talabatAttendanceRoutes);
  app.use("/api/talabat/scans", talabatScansRoutes);
  app.use("/api/talabat/library", talabatLibraryRoutes);
  app.use("/api/talabat/dashboard", talabatDashboardRoutes);
  app.use("/api/talabat/hifz", talabatHifzRoutes);
  app.use("/api/talabat/leave", talabatLeaveRoutes);
  app.use("/api/talabat/hifz-marhala", talabatHifzMarhalaRoutes);

  // ── Parent routes ──
  app.use("/api/parent/hifz", parentHifzRoutes);
  app.use("/api/parent/dashboard", parentDashboardRoutes);
  app.use("/api/parent/activity", parentActivityRoutes);
  app.use("/api/parent/profile", parentProfileRoutes);

  // ── Serve the built SPA (production) ──
  const clientDist = path.join(repoRoot, "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  // ── 404 for API ──
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: "API endpoint not found" });
  });

  // ── Hardened Centralized Error handler ──
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[server] unhandled request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message || "Internal server error",
      });
    }
  });

  return app;
}
