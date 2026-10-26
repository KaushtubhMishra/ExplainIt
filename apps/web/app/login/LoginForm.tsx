"use client";

import { useState } from "react";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = { next: string; googleReady: boolean; initialError?: string };

// Plain-language versions of Supabase's sign-in errors.
function friendly(message: string): string {
  if (/rate limit/i.test(message)) return "Too many sign-in emails were sent in the last hour. Please wait a little and try again.";
  if (/invalid.*email|email.*invalid/i.test(message)) return "That email address doesn't look right.";
  return message;
}

export function LoginForm({ next, googleReady, initialError }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(initialError ?? "");
  const callback = (path: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setState("sending");
    const { error } = await createSupabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback(next) },
    });
    if (error) {
      setError(friendly(error.message));
      setState("idle");
    } else {
      setState("sent");
    }
  }

  async function google() {
    setError("");
    const { error } = await createSupabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
    if (error) setError(friendly(error.message));
  }

  if (state === "sent") {
    return (
      <section className="mt-8 w-full rounded-3xl border border-line/60 bg-card p-6 text-center shadow-sm" aria-live="polite">
        <MailCheck className="mx-auto size-10 text-blue" aria-hidden />
        <h2 className="mt-3 text-xl font-bold text-navy">Check your inbox for a sign-in link</h2>
        <p className="mt-2 text-sm text-ink-soft">We sent a link to <strong>{email}</strong>. Open it on this device to sign in.</p>
        <div className="mt-5 flex justify-center gap-4 text-sm font-semibold">
          <button type="button" className="text-blue" onClick={() => setState("idle")}>Use a different email</button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 w-full rounded-3xl border border-line/60 bg-card p-6 shadow-sm">
      <button type="button" onClick={google} disabled={!googleReady}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-low py-3.5 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50">
        <span className="text-lg font-bold text-blue" aria-hidden>G</span> Continue with Google
      </button>
      {!googleReady && <p className="mt-2 text-center text-xs text-ink-soft">Google sign-in isn&apos;t set up yet. Use the email link below.</p>}

      <div className="my-5 flex items-center gap-3 text-xs font-semibold text-ink-soft">
        <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={sendLink} noValidate>
        <label htmlFor="email" className="text-xs font-semibold text-ink-soft">Your email</label>
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-surface-low px-4 focus-within:ring-2 focus-within:ring-blue">
          <Mail className="size-5 text-ink-soft" aria-hidden />
          <input id="email" type="email" autoComplete="email" inputMode="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
            className="w-full bg-transparent py-3.5 outline-none placeholder:text-ink-soft/60" />
        </div>
        <button type="submit" disabled={state === "sending"}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue py-3.5 font-semibold text-card disabled:opacity-70">
          {state === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {state === "sending" ? "Sending…" : "Send me a sign-in link"}
        </button>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="mt-4 text-center text-xs text-ink-soft">Free to use. No password needed.</p>
    </section>
  );
}
