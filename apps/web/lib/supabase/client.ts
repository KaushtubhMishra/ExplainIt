"use client";

import { createBrowserClient } from "@supabase/ssr";

// A Supabase client for the browser (used for live progress updates later).
export const createSupabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
