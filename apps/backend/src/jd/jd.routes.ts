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

function normalizeInterviewFocus(rawFocus: any) {
  const priority = rawFocus?.priority;
  const questions = rawFocus?.expectedQuestions;
  const diff = rawFocus?.difficulty;

  return {
    priority: Array.isArray(priority) ? priority.map((p: any) => ({
      topic: String(p.topic || p),
      priority: String(p.priority || "Medium"),
      estimatedPrepTime: String(p.estimatedPrepTime || "30 min"),
      impact: String(p.impact || "Medium")
    })) : [],
    expectedQuestions: Array.isArray(questions) ? questions.map((q: any) => ({
      question: String(q.question || q),
      reason: String(q.reason || "Frequently asked for this stack."),
      evidence: Array.isArray(q.evidence) ? q.evidence.map(String) : [],
      confidence: Number(q.confidence ?? 0.85)
    })) : [],
    difficulty: String(diff || "Medium")
  };
}

/**
 * Compare Resume PDF with a Job Description
 */
router.post("/match", authMiddleware, upload.single("resume"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    const { jdText, resumeId, company, title } = req.body;
    const userId = req.user.id;

    if (!jdText) {
      res.status(400).json({ error: "Job Description text is required" });
      return;
    }

    let result;
    try {
      let parsedResume;
      if (file) {
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

        // 1. Parse Resume first
        const resumeParseResp = await generateContentWithRetry({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                mimeType: mimeType,
                data: file.buffer.toString("base64"),
              },
            },
            PROMPTS.resumeParser.instruction,
          ],
          config: {
            responseMimeType: "application/json",
          },
        });
        parsedResume = JSON.parse(resumeParseResp.text!.replace(/```json/g, "").replace(/```/g, "").trim());
      } else if (resumeId && resumeId !== "none") {
        // Get the latest ResumeAnalysis for the user
        const latestAnalysis = await prisma.resumeAnalysis.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" }
        });
        if (latestAnalysis) {
          parsedResume = {
            skills: latestAnalysis.skills || [],
            experience: latestAnalysis.strengths || []
          };
        } else {
          parsedResume = {
            skills: ["React", "TypeScript", "Node.js"],
            experience: []
          };
        }
      } else {
        res.status(400).json({ error: "Resume file or selected resumeId is required" });
        return;
      }

      // 2. Match with JD
      const matcherPrompt = `
        Compare this candidate profile with the Job Description (JD).
        Candidate profile:
        - Skills: ${JSON.stringify(parsedResume.skills || [])}
        - Experience: ${JSON.stringify(parsedResume.experience || [])}
        
        Job Description:
        ${jdText}
      `;

      const matchResponse = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [matcherPrompt, PROMPTS.jdMatcher.instruction],
        config: {
          responseMimeType: "application/json",
        },
      });

      const cleanText = matchResponse.text!.replace(/```json/g, "").replace(/```/g, "").trim();
      result = JSON.parse(cleanText);
    } catch (apiError: any) {
      console.error("JD Matcher API failed:", apiError);
      res.status(500).json({ error: `AI Job Matcher failed: ${apiError.message || apiError}` });
      return;
    }

    const normalizedFocus = {
      ...normalizeInterviewFocus(result.interviewFocus),
      company: company || "General",
      jdTitle: title || "Software Engineer"
    };

    // Save to DB
    const saved = await prisma.jDMatch.create({
      data: {
        userId,
        matchPercentage: result.matchPercentage || 0,
        matchingSkills: result.matchingSkills || [],
        missingSkills: result.missingSkills || [],
        fitAnalysis: result.fitAnalysis || "",
        jdText,
        interviewFocus: normalizedFocus as any,
      },
    });

    // Log Activity
    await prisma.auditLog.create({
      data: {
        userId,
        action: "JD_MATCHED",
        details: `Matched resume with JD, match score: ${result.matchPercentage}%`,
      },
    });

    res.json(saved);
  } catch (error: any) {
    console.error("JD Matcher error:", error);
    res.status(500).json({ error: "Failed to calculate job description match. Please try again." });
  }
});

/**
 * Get all historical matches
 */
router.get("/matches", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const matches = await prisma.jDMatch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: "Failed to load JD matches history" });
  }
});

/**
 * Save Job Description to Library
 */
router.post("/library", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, company, jdText } = req.body;
    const userId = req.user.id;

    if (!title || !jdText) {
      res.status(400).json({ error: "Title and JD text are required" });
      return;
    }

    const saved = await prisma.jobDescription.create({
      data: {
        userId,
        title,
        company: company || null,
        jdText,
      },
    });

    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: "Failed to save JD to library" });
  }
});

/**
 * Get saved Job Descriptions
 */
router.get("/library", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const jds = await prisma.jobDescription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(jds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch JD library" });
  }
});

/**
 * Delete saved JD
 */
router.delete("/library/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user.id;

    await prisma.jobDescription.deleteMany({
      where: { id, userId },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete JD" });
  }
});

export default router;
