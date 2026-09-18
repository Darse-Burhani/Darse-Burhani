
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { createLeaveRequest, cancelLeaveRequest, getStudentLeaveSummary } from "../../lib/leave-service";
import { LeaveType } from "@prisma/client";

const router = Router();

// GET /api/talabat/leave — List student's leave requests & stats
router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, studentId: true, grade: true, section: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const summary = await getStudentLeaveSummary(student.id);

    return res.json({
      success: true,
      data: {
        summary: {
          totalRequests: summary.totalRequests,
          pendingCount: summary.pendingCount,
          approvedCount: summary.approvedCount,
          rejectedCount: summary.rejectedCount,
          approvedDays: summary.approvedDays,
          medicalDays: summary.medicalDays,
        },
        leaves: summary.leaves.map((l) => ({
          id: l.id,
          type: l.type,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          reason: l.reason,
          attachmentUrl: l.attachmentUrl,
          status: l.status,
          reviewerNotes: l.reviewerNotes,
          reviewedAt: l.reviewedAt?.toISOString() || null,
          createdAt: l.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[talabat-leave] GET error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch leave requests" });
  }
});

// POST /api/talabat/leave — Submit a new leave request
router.post("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const { type, startDate, endDate, reason, attachmentUrl } = req.body;

    if (!type || !Object.values(LeaveType).includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid leave type. Must be one of: ${Object.values(LeaveType).join(", ")}`,
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Start date and end date are required" });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "Please provide a clear reason for the leave (at least 5 characters)",
      });
    }

    const leave = await createLeaveRequest({
      studentId: student.id,
      type,
      startDate,
      endDate,
      reason,
      attachmentUrl: typeof attachmentUrl === "string" ? attachmentUrl.trim() : undefined,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: leave.id,
        type: leave.type,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        reason: leave.reason,
        status: leave.status,
        createdAt: leave.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[talabat-leave] POST error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to submit leave request",
    });
  }
});

// DELETE /api/talabat/leave/:id — Cancel a pending leave request
router.delete("/:id", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const cancelled = await cancelLeaveRequest(req.params.id, student.id, false);

    return res.json({
      success: true,
      data: {
        id: cancelled.id,
        status: cancelled.status,
      },
    });
  } catch (error: any) {
    console.error("[talabat-leave] DELETE error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to cancel leave request",
    });
  }
});

export default router;
