// The three pipeline steps, shared by the individual commands and make-video.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTimeline, config, createLLMChain, createVoiceProvider, generatePlan, narrationCharacters,
  LENGTH_WARNING_SECONDS, ScenePlan, voicePlan, type DurationTargetType, type LanguageType, type ScenePlanType,
  type ThemeChoiceType, type WordTiming,
} from "../packages/shared/src/index";
import { makeRunDir, readJson, saveJson } from "./lib";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VIDEO_DIR = path.join(ROOT, "packages", "video");
const PUBLIC_DIR = path.join(VIDEO_DIR, "public");

export const loadPlan = (runDir: string): ScenePlanType => ScenePlan.parse(readJson(path.join(runDir, "plan.json")));

// ---------- Step 1: plan ----------
export async function planStep(args: { topic: string; language: LanguageType; durationTarget: DurationTargetType; themeChoice: ThemeChoiceType; llm: "gemini" | "ollama"; notes?: string }) {
  const { plan, report } = await generatePlan({ ...args, chain: createLLMChain(args.llm), log: (l) => console.log(l) });
  const runDir = makeRunDir(args.topic);
  saveJson(runDir, "report.json", { step: "plan", topic: args.topic, language: args.language, durationTarget: args.durationTarget, themeChoice: args.themeChoice, ...report });
  if (!plan) {
    throw new Error(`No valid script. Last problems:\n- ${report.lastErrors.join("\n- ")}\nReport saved in ${runDir}`);
  }
  saveJson(runDir, "plan.json", plan);
  console.log(`\n"${plan.title}"  (${report.provider}, ${report.attempts} call(s), ${report.seconds}s)`);
  console.log(`${report.scenes} scenes, ${report.words} words, length: ${args.durationTarget} s, theme: ${plan.theme}${args.themeChoice === "auto" ? " (picked by Gemini)" : " (your choice)"}`);
  for (const s of plan.scenes) {
    console.log(`  ${s.id.padEnd(4)}${s.content.template.padEnd(14)}${s.narration.slice(0, 70)}${s.narration.length > 70 ? "..." : ""}`);
  }
  for (const w of report.warnings) console.log(`  note: ${w}`);
  console.log(`Saved: ${runDir}`);
  return runDir;
}

// ---------- Step 2: voice ----------
export async function voiceStep(runDir: string, opts: { tts?: string; voice?: string; force?: boolean }) {
  const plan = loadPlan(runDir);
  const provider = createVoiceProvider(opts.tts);
  const voiceId = opts.voice ?? provider.voiceFor(plan.language);
  console.log(`\nVoice: ${provider.name} / ${voiceId}  ("${plan.title}", ${plan.language})`);
  if (provider.remainingCredits) {
    const needed = Math.ceil(narrationCharacters(plan) * provider.creditsPerCharacter);
    const left = await provider.remainingCredits();
    console.log(`Credits: about ${needed} needed, ${left ?? "unknown"} left this month`);
    if (left != null && left < needed) throw new Error("Not enough ElevenLabs credits for this plan. Use --tts edge for the free voice.");
  }
  const report = await voicePlan({ plan, runDir, provider, voiceId, force: opts.force, log: (l) => console.log(l) });
  saveJson(runDir, "voice-report.json", report);
  const len = report.estimatedVideoSeconds;
  const target = plan.durationTarget;
  let verdict: string;
  if (target) {
    const limits = LENGTH_WARNING_SECONDS[target];
    verdict = len > limits.max ? `WARNING: long for a ${target} s video (over ${limits.max} s)`
      : len < limits.min ? `WARNING: short for a ${target} s video (under ${limits.min} s)`
      : `fits the ${target} s choice`;
  } else {
    verdict = len < 60 ? "SHORT (under 60 s)" : len > 90 ? "LONG (over 90 s)" : "within 60-90 s";
  }
  console.log(`Narration: ${report.narrationSeconds}s, video about ${len}s -> ${verdict}`);
  console.log(`Pace: ${report.wordsPerMinute} words per minute${report.estimatedCredits ? `, credits used: about ${report.estimatedCredits}` : ""}`);
  return report;
}

