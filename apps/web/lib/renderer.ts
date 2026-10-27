import { GEMINI_CALLS_PER_HOUR, WORST_CASE_CALLS_PER_REQUEST } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

export type RendererStatus = { online: boolean; lastSeenAt: string | null; version: string | null };

// The worker is "online" only if it refreshed its heartbeat recently. No worker (K1-K8) is
// built yet, so this always reads offline today — it's wired up and ready for when one exists.
const HEARTBEAT_TIMEOUT_SECONDS = 90;

export async function rendererStatus(): Promise<RendererStatus> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("worker_heartbeat").select("last_seen_at, worker_version").eq("id", 1).maybeSingle();
  if (!data?.last_seen_at) return { online: false, lastSeenAt: null, version: data?.worker_version ?? null };
  const ageSeconds = (Date.now() - new Date(data.last_seen_at).getTime()) / 1000;
  return { online: ageSeconds <= HEARTBEAT_TIMEOUT_SECONDS, lastSeenAt: data.last_seen_at, version: data.worker_version };
}

// Matches the documented daily limit (X2); X2 itself (enforcing it) is still Planned, so this
// is an honest count only for now, not yet a hard cap.
export const RENDERS_PER_DAY = 5;

// India has no daylight saving, so IST is always exactly UTC+5:30 — safe to compute directly
// rather than through a database round trip or locale parsing.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istDayStartUtcIso(now = new Date()): string {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnightAsUtc = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate());
  return new Date(istMidnightAsUtc - IST_OFFSET_MS).toISOString();
}

// How many renders the signed-in user has started today (IST calendar day) and not
// cancelled. A job cancelled right after being queued never actually rendered anything, so
// it shouldn't count against the day's total any more than it should once X2 enforces a
// real cap. Security rules already limit "jobs" reads to the signed-in user's own rows.
export async function rendersToday(): Promise<number> {
  const supabase = await createSupabaseServer();
  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true })
    .gte("created_at", istDayStartUtcIso()).neq("status", "cancelled");
  return count ?? 0;
}

// The usable limit a user can actually reach before being refused: reserve_llm_call() leaves
// room for a full in-progress request (6 calls) before allowing a new one, so a request is
// refused once more than (40 - 6) = 34 calls are already used, not 40 — see AGENTS.md rule 7.
export const EFFECTIVE_AI_LIMIT_PER_HOUR = GEMINI_CALLS_PER_HOUR - WORST_CASE_CALLS_PER_REQUEST;

// Real Gemini calls used in the last hour, counting an in-progress call as the same worst
// case reserve_llm_call() does — so this always matches what would actually gate a new request.
export async function aiUsageThisHour(): Promise<{ used: number; limit: number }> {
  const supabase = await createSupabaseServer();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("llm_calls").select("ok, attempts").gte("created_at", hourAgo);
  const used = (data ?? []).reduce((sum, row) => sum + (row.ok === null ? WORST_CASE_CALLS_PER_REQUEST : Math.max(row.attempts, 1)), 0);
  return { used, limit: EFFECTIVE_AI_LIMIT_PER_HOUR };
}
