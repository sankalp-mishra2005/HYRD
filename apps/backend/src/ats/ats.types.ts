export interface ParsedContact {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
}

export interface ParsedEducation {
  degree: string;
  institution: string;
  graduationYear: string | null;
  fieldOfStudy: string | null;
}

export interface ParsedExperience {
  role: string;
  company: string;
  duration: string | null;
  location: string | null;
  bullets: string[];
}

export interface ParsedProject {
  title: string;
  description: string;
  technologies: string[];
  link: string | null;
  bullets: string[];
}

export interface ParsedResume {
  contact: ParsedContact;
  education: ParsedEducation[];
  experience: ParsedExperience[];
  projects: ParsedProject[];
  technicalSkills: string[];
  softSkills: string[];
  certifications: string[];
  detectedSections: string[];
  missingSections: string[];
}

export interface ParsedJobDescription {
  title: string | null;
  company: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  technicalTools: string[];
  responsibilities: string[];
  qualifications: string[];
  experienceRequirements: string | null;
  importantKeywords: string[];
}

export interface AtsScoreBreakdown {
  skillsMatch: number;          // 0 - 30 (Weight: 30%)
  requiredKeywords: number;     // 0 - 20 (Weight: 20%)
  experienceRelevance: number;  // 0 - 20 (Weight: 20%)
  projectRelevance: number;     // 0 - 15 (Weight: 15%)
  educationAlignment: number;   // 0 - 10 (Weight: 10%)
  structureReadability: number; // 0 - 5  (Weight: 5%)
}

export interface KeywordMatchEvidence {
  keyword: string;
  category: "Required" | "Preferred" | "Technical" | "General";
  matched: boolean;
  matchType: "Exact" | "Related" | "Missing";
  evidenceQuote: string | null;
}

export interface KeywordMatchesData {
  matchedExact: string[];
  matchedRelated: string[];
  missingRequired: string[];
  missingPreferred: string[];
  evidenceList: KeywordMatchEvidence[];
}

export interface FormattingIssue {
  area: string;
  passed: boolean;
  finding: string;
  details: string;
}

export interface AtsCompatibilityChecks {
  standardHeadings: FormattingIssue;
  contactVisibility: FormattingIssue;
  formatConsistency: FormattingIssue;
  dateConsistency: FormattingIssue;
  bulletQuality: FormattingIssue;
  excessiveFormatting: FormattingIssue;
  unclearAbbreviations: FormattingIssue;
  missingSections: string[];
  keywordStuffingWarnings: string[];
}

export interface AtsRecommendation {
  id: string;
  title: string;
  issue: string;
  whyItMatters: string;
  howToImprove: string;
  sectionLocation: string;
  priority: "High" | "Medium" | "Low";
}

export interface BulletImprovement {
  original: string;
  improved: string;
  reason: string;
  contextRoleOrProject: string;
}

export interface AtsImprovements {
  bulletPoints: BulletImprovement[];
  projectDescriptions: {
    projectName: string;
    originalSummary: string;
    improvedSummary: string;
    recommendedTechHighlights: string[];
  }[];
  impactSuggestions: {
    section: string;
    prompt: string;
    exampleMetric: string;
  }[];
}

export interface AtsAnalysisResult {
  parsedResume: ParsedResume;
  parsedJd: ParsedJobDescription;
  overallScore: number;
  scoreBreakdown: AtsScoreBreakdown;
  keywordMatches: KeywordMatchesData;
  compatibilityChecks: AtsCompatibilityChecks;
  recommendations: AtsRecommendation[];
  improvements: AtsImprovements;
}

