"use client";

import { useRouter } from "next/navigation";
import { Briefcase, Building2, StickyNote, UserPlus } from "lucide-react";

type Action =
  | { label: string; icon: typeof UserPlus; href: string }
  | { label: string; icon: typeof UserPlus; event: string; detail?: unknown };

const ACTIONS: Action[] = [
  { label: "New lead", icon: UserPlus, href: "/companies?new=prospect" },
  { label: "New customer", icon: Building2, href: "/companies?new=customer" },
  { label: "New deal", icon: Briefcase, href: "/deals?new=1" },
  { label: "Log note", icon: StickyNote, event: "luna:quickadd", detail: { mode: "note" } },
];

export function QuickActions() {
  const router = useRouter();
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            onClick={() =>
              "href" in a
                ? router.push(a.href)
                : window.dispatchEvent(new CustomEvent(a.event, { detail: a.detail }))
            }
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] font-medium text-fg shadow-[0_1px_2px_rgba(8,15,30,0.04)] transition-[transform,background-color,border-color] hover:border-accent-soft hover:bg-accent-soft/30 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-accent-soft/50 text-accent-strong transition-colors group-hover:bg-accent-soft">
              <Icon size={15} strokeWidth={1.9} />
            </span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
