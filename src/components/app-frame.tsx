"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { QuickAdd } from "@/components/quick-add";

/**
 * The app shell: a fixed left sidebar for navigation (with the ⌘K quick-find
 * inside it) and a wide (1400px) working canvas with a slim top strip that
 * carries the current page's title and the quick-add action — the client-CRM
 * shell that reads as a premium tool rather than an internal one.
 */

const TITLES: [string, string][] = [
  ["/today", "Today"],
  ["/pipeline", "Pipeline"],
  ["/companies", "Companies"],
  ["/contacts", "People"],
  ["/care", "Care"],
  ["/templates", "Email templates"],
  ["/digest", "Weekly digest"],
  ["/data", "Data health"],
  ["/settings", "Settings"],
];

function titleFor(path: string): string {
  const match = TITLES.find(([href]) => path === href || path.startsWith(`${href}/`));
  return match ? match[1] : "Luna Desk";
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const title = titleFor(pathname);

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[248px_1fr]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur sm:px-7">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            <Menu size={18} strokeWidth={1.9} />
          </button>
          <span className="truncate text-[15px] font-semibold tracking-tight text-fg">{title}</span>
          <div className="flex-1" />
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("luna:command-open"))}
            aria-label="Search or ask Luna"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            <Search size={18} strokeWidth={1.9} />
          </button>
          <QuickAdd />
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-7 sm:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
