import { ScenePlan, type DurationTargetType, type LanguageType, type ScenePlanType, type ThemeChoiceType } from "./schema";
import { checkPlanRules, isPureThemeRequest, mergeTargetedScenes, targetedSceneNumbers, totalWords } from "./rules";
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

function validate(text: string, language: LanguageType, durationTarget: DurationTargetType, themeChoice: ThemeChoiceType, topicText: string): { plan?: ScenePlanType; errors: string[]; warnings: string[] } {
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
    r.language = language; // the project's language, never the model's choice (it decides voice and word range)
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
  const { errors, warnings } = checkPlanRules(parsed.data, { topicText });
  return errors.length
    ? { errors, warnings: [...fixes, ...warnings] }
    : { plan: parsed.data, errors: [], warnings: [...fixes, ...warnings] };
}

type LoopArgs = {
  system: string;
  user: string;
  chain: LLMProvider[];
  maxRepairs: number;
  log: (line: string) => void;
  check: (text: string) => { plan?: ScenePlanType; errors: string[]; warnings: string[] };
  promptName: string;
};

// Ask the model, check its answer, and send problems back for repair, falling back to
// the next provider only when one is unavailable. Shared by writing and revising.
async function runPlanLoop(a: LoopArgs): Promise<{ plan?: ScenePlanType; report: PlanReport }> {
  const started = Date.now();
  const report: PlanReport = {
    ok: false, prompt: a.promptName, providersTried: [], attempts: 0, repairs: 0,
    seconds: 0, warnings: [], lastErrors: [],
  };
  for (const provider of a.chain) {
    report.providersTried.push(provider.name);
    const messages: Msg[] = [{ role: "user", content: a.user }];
    try {
      for (let i = 0; i <= a.maxRepairs; i++) {
        a.log(`${provider.name}: ${i === 0 ? "writing" : `fixing (repair ${i})`}...`);
        report.attempts++;
        if (i > 0) report.repairs++;
        const callStart = Date.now();
        const heartbeat = setInterval(() => {
          a.log(`  still working... ${Math.round((Date.now() - callStart) / 1000)}s`);
        }, 20000);
        let text: string;
        try {
          text = await provider.generateText({ system: a.system, messages, json: true });
        } finally {
          clearInterval(heartbeat);
        }
        a.log(`  answer received in ${Math.round((Date.now() - callStart) / 1000)}s`);
        const result = a.check(text);
        if (result.plan) {
          Object.assign(report, {
            ok: true, provider: provider.name, warnings: result.warnings, lastErrors: [],
            words: totalWords(result.plan), scenes: result.plan.scenes.length,
            templates: result.plan.scenes.map((sc) => sc.content.template),
            seconds: Math.round((Date.now() - started) / 1000),
          });
          return { plan: result.plan, report };
        }
        report.lastErrors = result.errors;
        a.log(`  problems: ${result.errors.join(" | ")}`);
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content: `Your JSON has these problems:\n- ${result.errors.join("\n- ")}\nReturn the complete corrected JSON object only.`,
        });
      }
      break; // repairs used up on this provider: don't burn the fallbacks
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        a.log(`  ${err.message}; trying the next provider.`);
        continue;
      }
      throw err;
    }
  }
  report.seconds = Math.round((Date.now() - started) / 1000);
  return { report };
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
  const durationTarget = args.durationTarget ?? 60;
  const themeChoice = args.themeChoice ?? "auto";
  const { system, user } = buildScriptPrompt({ ...args, durationTarget, themeChoice });
  const topicText = `${args.topic}\n${args.notes ?? ""}`;
  return runPlanLoop({
    system, user, chain: args.chain, maxRepairs: args.maxRepairs ?? 2, log: args.log ?? (() => {}),
    check: (text) => validate(text, args.language, durationTarget, themeChoice, topicText), promptName: SCRIPT_PROMPT_VERSION,
  });
}

// Scenes whose content differs between two plans (new scenes count as changed).
export function changedScenes(before: ScenePlanType, after: ScenePlanType): string[] {
  const old = new Map(before.scenes.map((sc) => [sc.id, JSON.stringify(sc)]));
  return after.scenes.filter((sc) => old.get(sc.id) !== JSON.stringify(sc)).map((sc) => sc.id);
}

