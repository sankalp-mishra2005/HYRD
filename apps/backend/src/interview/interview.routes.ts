import { Router, type Response } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { prisma } from "../../db";
import { PROMPTS } from "../../prompts";
import { scrapeGithub } from "../../scrapers/github";
import { generateContentWithRetry } from "../utils/gemini";
import { authMiddleware, type AuthenticatedRequest } from "../auth/auth.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * Get all historical interviews of user
 */
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const interviews = await prisma.interview.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch interview history" });
  }
});

/**
 * Configure and start a new interview session (Knowledge Fusion)
 */
router.post(
  "/pre-interview",
  authMiddleware,
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "linkedin", maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role, company, experienceLevel, duration, jobDescription, github, difficulty, language, interviewType, linkedinUrl } = req.body;
      const durationVal = parseInt(duration || "30", 10);
      const userId = req.user.id;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const resumeFile = files?.["resume"]?.[0];
      const linkedinFile = files?.["linkedin"]?.[0];

      if (resumeFile) {
        const mime = resumeFile.mimetype;
        const isDocx = mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || resumeFile.originalname.endsWith(".docx");
        const isPdf = mime === "application/pdf" || resumeFile.originalname.endsWith(".pdf");
        const isTxt = mime === "text/plain" || resumeFile.originalname.endsWith(".txt");

        if (!isDocx && !isPdf && !isTxt) {
          res.status(400).json({ error: "Unsupported resume format. Please upload a PDF, DOCX, or TXT file." });
          return;
        }
      }

      if (linkedinFile) {
        const mime = linkedinFile.mimetype;
        const isDocx = mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || linkedinFile.originalname.endsWith(".docx");
        const isPdf = mime === "application/pdf" || linkedinFile.originalname.endsWith(".pdf");
        const isTxt = mime === "text/plain" || linkedinFile.originalname.endsWith(".txt");

        if (!isDocx && !isPdf && !isTxt) {
          res.status(400).json({ error: "Unsupported profile format. Please upload a PDF, DOCX, or TXT file." });
          return;
        }
      }

      let githubData: any = null;
      let githubUsername = "";

      // 1. Scrape Github if username or profile URL provided
      if (github && github.trim() !== "") {
        try {
          const cleanGithub = github.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/+$/, "");
          githubUsername = cleanGithub.split("/")[0] || cleanGithub;
          if (githubUsername) {
            githubData = await scrapeGithub(githubUsername);
          }
        } catch (error) {
          console.warn("Notice: GitHub repo extraction:", (error as any)?.message || error);
        }
      }

      // 2. Parse Resume (PDF, DOCX, or TXT)
      let resumeParsedJson: any = null;
      if (resumeFile) {
        try {
          const isDocx = resumeFile.originalname.endsWith(".docx") || resumeFile.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          
          if (isDocx) {
            const mammothResult = await mammoth.extractRawText({ buffer: resumeFile.buffer });
            const docxText = mammothResult.value;
            const response = await generateContentWithRetry({
              model: "gemini-3.5-flash",
              contents: [
                `Here is the candidate's resume extracted from DOCX document:\n\n${docxText}`,
                PROMPTS.resumeParser.instruction,
              ],
              config: {
                responseMimeType: "application/json",
              },
            });
            const cleanText = response.text!.replace(/```json/g, "").replace(/```/g, "").trim();
            resumeParsedJson = JSON.parse(cleanText);
          } else {
            let resumeMime = resumeFile.mimetype;
            if (resumeFile.originalname.endsWith(".txt")) {
              resumeMime = "text/plain";
            }
            const response = await generateContentWithRetry({
              model: "gemini-3.5-flash",
              contents: [
                {
                  inlineData: {
                    mimeType: resumeMime,
                    data: resumeFile.buffer.toString("base64"),
                  },
                },
                PROMPTS.resumeParser.instruction,
              ],
              config: {
                responseMimeType: "application/json",
              },
            });
            const cleanText = response.text!.replace(/```json/g, "").replace(/```/g, "").trim();
            resumeParsedJson = JSON.parse(cleanText);
          }
        } catch (error) {
          console.error("Error parsing Resume file:", error);
        }
      }

      // 3. Parse LinkedIn Export (PDF, DOCX, or TXT)
      let linkedinParsedJson: any = null;
      if (linkedinFile) {
        try {
          const isDocx = linkedinFile.originalname.endsWith(".docx") || linkedinFile.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          if (isDocx) {
            const mammothResult = await mammoth.extractRawText({ buffer: linkedinFile.buffer });
            const docxText = mammothResult.value;
            const response = await generateContentWithRetry({
              model: "gemini-3.5-flash",
              contents: [
                `Here is the candidate's LinkedIn profile extracted from document:\n\n${docxText}`,
                PROMPTS.linkedinParser.instruction,
              ],
              config: {
                responseMimeType: "application/json",
              },
            });
            const cleanText = response.text!.replace(/```json/g, "").replace(/```/g, "").trim();
            linkedinParsedJson = JSON.parse(cleanText);
          } else {
            let linkedinMime = linkedinFile.mimetype;
            if (linkedinFile.originalname.endsWith(".txt")) {
              linkedinMime = "text/plain";
            }
            const response = await generateContentWithRetry({
              model: "gemini-3.5-flash",
              contents: [
                {
                  inlineData: {
                    mimeType: linkedinMime,
                    data: linkedinFile.buffer.toString("base64"),
                  },
                },
                PROMPTS.linkedinParser.instruction,
              ],
              config: {
                responseMimeType: "application/json",
              },
            });
            const cleanText = response.text!.replace(/```json/g, "").replace(/```/g, "").trim();
            linkedinParsedJson = JSON.parse(cleanText);
          }
        } catch (error) {
          console.error("Error parsing LinkedIn export:", error);
        }
      }

      // 4. Perform Knowledge Fusion
      let summary = "";
      let profileJson: any = {
        role,
        company: company || null,
        experienceLevel: experienceLevel || "Fresher",
        jobDescription: jobDescription || null,
      };

      try {
        const fusionPrompt = `
        Perform candidate profile knowledge fusion. Here is the candidate's context data:
        - Resume: ${JSON.stringify(resumeParsedJson || {})}
        - LinkedIn Profile Data: ${JSON.stringify(linkedinParsedJson || {})} ${linkedinUrl ? `(LinkedIn URL: ${linkedinUrl})` : ""}
        - GitHub Public Repositories: ${JSON.stringify(githubData || {})} ${github ? `(GitHub Profile: ${github})` : ""}
        - Target Role: ${role || "Software Engineer"}
        - Target Job Description: ${jobDescription || "Standard industry engineering expectations"}
        `;

        const fusionResponse = await generateContentWithRetry({
          model: "gemini-3.5-flash",
          contents: [fusionPrompt, PROMPTS.knowledgeFusion.instruction],
          config: {
            responseMimeType: "application/json",
          },
        });

        const cleanText = fusionResponse.text!.replace(/```json/g, "").replace(/```/g, "").trim();
        const fusionResult = JSON.parse(cleanText);
        summary = fusionResult.summary || "";
        profileJson = fusionResult.profileJson || profileJson;

        // Normalize fused profileJson Knowledge Graph structures
        if (profileJson) {
          profileJson.skills = Array.isArray(profileJson.skills) ? profileJson.skills.map((s: any) => ({
            name: String(s.name || s),
            confidence: Number(s.confidence ?? 0.8),
            source: Array.isArray(s.source) ? s.source.map(String) : ["Resume"],
            evidence: Array.isArray(s.evidence) ? s.evidence.map(String) : []
          })) : [];
          profileJson.projects = Array.isArray(profileJson.projects) ? profileJson.projects.map((p: any) => ({
            name: String(p.name || p),
            description: String(p.description || "Identified project in knowledge base."),
            technologies: Array.isArray(p.technologies) ? p.technologies.map(String) : [],
            evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : []
          })) : [];
          profileJson.strengths = Array.isArray(profileJson.strengths) ? profileJson.strengths.map((s: any) => ({
            title: String(s.title || s),
            evidence: Array.isArray(s.evidence) ? s.evidence.map(String) : []
          })) : [];
          profileJson.weaknesses = Array.isArray(profileJson.weaknesses) ? profileJson.weaknesses.map((w: any) => ({
            title: String(w.title || w),
            evidence: Array.isArray(w.evidence) ? w.evidence.map(String) : []
          })) : [];
        }
      } catch (fusionError: any) {
        console.warn(
          "[Knowledge Fusion] Gemini fallback - proceeding with form data:",
          fusionError?.message ?? fusionError
        );
      }

      // 5. Save Fused Profile to DB
      const profile = await prisma.candidateProfile.create({
        data: {
          githubUrl: github || null,
          githubData: githubData ? githubData : null,
          summary: summary || "",
          profileJson: profileJson || {},
        },
      });

      // 6. Create Interview Session with userId
      const interview = await prisma.interview.create({
        data: {
          userId,
          status: "Pre",
          role: role || "Software Engineer",
          company: company || null,
          experienceLevel: experienceLevel || "Fresher",
          duration: durationVal,
          jobDescription: jobDescription || null,
          difficulty: difficulty || "Adaptive",
          language: language || "English",
          interviewType: interviewType || "Technical Interview",
          candidateProfileId: profile.id,
        },
      });

      // Log Activity
      await prisma.auditLog.create({
        data: {
          userId,
          action: "INTERVIEW_STARTED",
          details: `Configured new mock interview for role: "${role}" at "${company || 'Default Company'}"`,
        },
      });

      res.json({ id: interview.id });
    } catch (e: any) {
      console.error("Error in pre-interview router:", e);
      res.status(500).json({ error: "Failed to initialize interview profile. Please try again." });
    }
  }
);

