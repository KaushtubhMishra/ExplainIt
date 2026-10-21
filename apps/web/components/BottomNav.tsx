"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav-items";

// Bottom tabs on phones; on wider screens the tabs move into the top bar.
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line/60 bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-3xl">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${active ? "text-blue" : "text-ink-soft"}`}>
                <Icon className="size-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
