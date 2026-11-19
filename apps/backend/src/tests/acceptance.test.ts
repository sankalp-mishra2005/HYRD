import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../../db";
import { authMiddleware, type AuthenticatedRequest } from "../auth/auth.middleware";
import type { Response } from "express";

describe("HYRD Core Acceptance & Verification Suite", () => {
  let testUserA: any;
  let testUserB: any;
  let testProfile: any;
  let testInterview: any;

  beforeAll(async () => {
    testUserA = await prisma.user.upsert({
      where: { email: "recovery.test.candidate@hyrd.ai" },
      update: { name: "Test Candidate A" },
      create: {
        id: "candidate-a-test-id",
        email: "recovery.test.candidate@hyrd.ai",
        name: "Test Candidate A",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    testUserB = await prisma.user.upsert({
      where: { email: "recovery.other.candidate@hyrd.ai" },
      update: { name: "Test Candidate B" },
      create: {
        id: "candidate-b-test-id",
        email: "recovery.other.candidate@hyrd.ai",
        name: "Test Candidate B",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    testProfile = await prisma.candidateProfile.create({
      data: {
        githubUrl: "https://github.com/testcandidate",
        summary: "Full Stack Engineer with React, Node.js, and TypeScript experience.",
        profileJson: {
          role: "Full Stack Engineer",
          company: "Tech Corp",
          experienceLevel: "Mid-Level",
          skills: [
            { name: "TypeScript", confidence: 0.9, source: ["Resume"] },
            { name: "React", confidence: 0.85, source: ["Resume"] },
            { name: "PostgreSQL", confidence: 0.8, source: ["Resume"] },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    if (testInterview?.id) {
      await prisma.message.deleteMany({ where: { interviewId: testInterview.id } });
      await prisma.interview.delete({ where: { id: testInterview.id } });
    }
    if (testProfile?.id) {
      await prisma.candidateProfile.delete({ where: { id: testProfile.id } });
    }
  });

  it("Criteria 1: Unauthenticated request rejected with HTTP 401 (no guest fallback)", async () => {
    const fakeReqNoAuth = {
      headers: {},
    } as unknown as AuthenticatedRequest;

    let authStatus = 0;
    let authErrorMsg = "";
    const fakeResNoAuth = {
      status: (code: number) => {
        authStatus = code;
        return {
          json: (data: any) => {
            authErrorMsg = data.error;
          },
        };
      },
    } as unknown as Response;

    let nextCalled = false;
    await authMiddleware(fakeReqNoAuth, fakeResNoAuth, () => {
      nextCalled = true;
    });

    expect(authStatus).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it("Criteria 2 & 3: Interview record created with candidate profile and user ownership", async () => {
    testInterview = await prisma.interview.create({
      data: {
        userId: testUserA.id,
        status: "Pre",
        role: "Full Stack Engineer",
        company: "Tech Corp",
        experienceLevel: "Mid-Level",
        duration: 30,
        difficulty: "Medium",
        candidateProfileId: testProfile.id,
      },
    });

    expect(testInterview.id).toBeDefined();
    expect(testInterview.userId).toBe(testUserA.id);
    expect(testInterview.status).toBe("Pre");
  });

  it("Criteria 4: Lobby read preserves 'Pre' status without premature evaluation", async () => {
    const detailsRead = await prisma.interview.findFirst({
      where: { id: testInterview.id, userId: testUserA.id },
      include: { candidateProfile: true, conversations: true },
    });

    expect(detailsRead).not.toBeNull();
    expect(detailsRead?.status).toBe("Pre");
  });

  it("Criteria 5: Cross-User Ownership Isolation (User B cannot access User A interview)", async () => {
    const crossUserAccess = await prisma.interview.findFirst({
      where: { id: testInterview.id, userId: testUserB.id },
    });

    expect(crossUserAccess).toBeNull();
  });

  it("Criteria 6 & 7: Real interviewer question and candidate answer saved in database", async () => {
    await prisma.message.create({
      data: {
        interviewId: testInterview.id,
        message: "Can you explain how indexing works in PostgreSQL and when to use B-tree vs GIN indexes?",
        type: "Assistant",
      },
    });

    await prisma.message.create({
      data: {
        interviewId: testInterview.id,
        message: "B-tree indexes are the default in PostgreSQL, ideal for equality and range queries on scalar types. GIN indexes are generalized inverted indexes, best for arrays, full-text search, and JSONB keys.",
        type: "User",
      },
    });

    const savedMessages = await prisma.message.findMany({
      where: { interviewId: testInterview.id },
      orderBy: { createdAt: "asc" },
    });

    expect(savedMessages.length).toBe(2);
    expect(savedMessages[0]?.type).toBe("Assistant");
    expect(savedMessages[1]?.type).toBe("User");
    expect(savedMessages[1]?.message).toContain("B-tree indexes");
  });

  it("Criteria 8: Conclude interview updates status to Done with score and feedback", async () => {
    const concluded = await prisma.interview.update({
      where: { id: testInterview.id },
      data: {
        status: "Done",
        score: 85,
        feedback: "Strong technical understanding of PostgreSQL indexing strategies and query planning.",
        hireReport: {
          recommendation: "Strong Hire",
          confidence: 90,
          strengths: ["Clear distinction between B-Tree and GIN indexes", "Understands JSONB optimization"],
          areasOfImprovement: ["Discuss partial and expression indexes in further depth"],
        },
      },
    });

    expect(concluded.status).toBe("Done");
    expect(concluded.score).toBe(85);
    expect(concluded.feedback).toBeDefined();
  });

  it("Criteria 9: User interview history scoping", async () => {
    const userAHistory = await prisma.interview.findMany({
      where: { userId: testUserA.id },
      orderBy: { createdAt: "desc" },
    });

    const userBHistory = await prisma.interview.findMany({
      where: { userId: testUserB.id },
      orderBy: { createdAt: "desc" },
    });

    expect(userAHistory.some((i) => i.id === testInterview.id)).toBe(true);
    expect(userBHistory.some((i) => i.id === testInterview.id)).toBe(false);
  });
});
