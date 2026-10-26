"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { ScenePlan, type ScenePlanType } from "@shared/schema";
import { Storyboard } from "./storyboard/Storyboard";

const HINTS = ["Planning the scenes", "Writing the narration", "Choosing animations for each scene", "Checking facts and length", "Almost there"];

type Props = { projectId: string; initialPlan: unknown; initialVersion: number; autoStart: boolean };

export function ScriptPanel({ projectId, initialPlan, initialVersion, autoStart }: Props) {
  const router = useRouter();
  const parsed = initialPlan ? ScenePlan.safeParse(initialPlan) : null;
  const plan: ScenePlanType | null = parsed?.success ? parsed.data : null;
  const [writing, setWriting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ message: string; problems?: string[] } | null>(null);
  const started = useRef(false);

  // expectedVersion is sent when replacing a script, so a stale request is refused before any AI call.
  const write = useCallback(async (expectedVersion?: number) => {
    setError(null);
    setWriting(true);
    setElapsed(0);
    try {
      const res = await fetch(`/api/projects/${projectId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expectedVersion === undefined ? {} : { planVersion: expectedVersion }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        setError({ message: body?.error?.message ?? `The server had a problem (error ${res.status}). Please try again.`, problems: body?.error?.details?.problems });
        // The storyboard shown so far may be stale (for example, edits made before a failed
        // "Write a new script"); reload from the server so it reflects what's actually saved.
        router.refresh();
        return;
      }
      router.replace(`/projects/${projectId}`); // drop ?write=1
      router.refresh(); // reload the page with the saved script
    } catch {
      setError({ message: "Couldn't reach the server. Check that it's running and try again." });
      router.refresh();
    } finally {
      setWriting(false);
    }
  }, [projectId, router]);

  // Arriving from Create (?write=1) with no script yet: start straight away, once.
  useEffect(() => {
    if (autoStart && !plan && !started.current) {
      started.current = true;
      void write();
    }
  }, [autoStart, plan, write]);

  useEffect(() => {
    if (!writing) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [writing]);

  if (writing) {
    return (
      <section className="rounded-3xl border border-line/60 bg-card p-8 text-center" aria-live="polite">
        <Loader2 className="mx-auto size-10 animate-spin text-blue" aria-hidden />
        <h2 className="mt-4 text-lg font-bold text-navy">Writing your script…</h2>
        <p className="mt-1 text-ink-soft">{HINTS[Math.min(HINTS.length - 1, Math.floor(elapsed / 8))]}</p>
        <p className="mt-3 text-sm text-ink-soft">{elapsed}s · usually 30–40 seconds</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <section role="alert" className="rounded-2xl bg-red-50 p-5 text-red-800">
          <p className="flex items-center gap-2 font-semibold"><AlertCircle className="size-5" aria-hidden /> {error.message}</p>
          {error.problems && error.problems.length > 0 && (
            <ul className="mt-2 list-disc pl-6 text-sm">{error.problems.slice(0, 4).map((p, i) => <li key={i}>{p}</li>)}</ul>
          )}
        </section>
      )}

      {plan ? (
        <>
          {/* key: a rewritten script starts a fresh storyboard */}
          <Storyboard key={initialVersion} projectId={projectId} initialPlan={plan} initialVersion={initialVersion}
            onRewrite={(v) => void write(v)} />
        </>
      ) : (
        <section className="rounded-3xl border border-line/60 bg-card p-8 text-center">
          <Sparkles className="mx-auto size-10 text-blue" aria-hidden />
          <h2 className="mt-3 text-lg font-bold text-navy">Ready to write your script</h2>
          <p className="mt-1 text-ink-soft">Takes about 30–40 seconds. You&apos;ll review it before rendering.</p>
          <button type="button" onClick={() => void write()}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue px-6 py-3 font-semibold text-card">
            <Sparkles className="size-4" aria-hidden /> {error ? "Try again" : "Write my script"}
          </button>
        </section>
      )}
    </div>
  );
}
