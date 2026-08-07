"use client";

import { useEffect, useState } from "react";
import { Merge } from "lucide-react";
import { api } from "@/lib/client";
import type { Contact } from "@/lib/crm/types";
import { Button, InlineAlert, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/feedback";

function completeness(c: Contact): number {
  return [c.email, c.role, c.phone, c.linkedin, c.companyId, c.notes, c.headline].filter(Boolean).length;
}

/**
 * Merge a hand-picked set of contacts into one. Unlike the auto-suggested
 * duplicates, this trusts the user's selection — but still makes them choose the
 * record to keep and confirm, because a merge deletes the others.
 */
export function MergePeopleModal({
  open,
  contacts,
  onClose,
  onDone,
}: {
  open: boolean;
  contacts: Contact[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [primaryId, setPrimaryId] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const best = [...contacts].sort((a, b) => completeness(b) - completeness(a))[0];
    setPrimaryId(best?.id ?? "");
  }, [open, contacts]);

  const companies = new Set(contacts.map((c) => c.companyId).filter(Boolean));
  const mixedCompanies = companies.size > 1;

  async function merge() {
    if (!primaryId) return;
    const secondaryIds = contacts.map((c) => c.id).filter((id) => id !== primaryId);
    if (secondaryIds.length === 0) return;
    setBusy(true);
    try {
      await api("/api/cleanup/merge", {
        method: "POST",
        body: JSON.stringify({ type: "contacts", primaryId, secondaryIds }),
      });
      toast.success(`Merged ${contacts.length} records into one person`);
      await onDone();
      onClose();
    } catch (e) {
      toast.error("Couldn't merge", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Merge ${contacts.length} people`}>
      <p className="mb-3 text-[13px] text-fg-subtle">
        Choose the record to keep — the others merge into it. Their emails, history and details all move across, then the
        extra records are removed.
      </p>

      {mixedCompanies ? (
        <InlineAlert variant="info">
          Heads up — these are at different companies. Only merge them if they&apos;re genuinely the same person.
        </InlineAlert>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {contacts.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-2.5 py-2 hover:bg-muted/50">
              <input
                type="radio"
                name="merge-primary"
                checked={primaryId === c.id}
                onChange={() => setPrimaryId(c.id)}
                className="mt-1 h-4 w-4 accent-[var(--color-accent-strong)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-[13.5px]">
                  <span className="font-medium text-fg">{c.name || "Unnamed"}</span>
                  {primaryId === c.id ? (
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

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={merge} disabled={busy || !primaryId || contacts.length < 2}>
          {busy ? <Spinner /> : <Merge size={15} strokeWidth={1.9} />} Merge into one
        </Button>
      </div>
    </Modal>
  );
}
