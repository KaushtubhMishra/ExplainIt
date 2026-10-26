import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ScenePlan } from "@shared/schema";
import { apiError } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

const SaveBody = z.object({
  planVersion: z.number().int().min(0),
  scenePlan: z.unknown(),
});

// PATCH /api/projects/:id: save edits to the scene plan (called by autosave).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return apiError(401, "unauthorized", "Please sign in again.");

  const body = SaveBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(422, "validation_failed", "The save request was not valid.");

  const { data: project } = await supabase.from("projects")
    .select("id, language, duration_target, plan_version").eq("id", id).maybeSingle();
  if (!project) return apiError(404, "not_found", "That project doesn't exist.");

  const plan = ScenePlan.safeParse(body.data.scenePlan);
  if (!plan.success) {
    const fields = Object.fromEntries(plan.error.issues.slice(0, 10).map((i) => [i.path.join("."), i.message]));
    return apiError(422, "validation_failed", "Some text is too long or missing. Please check the highlighted fields.", { fields });
  }
  // The language and length belong to the project; edits can't change them.
  const toSave = { ...plan.data, language: project.language, durationTarget: project.duration_target };

  const { data: newVersion, error } = await supabase.rpc("save_plan", {
    p_project: id, p_plan: toSave, p_expected: body.data.planVersion,
  });
  if (error) {
    if (error.message.includes("version_conflict")) {
      return apiError(409, "version_conflict", "This project changed in another tab. Reload to see the latest version.", {
        planVersion: project.plan_version,
      });
    }
    console.error("save_plan failed:", error.message);
    return apiError(500, "internal", "Couldn't save your changes. Please try again.");
  }
  return NextResponse.json({ planVersion: newVersion });
}
