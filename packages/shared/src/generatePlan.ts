import { ScenePlan, type DurationTargetType, type LanguageType, type ScenePlanType, type ThemeChoiceType } from "./schema";
import { checkPlanRules, totalWords } from "./rules";
import { buildScriptPrompt, SCRIPT_PROMPT_VERSION } from "./prompts/script.v1";
import { ProviderUnavailableError, type LLMProvider, type Msg } from "./providers/llm";

export type PlanReport = {
  ok: boolean;
  prompt: string;
  provider?: string;
  providersTried: string[];
  attempts: number; // total LLM calls
  repairs: number; // calls that were fixing an invalid answer
  seconds: number;
  words?: number;
  scenes?: number;
  templates?: string[];
  warnings: string[];
  lastErrors: string[];
};

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in the answer.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Shorten text to max characters, cutting at a word boundary where possible.
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

function setAt(obj: unknown, path: (string | number)[], value: unknown) {
  let cur = obj as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) cur = cur[key] as Record<string | number, unknown>;
  cur[path[path.length - 1]] = value;
}

function getAt(obj: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((cur, key) => (cur as Record<string | number, unknown>)?.[key], obj);
}

function validate(text: string, durationTarget: DurationTargetType, themeChoice: ThemeChoiceType): { plan?: ScenePlanType; errors: string[]; warnings: string[] } {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { errors: [`The answer was not valid JSON: ${(e as Error).message}`], warnings: [] };
  }
  const fixes: string[] = [];
  // The chosen length is set by our code, never left to the model.
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    r.durationTarget = durationTarget;
    // A theme the user chose always wins; with "auto" the model's choice is kept.
    if (themeChoice !== "auto") r.theme = themeChoice;
  }
  let parsed = ScenePlan.safeParse(raw);
  // Text that is slightly too long is shortened here instead of asking the model again.
  for (let round = 0; round < 3 && !parsed.success; round++) {
    const tooLong = parsed.error.issues.filter(
      (i) => i.code === "too_big" && i.type === "string" && typeof getAt(raw, i.path) === "string",
    );
    if (!tooLong.length) break;
    for (const issue of tooLong) {
      const max = Number((issue as { maximum: number | bigint }).maximum);
      const before = getAt(raw, issue.path) as string;
      setAt(raw, issue.path, shorten(before, max));
      fixes.push(`Shortened ${issue.path.join(".")} to ${max} characters: "${shorten(before, max)}"`);
    }
    parsed = ScenePlan.safeParse(raw);
  }
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { errors, warnings: fixes };
  }
  const { errors, warnings } = checkPlanRules(parsed.data);
  return errors.length
    ? { errors, warnings: [...fixes, ...warnings] }
    : { plan: parsed.data, errors: [], warnings: [...fixes, ...warnings] };
}

export async function generatePlan(args: {
  topic: string;
  language: LanguageType;
  durationTarget?: DurationTargetType;
  themeChoice?: ThemeChoiceType;
  notes?: string;
  chain: LLMProvider[];
  maxRepairs?: number;
  log?: (line: string) => void;
}): Promise<{ plan?: ScenePlanType; report: PlanReport }> {
  const log = args.log ?? (() => {});
  const maxRepairs = args.maxRepairs ?? 2;
  const started = Date.now();
  const durationTarget = args.durationTarget ?? 60;
  const themeChoice = args.themeChoice ?? "auto";
  const { system, user } = buildScriptPrompt({ ...args, durationTarget, themeChoice });
  const report: PlanReport = {
    ok: false, prompt: SCRIPT_PROMPT_VERSION, providersTried: [], attempts: 0, repairs: 0,
    seconds: 0, warnings: [], lastErrors: [],
  };

  for (const provider of args.chain) {
    report.providersTried.push(provider.name);
    const messages: Msg[] = [{ role: "user", content: user }];
    try {
      for (let i = 0; i <= maxRepairs; i++) {
        log(`${provider.name}: ${i === 0 ? "writing the script" : `fixing the script (repair ${i})`}...`);
        report.attempts++;
        if (i > 0) report.repairs++;
        const callStart = Date.now();
        const heartbeat = setInterval(() => {
          log(`  still working... ${Math.round((Date.now() - callStart) / 1000)}s`);
        }, 20000);
        let text: string;
        try {
          text = await provider.generateText({ system, messages, json: true });
        } finally {
          clearInterval(heartbeat);
        }
        log(`  answer received in ${Math.round((Date.now() - callStart) / 1000)}s`);
        const result = validate(text, durationTarget, themeChoice);
        if (result.plan) {
          Object.assign(report, {
            ok: true, provider: provider.name, warnings: result.warnings, lastErrors: [],
            words: totalWords(result.plan), scenes: result.plan.scenes.length,
            templates: result.plan.scenes.map((s) => s.content.template),
            seconds: Math.round((Date.now() - started) / 1000),
          });
          return { plan: result.plan, report };
        }
        report.lastErrors = result.errors;
        log(`  problems: ${result.errors.join(" | ")}`);
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content: `Your JSON has these problems:\n- ${result.errors.join("\n- ")}\nReturn the complete corrected JSON object only.`,
        });
      }
      // Repairs used up on this provider: stop here rather than burning the fallbacks.
      break;
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        log(`  ${err.message}; trying the next provider.`);
        continue;
      }
      throw err;
    }
  }
  report.seconds = Math.round((Date.now() - started) / 1000);
  return { report };
}
