import WebSocket from "ws";
import "dotenv/config";
import { prisma } from "./db";
import { PROMPTS } from "./prompts";

async function run() {
  try {
    const interview = await prisma.interview.findFirst({
      include: { candidateProfile: true },
    });

    if (!interview) {
      console.error("No interview found in database! Please run form submission first.");
      process.exit(1);
    }

    console.log("Using Interview ID:", interview.id);
    const instruction = PROMPTS.interviewSystemInstruction.instruction(
      interview.role,
      interview.company,
      interview.experienceLevel,
      interview.duration,
      interview.jobDescription,
      interview.candidateProfile.summary,
      interview.candidateProfile.profileJson,
      "Adaptive",
      "English",
      "Technical Interview"
    );

    const apiKey = process.env.GEMINI_API_KEY;
    const geminiLiveUrl =
      "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=" +
      apiKey;

    console.log("Connecting to Gemini Live API...");
    const ws = new WebSocket(geminiLiveUrl);

    ws.on("open", () => {
      console.log("WebSocket opened! Sending full setup payload...");
      const setupPayload = {
        setup: {
          model: "models/gemini-2.5-flash-native-audio-latest",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Fenrir",
                },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: instruction }],
          },
        },
      };

      ws.send(JSON.stringify(setupPayload));
    });

    ws.on("message", (rawData) => {
      console.log("Received message from Gemini:", rawData.toString());
    });

    ws.on("close", (code, reason) => {
      console.log(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
      process.exit(0);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });

    setTimeout(() => {
      console.log("Closing after timeout...");
      ws.close();
    }, 10000);

  } catch (error) {
    console.error("Error in test execution:", error);
    process.exit(1);
  }
}

run();
