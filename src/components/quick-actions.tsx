"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, StickyNote, UserPlus } from "lucide-react";
import { AddLeadModal } from "@/components/add-lead-modal";

type Lifecycle = "Prospect" | "Customer";
type Action =
  | { label: string; icon: typeof UserPlus; lead: Lifecycle }
  | { label: string; icon: typeof UserPlus; href: string }
  | { label: string; icon: typeof UserPlus; event: string; detail?: unknown };

const ACTIONS: Action[] = [
  { label: "New lead", icon: UserPlus, lead: "Prospect" },
  { label: "New customer", icon: Building2, lead: "Customer" },
  { label: "New deal", icon: Briefcase, href: "/deals?new=1" },
  { label: "Log note", icon: StickyNote, event: "luna:quickadd", detail: { mode: "note" } },
];

export function QuickActions() {
  const router = useRouter();
  const [leadMode, setLeadMode] = useState<Lifecycle | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => {
                if ("lead" in a) setLeadMode(a.lead);
                else if ("href" in a) router.push(a.href);
                else window.dispatchEvent(new CustomEvent(a.event, { detail: a.detail }));
              }}
              className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-[13.5px] font-semibold text-fg shadow-card transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-accent-soft hover:shadow-raise active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong transition-transform group-hover:scale-[1.06]">
                <Icon size={16} strokeWidth={2} />
              </span>
              {a.label}
            </button>
          );
        })}
      </div>

      <AddLeadModal
        open={leadMode !== null}
        mode={leadMode ?? "Prospect"}
        onClose={() => setLeadMode(null)}
      />
    </>
  );
}
