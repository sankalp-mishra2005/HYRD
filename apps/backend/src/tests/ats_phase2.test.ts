import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../../db";
import { auth } from "../auth/auth.config";
import { validateFileMagicBytes } from "../ats/ats.parser";

const BASE_URL = "http://localhost:3001";

describe("HYRD v1.1 ATS Intelligence — Phase 2 Test Suite", () => {
  const userAEmail = `ats.user.a.${Date.now()}@hyrd.ai`;
  const userBEmail = `ats.user.b.${Date.now()}@hyrd.ai`;
  const testPassword = "ValidPassword123!";

  let cookieA: string;
  let cookieB: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    // 1. Sign up User A via Better Auth API to obtain genuine cryptographically signed cookie
    const respA = await auth.api.signUpEmail({
      body: {
        email: userAEmail,
        password: testPassword,
        name: "ATS Candidate A",
      },
      asResponse: true,
    });

    const setCookieHeaderA = respA.headers.get("set-cookie") || "";
    const matchA = setCookieHeaderA.match(/(better-auth\.session_token=[^;]+)/);
    cookieA = matchA && matchA[1] ? matchA[1] : "";

    const userARecord = await prisma.user.findUnique({ where: { email: userAEmail } });
    if (!userARecord) throw new Error("User A was not created by Better Auth");
    userAId = userARecord.id;

    // 2. Sign up User B (Adversary for cross-tenant tests)
    const respB = await auth.api.signUpEmail({
      body: {
        email: userBEmail,
        password: testPassword,
        name: "ATS Candidate B",
      },
      asResponse: true,
    });

    const setCookieHeaderB = respB.headers.get("set-cookie") || "";
    const matchB = setCookieHeaderB.match(/(better-auth\.session_token=[^;]+)/);
    cookieB = matchB && matchB[1] ? matchB[1] : "";

    const userBRecord = await prisma.user.findUnique({ where: { email: userBEmail } });
    if (!userBRecord) throw new Error("User B was not created by Better Auth");
    userBId = userBRecord.id;
  });

  afterAll(async () => {
    // Clean up test session and user records
    await prisma.atsAnalysis.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.account.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
  });

  describe("1. File Parsing & Magic Byte MIME Validation", () => {
    it("accepts authentic PDF buffer starting with %PDF-", () => {
      const pdfBuffer = Buffer.from("%PDF-1.4\n%dummy pdf content stream");
      const type = validateFileMagicBytes(pdfBuffer, "my_resume.pdf");
      expect(type).toBe("pdf");
    });

    it("rejects spoofed PDF file (e.g. text file renamed to .pdf)", () => {
      const spoofedBuffer = Buffer.from("Hello world, this is a plain text file pretending to be PDF");
      expect(() => validateFileMagicBytes(spoofedBuffer, "fake.pdf")).toThrow();
    });

    it("accepts authentic DOCX buffer starting with PK zip header", () => {
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      const type = validateFileMagicBytes(docxHeader, "resume.docx");
      expect(type).toBe("docx");
    });

    it("rejects spoofed DOCX file (e.g. text file renamed to .docx)", () => {
      const spoofedBuffer = Buffer.from("Not a real zip archive file");
      expect(() => validateFileMagicBytes(spoofedBuffer, "fake.docx")).toThrow();
    });

    it("accepts plain text buffer", () => {
      const txtBuffer = Buffer.from("Senior Software Engineer\nSkills: React, Node.js, TypeScript\nExperience: 5 years");
      const type = validateFileMagicBytes(txtBuffer, "resume.txt");
      expect(type).toBe("txt");
    });

    it("rejects empty buffer", () => {
      expect(() => validateFileMagicBytes(Buffer.alloc(0), "empty.pdf")).toThrow();
    });
  });

  describe("2. Authentication & Authorization Enforcement", () => {
    it("rejects unauthenticated GET /api/v1/ats with HTTP 401", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Unauthorized");
    });

    it("rejects unauthenticated POST /api/v1/ats/analyze with HTTP 401", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats/analyze`, {
        method: "POST",
        body: new FormData(),
      });
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated GET /api/v1/ats/:id with HTTP 401", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats/some-test-id`);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated DELETE /api/v1/ats/:id with HTTP 401", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats/some-test-id`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("3. Input Validation & Error Handling", () => {
    it("allows Job Description to be optional (runs general ATS audit without requiring JD)", async () => {
      // In HYRD v1.1, Job Description is non-compulsory for general ATS audits
      const form = new FormData();
      form.append("resume", new Blob(["Senior Software Engineer with TypeScript and React experience."], { type: "text/plain" }), "resume.txt");

      // Verify that missing jdText does NOT return 400 Job Description error
      const res = await fetch(`${BASE_URL}/api/v1/ats/analyze`, {
        method: "POST",
        headers: {
          cookie: cookieA,
        },
        body: form,
      });

      // The response should NOT fail with a 400 Job Description validation error
      expect(res.status).not.toBe(400);
    }, 50000);

    it("returns HTTP 400 when no resume file is provided", async () => {
      const form = new FormData();
      form.append("jdText", "Looking for a Senior Software Engineer proficient in React, TypeScript, and Bun.");

      const res = await fetch(`${BASE_URL}/api/v1/ats/analyze`, {
        method: "POST",
        headers: {
          cookie: cookieA,
        },
        body: form,
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("upload a resume file");
    });

    it("returns HTTP 400 when uploaded file fails magic byte validation", async () => {
      const form = new FormData();
      // Send arbitrary binary payload disguised as a PDF
      form.append("resume", new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])], { type: "application/pdf" }), "corrupt.pdf");
      form.append("jdText", "Looking for a Senior Software Engineer proficient in React, TypeScript, and Bun.");

      const res = await fetch(`${BASE_URL}/api/v1/ats/analyze`, {
        method: "POST",
        headers: {
          cookie: cookieA,
        },
        body: form,
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid PDF file format");
    });
  });

  describe("4. Database Persistence & Cross-User Isolation", () => {
    let createdAnalysisId: string;

    beforeAll(async () => {
      // Seed an AtsAnalysis record directly under User A
      const record = await prisma.atsAnalysis.create({
        data: {
          userId: userAId,
          jobTitle: "Staff Software Engineer",
          company: "Acme Corp",
          jdText: "We need an engineer with React, PostgreSQL, and distributed systems experience.",
          resumeFileName: "candidate_a_resume.pdf",
          resumeText: "Jane Doe\nStaff Engineer\nSkills: React, PostgreSQL, Distributed Systems",
          parsedResume: {
            contact: { name: "Jane Doe", email: "jane@example.com", phone: null, location: null, linkedin: null, github: null, portfolio: null },
            education: [],
            experience: [],
            projects: [],
            technicalSkills: ["React", "PostgreSQL", "Distributed Systems"],
            softSkills: [],
            certifications: [],
            detectedSections: ["Experience", "Skills"],
            missingSections: ["Education"],
          },
          parsedJd: {
            title: "Staff Software Engineer",
            company: "Acme Corp",
            requiredSkills: ["React", "PostgreSQL"],
            preferredSkills: ["Distributed Systems"],
            technicalTools: ["PostgreSQL"],
            responsibilities: ["Architect systems"],
            qualifications: ["B.S. in CS"],
            experienceRequirements: "5+ years",
            importantKeywords: ["React", "PostgreSQL", "Architecture"],
          },
          overallScore: 88,
          scoreBreakdown: {
            skillsMatch: 28,
            requiredKeywords: 18,
            experienceRelevance: 17,
            projectRelevance: 12,
            educationAlignment: 8,
            structureReadability: 5,
          },
          keywordMatches: {
            matchedExact: ["React", "PostgreSQL"],
            matchedRelated: ["Distributed Systems"],
            missingRequired: [],
            missingPreferred: [],
            evidenceList: [],
          },
          compatibilityChecks: {
            standardHeadings: { area: "Section Headings", passed: true, finding: "Standard", details: "All good" },
            contactVisibility: { area: "Contact Info", passed: true, finding: "Complete", details: "Found email" },
            formatConsistency: { area: "Formatting", passed: true, finding: "Consistent", details: "Clean" },
            dateConsistency: { area: "Dates", passed: true, finding: "Consistent", details: "Good" },
            bulletQuality: { area: "Bullets", passed: true, finding: "Strong", details: "Action verbs" },
            excessiveFormatting: { area: "Tables/Columns", passed: true, finding: "None", details: "Safe" },
            missingSections: ["Education"],
            keywordStuffingWarnings: [],
          },
          recommendations: [
            {
              id: "rec-1",
              title: "Add Education Section",
              issue: "Missing formal education section",
              whyItMatters: "Recruiters look for degrees or equivalent",
              howToImprove: "Add a clear Education heading",
              sectionLocation: "Bottom of resume",
              priority: "Medium",
            },
          ],
          improvements: {
            bulletPoints: [],
            projectDescriptions: [],
            impactSuggestions: [],
          },
        },
      });

      createdAnalysisId = record.id;
    });

    it("allows User A to list their own analyses via GET /api/v1/ats", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats`, {
        headers: { cookie: cookieA },
      });

      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);
      const found = list.find((item: any) => item.id === createdAnalysisId);
      expect(found).toBeDefined();
      expect(found.overallScore).toBe(88);
      expect(found.company).toBe("Acme Corp");
    });

    it("allows User A to read their specific analysis detail via GET /api/v1/ats/:id", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats/${createdAnalysisId}`, {
        headers: { cookie: cookieA },
      });

      expect(res.status).toBe(200);
      const detail = await res.json();
      expect(detail.id).toBe(createdAnalysisId);
      expect(detail.userId).toBe(userAId);
      expect(detail.overallScore).toBe(88);
    });

    it("DENIES User B access to User A's analysis (returns HTTP 404 / access denied)", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats/${createdAnalysisId}`, {
        headers: { cookie: cookieB },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("not found or access denied");
    });

    it("DENIES User B from deleting User A's analysis", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats/${createdAnalysisId}`, {
        method: "DELETE",
        headers: { cookie: cookieB },
      });

      expect(res.status).toBe(404);

      // Verify the record was NOT deleted
      const checkStillExists = await prisma.atsAnalysis.findUnique({
        where: { id: createdAnalysisId },
      });
      expect(checkStillExists).not.toBeNull();
    });

    it("allows User A to delete their own analysis", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/ats/${createdAnalysisId}`, {
        method: "DELETE",
        headers: { cookie: cookieA },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify record is gone from PostgreSQL
      const checkDeleted = await prisma.atsAnalysis.findUnique({
        where: { id: createdAnalysisId },
      });
      expect(checkDeleted).toBeNull();
    });
  });

  describe("5. End-to-End Real AI ATS Analysis (POST /api/v1/ats/analyze)", () => {
    it("executes authentic analysis with Gemini and persists comprehensive report", async () => {
      const sampleResumeText = `
Alex Rivera
Full Stack Engineer
Email: alex.rivera@example.com | Phone: (555) 019-2834 | GitHub: github.com/arivera | San Francisco, CA

SUMMARY
Results-driven Full Stack Engineer with 4 years of experience designing scalable web applications using TypeScript, React, and Node.js.

WORK EXPERIENCE
Senior Frontend Developer — TechNova Solutions (2022 – Present)
- Architected a modular React 19 micro-frontend dashboard reducing page load time by 38%.
- Implemented real-time telemetry analytics using WebSockets and PostgreSQL.
- Mentored 4 junior engineers on clean code and automated testing practices.

Software Engineer — CloudScale Labs (2020 – 2022)
- Built high-throughput RESTful APIs in Express and Bun processing over 2M requests daily.
- Optimized PostgreSQL database queries, reducing average latency from 140ms to 45ms.
- Integrated Docker and CI/CD automated deployment pipelines.

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, SQL, Python
Frontend: React, Tailwind CSS, Next.js, Redux Toolkit
Backend: Node.js, Express, Bun, PostgreSQL, Redis, REST APIs
DevOps & Tools: Docker, Git, CI/CD, Jest

EDUCATION
Bachelor of Science in Computer Science — University of California, Berkeley (Graduated 2020)
`;

      const targetJd = `
Role: Senior Full Stack Engineer (React / Node.js)
Company: Stripe
Location: Remote

About the Role:
We are looking for an experienced Senior Full Stack Engineer to build next-generation merchant payment interfaces and distributed backend services.

Required Skills & Experience:
- 3+ years of professional software engineering experience.
- Expert-level TypeScript and modern React experience.
- Strong proficiency in Node.js, REST APIs, and relational databases (PostgreSQL preferred).
- Hands-on experience with WebSocket streaming or real-time distributed architecture.
- Demonstrated ability to write unit tests, maintain code quality, and lead technical designs.

Preferred Qualifications:
- Experience with Bun or high-performance JS runtimes.
- Knowledge of payment gateways, Redis caching, or Docker containerization.
`;

      const form = new FormData();
      form.append("resume", new Blob([sampleResumeText], { type: "text/plain" }), "alex_rivera_resume.txt");
      form.append("jdText", targetJd);
      form.append("jobTitle", "Senior Full Stack Engineer");
      form.append("company", "Stripe");

      const response = await fetch(`${BASE_URL}/api/v1/ats/analyze`, {
        method: "POST",
        headers: {
          cookie: cookieA,
        },
        body: form,
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      // Assertions on structural integrity
      expect(data.id).toBeDefined();
      expect(data.userId).toBe(userAId);
      expect(data.jobTitle).toBe("Senior Full Stack Engineer");
      expect(data.company).toBe("Stripe");
      expect(data.overallScore).toBeGreaterThanOrEqual(0);
      expect(data.overallScore).toBeLessThanOrEqual(100);

      // Score breakdown has all 6 weighted categories
      const sb = data.scoreBreakdown;
      expect(typeof sb.skillsMatch).toBe("number");
      expect(typeof sb.requiredKeywords).toBe("number");
      expect(typeof sb.experienceRelevance).toBe("number");
      expect(typeof sb.projectRelevance).toBe("number");
      expect(typeof sb.educationAlignment).toBe("number");
      expect(typeof sb.structureReadability).toBe("number");

      // Keyword matches
      const km = data.keywordMatches;
      expect(Array.isArray(km.matchedExact)).toBe(true);
      expect(Array.isArray(km.missingRequired)).toBe(true);
      expect(km.matchedExact.length).toBeGreaterThan(0);

      // Compatibility checks
      const cc = data.compatibilityChecks;
      expect(cc.standardHeadings).toBeDefined();
      expect(cc.contactVisibility).toBeDefined();

      // Recommendations
      expect(Array.isArray(data.recommendations)).toBe(true);
      expect(data.recommendations.length).toBeGreaterThan(0);
      const firstRec = data.recommendations[0];
      expect(firstRec.issue).toBeDefined();
      expect(firstRec.whyItMatters).toBeDefined();
      expect(firstRec.howToImprove).toBeDefined();
      expect(firstRec.sectionLocation).toBeDefined();

      // Improvements
      expect(data.improvements).toBeDefined();
      expect(Array.isArray(data.improvements.bulletPoints)).toBe(true);

      // Verify persistence in PostgreSQL
      const dbRecord = await prisma.atsAnalysis.findUnique({
        where: { id: data.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.overallScore).toBe(data.overallScore);

      // Verify Audit Log created
      const auditEntry = await prisma.auditLog.findFirst({
        where: { userId: userAId, action: "ATS_ANALYSIS_CREATED" },
        orderBy: { createdAt: "desc" },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.details).toContain("Senior Full Stack Engineer");
    }, 60000); // 60s timeout for live Gemini AI call
  });
});
