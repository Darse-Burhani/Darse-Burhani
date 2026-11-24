import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// GET /api/admin/library/students - Find student/faculty with full information & filters
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const query = ((req.query.query as string) || "").trim();
    const type = ((req.query.type as string) || "all").toLowerCase(); // "all" | "talabat" | "faculty"
    const darjah = ((req.query.darjah as string) || "").trim();
    const department = ((req.query.department as string) || "").trim();
    // Default to 1000 so all enrolled students and faculty are loaded completely
    const limit = Math.min(Number(req.query.limit) || 1000, 1000);

    const shouldFetchStudents = type === "all" || type === "talabat" || type === "student";
    const shouldFetchTeachers = (type === "all" || type === "faculty" || type === "teacher") && (!darjah || darjah === "all");

    // Student where condition
    const studentWhere: any = {};
    if (query) {
      const tokens = query.split(/\s+/).filter(Boolean);
      studentWhere.AND = tokens.map((token) => ({
        OR: [
          { trNo: { contains: token, mode: "insensitive" } },
          { its: { contains: token, mode: "insensitive" } },
          { studentId: { contains: token, mode: "insensitive" } },
          { nameAr: { contains: token, mode: "insensitive" } },
          { fatherName: { contains: token, mode: "insensitive" } },
          { user: { firstName: { contains: token, mode: "insensitive" } } },
          { user: { lastName: { contains: token, mode: "insensitive" } } },
        ],
      }));
    }
    if (darjah && darjah !== "all") {
      studentWhere.OR = [
        { grade: darjah },
        { classEnrollments: { some: { class: { grade: darjah } } } },
      ];
    }

    // Teacher where condition
    const teacherWhere: any = {};
    if (query) {
      const tokens = query.split(/\s+/).filter(Boolean);
      teacherWhere.AND = tokens.map((token) => ({
        OR: [
          { employeeId: { contains: token, mode: "insensitive" } },
          { its: { contains: token, mode: "insensitive" } },
          { department: { contains: token, mode: "insensitive" } },
          { user: { firstName: { contains: token, mode: "insensitive" } } },
          { user: { lastName: { contains: token, mode: "insensitive" } } },
        ],
      }));
    }
    if (department && department !== "all") {
      teacherWhere.department = { contains: department, mode: "insensitive" };
    }

    const students = shouldFetchStudents
      ? await prisma.studentProfile.findMany({
          where: studentWhere,
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
            parentLinks: {
              include: {
                parent: {
                  include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                  },
                },
              },
              take: 1,
            },
            classEnrollments: {
              include: { class: { select: { name: true, grade: true, section: true } } },
              where: { isActive: true },
              take: 1,
            },
          },
          take: limit,
          orderBy: [{ grade: "asc" }, { studentId: "asc" }],
        })
      : [];

    const teachers = shouldFetchTeachers
      ? await prisma.teacherProfile.findMany({
          where: teacherWhere,
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
          take: limit,
          orderBy: [{ user: { firstName: "asc" } }],
        })
      : [];

    // Also fetch photos from TalabatProfile1447 where studentPhotoUrl is available
    const talabatProfiles = students.length > 0
      ? await prisma.talabatProfile1447.findMany({
          where: { studentId: { in: students.map((s) => s.id) } },
          select: { studentId: true, studentPhotoUrl: true },
        })
      : [];
    const photoByProfileId = new Map(talabatProfiles.map((tp) => [tp.studentId, tp.studentPhotoUrl]));

    const [availableGrades, availableDepts] = await Promise.all([
      prisma.studentProfile.groupBy({
        by: ["grade"],
        _count: { id: true },
        orderBy: { grade: "asc" },
      }),
      prisma.teacherProfile.groupBy({
        by: ["department"],
        _count: { id: true },
        where: { department: { not: null } },
      }),
    ]);

    // Active loan counts and overdue status
    const allUserIds = [
      ...students.map((s) => s.userId),
      ...teachers.map((t) => t.userId),
    ];

    const activeLoans = await prisma.bookLoan.findMany({
      where: {
        studentId: { in: allUserIds },
        status: "ACTIVE",
      },
      select: {
        studentId: true,
        dueAt: true,
      },
    });

    const now = new Date();
    const loanCountMap = new Map<string, number>();
    const overdueMap = new Map<string, boolean>();

    for (const l of activeLoans) {
      loanCountMap.set(l.studentId, (loanCountMap.get(l.studentId) || 0) + 1);
      if (new Date(l.dueAt) < now) {
        overdueMap.set(l.studentId, true);
      }
    }

    const memberList = [
      ...students.map((s) => {
        const parentLink = s.parentLinks[0];
        const linkedParent = parentLink?.parent;
        const parentName = linkedParent
          ? `${linkedParent.user.firstName} ${linkedParent.user.lastName}`.trim()
          : s.fatherName || s.motherName || "Parent Unassigned";
        const parentPhone = linkedParent?.phone || s.fatherPhone || s.motherPhone || null;
        const parentEmail = linkedParent?.user.email || s.fatherEmail || s.motherEmail || null;

        return {
          id: s.userId,
          profileId: s.id,
          memberId: s.studentId,
          studentId: s.studentId,
          its: s.its,
          trNo: s.trNo,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          name: `${s.user.firstName} ${s.user.lastName}`.trim(),
          nameAr: s.nameAr || null,
          photo: s.user.avatarUrl || photoByProfileId.get(s.id) || null,
          avatarUrl: s.user.avatarUrl || photoByProfileId.get(s.id) || null,
          role: "STUDENT" as const,
          roleLabel: "Talabat",
          grade: s.grade || s.classEnrollments[0]?.class?.grade || null,
          section: s.section || s.classEnrollments[0]?.class?.section || null,
          className: s.classEnrollments[0]?.class
            ? `Grade ${s.classEnrollments[0].class.grade} ${s.classEnrollments[0].class.section}`
            : s.grade
            ? `Grade ${s.grade}${s.section ? ` ${s.section}` : ""}`
            : null,
          contactPhone: s.mobileNumber || s.fatherPhone || s.motherPhone || null,
          parentName,
          parentPhone,
          parentEmail,
          fatherName: s.fatherName,
          fatherPhone: s.fatherPhone,
          motherName: s.motherName,
          motherPhone: s.motherPhone,
          activeLoans: loanCountMap.get(s.userId) || 0,
          hasOverdue: overdueMap.get(s.userId) || false,
          maxAllowed: 5,
        };
      }),
      ...teachers.map((t) => ({
        id: t.userId,
        profileId: t.id,
        memberId: t.employeeId,
        studentId: t.employeeId,
        its: t.its,
        trNo: null,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        nameAr: null,
        photo: t.user.avatarUrl || null,
        avatarUrl: t.user.avatarUrl || null,
        department: t.department || "Faculty",
        role: "FACULTY" as const,
        roleLabel: "Faculty / Asateez",
        grade: null,
        section: null,
        className: t.department || "Faculty Department",
        contactPhone: t.mobile || null,
        parentName: null,
        parentPhone: null,
        parentEmail: null,
        fatherName: null,
        fatherPhone: null,
        motherName: null,
        motherPhone: null,
        activeLoans: loanCountMap.get(t.userId) || 0,
        hasOverdue: overdueMap.get(t.userId) || false,
        maxAllowed: 10,
      })),
    ];

    return res.json({
      success: true,
      data: memberList,
      total: memberList.length,
      availableGrades: availableGrades
        .filter((g) => g.grade)
        .map((g) => ({ grade: String(g.grade).trim(), count: g._count.id }))
        .sort((a, b) => Number(a.grade) - Number(b.grade)),
      availableDepartments: availableDepts
        .filter((d) => d.department)
        .map((d) => ({ department: d.department as string, count: d._count.id })),
    });
  } catch (error) {
    console.error("Students lookup error:", error);
    return res.status(500).json({ success: false, error: "Failed to search members" });
  }
});

export default router;
