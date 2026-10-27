import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

// POST /api/jobs/:id/retry: put a failed job back in the queue. retry_job() itself checks
// ownership and that the job is actually failed; no worker exists yet (K1-K8) to pick the
// job back up, so this only re-queues it — the project will show "Queued" afterward.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return apiError(401, "unauthorized", "Please sign in again.");

  const { error } = await supabase.rpc("retry_job", { p_job: id });
  if (error) {
    if (error.message.includes("not_retryable")) return apiError(404, "not_found", "That render can't be retried (it may already have been retried, or isn't yours).");
    if (error.message.includes("job_active")) return apiError(409, "job_active", "This project already has a render in progress.");
    console.error("retry_job failed:", error.message);
    return apiError(500, "internal", "Couldn't retry the render. Please try again.");
  }
  return NextResponse.json({ ok: true });
}
