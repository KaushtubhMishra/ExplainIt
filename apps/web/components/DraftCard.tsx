import Link from "next/link";
import { ChevronRight, Droplet } from "lucide-react";
import { STAGE_LABEL, type ProjectSummary } from "@/lib/projects";

// One project in "Continue where you left off" (and later in My videos).
export function DraftCard({ project }: { project: ProjectSummary }) {
  return (
    <Link href={`/projects/${project.id}`} aria-label={`Continue: ${project.title}`}
      className="flex items-center gap-4 rounded-2xl border border-line/60 bg-card p-3 pr-4 hover:border-blue">
      <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-deep to-blue">
        <Droplet className="size-6 text-white" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-semibold text-navy">{project.title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
          <span className="size-1.5 shrink-0 rounded-full bg-yellow" aria-hidden />
          {STAGE_LABEL[project.stage] ?? project.stage}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-soft p-2 text-sm font-semibold text-navy sm:px-3 sm:py-1.5">
        <span className="hidden sm:inline">Continue</span> <ChevronRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
