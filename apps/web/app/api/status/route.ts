import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { RENDERS_PER_DAY, rendererStatus, rendersToday } from "@/lib/renderer";
import { createSupabaseServer } from "@/lib/supabase/server";

// GET /api/status: renderer online/offline and today's render count, polled by the top bar
// so it stays live across page navigations (a layout's server data does not refetch on its
// own when the user moves between pages — only on a full reload).
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return apiError(401, "unauthorized", "Please sign in again.");

  const [renderer, used] = await Promise.all([rendererStatus(), rendersToday()]);
  return NextResponse.json({
    renderer: { online: renderer.online },
    renders: { used, limit: RENDERS_PER_DAY },
  });
}
