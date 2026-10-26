"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, Info, Loader2, PenLine, Plus, Sparkles } from "lucide-react";
import { INPUT_LIMITS } from "@shared/api";

type Mode = "idea" | "notes";
type Lang = "en-IN" | "hi-IN";
type Theme = "auto" | "sky" | "forest" | "sunset" | "night";

const MODES: { id: Mode; label: string; icon: typeof PenLine; soon?: boolean }[] = [
  { id: "idea", label: "Type an idea", icon: PenLine },
  { id: "notes", label: "Paste your notes", icon: ClipboardList },
];

const THEMES: { id: Theme; label: string; swatch: string }[] = [
  { id: "auto", label: "Auto", swatch: "conic-gradient(#1565c0, #4e9a51, #e8734f, #303f9f, #1565c0)" },
  { id: "sky", label: "Sky", swatch: "linear-gradient(160deg, #0b2e6b, #4fa8e0)" },
  { id: "forest", label: "Forest", swatch: "linear-gradient(160deg, #08291f, #4e9a51)" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(160deg, #a3174f, #e8734f)" },
  { id: "night", label: "Night", swatch: "linear-gradient(160deg, #070720, #303f9f)" },
];

const SUGGESTIONS: Record<Lang, string[]> = {
  "en-IN": ["How does UPI work?", "Why is the sky blue?", "How do vaccines work?"],
  "hi-IN": ["बारिश कैसे होती है?", "UPI कैसे काम करता है?", "इंद्रधनुष कैसे बनता है?"],
};

const chip = (active: boolean, align: "left" | "center" = "left") =>
  `rounded-2xl border-2 p-4 transition ${align === "center" ? "text-center" : "text-left"} ${active ? "border-blue bg-blue-soft" : "border-transparent bg-card hover:border-line"}`;

export function CreateForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idea");
  const [language, setLanguage] = useState<Lang>("en-IN");
  const [text, setText] = useState("");
  const [length, setLength] = useState<60 | 90>(60);
  const [theme, setTheme] = useState<Theme>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const limits = mode === "notes" ? INPUT_LIMITS.notes : INPUT_LIMITS.idea;
  const trimmed = text.trim();

  async function submit() {
    setError("");
    if (trimmed.length < limits.min) {
      setError(mode === "idea" ? "Please type a topic or question first." : `Please paste at least ${limits.min} characters of notes.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, durationTarget: length, theme, inputMode: mode, inputText: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        setError(body?.error?.message ?? `The server had a problem (error ${res.status}). Please try again.`);
        setBusy(false);
        return;
      }
      router.push(`/projects/${body.project.id}?write=1`); // start writing the script right away
    } catch {
      setError("Couldn't reach the server. Check that it's running and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <section>
        <h2 className="mb-3 font-semibold text-navy">How do you want to start?</h2>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map(({ id, label, icon: Icon, soon }) => (
            <button key={id} type="button" disabled={soon} onClick={() => { setMode(id); setError(""); }}
              aria-pressed={mode === id} className={`${chip(mode === id, "center")} relative flex flex-col items-center gap-2 px-2 disabled:cursor-not-allowed disabled:opacity-50`}>
              {mode === id && <Check className="absolute top-2 right-2 size-4 text-blue" aria-hidden />}
              <span className={`flex size-11 items-center justify-center rounded-xl ${mode === id ? "bg-blue text-card" : "bg-surface-low text-navy"}`}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-ink">{label}</span>
              {soon && <span className="text-[11px] text-ink-soft">Coming soon</span>}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-navy">Narration language</h2>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-mid p-1" role="radiogroup" aria-label="Narration language">
          {([["en-IN", "English (Indian accent)"], ["hi-IN", "अ हिंदी"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={language === id} onClick={() => setLanguage(id)}
              className={`rounded-xl py-2.5 text-sm font-semibold ${language === id ? "bg-card text-blue shadow-sm" : "text-ink-soft"}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <label htmlFor="topic" className="mb-3 block font-semibold text-navy">{mode === "notes" ? "Your notes" : "Your topic"}</label>
        <div className="rounded-2xl border border-line/60 bg-card p-4 focus-within:ring-2 focus-within:ring-blue">
          <textarea id="topic" value={text} maxLength={limits.max} onChange={(e) => setText(e.target.value)}
            rows={mode === "notes" ? 8 : 3}
            placeholder={mode === "notes"
              ? "Paste the facts or notes the video should explain…"
              : "e.g. How does water evaporate? / जल चक्र कैसे काम करता है?"}
            className="w-full resize-y bg-transparent outline-none placeholder:text-ink-soft/60" />
          <p className="mt-2 text-right text-xs text-ink-soft">{text.length} / {limits.max.toLocaleString("en-IN")}</p>
        </div>
        {mode === "idea" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS[language].map((s) => (
              <button key={s} type="button" onClick={() => setText(s)}
                className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-navy shadow-sm hover:bg-surface-low">
                <Plus className="size-3.5" aria-hidden /> {s}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-navy">Video length</h2>
        <div className="grid grid-cols-2 gap-3">
          {([[60, "Quick explainer"], [90, "Deeper explainer"]] as const).map(([secs, note]) => (
            <button key={secs} type="button" aria-pressed={length === secs} onClick={() => setLength(secs)} className={`${chip(length === secs)} relative`}>
              {length === secs && <Check className="absolute top-3 right-3 size-4 text-blue" aria-hidden />}
              <span className="block text-lg font-bold text-navy">{secs} sec</span>
              <span className="text-sm text-ink-soft">{note}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-navy">Colour theme</h2>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map(({ id, label, swatch }) => (
            <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)}
              className={`${chip(theme === id, "center")} flex flex-col items-center gap-2 px-1 py-3`}>
              <span className="flex size-10 items-center justify-center rounded-full" style={{ background: swatch }}>
                {id === "auto" && <Sparkles className="size-4 text-white" aria-hidden />}
                {theme === id && id !== "auto" && <Check className="size-4 text-white" aria-hidden />}
              </span>
              <span className="text-xs font-semibold text-ink">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Info className="size-4 shrink-0" aria-hidden /> Don&apos;t paste private or client information.
      </p>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div>
        <button type="button" onClick={submit} disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue py-4 text-lg font-semibold text-card shadow-md disabled:opacity-70">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
          {busy ? "Saving…" : "Write my script"}
        </button>
        <p className="mt-2 text-center text-sm text-ink-soft">Takes about 30–40 seconds. You&apos;ll review it before rendering.</p>
      </div>
    </div>
  );
}
