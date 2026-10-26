"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

// The avatar in the top bar: shows who is signed in, with a sign-out button.
export function AccountMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Account: ${email}`}
        className="flex size-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-card">
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-2xl border border-line/60 bg-card p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate font-semibold text-navy">{name}</p>
            <p className="truncate text-sm text-ink-soft">{email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50">
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
