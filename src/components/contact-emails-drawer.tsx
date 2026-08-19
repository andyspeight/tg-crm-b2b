"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  ExternalLink,
  Eye,
  HeartHandshake,
  History,
  LifeBuoy,
  Mail,
  Megaphone,
  MonitorPlay,
  Pencil,
  Phone,
  Radar,
  Reply,
  StickyNote,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import { Button, IconButton, Monogram, Spinner, cn } from "@/components/ui";
import { ContactStatusBadge, LifecycleBadge } from "@/components/badges";
import { ContactForm, type CompanyOption } from "@/components/forms";
import { isOpenSignalNote, looksLikeHtml, readableEmailText, sanitizeEmailHtml } from "@/lib/email-render";
import { formatDateTime } from "@/lib/format";
import type { Activity, ActivityType, Contact, EmailOpenStatus } from "@/lib/crm/types";
import type { EnrichedContactData } from "@/lib/intel/types";

type EnrichChange = {
  field: string;
  label: string;
  current: string | null;
  next: string;
  action: "fill" | "update";
};
type EnrichResult = {
  found: boolean;
  sourceUrl?: string;
  autoFound?: boolean;
  candidate?: { title?: string; snippet?: string } | null;
  profile?: EnrichedContactData;
  changes?: EnrichChange[];
  contact?: { name?: string; companyName?: string };
  reason?: string;
  message?: string;
};

type Payload = { contact: Contact; activities: Activity[]; opens?: Record<string, EmailOpenStatus> };
type OlderMsg = { id: string; subject: string; date: string; direction: "Inbound" | "Outbound"; body: string };

const ACTIVITY_ICON: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Email: Mail,
  Call: Phone,
  Meeting: Users,
  Demo: MonitorPlay,
  "Care Touch": HeartHandshake,
  Campaign: Megaphone,
  Signal: Radar,
  Support: LifeBuoy,
  Note: StickyNote,
};
function activityIcon(type?: ActivityType) {
  return ACTIVITY_ICON[type ?? "Note"] ?? StickyNote;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] text-fg">{children}</dd>
    </div>
  );
}

/** Like Detail but always renders (shows "—" when blank) — for the enrich preview. */
function EnrichFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-fg">{value || "—"}</dd>
    </div>
  );
}

/**
 * Full-height person 360 slide-over: profile (view + inline edit), quick actions,
 * a jump to the company 360, and the person's whole activity timeline with
 * properly-rendered emails and open tracking.
 */
