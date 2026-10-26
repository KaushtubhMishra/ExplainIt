import { NextResponse } from "next/server";

// Every API error has the same shape: { error: { code, message, details? } } (see the API Design doc).
export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status });
}

export const LLM_CALLS_PER_HOUR = 20;

// The hourly AI limit, counted from llm_calls (security rules limit the count to this user).
// Returns an error response when the limit is reached, otherwise null.
export async function llmLimitReached(
  supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<NextResponse | null> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("llm_calls").select("id", { count: "exact", head: true }).gte("created_at", hourAgo);
  if ((count ?? 0) < LLM_CALLS_PER_HOUR) return null;
  return NextResponse.json(
    { error: { code: "rate_limited", message: `You've used all ${LLM_CALLS_PER_HOUR} AI requests for this hour. Please try again a little later.` } },
    { status: 429, headers: { "Retry-After": "600" } },
  );
}
