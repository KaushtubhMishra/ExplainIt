import Link from "next/link";
import { Clapperboard } from "lucide-react";

export default function VideosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">My videos</h1>
        <p className="mt-1 text-ink-soft">Your explainer videos will appear here.</p>
      </div>
      <section className="flex flex-col items-center rounded-3xl border border-line/60 bg-card px-6 py-12 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-blue-soft">
          <Clapperboard className="size-9 text-navy" aria-hidden />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-navy">No videos yet</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">Create your first vertical explainer video of 60 or 90 seconds.</p>
        <Link href="/" className="mt-6 rounded-full bg-blue px-6 py-3 font-semibold text-card">Make your first video</Link>
      </section>
    </div>
  );
}
