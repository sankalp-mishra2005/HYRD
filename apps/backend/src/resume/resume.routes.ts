import { Router, type Response } from "express";
import multer from "multer";
import { prisma } from "../../db";
import { PROMPTS } from "../../prompts";
import { generateContentWithRetry } from "../utils/gemini";
import { authMiddleware, type AuthenticatedRequest } from "../auth/auth.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function normalizePerspectives(rawPerspectives: any) {
  const recruiter = rawPerspectives?.recruiterPerspective || {};
  const ats = rawPerspectives?.atsPerspective || {};
  const tech = rawPerspectives?.technicalPerspective || {};
  const interview = rawPerspectives?.interviewPerspective || {};

  return {
    recruiterPerspective: {
      rating: Number(recruiter.rating ?? 7),
      feedback: String(recruiter.feedback || "Good overall layout with clear technical focus."),
      strengths: Array.isArray(recruiter.strengths) ? recruiter.strengths.map((s: any) => ({
        title: String(s.title || s),
        description: String(s.description || "Identified key project contribution.")
      })) : [],
      weaknesses: Array.isArray(recruiter.weaknesses) ? recruiter.weaknesses.map((w: any) => ({
        title: String(w.title || w),
        description: String(w.description || "Increase quantifiable metrics."),
        confidence: Number(w.confidence ?? 0.85),
        evidence: Array.isArray(w.evidence) ? w.evidence.map(String) : ["Project bullet points list tasks rather than business outcomes."]
      })) : []
    },
    atsPerspective: {
      rating: Number(ats.rating ?? 7),
      feedback: String(ats.feedback || "ATS parseable layout."),
      missingKeywords: Array.isArray(ats.missingKeywords) ? ats.missingKeywords.map(String) : [],
      formattingIssues: Array.isArray(ats.formattingIssues) ? ats.formattingIssues.map((f: any) => ({
        title: String(f.title || f),
        description: String(f.description || "Layout recommendation.")
      })) : []
    },
    technicalPerspective: {
      rating: Number(tech.rating ?? 7),
      feedback: String(tech.feedback || "Solid technical foundation across stacks."),
      projectDepthRating: Number(tech.projectDepthRating ?? 7),
      stackStrengths: Array.isArray(tech.stackStrengths) ? tech.stackStrengths.map(String) : []
    },
    interviewPerspective: {
      rating: Number(interview.rating ?? 7),
      feedback: String(interview.feedback || "Practice DSA complexity bounds and distributed systems trade-offs."),
      recommendedTopics: Array.isArray(interview.recommendedTopics) ? interview.recommendedTopics.map((t: any) => ({
        topic: String(t.topic || t),
        priority: String(t.priority || "Medium"),
        estimatedPrepTime: String(t.estimatedPrepTime || "30 min"),
        impact: String(t.impact || "Medium")
      })) : []
    }
  };
}

/**
 * Upload and analyze a resume (adds to Library & creates Analysis report)
 */
router.post("/analyze", authMiddleware, upload.single("resume"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      res.status(400).json({ error: "No resume file uploaded" });
      return;
    }

    let mimeType = file.mimetype;
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.originalname.endsWith(".docx")) {
      res.status(400).json({ error: "Word documents (.docx) are not supported yet. Please convert your resume to PDF or TXT." });
      return;
    }
    if (mimeType !== "application/pdf" && mimeType !== "text/plain") {
      if (file.originalname.endsWith(".txt")) {
        mimeType = "text/plain";
      } else {
        res.status(400).json({ error: "Unsupported file format. Please upload a PDF or TXT file." });
        return;
      }
    }

    let result;
    try {
      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: file.buffer.toString("base64"),
            },
          },
          PROMPTS.resumeAnalyzer.instruction,
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const cleanText = response.text!.replace(/```json/g, "").replace(/```/g, "").trim();
      result = JSON.parse(cleanText);
    } catch (apiError: any) {
      console.error("Resume analyzer API failed:", apiError);
      res.status(500).json({ error: `AI Resume Analyzer failed: ${apiError.message || apiError}` });
      return;
    }

    const normalized = normalizePerspectives(result.perspectives);

    // 1. Create Resume Analysis Report
    const savedAnalysis = await prisma.resumeAnalysis.create({
      data: {
        userId,
        atsScore: result.atsScore || 0,
        candidateName: result.candidateName || null,
        email: result.email || null,
        skills: result.skills || [],
        strengths: result.strengths || [],
        improvements: result.improvements || [],
        formattingTips: result.formattingTips || [],
        rawAnalysisText: result.rawAnalysisText || "",
        perspectives: normalized as any,
      },
    });

    // 2. Also register in the Resume Library
    const savedResume = await prisma.resume.create({
      data: {
        userId,
        fileName: file.originalname || "resume.pdf",
        fileUrl: `mock-storage://${Date.now()}_${file.originalname}`,
        atsScore: result.atsScore || null,
        skills: result.skills || [],
      },
    });

    // 3. Log Audit Activity
    await prisma.auditLog.create({
      data: {
        userId,
        action: "RESUME_ANALYZED",
        details: `Analyzed resume "${file.originalname}" with ATS score of ${result.atsScore || 0}`,
      },
    });

    res.json({
      analysis: savedAnalysis,
      resume: savedResume,
    });
  } catch (error: any) {
    console.error("Resume analysis route error:", error);
    res.status(500).json({ error: "Failed to analyze resume. Please try again." });
  }
});

/**
 * Get all resumes in library
 */
router.get("/library", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const library = await prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(library);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch resume library" });
  }
});

/**
 * Get all historical resume analyses reports
 */
router.get("/analyses", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const analyses = await prisma.resumeAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(analyses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch resume analyses" });
  }
});

/**
 * Delete a resume from library
 */
router.delete("/library/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user.id;

    const resume = await prisma.resume.findFirst({
      where: { id, userId },
    });

    if (!resume) {
      res.status(404).json({ error: "Resume not found in library" });
      return;
    }

    await prisma.resume.delete({
      where: { id },
    });

    // Log Activity
    await prisma.auditLog.create({
      data: {
        userId,
        action: "RESUME_DELETED",
        details: `Deleted resume "${resume.fileName}"`,
      },
    });

    res.json({ success: true, message: "Resume deleted from library" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete resume" });
  }
});

export default router;
