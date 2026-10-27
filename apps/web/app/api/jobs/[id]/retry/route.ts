import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

// POST /api/jobs/:id/retry: put a failed job back in the queue.
//
// A job keeps a frozen copy of the plan from when it was first queued; retry_job() resumes
// that exact frozen copy, which is correct ONLY if nothing has changed since. If the owner
// edited the storyboard (or wrote a new script) after this job failed, the project's current
// plan_version will have moved past the failed job's own plan_version — in that case this
// queues a genuinely fresh render from the CURRENT plan via queue_render(), instead of
// silently re-rendering outdated content. Either way the result is a newly queued job; no
// worker exists yet (K1-K8) to pick it up, so the project will show "Queued" afterward.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return apiError(401, "unauthorized", "Please sign in again.");

  const { data: job } = await supabase.from("jobs").select("id, project_id, status, plan_version").eq("id", id).maybeSingle();
  if (!job) return apiError(404, "not_found", "That render doesn't exist, or isn't yours.");
  if (job.status !== "failed") return apiError(404, "not_found", "That render can't be retried (it isn't in a failed state).");

  const { data: project } = await supabase.from("projects").select("plan_version").eq("id", job.project_id).maybeSingle();
  if (!project) return apiError(404, "not_found", "That project doesn't exist.");

  if (project.plan_version !== job.plan_version) {
    // The storyboard changed since this attempt failed: queue a fresh render from the
    // current plan rather than resuming the one frozen into the failed job.
    const { error } = await supabase.rpc("queue_render", { p_project: job.project_id, p_expected: project.plan_version });
    if (error) {
      if (error.message.includes("job_active")) return apiError(409, "job_active", "This project already has a render in progress.");
      if (error.message.includes("version_conflict")) return apiError(409, "version_conflict", "This project changed again. Reload and try once more.");
      if (error.message.includes("no_plan")) return apiError(422, "validation_failed", "This project has no script to render.");
      console.error("queue_render (via retry) failed:", error.message);
      return apiError(500, "internal", "Couldn't queue a new render. Please try again.");
    }
    return NextResponse.json({ ok: true, requeued: "fresh" });
  }

  const { error } = await supabase.rpc("retry_job", { p_job: id });
  if (error) {
    if (error.message.includes("not_retryable")) return apiError(404, "not_found", "That render can't be retried (it may already have been retried, or isn't yours).");
    if (error.message.includes("job_active")) return apiError(409, "job_active", "This project already has a render in progress.");
    console.error("retry_job failed:", error.message);
    return apiError(500, "internal", "Couldn't retry the render. Please try again.");
  }
  return NextResponse.json({ ok: true, requeued: "same" });
}
