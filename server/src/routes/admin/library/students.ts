import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// GET /api/admin/library/students?query=xxx - Find student by barcode/ID
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const query = (req.query.query as string) || "";

    if (!query) {
      return res.status(400).json({ success: false, error: "Search query is required" });
    }

    // Search Students
    const [students, teachers] = await Promise.all([
      prisma.studentProfile.findMany({
        where: {
          OR: [
            { trNo: { contains: query, mode: "insensitive" } },
            { its: { contains: query, mode: "insensitive" } },
            { studentId: { contains: query, mode: "insensitive" } },
            { user: { firstName: { contains: query, mode: "insensitive" } } },
            { user: { lastName: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
          classEnrollments: {
            include: { class: { select: { name: true, grade: true, section: true } } },
            where: { isActive: true },
            take: 1,
          },
        },
        take: 8,
      }),
      prisma.teacherProfile.findMany({
        where: {
          OR: [
            { employeeId: { contains: query, mode: "insensitive" } },
            { its: { contains: query, mode: "insensitive" } },
            { user: { firstName: { contains: query, mode: "insensitive" } } },
            { user: { lastName: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
        take: 8,
      }),
    ]);

    // Get active loan counts for each user
    const allUserIds = [...students.map((s) => s.userId), ...teachers.map((t) => t.userId)];
    const loanCounts = await prisma.bookLoan.groupBy({
      by: ["studentId"],
      where: { studentId: { in: allUserIds }, status: "ACTIVE" },
      _count: true,
    });

    const loanCountMap = new Map(loanCounts.map((l) => [l.studentId, l._count]));

    const memberList = [
      ...students.map((s) => ({
        id: s.userId,
        memberId: s.studentId,
        studentId: s.studentId,
        its: s.its,
        trNo: s.trNo,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        role: "STUDENT" as const,
        roleLabel: "Talabat",
        grade: s.grade,
        section: s.section,
        className: s.classEnrollments[0]?.class
          ? `Grade ${s.classEnrollments[0].class.grade} ${s.classEnrollments[0].class.section}`
          : s.grade ? `Grade ${s.grade}` : null,
        activeLoans: loanCountMap.get(s.userId) || 0,
      })),
      ...teachers.map((t) => ({
        id: t.userId,
        memberId: t.employeeId,
        studentId: t.employeeId,
        its: t.its,
        trNo: null,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        role: "FACULTY" as const,
        roleLabel: "Faculty / Asateez",
        grade: null,
        section: null,
        className: t.department || "Faculty",
        activeLoans: loanCountMap.get(t.userId) || 0,
      })),
    ];

    return res.json({
      success: true,
      data: memberList,
    });
  } catch (error) {
    console.error("Students lookup error:", error);
    return res.status(500).json({ success: false, error: "Failed to search students" });
  }
});

export default router;
