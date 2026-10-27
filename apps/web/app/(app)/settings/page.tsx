import { CheckCircle2, CircleAlert, Laptop, LogOut, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { RENDERS_PER_DAY, aiUsageThisHour, rendererStatus, rendersToday } from "@/lib/renderer";
import { createSupabaseServer } from "@/lib/supabase/server";

// "2 minutes ago", "just now", etc., without pulling in a date library for one line.
function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

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
  const [user, db, renderer, renders, ai] = await Promise.all([
    requireUser(), databaseStatus(), rendererStatus(), rendersToday(), aiUsageThisHour(),
  ]);
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
      <section className="rounded-2xl border border-line/60 bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-navy"><Laptop className="size-4 text-blue" aria-hidden /> Renderer</h2>
        <p className={`mt-2 flex items-center gap-2 text-sm ${renderer.online ? "text-green" : "text-ink-soft"}`}>
          <span className={`size-2 rounded-full ${renderer.online ? "bg-green" : "bg-line"}`} aria-hidden />
          {renderer.online
            ? `Online${renderer.version ? ` · worker ${renderer.version}` : ""} · last seen ${timeAgo(renderer.lastSeenAt!)}`
            : renderer.lastSeenAt
              ? `Offline · last seen ${timeAgo(renderer.lastSeenAt)}`
              : "Offline · never connected yet"}
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          Rendering runs on your laptop. This will show "Online" once the background worker is built and running.
        </p>
      </section>
      <section className="rounded-2xl border border-line/60 bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-navy"><Sparkles className="size-4 text-blue" aria-hidden /> Today&apos;s usage</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface-low p-3">
            <dt className="text-xs text-ink-soft">Renders today</dt>
            <dd className="font-semibold text-navy">{renders} of {RENDERS_PER_DAY}</dd>
          </div>
          <div className="rounded-xl bg-surface-low p-3">
            <dt className="text-xs text-ink-soft">AI requests this hour</dt>
            <dd className="font-semibold text-navy">{ai.used} of {ai.limit}</dd>
          </div>
        </dl>
      </section>
      <p className="text-center text-xs text-ink-soft">ExplainIt V1 · in development</p>
    </div>
  );
}
