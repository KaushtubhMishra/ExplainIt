import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { config } from "../config";

export type Msg = { role: "user" | "assistant"; content: string };

export interface LLMProvider {
  name: string;
  generateText(req: { system: string; messages: Msg[]; json?: boolean }): Promise<string>;
}

// Thrown when the provider itself is unavailable (rate limit, outage, not running),
// so the caller should move on to the next provider instead of retrying the prompt.
export class ProviderUnavailableError extends Error {}

function isUnavailable(err: unknown): boolean {
  const e = err as { status?: number; message?: string; cause?: { code?: string } };
  if (e?.status && (e.status === 429 || e.status >= 500)) return true;
  const text = `${e?.message ?? ""} ${e?.cause?.code ?? ""}`;
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(text);
}

function thinkingLevel(): ThinkingLevel {
  const v = (process.env.GEMINI_THINKING ?? "LOW").toUpperCase();
  return (ThinkingLevel as Record<string, ThinkingLevel>)[v] ?? ThinkingLevel.LOW;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GeminiProvider implements LLMProvider {
  name: string;
  private ai: GoogleGenAI;
  private useThinkingConfig = true; // switched off if a model rejects the setting
  constructor(private model: string) {
    this.name = `gemini:${model}`;
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey() });
  }
  async generateText(req: { system: string; messages: Msg[]; json?: boolean }): Promise<string> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await this.ai.models.generateContent({
          model: this.model,
          contents: req.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          config: {
            systemInstruction: req.system,
            temperature: 0.7,
            ...(req.json ? { responseMimeType: "application/json" } : {}),
            // Less "thinking" = much faster answers; scripts don't need deep reasoning.
            ...(this.useThinkingConfig ? { thinkingConfig: { thinkingLevel: thinkingLevel() } } : {}),
          },
        });
        return res.text ?? "";
      } catch (err) {
        const e = err as { status?: number; message?: string };
        if (this.useThinkingConfig && e?.status === 400 && /thinking/i.test(e?.message ?? "")) {
          this.useThinkingConfig = false; // this model doesn't accept the setting; retry without it
          attempt--;
          continue;
        }
        if (!isUnavailable(err)) throw err;
        if (attempt === 2) throw new ProviderUnavailableError(`${this.name} unavailable: ${(err as Error).message}`);
        await sleep(5000); // wait once, then try the same model again
      }
    }
    throw new ProviderUnavailableError(`${this.name} unavailable`);
  }
}

export class OllamaProvider implements LLMProvider {
  name: string;
  constructor(private model: string, private url = config.ollamaUrl()) {
    this.name = `ollama:${model}`;
  }
  async generateText(req: { system: string; messages: Msg[]; json?: boolean }): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "30m", // keep the model in memory between calls
          ...(req.json ? { format: "json" } : {}),
          options: { temperature: 0.5, num_ctx: 8192 },
          messages: [{ role: "system", content: req.system }, ...req.messages],
        }),
      });
    } catch (err) {
      throw new ProviderUnavailableError(`${this.name} not reachable. Is Ollama running? (${(err as Error).message})`);
    }
    if (!res.ok) throw new ProviderUnavailableError(`${this.name} returned HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }
}

// The order providers are tried in. Ollama is not in the automatic chain: on this laptop's
// CPU it takes minutes per call, so it is only used when asked for with --llm ollama.
export function createLLMChain(choice: "gemini" | "ollama"): LLMProvider[] {
  if (choice === "ollama") return [new OllamaProvider(config.ollamaModel())];
  return [
    new GeminiProvider(config.geminiModel()),
    new GeminiProvider(config.geminiFallbackModel()),
  ];
}
