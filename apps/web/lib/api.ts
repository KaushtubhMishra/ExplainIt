import { NextResponse } from "next/server";

// Every API error has the same shape: { error: { code, message, details? } } (see the API Design doc).
export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status });
}

// The hourly AI allowance, counted in real Gemini calls (repairs and fallbacks included).
export const GEMINI_CALLS_PER_HOUR = 40;
// A single script or revision can use up to 2 models x (1 attempt + 2 repairs) = 6 Gemini
// calls. Mirrors the "worst_case" constant in reserve_llm_call() (20261026000100).
export const WORST_CASE_CALLS_PER_REQUEST = 6;

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

// Reserve one AI call BEFORE calling Gemini. The database does this under a per-user lock,
// so requests sent at the same moment can't all slip past the limit.
export async function reserveLlmCall(
  supabase: Rpc, kind: "script" | "revise", projectId: string | null,
): Promise<{ id: number } | { response: NextResponse }> {
  const { data, error } = await supabase.rpc("reserve_llm_call", { p_kind: kind, p_project: projectId, p_limit: GEMINI_CALLS_PER_HOUR });
  if (!error) return { id: Number(data) };
  if (error.message.includes("rate_limited")) {
    return {
      response: NextResponse.json(
        { error: { code: "rate_limited", message: "You've used this hour's AI allowance. Please try again a little later." } },
        { status: 429, headers: { "Retry-After": "600" } },
      ),
    };
  }
  if (error.message.includes("not_found")) return { response: apiError(404, "not_found", "That project doesn't exist.") };
  console.error("reserve_llm_call failed:", error.message);
  return { response: apiError(500, "internal", "Something went wrong. Please try again.") };
}

// Record how the call went: success, which model answered, and how many Gemini calls it took.
export async function finishLlmCall(
  supabase: Rpc, id: number,
  report: { ok: boolean; provider?: string; providersTried: string[]; attempts: number }, startedAt: number,
) {
  const { error } = await supabase.rpc("finish_llm_call", {
    p_id: id, p_ok: report.ok, p_provider: report.provider ?? report.providersTried.at(-1) ?? "none",
    p_attempts: Math.max(1, report.attempts), p_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
  });
  // not_pending means the row was already finished (it should never be called twice in normal
  // use); log it rather than surfacing it, since the AI call itself already succeeded or failed.
  if (error && !error.message.includes("not_pending")) console.error("finish_llm_call failed:", error.message);
  else if (error) console.error("finish_llm_call: row already finished (ignored):", id);
}

// Maps a save_plan() database error to the right HTTP response. Used by every route that
// calls save_plan (create/write script, save edits, revise), so the mapping is identical.
export function savePlanError(message: string, staleVersion?: number): NextResponse {
  if (message.includes("version_conflict")) {
    return apiError(409, "version_conflict", "This project changed in another tab. Reload to see the latest version.", {
      ...(staleVersion !== undefined ? { planVersion: staleVersion } : {}),
    });
  }
  if (message.includes("invalid_plan")) {
    return apiError(422, "validation_failed", "Some text is too long or missing. Please check the highlighted fields.");
  }
  if (message.includes("not_found")) return apiError(404, "not_found", "That project doesn't exist.");
  console.error("save_plan failed:", message);
  return apiError(500, "internal", "Couldn't save your changes. Please try again.");
}
