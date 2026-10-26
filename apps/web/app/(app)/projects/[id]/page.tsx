import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { getProject, STAGE_LABEL } from "@/lib/projects";

const LANG: Record<string, string> = { "en-IN": "English", "hi-IN": "हिंदी" };
const THEME: Record<string, string> = { auto: "Auto theme", sky: "Sky", forest: "Forest", sunset: "Sunset", night: "Night" };
const MODE: Record<string, string> = { idea: "Idea", notes: "Notes", brainstorm: "Brainstorm" };

// The project page. For now it shows what was saved; the storyboard arrives in W5 and W6.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const chips = [LANG[project.language], `${project.duration_target} sec`, THEME[project.theme], MODE[project.input_mode]];
  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue">
        <ArrowLeft className="size-4" aria-hidden /> Back to Create
      </Link>
      <section className="rounded-3xl border border-line/60 bg-card p-6">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{STAGE_LABEL[project.stage] ?? project.stage}</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">{project.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => <span key={c} className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-navy">{c}</span>)}
        </div>
        {project.input_mode === "notes" && (
          <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-surface-low p-3 font-sans text-sm whitespace-pre-wrap text-ink-soft">{project.input_text}</pre>
        )}
      </section>
      <section className="flex items-start gap-3 rounded-2xl bg-blue-soft/60 p-5">
        <Clock className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden />
        <p className="text-sm text-navy">Your project is saved. Writing the script here arrives in feature W5, and the storyboard in W6.</p>
      </section>
    </div>
  );
}
