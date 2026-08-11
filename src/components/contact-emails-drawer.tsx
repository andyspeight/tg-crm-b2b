"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ExternalLink,
  Eye,
  Mail,
  Pencil,
  Reply,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import { Button, IconButton, Monogram, Spinner, cn } from "@/components/ui";
import { ContactStatusBadge, LifecycleBadge } from "@/components/badges";
import { ContactForm, type CompanyOption } from "@/components/forms";
import { htmlToText } from "@/components/rich-text";
import { formatDateTime } from "@/lib/format";
import type { Activity, Contact, EmailOpenStatus } from "@/lib/crm/types";

type Payload = { contact: Contact; emails: Activity[]; opens?: Record<string, EmailOpenStatus> };

/** Strip the sync's "Received from…/Sent to…" header, then flatten any HTML to text. */
function readableBody(raw?: string): string {
  if (!raw) return "";
  const stripped = raw.replace(/^(Received from|Sent to)[^\n]*\n+/i, "");
  const text = /<[a-z][\s\S]*>/i.test(stripped) ? htmlToText(stripped) : stripped;
  return text.trim();
}

/** One labelled detail; only renders when there's a value. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] text-fg">{children}</dd>
    </div>
  );
}

/**
 * Full-height slide-over for a person: their profile (view + inline edit) and
 * their whole email history with open-tracking. Reachable for contacts with no
 * company page.
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Esc closes; lock the background scroll while open.
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
  const emails = data?.emails ?? [];

  async function saveEdit(payload: Record<string, unknown>) {
    await api(`/api/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(false);
    await load();
    onChanged?.();
  }

  return createPortal(
    <div className="luna-fade fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-[rgba(11,18,32,0.6)] backdrop-blur-md" onClick={onClose} />
      <aside className="luna-slide-in flex h-full w-full max-w-[540px] flex-col border-l border-border bg-card shadow-float">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <Monogram name={contact?.name || "?"} size="lg" tone="accent" />
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-fg">
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
          <div className="flex flex-wrap gap-2 border-b border-border-soft px-5 py-3">
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
          </div>
        ) : null}

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="text-[13px] text-danger">{error}</p>
          ) : !data ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-fg-subtle">
              <Spinner /> Loading…
            </div>
          ) : (
            <>
              {/* Details: edit or view */}
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
                  <Detail label="Email">
                    {contact?.email ? (
                      <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-accent-strong hover:underline">
                        <Mail size={13} strokeWidth={1.9} /> {contact.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </Detail>
                  <Detail label="Phone">{contact?.phone ?? "—"}</Detail>
                  <Detail label="LinkedIn">
                    {contact?.linkedin ? (
                      <a
                        href={contact.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent-strong hover:underline"
                      >
                        <ExternalLink size={13} strokeWidth={1.9} /> View profile
                      </a>
                    ) : (
                      "—"
                    )}
                  </Detail>
                  <Detail label="Location">{contact?.location ?? "—"}</Detail>
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

              {/* Email history */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Email history
                  </span>
                  {emails.length ? <span className="text-[11.5px] text-fg-subtle">{emails.length}</span> : null}
                </div>
                {emails.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-[13px] text-fg-subtle">
                    No emails on file for this person yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {emails.map((e) => {
                      const inbound = e.direction === "Inbound";
                      const highlight = !!highlightMessageId && e.gmailMessageId === highlightMessageId;
                      const open = !inbound && e.gmailMessageId ? opens[e.gmailMessageId] : undefined;
                      const body = readableBody(e.rawContent);
                      const isOpen = expanded.has(e.id);
                      return (
                        <li
                          key={e.id}
                          className={cn(
                            "rounded-xl border p-3",
                            highlight ? "border-accent ring-1 ring-accent" : "border-border-soft bg-surface",
                          )}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                                inbound ? "bg-accent/10 text-accent-strong" : "bg-muted text-fg-muted",
                              )}
                            >
                              {inbound ? (
                                <ArrowDownLeft size={12} strokeWidth={2} />
                              ) : (
                                <ArrowUpRight size={12} strokeWidth={2} />
                              )}
                              {inbound ? "Received" : "Sent"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                              {e.summary || "(no subject)"}
                            </span>
                            <span className="tnum shrink-0 text-[11.5px] text-fg-subtle">
                              {formatDateTime(e.date || e.createdTime)}
                            </span>
                          </div>
                          {!inbound && e.gmailMessageId ? (
                            open?.opened ? (
                              <div className="mb-1 inline-flex items-center gap-1 rounded-md bg-success/12 px-1.5 py-0.5 text-[11px] font-medium text-success">
                                <Eye size={12} strokeWidth={2} />
                                Opened{open.opens > 1 ? ` ${open.opens}×` : ""}
                                {open.lastOpenedAt ? ` · last ${formatDateTime(open.lastOpenedAt)}` : ""}
                              </div>
                            ) : (
                              <div className="mb-1 text-[11px] text-fg-subtle">Not opened yet</div>
                            )
                          ) : null}
                          {body ? (
                            <>
                              <p
                                className={cn(
                                  "whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-muted",
                                  !isOpen && "line-clamp-4",
                                )}
                              >
                                {body}
                              </p>
                              {body.length > 240 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpanded((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(e.id)) next.delete(e.id);
                                      else next.add(e.id);
                                      return next;
                                    })
                                  }
                                  className="mt-1 text-[12px] font-medium text-accent-strong hover:underline"
                                >
                                  {isOpen ? "Show less" : "Show more"}
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
