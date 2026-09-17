import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: parentProfile.id },
      select: { studentId: true },
    });

    const studentIds = links.map((l) => l.studentId);

    const childId = req.query.childId as string;

    const targetIds = childId ? studentIds.filter((id) => id === childId) : studentIds;

    const [transactions, students] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { studentId: { in: targetIds } },
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            select: {
              user: { select: { firstName: true, lastName: true } },
              walletBalance: true,
            },
          },
        },
      }),
      prisma.studentProfile.findMany({
        where: { id: { in: targetIds } },
        select: {
          userId: true,
          walletBalance: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const totalBalance = students.reduce((sum, s) => sum + s.walletBalance, 0);

    return res.json({
      success: true,
      data: {
        totalBalance,
        children: students.map((s) => ({
          id: s.userId,
          name: `${s.user.firstName} ${s.user.lastName}`,
          walletBalance: s.walletBalance,
        })),
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          childName: `${t.student.user.firstName} ${t.student.user.lastName}`,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Parent wallet error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch wallet" });
  }
});

router.post("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const body = req.body as Record<string, any>;
    const { childId, amount } = body;

    if (!childId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: "Child ID and positive amount required" });
    }

    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [{ id: childId }, { userId: childId }],
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Child profile not found" });
    }

    // Verify parent owns this child
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parentProfile.id, studentId: student.id },
    });

    if (!link) {
      return res.status(403).json({ success: false, error: "Child not linked to this parent" });
    }

    await prisma.$transaction([
      prisma.studentProfile.update({
        where: { id: student.id },
        data: { walletBalance: { increment: amount } },
      }),
      prisma.walletTransaction.create({
        data: {
          studentId: student.id,
          type: "DEPOSIT",
          amount,
          description: `Wallet deposit by parent`,
        },
      }),
    ]);

    return res.json({ success: true, message: `Funds added successfully` });
  } catch (error) {
    console.error("Parent wallet deposit error:", error);
    return res.status(500).json({ success: false, error: "Failed to add funds" });
  }
});

export default router;
