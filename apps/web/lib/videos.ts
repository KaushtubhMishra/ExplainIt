import { createSupabaseServer } from "@/lib/supabase/server";

export type LibraryProject = {
  id: string; title: string; language: string; duration_target: number;
  theme: string; stage: string; updated_at: string;
};
type JobRow = { id: string; project_id: string; status: string; progress: number; error: string | null; plan_version: number };
type VideoRow = { project_id: string; expires_at: string; deleted_at: string | null; created_at: string };

export type LibraryCardState =
  | { kind: "draft"; label: string }
  | { kind: "queued" }
  | { kind: "rendering"; progress: number }
  | { kind: "ready"; expiresAt: string }
  | { kind: "expired" }
  | { kind: "failed"; jobId: string; error: string };

const ACTIVE_STATUSES = new Set(["voicing", "rendering", "uploading"]);

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
// SINGLE most recent job (of any status, or undefined if it has never been rendered), and
// its most recent video (if any), decide which of the six library states to show. `now` is
// injectable for testing.
//
// Only the single latest job is used, deliberately, rather than separately tracking "the
// latest active job" and "the latest failed job": the database allows only one active job
// per project at a time, so a project's jobs are always processed in creation order and
// the latest job by created_at is always the latest render attempt, full stop. That means
// if the latest job succeeded, there is no way for an older failed job to be more recent
// than the video it produced — so a stale "Failed" card can never outrank a newer "Ready"
// one, which a two-query (active + failed) version could get wrong.
export function deriveLibraryState(
  project: { stage: string }, latestJob: JobRow | undefined, latestVideo: VideoRow | undefined, now = new Date(),
): LibraryCardState {
  if (latestJob) {
    if (latestJob.status === "queued") return { kind: "queued" };
    if (ACTIVE_STATUSES.has(latestJob.status)) return { kind: "rendering", progress: latestJob.progress };
    if (latestJob.status === "failed") {
      return { kind: "failed", jobId: latestJob.id, error: latestJob.error ?? "The render failed for an unknown reason." };
    }
    // "done" or "cancelled": fall through to the video (if the job finished) or draft check.
  }
  if (latestVideo) {
    const expired = latestVideo.deleted_at !== null || new Date(latestVideo.expires_at) <= now;
    return expired ? { kind: "expired" } : { kind: "ready", expiresAt: latestVideo.expires_at };
  }
  return { kind: "draft", label: DRAFT_LABEL[project.stage] ?? project.stage };
}

export type LibraryEntry = { project: LibraryProject; state: LibraryCardState };

// Every project the signed-in user has (security rules limit this to their own), each with
// its current library state. Jobs and videos are both scoped to exactly these project ids,
// rather than a row-count cap, so an older project's video is never hidden just because
// the account has accumulated many rows over time.
export async function libraryEntries(): Promise<LibraryEntry[]> {
  const supabase = await createSupabaseServer();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, language, duration_target, theme, stage, updated_at")
    .order("updated_at", { ascending: false });
  if (!projects?.length) return [];
  const projectIds = projects.map((p) => p.id);

  const [{ data: jobs }, { data: videos }] = await Promise.all([
    supabase.from("jobs").select("id, project_id, status, progress, error, plan_version")
      .in("project_id", projectIds).order("created_at", { ascending: false }),
    supabase.from("videos").select("project_id, expires_at, deleted_at, created_at")
      .in("project_id", projectIds).order("created_at", { ascending: false }),
  ]);

  const latestJobByProject = new Map<string, JobRow>();
  for (const j of (jobs ?? []) as JobRow[]) {
    if (!latestJobByProject.has(j.project_id)) latestJobByProject.set(j.project_id, j); // first = newest (already ordered)
  }
  const latestVideoByProject = new Map<string, VideoRow>();
  for (const v of (videos ?? []) as VideoRow[]) {
    if (!latestVideoByProject.has(v.project_id)) latestVideoByProject.set(v.project_id, v); // first = newest (already ordered)
  }

  return (projects as LibraryProject[]).map((project) => ({
    project,
    state: deriveLibraryState(project, latestJobByProject.get(project.id), latestVideoByProject.get(project.id)),
  }));
}
