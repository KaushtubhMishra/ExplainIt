import { Play } from "lucide-react";
import { googleEnabled } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · ExplainIt" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const google = await googleEnabled();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-10">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-navy shadow-lg">
        <Play className="size-7 fill-yellow text-yellow" aria-hidden />
      </span>
      <p className="mt-3 text-xl font-bold text-navy">ExplainIt</p>
      <h1 className="mt-6 text-center text-3xl font-bold leading-tight text-navy">Turn any topic into a short explainer video</h1>
      <p className="mt-3 text-center text-ink-soft">English or हिंदी. Review the script before every video.</p>

      <LoginForm next={next ?? "/"} googleReady={google} initialError={error} />

      {/* A small sample of what the videos look like */}
      <div className="mt-10 flex w-44 flex-col items-center rounded-3xl bg-gradient-to-b from-navy-deep to-navy p-4 pb-5 shadow-xl" aria-hidden>
        <span className="mt-6 flex size-16 items-center justify-center rounded-full bg-yellow">
          <Play className="size-6 fill-navy text-navy" />
        </span>
        <p className="mt-4 text-center text-sm font-bold text-white">How does water evaporate?</p>
        <p className="mt-6 rounded-lg bg-black/40 px-2 py-1 text-[11px] font-semibold text-white">
          सूरज की <span className="text-yellow">गर्मी</span> से पानी…
        </p>
      </div>
    </main>
  );
}
