"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/client";
import type { Company } from "@/lib/crm/types";
import {
  Button,
  ErrorText,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Textarea,
  cn,
} from "@/components/ui";

type Option = { id: string; name: string };

export function QuickAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"task" | "note">("task");
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
          {(["task", "note"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium capitalize transition-colors",
                mode === m ? "bg-muted text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {m}
            </button>
          ))}
        </div>

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
