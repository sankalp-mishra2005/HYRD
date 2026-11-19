import { generateContentWithRetry } from "../utils/gemini";
import type { ExtractedResumeInput } from "./ats.parser";
import type { AtsAnalysisResult, AtsScoreBreakdown, FormattingIssue } from "./ats.types";

const ATS_ANALYZER_SYSTEM_PROMPT = `You are HYRD's ATS Intelligence & Resume-to-Job Matching Engine.
Analyze the candidate's resume against the target Job Description (JD) with technical rigor, strict evidence grounding, and high transparency.

CRITICAL RULES:
1. Ground your analysis strictly on the actual resume text/content provided and the target JD.
2. Missing information must NOT be assumed. If a skill, degree, or metric is absent, classify it as missing or not mentioned.
3. NEVER fabricate candidate achievements, companies, dates, or numerical metrics. When suggesting improvements, propose genuine templates and prompt where the candidate can provide authentic metrics.
4. Do not reward keyword stuffing. If a skill appears only in a disconnected list without project or work context, award partial or zero demonstration credit.
5. A skill should not be marked as demonstrated merely because it appears in an unrelated context.
6. Clearly distinguish between a missing required skill and a missing preferred skill.
7. Output ONLY valid JSON matching the exact schema specified below. Do not wrap in markdown or include extra text.

Weighted Scoring Methodology (Sum = 0 to 100):
- Skills Match (0-30 pts, 30% weight): Depth and relevance of matched technical skills, programming languages, frameworks, and soft skills required by the JD.
- Required Keyword Coverage (0-20 pts, 20% weight): Presence of essential, mandatory JD keywords in the candidate's background.
- Experience Relevance (0-20 pts, 20% weight): Alignment of past job titles, responsibilities, scope, and seniority level with the role.
- Project Relevance (0-15 pts, 15% weight): Projects demonstrating practical implementation of target technologies, system architecture, or problem solving.
- Education & Qualifications (0-10 pts, 10% weight): Degrees, certifications, fields of study, and formal criteria alignment.
- Resume Structure & Readability (0-5 pts, 5% weight): ATS parseability, standard headings, clear contact details, consistent date formats, and bullet point quality.

Expected Output JSON Schema:
{
  "parsedResume": {
    "contact": {
      "name": "string",
      "email": "string | null",
      "phone": "string | null",
      "location": "string | null",
      "linkedin": "string | null",
      "github": "string | null",
      "portfolio": "string | null"
    },
    "education": [{"degree": "string", "institution": "string", "graduationYear": "string | null", "fieldOfStudy": "string | null"}],
    "experience": [{"role": "string", "company": "string", "duration": "string | null", "location": "string | null", "bullets": ["string"]}],
    "projects": [{"title": "string", "description": "string", "technologies": ["string"], "link": "string | null", "bullets": ["string"]}],
    "technicalSkills": ["string"],
    "softSkills": ["string"],
    "certifications": ["string"],
    "detectedSections": ["string"],
    "missingSections": ["string"]
  },
  "parsedJd": {
    "title": "string | null",
    "company": "string | null",
    "requiredSkills": ["string"],
    "preferredSkills": ["string"],
    "technicalTools": ["string"],
    "responsibilities": ["string"],
    "qualifications": ["string"],
    "experienceRequirements": "string | null",
    "importantKeywords": ["string"]
  },
  "overallScore": number, // 0 - 100
  "scoreBreakdown": {
    "skillsMatch": number,          // 0 - 30
    "requiredKeywords": number,     // 0 - 20
    "experienceRelevance": number,  // 0 - 20
    "projectRelevance": number,     // 0 - 15
    "educationAlignment": number,   // 0 - 10
    "structureReadability": number  // 0 - 5
  },
  "keywordMatches": {
    "matchedExact": ["string"],
    "matchedRelated": ["string"],
    "missingRequired": ["string"],
    "missingPreferred": ["string"],
    "evidenceList": [
      {
        "keyword": "string",
        "category": "Required" | "Preferred" | "Technical" | "General",
        "matched": boolean,
        "matchType": "Exact" | "Related" | "Missing",
        "evidenceQuote": "string quote from resume or null"
      }
    ]
  },
  "compatibilityChecks": {
    "standardHeadings": {"area": "Section Headings", "passed": boolean, "finding": "string", "details": "string"},
    "contactVisibility": {"area": "Contact Information", "passed": boolean, "finding": "string", "details": "string"},
    "formatConsistency": {"area": "Layout & Formatting", "passed": boolean, "finding": "string", "details": "string"},
    "dateConsistency": {"area": "Date Formats", "passed": boolean, "finding": "string", "details": "string"},
    "bulletQuality": {"area": "Bullet Point Quality", "passed": boolean, "finding": "string", "details": "string"},
    "excessiveFormatting": {"area": "Tables & Columns", "passed": boolean, "finding": "string", "details": "string"},
    "unclearAbbreviations": {"area": "Abbreviations & Acronyms", "passed": boolean, "finding": "string", "details": "string"},
    "missingSections": ["string"],
    "keywordStuffingWarnings": ["string"]
  },
  "recommendations": [
    {
      "id": "rec-1",
      "title": "string",
      "issue": "What is wrong or missing",
      "whyItMatters": "Why it matters for this specific JD",
      "howToImprove": "Actionable instructions on how candidate should improve it",
      "sectionLocation": "Where in the resume to make the change (e.g., Skills, Experience - Role X)",
      "priority": "High" | "Medium" | "Low"
    }
  ],
  "improvements": {
    "bulletPoints": [
      {
        "original": "string",
        "improved": "string",
        "reason": "string",
        "contextRoleOrProject": "string"
      }
    ],
    "projectDescriptions": [
      {
        "projectName": "string",
        "originalSummary": "string",
        "improvedSummary": "string",
        "recommendedTechHighlights": ["string"]
      }
    ],
    "impactSuggestions": [
      {
        "section": "string",
        "prompt": "string guidance asking candidate to insert their true metric",
        "exampleMetric": "string example format without fabricating numbers"
      }
    ]
  }
}`;

