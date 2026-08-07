"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, Paperclip, Pencil, Plus, SearchX, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { EmailTemplate } from "@/lib/crm/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
} from "@/components/ui";
import { ListSearchField } from "@/components/list-kit";
import { useConfirm, useToast } from "@/components/feedback";

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
                  {t.body}
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

      <TemplateEditor
        open={creating || !!editing}
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
    </div>
  );
}

function TemplateEditor({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!template;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  // Seed the form whenever the modal opens (for a new template or a chosen one).
  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
    setPrompt("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id]);

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
      if (data.body) setBody(data.body);
      toast.success("Drafted — edit anything before you save.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft that.");
    } finally {
      setDrafting(false);
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
      if (isEdit && template) {
        await api(`/api/templates/${template.id}`, { method: "PATCH", body: payload });
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

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit template" : "New template"}>
      <div className="space-y-4">
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
        <Field label="Body" hint="Use {{first_name}} and {{company}} to personalise at send.">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder={"Hi {{first_name}},\n\n…"}
          />
        </Field>

        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

        <div className="-mx-6 flex justify-end gap-2 border-t border-border-soft bg-surface px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