// Apply a plain-language change request ("make scene 3 simpler") to an existing plan.
export async function revisePlan(args: {
  plan: ScenePlanType;
  request: string;
  themeOverride?: ScenePlanType["theme"]; // set when the request asks for a different theme
  topicText: string;
  chain: LLMProvider[];
  maxRepairs?: number;
  log?: (line: string) => void;
}): Promise<{ plan?: ScenePlanType; report: PlanReport; changedSceneIds: string[]; wordRangeConflict: boolean }> {
  const durationTarget = args.plan.durationTarget ?? 60;
  const theme = args.themeOverride ?? args.plan.theme;
  const { system } = buildScriptPrompt({
    topic: args.plan.title, language: args.plan.language, durationTarget, themeChoice: theme,
  });
  const reviseRules = `

You are now REVISING an existing plan, not writing a new one.
- Change only what the user's request asks for. Keep every other scene exactly the same, including its id, narration, and content.
- Keep scene ids stable. If you add a scene, give it the next unused id (for example "s8").
- "Scene N" in the request means the Nth scene in the list.
- The result must still follow every rule above (length, hook first, recap last).
- Return the complete revised plan JSON only.`;
  const user = `Current plan:\n${JSON.stringify(args.plan)}\n\nChange request: ${args.request}`;
  // When the request names specific scenes, the prompt alone isn't trusted to leave the
  // rest of the plan untouched: any scene not named is forced back to its exact original
  // content after the model answers, so an edit can never be lost and only the named
  // scene(s) can change. A request with no scene number ("shorten the intro") is free to
  // touch the whole plan, as before. A request that is ONLY about the colour theme ("use
  // the sunset theme") is the one exception: it locks every scene's content (an empty
  // target set), so the model can't also rewrite text while it's there. If the SAME request
  // also asks for a content change ("use the sunset theme and make it shorter"), the
  // content part is left free rather than silently dropped — it's treated like any other
  // free-form request, just with the theme override still applied.
  const namedScenes = targetedSceneNumbers(args.request);
  const themeOnly = args.themeOverride !== undefined && isPureThemeRequest(args.request, args.themeOverride);
  const targetScenes = namedScenes ?? (themeOnly ? [] : null);
  // Tracks whether the most recent attempt failed specifically because the scenes this
  // request isn't allowed to touch can't absorb the needed word-count change — used to
  // give a clearer reason than the generic failure message if every attempt ends this way.
  let wordRangeConflictOnLastAttempt = false;
  const result = await runPlanLoop({
    system: system + reviseRules, user, chain: args.chain, maxRepairs: args.maxRepairs ?? 2,
    log: args.log ?? (() => {}), promptName: "revise.v1",
    check: (text) => {
      const base = validate(text, args.plan.language, durationTarget, theme, args.topicText);
      if (!base.plan || !targetScenes) return base;
      const merged = mergeTargetedScenes(args.plan, base.plan, targetScenes);
      if (!merged) {
        // The model added or removed a scene while specific scenes were locked: positions
        // no longer line up, so its answer can't be trusted to leave the rest untouched.
        wordRangeConflictOnLastAttempt = false;
        return {
          errors: ["Do not add or remove scenes. Return exactly the same number of scenes, with the same ids, as the current plan."],
          warnings: base.warnings,
        };
      }
      const mergedCheck = checkPlanRules(merged, { topicText: args.topicText });
      if (mergedCheck.errors.length) {
        wordRangeConflictOnLastAttempt = mergedCheck.errors.some((e) => e.includes("Total narration"));
        const scope = targetScenes.length === 0
          ? "This request is only about the colour theme. Return every scene's narration and on-screen text exactly as given — change nothing but the theme."
          : `Only change scene${targetScenes.length > 1 ? "s" : ""} ${targetScenes.join(", ")}. Every other scene must be returned exactly as given, with no wording changed.`;
        return { errors: [...mergedCheck.errors, scope], warnings: base.warnings };
      }
      wordRangeConflictOnLastAttempt = false;
      return { plan: merged, errors: [], warnings: [...base.warnings, ...mergedCheck.warnings] };
    },
  });
  return {
    ...result,
    changedSceneIds: result.plan ? changedScenes(args.plan, result.plan) : [],
    wordRangeConflict: !result.plan && targetScenes !== null && wordRangeConflictOnLastAttempt,
  };
}
