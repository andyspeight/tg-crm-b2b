"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Mail,
  Paperclip,
  Pencil,
  Plug,
  Plus,
  Search,
  SearchX,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Contact, EmailAttachment, EmailTemplate } from "@/lib/crm/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { ListSearchField } from "@/components/list-kit";
import { RichTextEditor, htmlToText, plainToHtml } from "@/components/rich-text";
import { fillMergeTags, firstNameOf } from "@/lib/email/merge";
import { useConfirm, useToast } from "@/components/feedback";

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

export function TemplatesView({ initial }: { initial: EmailTemplate[] }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initial);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<EmailTemplate | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  async function refresh() {
    const data = await api<{ templates: EmailTemplate[] }>("/api/templates");
    setTemplates(data.templates);
  }

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((t) =>
      [t.name, t.subject, t.body, t.description]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(term)),
    );
  }, [templates, q]);

  async function duplicate(t: EmailTemplate) {
    try {
      await api("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          name: `${t.name} (copy)`,
          subject: t.subject ?? "",
          body: t.body ?? "",
          description: t.description ?? "",
        }),
      });
      await refresh();
      toast.success("Template duplicated");
    } catch (e) {
      toast.error("Couldn't duplicate", { description: (e as Error).message });
    }
  }

  async function remove(t: EmailTemplate) {
    const ok = await confirm({
      title: `Delete "${t.name || "this template"}"?`,
      message: "This removes the template. Emails already sent are unaffected.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setTemplates((xs) => xs.filter((x) => x.id !== t.id));
    try {
      await api(`/api/templates/${t.id}`, { method: "DELETE" });
      toast.success(`${t.name || "Template"} deleted`);
    } catch (e) {
      toast.error("Couldn't delete", { description: (e as Error).message });
      await refresh();
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email templates"
        description={`${templates.length} ${templates.length === 1 ? "template" : "templates"} · reused for one-off sends and sequences`}
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <ListSearchField
              value={q}
              onChange={setQ}
              placeholder="Search templates…"
              label="Search templates"
            />
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2} /> New template
            </Button>
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={q ? <SearchX size={20} strokeWidth={1.75} /> : <Mail size={20} strokeWidth={1.75} />}
          title={q ? "No templates match your search" : "No templates yet"}
          hint={
            q
              ? "Try a different word from the name, subject or body."
              : "Create your first template — write it yourself or draft it with AI."
          }
          action={
            q ? (
              <Button variant="ghost" onClick={() => setQ("")}>
                Clear search
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} strokeWidth={2} /> New template
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <Card key={t.id} interactive onClick={() => setEditing(t)} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-fg">{t.name || "Untitled"}</p>
                  {t.subject ? (
                    <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">{t.subject}</p>
                  ) : (
                    <p className="mt-0.5 text-[12.5px] text-fg-subtle">No subject yet</p>
                  )}
                </div>
                <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 gap-0.5">
                  <IconButton label="Send to a contact" onClick={() => setSending(t)} className="hover:text-accent-strong">
                    <Send size={15} strokeWidth={1.75} />
                  </IconButton>
                  <IconButton label="Edit template" onClick={() => setEditing(t)}>
                    <Pencil size={15} strokeWidth={1.75} />
                  </IconButton>
                  <IconButton label="Duplicate template" onClick={() => duplicate(t)}>
                    <Copy size={15} strokeWidth={1.75} />
                  </IconButton>
                  <IconButton label="Delete template" onClick={() => remove(t)} className="hover:text-danger">
                    <Trash2 size={15} strokeWidth={1.75} />
                  </IconButton>
                </div>
              </div>
              {t.body ? (
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-subtle">
                  {htmlToText(t.body)}
                </p>
              ) : null}
              {t.attachments.length > 0 ? (
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-fg-subtle">
                  <Paperclip size={12} strokeWidth={1.75} /> {t.attachments.length} attachment
                  {t.attachments.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {creating || editing ? (
        <TemplateComposer
          template={editing}
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

      {sending ? <SendComposer template={sending} onClose={() => setSending(null)} /> : null}
    </div>
  );
}

function TemplateComposer({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [templateId, setTemplateId] = useState<string | null>(template?.id ?? null);
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [attachments, setAttachments] = useState<EmailAttachment[]>(template?.attachments ?? []);
  const [prompt, setPrompt] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const isEdit = !!template;

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function draft() {
    const p = prompt.trim();
    if (!p) return;
    setError("");
    setDrafting(true);
    try {
      const data = await api<{ subject: string; body: string }>("/api/ai/template", {
        method: "POST",
        body: JSON.stringify({ prompt: p }),
      });
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(plainToHtml(data.body));
      toast.success("Drafted — edit anything before you save.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft that.");
    } finally {
      setDrafting(false);
    }
  }

  // Attachments need a saved record, so create the template on first upload if new.
  async function ensureSaved(): Promise<string> {
    if (templateId) {
      await api(`/api/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description, subject, body }),
      });
      return templateId;
    }
    if (!name.trim()) throw new Error("Name the template before adding attachments.");
    const { template: created } = await api<{ template: EmailTemplate }>("/api/templates", {
      method: "POST",
      body: JSON.stringify({ name, description, subject, body }),
    });
    setTemplateId(created.id);
    return created.id;
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const id = await ensureSaved();
      let latest: EmailTemplate | null = null;
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const { template: updated } = await api<{ template: EmailTemplate }>(
          `/api/templates/${id}/attachments`,
          {
            method: "POST",
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || "application/octet-stream",
              base64,
            }),
          },
        );
        latest = updated;
      }
      if (latest) setAttachments(latest.attachments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't attach that file.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAttachment(att: EmailAttachment) {
    if (!templateId || !att.id) return;
    try {
      const { template: updated } = await api<{ template: EmailTemplate }>(
        `/api/templates/${templateId}/attachments?attachmentId=${encodeURIComponent(att.id)}`,
        { method: "DELETE" },
      );
      setAttachments(updated.attachments);
    } catch (e) {
      toast.error("Couldn't remove attachment", { description: (e as Error).message });
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("Give the template a name.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = JSON.stringify({ name, description, subject, body });
      if (templateId) {
        await api(`/api/templates/${templateId}`, { method: "PATCH", body: payload });
      } else {
        await api("/api/templates", { method: "POST", body: payload });
      }
      toast.success(isEdit ? "Template saved" : "Template created");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="luna-fade fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,18,32,0.6)] p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit template" : "New template"}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="luna-pop shadow-float relative flex h-[90vh] max-h-[920px] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-6 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-fg">
            {isEdit ? "Edit template" : "New template"}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Demo follow-up" />
            </Field>
            <Field label="When to use" hint="Optional — a note to your future self.">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="After a demo, no decision yet"
              />
            </Field>
          </div>

          {/* Draft with AI */}
          <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-3">
            <label htmlFor="tmpl-prompt" className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-strong">
              <Sparkles size={13} strokeWidth={2} /> Draft with AI
            </label>
            <p className="mt-0.5 text-[12px] text-fg-subtle">
              Describe the email; Luna writes a subject and body with {"{{first_name}}"} / {"{{company}}"} tags.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                id="tmpl-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    draft();
                  }
                }}
                placeholder="A friendly nudge after a demo with no reply for a week"
                className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-[14px] text-fg placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button type="button" variant="secondary" onClick={draft} disabled={drafting || !prompt.trim()}>
                {drafting ? <Spinner /> : <Sparkles size={15} strokeWidth={1.9} />} Draft
              </Button>
            </div>
          </div>

          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick thought after our demo" />
          </Field>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Body</span>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Hi {{first_name}}, …"
              minHeight={300}
            />
            <p className="mt-1 text-[12px] text-fg-subtle">
              Use {"{{first_name}}"} and {"{{company}}"} to personalise at send.
            </p>
          </div>

          {/* Attachments */}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Attachments</span>
            {attachments.length > 0 ? (
              <ul className="mb-2 space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id ?? a.filename}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <Paperclip size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-[13px] text-fg hover:text-accent-strong"
                    >
                      {a.filename}
                    </a>
                    {a.size ? <span className="tnum shrink-0 text-[12px] text-fg-subtle">{formatBytes(a.size)}</span> : null}
                    <IconButton label={`Remove ${a.filename}`} onClick={() => removeAttachment(a)} className="hover:text-danger">
                      <X size={15} strokeWidth={1.9} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : null}
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner /> : <Upload size={15} strokeWidth={1.75} />} Add file
            </Button>
            <span className="ml-2 text-[12px] text-fg-subtle">Up to ~3 MB each · sent with every email from this template.</span>
          </div>

          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border-soft bg-surface px-6 py-3.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Conn = { configured: boolean; connected: boolean; email?: string };

/**
 * Send one template to one CRM contact through the connected Gmail account.
 * Review-then-send: merge tags are filled the moment a contact is picked, the
 * user sees (and can edit) the real email, then clicks Send. Nothing leaves
 * until then. "Personalise with AI" rewrites the draft for that specific person.
 */
function SendComposer({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [personalising, setPersonalising] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const toast = useToast();

  // Esc closes; lock body scroll while open; check the Gmail connection once.
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

  // Debounced contact search (only while no contact is chosen yet).
  useEffect(() => {
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
  }, [query, contact]);

  const fillFor = useCallback(
    (c: Contact) => {
      const vars = { firstName: firstNameOf(c.name), company: c.companyName };
      setSubject(fillMergeTags(template.subject ?? "", vars));
      setBody(fillMergeTags(template.body ?? "", vars));
    },
    [template.subject, template.body],
  );

  function pick(c: Contact) {
    setContact(c);
    setQuery("");
    setResults([]);
    setError("");
    fillFor(c);
  }

  function clearContact() {
    setContact(null);
    setSubject("");
    setBody("");
  }

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

  const connected = !!conn?.connected;
  const optedOut = contact?.marketingOptIn === "Opted Out";
  const canSend =
    connected && !!contact?.email && !!subject.trim() && !!htmlToText(body).trim() && !sending;

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
          companyId: contact.companyId,
          templateId: template.id,
        }),
      });
      setSentTo(contact.email);
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

  return createPortal(
    <div
      className="luna-fade fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,18,32,0.6)] p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Send ${template.name}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="luna-pop shadow-float relative flex h-[90vh] max-h-[920px] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-6 py-3.5">
          <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-fg">
            Send · {template.name || "template"}
          </h2>
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
                            {results.map((c) => (
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

              {optedOut ? (
                <InlineAlert variant="info">
                  {contact?.name?.split(" ")[0] || "This contact"} is marked <strong>Opted out</strong> of marketing.
                  Only send a genuine 1:1 email, never a promotional one.
                </InlineAlert>
              ) : null}

              {/* Personalise with AI */}
              <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-strong">
                      <Sparkles size={13} strokeWidth={2} /> Personalise with AI
                    </p>
                    <p className="mt-0.5 text-[12px] text-fg-subtle">
                      {contact
                        ? "Luna tailors this email to this person using their CRM details. Review before sending."
                        : "Pick a contact first, then Luna can tailor the email to them."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={personalise}
                    disabled={!contact || personalising}
                  >
                    {personalising ? <Spinner /> : <Sparkles size={15} strokeWidth={1.9} />} Personalise
                  </Button>
                </div>
              </div>

              <Field label="Subject">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={contact ? "Subject" : "Pick a contact to fill the template"}
                  disabled={!contact}
                />
              </Field>

              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Message</span>
                {contact ? (
                  <RichTextEditor value={body} onChange={setBody} minHeight={300} />
                ) : (
                  <div className="grid min-h-[300px] place-items-center rounded-xl border border-dashed border-border bg-surface/50 text-[13px] text-fg-subtle">
                    Pick a contact and the template fills in here — merge tags and all.
                  </div>
                )}
              </div>

              {/* Attachments (from the template, sent as-is) */}
              {template.attachments.length > 0 ? (
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">Attachments</span>
                  <ul className="space-y-1.5">
                    {template.attachments.map((a) => (
                      <li
                        key={a.id ?? a.filename}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2"
                      >
                        <Paperclip size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{a.filename}</span>
                        {a.size ? (
                          <span className="tnum shrink-0 text-[12px] text-fg-subtle">{formatBytes(a.size)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
