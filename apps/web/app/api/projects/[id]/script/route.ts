import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generatePlan } from "@shared/generatePlan";
import { createLLMChain } from "@shared/providers/llm";
import type { DurationTargetType, LanguageType, ThemeChoiceType } from "@shared/schema";
import { apiError, finishLlmCall, reserveLlmCall, savePlanError } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

// Writing a script takes 30-60 seconds (Gemini plus up to 2 repairs).
export const maxDuration = 120;

// planVersion is sent when replacing an existing script, so a stale request is refused
// before any AI call is made (and before it counts against the hourly allowance).
const ScriptBody = z.object({ planVersion: z.number().int().min(0).optional() });

// POST /api/projects/:id/script: write (or rewrite) the scene plan with Gemini.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return apiError(401, "unauthorized", "Please sign in again.");

  const body = ScriptBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return apiError(422, "validation_failed", "The request was not valid.");

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, language, duration_target, theme, input_mode, input_text, plan_version")
    .eq("id", id)
    .maybeSingle();
  if (!project) return apiError(404, "not_found", "That project doesn't exist.");
  if (!project.input_text?.trim()) return apiError(422, "validation_failed", "This project has no topic or notes yet.");
  if (body.data.planVersion !== undefined && body.data.planVersion !== project.plan_version) {
    return apiError(409, "version_conflict", "This project changed in another tab. Reload to see the latest version.");
  }

  const reservation = await reserveLlmCall(supabase, "script", id);
  if ("response" in reservation) return reservation.response;

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
    await finishLlmCall(supabase, reservation.id, { ok: false, providersTried: [], attempts: 1 }, started);
    return apiError(500, "internal", "Something went wrong while writing the script. Please try again.");
  }
  const { plan, report } = result;
  await finishLlmCall(supabase, reservation.id, report, started);

  if (!plan) {
    if (report.attempts === 0 || report.lastErrors.length === 0) {
      return apiError(503, "llm_unavailable", "The script writer is busy right now. Please try again in a minute.");
    }
    return apiError(502, "script_failed", "Couldn't write a script that passed all checks. Try rephrasing your topic.", {
      problems: report.lastErrors,
    });
  }

  // Save with the version check, so a second tab can't be overwritten silently. The title
  // is set in the same write, so the plan and the project can never disagree.
  const { data: newVersion, error: saveError } = await supabase.rpc("save_plan", {
    p_project: id, p_plan: plan, p_expected: project.plan_version, p_title: plan.title,
  });
  if (saveError) return savePlanError(saveError.message);

  return NextResponse.json({
    scenePlan: plan,
    planVersion: newVersion,
    report: { provider: report.provider, attempts: report.attempts, seconds: report.seconds, words: report.words, warnings: report.warnings },
  });
}
