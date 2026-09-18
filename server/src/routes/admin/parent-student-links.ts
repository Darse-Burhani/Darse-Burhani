
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/admin/parent-student-links
// Returns all parents with their linked students, plus the full student list
router.get("/", requireRole("ADMIN"), async (_req, res) => {
  try {
    const [parents, students] = await Promise.all([
      prisma.parentProfile.findMany({
        where: {
          user: { deletedAt: null, isActive: true },
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
          },
          studentLinks: {
            where: {
              student: {
                user: { deletedAt: null, isActive: true },
              },
            },
            include: {
              student: {
                include: {
                  user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                },
              },
            },
          },
        },
        orderBy: { user: { firstName: "asc" } },
      }),
      prisma.studentProfile.findMany({
        where: {
          user: { deletedAt: null, isActive: true },
        },
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        parents: parents.map((p) => ({
          id: p.id,
          userId: p.userId,
          email: p.user.email,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          isActive: p.user.isActive,
          phone: p.phone,
          linkedStudents: p.studentLinks.map((l) => ({
            linkId: l.id,
            studentId: l.studentId,
            relationship: l.relationship,
            studentName: `${l.student.user.firstName} ${l.student.user.lastName}`,
            grade: l.student.grade,
            section: l.student.section,
            avatarUrl: l.student.user.avatarUrl,
          })),
        })),
        students: students.map((s) => ({
          id: s.id,
          userId: s.userId,
          studentId: s.studentId,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          grade: s.grade,
          section: s.section,
          avatarUrl: s.user.avatarUrl,
        })),
      },
    });
  } catch (error) {
    console.error("Parent-student links fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch parent-student links" });
  }
});

// POST /api/admin/parent-student-links
// Body: { parentId, studentId, relationship? }
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const { parentId, studentId, relationship } = body;

    if (!parentId || !studentId) {
      return res.status(400).json({ success: false, error: "parentId and studentId are required" });
    }

    // Verify parent and student exist (flexible matching by primary id, userId, or studentId code)
    let parent = await prisma.parentProfile.findUnique({ where: { id: parentId } });
    if (!parent) {
      parent = await prisma.parentProfile.findUnique({ where: { userId: parentId } });
    }

    let student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) {
      student = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
    }
    if (!student) {
      student = await prisma.studentProfile.findUnique({ where: { studentId } });
    }

    if (!parent) return res.status(404).json({ success: false, error: "Parent profile not found" });
    if (!student) return res.status(404).json({ success: false, error: "Student profile not found" });

    // Upsert link (idempotent)
    const link = await prisma.parentStudentLink.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
      update: { relationship: relationship || null },
      create: { parentId: parent.id, studentId: student.id, relationship: relationship || null },
    });

    return res.status(201).json({ success: true, data: { linkId: link.id } });
  } catch (error) {
    console.error("Parent-student link create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create parent-student link" });
  }
});

// DELETE /api/admin/parent-student-links?linkId=xxx or ?parentId=xxx&studentId=yyy
router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const linkId = req.query.linkId as string;
    const parentId = req.query.parentId as string;
    const studentId = req.query.studentId as string;

    if (linkId) {
      await prisma.parentStudentLink.delete({ where: { id: linkId } });
      return res.json({ success: true });
    }

    if (parentId && studentId) {
      // Find matching parent and student profiles
      let pId = parentId;
      let sId = studentId;

      const parent = await prisma.parentProfile.findFirst({
        where: { OR: [{ id: parentId }, { userId: parentId }] },
      });
      if (parent) pId = parent.id;

      const student = await prisma.studentProfile.findFirst({
        where: { OR: [{ id: studentId }, { userId: studentId }, { studentId }] },
      });
      if (student) sId = student.id;

      await prisma.parentStudentLink.deleteMany({
        where: { parentId: pId, studentId: sId },
      });
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: "linkId or (parentId and studentId) query parameter is required" });
  } catch (error) {
    console.error("Parent-student link delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to remove parent-student link" });
  }
});

export default router;
