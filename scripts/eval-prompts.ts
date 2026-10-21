// Usage: npm run eval [-- --llm ollama] [--only en|hi]
// Generates a plan for each test topic and summarises how often it worked first time.
import { createLLMChain, generatePlan, type LanguageType } from "../packages/shared/src/index";
import { makeRunDir, parseArgs, parseLength, saveJson } from "./lib";

const TOPICS: { topic: string; language: LanguageType }[] = [
  { topic: "How does water evaporate?", language: "en-IN" },
  { topic: "How does snowfall happen?", language: "en-IN" },
  { topic: "Why is the sky blue?", language: "en-IN" },
  { topic: "How does a rainbow form?", language: "en-IN" },
  { topic: "How does photosynthesis work?", language: "en-IN" },
  { topic: "Why do we have seasons?", language: "en-IN" },
  { topic: "How does lightning happen?", language: "en-IN" },
  { topic: "Why does ice float on water?", language: "en-IN" },
  { topic: "How do bees make honey?", language: "en-IN" },
  { topic: "How does the heart pump blood?", language: "en-IN" },
  { topic: "जल चक्र कैसे काम करता है?", language: "hi-IN" },
  { topic: "बारिश कैसे होती है?", language: "hi-IN" },
  { topic: "आसमान नीला क्यों दिखता है?", language: "hi-IN" },
  { topic: "पौधे भोजन कैसे बनाते हैं?", language: "hi-IN" },
  { topic: "इंद्रधनुष कैसे बनता है?", language: "hi-IN" },
];

const { flags } = parseArgs(process.argv.slice(2));
const llm = flags.llm === "ollama" ? "ollama" : "gemini";
const only = flags.only; // "en" or "hi"
const topics = TOPICS.filter((t) => !only || t.language.startsWith(only));
const chain = createLLMChain(llm);
const durationTarget = parseLength(flags.length);
const rows: Record<string, unknown>[] = [];

for (const [i, t] of topics.entries()) {
  console.log(`\n[${i + 1}/${topics.length}] ${t.topic}`);
  const { report } = await generatePlan({ ...t, durationTarget, chain, log: (l) => console.log(`  ${l}`) });
  rows.push({
    topic: t.topic.slice(0, 32), lang: t.language, ok: report.ok, calls: report.attempts,
    words: report.words ?? "-", scenes: report.scenes ?? "-", model: report.provider ?? "-",
    secs: report.seconds, cueNotes: report.warnings.length,
  });
  await new Promise((r) => setTimeout(r, 4000)); // stay gentle on free-tier rate limits
}

console.table(rows);
const passed = rows.filter((r) => r.ok).length;
const firstTry = rows.filter((r) => r.ok && r.calls === 1).length;
console.log(`\nValid: ${passed}/${rows.length}. First try: ${firstTry}/${rows.length}.`);
const dir = makeRunDir(`eval-${llm}`, "eval_");
saveJson(dir, "eval.json", rows);
console.log(`Saved: ${dir}`);
