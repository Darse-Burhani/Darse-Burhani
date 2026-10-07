
import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { cancelLeaveRequest, getStudentLeaveSummary } from "../../lib/leave-service";

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

// POST /api/talabat/leave — Disabled: leave is now applied by parents only
// (GET history + DELETE cancel remain active so past requests stay visible.)
router.post("/", requireRole("STUDENT"), async (_req, res) => {
  return res.status(403).json({
    success: false,
    error: "Leave applications are now submitted by your parent / guardian from the Parent Portal.",
  });
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
