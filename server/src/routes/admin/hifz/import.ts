import { Router } from "express";
import prisma from "../../../lib/prisma";
import { getSheetData, parseSheetRows } from "../../../lib/google-sheets";
import bcrypt from "bcryptjs";
import { requireRole } from "../../../middleware";


const router = Router();

// School years run roughly July → June. Anything on/after July belongs to
// the year that started most recently.
function defaultAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Match an ITS by StudentProfile.studentId (exact), then fall back to the
 *  generated account email and finally to an unambiguous exact name match. */
async function findStudentByIts(its: string): Promise<string | null> {
  const byIts = await prisma.studentProfile.findFirst({
    where: { studentId: its.trim() },
    select: { id: true },
  });
  if (byIts) return byIts.id;

  const byEmail = await prisma.studentProfile.findFirst({
    where: { user: { email: `${its.trim()}@student.sis.edu` } },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;

  return null;
}

/** Exact first+last name match. Only matches when there is exactly one
 *  student with that exact name (avoids "Ahmed" catching the wrong person). */
async function findStudentByExactName(studentName: string): Promise<string | null> {
  const parts = studentName.trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  const matches = await prisma.studentProfile.findMany({
    where: {
      user: {
        firstName: { equals: firstName, mode: "insensitive" as const },
        ...(lastName ? { lastName: { equals: lastName, mode: "insensitive" as const } } : {}),
      },
    },
    select: { id: true },
  });

  return matches.length === 1 ? matches[0].id : null;
}

// POST /api/admin/hifz/import - Import students and progress from a Google Sheet
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    // Check if Google Sheets API key is configured
    if (!process.env.GOOGLE_SHEETS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Google Sheets API key is not configured. Please add GOOGLE_SHEETS_API_KEY to your environment variables.",
      });
    }

    const body = req.body as Record<string, any>;
    const { sheetId, reportId, sheetRange, gid } = body;
    const academicYear = String(body.academicYear || defaultAcademicYear()).trim();
    const semester = body.semester !== undefined ? String(body.semester) : "1";
    const publish = Boolean(body.publish);

    if (!sheetId) {
      return res.status(400).json({ success: false, error: "Sheet ID is required" });
    }

    // Fetch data from Google Sheets
    let rows: string[][];
    try {
      rows = await getSheetData(sheetId, sheetRange || undefined, gid || undefined);
    } catch (sheetError: any) {
      let message = sheetError?.response?.data?.error?.message || (sheetError instanceof Error ? sheetError.message : "Failed to fetch data from Google Sheets");
      if (message.toLowerCase().includes("caller does not have permission") || message.toLowerCase().includes("permission denied") || message.toLowerCase().includes("unauthorized")) {
        message = "Google Sheet is private. In Google Sheets, click 'Share' at the top right, change General Access to 'Anyone with the link can view', and try again.";
      } else if (message.toLowerCase().includes("requested entity was not found") || message.toLowerCase().includes("not found")) {
        message = "Google Sheet not found. Please check that the URL or ID was copied correctly.";
      }
      return res.status(400).json({ success: false, error: message });
    }

    const parsedData = parseSheetRows(rows);

    if (parsedData.length === 0) {
      return res.status(400).json({ success: false, error: "No valid data found in sheet. Make sure your sheet has headers and data." });
    }

    let imported = 0;
    let updated = 0;
    let reportsCreated = 0;
    let studentsCreated = 0;
    let published = 0;
    const touchedReportIds = new Set<string>();

    // Default password for new students
    const defaultPassword = await bcrypt.hash("student123", 10);

    // Resolve default teacher profile for imported reports
    let hifzTeacher = await prisma.teacherProfile.findFirst({
      where: {
        portalAssignments: {
          some: { portalType: { in: ["HIFZ", "ALL"] }, isActive: true },
        },
      },
    });
    if (!hifzTeacher) {
      hifzTeacher = await prisma.teacherProfile.findFirst({
        where: { user: { isActive: true } },
      });
    }
    if (!hifzTeacher) {
      // Create a fallback Hifz Teacher account if none exists
      let hifzUser = await prisma.user.findFirst({ where: { role: "TEACHER" } });
      if (!hifzUser) {
        hifzUser = await prisma.user.create({
          data: {
            email: "hifz.teacher@darseburhani.edu",
            passwordHash: defaultPassword,
            firstName: "Hifz",
            lastName: "Teacher",
            role: "TEACHER",
          },
        });
      }
      hifzTeacher = await prisma.teacherProfile.upsert({
        where: { userId: hifzUser.id },
        update: {},
        create: {
          userId: hifzUser.id,
          employeeId: `TCH-${Date.now()}`,
          department: "Quranic Studies",
          subjects: ["Hifz"],
          portfolioEnabled: true,
        },
      });
    }

    // If reportId is provided, import to that specific report
    if (reportId) {
      const report = await prisma.hifzReport.findUnique({
        where: { id: reportId },
        include: { parts: true },
      });

      if (!report) {
        return res.status(404).json({ success: false, error: "Report not found" });
      }

      const result = await importToReport(report, parsedData);
      imported = result.imported;
      updated = result.updated;
      touchedReportIds.add(report.id);
    } else {
      // Import all students from the sheet
      for (const rowData of parsedData) {
        if (!rowData.studentName) continue;

        // ── Match student: ITS first, then exact name ──
        let studentId: string | null = rowData.its ? await findStudentByIts(rowData.its) : null;
        if (!studentId) studentId = await findStudentByExactName(rowData.studentName);

        // If student still not found, create new student profile
        if (!studentId && rowData.its && rowData.studentName) {
          try {
            const nameParts = rowData.studentName.trim().split(/\s+/);
            const firstName = nameParts[0] || rowData.studentName;
            const lastName = nameParts.slice(1).join(" ") || "";

            const studentUser = await prisma.user.create({
              data: {
                email: `${rowData.its}@student.sis.edu`,
                passwordHash: defaultPassword,
                firstName,
                lastName,
                role: "STUDENT",
              },
            });

            const student = await prisma.studentProfile.create({
              data: {
                userId: studentUser.id,
                studentId: rowData.its,
                grade: rowData.darajah || "M4",
                section: rowData.sanah || "",
              },
            });
            studentId = student.id;

            // Create parent accounts and link them to this student
            const parentEmails = [rowData.email1, rowData.email2].filter((e) => e && e.trim() !== "");
            for (const parentEmail of parentEmails) {
              try {
                let parentUser = await prisma.user.findUnique({
                  where: { email: parentEmail },
                });

                if (!parentUser) {
                  parentUser = await prisma.user.create({
                    data: {
                      email: parentEmail,
                      passwordHash: defaultPassword,
                      firstName,
                      lastName,
                      role: "PARENT",
                    },
                  });

                  await prisma.parentProfile.create({
                    data: { userId: parentUser.id },
                  });
                }

                const existingParentProfile = await prisma.parentProfile.findUnique({
                  where: { userId: parentUser.id },
                });

                if (existingParentProfile) {
                  await prisma.parentStudentLink.upsert({
                    where: {
                      parentId_studentId: {
                        parentId: existingParentProfile.id,
                        studentId: student.id,
                      },
                    },
                    update: {},
                    create: {
                      parentId: existingParentProfile.id,
                      studentId: student.id,
                    },
                  });
                }
              } catch (parentError) {
                console.error(`Failed to create parent ${parentEmail} for student ${rowData.studentName}:`, parentError);
              }
            }

            studentsCreated++;
          } catch (createError) {
            console.error(`Failed to create student ${rowData.studentName}:`, createError);
            continue;
          }
        }

        if (!studentId) continue;

        // ── Find or create report for this student ──
        let report = await prisma.hifzReport.findFirst({
          where: {
            studentId,
            academicYear,
          },
          include: { parts: true },
        });

        if (!report) {
          report = await prisma.hifzReport.create({
            data: {
              studentId,
              teacherId: hifzTeacher.id,
              academicYear,
              semester,
              parts: {
                create: Array.from({ length: 30 }, (_, i) => ({
                  partNumber: i + 1,
                  status: "NOT_STARTED",
                  progress: 0,
                  isMemorized: false,
                  isReviewed: false,
                  isWeak: false,
                  isAbandoned: false,
                  reviewCount: 0,
                  targetReviews: 20,
                  currentPage: 0,
                  totalPages: 20,
                  firmProgress: 0,
                  firmTarget: 10,
                  sentencesMemorized: 0,
                  sentencePercentage: 0,
                })),
              },
            },
            include: { parts: true },
          });
          reportsCreated++;
        }

        const result = await importToReport(report, [rowData]);
        imported += result.imported;
        updated += result.updated;
        touchedReportIds.add(report.id);
      }
    }

    // Optional: publish every touched report straight to the talabat portal
    if (publish && touchedReportIds.size > 0) {
      const res_ = await prisma.hifzReport.updateMany({
        where: { id: { in: [...touchedReportIds] } },
        data: { isPublished: true, publishedAt: new Date() },
      });
      published = res_.count;
    }

    return res.json({
      success: true,
      data: {
        imported,
        updated,
        total: parsedData.length,
        reportsCreated,
        studentsCreated,
        published,
        academicYear,
        semester,
      },
    });
  } catch (error) {
    console.error("Sheet import error:", error);
    const message = error instanceof Error ? error.message : "Failed to import from Google Sheet";
    return res.status(500).json({ success: false, error: message });
  }
});

