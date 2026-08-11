"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ExternalLink,
  Eye,
  HeartHandshake,
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
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import { Button, IconButton, Monogram, Spinner, cn } from "@/components/ui";
import { ContactStatusBadge, LifecycleBadge } from "@/components/badges";
import { ContactForm, type CompanyOption } from "@/components/forms";
import { htmlToText } from "@/components/rich-text";
import { formatDateTime } from "@/lib/format";
import type { Activity, ActivityType, Contact, EmailOpenStatus } from "@/lib/crm/types";

type Payload = { contact: Contact; activities: Activity[]; opens?: Record<string, EmailOpenStatus> };

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

const looksLikeHtml = (s: string) => /<[a-z][\s\S]*>/i.test(s);

// Tags dropped entirely (content and all); anything not allowed is unwrapped.
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM", "INPUT", "BUTTON", "SVG"]);
const ALLOWED_TAGS = new Set([
  "A", "P", "BR", "DIV", "SPAN", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "BLOCKQUOTE",
  "H1", "H2", "H3", "H4", "H5", "H6", "HR", "IMG", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH",
  "PRE", "CODE", "SMALL", "SUB", "SUP", "FONT",
]);
const ALLOWED_ATTR = new Set(["href", "src", "alt", "title", "style", "width", "height", "align", "target", "rel", "colspan", "rowspan"]);

/** Sanitise email HTML in the browser (DOM allowlist) before rendering it. */
function sanitizeEmailHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const clean = (el: Element) => {
    for (const child of Array.from(el.children)) clean(child);
    const tag = el.tagName;
    if (DROP_TAGS.has(tag)) {
      el.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value;
      if (name.startsWith("on") || !ALLOWED_ATTR.has(name)) {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "src") && /^\s*(javascript|data:text\/html|vbscript):/i.test(val)) {
        el.removeAttribute(attr.name);
      } else if (name === "style" && /expression\(|javascript:|url\(/i.test(val)) {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noreferrer noopener");
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

/** Plain-text bodies (synced mail, notes): drop the sync header line, flatten stray HTML. */
function readableText(raw?: string): string {
  if (!raw) return "";
  const stripped = raw.replace(/^(Received from|Sent to)[^\n]*\n+/i, "");
  return (looksLikeHtml(stripped) ? htmlToText(stripped) : stripped).trim();
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
  const activities = data?.activities ?? [];

  async function saveEdit(payload: Record<string, unknown>) {
    await api(`/api/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(false);
    await load();
    onChanged?.();
  }

  return createPortal(
    <div className="luna-fade fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-[rgba(11,18,32,0.6)] backdrop-blur-md" onClick={onClose} />
      <aside className="luna-slide-in flex h-full w-full max-w-[1080px] flex-col border-l border-border bg-card shadow-float">
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
                      const text = html ? "" : readableText(raw);
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
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
