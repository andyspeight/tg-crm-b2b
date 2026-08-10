"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Paperclip, Plug, Search, Send, Sparkles, Upload, X } from "lucide-react";
import { api } from "@/lib/client";
import type { Contact, EmailTemplate, MeetingConfig } from "@/lib/crm/types";
import { Button, Field, IconButton, InlineAlert, Input, Select, Spinner } from "@/components/ui";
import { RichTextEditor, htmlToText, plainToHtml, type RichTextEditorHandle } from "@/components/rich-text";
import { bookingLink, meetingButtonHtml, meetingConfigReady } from "@/lib/meetings";
import { fillMergeTags, firstNameOf } from "@/lib/email/merge";
import { useToast } from "@/components/feedback";

type Conn = { configured: boolean; connected: boolean; email?: string };

function formatBytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1)); // strip the data: URL prefix
    };
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
}

type AdHocFile = { filename: string; contentType: string; base64: string; size: number };

const MAX_TOTAL_ATTACH = 18 * 1024 * 1024;

/**
 * The one full-screen email composer, used everywhere we send: from a template,
 * or from a company/contact. Rich-text body, an optional template picker, AI
 * drafting (from an angle) and AI personalising, attachments, and a real Gmail
 * send (rich HTML, so open-tracking + tracked attachment links apply server-side).
 */
