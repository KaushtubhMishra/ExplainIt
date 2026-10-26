import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectThemeProvider, ThemeChip } from "@/components/project-theme";
import { ScriptPanel } from "@/components/ScriptPanel";
import { getProject, STAGE_LABEL } from "@/lib/projects";

const LANG: Record<string, string> = { "en-IN": "English", "hi-IN": "हिंदी" };
const MODE: Record<string, string> = { idea: "Idea", notes: "Notes", brainstorm: "Brainstorm" };

export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ write?: string }>;
}) {
  const [{ id }, { write }] = await Promise.all([params, searchParams]);
  const project = await getProject(id);
  if (!project) notFound();

  const chips = [LANG[project.language], `${project.duration_target} sec`, MODE[project.input_mode]];
  return (
    <ProjectThemeProvider initialTheme={project.theme}>
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue">
          <ArrowLeft className="size-4" aria-hidden /> Back to Create
        </Link>
        <section className="rounded-3xl border border-line/60 bg-card p-6">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{STAGE_LABEL[project.stage] ?? project.stage}</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">{project.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => <span key={c} className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-navy">{c}</span>)}
            <ThemeChip />
          </div>
          {project.input_mode === "notes" && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-blue">Show your notes</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-surface-low p-3 font-sans text-sm whitespace-pre-wrap text-ink-soft">{project.input_text}</pre>
            </details>
          )}
        </section>
        <ScriptPanel projectId={project.id} initialPlan={project.scene_plan} initialVersion={project.plan_version} autoStart={write === "1"} />
      </div>
    </ProjectThemeProvider>
  );
}