/**
 * Get interview configuration details (reader only, never triggers evaluation)
 */
router.get("/details/:interviewId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const interviewId = req.params.interviewId as string;
    const userId = req.user.id;

    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, userId },
      include: { candidateProfile: true, conversations: true },
    });

    if (!interview) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    res.json(interview);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch interview details" });
  }
});

const activeEvaluations = new Set<string>();

async function evaluateInterviewTranscript(interviewId: string, userId: string) {
  if (activeEvaluations.has(interviewId)) {
    console.log(`[Evaluation] Evaluation already in flight for interview ${interviewId}, skipping concurrent request.`);
    return;
  }

  const interview = (await prisma.interview.findFirst({
    where: { id: interviewId, userId },
    include: { conversations: true },
  })) as any;

  if (!interview) {
    throw new Error("Interview not found");
  }

  if (interview.status === "Done") {
    return;
  }

  if (interview.conversations.length === 0) {
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: "Done",
        score: 0,
        feedback: "No conversation turns were recorded in this interview session.",
      },
    });
    return;
  }

  activeEvaluations.add(interviewId);

  try {
    const transcriptText = interview.conversations
      .map((c: any) => `${c.type}: ${c.message}`)
      .join("\n");

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

    const response = await generateContentWithRetry({
      model,
      contents: [`Transcript:\n${transcriptText}`, PROMPTS.evaluation.instruction],
      config: {
        responseMimeType: "application/json",
      },
    });

    const cleanText = response.text!.replace(/```json/g, "").replace(/```/g, "").trim();
    let evalResult: any;
    try {
      evalResult = JSON.parse(cleanText);
    } catch (parseErr) {
      console.warn("[Evaluation] JSON parse error, attempting extraction:", parseErr);
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evalResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse evaluation output as JSON");
      }
    }

    let hireReport = null;
    try {
      const reportResponse = await generateContentWithRetry({
        model,
        contents: [
          `Based on the following interview transcript, act as an AI Recruiter and generate a hiring recommendation report.
          Transcript:
          ${transcriptText}
          
          Output ONLY a valid JSON matching this schema:
          {
            "decision": "YES" | "NO",
            "confidence": number,
            "strengths": ["string"],
            "weaknesses": ["string"],
            "recommendation": "A detailed recruiter recommendation text (2-3 sentences) outlining whether to proceed and why."
          }
          Do not include markdown wraps (like \`\`\`json) or any extra text.`
        ],
        config: {
          responseMimeType: "application/json",
        },
      });
      const cleanReportText = reportResponse.text!.replace(/```json/g, "").replace(/```/g, "").trim();
      hireReport = JSON.parse(cleanReportText);
    } catch (reportErr) {
      console.error("Error generating recruiter report:", reportErr);
    }

    const questionsData = Array.isArray(evalResult.questions)
      ? evalResult.questions.map((q: any) => ({
          interviewId,
          topic: String(q.topic || "Technical"),
          questionText: String(q.questionText || "Question"),
          answerText: q.answerText ? String(q.answerText) : null,
          score: typeof q.score === "number" ? Math.max(0, Math.min(10, Math.round(q.score))) : null,
          feedback: q.feedback ? String(q.feedback) : null,
          difficulty: q.difficulty ? String(q.difficulty) : "Medium",
        }))
      : [];

    await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({
        where: { interviewId },
      });

      if (questionsData.length > 0) {
        await tx.question.createMany({
          data: questionsData,
        });
      }

      await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: "Done",
          score: typeof evalResult.score === "number" ? Math.max(0, Math.min(100, Math.round(evalResult.score))) : 0,
          feedback: evalResult.feedback || "Evaluation completed.",
          hireReport: hireReport,
        },
      });
    });
  } finally {
    activeEvaluations.delete(interviewId);
  }
}