export function SendComposer({
  onClose,
  onSent,
  template,
  templates,
  company,
  contacts,
  defaultContactId,
  defaultAngle,
  autoDraft,
}: {
  onClose: () => void;
  onSent?: () => void | Promise<void>;
  /** A fixed template (templates screen) — hides the picker. */
  template?: EmailTemplate;
  /** Templates to offer in the picker (company/contact flow). */
  templates?: EmailTemplate[];
  /** Account context — enables the AI "Draft with Luna" angle. */
  company?: { id: string; name: string };
  /** Preloaded contacts for the account — used instead of global search. */
  contacts?: Contact[];
  defaultContactId?: string;
  defaultAngle?: string;
  autoDraft?: boolean;
}) {
  const pickable = template ? [] : templates ?? [];
  const showPicker = !template && !!templates; // company/contact flow always offers the picker

  const [conn, setConn] = useState<Conn | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [contact, setContact] = useState<Contact | null>(
    () => contacts?.find((c) => c.id === defaultContactId) ?? null,
  );
  const [templateId, setTemplateId] = useState<string>(template?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [angle, setAngle] = useState(defaultAngle ?? "");
  const [drafting, setDrafting] = useState(false);
  const [personalising, setPersonalising] = useState(false);
  const [files, setFiles] = useState<AdHocFile[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [meetingCfg, setMeetingCfg] = useState<MeetingConfig | null>(null);
  const [meetingMenu, setMeetingMenu] = useState(false);
  const toast = useToast();

  // Load the scheduler config once, so "Insert meeting" can offer booking links.
  useEffect(() => {
    api<MeetingConfig>("/api/meetings")
      .then((c) => setMeetingCfg(c))
      .catch(() => setMeetingCfg(null));
  }, []);

  function insertMeeting(opt: MeetingConfig["options"][number]) {
    if (!meetingCfg) return;
    const url = bookingLink(meetingCfg, opt);
    if (!url) return;
    editorRef.current?.insertHtml(`<p>${meetingButtonHtml(opt.label, url)}</p>`);
    setMeetingMenu(false);
  }

  const activeTemplate = useMemo(
    () => template ?? templates?.find((t) => t.id === templateId) ?? null,
    [template, templates, templateId],
  );
  const attachments = activeTemplate?.attachments ?? [];

  // Esc closes; lock body scroll; check the Gmail connection once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    api<Conn>("/api/google/status")
      .then(setConn)
      .catch(() => setConn({ configured: false, connected: false }));
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const fillFrom = useCallback(
    (c: Contact | null, tmpl: EmailTemplate | null) => {
      if (!tmpl) return;
      const vars = { firstName: firstNameOf(c?.name), company: c?.companyName };
      setSubject(fillMergeTags(tmpl.subject ?? "", vars));
      setBody(fillMergeTags(tmpl.body ?? "", vars));
    },
    [],
  );

  // Emailing from within an account is scoped to that account's people; the
  // person/general flow searches the whole CRM.
  const scoped = !!company;
  const accountPeople = useMemo(() => (contacts ?? []).filter((c) => c.email), [contacts]);

  // Global contact search — only in the unscoped (person/general) flow.
  useEffect(() => {
    if (scoped) {
      setResults([]);
      setSearching(false);
      return;
    }
    const term = query.trim();
    if (contact || term.length < 2) {
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
  }, [query, contact, scoped]);

  // Scoped flow: filter the account's people locally by the query.
  const scopedResults = useMemo(() => {
    if (!scoped) return [];
    const term = query.trim().toLowerCase();
    if (!term) return accountPeople.slice(0, 12);
    return accountPeople
      .filter((c) => [c.name, c.email, c.role].some((v) => v?.toLowerCase().includes(term)))
      .slice(0, 12);
  }, [scoped, accountPeople, query]);

  function pick(c: Contact) {
    setContact(c);
    setQuery("");
    setResults([]);
    setError("");
    fillFrom(c, activeTemplate);
  }

  function clearContact() {
    setContact(null);
    if (!template) {
      setSubject("");
      setBody("");
    }
  }

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const tmpl = templates?.find((t) => t.id === id) ?? null;
    if (tmpl) fillFrom(contact, tmpl);
    else {
      setSubject("");
      setBody("");
    }
  }

  const draft = useCallback(
    async (goalOverride?: string) => {
      if (!company) return;
      const goal = (goalOverride ?? angle).trim();
      setError("");
      setDrafting(true);
      try {
        const data = await api<{ subject: string; body: string }>("/api/ai/outreach", {
          method: "POST",
          body: JSON.stringify({ companyId: company.id, contactId: contact?.id, goal }),
        });
        if (data.subject) setSubject(data.subject);
        if (data.body) setBody(plainToHtml(data.body));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't draft that.");
      } finally {
        setDrafting(false);
      }
    },
    [company, contact, angle],
  );

  // Signal → draft: land on a ready email when opened with an angle.
  useEffect(() => {
    if (autoDraft && defaultAngle && company) draft(defaultAngle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function personalise() {
    if (!contact) return;
    setError("");
    setPersonalising(true);
    try {
      const data = await api<{ subject: string; body: string }>("/api/ai/personalise", {
        method: "POST",
        body: JSON.stringify({ contactId: contact.id, subject, body }),
      });
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
      toast.success("Personalised — review it before you send.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't personalise that.");
    } finally {
      setPersonalising(false);
    }
  }

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError("");
    const added: AdHocFile[] = [];
    for (const file of Array.from(list)) {
      try {
        added.push({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          base64: await fileToBase64(file),
          size: file.size,
        });
      } catch {
        setError(`Couldn't read "${file.name}".`);
      }
    }
    setFiles((prev) => {
      const next = [...prev, ...added];
      const total = next.reduce((s, f) => s + f.size, 0);
      if (total > MAX_TOTAL_ATTACH) {
        setError("Attachments come to more than 18 MB together — remove one or send a link instead.");
        return prev;
      }
      return next;
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  const connected = !!conn?.connected;
  const optedOut = contact?.marketingOptIn === "Opted Out";
  const canSend = connected && !!contact?.email && !!subject.trim() && !!htmlToText(body).trim() && !sending;

  async function send() {
    if (!contact?.email || !canSend) return;
    setError("");
    setSending(true);
    try {
      await api<{ ok: boolean }>("/api/email/send-template", {
        method: "POST",
        body: JSON.stringify({
          to: contact.email,
          subject,
          html: body,
          contactId: contact.id,
          companyId: contact.companyId ?? company?.id,
          templateId: templateId || undefined,
          attachments: files.map((f) => ({ filename: f.filename, contentType: f.contentType, base64: f.base64 })),
        }),
      });
      setSentTo(contact.email);
      await onSent?.();
      setTimeout(onClose, 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send";
      setError(msg);
      if (/connect/i.test(msg)) setConn((c) => (c ? { ...c, connected: false } : c));
    } finally {
      setSending(false);
    }
  }

  if (typeof document === "undefined") return null;

  const title = template ? `Send · ${template.name || "template"}` : `Email${company ? ` · ${company.name}` : ""}`;
  const querying = query.trim().length >= 2;
  const searchResults = scoped ? scopedResults : querying ? results : [];
  const showResults = !contact && (scoped || querying);

  return createPortal(
    <div
      className="luna-fade fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,18,32,0.6)] p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="luna-pop shadow-float relative flex h-[90vh] max-h-[920px] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-6 py-3.5">
          <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </IconButton>
        </div>

        {sentTo ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/12 text-success">
              <CheckCircle2 size={26} strokeWidth={1.9} />
            </span>
            <p className="text-[15px] font-medium text-fg">Email sent to {sentTo}</p>
            <p className="mt-1 text-[13px] text-fg-subtle">
              It&apos;s logged on the timeline and sitting in your Gmail Sent.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {/* Recipient */}
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">To</span>
                {contact ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-fg">
                        {contact.name}
                        {contact.role ? <span className="text-fg-subtle"> · {contact.role}</span> : null}
                      </p>
                      <p className="truncate text-[12.5px] text-fg-subtle">
                        {contact.email || "No email on this contact"}
                        {contact.companyName ? ` · ${contact.companyName}` : ""}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={clearContact}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                      <Search size={15} strokeWidth={1.75} />
                    </div>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                      placeholder={
                        scoped ? `Search ${company!.name}'s people…` : "Search a contact by name, company or email…"
                      }
                      className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-[14px] text-fg placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    {showResults ? (
                      <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-float">
                        {!scoped && querying && searching ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-fg-subtle">
                            <Spinner /> Searching…
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div className="px-3 py-3 text-[13px] text-fg-subtle">
                            {scoped
                              ? accountPeople.length === 0
                                ? "No people on this account yet — add one from the account page."
                                : "No one here matches."
                              : "No contacts match."}
                          </div>
                        ) : (
                          <ul className="py-1">
                            {scoped ? (
                              <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                                People at {company!.name}
                              </li>
                            ) : null}
                            {searchResults.map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() => pick(c)}
                                  disabled={!c.email}
                                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface disabled:cursor-not-allowed disabled:opacity-55"
                                >
                                  <span className="text-[13.5px] font-medium text-fg">
                                    {c.name}
                                    {c.role ? <span className="text-fg-subtle"> · {c.role}</span> : null}
                                  </span>
                                  <span className="text-[12px] text-fg-subtle">
                                    {c.email || "No email"}
                                    {c.companyName ? ` · ${c.companyName}` : ""}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Template picker (company/contact flow) */}
              {showPicker ? (
                <Field
                  label="Start from a template"
                  hint={pickable.length === 0 ? "No templates yet — write a blank email, or create one under Email templates." : undefined}
                >
                  <Select value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
                    <option value="">Blank email</option>
                    {pickable.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              {optedOut ? (
                <InlineAlert variant="info">
                  {contact?.name?.split(" ")[0] || "This contact"} is marked <strong>Opted out</strong> of marketing.
                  Only send a genuine 1:1 email, never a promotional one.
                </InlineAlert>
              ) : null}

              {/* Draft with Luna (from an angle) — needs an account for context. */}
              {company ? (
                <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-accent-strong">
                    <Sparkles size={13} strokeWidth={2} /> Draft with Luna
                  </p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        value={angle}
                        onChange={(e) => setAngle(e.target.value)}
                        placeholder="What's it about? e.g. introduce the AI visibility tool"
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => draft()} disabled={drafting || !angle.trim()}>
                      {drafting ? <Spinner /> : <Sparkles size={15} strokeWidth={1.9} />} Draft
                    </Button>
                  </div>
                </div>
              ) : null}

              <Field label="Subject">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short, plain subject" />
              </Field>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-fg-muted">Message</span>
                  <div className="flex items-center gap-3">
                    {meetingCfg && meetingConfigReady(meetingCfg) ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMeetingMenu((v) => !v)}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-strong hover:underline"
                        >
                          <CalendarClock size={13} strokeWidth={2} /> Insert meeting
                        </button>
                        {meetingMenu ? (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMeetingMenu(false)} aria-hidden />
                            <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-float">
                              {meetingCfg.options.map((o) => (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => insertMeeting(o)}
                                  className="block w-full px-3 py-2 text-left transition-colors hover:bg-muted"
                                >
                                  <span className="block text-[13px] font-medium text-fg">{o.label}</span>
                                  <span className="block text-[11.5px] text-fg-subtle">
                                    {o.mins ? `${o.mins} min · ` : ""}booking link
                                  </span>
                                </button>
                              ))}
                              <Link
                                href="/meetings"
                                className="block border-t border-border-soft px-3 py-2 text-[12px] text-fg-subtle hover:bg-muted hover:text-fg"
                              >
                                Manage meeting links →
                              </Link>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {contact ? (
                      <button
                        type="button"
                        onClick={personalise}
                        disabled={personalising}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-strong hover:underline disabled:opacity-50"
                      >
                        {personalising ? <Spinner /> : <Sparkles size={13} strokeWidth={2} />} Personalise for {firstNameOf(contact.name) || "them"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <RichTextEditor ref={editorRef} value={body} onChange={setBody} minHeight={300} />
              </div>

              {/* Attachments — from the template (tracked links) + ad-hoc uploads */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-fg-muted">Attachments</span>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-strong hover:underline"
                  >
                    <Upload size={13} strokeWidth={2} /> Add files
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>
                {attachments.length === 0 && files.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-surface/50 px-3 py-2.5 text-[12.5px] text-fg-subtle">
                    No attachments. Pick a template to include its files, or add your own.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {attachments.map((a) => (
                      <li
                        key={a.id ?? a.filename}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2"
                      >
                        <Paperclip size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{a.filename}</span>
                        <span className="shrink-0 text-[11px] text-accent-strong">tracked link</span>
                        {a.size ? <span className="tnum shrink-0 text-[12px] text-fg-subtle">{formatBytes(a.size)}</span> : null}
                      </li>
                    ))}
                    {files.map((f, i) => (
                      <li
                        key={`adhoc-${i}`}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2"
                      >
                        <Paperclip size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{f.filename}</span>
                        <span className="shrink-0 text-[11px] text-accent-strong">
                          {f.size > 4.5 * 1024 * 1024 ? "attached" : "tracked link"}
                        </span>
                        {f.size ? <span className="tnum shrink-0 text-[12px] text-fg-subtle">{formatBytes(f.size)}</span> : null}
                        <IconButton label={`Remove ${f.filename}`} onClick={() => removeFile(i)}>
                          <X size={14} strokeWidth={2} />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

              {conn && !connected ? (
                <InlineAlert variant="info">
                  {conn.configured ? "Gmail isn't connected yet." : "Gmail sending isn't set up yet."}{" "}
                  <Link href="/settings" className="font-medium underline" onClick={onClose}>
                    Open Settings
                  </Link>{" "}
                  to connect and send from here.
                </InlineAlert>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-surface px-6 py-3.5">
              <p className="text-[12px] text-fg-subtle">
                {connected && conn?.email ? `Sends as ${conn.email}` : "Never sends on its own — you send."}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                {connected ? (
                  <Button type="button" onClick={send} disabled={!canSend}>
                    {sending ? <Spinner /> : <Send size={15} strokeWidth={1.75} />} Send email
                  </Button>
                ) : (
                  <Link href="/settings" onClick={onClose}>
                    <Button type="button">
                      <Plug size={15} strokeWidth={1.75} /> Connect Gmail
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
