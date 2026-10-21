import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config, ThemeChoice, type DurationTargetType, type ThemeChoiceType } from "../packages/shared/src/index";

export function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { flags[a.slice(2)] = next; i++; }
      else flags[a.slice(2)] = "true";
    } else positional.push(a);
  }
  return { flags, positional };
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function slugify(text: string) {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return s || "video";
}

export function makeRunDir(topic: string, prefix = "") {
  const dir = path.join(config.mediaDir(), "runs", `${prefix}${stamp()}_${slugify(topic)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveJson(dir: string, name: string, data: unknown) {
  writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2), "utf8");
}

// Find a run folder: a full path, a folder name under runs\, or "latest" (optionally for one language).
export function findRun(which: string | undefined, language?: string): string {
  const runsDir = path.join(config.mediaDir(), "runs");
  const pick = which ?? "latest";
  if (pick !== "latest") {
    const dir = existsSync(pick) ? pick : path.join(runsDir, pick);
    if (!existsSync(path.join(dir, "plan.json"))) throw new Error(`No plan.json in ${dir}`);
    return dir;
  }
  const candidates = readdirSync(runsDir)
    .filter((name) => !name.startsWith("eval_"))
    .map((name) => path.join(runsDir, name))
    .filter((dir) => existsSync(path.join(dir, "plan.json")))
    .filter((dir) => !language || JSON.parse(readFileSync(path.join(dir, "plan.json"), "utf8")).language === language)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!candidates.length) throw new Error(`No runs with a plan.json${language ? ` in ${language}` : ""} found in ${runsDir}`);
  return candidates[0];
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function parseLength(value: string | undefined): DurationTargetType {
  if (value === undefined || value === "60") return 60;
  if (value === "90") return 90;
  throw new Error(`--length must be 60 or 90 (got "${value}")`);
}

export function parseTheme(value: string | undefined): ThemeChoiceType {
  const parsed = ThemeChoice.safeParse(value ?? "auto");
  if (!parsed.success) throw new Error(`--theme must be auto, sky, forest, sunset, or night (got "${value}")`);
  return parsed.data;
}
