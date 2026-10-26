import { NextResponse, type NextRequest } from "next/server";
import { CreateProjectBody, titleFrom } from "@shared/api";
import { apiError } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

// POST /api/projects: create a project from the Create page.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return apiError(401, "unauthorized", "Please sign in again.");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError(422, "validation_failed", "The request was not valid JSON.");
  }
  const parsed = CreateProjectBody.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join(".") || "body", i.message]));
    return apiError(422, "validation_failed", Object.values(fields)[0] ?? "Please check the form.", { fields });
  }
  const b = parsed.data;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      title: titleFrom(b.inputMode, b.inputText),
      language: b.language,
      duration_target: b.durationTarget,
      theme: b.theme,
      input_mode: b.inputMode,
      input_text: b.inputText,
    })
    .select("id, title, language, duration_target, theme, input_mode, stage, plan_version, created_at")
    .single();

  if (error || !data) {
    console.error("create project failed:", error?.message);
    return apiError(500, "internal", "Couldn't save your project. Please try again.");
  }
  return NextResponse.json({ project: data }, { status: 201 });
}
