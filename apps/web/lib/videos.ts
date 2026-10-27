import { createSupabaseServer } from "@/lib/supabase/server";

export type LibraryProject = {
  id: string; title: string; language: string; duration_target: number;
  theme: string; stage: string; updated_at: string;
};
type JobRow = { id: string; project_id: string; status: string; progress: number; error: string | null };
type VideoRow = { project_id: string; expires_at: string; deleted_at: string | null; created_at: string };

export type LibraryCardState =
  | { kind: "draft"; label: string }
  | { kind: "queued" }
  | { kind: "rendering"; progress: number }
  | { kind: "ready"; expiresAt: string }
  | { kind: "expired" }
  | { kind: "failed"; jobId: string; error: string };

// Defensive fallbacks too, so a project can never show a raw enum word (for example
// "rendering" or "ready" with no matching job or video row, which shouldn't normally
// happen but is cheap to guard against).
const DRAFT_LABEL: Record<string, string> = {
  planning: "Planning · script not written yet",
  storyboard: "Storyboard · not rendered yet",
  rendering: "Rendering · waiting for an update",
  ready: "Checking your video...",
};

// Pure, so it's unit-testable without a database: given what's known about a project, its
// most recent render job (if one is active or failed), and its most recent video (if any),
// decide which of the six library states to show. `now` is injectable for testing.
// Priority: an active job is the freshest signal; a failed job is more urgent to surface
// than an old video from an earlier attempt; only then does an existing video's own
// expiry decide ready vs. expired.
export function deriveLibraryState(
  project: { stage: string }, activeJob: JobRow | undefined, failedJob: JobRow | undefined,
  latestVideo: VideoRow | undefined, now = new Date(),
): LibraryCardState {
  if (activeJob) {
    return activeJob.status === "queued" ? { kind: "queued" } : { kind: "rendering", progress: activeJob.progress };
  }
  if (failedJob) {
    return { kind: "failed", jobId: failedJob.id, error: failedJob.error ?? "The render failed for an unknown reason." };
  }
  if (latestVideo) {
    const expired = latestVideo.deleted_at !== null || new Date(latestVideo.expires_at) <= now;
    return expired ? { kind: "expired" } : { kind: "ready", expiresAt: latestVideo.expires_at };
  }
  return { kind: "draft", label: DRAFT_LABEL[project.stage] ?? project.stage };
}

export type LibraryEntry = { project: LibraryProject; state: LibraryCardState };

// Every project the signed-in user has (security rules limit this to their own), each with
// its current library state. Separate queries rather than a join, since only a handful of
// rows exist for one person's account; videos is capped since it only grows over time.
export async function libraryEntries(): Promise<LibraryEntry[]> {
  const supabase = await createSupabaseServer();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, language, duration_target, theme, stage, updated_at")
    .order("updated_at", { ascending: false });
  if (!projects?.length) return [];

  const [{ data: activeJobs }, { data: failedJobs }, { data: videos }] = await Promise.all([
    supabase.from("jobs").select("id, project_id, status, progress, error").in("status", ["queued", "voicing", "rendering", "uploading"]),
    supabase.from("jobs").select("id, project_id, status, progress, error").eq("status", "failed").order("finished_at", { ascending: false }),
    supabase.from("videos").select("project_id, expires_at, deleted_at, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const activeByProject = new Map((activeJobs ?? []).map((j) => [j.project_id, j as JobRow]));
  const failedByProject = new Map<string, JobRow>();
  for (const j of (failedJobs ?? []) as JobRow[]) {
    if (!failedByProject.has(j.project_id)) failedByProject.set(j.project_id, j); // first = newest (already ordered)
  }
  const latestVideoByProject = new Map<string, VideoRow>();
  for (const v of (videos ?? []) as VideoRow[]) {
    if (!latestVideoByProject.has(v.project_id)) latestVideoByProject.set(v.project_id, v); // first = newest (already ordered)
  }

  return (projects as LibraryProject[]).map((project) => ({
    project,
    state: deriveLibraryState(
      project, activeByProject.get(project.id), failedByProject.get(project.id), latestVideoByProject.get(project.id),
    ),
  }));
}
