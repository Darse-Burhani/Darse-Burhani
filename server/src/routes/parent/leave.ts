import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import {
  createLeaveRequest,
  cancelLeaveRequest,
  getStudentLeaveSummary,
} from "../../lib/leave-service";
import { LeaveType } from "@prisma/client";

const router = Router();

// Parent-submittable leave types — MEDICAL is intentionally excluded.
// Medical leave is handled only by the school medical desk, never via parent portal.
const PARENT_ALLOWED_TYPES = ["PERSONAL", "FAMILY_EMERGENCY", "OTHER"] as const;
type ParentLeaveType = (typeof PARENT_ALLOWED_TYPES)[number];

async function getParentProfileId(userId: string) {
  const parent = await prisma.parentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return parent?.id || null;
}

async function verifyParentChild(parentId: string, studentProfileId: string) {
  const link = await prisma.parentStudentLink.findFirst({
    where: { parentId, studentId: studentProfileId },
    select: { id: true },
  });
  return !!link;
}

// GET /api/parent/leave?studentId=... — leaves for one linked child (or all linked children)
router.get("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const parentId = await getParentProfileId(session.user.id);
    if (!parentId) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const links = await prisma.parentStudentLink.findMany({
      where: { parentId },
      select: { studentId: true },
    });
    const linkedIds = links.map((l) => l.studentId);
    if (linkedIds.length === 0) {
      return res.json({ success: true, data: { leaves: [], summaryByChild: {} } });
    }

    const { studentId } = req.query as { studentId?: string };
    const targetIds =
      typeof studentId === "string" && studentId
        ? linkedIds.filter((id) => id === studentId)
        : linkedIds;

    if (targetIds.length === 0) {
      return res.status(403).json({ success: false, error: "Student is not linked to your account" });
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: { studentId: { in: targetIds } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const summaryByChild: Record<string, unknown> = {};
    for (const id of targetIds) {
      try {
        summaryByChild[id] = await getStudentLeaveSummary(id);
      } catch {
        summaryByChild[id] = null;
      }
    }

    return res.json({
      success: true,
      data: {
        leaves: leaves.map((l) => ({
          id: l.id,
          studentProfileId: l.studentId,
          studentName: l.student
            ? `${l.student.user.firstName} ${l.student.user.lastName}`.trim()
            : "",
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
        summaryByChild,
      },
    });
  } catch (error) {
    console.error("[parent-leave] GET error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch leave requests" });
  }
});

// POST /api/parent/leave — submit leave for a linked child (no MEDICAL)
router.post("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const parentId = await getParentProfileId(session.user.id);
    if (!parentId) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const { studentProfileId, studentId, type, startDate, endDate, reason, attachmentUrl } =
      req.body as {
        studentProfileId?: string;
        studentId?: string;
        type?: string;
        startDate?: string;
        endDate?: string;
        reason?: string;
        attachmentUrl?: string;
      };

    const targetStudentId = studentProfileId || studentId;
    if (!targetStudentId) {
      return res.status(400).json({ success: false, error: "Select a student for this leave application" });
    }

    if (!(await verifyParentChild(parentId, targetStudentId))) {
      return res.status(403).json({ success: false, error: "Student is not linked to your account" });
    }

    if (!type || !(PARENT_ALLOWED_TYPES as readonly string[]).includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid leave type. Parents may apply for: ${PARENT_ALLOWED_TYPES.join(", ")}. Medical leave is handled by the school medical desk.`,
      });
    }

    if (type === LeaveType.MEDICAL) {
      return res.status(400).json({
        success: false,
        error: "Medical leave cannot be applied from the parent portal. Please contact the school medical desk.",
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
      studentId: targetStudentId,
      type: type as LeaveType,
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
    console.error("[parent-leave] POST error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to submit leave request",
    });
  }
});

// DELETE /api/parent/leave/:id — cancel a pending leave of a linked child
router.delete("/:id", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const parentId = await getParentProfileId(session.user.id);
    if (!parentId) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, studentId: true },
    });
    if (!leave) {
      return res.status(404).json({ success: false, error: "Leave request not found" });
    }
    if (!(await verifyParentChild(parentId, leave.studentId))) {
      return res.status(403).json({ success: false, error: "Student is not linked to your account" });
    }

    const cancelled = await cancelLeaveRequest(req.params.id, leave.studentId, false);
    return res.json({ success: true, data: { id: cancelled.id, status: cancelled.status } });
  } catch (error: any) {
    console.error("[parent-leave] DELETE error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to cancel leave request",
    });
  }
});

export default router;
