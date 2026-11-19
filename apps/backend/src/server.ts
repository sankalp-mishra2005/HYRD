import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
dotenv.config();
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../db";
import { PROMPTS } from "../prompts";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.config";
import { generateContentWithRetry } from "./utils/gemini";

// Helper to wrap raw 24kHz mono PCM in standard 44-byte WAV header for transcription
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitDepth = 16): Buffer {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Modular Route Imports
import resumeRoutes from "./resume/resume.routes";
import jdRoutes from "./jd/jd.routes";
import interviewRoutes from "./interview/interview.routes";
import settingsRoutes from "./settings/settings.routes";
import atsRoutes from "./ats/ats.routes";

const app = express();

// In-Memory Token Bucket / Window Rate Limiter
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const record = rateLimitMap.get(key as string);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(key as string, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      res.setHeader("Retry-After", Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({
        error: options.message || "Too many requests. Please slow down and try again later.",
      });
    }

    record.count++;
    next();
  };
}

// Clean up stale rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Set up CORS with credentials allowed for Better Auth session cookies
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (e.g. server-to-server or curl)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".railway.app") ||
        origin.endsWith(".up.railway.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

// Healthcheck endpoint for cloud deployments (Railway/Docker)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount better-auth handlers
app.use("/api/auth", toNodeHandler(auth));

// Apply rate limiting to heavy LLM endpoints
app.use("/api/v1/interviews/pre-interview", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use("/api/v1/ats/analyze", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }));

