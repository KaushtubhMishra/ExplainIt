"use client";

import { Play, Sparkles } from "lucide-react";
import { countWords } from "@shared/rules";
import type { SceneType } from "@shared/schema";
import { TEMPLATE_LABEL } from "../ScriptView";

type Field = { label: string; path: (string | number)[]; max: number; optional?: boolean };

// The on-screen text fields each template has, with the schema's length limits.
function fieldsFor(scene: SceneType): Field[] {
  const c = scene.content;
  switch (c.template) {
    case "TitleCard": return [{ label: "Headline", path: ["headline"], max: 40 }, { label: "Subtitle", path: ["subtitle"], max: 60, optional: true }];
    case "IconScene": return [{ label: "Label", path: ["label"], max: 32 }, { label: "Caption", path: ["caption"], max: 80, optional: true }];
    case "StepFlow": return c.steps.map((_, i) => ({ label: `Step ${i + 1}`, path: ["steps", i, "label"], max: 32 }));
    case "CycleDiagram": return c.nodes.map((_, i) => ({ label: `Stage ${i + 1}`, path: ["nodes", i, "label"], max: 32 }));
    case "Comparison": return [
      { label: "Left title", path: ["left", "title"], max: 24 },
      ...c.left.points.map((_, i) => ({ label: `Left point ${i + 1}`, path: ["left", "points", i, "text"], max: 40 })),
      { label: "Right title", path: ["right", "title"], max: 24 },
      ...c.right.points.map((_, i) => ({ label: `Right point ${i + 1}`, path: ["right", "points", i, "text"], max: 40 })),
    ];
    case "Recap": return [{ label: "Headline", path: ["headline"], max: 40 }, ...c.points.map((_, i) => ({ label: `Point ${i + 1}`, path: ["points", i, "text"], max: 40 }))];
    case "PhoneScreen": return [
      { label: "Screen title", path: ["title"], max: 24 },
      ...c.actions.flatMap((_, i) => [
        { label: `Action ${i + 1} instruction`, path: ["actions", i, "label"], max: 44 },
        { label: `Action ${i + 1} on-screen text`, path: ["actions", i, "target"], max: 28 },
      ]),
    ];
  }
}

const getAt = (obj: unknown, path: (string | number)[]) =>
  path.reduce<unknown>((cur, k) => (cur as Record<string | number, unknown> | undefined)?.[k], obj);

function setAt<T>(obj: T, path: (string | number)[], value: unknown): T {
  const copy = structuredClone(obj);
  let cur = copy as Record<string | number, unknown>;
  for (const k of path.slice(0, -1)) cur = cur[k] as Record<string | number, unknown>;
  cur[path[path.length - 1]] = value;
  return copy;
}

type Props = {
  scene: SceneType; index: number; hindi: boolean; selected: boolean; changed: boolean;
  onChange: (scene: SceneType) => void; onSelect: () => void;
};

export function SceneEditor({ scene, index, hindi, selected, changed, onChange, onSelect }: Props) {
  const words = countWords(scene.narration);
  return (
    <li onClick={onSelect}
      className={`rounded-2xl border-2 bg-card p-4 transition ${selected ? "border-blue shadow-md" : changed ? "border-yellow" : "border-line/60"}`}>
      <div className="flex items-center gap-2">
        <span className="font-bold text-navy">Scene {index + 1}</span>
        <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-semibold text-navy">{TEMPLATE_LABEL[scene.content.template]}</span>
        {changed && (
          <span className="flex items-center gap-1 rounded-full bg-yellow-soft px-2.5 py-0.5 text-xs font-semibold text-navy">
            <Sparkles className="size-3" aria-hidden /> Changed
          </span>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="ml-auto flex items-center gap-1 rounded-full bg-surface-low px-2.5 py-1 text-xs font-semibold text-blue"
          aria-label={`Preview scene ${index + 1}`}>
          <Play className="size-3 fill-current" aria-hidden /> Preview
        </button>
      </div>

      <label className="mt-3 block text-xs font-semibold text-ink-soft" htmlFor={`narr-${scene.id}`}>
        Narration · {words} words
      </label>
      <textarea id={`narr-${scene.id}`} value={scene.narration} maxLength={400} rows={3}
        onChange={(e) => onChange({ ...scene, narration: e.target.value })}
        className={`mt-1 w-full resize-y rounded-xl bg-surface-low p-3 text-ink outline-none focus:ring-2 focus:ring-blue ${hindi ? "leading-relaxed" : ""}`} />

      <p className="mt-3 text-xs font-semibold text-ink-soft">On screen</p>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
        {fieldsFor(scene).map((f) => {
          const value = String(getAt(scene.content, f.path) ?? "");
          return (
            <label key={f.path.join(".")} className="block min-w-0">
              <span className="text-[11px] text-ink-soft">{f.label}{f.optional ? " (optional)" : ""}</span>
              <input value={value} maxLength={f.max}
                onChange={(e) => onChange({ ...scene, content: setAt(scene.content, f.path, e.target.value) })}
                className={`mt-0.5 w-full rounded-lg bg-surface-low px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue ${value.trim() || f.optional ? "" : "ring-2 ring-red-300"}`} />
            </label>
          );
        })}
      </div>
    </li>
  );
}
