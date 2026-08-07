"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Mail, Paperclip, Pencil, Plus, SearchX, Sparkles, Trash2, Upload, X } from "lucide-react";
import { api } from "@/lib/client";
import type { EmailAttachment, EmailTemplate } from "@/lib/crm/types";
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
