import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
dotenv.config();
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

export async function generateContentWithRetry(config: any, retries = 2, initialDelayMs = 1000): Promise<any> {
  const primaryModel = config.model || DEFAULT_GEMINI_MODEL;
  const modelsToTry = Array.from(new Set([
    primaryModel,
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ]));

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    const attemptConfig = { ...config, model: currentModel };
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent(attemptConfig);
        return response;
      } catch (error: any) {
        lastError = error;
        console.warn(`[Gemini API] Request attempt ${attempt + 1}/${retries + 1} with ${currentModel} failed:`, error?.message || error);

        if (attempt < retries) {
          const delay = initialDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.warn(`[Gemini API] Model ${currentModel} exhausted, attempting fallback model...`);
  }

  console.error("[Gemini API Error] All retry attempts and model fallbacks failed:", lastError?.message || lastError);
  throw new Error(`Gemini API call failed (${primaryModel}): ${lastError?.message || String(lastError)}`);
}
