"use client";

import { useEffect, useState } from "react";
import { Copy, Merge, Users } from "lucide-react";
import { api } from "@/lib/client";
import type { Contact } from "@/lib/crm/types";
import { Badge, Button, InlineAlert, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/feedback";

type Group = {
  key: string;
  reason: string;
  confidence: "high" | "medium";
  contacts: Contact[];
};

/** Prefer the most complete record as the default primary to keep on merge. */
function completeness(c: Contact): number {
  return [c.email, c.role, c.phone, c.linkedin, c.companyId, c.notes, c.headline].filter(Boolean).length;
}

export function DuplicatesReview({ onMerged }: { onMerged?: () => void | Promise<void> }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState(false);
  const [primary, setPrimary] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api<{ groups: Group[] }>("/api/contacts/duplicates")
      .then((d) => {
        setGroups(d.groups);
        // Default primary = the most complete contact in each group.
        const picks: Record<string, string> = {};
        for (const g of d.groups) {
          picks[g.key] = [...g.contacts].sort((a, b) => completeness(b) - completeness(a))[0]?.id ?? "";
        }
        setPrimary(picks);
      })
      .catch(() => setGroups([]));
  }, []);

  async function merge(g: Group) {
    const primaryId = primary[g.key];
    if (!primaryId) return;
    const secondaryIds = g.contacts.map((c) => c.id).filter((id) => id !== primaryId);
    setBusy(g.key);
    try {
      await api("/api/cleanup/merge", {
        method: "POST",
        body: JSON.stringify({ type: "contacts", primaryId, secondaryIds }),
      });
      setGroups((gs) => (gs ? gs.filter((x) => x.key !== g.key) : gs));
      toast.success(`Merged ${secondaryIds.length + 1} records into one person`);
      await onMerged?.();
    } catch (e) {
      toast.error("Couldn't merge", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!groups || groups.length === 0) return null;

  const total = groups.length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3.5 py-2.5">
        <Copy size={16} strokeWidth={1.9} className="text-warning" aria-hidden />
        <span className="text-[13.5px] text-fg">
          {total} possible duplicate {total === 1 ? "person" : "people"} to review
        </span>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Review &amp; merge
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Possible duplicate people">
        <p className="mb-4 text-[13px] text-fg-subtle">
          Choose which record to keep — the others merge into it. Their emails, history and details all move across, then
          the extra records are removed.
        </p>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key} className="rounded-xl border border-border bg-surface p-3">
              <div className="mb-2 flex items-center gap-2">
                <Badge color={g.confidence === "high" ? "warning" : "neutral"}>
                  {g.confidence === "high" ? "Likely" : "Possible"}
                </Badge>
                <span className="truncate text-[12.5px] text-fg-subtle">{g.reason}</span>
              </div>
              <ul className="space-y-1.5">
                {g.contacts.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                      <input
                        type="radio"
                        name={`primary-${g.key}`}
                        checked={primary[g.key] === c.id}
                        onChange={() => setPrimary((p) => ({ ...p, [g.key]: c.id }))}
                        className="mt-1 h-4 w-4 accent-[var(--color-accent-strong)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-[13.5px]">
                          <span className="font-medium text-fg">{c.name || "Unnamed"}</span>
                          {primary[g.key] === c.id ? (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">Keep</span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[12.5px] text-fg-subtle">
                          {[c.email, c.role, c.companyName].filter(Boolean).join(" · ") || "No details"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={() => merge(g)} disabled={busy === g.key || !primary[g.key]}>
                  {busy === g.key ? <Spinner /> : <Merge size={15} strokeWidth={1.9} />} Merge into one
                </Button>
              </div>
            </div>
          ))}
          {groups.length === 0 ? (
            <InlineAlert variant="success">
              <Users size={15} strokeWidth={1.9} className="inline" /> All clear — no duplicates left.
            </InlineAlert>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
