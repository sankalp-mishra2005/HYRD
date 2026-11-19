import { describe, it, expect } from "bun:test";
import { normalizeAtsResult } from "../ats/ats.service";

describe("Phase 3: ATS Scoring & Normalization Engine", () => {
  it("strictly clamps category scores to defined mathematical weight limits", () => {
    const rawExcessive = {
      scoreBreakdown: {
        skillsMatch: 100, // max 30
        requiredKeywords: 80, // max 20
        experienceRelevance: 50, // max 20
        projectRelevance: 40, // max 15
        educationAlignment: 30, // max 10
        structureReadability: 20, // max 5
      },
    };

    const result = normalizeAtsResult(rawExcessive, "");

    expect(result.scoreBreakdown.skillsMatch).toBe(30);
    expect(result.scoreBreakdown.requiredKeywords).toBe(20);
    expect(result.scoreBreakdown.experienceRelevance).toBe(20);
    expect(result.scoreBreakdown.projectRelevance).toBe(15);
    expect(result.scoreBreakdown.educationAlignment).toBe(10);
    expect(result.scoreBreakdown.structureReadability).toBe(5);
    expect(result.overallScore).toBe(100);
  });

  it("handles negative and NaN score inputs by clamping to 0", () => {
    const rawNegative = {
      scoreBreakdown: {
        skillsMatch: -10,
        requiredKeywords: -5,
        experienceRelevance: "invalid",
        projectRelevance: NaN,
        educationAlignment: null,
        structureReadability: undefined,
      },
    };

    const result = normalizeAtsResult(rawNegative, "");

    expect(result.scoreBreakdown.skillsMatch).toBe(0);
    expect(result.scoreBreakdown.requiredKeywords).toBe(0);
    expect(result.scoreBreakdown.experienceRelevance).toBe(0);
    expect(result.scoreBreakdown.projectRelevance).toBe(0);
    expect(result.scoreBreakdown.educationAlignment).toBe(0);
    expect(result.scoreBreakdown.structureReadability).toBe(0);
    expect(result.overallScore).toBe(0);
  });

  it("calculates overallScore deterministically from sum of components", () => {
    const rawValid = {
      scoreBreakdown: {
        skillsMatch: 24, // out of 30
        requiredKeywords: 16, // out of 20
        experienceRelevance: 15, // out of 20
        projectRelevance: 12, // out of 15
        educationAlignment: 8, // out of 10
        structureReadability: 4, // out of 5
      },
    };

    const result = normalizeAtsResult(rawValid, "");

    // 24 + 16 + 15 + 12 + 8 + 4 = 79
    expect(result.overallScore).toBe(79);
    expect(result.scoreBreakdown.skillsMatch).toBe(24);
  });

  it("detects keyword stuffing and applies structure readability penalty", () => {
    const stuffedText = Array(15).fill("kubernetes").join(" ") + " John Doe resume text with some words";
    const raw = {
      scoreBreakdown: {
        skillsMatch: 20,
        requiredKeywords: 15,
        experienceRelevance: 15,
        projectRelevance: 10,
        educationAlignment: 5,
        structureReadability: 5,
      },
      compatibilityChecks: {
        keywordStuffingWarnings: [],
      },
    };

    const result = normalizeAtsResult(raw, stuffedText);

    expect(result.scoreBreakdown.structureReadability).toBe(4); // penalized by 1 from 5
    expect(result.compatibilityChecks.keywordStuffingWarnings.length).toBeGreaterThan(0);
    expect(result.compatibilityChecks.keywordStuffingWarnings[0]).toContain("kubernetes");
  });

  it("sorts recommendations by priority: High -> Medium -> Low", () => {
    const raw = {
      recommendations: [
        { id: "1", priority: "Low", title: "Add hobbies" },
        { id: "2", priority: "High", title: "Add missing Docker requirement" },
        { id: "3", priority: "Medium", title: "Improve project descriptions" },
      ],
    };

    const result = normalizeAtsResult(raw, "");

    expect(result.recommendations.map(r => r.priority)).toEqual(["High", "Medium", "Low"]);
    expect(result.recommendations[0]?.title).toBe("Add missing Docker requirement");
  });

  it("provides fallback diagnostics for all required compatibility areas", () => {
    const rawEmpty = {};

    const result = normalizeAtsResult(rawEmpty, "");

    expect(result.compatibilityChecks.standardHeadings).toBeDefined();
    expect(result.compatibilityChecks.standardHeadings?.passed).toBe(true);
    expect(result.compatibilityChecks.contactVisibility).toBeDefined();
    expect(result.compatibilityChecks.formatConsistency).toBeDefined();
    expect(result.compatibilityChecks.dateConsistency).toBeDefined();
    expect(result.compatibilityChecks.bulletQuality).toBeDefined();
    expect(result.compatibilityChecks.excessiveFormatting).toBeDefined();
    expect(result.compatibilityChecks.unclearAbbreviations).toBeDefined();
    expect(Array.isArray(result.compatibilityChecks.missingSections)).toBe(true);
  });

  it("preserves verbatim keyword match evidence list and structures", () => {
    const raw = {
      keywordMatches: {
        matchedExact: ["React", "TypeScript"],
        matchedRelated: ["PostgreSQL -> SQL"],
        missingRequired: ["AWS", "Docker"],
        missingPreferred: ["GraphQL"],
        evidenceList: [
          {
            keyword: "React",
            category: "Required",
            matched: true,
            matchType: "Exact",
            evidenceQuote: "Built responsive UI using React 18 and Next.js",
          },
        ],
      },
    };

    const result = normalizeAtsResult(raw, "");

    expect(result.keywordMatches.matchedExact).toEqual(["React", "TypeScript"]);
    expect(result.keywordMatches.missingRequired).toEqual(["AWS", "Docker"]);
    expect(result.keywordMatches.evidenceList?.[0]?.evidenceQuote).toBe("Built responsive UI using React 18 and Next.js");
  });
});
