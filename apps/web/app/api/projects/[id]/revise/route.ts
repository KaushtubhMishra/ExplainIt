import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revisePlan } from "@shared/generatePlan";
import { createLLMChain } from "@shared/providers/llm";
import { ScenePlan } from "@shared/schema";
import { apiError, llmLimitReached } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

export const maxDuration = 120;

const ReviseBody = z.object({
  message: z.string().trim().min(3, "Please describe the change.").max(1000, "Please keep the request under 1,000 characters."),
  planVersion: z.number().int().min(0),
});

// POST /api/projects/:id/revise: apply a plain-language change request to the storyboard.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return apiError(401, "unauthorized", "Please sign in again.");

  const body = ReviseBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(422, "validation_failed", body.error.issues[0]?.message ?? "Please check your request.");

  const { data: project } = await supabase.from("projects")
    .select("id, title, input_text, scene_plan, plan_version").eq("id", id).maybeSingle();
  if (!project) return apiError(404, "not_found", "That project doesn't exist.");
  if (project.plan_version !== body.data.planVersion) {
    return apiError(409, "version_conflict", "This project changed in another tab. Reload to see the latest version.");
  }
  const current = ScenePlan.safeParse(project.scene_plan);
  if (!current.success) return apiError(422, "validation_failed", "Write the script first, then ask for changes.");

  const limited = await llmLimitReached(supabase);
  if (limited) return limited;

  const started = Date.now();
  let result: Awaited<ReturnType<typeof revisePlan>>;
  try {
    result = await revisePlan({
      plan: current.data, request: body.data.message, topicText: `${project.title}\n${project.input_text}`,
      chain: createLLMChain("gemini"), log: (l) => console.log(`[revise ${id.slice(0, 8)}] ${l}`),
    });
  } catch (e) {
    console.error("revision crashed:", (e as Error).message);
    return apiError(500, "internal", "Something went wrong while making the change. Please try again.");
  }
  const { plan, report, changedSceneIds } = result;

  await supabase.from("llm_calls").insert({
    user_id: userId, project_id: id, kind: "revise", ok: report.ok,
    provider: report.provider ?? report.providersTried.at(-1) ?? "none",
    attempts: Math.max(1, report.attempts), seconds: Math.round((Date.now() - started) / 100) / 10,
  });

  if (!plan) {
    if (report.lastErrors.length === 0) return apiError(503, "llm_unavailable", "The script writer is busy right now. Please try again in a minute.");
    return apiError(502, "script_failed", "Couldn't make that change while keeping the script valid. Try wording it differently.", { problems: report.lastErrors });
  }

  const sceneNumbers = changedSceneIds.map((sid) => plan.scenes.findIndex((s) => s.id === sid) + 1).filter((n) => n > 0);
  const reply = sceneNumbers.length === 0
    ? "No scenes needed changing for that request."
    : `Updated scene${sceneNumbers.length > 1 ? "s" : ""} ${sceneNumbers.join(", ")}. The other scenes stayed the same.`;

  const { data: newVersion, error } = await supabase.rpc("save_plan", { p_project: id, p_plan: plan, p_expected: project.plan_version });
  if (error) {
    if (error.message.includes("version_conflict")) return apiError(409, "version_conflict", "This project changed in another tab. Reload to see the latest version.");
    return apiError(500, "internal", "The change was made but couldn't be saved. Please try again.");
  }
  await supabase.from("messages").insert([
    { project_id: id, user_id: userId, stage: "storyboard", role: "user", content: body.data.message },
    { project_id: id, user_id: userId, stage: "storyboard", role: "assistant", content: reply },
  ]);

  return NextResponse.json({ scenePlan: plan, planVersion: newVersion, changedSceneIds, reply });
}
