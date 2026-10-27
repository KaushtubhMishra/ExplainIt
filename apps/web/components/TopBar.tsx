"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { NAV_ITEMS, isActive } from "./nav-items";

type Props = { name: string; email: string; rendererOnline: boolean; rendersUsed: number; rendersLimit: number };

// Top bar on every signed-in page.
export function TopBar({ name, email, rendererOnline, rendersUsed, rendersLimit }: Props) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="ExplainIt home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-navy">
            <Play className="size-4 fill-yellow text-yellow" aria-hidden />
          </span>
          <span className="text-lg font-bold text-navy">ExplainIt</span>
        </Link>

        <nav className="ml-4 hidden gap-1 lg:flex" aria-label="Main">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${isActive(pathname, href) ? "bg-blue-soft text-navy" : "text-ink-soft hover:bg-surface-low"}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-ink-soft">
            <span className={`size-2 rounded-full ${rendererOnline ? "bg-green" : "bg-line"}`} aria-hidden />
            Renderer {rendererOnline ? "online" : "offline"}
          </span>
          <span className="hidden whitespace-nowrap rounded-full bg-blue-soft px-3 py-1 text-xs font-semibold text-navy sm:inline">
            Renders today {rendersUsed}/{rendersLimit}
          </span>
          <AccountMenu name={name} email={email} />
        </div>
      </div>
    </header>
  );
}
