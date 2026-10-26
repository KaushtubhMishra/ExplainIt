"use client";

import { createBrowserClient } from "@supabase/ssr";

// A Supabase client for the browser: sign-in on /login, and live progress updates later (K3).
export const createSupabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
