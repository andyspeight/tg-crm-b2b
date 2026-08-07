"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Contact, Sequence, SequenceEnrollment, SequenceStep } from "@/lib/crm/types";
import {
  Badge,
  type BadgeColor,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";
import { useConfirm, useToast } from "@/components/feedback";

type TemplateLite = { id: string; name: string; subject?: string };
type Conn = { configured: boolean; connected: boolean; canRead?: boolean; email?: string };

const SEQ_BADGE: Record<Sequence["status"], BadgeColor> = {
  Draft: "neutral",
  Active: "success",
  Paused: "warning",
};

const ENR_BADGE: Record<SequenceEnrollment["status"], BadgeColor> = {
  Active: "success",
  Replied: "info",
  Completed: "navy",
  Stopped: "neutral",
  Paused: "warning",
  Failed: "danger",
};

function stepDelayLabel(step: SequenceStep, index: number): string {
  if (index === 0) return step.delayDays > 0 ? `${step.delayDays} day${step.delayDays === 1 ? "" : "s"} after enrolling` : "As soon as enrolled";
  return `${step.delayDays} day${step.delayDays === 1 ? "" : "s"} after the previous step`;
}

function formatWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function SequencesView({
  initialSequences,
  templates,
  initialEnrollments,
}: {
  initialSequences: Sequence[];
  templates: TemplateLite[];
  initialEnrollments: SequenceEnrollment[];
}) {
  const [sequences, setSequences] = useState(initialSequences);
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Sequence | null>(null);
  const [detail, setDetail] = useState<Sequence | null>(null);
  const [conn, setConn] = useState<Conn | null>(null);
  const [running, setRunning] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    api<Conn>("/api/google/status")
      .then(setConn)
      .catch(() => setConn(null));
  }, []);

  async function refresh() {
    const [s, e] = await Promise.all([
      api<{ sequences: Sequence[] }>("/api/sequences"),
      api<{ enrollments: SequenceEnrollment[] }>("/api/sequences/enrollments"),
    ]);
    setSequences(s.sequences);
    setEnrollments(e.enrollments);
    // Keep the open detail drawer in sync with fresh data.
    setDetail((d) => (d ? s.sequences.find((x) => x.id === d.id) ?? null : null));
  }

  const countsBySeq = useMemo(() => {
    const m = new Map<string, { active: number; replied: number; done: number }>();
    for (const e of enrollments) {
      if (!e.sequenceId) continue;
      const c = m.get(e.sequenceId) ?? { active: 0, replied: 0, done: 0 };
      if (e.status === "Active" || e.status === "Paused") c.active += 1;
      else if (e.status === "Replied") c.replied += 1;
      else c.done += 1;
      m.set(e.sequenceId, c);
    }
    return m;
  }, [enrollments]);

  async function runNow() {
    setRunning(true);
    try {
      const r = await api<{
        ran: boolean;
        reason?: string;
        sent: number;
        replied: number;
        completed: number;
        due: number;
      }>("/api/sequences/run", { method: "POST" });
      if (!r.ran) {
        toast.error("Couldn't run", { description: r.reason || "Gmail isn't connected." });
      } else if (r.due === 0) {
        toast.success("Nothing due right now");
      } else {
        toast.success(
          `Sent ${r.sent} · ${r.replied} replied · ${r.completed} finished`,
          { description: "Steps go out one-by-one through your Gmail." },
        );
      }
      await refresh();
    } catch (e) {
      toast.error("Couldn't run sequences", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  async function remove(seq: Sequence) {
    const live = countsBySeq.get(seq.id)?.active ?? 0;
    const ok = await confirm({
      title: `Delete "${seq.name}"?`,
      message: live
        ? `${live} contact${live === 1 ? " is" : "s are"} still active in this sequence. Deleting it stops them and removes the sequence.`
        : "This removes the sequence. Emails already sent are unaffected.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setSequences((xs) => xs.filter((x) => x.id !== seq.id));
    try {
      await api(`/api/sequences/${seq.id}`, { method: "DELETE" });
      toast.success(`${seq.name} deleted`);
      await refresh();
    } catch (e) {
      toast.error("Couldn't delete", { description: (e as Error).message });
      await refresh();
    }
  }

  async function setStatus(seq: Sequence, status: Sequence["status"]) {
    try {
      await api(`/api/sequences/${seq.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "Active" ? "Sequence activated" : `Sequence ${status.toLowerCase()}`);
      await refresh();
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
    }
  }

  const canRead = conn?.connected && conn?.canRead;
  const needsReconnect = conn?.connected && !conn?.canRead;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sequences"
        description={`${sequences.length} ${sequences.length === 1 ? "sequence" : "sequences"} · sent one-by-one through Gmail, auto-stopping on a reply`}
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button variant="secondary" onClick={runNow} disabled={running}>
              {running ? <Spinner /> : <Clock size={16} strokeWidth={1.9} />} Run due now
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2} /> New sequence
            </Button>
          </div>
        }
      />

      {needsReconnect ? (
        <InlineAlert variant="info">
          To auto-stop a sequence when someone replies, Luna needs read access to your Gmail.{" "}
          <Link href="/settings" className="font-medium underline">
            Reconnect Gmail
          </Link>{" "}
          to grant it. Until then, sequences send on schedule but won&apos;t detect replies.
        </InlineAlert>
      ) : null}

      {sequences.length === 0 ? (
        <EmptyState
          icon={<Send size={20} strokeWidth={1.75} />}
          title="No sequences yet"
          hint="Build a short series of emails from your templates. Enrol a contact and Luna sends each step in turn — stopping the moment they reply."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2} /> New sequence
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sequences.map((seq) => {
            const counts = countsBySeq.get(seq.id) ?? { active: 0, replied: 0, done: 0 };
            return (
              <Card key={seq.id} interactive onClick={() => setDetail(seq)} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-fg">{seq.name || "Untitled"}</p>
                    <p className="mt-0.5 text-[12.5px] text-fg-subtle">
                      {seq.steps.length} step{seq.steps.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-1.5">
                    <Badge color={SEQ_BADGE[seq.status]}>{seq.status}</Badge>
                    <IconButton label="Edit sequence" onClick={() => setEditing(seq)}>
                      <Pencil size={15} strokeWidth={1.75} />
                    </IconButton>
                    <IconButton label="Delete sequence" onClick={() => remove(seq)} className="hover:text-danger">
                      <Trash2 size={15} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </div>
                {seq.description ? (
                  <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-fg-subtle">{seq.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-muted">
                  <span>{counts.active} active</span>
                  <span>{counts.replied} replied</span>
                  <span>{counts.done} finished</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {creating || editing ? (
        <SequenceBuilder
          sequence={editing}
          templates={templates}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}

      {detail ? (
        <SequenceDetail
          sequence={detail}
          templates={templates}
          enrollments={enrollments.filter((e) => e.sequenceId === detail.id)}
          canRead={!!canRead}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          onActivate={() => setStatus(detail, "Active")}
          onPause={() => setStatus(detail, "Paused")}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

// --- builder ----------------------------------------------------------------

function SequenceBuilder({
  sequence,
  templates,
  onClose,
  onSaved,
}: {
  sequence: Sequence | null;
  templates: TemplateLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!sequence;
  const [name, setName] = useState(sequence?.name ?? "");
  const [description, setDescription] = useState(sequence?.description ?? "");
  const [steps, setSteps] = useState<SequenceStep[]>(
    sequence?.steps.length ? sequence.steps : [{ templateId: "", delayDays: 0 }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function patchStep(i: number, patch: Partial<SequenceStep>) {
    setSteps((xs) => xs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((xs) => [...xs, { templateId: "", delayDays: 3 }]);
  }
  function removeStep(i: number) {
    setSteps((xs) => (xs.length === 1 ? xs : xs.filter((_, idx) => idx !== i)));
  }
  function move(i: number, dir: -1 | 1) {
    setSteps((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const copy = [...xs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function save(activate: boolean) {
    if (!name.trim()) {
      setError("Give the sequence a name.");
      return;
    }
    if (steps.some((s) => !s.templateId)) {
      setError("Every step needs a template.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name, description, steps };
      if (activate) payload.status = "Active";
      if (isEdit) {
        await api(`/api/sequences/${sequence!.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/sequences", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  const hasTemplates = templates.length > 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="luna-fade fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,18,32,0.6)] p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit sequence" : "New sequence"}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="luna-pop shadow-float relative flex h-[90vh] max-h-[920px] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-6 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-fg">
            {isEdit ? "Edit sequence" : "New sequence"}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Demo no-show follow-up" />
            </Field>
            <Field label="When to use" hint="Optional — a note to your future self.">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="After a booked demo that didn't happen"
              />
            </Field>
          </div>

          {!hasTemplates ? (
            <InlineAlert variant="info">
              You&apos;ll need at least one email template first.{" "}
              <Link href="/templates" className="font-medium underline">
                Create a template
              </Link>{" "}
              then come back to build the sequence.
            </InlineAlert>
          ) : null}

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Steps</span>
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-strong">
                      {i + 1}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <IconButton label="Move up" onClick={() => move(i, -1)} className={i === 0 ? "opacity-30" : ""}>
                        <ArrowUp size={14} strokeWidth={1.9} />
                      </IconButton>
                      <IconButton
                        label="Move down"
                        onClick={() => move(i, 1)}
                        className={i === steps.length - 1 ? "opacity-30" : ""}
                      >
                        <ArrowDown size={14} strokeWidth={1.9} />
                      </IconButton>
                      <IconButton
                        label="Remove step"
                        onClick={() => removeStep(i)}
                        className={steps.length === 1 ? "opacity-30" : "hover:text-danger"}
                      >
                        <Trash2 size={14} strokeWidth={1.9} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto]">
                    <Field label="Template">
                      <Select value={step.templateId} onChange={(e) => patchStep(i, { templateId: e.target.value })}>
                        <option value="">Choose a template…</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={i === 0 ? "Send" : "Wait"}>
                      {i === 0 ? (
                        <Select
                          value={String(step.delayDays)}
                          onChange={(e) => patchStep(i, { delayDays: Number(e.target.value) })}
                        >
                          <option value="0">On enrolment</option>
                          <option value="1">After 1 day</option>
                          <option value="2">After 2 days</option>
                          <option value="3">After 3 days</option>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={step.delayDays}
                            onChange={(e) => patchStep(i, { delayDays: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-20"
                          />
                          <span className="text-[13px] text-fg-subtle">days later</span>
                        </div>
                      )}
                    </Field>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-fg-subtle">{stepDelayLabel(step, i)}</p>
                </li>
              ))}
            </ol>
            <Button type="button" variant="secondary" size="sm" onClick={addStep} className="mt-2.5" disabled={!hasTemplates}>
              <Plus size={15} strokeWidth={1.9} /> Add step
            </Button>
          </div>

          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-surface px-6 py-3.5">
          <p className="text-[12px] text-fg-subtle">
            Activate to enrol contacts. Nothing sends until a contact is enrolled.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => save(false)} disabled={saving || !hasTemplates}>
              {saving ? "Saving…" : "Save as draft"}
            </Button>
            <Button type="button" onClick={() => save(true)} disabled={saving || !hasTemplates}>
              <Play size={15} strokeWidth={1.9} /> Save &amp; activate
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// --- detail (steps + enrollments + enrol) -----------------------------------

function SequenceDetail({
  sequence,
  templates,
  enrollments,
  canRead,
  onClose,
  onEdit,
  onActivate,
  onPause,
  onChanged,
}: {
  sequence: Sequence;
  templates: TemplateLite[];
  enrollments: SequenceEnrollment[];
  canRead: boolean;
  onClose: () => void;
  onEdit: () => void;
  onActivate: () => void;
  onPause: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const templateName = useMemo(() => new Map(templates.map((t) => [t.id, t.name])), [templates]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function act(enrollmentId: string, action: "pause" | "resume" | "stop") {
    try {
      await api(`/api/sequences/enrollments/${enrollmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await onChanged();
    } catch (e) {
      toast.error("Couldn't update", { description: (e as Error).message });
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="luna-fade fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,18,32,0.6)] p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={sequence.name}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="luna-pop shadow-float relative flex h-[90vh] max-h-[920px] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-6 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-fg">{sequence.name}</h2>
            <Badge color={SEQ_BADGE[sequence.status]}>{sequence.status}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
              <Pencil size={14} strokeWidth={1.9} /> Edit
            </Button>
            {sequence.status === "Active" ? (
              <Button type="button" variant="secondary" size="sm" onClick={onPause}>
                <Pause size={14} strokeWidth={1.9} /> Pause
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" onClick={onActivate}>
                <Play size={14} strokeWidth={1.9} /> Activate
              </Button>
            )}
            <IconButton label="Close" onClick={onClose}>
              <X size={18} strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Steps */}
          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">Steps</h3>
            <ol className="space-y-1.5">
              {sequence.steps.map((step, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface px-3 py-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-strong">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">
                    {templateName.get(step.templateId) || "Missing template"}
                  </span>
                  <span className="shrink-0 text-[12px] text-fg-subtle">{stepDelayLabel(step, i)}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Enrol */}
          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">Enrol a contact</h3>
            {sequence.status !== "Active" ? (
              <InlineAlert variant="info">Activate this sequence to enrol contacts.</InlineAlert>
            ) : (
              <EnrolBox
                sequenceId={sequence.id}
                canRead={canRead}
                onEnrolled={async () => {
                  toast.success("Contact enrolled — the first step is queued.");
                  await onChanged();
                }}
              />
            )}
          </section>

          {/* Enrollments */}
          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
              Enrolled ({enrollments.length})
            </h3>
            {enrollments.length === 0 ? (
              <p className="text-[13px] text-fg-subtle">No one enrolled yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {enrollments.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-fg">{e.contactName || "Contact"}</p>
                      <p className="truncate text-[12px] text-fg-subtle">
                        Step {Math.min(e.stepIndex + 1, sequence.steps.length)} of {sequence.steps.length}
                        {e.status === "Active" && e.nextSendAt ? ` · next ${formatWhen(e.nextSendAt)}` : ""}
                        {e.status === "Failed" && e.lastError ? ` · ${e.lastError}` : ""}
                      </p>
                    </div>
                    <Badge color={ENR_BADGE[e.status]}>{e.status}</Badge>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {e.status === "Active" ? (
                        <IconButton label="Pause" onClick={() => act(e.id, "pause")}>
                          <Pause size={14} strokeWidth={1.9} />
                        </IconButton>
                      ) : null}
                      {e.status === "Paused" ? (
                        <IconButton label="Resume" onClick={() => act(e.id, "resume")}>
                          <Play size={14} strokeWidth={1.9} />
                        </IconButton>
                      ) : null}
                      {e.status === "Active" || e.status === "Paused" ? (
                        <IconButton label="Stop" onClick={() => act(e.id, "stop")} className="hover:text-danger">
                          <X size={15} strokeWidth={1.9} />
                        </IconButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// --- contact search + enrol -------------------------------------------------

function EnrolBox({
  sequenceId,
  canRead,
  onEnrolled,
}: {
  sequenceId: string;
  canRead: boolean;
  onEnrolled: () => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const data = await api<{ contacts: Contact[] }>(`/api/search?q=${encodeURIComponent(term)}`);
        setResults(data.contacts.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  async function enrol(c: Contact) {
    setError("");
    setEnrolling(c.id);
    try {
      await api(`/api/sequences/${sequenceId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ contactId: c.id }),
      });
      setQuery("");
      setResults([]);
      await onEnrolled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enrol that contact.");
    } finally {
      setEnrolling(null);
    }
  }

  return (
    <div ref={boxRef}>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
          <Search size={15} strokeWidth={1.75} />
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a contact by name, company or email…"
          className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-[14px] text-fg placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {query.trim().length >= 2 ? (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-float">
            {searching ? (
              <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-fg-subtle">
                <Spinner /> Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-[13px] text-fg-subtle">No contacts match.</div>
            ) : (
              <ul className="py-1">
                {results.map((c) => {
                  const optedOut = c.marketingOptIn === "Opted Out";
                  const disabled = !c.email || optedOut || enrolling === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => enrol(c)}
                        disabled={disabled}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-fg">{c.name}</span>
                          <span className="block truncate text-[12px] text-fg-subtle">
                            {optedOut ? "Opted out" : c.email || "No email"}
                            {c.companyName ? ` · ${c.companyName}` : ""}
                          </span>
                        </span>
                        {enrolling === c.id ? <Spinner /> : <Plus size={15} strokeWidth={1.9} className="shrink-0 text-fg-subtle" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-fg-subtle">
        {canRead ? (
          <>
            <CheckCircle2 size={13} strokeWidth={1.9} className="text-success" /> Auto-stops when they reply.
          </>
        ) : (
          <>
            <Sparkles size={13} strokeWidth={1.9} /> Opted-out contacts can&apos;t be enrolled.
          </>
        )}
      </p>
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
    </div>
  );
}
