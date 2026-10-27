"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { LibraryEntry } from "@/lib/videos";
import { LibraryCard } from "./LibraryCard";

const FILTERS: { id: "all" | "en-IN" | "hi-IN"; label: string }[] = [
  { id: "all", label: "All" }, { id: "en-IN", label: "English" }, { id: "hi-IN", label: "हिंदी" },
];

export function LibraryList({ entries }: { entries: LibraryEntry[] }) {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<"all" | "en-IN" | "hi-IN">("all");

  const counts = useMemo(() => ({
    all: entries.length,
    "en-IN": entries.filter((e) => e.project.language === "en-IN").length,
    "hi-IN": entries.filter((e) => e.project.language === "hi-IN").length,
  }), [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) =>
      (lang === "all" || e.project.language === lang) && (!q || e.project.title.toLowerCase().includes(q)));
  }, [entries, query, lang]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl bg-surface-low px-3 py-2.5">
        <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title..."
          aria-label="Search videos"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft/60" />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setLang(id)} aria-pressed={lang === id}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${lang === id ? "bg-navy text-card" : "bg-surface-low text-navy"}`}>
            {label} <span className="opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">No videos match your search.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((entry) => <LibraryCard key={entry.project.id} entry={entry} />)}
        </ul>
      )}
    </div>
  );
}
