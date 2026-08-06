"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { CommandBar } from "@/components/command-bar";
import { QuickAdd } from "@/components/quick-add";

/**
 * The app shell: a fixed left sidebar for navigation and a wide (1400px)
 * working canvas with a slim top strip that hosts the ⌘K command bar. Replaces
 * the old centered top-nav layout — the sidebar + wider canvas is what makes it
 * read as a premium tool rather than an internal one.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[248px_1fr]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur sm:px-7">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            <Menu size={18} strokeWidth={1.9} />
          </button>
          <CommandBar />
          <div className="flex-1" />
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-7 sm:py-7">
          {children}
        </main>
      </div>

      {/* Trigger-less: hosts the Task / Note / LinkedIn modals opened from the
          command bar and Today's quick actions (the `luna:quickadd` event). */}
      <QuickAdd showTrigger={false} />
    </div>
  );
}
