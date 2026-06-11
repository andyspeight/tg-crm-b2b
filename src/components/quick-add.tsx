"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { api } from "@/lib/client";
import type { Company } from "@/lib/crm/types";
import type { EnrichedCompanyData, EnrichedContactData } from "@/lib/intel/types";
import {
  Button,
  ErrorText,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
  cn,
} from "@/components/ui";

type Option = { id: string; name: string };
type Mode = "task" | "note" | "linkedin";

const TABS: { id: Mode; label: string }[] = [
  { id: "task", label: "Task" },
  { id: "note", label: "Note" },
  { id: "linkedin", label: "LinkedIn" },
];

export function QuickAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("task");
  const [companies, setCompanies] = useState<Option[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskCompany, setTaskCompany] = useState("");

  const [noteCompany, setNoteCompany] = useState("");
  const [noteSummary, setNoteSummary] = useState("");
  const [noteBody, setNoteBody] = useState("");

  async function openModal() {
    setOpen(true);
    setError("");
    if (!loaded) {
      try {
        const data = await api<{ companies: Company[] }>("/api/companies");
        setCompanies(data.companies.map((c) => ({ id: c.id, name: c.name })));
        setLoaded(true);
      } catch {
        /* picker just stays empty */
      }
    }
  }

  function close() {
    setOpen(false);
    setMode("task");
    setTaskTitle("");
    setTaskDue("");
    setTaskCompany("");
    setNoteCompany("");
    setNoteSummary("");
    setNoteBody("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "task") {
        if (!taskTitle.trim()) {
          setError("Task title is required");
          setSaving(false);
          return;
        }
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title: taskTitle, dueDate: taskDue, companyId: taskCompany }),
        });
      } else {
        if (!noteCompany) {
          setError("Pick a company for the note");
          setSaving(false);
          return;
        }
        if (!noteSummary.trim()) {
          setError("Summary is required");
          setSaving(false);
          return;
        }
        await api("/api/activities", {
          method: "POST",
          body: JSON.stringify({
            type: "Note",
            summary: noteSummary,
            rawContent: noteBody,
            companyId: noteCompany,
          }),
        });
      }
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <>
      <IconButton label="Quick add" onClick={openModal}>
        <Plus size={18} strokeWidth={1.75} />
      </IconButton>
      <Modal open={open} onClose={close} title="Quick add">
        <div className="mb-4 inline-flex rounded-lg border border-border p-0.5 text-[13px]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setError("");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                mode === t.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === "linkedin" ? (
          <LinkedInImport onDone={close} onCancel={close} />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === "task" ? (
              <>
                <Field label="Title">
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    autoFocus
                    placeholder="Follow up with Coastline"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Due date">
                    <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                  </Field>
                  <Field label="Company (optional)">
                    <CompanySelect value={taskCompany} onChange={setTaskCompany} companies={companies} allowNone />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Company">
                  <CompanySelect value={noteCompany} onChange={setNoteCompany} companies={companies} />
                </Field>
                <Field label="Summary">
                  <Input
                    value={noteSummary}
                    onChange={(e) => setNoteSummary(e.target.value)}
                    autoFocus
                    placeholder="Quick note"
                  />
                </Field>
                <Field label="Notes">
                  <Textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Paste-dump is fine."
                  />
                </Field>
              </>
            )}
            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function CompanySelect({
  value,
  onChange,
  companies,
  allowNone,
}: {
  value: string;
  onChange: (v: string) => void;
  companies: Option[];
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allowNone ? "No company" : "Select a company"}</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

// --- LinkedIn paste-import ---------------------------------------------------

type LookupResult = {
  kind: "profile" | "company";
  profile?: EnrichedContactData;
  company?: EnrichedCompanyData;
  existingContactId?: string | null;
  existingCompanyId?: string | null;
  companyMatch?: { id: string; name: string } | null;
};

function LinkedInImport({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!url.trim()) return;
    setLoading(true);
    try {
      const data = await api<LookupResult>("/api/intel/linkedin", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function goTo(href: string) {
    onDone();
    router.push(href);
    router.refresh();
  }

  async function create() {
    if (!result) return;
    setCreating(true);
    setError("");
    const now = new Date().toISOString();
    try {
      let companyId = "";
      if (result.kind === "company" && result.company) {
        const c = result.company;
        const res = await api<{ company: { id: string } }>("/api/companies", {
          method: "POST",
          body: JSON.stringify({
            name: c.name,
            website: c.website,
            description: c.description,
            sizeBand: c.sizeBand,
            country: c.country,
            linkedin: c.linkedin,
            lifecycleStage: "Prospect",
            enrichmentSource: "LinkedIn import",
            enrichedAt: now,
          }),
        });
        companyId = res.company.id;
      } else if (result.kind === "profile" && result.profile) {
        const p = result.profile;
        if (result.companyMatch) {
          companyId = result.companyMatch.id;
        } else if (p.companyName) {
          const res = await api<{ company: { id: string } }>("/api/companies", {
            method: "POST",
            body: JSON.stringify({
              name: p.companyName,
              linkedin: p.companyLinkedin,
              lifecycleStage: "Prospect",
              enrichmentSource: "LinkedIn import",
              enrichedAt: now,
            }),
          });
          companyId = res.company.id;
        }
        await api("/api/contacts", {
          method: "POST",
          body: JSON.stringify({
            name: p.name,
            role: p.role,
            headline: p.headline,
            location: p.location,
            linkedin: p.linkedin,
            notes: p.notes,
            source: "LinkedIn import",
            enrichedAt: now,
            companyId,
          }),
        });
      }
      goTo(companyId ? `/companies/${companyId}` : "/contacts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the record");
      setCreating(false);
    }
  }

  const existingId =
    result?.kind === "company" ? result.existingCompanyId : result?.companyMatch?.id ?? null;
  const alreadyContact = result?.kind === "profile" && !!result.existingContactId;

  return (
    <div className="space-y-4">
      <form onSubmit={lookup} className="space-y-2">
        <Field
          label="LinkedIn URL"
          hint="A profile (/in/...) or company (/company/...) URL. Lookups can take up to a minute."
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            placeholder="https://www.linkedin.com/company/..."
          />
        </Field>
        {loading ? (
          <p className="flex items-center gap-2 text-[13px] text-fg-subtle">
            <Spinner /> Fetching from LinkedIn, this can take up to a minute...
          </p>
        ) : null}
      </form>

      {result ? (
        <div className="rounded-lg border border-border bg-surface p-3">
          {result.kind === "company" && result.company ? (
            <PreviewRows
              rows={[
                ["Company", result.company.name],
                ["Website", result.company.website],
                ["Country", result.company.country],
                ["Size", result.company.sizeBand],
                ["About", result.company.description?.slice(0, 200)],
              ]}
            />
          ) : null}
          {result.kind === "profile" && result.profile ? (
            <PreviewRows
              rows={[
                ["Name", result.profile.name],
                ["Role", result.profile.role],
                ["Company", result.profile.companyName],
                ["Location", result.profile.location],
              ]}
            />
          ) : null}

          {alreadyContact ? (
            <p className="mt-2 text-[13px] text-warning">This person is already a contact.</p>
          ) : existingId ? (
            <p className="mt-2 text-[13px] text-warning">Already in Luna Desk.</p>
          ) : null}
        </div>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {existingId ? (
          <Button type="button" onClick={() => goTo(`/companies/${existingId}`)}>
            <ExternalLink size={15} strokeWidth={1.75} /> Open existing
          </Button>
        ) : result && !alreadyContact ? (
          <Button type="button" onClick={create} disabled={creating}>
            {creating ? <Spinner /> : <Plus size={15} strokeWidth={2} />}{" "}
            {result.kind === "company" ? "Create company" : "Create contact"}
          </Button>
        ) : (
          <Button type="button" onClick={lookup} disabled={loading || !url.trim()}>
            {loading ? <Spinner /> : null} Look up
          </Button>
        )}
      </div>
    </div>
  );
}

function PreviewRows({ rows }: { rows: [string, string | undefined][] }) {
  return (
    <dl className="space-y-1">
      {rows
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label} className="flex gap-3 text-[13px]">
            <dt className="w-20 shrink-0 text-fg-subtle">{label}</dt>
            <dd className="min-w-0 flex-1 text-fg">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
