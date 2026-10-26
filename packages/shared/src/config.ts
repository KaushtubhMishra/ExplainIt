import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

// Load the project's .env, searching upward from the current folder at run time.
// (A static file reference here would make the website's bundler pack .env into the app.)
function findEnvFile(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}
const envFile = findEnvFile();
if (envFile) dotenv.config({ path: envFile, quiet: true } as dotenv.DotenvConfigOptions);

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