export function ContactEmailsDrawer({
  contactId,
  highlightMessageId,
  companies,
  onClose,
  onReply,
  onEnrol,
  onChanged,
}: {
  contactId: string | null;
  highlightMessageId?: string;
  companies?: CompanyOption[];
  onClose: () => void;
  onReply: (contact: Contact) => void;
  onEnrol?: (contact: Contact) => void;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [older, setOlder] = useState<OlderMsg[] | null>(null);
  const [olderState, setOlderState] = useState<"idle" | "loading" | "error">("idle");
  const [olderError, setOlderError] = useState("");
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [enrichState, setEnrichState] = useState<"idle" | "looking" | "saving">("idle");
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [enrichError, setEnrichError] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");

  async function load() {
    if (!contactId) return;
    try {
      setData(await api<Payload>(`/api/contacts/${contactId}/emails`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this person");
    }
  }

  useEffect(() => {
    setData(null);
    setError("");
    setEditing(false);
    setExpanded(new Set());
    setOlder(null);
    setOlderState("idle");
    setOlderError("");
    setEnrichOpen(false);
    setEnrichState("idle");
    setEnrichResult(null);
    setEnrichError("");
    setPasteUrl("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  useEffect(() => {
    if (!contactId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [contactId, onClose]);

  if (!contactId || typeof document === "undefined") return null;
  const contact = data?.contact;
  const opens = data?.opens ?? {};
  // Drop the auto "📬 Opened …" signal notes — the email's own Opened badge says it.
  const activities = (data?.activities ?? []).filter((a) => !isOpenSignalNote(a));

  async function saveEdit(payload: Record<string, unknown>) {
    await api(`/api/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(false);
    await load();
    onChanged?.();
  }

  async function loadOlder() {
    setOlderState("loading");
    setOlderError("");
    try {
      const r = await api<{ messages: OlderMsg[] }>(`/api/contacts/${contactId}/older-emails`);
      setOlder(r.messages ?? []);
      setOlderState("idle");
    } catch (e) {
      setOlderError(e instanceof Error ? e.message : "Couldn't load older mail from Gmail");
      setOlderState("error");
    }
  }

  async function runEnrichLookup(url?: string) {
    if (!contactId) return;
    setEnrichState("looking");
    setEnrichError("");
    setEnrichResult(null);
    try {
      const r = await api<EnrichResult>(`/api/intel/enrich/contact/${contactId}`, {
        method: "POST",
        body: JSON.stringify(url ? { url } : {}),
      });
      setEnrichResult(r);
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setEnrichState("idle");
    }
  }

  function openEnrich() {
    setEnrichOpen(true);
    setEnrichResult(null);
    setEnrichError("");
    setPasteUrl("");
    runEnrichLookup();
  }

  async function applyEnrich() {
    if (!contactId || !enrichResult?.found || !enrichResult.sourceUrl) return;
    setEnrichState("saving");
    setEnrichError("");
    try {
      await api(`/api/intel/enrich/contact/${contactId}`, {
        method: "POST",
        body: JSON.stringify({
          mode: "apply",
          sourceUrl: enrichResult.sourceUrl,
          profile: enrichResult.profile,
        }),
      });
      setEnrichOpen(false);
      setEnrichResult(null);
      setPasteUrl("");
      await load();
      onChanged?.();
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Couldn't save enrichment");
    } finally {
      setEnrichState("idle");
    }
  }

  return createPortal(
    <div className="luna-fade fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-[rgba(11,18,32,0.6)] backdrop-blur-md" onClick={onClose} />
      <aside className="luna-slide-in relative flex h-full w-full max-w-[1080px] flex-col border-l border-border bg-card shadow-float">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <Monogram name={contact?.name || "?"} size="lg" tone="accent" />
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-semibold tracking-tight text-fg">
                {contact?.name || "Person"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {contact?.status ? (
                  <ContactStatusBadge value={contact.status} />
                ) : contact?.companyLifecycle ? (
                  <LifecycleBadge value={contact.companyLifecycle} />
                ) : null}
                {contact?.role ? <span className="text-[12.5px] text-fg-subtle">{contact.role}</span> : null}
                {contact?.companyName ? (
                  <span className="text-[12.5px] text-fg-subtle">
                    ·{" "}
                    {contact.companyId ? (
                      <Link href={`/companies/${contact.companyId}`} className="hover:text-accent-strong">
                        {contact.companyName}
                      </Link>
                    ) : (
                      contact.companyName
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </IconButton>
        </div>

        {/* Actions */}
        {contact ? (
          <div className="flex flex-wrap gap-2 border-b border-border-soft px-6 py-3">
            <Button size="sm" onClick={() => onReply(contact)} disabled={!contact.email}>
              <Reply size={15} strokeWidth={1.9} /> Reply
            </Button>
            {onEnrol ? (
              <Button size="sm" variant="secondary" onClick={() => onEnrol(contact)} disabled={!contact.email}>
                <CalendarClock size={15} strokeWidth={1.9} /> Add to sequence
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              <Pencil size={15} strokeWidth={1.9} /> {editing ? "Close editor" : "Edit details"}
            </Button>
            <Button size="sm" variant="secondary" onClick={openEnrich} disabled={enrichState === "looking"}>
              <Wand2 size={15} strokeWidth={1.9} /> Enrich
            </Button>
            {contact.companyId ? (
              <Link href={`/companies/${contact.companyId}`} className="ml-auto">
                <Button size="sm" variant="secondary">
                  <Building2 size={15} strokeWidth={1.9} /> Open company 360
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Body: two columns on wide screens (profile | timeline) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="text-[13px] text-danger">{error}</p>
          ) : !data ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-fg-subtle">
              <Spinner /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
              {/* Profile column */}
              <div>
                {editing ? (
                  <ContactForm
                    initial={contact}
                    companies={companies}
                    onSave={saveEdit}
                    onCancel={() => setEditing(false)}
                    submitLabel="Save changes"
                  />
                ) : (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border-soft bg-surface p-4">
                    <Detail label="Status">{contact?.status ?? "—"}</Detail>
                    <Detail label="Marketing opt-in">{contact?.marketingOptIn ?? "—"}</Detail>
                    <div className="col-span-2">
                      <Detail label="Email">
                        {contact?.email ? (
                          <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-accent-strong hover:underline">
                            <Mail size={13} strokeWidth={1.9} /> {contact.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </Detail>
                    </div>
                    <Detail label="Phone">{contact?.phone ?? "—"}</Detail>
                    <Detail label="LinkedIn">
                      {contact?.linkedin ? (
                        <a
                          href={contact.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent-strong hover:underline"
                        >
                          <ExternalLink size={13} strokeWidth={1.9} /> Profile
                        </a>
                      ) : (
                        "—"
                      )}
                    </Detail>
                    <Detail label="Location">{contact?.location ?? "—"}</Detail>
                    <Detail label="Company">{contact?.companyName ?? "No company"}</Detail>
                    {contact?.notes ? (
                      <div className="col-span-2">
                        <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Notes</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">
                          {contact.notes}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                )}
              </div>

              {/* Timeline column */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Activity</span>
                  {activities.length ? (
                    <span className="text-[11.5px] text-fg-subtle">{activities.length}</span>
                  ) : null}
                </div>
                {activities.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-[13px] text-fg-subtle">
                    Nothing on this person&apos;s timeline yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {activities.map((a) => {
                      const Icon = activityIcon(a.type);
                      const isEmail = a.type === "Email";
                      const inbound = a.direction === "Inbound";
                      const highlight = !!highlightMessageId && a.gmailMessageId === highlightMessageId;
                      const open = isEmail && !inbound && a.gmailMessageId ? opens[a.gmailMessageId] : undefined;
                      const raw = a.rawContent || "";
                      const html = isEmail && looksLikeHtml(raw) ? sanitizeEmailHtml(raw) : "";
                      const text = html ? "" : readableEmailText(raw);
                      const isOpen = expanded.has(a.id);
                      return (
                        <li
                          key={a.id}
                          className={cn(
                            "rounded-xl border p-3",
                            highlight ? "border-accent ring-1 ring-accent" : "border-border-soft bg-surface",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-fg-subtle">
                              <Icon size={13} strokeWidth={1.9} />
                            </span>
                            {isEmail ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                                  inbound ? "bg-accent/10 text-accent-strong" : "bg-muted text-fg-muted",
                                )}
                              >
                                {inbound ? <ArrowDownLeft size={12} strokeWidth={2} /> : <ArrowUpRight size={12} strokeWidth={2} />}
                                {inbound ? "Received" : "Sent"}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                              {a.summary || a.type || "Activity"}
                            </span>
                            <span className="tnum shrink-0 text-[11.5px] text-fg-subtle">
                              {formatDateTime(a.date || a.createdTime)}
                            </span>
                          </div>

                          {open ? (
                            <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-success/12 px-1.5 py-0.5 text-[11px] font-medium text-success">
                              <Eye size={12} strokeWidth={2} />
                              Opened{open.opens > 1 ? ` ${open.opens}×` : ""}
                              {open.lastOpenedAt ? ` · last ${formatDateTime(open.lastOpenedAt)}` : ""}
                            </div>
                          ) : isEmail && !inbound && a.gmailMessageId ? (
                            <div className="mt-1 text-[11px] text-fg-subtle">Not opened yet</div>
                          ) : null}

                          {html ? (
                            <div
                              className={cn("tg-email mt-2 overflow-hidden", !isOpen && "max-h-40")}
                              dangerouslySetInnerHTML={{ __html: html }}
                            />
                          ) : text ? (
                            <p className={cn("mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-muted", !isOpen && "line-clamp-4")}>
                              {text}
                            </p>
                          ) : null}

                          {(html || (text && text.length > 240)) ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(a.id)) next.delete(a.id);
                                  else next.add(a.id);
                                  return next;
                                })
                              }
                              className="mt-1 text-[12px] font-medium text-accent-strong hover:underline"
                            >
                              {isOpen ? "Show less" : "Show more"}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Older correspondence — pulled live from Gmail, never stored */}
                {contact?.email ? (
                  <div className="mt-4 border-t border-border-soft pt-4">
                    {older === null ? (
                      <button
                        type="button"
                        onClick={loadOlder}
                        disabled={olderState === "loading"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-fg-muted hover:bg-muted disabled:opacity-60"
                      >
                        {olderState === "loading" ? <Spinner /> : <History size={14} strokeWidth={1.9} />}
                        Load older from Gmail
                      </button>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                            Older — live from Gmail
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] text-fg-subtle">not stored</span>
                        </div>
                        {older.length === 0 ? (
                          <p className="text-[13px] text-fg-subtle">No older mail found in Gmail.</p>
                        ) : (
                          <ul className="space-y-2">
                            {older.map((m) => {
                              const inbound = m.direction === "Inbound";
                              const html = looksLikeHtml(m.body) ? sanitizeEmailHtml(m.body) : "";
                              const text = html ? "" : readableEmailText(m.body);
                              const isOpen = expanded.has(m.id);
                              return (
                                <li key={m.id} className="rounded-xl border border-border-soft bg-surface p-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                                        inbound ? "bg-accent/10 text-accent-strong" : "bg-muted text-fg-muted",
                                      )}
                                    >
                                      {inbound ? <ArrowDownLeft size={12} strokeWidth={2} /> : <ArrowUpRight size={12} strokeWidth={2} />}
                                      {inbound ? "Received" : "Sent"}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                                      {m.subject || "(no subject)"}
                                    </span>
                                    <span className="tnum shrink-0 text-[11.5px] text-fg-subtle">{formatDateTime(m.date)}</span>
                                  </div>
                                  {html ? (
                                    <div
                                      className={cn("tg-email mt-2 overflow-hidden", !isOpen && "max-h-40")}
                                      dangerouslySetInnerHTML={{ __html: html }}
                                    />
                                  ) : text ? (
                                    <p className={cn("mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-muted", !isOpen && "line-clamp-4")}>
                                      {text}
                                    </p>
                                  ) : null}
                                  {html || (text && text.length > 240) ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpanded((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(m.id)) next.delete(m.id);
                                          else next.add(m.id);
                                          return next;
                                        })
                                      }
                                      className="mt-1 text-[12px] font-medium text-accent-strong hover:underline"
                                    >
                                      {isOpen ? "Show less" : "Show more"}
                                    </button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                    {olderState === "error" ? <p className="mt-2 text-[12px] text-danger">{olderError}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Enrich overlay — resolve a profile, preview the diff, confirm before any write */}
        {enrichOpen ? (
          <div className="luna-fade absolute inset-0 z-20 flex flex-col bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border-soft px-6 py-4">
              <div className="flex items-center gap-2">
                <Wand2 size={18} strokeWidth={1.9} className="text-accent-strong" />
                <h3 className="text-[16px] font-semibold tracking-tight text-fg">
                  Enrich {contact?.name || "person"}
                </h3>
              </div>
              <IconButton label="Close" onClick={() => setEnrichOpen(false)}>
                <X size={18} strokeWidth={1.75} />
              </IconButton>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {enrichState === "looking" ? (
                <div className="flex items-center gap-2 py-10 text-[13px] text-fg-subtle">
                  <Spinner /> Searching LinkedIn — this can take up to a minute…
                </div>
              ) : (
                <div className="space-y-4">
                  {enrichError ? <p className="text-[13px] text-danger">{enrichError}</p> : null}

                  {enrichResult && !enrichResult.found ? (
                    <p className="text-[13px] text-fg-muted">{enrichResult.message}</p>
                  ) : null}

                  {enrichResult && enrichResult.found ? (
                    <>
                      {enrichResult.autoFound ? (
                        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-[12.5px] leading-relaxed text-fg-muted">
                          <span className="font-medium text-fg">Found by search — check it&apos;s the right person.</span>{" "}
                          We matched on name
                          {enrichResult.contact?.companyName ? ` + ${enrichResult.contact.companyName}` : ""}. Open the
                          profile to confirm before saving.
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-border-soft bg-surface p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                            Matched profile
                          </span>
                          <a
                            href={enrichResult.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-strong hover:underline"
                          >
                            <ExternalLink size={13} strokeWidth={1.9} /> Open on LinkedIn
                          </a>
                        </div>
                        {enrichResult.candidate?.title ? (
                          <p className="mt-1.5 text-[13px] font-medium text-fg">{enrichResult.candidate.title}</p>
                        ) : null}
                        {enrichResult.candidate?.snippet ? (
                          <p className="mt-0.5 line-clamp-2 text-[12px] text-fg-subtle">
                            {enrichResult.candidate.snippet}
                          </p>
                        ) : null}
                        <p className="mt-1 break-all text-[11.5px] text-fg-subtle">{enrichResult.sourceUrl}</p>
                      </div>

                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                          What we found
                        </p>
                        <dl className="grid grid-cols-1 gap-2 rounded-xl border border-border-soft bg-surface p-3 sm:grid-cols-2">
                          <EnrichFact label="Headline" value={enrichResult.profile?.headline} />
                          <EnrichFact label="Role" value={enrichResult.profile?.role} />
                          <EnrichFact label="Location" value={enrichResult.profile?.location} />
                          <EnrichFact label="Company" value={enrichResult.profile?.companyName} />
                          {enrichResult.profile?.notes ? (
                            <div className="sm:col-span-2">
                              <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">Bio</dt>
                              <dd className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-muted">
                                {enrichResult.profile.notes}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>

                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                          {enrichResult.changes && enrichResult.changes.length
                            ? `Will save to this record (${enrichResult.changes.length})`
                            : "Nothing new to add"}
                        </p>
                        {enrichResult.changes && enrichResult.changes.length ? (
                          <ul className="space-y-1.5">
                            {enrichResult.changes.map((c) => (
                              <li key={c.field} className="flex items-start gap-2 text-[12.5px]">
                                <span
                                  className={cn(
                                    "mt-px shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase",
                                    c.action === "update"
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success",
                                  )}
                                >
                                  {c.action === "update" ? "Update" : "Add"}
                                </span>
                                <span className="shrink-0 text-fg-subtle">{c.label}</span>
                                <span className="min-w-0 flex-1 break-words text-fg line-clamp-2">{c.next}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[12.5px] text-fg-subtle">
                            This person&apos;s record already has everything we found on LinkedIn.
                          </p>
                        )}
                      </div>
                    </>
                  ) : null}

                  {enrichResult || enrichError ? (
                    <div className="rounded-xl border border-border-soft bg-surface p-3">
                      <label className="text-[12px] font-medium text-fg-muted">
                        {enrichResult?.found
                          ? "Not them? Paste the correct LinkedIn profile URL"
                          : "Paste their LinkedIn profile URL"}
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          value={pasteUrl}
                          onChange={(e) => setPasteUrl(e.target.value)}
                          placeholder="https://www.linkedin.com/in/…"
                          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 text-[13px] text-fg placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => runEnrichLookup(pasteUrl)}
                          disabled={!pasteUrl.trim()}
                        >
                          Look up
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border-soft px-6 py-4">
              {enrichResult?.found && enrichResult.changes && enrichResult.changes.length ? (
                <Button onClick={applyEnrich} disabled={enrichState === "saving"}>
                  {enrichState === "saving" ? <Spinner /> : <Check size={15} strokeWidth={2} />} Save enrichment
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => setEnrichOpen(false)}
                disabled={enrichState === "saving"}
              >
                {enrichResult?.found && enrichResult.changes && enrichResult.changes.length ? "Cancel" : "Close"}
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
