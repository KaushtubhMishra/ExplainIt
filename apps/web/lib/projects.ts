import { createSupabaseServer } from "@/lib/supabase/server";

export type ProjectSummary = {
  id: string; title: string; language: string; duration_target: number; theme: string;
  input_mode: string; input_text: string; stage: string; plan_version: number; updated_at: string;
};

const COLUMNS = "id, title, language, duration_target, theme, input_mode, input_text, stage, plan_version, updated_at";

// Unfinished projects for "Continue where you left off" (security rules limit this to the user's own).
export async function recentDrafts(limit = 3): Promise<ProjectSummary[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("projects").select(COLUMNS)
    .in("stage", ["planning", "storyboard"]).order("updated_at", { ascending: false }).limit(limit);
  return (data ?? []) as ProjectSummary[];
}

export async function getProject(id: string): Promise<ProjectSummary | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("projects").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as ProjectSummary) ?? null;
}

export const STAGE_LABEL: Record<string, string> = {
  planning: "Planning · script not written yet",
  storyboard: "Storyboard · not rendered yet",
  rendering: "Rendering",
  ready: "Ready",
};
