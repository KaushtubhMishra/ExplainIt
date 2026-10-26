import { CreateForm } from "@/components/CreateForm";
import { DraftCard } from "@/components/DraftCard";
import { requireUser } from "@/lib/auth";
import { recentDrafts } from "@/lib/projects";

export default async function CreatePage() {
  const [user, drafts] = await Promise.all([requireUser(), recentDrafts()]);
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-surface-mid to-blue-soft p-6 shadow-sm">
        <h1 className="text-2xl font-bold leading-tight text-navy">Namaste, {user.name}! What shall we explain today?</h1>
        <p className="mt-2 text-ink-soft">Pick a topic, review the script, then render your video.</p>
      </section>

      <CreateForm />

      {drafts.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold text-navy">Continue where you left off</h2>
            <span className="text-sm text-blue">{drafts.length} in draft</span>
          </div>
          <div className="space-y-3">
            {drafts.map((p) => <DraftCard key={p.id} project={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