async function importToReport(report: any, parsedData: any[]) {
  let imported = 0;
  let updated = 0;

  for (const rowData of parsedData) {
    // Calculate progress based on current juz
    const progress = rowData.currentJuz > 0 ? Math.round((rowData.currentJuz / 30) * 100) : 0;

    // Determine status. WEAK must not override COMPLETED.
    let status = "NOT_STARTED";
    if (rowData.currentJuz >= 30) status = "COMPLETED";
    else if (rowData.currentJuz > 0) status = "IN_PROGRESS";
    if (status !== "COMPLETED" && rowData.weakAjza > 0) status = "WEAK";

    // Parse pending ajza count (accepts "1,2,3", "3", or blank)
    const pendingAjzaStr = String(rowData.pendingAjza || "").trim();
    const pendingCount = pendingAjzaStr.includes(",")
      ? pendingAjzaStr.split(",").filter(Boolean).length
      : pendingAjzaStr.includes("-")
      ? 0
      : parseInt(pendingAjzaStr) || 0;

    // Parse weak ajza count
    const weakAjzaStr = String(rowData.weakAjza || "").trim();
    const weakCount = weakAjzaStr.includes(",")
      ? weakAjzaStr.split(",").filter(Boolean).length
      : weakAjzaStr.includes("-")
      ? 0
      : parseInt(weakAjzaStr) || 0;

    // Basic part data that works with existing schema
    const partData: any = {
      status,
      progress,
      currentPage: rowData.currentSafah,
      totalPages: 20,
      firmProgress: rowData.totalJadeedPages,
      firmTarget: 10,
      sentencesMemorized: rowData.totalJadeedPages,
      sentencePercentage: rowData.performancePercent,
      reviewCount: rowData.murajaatMarks,
      targetReviews: 20,
      isMemorized: rowData.currentJuz >= 30,
      isWeak: rowData.weakAjza > 0,
      isAbandoned: false,
      isReviewed: rowData.murajaatMarks > 0,
      murajaatMarks: rowData.murajaatMarks,
      juzhaliMarks: rowData.juzhaliMarks,
      jadeedMarks: rowData.jadeedMarks,
      totalMarks: rowData.totalMarks,
      performancePercent: rowData.performancePercent,
      pendingAjza: pendingCount,
      notes: `ITS: ${rowData.its} | Darajah: ${rowData.darajah} | Sanah: ${rowData.sanah} | Email: ${rowData.email1}`,
    };

    // Every juz strictly below the current one is implied memorized.
    if (rowData.currentJuz > 1) {
      const earlier = report.parts.filter(
        (p: any) => p.partNumber < rowData.currentJuz && p.status === "NOT_STARTED",
      );
      for (const p of earlier) {
        await prisma.hifzPart.update({
          where: { id: p.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            isMemorized: true,
            isReviewed: true,
            isWeak: false,
          },
        });
        updated++;
      }
    }

    // Find existing part by currentJuz or create new one
    const existingPart = report.parts.find((p: any) => p.partNumber === rowData.currentJuz);

    if (existingPart) {
      await prisma.hifzPart.update({
        where: { id: existingPart.id },
        data: partData,
      });
      updated++;
    } else if (rowData.currentJuz > 0 && rowData.currentJuz <= 30) {
      await prisma.hifzPart.create({
        data: {
          reportId: report.id,
          partNumber: rowData.currentJuz,
          ...partData,
        },
      });
      imported++;
    }
  }

  // Update report timestamp
  await prisma.hifzReport.update({
    where: { id: report.id },
    data: { updatedAt: new Date() },
  });

  return { imported, updated };
}

export default router;