/**
 * Conclude interview session and generate evaluation
 */
router.post("/conclude/:interviewId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const interviewId = req.params.interviewId as string;
    const userId = req.user.id;

    await evaluateInterviewTranscript(interviewId, userId);
    res.json({ success: true, message: "Interview concluded and evaluated." });
  } catch (error: any) {
    console.error("Conclude interview error:", error);
    res.status(500).json({ error: error.message || "Failed to conclude interview" });
  }
});

/**
 * Get results/evaluate transcript
 */
router.get("/result/:interviewId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const interviewId = req.params.interviewId as string;
    const userId = req.user.id;
    const shouldEvaluate = req.query.evaluate === "true";

    let interview = (await prisma.interview.findFirst({
      where: { id: interviewId, userId },
      include: { conversations: true, questions: true },
    })) as any;

    if (!interview) {
      res.status(404).json({ message: "Interview not found" });
      return;
    }

    // Only trigger evaluation if explicitly requested and not already done or in-flight
    if (interview.status !== "Done" && shouldEvaluate && interview.conversations.length > 0 && !activeEvaluations.has(interviewId)) {
      try {
        await evaluateInterviewTranscript(interviewId, userId);
      } catch (error: any) {
        console.error("Transcript evaluation failed:", error);
        res.status(500).json({ error: `AI Transcript Evaluation failed: ${error.message || error}` });
        return;
      }
    }

    const finalInterview = (await prisma.interview.findFirst({
      where: { id: interviewId, userId },
      include: { questions: true, conversations: true, codingSubmissions: { include: { challenge: true } } },
    })) as any;

    res.json({
      id: finalInterview?.id,
      isEvaluating: activeEvaluations.has(interviewId),
      role: finalInterview?.role,
      company: finalInterview?.company,
      duration: finalInterview?.duration,
      experienceLevel: finalInterview?.experienceLevel,
      jobDescription: finalInterview?.jobDescription,
      score: finalInterview?.score,
      feedback: finalInterview?.feedback,
      questions: finalInterview?.questions || [],
      status: finalInterview?.status,
      difficulty: finalInterview?.difficulty,
      language: finalInterview?.language,
      interviewType: finalInterview?.interviewType,
      liveMetrics: finalInterview?.liveMetrics,
      hireReport: finalInterview?.hireReport,
      conversations: finalInterview?.conversations || [],
      codingSubmissions: finalInterview?.codingSubmissions || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load results." });
  }
});

