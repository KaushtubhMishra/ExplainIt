"use client";

import Link from "next/link";
import { useState } from "react";
import { Clapperboard, Download, Loader2, RefreshCw } from "lucide-react";
import type { LibraryEntry } from "@/lib/videos";

const LANG_LABEL: Record<string, string> = { "en-IN": "English", "hi-IN": "हिंदी" };

// A card only reaches the "ready" state when deriveLibraryState() has already confirmed
// it isn't expired, and expiry is always 23:59 IST the same day it was rendered — so this
// only ever needs to format the time, never re-decide whether it's expired.
function expiryText(expiresAt: string): string {
  const time = new Date(expiresAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
  return `expires tonight at ${time}`;
}

// Rendering isn't built yet (K2/K4), so these buttons explain that honestly instead of
// quietly failing or looking broken.
function NotReadyYet({ children }: { children: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => setMsg("Rendering isn't built yet — this is coming in a later update.")}
        className="flex items-center gap-1.5 rounded-full bg-blue px-3 py-1.5 text-xs font-semibold text-card sm:px-4 sm:py-2 sm:text-sm">
        {children.includes("Download") ? <Download className="size-3.5" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
        {children}
      </button>
      {msg && <p className="max-w-[160px] text-right text-[11px] text-ink-soft">{msg}</p>}
    </div>
  );
}

export function LibraryCard({ entry }: { entry: LibraryEntry }) {
  const { project, state } = entry;
  const thumb = (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-deep to-blue">
      <Clapperboard className="size-6 text-white" aria-hidden />
    </span>
  );
  const chips = (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="rounded-full bg-surface-low px-2 py-0.5 font-semibold text-navy">{LANG_LABEL[project.language] ?? project.language}</span>
    </span>
  );

  let statusLine: React.ReactNode;
  let action: React.ReactNode;
  let dotColor = "bg-yellow";

  switch (state.kind) {
    case "draft":
      statusLine = state.label;
      action = (
        <Link href={`/projects/${project.id}`}
          className="flex shrink-0 items-center gap-1 rounded-full bg-blue-soft px-3 py-1.5 text-xs font-semibold text-navy sm:px-4 sm:py-2 sm:text-sm">
          Continue
        </Link>
      );
      break;
    case "queued":
      dotColor = "bg-line";
      statusLine = "Queued · waiting for the renderer";
      action = null;
      break;
    case "rendering":
      dotColor = "bg-yellow";
      statusLine = (
        <span className="flex w-full flex-col gap-1">
          <span>Rendering {state.progress}%</span>
          <span className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-surface-low">
            <span className="block h-full rounded-full bg-yellow" style={{ width: `${state.progress}%` }} />
          </span>
        </span>
      );
      action = <Loader2 className="size-5 shrink-0 animate-spin text-blue" aria-hidden />;
      break;
    case "ready":
      dotColor = "bg-green";
      statusLine = `Ready · ${expiryText(state.expiresAt)}`;
      action = <NotReadyYet>Download</NotReadyYet>;
      break;
    case "expired":
      dotColor = "bg-line";
      statusLine = "Expired · render again";
      action = <NotReadyYet>Render again</NotReadyYet>;
      break;
  }

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line/60 bg-card p-3 pr-4">
      {thumb}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold text-navy">{project.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">{chips}</div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
          <span className={`size-1.5 shrink-0 rounded-full ${dotColor}`} aria-hidden />
          {statusLine}
        </div>
      </div>
      {action}
    </li>
  );
}
