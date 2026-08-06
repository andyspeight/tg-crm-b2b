"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Combine, Download, Link2, Wand2 } from "lucide-react";
import { cn } from "@/components/ui";
import { TidyView } from "@/components/tidy-view";
import { RelinkContacts } from "@/components/relink-contacts";
import { BulkEnrich } from "@/components/bulk-enrich";
import { MondayImport } from "@/components/monday-import";

/**
 * Data health — one home for the four data-hygiene tools that used to be four
 * separate More-menu destinations (Tidy up, Link contacts, Enrich, Import).
 * They all answer the same question — "is my data clean and complete?" — so
 * they live under one tab strip now. Only the active tab mounts, so each tool
 * runs its own scan exactly when you open it, just like the old separate pages.
 */

type Tab = "tidy" | "relink" | "enrich" | "import";

const TABS: { id: Tab; label: string; icon: typeof Combine }[] = [
  { id: "tidy", label: "Tidy up", icon: Combine },
  { id: "relink", label: "Link contacts", icon: Link2 },
  { id: "enrich", label: "Enrich", icon: Wand2 },
  { id: "import", label: "Import", icon: Download },
];
const IDS = new Set<Tab>(["tidy", "relink", "enrich", "import"]);

export function DataHealth() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(IDS.has(initial as Tab) ? (initial as Tab) : "tidy");

  function select(id: Tab) {
    setTab(id);
    // Keep the tab in the URL so deep links (and the old /tidy, /enrich, …
    // redirects) land on the right tool.
    router.replace(`/data?tab=${id}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
          Data health
        </p>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active ? "bg-accent-soft text-accent-strong" : "text-fg-muted hover:bg-muted hover:text-fg",
                )}
              >
                <Icon size={15} strokeWidth={1.9} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {tab === "tidy" && <TidyView />}
        {tab === "relink" && <RelinkContacts />}
        {tab === "enrich" && <BulkEnrich />}
        {tab === "import" && <MondayImport />}
      </div>
    </div>
  );
}
