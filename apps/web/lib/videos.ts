import { createSupabaseServer } from "@/lib/supabase/server";

export type LibraryProject = {
  id: string; title: string; language: string; duration_target: number;
  theme: string; stage: string; updated_at: string;
};
type JobRow = { project_id: string; status: string; progress: number };
type VideoRow = { project_id: string; expires_at: string; deleted_at: string | null; created_at: string };

export type LibraryCardState =
  | { kind: "draft"; label: string }
  | { kind: "queued" }
  | { kind: "rendering"; progress: number }
  | { kind: "ready"; expiresAt: string }
  | { kind: "expired" };

const DRAFT_LABEL: Record<string, string> = {
  planning: "Planning · script not written yet",
  storyboard: "Storyboard · not rendered yet",
};

// Pure, so it's unit-testable without a database: given what's known about a project, its
// most recent render job (if one is active), and its most recent video (if any), decide
// which of the four library states to show. `now` is injectable for testing.
export function deriveLibraryState(
  project: { stage: string }, activeJob: JobRow | undefined, latestVideo: VideoRow | undefined, now = new Date(),
): LibraryCardState {
  if (activeJob) {
    return activeJob.status === "queued" ? { kind: "queued" } : { kind: "rendering", progress: activeJob.progress };
  }
  if (latestVideo) {
    const expired = latestVideo.deleted_at !== null || new Date(latestVideo.expires_at) <= now;
    return expired ? { kind: "expired" } : { kind: "ready", expiresAt: latestVideo.expires_at };
  }
  return { kind: "draft", label: DRAFT_LABEL[project.stage] ?? project.stage };
}

export type LibraryEntry = { project: LibraryProject; state: LibraryCardState };

// Every project the signed-in user has (security rules limit this to their own), each with
// its current library state. Two extra queries (jobs, videos) rather than a join, since
// only a handful of rows exist for one person's account.
export async function libraryEntries(): Promise<LibraryEntry[]> {
  const supabase = await createSupabaseServer();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, language, duration_target, theme, stage, updated_at")
    .order("updated_at", { ascending: false });
  if (!projects?.length) return [];

  const [{ data: jobs }, { data: videos }] = await Promise.all([
    supabase.from("jobs").select("project_id, status, progress").in("status", ["queued", "voicing", "rendering", "uploading"]),
    supabase.from("videos").select("project_id, expires_at, deleted_at, created_at").order("created_at", { ascending: false }),
  ]);

  const jobByProject = new Map((jobs ?? []).map((j) => [j.project_id, j as JobRow]));
  const latestVideoByProject = new Map<string, VideoRow>();
  for (const v of (videos ?? []) as VideoRow[]) {
    if (!latestVideoByProject.has(v.project_id)) latestVideoByProject.set(v.project_id, v); // first = newest (already ordered)
  }

  return (projects as LibraryProject[]).map((project) => ({
    project,
    state: deriveLibraryState(project, jobByProject.get(project.id), latestVideoByProject.get(project.id)),
  }));
}
