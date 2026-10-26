import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// A Supabase client for server code, acting as the signed-in user (security rules apply).
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a page while rendering; the proxy (W3) refreshes cookies instead.
          }
        },
      },
    },
  );
}
