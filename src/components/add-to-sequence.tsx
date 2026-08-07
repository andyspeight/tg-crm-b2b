"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { api } from "@/lib/client";
import type { Sequence } from "@/lib/crm/types";
import { Button, InlineAlert, Modal, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/feedback";

export type EnrolTarget = {
  id: string;
  name: string;
  email?: string;
  marketingOptIn?: string;
};

/**
 * Enrol one or many contacts into an active sequence. Contacts with no email or
 * marked opted-out are shown as skipped, never enrolled. Each enrolment is a
 * separate call so one duplicate/failure doesn't sink the rest.
 */
export function AddToSequenceModal({
  open,
  onClose,
  contacts,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  contacts: EnrolTarget[];
  onDone?: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [sequences, setSequences] = useState<Sequence[] | null>(null);
  const [sequenceId, setSequenceId] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSequences(null);
    api<{ sequences: Sequence[] }>("/api/sequences")
      .then((d) => {
        const active = d.sequences.filter((s) => s.status === "Active");
        setSequences(active);
        setSequenceId(active[0]?.id ?? "");
      })
      .catch(() => setSequences([]));
  }, [open]);

  const enrollable = useMemo(
    () => contacts.filter((c) => c.email && c.marketingOptIn !== "Opted Out"),
    [contacts],
  );
  const skipped = contacts.length - enrollable.length;

  async function enrol() {
    if (!sequenceId || enrollable.length === 0) return;
    setError("");
    setWorking(true);
    let ok = 0;
    const problems: string[] = [];
    for (const c of enrollable) {
      try {
        await api(`/api/sequences/${sequenceId}/enroll`, {
          method: "POST",
          body: JSON.stringify({ contactId: c.id }),
        });
        ok += 1;
      } catch (e) {
        problems.push(`${c.name}: ${(e as Error).message}`);
      }
    }
    setWorking(false);
    if (ok > 0) {
      const seqName = sequences?.find((s) => s.id === sequenceId)?.name ?? "the sequence";
      toast.success(`Enrolled ${ok} ${ok === 1 ? "contact" : "contacts"} in ${seqName}`, {
        description: problems.length ? `${problems.length} couldn't be added.` : undefined,
      });
      await onDone?.();
      onClose();
    } else {
      setError(problems[0] || "No one could be enrolled.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to sequence">
      {sequences === null ? (
        <div className="flex items-center gap-2 py-6 text-[13px] text-fg-subtle">
          <Spinner /> Loading sequences…
        </div>
      ) : sequences.length === 0 ? (
        <div className="space-y-3 py-2">
          <p className="text-[14px] text-fg">No active sequences yet.</p>
          <p className="text-[13px] text-fg-subtle">
            Build one and activate it, then you can enrol people straight from here.
          </p>
          <Link href="/sequences" onClick={onClose}>
            <Button>
              <Send size={15} strokeWidth={1.9} /> Go to sequences
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-fg-muted">
            {contacts.length === 1 ? (
              <>Enrol <span className="font-medium text-fg">{contacts[0].name}</span> in a sequence.</>
            ) : (
              <>
                Enrol <span className="font-medium text-fg">{enrollable.length}</span> of {contacts.length}{" "}
                selected {contacts.length === 1 ? "contact" : "people"}.
              </>
            )}
          </p>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Sequence</span>
            <Select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)}>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.steps.length} step{s.steps.length === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          </label>

          {skipped > 0 ? (
            <InlineAlert variant="info">
              {skipped} {skipped === 1 ? "person is" : "people are"} skipped — no email address, or opted out
              of marketing.
            </InlineAlert>
          ) : null}
          {enrollable.length === 0 ? (
            <InlineAlert variant="danger">
              None of the selected people can be enrolled (no email, or opted out).
            </InlineAlert>
          ) : null}
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={working}>
              Cancel
            </Button>
            <Button onClick={enrol} disabled={working || !sequenceId || enrollable.length === 0}>
              {working ? <Spinner /> : <Send size={15} strokeWidth={1.9} />}
              {enrollable.length > 1 ? ` Enrol ${enrollable.length}` : " Enrol"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
