# HYRD v1.1 — ATS Intelligence & Job Description Matcher

## 1. Executive Summary

**HYRD v1.1 ATS Intelligence** extends the HYRD AI Career Copilot with a recruiter-focused ATS analysis and Job Description matching system. It empowers candidates to audit their resumes against any target job posting, uncover keyword gaps with verbatim evidence citations, evaluate compatibility across 9 formatting vectors, and receive deterministic scoring (0–100) alongside actionable STAR bullet point rewrites.

All ATS services are completely modular, ensuring zero regression to HYRD's core real-time voice interview system and Gemini Live integration.

---

## 2. System Architecture & File Inventory

```
apps/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma              # Extended with AtsAnalysis model & User relations
│   └── src/
│       ├── ats/
│       │   ├── ats.types.ts           # Strict TypeScript contracts for ATS payloads & results
│       │   ├── ats.parser.ts          # Magic byte validator & multi-format parser (PDF, DOCX, TXT)
│       │   ├── ats.service.ts         # Gemini prompt engineering, failover & deterministic normalizer
│       │   └── ats.routes.ts          # Authenticated REST endpoints with user-scoped isolation
│       ├── utils/
│       │   └── gemini.ts              # Multi-model retry & transparent failover (flash-lite models)
│       ├── server.ts                  # Mounted /api/v1/ats router
│       └── tests/
│           ├── ats_phase2.test.ts     # 20 integration tests (file parser, auth, isolation, real AI)
│           └── ats_scoring.test.ts    # 7 unit tests (clamping, stuffing penalty, priority sorting)
└── frontend/
    └── src/
        ├── components/
        │   ├── SidebarLayout.tsx      # Added "ATS Checker" navigation entry
        │   └── workspace/
        │       ├── AtsView.tsx        # Comprehensive ATS dashboard, gauge, tabs & improvement panel
        │       └── DashboardView.tsx  # Added ATS quick-action callout card
        ├── App.tsx                    # Registered /workspace/ats and /workspace/ats/:analysisId
        ├── index.ts                   # Static dist file server with cache-busting SPA fallback
        └── build.ts                   # Bun + Tailwind CSS compiler (167 KB production stylesheet)
```

---

## 3. Resume Ingestion & Magic Byte Validation

Resumes are accepted via `multipart/form-data` up to 10MB or referenced from the candidate's existing library (`resumeId`):

| File Type | Parser Implementation | Magic Byte Signature Check |
| :--- | :--- | :--- |
| **PDF** | `pdf-parse` | Buffer begins with `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`) |
| **DOCX** | `mammoth` (`extractRawText`) | Buffer begins with ZIP Header `PK\x03\x04` (`0x50 0x4B 0x03 0x04`) |
| **TXT** | UTF-8 stream decoder | Rejects binary null-bytes (`\0`) |

> **Security Note:** File extensions alone are never trusted. Renaming an executable or image to `.pdf` or `.docx` is rejected with HTTP 400.

---

## 4. Deterministic Scoring Model (0–100)

The ATS Score is calculated through a bounded, weighted summation:

$$\text{OverallScore} = S_{\text{skills}} + S_{\text{keywords}} + S_{\text{experience}} + S_{\text{projects}} + S_{\text{education}} + S_{\text{structure}}$$

| Category | Max Weight | Evaluation Criteria |
| :--- | :---: | :--- |
| **Skills Match** | **30%** | Alignment between candidate technical/soft skills and JD requirements |
| **Required Keywords** | **20%** | Exact and semantic presence of mission-critical job keywords |
| **Experience Relevance**| **20%** | Recency, seniority level, and domain depth of past roles |
| **Project Relevance** | **15%** | Applied technology stack and relevance of portfolio projects |
| **Education & Quals** | **10%** | Degree, certifications, and educational alignment |
| **Structure & Readability**| **5%** | Formatting compliance, section flow, and anti-keyword-stuffing penalty |
| **Total** | **100%** | **Strictly clamped $[0, 100]$** |

### Anti-Keyword-Stuffing Heuristic
If a non-stopword term repeats $>12$ times within the body of the resume:
1. An explicit diagnostic warning is appended to `keywordStuffingWarnings`.
2. A $-1$ point penalty is applied to `structureReadability`.

---

## 5. ATS Formatting Diagnostics (9 Vectors)

The analysis performs automated audits across 9 compatibility areas:

