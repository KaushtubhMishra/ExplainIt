"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CloudOff, Loader2, Send, Sparkles } from "lucide-react";
import { totalWords, wordRangeFor } from "@shared/rules";
import { ScenePlan, type ScenePlanType, type SceneType } from "@shared/schema";
import { SceneEditor } from "./SceneEditor";

// The player runs only in the browser.
const PreviewPlayer = dynamic(() => import("./PreviewPlayer").then((m) => m.PreviewPlayer), {
  ssr: false,
  loading: () => <div className="mx-auto aspect-[9/16] w-full max-w-[220px] lg:max-w-[300px] animate-pulse rounded-[28px] bg-surface-mid" />,
});

type SaveState = "saved" | "unsaved" | "saving" | "invalid" | "error" | "conflict";

const SUGGESTIONS = ["Make scene 2 simpler", "Shorten the intro", "Add a real-life example"];
const AUTOSAVE_DELAY_MS = 1000;

export function Storyboard({ projectId, initialPlan, initialVersion }: {
  projectId: string; initialPlan: ScenePlanType; initialVersion: number;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [selected, setSelected] = useState(0);
  const [saveState, setSaveStateRaw] = useState<SaveState>("saved");
  const saveStateRef = useRef<SaveState>("saved");
  const setSaveState = (state: SaveState) => { saveStateRef.current = state; setSaveStateRaw(state); };
  const [saveError, setSaveError] = useState("");
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState("");
  const [revising, setRevising] = useState(false);
  const [reply, setReply] = useState<{ ok: boolean; text: string; problems?: string[] } | null>(null);

  // Refs hold the latest values for the save logic, which runs outside React renders.
  const latest = useRef(initialPlan);
  const version = useRef(initialVersion);
  const dirty = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflicted = useRef(false);

  const save = useCallback(async (): Promise<void> => {
    if (inFlight.current) await inFlight.current; // one save at a time, in order
    if (!dirty.current) return;
    const toSave = latest.current;
    if (!ScenePlan.safeParse(toSave).success) {
      setSaveState("invalid"); // an empty required field: wait until it's filled
      return;
    }
    dirty.current = false;
    setSaveState("saving");
    const run = (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planVersion: version.current, scenePlan: toSave }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          version.current = body.planVersion;
          setSaveState(dirty.current ? "unsaved" : "saved");
          setSaveError("");
        } else if (res.status === 409) {
          conflicted.current = true;
          setSaveState("conflict");
        } else if (res.status === 401) {
          router.push("/login");
        } else {
          dirty.current = true;
          setSaveState("error");
          setSaveError(body?.error?.message ?? "Couldn't save your changes.");
        }
      } catch {
        dirty.current = true;
        setSaveState("error");
        setSaveError("Couldn't reach the server. Your changes will save when it's back.");
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (dirty.current) timer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }, [projectId, router]);

  const edit = (index: number, scene: SceneType) => {
    const next = { ...latest.current, scenes: latest.current.scenes.map((s, i) => (i === index ? scene : s)) };
    latest.current = next;
    dirty.current = true;
    setPlan(next);
    setSaveState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  };

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function revise(message: string) {
    const text = message.trim();
    if (text.length < 3 || revising) return;
    if (timer.current) clearTimeout(timer.current);
    await save(); // the change request must start from the latest saved version
    if (conflicted.current) return;
    // Never send a request while edits are unsaved: the AI works from the saved version,
    // and its answer would replace the unsaved edits.
    if (dirty.current || saveStateRef.current !== "saved") {
      setReply({
        ok: false,
        text: saveStateRef.current === "invalid"
          ? "Your latest edits aren't saved yet: fill in the highlighted empty fields, then send the change again."
          : "Your latest edits aren't saved yet. Wait for \"Saved\" (or check your connection), then send the change again.",
      });
      return;
    }
    setRevising(true);
    setReply(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, planVersion: version.current }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 409) { conflicted.current = true; setSaveState("conflict"); return; }
      if (!res.ok) {
        setReply({ ok: false, text: body?.error?.message ?? "Couldn't make that change.", problems: body?.error?.details?.problems });
        return;
      }
      const next = body.scenePlan as ScenePlanType;
      latest.current = next;
      version.current = body.planVersion;
      dirty.current = false;
      setPlan(next);
      setSaveState("saved");
      const ids: string[] = body.changedSceneIds ?? [];
      setChanged(new Set(ids));
      const first = next.scenes.findIndex((s) => ids.includes(s.id));
      if (first >= 0) setSelected(first);
      setReply({ ok: true, text: body.reply });
      setRequest("");
    } catch {
      setReply({ ok: false, text: "Couldn't reach the server. Please try again." });
    } finally {
      setRevising(false);
    }
  }

  const words = totalWords(plan);
  const range = wordRangeFor(plan.language, plan.durationTarget);
  const fits = words >= range.min && words <= range.max;
  const hindi = plan.language === "hi-IN";

  return (
    <div className="space-y-4">
      {saveState === "conflict" && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">This project changed in another tab or window. Reload to see the latest version.</span>
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-red-700 px-4 py-1.5 font-semibold text-white">Reload</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-surface-low px-3 py-1 text-navy">{plan.scenes.length} scenes</span>
        <span className={`rounded-full px-3 py-1 ${fits ? "bg-surface-low text-navy" : "bg-yellow-soft text-navy"}`}>
          {words} words {fits ? `· fits ${plan.durationTarget ?? 60} sec` : `· aim for ${range.min}–${range.max}`}
        </span>
        <SaveBadge state={saveState} />
      </div>
      {saveState === "error" && <p className="text-sm text-red-700">{saveError}</p>}
      {saveState === "invalid" && <p className="text-sm text-red-700">Fill in the highlighted empty fields to save.</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <ol className="space-y-3">
            {plan.scenes.map((scene, i) => (
              <SceneEditor key={scene.id} scene={scene} index={i} hindi={hindi}
                selected={i === selected} changed={changed.has(scene.id)}
                onSelect={() => setSelected(i)} onChange={(s) => edit(i, s)} />
            ))}
          </ol>

          {/* W8: plain-language change requests */}
          <section className="rounded-2xl border border-line/60 bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold text-navy"><Sparkles className="size-4 text-blue" aria-hidden /> Ask for a change</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setRequest(s)} disabled={revising}
                  className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-navy">{s}</button>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void revise(request); }}>
              <input value={request} onChange={(e) => setRequest(e.target.value)} maxLength={1000} disabled={revising}
                placeholder="e.g. Make scene 3 simpler for kids"
                className="min-w-0 flex-1 rounded-xl bg-surface-low px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue" />
              <button type="submit" disabled={revising || request.trim().length < 3 || saveState === "invalid" || saveState === "conflict"} aria-label="Send change request"
                className="flex items-center gap-1.5 rounded-xl bg-blue px-4 font-semibold text-card disabled:opacity-50">
                {revising ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              </button>
            </form>
            {revising && <p className="mt-2 text-sm text-ink-soft" aria-live="polite">Making the change… usually 20–40 seconds.</p>}
            {reply && (
              <div role={reply.ok ? "status" : "alert"} className={`mt-3 rounded-xl p-3 text-sm ${reply.ok ? "bg-blue-soft/60 text-navy" : "bg-red-50 text-red-800"}`}>
                {reply.text}
                {reply.problems && reply.problems.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">{reply.problems.slice(0, 3).map((p, i) => <li key={i}>{p}</li>)}</ul>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-24">
            <PreviewPlayer plan={plan} selected={selected} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; icon: React.ReactNode; cls: string }> = {
    saved: { text: "Saved", icon: <Check className="size-3.5" aria-hidden />, cls: "text-green" },
    unsaved: { text: "Unsaved changes", icon: null, cls: "text-ink-soft" },
    saving: { text: "Saving…", icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />, cls: "text-ink-soft" },
    invalid: { text: "Not saved", icon: <AlertCircle className="size-3.5" aria-hidden />, cls: "text-red-700" },
    error: { text: "Not saved", icon: <CloudOff className="size-3.5" aria-hidden />, cls: "text-red-700" },
    conflict: { text: "Out of date", icon: <AlertCircle className="size-3.5" aria-hidden />, cls: "text-red-700" },
  };
  const m = map[state];
  return <span className={`ml-auto flex items-center gap-1 ${m.cls}`} aria-live="polite">{m.icon}{m.text}</span>;
}
