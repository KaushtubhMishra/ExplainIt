import { Sparkles } from "lucide-react";

export default function CreatePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-surface-mid to-blue-soft p-6 shadow-sm">
        <h1 className="text-2xl font-bold leading-tight text-navy">Namaste! What shall we explain today?</h1>
        <p className="mt-2 text-ink-soft">Pick a topic, review the script, then render your video.</p>
      </section>
      <section className="flex items-start gap-3 rounded-2xl border border-line/60 bg-card p-5">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden />
        <div>
          <h2 className="font-semibold text-navy">Coming next</h2>
          <p className="mt-1 text-sm text-ink-soft">
            The topic box, language, length, and theme choices arrive in feature W4. हिंदी text shows correctly here too.
          </p>
        </div>
      </section>
    </div>
  );
}
