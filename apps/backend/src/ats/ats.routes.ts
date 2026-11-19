import { Router, type Response } from "express";
import multer from "multer";
import { prisma } from "../../db";
import { authMiddleware, type AuthenticatedRequest } from "../auth/auth.middleware";
import { extractResumeContent, type ExtractedResumeInput } from "./ats.parser";
import { atsService } from "./ats.service";

const router = Router();

// Configure multer with in-memory buffer and 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
});

/**
 * POST /api/v1/ats/analyze
 * Upload a resume (PDF, DOCX, TXT) and match against a Job Description
 */
router.post(
  "/analyze",
  authMiddleware,
  upload.single("resume"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const file = req.file;
      const { jdText, jobTitle, company, resumeId } = req.body;
      const userId = req.user.id;

      // Job Description is now optional — if omitted, run general ATS audit
      const cleanJd = (typeof jdText === "string" && jdText.trim().length > 0)
        ? jdText.trim()
        : "General Software Engineering Standards (General ATS Audit - No Specific Job Description Provided)";

      let resumeInput: ExtractedResumeInput;
      let linkedResumeId: string | null = null;

      if (file) {
        try {
          resumeInput = await extractResumeContent(file.buffer, file.originalname);
        } catch (validationErr: any) {
          res.status(400).json({
            error: validationErr.message || "Failed to parse uploaded resume file.",
          });
          return;
        }
      } else if (resumeId && typeof resumeId === "string" && resumeId !== "none") {
        // Backwards compatibility for existing library records if passed
        const existingResume = await prisma.resume.findFirst({
          where: { id: resumeId, userId },
        });

        if (!existingResume) {
          res.status(404).json({ error: "Selected resume not found or access denied." });
          return;
        }

        linkedResumeId = existingResume.id;
        resumeInput = {
          fileName: existingResume.fileName,
          mimeType: "text/plain",
          text: `Resume File: ${existingResume.fileName}\nSkills: ${existingResume.skills.join(", ")}`,
        };
      } else {
        res.status(400).json({
          error: "Please upload a resume file (PDF, DOCX, or TXT).",
        });
        return;
      }

      // Execute ATS analysis engine
      let analysisResult;
      try {
        analysisResult = await atsService.analyze(
          resumeInput,
          cleanJd,
          jobTitle ? String(jobTitle).trim() : undefined,
          company ? String(company).trim() : undefined
        );
      } catch (serviceErr: any) {
        console.error("[ATS Route] Engine execution failure:", serviceErr);
        res.status(500).json({
          error: `ATS Analysis failed: ${serviceErr.message || "AI engine communication error."}`,
        });
        return;
      }

      const { result, extractedResumeText } = analysisResult;

      // Persist the analysis in PostgreSQL scoped to the authenticated user
      const savedAnalysis = await prisma.atsAnalysis.create({
        data: {
          userId,
          resumeId: linkedResumeId,
          jobTitle: jobTitle ? String(jobTitle).trim() : result.parsedJd.title || null,
          company: company ? String(company).trim() : result.parsedJd.company || null,
          jdText: jdText.trim(),
          resumeFileName: resumeInput.fileName,
          resumeText: extractedResumeText,
          parsedResume: result.parsedResume as any,
          parsedJd: result.parsedJd as any,
          overallScore: result.overallScore,
          scoreBreakdown: result.scoreBreakdown as any,
          keywordMatches: result.keywordMatches as any,
          compatibilityChecks: result.compatibilityChecks as any,
          recommendations: result.recommendations as any,
          improvements: result.improvements as any,
        },
      });

      // Optional: Add to Resume Library if uploaded as a new file
      if (file && !linkedResumeId) {
        await prisma.resume.create({
          data: {
            userId,
            fileName: file.originalname,
            fileUrl: `stored://${savedAnalysis.id}_${file.originalname}`,
            atsScore: result.overallScore,
            skills: result.parsedResume.technicalSkills || [],
          },
        }).catch((e) => console.warn("[ATS] Non-critical resume library sync warning:", e.message));
      }

      // Audit Log Activity
      await prisma.auditLog.create({
        data: {
          userId,
          action: "ATS_ANALYSIS_CREATED",
          details: `Generated ATS analysis for "${resumeInput.fileName}" against "${jobTitle || "Job"}" with score ${result.overallScore}`,
        },
      }).catch((e) => console.warn("[ATS] Non-critical audit log warning:", e.message));

      res.status(201).json(savedAnalysis);
    } catch (err: any) {
      console.error("[ATS Route] Unhandled error during analysis:", err);
      res.status(500).json({ error: "An unexpected error occurred while processing the ATS analysis." });
    }
  }
);

/**
 * GET /api/v1/ats
 * List all ATS analyses belonging to the authenticated user
 */
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const analyses = await prisma.atsAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobTitle: true,
        company: true,
        resumeFileName: true,
        overallScore: true,
        scoreBreakdown: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(analyses);
  } catch (error: any) {
    console.error("[ATS Route] Failed to fetch analyses list:", error);
    res.status(500).json({ error: "Failed to retrieve ATS analyses history." });
  }
});

/**
 * GET /api/v1/ats/:id
 * Retrieve a specific ATS analysis report by ID (with strict user ownership verification)
 */
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user.id;

    const analysis = await prisma.atsAnalysis.findFirst({
      where: { id, userId },
    });

    if (!analysis) {
      res.status(404).json({ error: "ATS analysis report not found or access denied." });
      return;
    }

    res.json(analysis);
  } catch (error: any) {
    console.error("[ATS Route] Failed to fetch analysis detail:", error);
    res.status(500).json({ error: "Failed to retrieve the requested ATS analysis report." });
  }
});

/**
 * DELETE /api/v1/ats/:id
 * Delete an ATS analysis report by ID (with strict user ownership verification)
 */
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user.id;

    // Verify ownership before deletion
    const existing = await prisma.atsAnalysis.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: "ATS analysis report not found or access denied." });
      return;
    }

    await prisma.atsAnalysis.delete({
      where: { id },
    });

    // Audit Log Activity
    await prisma.auditLog.create({
      data: {
        userId,
        action: "ATS_ANALYSIS_DELETED",
        details: `Deleted ATS analysis report "${id}" for "${existing.resumeFileName}"`,
      },
    }).catch((e) => console.warn("[ATS] Non-critical audit log warning:", e.message));

    res.json({ success: true, message: "ATS analysis report deleted successfully." });
  } catch (error: any) {
    console.error("[ATS Route] Failed to delete analysis:", error);
    res.status(500).json({ error: "Failed to delete the ATS analysis report." });
  }
});

export default router;

