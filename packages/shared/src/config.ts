import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Load the .env file at the project root (three folders up from this file).
dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

function read(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing ${name} in .env`);
}

export const config = {
  geminiApiKey: () => read("GEMINI_API_KEY"),
  geminiModel: () => read("GEMINI_MODEL", "gemini-flash-latest"),
  geminiFallbackModel: () => read("GEMINI_FALLBACK_MODEL", "gemini-flash-lite-latest"),
  ollamaUrl: () => read("OLLAMA_URL", "http://localhost:11434"),
  ollamaModel: () => read("OLLAMA_MODEL", "qwen2.5:3b"),
  mediaDir: () => read("MEDIA_DIR", "D:\\ExplainIt"),
};