// ---------- Step 3: render ----------
function pickMusic(choice?: string): string | undefined {
  if (choice === "none") return undefined;
  const musicDir = path.join(config.mediaDir(), "music");
  if (choice) return existsSync(choice) ? choice : path.join(musicDir, choice);
  if (!existsSync(musicDir)) return undefined;
  const first = readdirSync(musicDir).find((f) => /\.(mp3|m4a|wav)$/i.test(f));
  return first ? path.join(musicDir, first) : undefined;
}

export async function renderStep(runDir: string, opts: { concurrency?: number; music?: string; scale?: number }) {
  const plan = loadPlan(runDir);
  const runName = path.basename(runDir);

  // Copy this run's audio into Remotion's public folder (replacing older runs to save space).
  const publicRuns = path.join(PUBLIC_DIR, "runs");
  rmSync(publicRuns, { recursive: true, force: true });
  mkdirSync(path.join(publicRuns, runName), { recursive: true });
  const voices: Record<string, { seconds: number; words: WordTiming[]; audioSrc: string }> = {};
  for (const scene of plan.scenes) {
    const mp3 = path.join(runDir, "audio", `${scene.id}.mp3`);
    const timingFile = path.join(runDir, "timing", `${scene.id}.json`);
    if (!existsSync(mp3) || !existsSync(timingFile)) throw new Error(`Scene ${scene.id} has no audio yet. Run: npm run voice -- ${runName}`);
    copyFileSync(mp3, path.join(publicRuns, runName, `${scene.id}.mp3`));
    const t = readJson<{ seconds: number; words: WordTiming[] }>(timingFile);
    voices[scene.id] = { seconds: t.seconds, words: t.words, audioSrc: `runs/${runName}/${scene.id}.mp3` };
  }

  let musicSrc: string | undefined;
  const music = pickMusic(opts.music);
  if (music && existsSync(music)) {
    mkdirSync(path.join(PUBLIC_DIR, "music"), { recursive: true });
    const name = path.basename(music).replace(/[^a-z0-9.]+/gi, "-");
    copyFileSync(music, path.join(PUBLIC_DIR, "music", name));
    musicSrc = `music/${name}`;
  }

  const timeline = buildTimeline(plan, voices, musicSrc);
  saveJson(runDir, "timeline.json", timeline);
  const inputProps = { plan, timeline };
  // Lets `npm run studio` preview this run.
  writeFileSync(path.join(VIDEO_DIR, "src", "preview-props.json"), JSON.stringify(inputProps), "utf8");

  const cueBeats = timeline.scenes.flatMap((s) => s.beats);
  console.log(`\nTimeline: ${(timeline.totalFrames / 30).toFixed(1)}s, ${timeline.totalFrames} frames, ` +
    `${cueBeats.filter((b) => b.fromCue).length}/${cueBeats.length} animations timed by cue words` +
    `${musicSrc ? `, music: ${path.basename(musicSrc)}` : ", no music"}`);

  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const started = Date.now();
  console.log("Bundling the video code...");
  const serveUrl = await bundle({ entryPoint: path.join(VIDEO_DIR, "src", "index.ts"), publicDir: PUBLIC_DIR });
  const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps });

  const output = path.join(runDir, "video.mp4");
  let lastShown = -1;
  console.log(`Rendering ${composition.durationInFrames} frames (first run downloads a small browser, about 100 MB)...`);
  await renderMedia({
    serveUrl, composition, inputProps, codec: "h264", outputLocation: output,
    concurrency: opts.concurrency ?? 2, x264Preset: "veryfast", crf: 20, scale: opts.scale ?? 1,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 20) * 5;
      if (pct !== lastShown) {
        lastShown = pct;
        const elapsed = (Date.now() - started) / 1000;
        console.log(`  ${pct}%  (${Math.round(elapsed)}s)`);
      }
    },
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  const report = {
    videoSeconds: Math.round((timeline.totalFrames / 30) * 10) / 10,
    frames: timeline.totalFrames,
    renderSeconds: seconds,
    framesPerSecond: Math.round((timeline.totalFrames / seconds) * 10) / 10,
    concurrency: opts.concurrency ?? 2,
    cueTimedAnimations: `${cueBeats.filter((b) => b.fromCue).length}/${cueBeats.length}`,
    music: musicSrc ?? null,
  };
  saveJson(runDir, "render-report.json", report);
  console.log(`\nDone in ${Math.floor(seconds / 60)}m ${seconds % 60}s: ${output}`);
  return report;
}