1. **Standard Headings:** Detects whether standard headings (`Experience`, `Education`, `Skills`, `Projects`) are present.
2. **Contact Visibility:** Verifies email, phone number, and location visibility.
3. **Format Consistency:** Checks layout hierarchy and font structure readability.
4. **Date Formats:** Audits chronological consistency (`MM/YYYY` or `Month YYYY`).
5. **Bullet Point Quality:** Analyzes action verbs, readability, and brevity.
6. **Tables & Multi-Columns:** Flags non-standard columnar layouts that confuse older ATS parsers.
7. **Abbreviations & Acronyms:** Validates industry standard acronyms vs ambiguous shorthand.
8. **Missing Sections:** Identifies absent essential sections.
9. **Anti-Keyword-Stuffing:** Flags unnatural keyword repetition.

---

## 6. Actionable Recommendations & "Improve My Resume"

### 4-Part Recommendation Schema
Every recommendation includes:
1. **The Issue:** Clear description of the detected weakness or gap.
2. **Why It Matters:** Contextual explanation relative to the target role.
3. **How to Improve:** Concrete, actionable rewrite instructions.
4. **Where in Resume:** Specific section target (e.g. `Experience - Role 1`, `Technical Skills`).
5. **Priority:** Sorted deterministically by `High` $\rightarrow$ `Medium` $\rightarrow$ `Low`.

### Resume Improvement Features
- **STAR Bullet Rewrites:** Original bullet point juxtaposed with an AI-optimized Situation-Task-Action-Result rewrite, complete with one-click clipboard copying.
- **Project Descriptions:** Enhanced project summaries with recommended tech highlights.
- **Quantifiable Impact Placeholders:** Structured guidance prompting candidates to insert authentic metrics (e.g., `"[Quantify: reduced latency by X%]"`) without fabricating numbers.

---

## 7. API Reference

### `POST /api/v1/ats/analyze`
Executes authentic ATS compatibility analysis and persists the result.

- **Auth:** Session cookie required.
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `resume`: File (`.pdf`, `.docx`, `.txt`) OR `resumeId`: String
  - `jobDescription`: String (min 20 characters)
  - `role`: String (optional)
  - `company`: String (optional)
- **Response:** HTTP 200 with full `AtsAnalysis` JSON payload.

### `GET /api/v1/ats`
Lists all historical analyses owned by the authenticated user.
- **Auth:** Session cookie required.
- **Response:** HTTP 200 with array of user-scoped `AtsAnalysis` summaries.

### `GET /api/v1/ats/:id`
Retrieves full details of a specific analysis.
- **Auth:** Session cookie required.
- **Isolation:** Returns HTTP 404 if the record does not belong to the user.

### `DELETE /api/v1/ats/:id`
Deletes an analysis record.
- **Auth:** Session cookie required.
- **Isolation:** Returns HTTP 404 if attempting to delete another user's record.

---

## 8. Automated Test Verification Results

| Test Suite | File | Tests | Result |
| :--- | :--- | :---: | :---: |
| File Parsing & MIME Validation | `apps/backend/src/tests/ats_phase2.test.ts` | 6 | **PASS** |
| Auth & Authorization Enforcement | `apps/backend/src/tests/ats_phase2.test.ts` | 4 | **PASS** |
| Input Validation & Error Handling | `apps/backend/src/tests/ats_phase2.test.ts` | 4 | **PASS** |
| Database Persistence & User Isolation | `apps/backend/src/tests/ats_phase2.test.ts` | 5 | **PASS** |
| Real AI End-to-End Gemini Integration | `apps/backend/src/tests/ats_phase2.test.ts` | 1 | **PASS** |
| Scoring Engine Clamping & Bounding | `apps/backend/src/tests/ats_scoring.test.ts` | 3 | **PASS** |
| Keyword Stuffing Penalty & Sorting | `apps/backend/src/tests/ats_scoring.test.ts` | 4 | **PASS** |
| **Total Test Suite** | | **27** | **27 PASS / 0 FAIL** |

---

## 9. Frontend Styling & Delivery Resolution

- **Cause of Previous Display Issue:** When Bun dynamically served `src/index.html` on the fly, it bypassed `bun-plugin-tailwind`, resulting in raw unstyled HTML without Tailwind utility classes.
- **Permanent Solution:**
  1. `apps/frontend/build.ts` bundles all Tailwind CSS into a compiled 167 KB stylesheet (`dist/chunk-nqt73qgx.css`).
  2. `apps/frontend/src/index.ts` serves static assets directly from `dist/` with `no-cache, no-store` headers for SPA fallback routes and immutable caching for hashed chunks.
  3. Running `powershell -Command "bun apps/frontend/build.ts"` re-compiles styles instantly in $<500$ms.