// Mount Modular API Routes
app.use("/api/v1/resumes", resumeRoutes);
app.use("/api/v1/jd", jdRoutes);
app.use("/api/v1/interviews", interviewRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/ats", atsRoutes);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Upgrading Server Connection for WebSockets
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname.startsWith("/api/v1/session/live/") || pathname.startsWith("/api/v1/interviews/session/")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket Event Handler (Live Multi-Modal Speech/Evaluation Session)
wss.on("connection", async (ws, request) => {
  const parsedUrl = new URL(request.url || "", "http://localhost");
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  const interviewId = pathSegments[pathSegments.length - 1];

  if (!interviewId) {
    ws.close(1008, "Interview ID required");
    return;
  }

  try {
    // 1. Enforce Session Authentication
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    });

    const session = await auth.api.getSession({ headers });
    if (!session || !session.user) {
      console.warn(`[WS] Connection rejected: Unauthenticated client for interview ${interviewId}`);
      ws.close(4401, "Unauthorized: Active session required");
      return;
    }

    console.log(`[WS] Authenticated connection from ${session.user.email} for interview: ${interviewId}`);

    // 2. Enforce Interview Existence and Ownership
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId },
      include: { candidateProfile: true },
    });

    if (!interview) {
      console.error(`[WS] Interview not found: ${interviewId}`);
      ws.close(4404, "Interview not found");
      return;
    }

    if (interview.userId !== session.user.id) {
      console.warn(`[WS] Forbidden: User ${session.user.id} tried to access interview owned by ${interview.userId}`);
      ws.close(4403, "Forbidden: You do not own this interview session");
      return;
    }

    const userSettings = await prisma.userSettings.findFirst({
      where: { userId: interview.userId || "" },
    });

    let liveVoice = "Aoede";
    if (userSettings && userSettings.voice) {
      const voiceMapping: Record<string, string> = {
        alloy: "Aoede",
        shimmer: "Kore",
        echo: "Charon",
      };
      liveVoice = voiceMapping[userSettings.voice] || "Aoede";
    }

    // Set interview status to InProgress
    await prisma.interview.update({
      where: { id: interviewId },
      data: { status: "InProgress" },
    });
    console.log(`[WS] Interview ${interviewId} status updated to InProgress`);

    let geminiWs: WebSocket | null = null;
    let setupSucceeded = false;
    let fallbackTriggered = false;

    const startLocalSimulation = async () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      console.log(`[WS] Transitioning to local AI interviewer simulation for interview: ${interviewId}`);
      
      const role = interview.role || "Software Engineer";
      const company = interview.company || "General";
      const interviewType = interview.interviewType || "Technical Interview";

      // Tailor human interview questions based on the role and type
      let mockQuestions: string[] = [];
      const roleLower = role.toLowerCase();
      
      if (roleLower.includes("frontend") || roleLower.includes("ui") || roleLower.includes("react")) {
        mockQuestions = [
          `Hi! I'm Alex. Welcome to your ${role} interview at ${company}. Let's start with a quick introduction. Can you walk me through your background and some of your recent web projects?`,
          `Great to meet you. In large-scale frontend applications, state management and rendering performance can quickly become bottlenecks. How do you approach optimizing rendering and managing complex asynchronous data flows in React?`,
          `Let's talk about architecture. If you were building a real-time collaborative workspace from scratch, how would you architect the client-side data synchronization and offline capabilities?`,
          `Could you describe a challenging technical bug or performance bottleneck you diagnosed in production, and how you tracked down the root cause?`,
          `Thank you for sharing those insights! That wraps up our technical discussion. Feel free to conclude the session to view your comprehensive evaluation and recruiter feedback.`
        ];
      } else if (roleLower.includes("backend") || roleLower.includes("system") || roleLower.includes("api")) {
        mockQuestions = [
          `Hi! I'm Alex. Welcome to your ${role} interview for ${company}. Let's kick off with an introduction. Could you tell me about yourself and the backend systems you've worked on recently?`,
          `Let's discuss distributed systems. How would you design a distributed rate limiter for high-throughput public APIs handling tens of thousands of requests per second? What storage and concurrency primitives would you use?`,
          `When designing relational database schemas at scale, how do you handle zero-downtime database migrations and index optimization for heavy read/write workloads?`,
          `Tell me about a time an outage or cascading failure occurred in a service you maintained. How did you stabilize the service and what safeguards did you put in place?`,
          `Excellent discussion today. That completes our technical round. Whenever you're ready, feel free to wrap up the interview to see your detailed scorecard.`
        ];
      } else {
        mockQuestions = [
          `Hi! I'm Alex. Welcome to your interview for the ${role} position at ${company}. Let's begin with a brief introduction. Could you tell me a little about your journey and core engineering interests?`,
          `Let's dive into practical problem solving. How do you break down a complex, ambiguous technical requirement into clear milestones and robust architecture?`,
          `Can you walk me through an end-to-end feature or service you led or built from concept to production? What trade-offs did you make along the way?`,
          `How do you balance shipping fast versus maintaining long-term code quality, automated test coverage, and technical debt?`,
          `Thank you, that gives me a great picture of your approach. That concludes our interview questions. Whenever you're ready, you can end the session to review your personalized recruiter feedback.`
        ];
      }

      let currentQIndex = 0;
      let questionTimer: any = null;

      const sendNextQuestion = async () => {
        if (currentQIndex >= mockQuestions.length) return;
        const qText = mockQuestions[currentQIndex]!;

        // Save Assistant question to DB
        await prisma.message.create({
          data: {
            interviewId,
            type: "Assistant",
            message: qText,
          }
        });

        // Send to client
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [
                  { text: qText }
                ]
              }
            }
          }));
        }

        currentQIndex++;
      };

      // Send initial setup complete
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ setupComplete: true }));
      }

      // Send first greeting question
      setTimeout(sendNextQuestion, 1200);

      ws.on("message", async (clientData) => {
        try {
          const clientMsg = JSON.parse(clientData.toString());

          // Candidate finished speaking or submitted an answer
          if (clientMsg.clientContent?.turnComplete || clientMsg.type === "turn_complete") {
            const userMsgText = clientMsg.clientContent?.userMessage || clientMsg.userMessage || clientMsg.text;
            if (userMsgText && typeof userMsgText === "string" && userMsgText.trim()) {
              await prisma.message.create({
                data: {
                  interviewId,
                  type: "User",
                  message: userMsgText.trim(),
                }
              });
              calculateLiveMetricsInBackground(interviewId, ws);
            }

            // Move to next question after candidate completes turn
            if (currentQIndex < mockQuestions.length) {
              setTimeout(() => {
                sendNextQuestion();
              }, 800);
            }
          }
        } catch (e) {}
      });

      ws.on("close", () => {
        if (questionTimer) clearTimeout(questionTimer);
      });
    };

    const isSimulationEnabled = process.env.ENABLE_LOCAL_SIMULATION === "true";

    if (!process.env.GEMINI_API_KEY) {
      if (isSimulationEnabled) {
        console.warn("[WS] GEMINI_API_KEY not configured, ENABLE_LOCAL_SIMULATION=true is set: starting local simulator...");
        startLocalSimulation();
        return;
      }
      console.error("[WS] GEMINI_API_KEY not configured and simulation mode is disabled.");
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." }));
        ws.close(1011, "GEMINI_API_KEY not configured");
      }
      return;
    }

    try {
      const geminiLiveEndpoint =
        process.env.GEMINI_LIVE_ENDPOINT ||
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
      const geminiLiveUrl = `${geminiLiveEndpoint}?key=${process.env.GEMINI_API_KEY}`;

      console.log(`[WS] Connecting to Gemini Live API at ${geminiLiveEndpoint}...`);
      geminiWs = new WebSocket(geminiLiveUrl);

      let assistantTextAccumulator = "";
      let turnAudioBuffers: Buffer[] = [];

      geminiWs.on("message", async (rawData) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(rawData.toString());

        try {
          const messageJson = JSON.parse(rawData.toString());

          if (messageJson.setupComplete) {
            console.log("[WS] Gemini Live setup complete. Sending initial greeting trigger.");
            const triggerPayload = {
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [{ text: "Hello! I am ready to start the interview. Please greet me and ask the first question." }]
                  }
                ],
                turnComplete: true
              }
            };
            geminiWs?.send(JSON.stringify(triggerPayload));
          }

          if (messageJson.serverContent?.modelTurn?.parts) {
            for (const part of messageJson.serverContent.modelTurn.parts) {
              if (part.text) {
                assistantTextAccumulator += part.text;
              }
              if (part.inlineData?.data) {
                turnAudioBuffers.push(Buffer.from(part.inlineData.data, "base64"));
              }
            }
          }

          if (messageJson.serverContent?.turnComplete) {
            // Only perform transcription fallback if native text was not provided in the stream
            if (!assistantTextAccumulator.trim() && turnAudioBuffers.length > 0) {
              const fullPcm = Buffer.concat(turnAudioBuffers);
              turnAudioBuffers = [];
              try {
                const wav = pcmToWav(fullPcm, 24000);
                const transcribeRes = await generateContentWithRetry({
                  model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
                  contents: [
                    {
                      inlineData: {
                        mimeType: "audio/wav",
                        data: wav.toString("base64"),
                      },
                    },
                    "Transcribe this interviewer audio recording verbatim. Output ONLY the transcription text, nothing else.",
                  ],
                });
                const transcribed = (transcribeRes.text || "").trim();
                const cleanTranscribed = transcribed
                  .replace(/^thought\s*/i, "")
                  .replace(/^\*\*.*?\*\*\s*/s, "")
                  .trim();
                if (cleanTranscribed) {
                  assistantTextAccumulator = cleanTranscribed;
                }
              } catch (audioTranscribeErr) {
                console.warn("[WS] Interviewer audio transcription error:", audioTranscribeErr);
              }
            } else {
              turnAudioBuffers = [];
            }

            if (assistantTextAccumulator.trim()) {
              const qText = assistantTextAccumulator.trim();
              assistantTextAccumulator = "";
              await prisma.message.create({
                data: {
                  interviewId,
                  type: "Assistant",
                  message: qText,
                },
              });

              // Notify frontend of the question text so the dialogue transcript updates immediately
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    serverContent: {
                      modelTurn: {
                        parts: [{ text: qText }],
                      },
                    },
                  })
                );
              }
            }
          }
        } catch (err) {
          console.error("[WS] Error parsing Gemini message:", err);
        }
      });

      geminiWs.on("open", () => {
        setupSucceeded = true;
        console.log(`[WS] Gemini connection opened. Sending setup config...`);
        const instruction = PROMPTS.interviewSystemInstruction.instruction(
          interview.role,
          interview.company || "Target Company",
          interview.experienceLevel,
          interview.duration,
          interview.jobDescription || "Job description details",
          interview.candidateProfile.summary,
          interview.candidateProfile.profileJson,
          interview.difficulty,
          interview.language,
          interview.interviewType
        );

        const liveModel = process.env.GEMINI_LIVE_MODEL || "models/gemini-2.5-flash-native-audio-latest";
        const setupPayload = {
          setup: {
            model: liveModel,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: liveVoice,
                  },
                },
              },
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
            systemInstruction: {
              parts: [{ text: instruction }],
            },
          },
        };

        geminiWs?.send(JSON.stringify(setupPayload));
      });

      ws.on("message", async (clientData) => {
        try {
          const clientMsg = JSON.parse(clientData.toString());
          const candidateText =
            clientMsg.clientContent?.userMessage ||
            clientMsg.userMessage ||
            clientMsg.clientContent?.turns?.[0]?.parts?.[0]?.text ||
            clientMsg.text;

          if (candidateText && typeof candidateText === "string" && candidateText.trim()) {
            const cleanCandidateText = candidateText.trim();
            // Save real candidate turn to PostgreSQL
            await prisma.message.create({
              data: {
                interviewId,
                type: "User",
                message: cleanCandidateText,
              },
            });
            calculateLiveMetricsInBackground(interviewId, ws);

            // Forward candidate turn to Gemini Live
            if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
              geminiWs.send(
                JSON.stringify({
                  clientContent: {
                    turns: [
                      {
                        role: "user",
                        parts: [{ text: cleanCandidateText }],
                      },
                    ],
                    turnComplete: true,
                  },
                })
              );
            }
            return;
          }
        } catch (e) {
          // Binary audio or non-JSON forward directly
        }

        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.send(clientData.toString());
        }
      });

      ws.on("close", (code, reason) => {
        console.log(`[WS] Client connection closed. Code: ${code}`);
        if (geminiWs && (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING)) {
          geminiWs.close();
        }
      });

      geminiWs.on("close", () => {
        console.log(`[WS] Gemini Live connection closed.`);
        if (!setupSucceeded) {
          if (isSimulationEnabled) {
            console.warn("[WS] Setup failed. ENABLE_LOCAL_SIMULATION=true is set: starting local simulator...");
            startLocalSimulation();
          } else {
            console.error("[WS] Gemini Live setup failed and simulation mode is disabled.");
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ error: "Gemini Live voice connection failed. Please verify API key and network." }));
              ws.close(1011, "Gemini Live setup failed");
            }
          }
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      geminiWs.on("error", (err) => {
        console.error("[WS] Gemini Live error:", err);
        if (isSimulationEnabled) {
          console.warn("[WS] Gemini Live error: falling back to local simulator because ENABLE_LOCAL_SIMULATION=true");
          startLocalSimulation();
        } else {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ error: "Gemini Live error: " + (err?.message || "Connection failed") }));
            ws.close(1011, "Gemini Live error");
          }
        }
      });

      ws.on("error", (err) => {
        console.error("[WS] Client WebSocket error:", err);
        if (geminiWs) geminiWs.close();
      });
    } catch (e: any) {
      console.error("[WS] Gemini init failed:", e);
      if (isSimulationEnabled) {
        startLocalSimulation();
      } else {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: "Failed to initialize Gemini Live: " + (e?.message || "Unknown error") }));
          ws.close(1011, "Initialization failed");
        }
      }
    }
  } catch (err) {
    console.error("[WS] Error setting up session:", err);
    ws.close(1011, "Internal server error");
  }
});