/**
 * Generate coding challenge
 */
router.get("/coding/challenge/:interviewId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const interviewId = req.params.interviewId as string;
    const userId = req.user.id;

    const interview = (await prisma.interview.findFirst({
      where: { id: interviewId, userId },
    })) as any;

    if (!interview) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    const challengePrompt = `
      Create a coding challenge for a candidate interviewing for the role of ${interview.role} at the experience level of ${interview.experienceLevel} with target difficulty ${interview.difficulty}.
      Output ONLY valid JSON.
      {
        "title": "string",
        "description": "string (Markdown format)",
        "starterCode": "string (Starter code function)",
        "difficulty": "Easy" | "Medium" | "Hard",
        "testCases": [
          { "input": "string input", "output": "string output" }
        ]
      }
    `;

    let challengeJson;
    try {
      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [challengePrompt],
        config: {
          responseMimeType: "application/json",
        },
      });
      const cleanText = response.text!.replace(/```json/g, "").replace(/```/g, "").trim();
      challengeJson = JSON.parse(cleanText);
    } catch (apiError) {
      challengeJson = {
        title: "Array Product Except Self",
        description: "Given an integer array `nums`, return an array `answer`.",
        starterCode: "function productExceptSelf(nums) {\n  return [];\n}",
        difficulty: "Medium",
        testCases: [{ input: "[1,2,3,4]", output: "[24,12,8,6]" }]
      };
    }

    const challenge = await prisma.codingChallenge.create({
      data: {
        title: challengeJson.title || "Algorithm Challenge",
        description: challengeJson.description || "",
        starterCode: challengeJson.starterCode || "function solution() {\n\n}",
        difficulty: challengeJson.difficulty || interview.difficulty || "Medium",
        testCases: challengeJson.testCases || [],
      },
    });

    res.json(challenge);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate challenge" });
  }
});

