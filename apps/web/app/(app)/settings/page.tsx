import { CheckCircle2, CircleAlert, Info, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // check the database on every visit

async function databaseStatus(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, detail: "Supabase settings are missing from .env" };
  }
  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.from("worker_heartbeat").select("id").limit(1);
    return error ? { ok: false, detail: error.message } : { ok: true, detail: "Connected to Supabase" };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

export default async function SettingsPage() {
  const [user, db] = await Promise.all([requireUser(), databaseStatus()]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-navy">Settings</h1>
      <section className="flex items-center gap-4 rounded-2xl border border-line/60 bg-card p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy text-lg font-bold text-card" aria-hidden>
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-navy">{user.name}</h2>
          <p className="truncate text-sm text-ink-soft">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </form>
      </section>
      <section className="rounded-2xl border border-line/60 bg-card p-5">
        <h2 className="font-semibold text-navy">Database</h2>
        <p className={`mt-2 flex items-center gap-2 text-sm ${db.ok ? "text-green" : "text-red-700"}`}>
          {db.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
          {db.detail}
        </p>
      </section>
      <section className="flex items-start gap-3 rounded-2xl border border-line/60 bg-card p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden />
        <p className="text-sm text-ink-soft">
          Renderer status and today&apos;s usage arrive in features W11 and W12.
        </p>
      </section>
      <p className="text-center text-xs text-ink-soft">ExplainIt V1 · in development</p>
    </div>
  );
}