async function calculateLiveMetricsInBackground(interviewId: string, clientWs: WebSocket) {
  try {
    const messages = await prisma.message.findMany({
      where: { interviewId },
      orderBy: { createdAt: "asc" }
    });

    if (messages.length === 0) return;

    const userMessages = messages.filter((m: any) => m.type === "User");
    if (userMessages.length === 0) return;

    const allUserText = userMessages.map((m: any) => m.message).join(" ");
    const totalWords = allUserText.split(/\s+/).filter(Boolean).length;
    const avgWordsPerAnswer = Math.round(totalWords / userMessages.length);

    // 1. Technical Depth Analysis: Concrete technical keywords and architectural terms
    const techRegex = /\b(api|async|await|cache|caching|concurrency|database|distributed|docker|endpoint|event|framework|graphql|index|indexing|json|kubernetes|latency|load balancer|microservices|multithreading|nosql|o\(|optimization|pipeline|postgres|postgresql|queue|redis|rest|scalability|schema|sharding|sql|state|throughput|tradeoff|transaction|typescript|websocket)\b/gi;
    const techMatches = (allUserText.match(techRegex) || []).length;
    const technical = Math.min(10, Math.max(4, 5 + Math.min(5, Math.floor(techMatches / 2))));

    // 2. Communication Clarity: Cohesive structure, sentence length, and structured reasoning connectives
    const reasoningRegex = /\b(because|specifically|for example|furthermore|however|in order to|tradeoff|firstly|secondly|in contrast|as a result)\b/gi;
    const reasoningMatches = (allUserText.match(reasoningRegex) || []).length;
    const isOptimalLength = avgWordsPerAnswer >= 15 && avgWordsPerAnswer <= 160;
    const communication = Math.min(10, Math.max(4, (isOptimalLength ? 6 : 5) + Math.min(4, Math.floor(reasoningMatches / 2))));

    // 3. Problem Solving: Systematic analytical approach (identifying constraints, alternative approaches)
    const problemSolvingRegex = /\b(edge case|approach|solution|alternative|complexity|simulate|test|validate|handle|failure|fallback|recover)\b/gi;
    const psMatches = (allUserText.match(problemSolvingRegex) || []).length;
    const problemSolving = Math.min(10, Math.max(4, 5 + Math.min(5, Math.floor(psMatches / 2))));

    // 4. System Design: Architecture, scalability, storage, and networking concepts
    const sysDesignRegex = /\b(architecture|microservice|partition|replica|replication|cluster|load balancer|cdn|cap theorem|horizontal|vertical|stateless|fault tolerance)\b/gi;
    const sysMatches = (allUserText.match(sysDesignRegex) || []).length;
    const systemDesign = Math.min(10, Math.max(4, 5 + Math.min(5, Math.floor(sysMatches / 2))));

    // 5. Articulation Confidence: Clear, affirmative technical assertions vs excessive hesitation
    const hedgeRegex = /\b(i think maybe|i guess|not sure|probably not|no idea|kind of sort of)\b/gi;
    const hedgeMatches = (allUserText.match(hedgeRegex) || []).length;
    const confidence = Math.min(10, Math.max(4, 8 - Math.min(4, hedgeMatches)));

    const metrics = {
      communication,
      technical,
      confidence,
      problemSolving,
      systemDesign
    };

    await prisma.interview.update({
      where: { id: interviewId },
      data: { liveMetrics: metrics }
    });

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: "metrics_update",
        metrics
      }));
    }
  } catch (error) {
    console.error("[WS] Error calculating live metrics:", error);
  }
}

// Start Server listening
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Modular Server listening on http://0.0.0.0:${PORT}`);
});
export { app, server };
