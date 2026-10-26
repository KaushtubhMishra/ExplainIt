import { NextResponse, type NextRequest } from "next/server";
import { generatePlan } from "@shared/generatePlan";
import { createLLMChain } from "@shared/providers/llm";
import type { DurationTargetType, LanguageType, ThemeChoiceType } from "@shared/schema";
import { apiError } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

// Writing a script takes 30-60 seconds (Gemini plus up to 2 repairs).
export const maxDuration = 120;

const LLM_CALLS_PER_HOUR = 20;

// POST /api/projects/:id/script: write (or rewrite) the scene plan with Gemini.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return apiError(401, "unauthorized", "Please sign in again.");

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, language, duration_target, theme, input_mode, input_text, plan_version")
    .eq("id", id)
    .maybeSingle();
  if (!project) return apiError(404, "not_found", "That project doesn't exist.");
  if (!project.input_text?.trim()) return apiError(422, "validation_failed", "This project has no topic or notes yet.");

  // Hourly limit on AI calls, counted from llm_calls (protects the free Gemini quota).
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("llm_calls").select("id", { count: "exact", head: true }).gte("created_at", hourAgo);
  if ((count ?? 0) >= LLM_CALLS_PER_HOUR) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: `You've used all ${LLM_CALLS_PER_HOUR} AI requests for this hour. Please try again a little later.` } },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  const notesMode = project.input_mode === "notes";
  const started = Date.now();
  let result: Awaited<ReturnType<typeof generatePlan>>;
  try {
    result = await generatePlan({
      topic: notesMode ? project.title : project.input_text,
      notes: notesMode ? project.input_text : undefined,
      language: project.language as LanguageType,
      durationTarget: project.duration_target as DurationTargetType,
      themeChoice: project.theme as ThemeChoiceType,
      chain: createLLMChain("gemini"),
      log: (line) => console.log(`[script ${id.slice(0, 8)}] ${line}`),
    });
  } catch (e) {
    console.error("script generation crashed:", (e as Error).message);
    return apiError(500, "internal", "Something went wrong while writing the script. Please try again.");
  }
  const { plan, report } = result;

  await supabase.from("llm_calls").insert({
    user_id: userId, project_id: id, kind: "script", ok: report.ok,
    provider: report.provider ?? report.providersTried.at(-1) ?? "none",
    attempts: Math.max(1, report.attempts), seconds: Math.round((Date.now() - started) / 100) / 10,
  });

  if (!plan) {
    if (report.attempts === 0 || report.lastErrors.length === 0) {
      return apiError(503, "llm_unavailable", "The script writer is busy right now. Please try again in a minute.");
    }
    return apiError(502, "script_failed", "Couldn't write a script that passed all checks. Try rephrasing your topic.", {
      problems: report.lastErrors,
    });
  }

  // Save with the version check, so a second tab can't be overwritten silently.
  const { data: newVersion, error: saveError } = await supabase.rpc("save_plan", {
    p_project: id, p_plan: plan, p_expected: project.plan_version,
  });
  if (saveError) {
    if (saveError.message.includes("version_conflict")) {
      return apiError(409, "version_conflict", "This project changed in another tab. Reload to see the latest version.");
    }
    console.error("save_plan failed:", saveError.message);
    return apiError(500, "internal", "The script was written but couldn't be saved. Please try again.");
  }
  await supabase.from("projects").update({ title: plan.title }).eq("id", id);

  return NextResponse.json({
    scenePlan: plan,
    planVersion: newVersion,
    report: { provider: report.provider, attempts: report.attempts, seconds: report.seconds, words: report.words, warnings: report.warnings },
  });
}
