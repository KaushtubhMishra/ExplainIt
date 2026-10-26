import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string; name: string };

// The signed-in person, or a redirect to /login. The proxy already guards pages;
// this is a second check right where the data is used.
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const email = String(claims.email ?? "");
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  const name = fullName ? fullName.split(" ")[0] : email.split("@")[0];
  return { id: claims.sub, email, name };
}

// Is "Continue with Google" switched on in Supabase? (Public setting, no secret needed.)
export async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 60 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return Boolean(settings.external?.google);
  } catch {
    return false;
  }
}
