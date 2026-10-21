import { spawn } from "node:child_process";
import { statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { LanguageType } from "../schema";

export type WordTiming = { word: string; start: number; end: number }; // seconds

export type VoiceResult = { words: WordTiming[]; seconds: number; characters: number };

export interface VoiceProvider {
  name: string;
  voiceFor(language: LanguageType): string;
  // Writes the MP3 to mp3Path and returns its word timings and length.
  synthesize(req: { text: string; language: LanguageType; voiceId: string; mp3Path: string }): Promise<VoiceResult>;
  remainingCredits?(): Promise<number | null>;
  creditsPerCharacter: number;
}

// Both providers return constant-bitrate MP3, so length = bytes x 8 / bitrate.
function mp3Seconds(path: string, bitsPerSecond: number): number {
  return (statSync(path).size * 8) / bitsPerSecond;
}

// ---------------- edge-tts (free, runs the Python tool) ----------------
export class EdgeTtsProvider implements VoiceProvider {
  name = "edge-tts";
  creditsPerCharacter = 0;
  private script = fileURLToPath(new URL("../../../../tools/edge_tts_words.py", import.meta.url));

  voiceFor(language: LanguageType) {
    return language === "hi-IN"
      ? process.env.EDGE_VOICE_HI ?? "hi-IN-SwaraNeural"
      : process.env.EDGE_VOICE_EN ?? "en-IN-NeerjaNeural";
  }

  synthesize(req: { text: string; voiceId: string; mp3Path: string }): Promise<VoiceResult> {
    return new Promise((resolve, reject) => {
      const python = process.env.PYTHON_BIN ?? "python";
      const child = spawn(python, [this.script], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
      let out = "";
      let err = "";
      child.stdout.setEncoding("utf8").on("data", (d) => (out += d));
      child.stderr.setEncoding("utf8").on("data", (d) => (err += d));
      child.on("error", (e) => reject(new Error(`Could not start ${python}: ${e.message}`)));
      child.on("close", (code) => {
        if (code !== 0) return reject(new Error(`edge-tts failed (code ${code}): ${err.trim().split("\n").pop()}`));
        try {
          const { words } = JSON.parse(out) as { words: WordTiming[] };
          // edge-tts streams 24 kHz, 48 kbit/s mono MP3.
          resolve({ words, seconds: mp3Seconds(req.mp3Path, 48000), characters: req.text.length });
        } catch (e) {
          reject(new Error(`Could not read edge-tts output: ${(e as Error).message}`));
        }
      });
      const rate = process.env.EDGE_RATE ?? "+10%"; // speaking speed, e.g. "+0%", "+10%", "-5%"
      child.stdin.end(JSON.stringify({ text: req.text, voice: req.voiceId, mp3: req.mp3Path, rate }), "utf8");
    });
  }
}

// ---------------- ElevenLabs ----------------
type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

// Turn ElevenLabs character timings into word timings.
export function charsToWords(a: Alignment): WordTiming[] {
  const words: WordTiming[] = [];
  let current: WordTiming | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) words.push(current);
      current = null;
      return;
    }
    if (!current) current = { word: "", start: a.character_start_times_seconds[i], end: 0 };
    current.word += ch;
    current.end = a.character_end_times_seconds[i];
  });
  if (current) words.push(current);
  return words
    .map((w) => ({ ...w, word: w.word.replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "") }))
    .filter((w) => w.word.length > 0);
}

export class ElevenLabsProvider implements VoiceProvider {
  name = "elevenlabs";
  private model = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";
  creditsPerCharacter = /flash|turbo/.test(this.model) ? 0.5 : 1;
  private key() {
    const k = process.env.ELEVENLABS_API_KEY?.trim();
    if (!k) throw new Error("Missing ELEVENLABS_API_KEY in .env");
    return k;
  }

  voiceFor(language: LanguageType) {
    const id = language === "hi-IN" ? process.env.ELEVENLABS_VOICE_HI : process.env.ELEVENLABS_VOICE_EN;
    if (!id?.trim()) throw new Error(`Missing ELEVENLABS_VOICE_${language === "hi-IN" ? "HI" : "EN"} in .env`);
    return id.trim();
  }

  async synthesize(req: { text: string; language: LanguageType; voiceId: string; mp3Path: string }): Promise<VoiceResult> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}/with-timestamps?output_format=mp3_44100_128`;
    const supportsLanguageCode = /v2_5|v3/.test(this.model);
    const body = {
      text: req.text,
      model_id: this.model,
      ...(supportsLanguageCode ? { language_code: req.language.slice(0, 2) } : {}),
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
    };
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": this.key(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as { audio_base64: string; alignment: Alignment };
        writeFileSync(req.mp3Path, Buffer.from(data.audio_base64, "base64"));
        return {
          words: charsToWords(data.alignment),
          seconds: mp3Seconds(req.mp3Path, 128000),
          characters: req.text.length,
        };
      }
      lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
      if (res.status !== 429 && res.status < 500) break; // not worth retrying
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
    throw new Error(`ElevenLabs failed. ${lastError}`);
  }

  async remainingCredits(): Promise<number | null> {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": this.key() } });
    if (!res.ok) return null;
    const s = (await res.json()) as { character_count?: number; character_limit?: number };
    return s.character_limit != null && s.character_count != null ? s.character_limit - s.character_count : null;
  }

  async voiceName(voiceId: string): Promise<string> {
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { headers: { "xi-api-key": this.key() } });
    if (!res.ok) return voiceId;
    return ((await res.json()) as { name?: string }).name ?? voiceId;
  }
}

export function createVoiceProvider(choice?: string): VoiceProvider {
  const pick = (choice ?? process.env.TTS_PROVIDER ?? "edge").toLowerCase();
  return pick.startsWith("eleven") ? new ElevenLabsProvider() : new EdgeTtsProvider();
}

export function saveTiming(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}
