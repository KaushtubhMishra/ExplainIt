import { countWords } from "@shared/rules";
import type { ScenePlanType, SceneType } from "@shared/schema";

export const TEMPLATE_LABEL: Record<string, string> = {
  TitleCard: "Title", IconScene: "Icon", StepFlow: "Steps", CycleDiagram: "Cycle",
  Comparison: "Comparison", Recap: "Recap", PhoneScreen: "Phone screen",
};

// What appears on screen in a scene, as short labels.
function onScreen(scene: SceneType): string[] {
  const c = scene.content;
  switch (c.template) {
    case "TitleCard": return [c.headline, ...(c.subtitle ? [c.subtitle] : [])];
    case "IconScene": return [c.label, c.caption];
    case "StepFlow": return c.steps.map((s) => s.label);
    case "CycleDiagram": return c.nodes.map((n) => n.label);
    case "Comparison": return [`${c.left.title} vs ${c.right.title}`, ...c.left.points.map((p) => p.text), ...c.right.points.map((p) => p.text)];
    case "Recap": return [c.headline, ...c.points.map((p) => p.text)];
    case "PhoneScreen": return c.actions.map((a) => a.label);
  }
}

// The written script, scene by scene (read-only; editing arrives in W7).
export function ScriptView({ plan }: { plan: ScenePlanType }) {
  const words = plan.scenes.reduce((n, s) => n + countWords(s.narration), 0);
  const perMinute = plan.language === "hi-IN" ? 158 : 140; // measured speaking pace
  const seconds = Math.round((words / perMinute) * 60 + plan.scenes.length * 0.3);
  const hindi = plan.language === "hi-IN";
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-navy">
        <span className="rounded-full bg-surface-low px-3 py-1">{plan.scenes.length} scenes</span>
        <span className="rounded-full bg-surface-low px-3 py-1">{words} words</span>
        <span className="rounded-full bg-surface-low px-3 py-1">about {seconds} sec</span>
      </div>
      <ol className="space-y-3">
        {plan.scenes.map((scene, i) => (
          <li key={scene.id} className="rounded-2xl border border-line/60 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-navy">Scene {i + 1}</span>
              <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-semibold text-navy">{TEMPLATE_LABEL[scene.content.template]}</span>
              <span className="ml-auto text-xs text-ink-soft">{countWords(scene.narration)} words</span>
            </div>
            <p className={`mt-2 text-ink ${hindi ? "leading-relaxed" : ""}`}>{scene.narration}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {onScreen(scene).map((label, j) => (
                <span key={j} className="rounded-lg bg-surface-low px-2 py-1 text-xs text-ink-soft">{label}</span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