/**
 * Submit coding solution
 */
router.post("/coding/submit", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { interviewId, challengeId, submittedCode } = req.body;
    const userId = req.user.id;

    if (!interviewId || !challengeId || !submittedCode) {
      res.status(400).json({ error: "interviewId, challengeId, and submittedCode are required" });
      return;
    }

    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, userId },
    });

    if (!interview) {
      res.status(404).json({ error: "Interview access denied" });
      return;
    }

    const challenge = await prisma.codingChallenge.findFirst({
      where: { id: challengeId },
    });

    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" });
      return;
    }

    const evaluationPrompt = `
      Evaluate candidate code:
      Challenge: ${challenge.title}
      Code: ${submittedCode}
    `;

    let evaluation;
    try {
      const evalResponse = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [evaluationPrompt, PROMPTS.codingObserver.instruction],
        config: {
          responseMimeType: "application/json",
        },
      });
      const cleanText = evalResponse.text!.replace(/```json/g, "").replace(/```/g, "").trim();
      evaluation = JSON.parse(cleanText);
    } catch (error: any) {
      console.error("Code evaluation failed:", error);
      res.status(500).json({ error: `AI Coding Evaluation failed: ${error.message || error}` });
      return;
    }

    const submission = await prisma.codingSubmission.create({
      data: {
        interviewId,
        challengeId,
        submittedCode,
        status: evaluation.status || "Failed",
        timeComplexity: evaluation.timeComplexity || "Unknown",
        spaceComplexity: evaluation.spaceComplexity || "Unknown",
        feedback: evaluation.feedback || "",
        score: evaluation.score || 0,
      },
    });

    res.json(submission);
  } catch (error) {
    res.status(500).json({ error: "Failed to evaluate coding submission" });
  }
});

export default router;
