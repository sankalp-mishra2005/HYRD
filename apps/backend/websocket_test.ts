import WebSocket from "ws";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API Key:", apiKey ? "[CONFIGURED]" : "[MISSING]");

const geminiLiveUrl =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=" +
  apiKey;

console.log("Connecting to:", geminiLiveUrl);
const ws = new WebSocket(geminiLiveUrl);

ws.on("open", () => {
  console.log("WebSocket connection opened successfully!");
  
  // Send setup payload to test if it accepts the model
  const setupPayload = {
    setup: {
      model: "models/gemini-2.5-flash-native-audio-latest",
      generationConfig: {
        responseModalities: ["AUDIO"],
      },
    },
  };
  console.log("Sending setup payload...");
  ws.send(JSON.stringify(setupPayload));
});

ws.on("message", (data) => {
  console.log("Received message:", data.toString());
});

ws.on("close", (code, reason) => {
  console.log(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
  process.exit(0);
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log("Timeout reached, closing WebSocket...");
  ws.close();
}, 10000);