/**
 * Deterministically normalizes and validates the score breakdown and metrics
 */
export function normalizeAtsResult(raw: any, resumeText: string): AtsAnalysisResult {
  const sb = raw.scoreBreakdown || {};

  // 1. Strict category clamping
  const skillsMatch = Math.max(0, Math.min(30, Math.round(Number(sb.skillsMatch) || 0)));
  const requiredKeywords = Math.max(0, Math.min(20, Math.round(Number(sb.requiredKeywords) || 0)));
  const experienceRelevance = Math.max(0, Math.min(20, Math.round(Number(sb.experienceRelevance) || 0)));
  const projectRelevance = Math.max(0, Math.min(15, Math.round(Number(sb.projectRelevance) || 0)));
  const educationAlignment = Math.max(0, Math.min(10, Math.round(Number(sb.educationAlignment) || 0)));
  let structureReadability = Math.max(0, Math.min(5, Math.round(Number(sb.structureReadability) || 0)));

  // 2. Keyword Stuffing Heuristic Detection
  const keywordStuffingWarnings: string[] = Array.isArray(raw.compatibilityChecks?.keywordStuffingWarnings)
    ? [...raw.compatibilityChecks.keywordStuffingWarnings]
    : [];

  if (resumeText) {
    const words = resumeText.toLowerCase().split(/\s+/);
    const wordFreq: Record<string, number> = {};
    for (const w of words) {
      if (w.length > 3) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
        if (wordFreq[w] === 12 && !["with", "from", "that", "this", "have", "experience", "developer", "engineer", "software"].includes(w)) {
          keywordStuffingWarnings.push(`Repeated term "${w}" detected ${wordFreq[w]}+ times in resume body.`);
          structureReadability = Math.max(0, structureReadability - 1);
        }
      }
    }
  }

  // 3. Deterministic Sum Calculation
  const scoreBreakdown: AtsScoreBreakdown = {
    skillsMatch,
    requiredKeywords,
    experienceRelevance,
    projectRelevance,
    educationAlignment,
    structureReadability,
  };

  const calculatedOverallScore = Math.max(
    0,
    Math.min(
      100,
      skillsMatch +
        requiredKeywords +
        experienceRelevance +
        projectRelevance +
        educationAlignment +
        structureReadability
    )
  );

  // 4. Default Formatting Diagnostics
  const defaultIssue = (area: string): FormattingIssue => ({
    area,
    passed: true,
    finding: "Standard compliance verified.",
    details: "No formatting anomalies detected.",
  });

  const rawChecks = raw.compatibilityChecks || {};
  const compatibilityChecks = {
    standardHeadings: rawChecks.standardHeadings || defaultIssue("Section Headings"),
    contactVisibility: rawChecks.contactVisibility || defaultIssue("Contact Information"),
    formatConsistency: rawChecks.formatConsistency || defaultIssue("Layout & Formatting"),
    dateConsistency: rawChecks.dateConsistency || defaultIssue("Date Formats"),
    bulletQuality: rawChecks.bulletQuality || defaultIssue("Bullet Point Quality"),
    excessiveFormatting: rawChecks.excessiveFormatting || defaultIssue("Tables & Columns"),
    unclearAbbreviations: rawChecks.unclearAbbreviations || defaultIssue("Abbreviations & Acronyms"),
    missingSections: Array.isArray(rawChecks.missingSections) ? rawChecks.missingSections : [],
    keywordStuffingWarnings,
  };

  // 5. Sort Recommendations by Priority (High -> Medium -> Low)
  const priorityOrder: Record<string, number> = { High: 1, Medium: 2, Low: 3 };
  const recommendations = (Array.isArray(raw.recommendations) ? raw.recommendations : []).map(
    (rec: any, idx: number) => ({
      id: rec.id || `rec-${idx + 1}`,
      title: String(rec.title || "Resume Enhancement Recommendation"),
      issue: String(rec.issue || "Identified content or layout optimization area."),
      whyItMatters: String(rec.whyItMatters || "Improves overall relevance against the job description."),
      howToImprove: String(rec.howToImprove || "Revise section to explicitly articulate impact and tools."),
      sectionLocation: String(rec.sectionLocation || "General"),
      priority: (["High", "Medium", "Low"].includes(rec.priority) ? rec.priority : "Medium") as "High" | "Medium" | "Low",
    })
  ).sort((a: any, b: any) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

  // 6. Sanitize Keyword Matches
  const km = raw.keywordMatches || {};
  const keywordMatches = {
    matchedExact: Array.isArray(km.matchedExact) ? km.matchedExact.map(String) : [],
    matchedRelated: Array.isArray(km.matchedRelated) ? km.matchedRelated.map(String) : [],
    missingRequired: Array.isArray(km.missingRequired) ? km.missingRequired.map(String) : [],
    missingPreferred: Array.isArray(km.missingPreferred) ? km.missingPreferred.map(String) : [],
    evidenceList: Array.isArray(km.evidenceList)
      ? km.evidenceList.map((e: any) => ({
          keyword: String(e.keyword || ""),
          category: (["Required", "Preferred", "Technical", "General"].includes(e.category)
            ? e.category
            : "Technical") as any,
          matched: Boolean(e.matched),
          matchType: (["Exact", "Related", "Missing"].includes(e.matchType)
            ? e.matchType
            : "Exact") as any,
          evidenceQuote: e.evidenceQuote ? String(e.evidenceQuote).replace(/[`*]/g, "").trim() : null,
        }))
      : [],
  };

  return {
    parsedResume: raw.parsedResume || {
      contact: { name: "Candidate", email: null, phone: null, location: null, linkedin: null, github: null, portfolio: null },
      education: [],
      experience: [],
      projects: [],
      technicalSkills: [],
      softSkills: [],
      certifications: [],
      detectedSections: [],
      missingSections: [],
    },
    parsedJd: raw.parsedJd || {
      title: null,
      company: null,
      requiredSkills: [],
      preferredSkills: [],
      technicalTools: [],
      responsibilities: [],
      qualifications: [],
      experienceRequirements: null,
      importantKeywords: [],
    },
    overallScore: calculatedOverallScore,
    scoreBreakdown,
    keywordMatches,
    compatibilityChecks,
    recommendations,
    improvements: raw.improvements || {
      bulletPoints: [],
      projectDescriptions: [],
      impactSuggestions: [],
    },
  };
}

export class AtsService {
  /**
   * Performs deep ATS extraction, matching, scoring and recommendations
   */
  async analyze(
    resumeInput: ExtractedResumeInput,
    jdText: string,
    jobTitle?: string,
    company?: string
  ): Promise<{ result: AtsAnalysisResult; extractedResumeText: string }> {
    const contents: any[] = [];

    // If PDF, provide inlineData
    if (resumeInput.mimeType === "application/pdf" && resumeInput.pdfBase64) {
      contents.push({
        inlineData: {
          mimeType: "application/pdf",
          data: resumeInput.pdfBase64,
        },
      });
    }

    const isGeneralAudit = !jdText || jdText.includes("General Software Engineering Standards");

    const promptText = `
=== TARGET CONTEXT ===
Role Title: ${jobTitle || (isGeneralAudit ? "General Software Engineer" : "Not Specified")}
Company: ${company || (isGeneralAudit ? "General Industry Standard" : "Not Specified")}
${
  isGeneralAudit
    ? `Mode: GENERAL ATS RESUME AUDIT (No specific Job Description was provided. Audit the resume for standard ATS parseability, contact visibility, formatting consistency, section headings, action-oriented bullet quality, and technical keyword depth across industry standards.)`
    : `Mode: TARGET JOB DESCRIPTION MATCHING\nJD Text:\n${jdText}`
}

=== CANDIDATE RESUME INPUT ===
Filename: ${resumeInput.fileName}
${
  resumeInput.text
    ? `Resume Text:\n${resumeInput.text}`
    : "Resume is provided as an attached document."
}

INSTRUCTION:
${ATS_ANALYZER_SYSTEM_PROMPT}
`;

    contents.push(promptText);

    const response = await generateContentWithRetry({
      model: process.env.ATS_GEMINI_MODEL || "gemini-3.5-flash-lite",
      contents,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (!response || !response.text) {
      throw new Error("Gemini returned an empty response during ATS analysis");
    }

    const cleanJson = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    let rawData: any;

    try {
      rawData = JSON.parse(cleanJson);
    } catch (parseErr: any) {
      console.error("[ATS Service] JSON parse failed on Gemini response:", cleanJson);
      throw new Error(`Failed to parse ATS analysis response: ${parseErr.message}`);
    }

    // Derive raw text representation if not already populated
    const extractedResumeText =
      resumeInput.text ||
      `${rawData.parsedResume?.contact?.name || ""}
${rawData.parsedResume?.experience?.map((e: any) => `${e.role} at ${e.company}: ${e.bullets?.join(" ")}`).join("\n")}
${rawData.parsedResume?.projects?.map((p: any) => `${p.title}: ${p.description}`).join("\n")}
Skills: ${rawData.parsedResume?.technicalSkills?.join(", ") || ""}`;

    // Apply strict deterministic score normalizer and validation layer
    const result = normalizeAtsResult(rawData, extractedResumeText);

    return {
      result,
      extractedResumeText,
    };
  }
}

export const atsService = new AtsService();
