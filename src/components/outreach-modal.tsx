"use client";

import { useEffect, useState } from "react";
import { Copy, Mail, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { Button, ErrorText, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";

type ContactOption = { id: string; name: string; email?: string; role?: string };

export function OutreachModal({
  open,
  onClose,
  company,
  contacts,
  defaultContactId,
}: {
  open: boolean;
  onClose: () => void;
  company: { id: string; name: string };
  contacts: ContactOption[];
  defaultContactId?: string;
}) {
  const [contactId, setContactId] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setContactId(defaultContactId ?? contacts[0]?.id ?? "");
      setGoal("");
      setError("");
      setSubject("");
      setBody("");
      setGenerated(false);
      setCopied(false);
    }
  }, [open, contacts, defaultContactId]);

  async function generate() {
    setError("");
    setLoading(true);
    try {
      const data = await api<{ subject: string; body: string }>("/api/ai/outreach", {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, contactId, goal }),
      });
      setSubject(data.subject);
      setBody(data.body);
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft the email");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openGmail() {
    const to = contacts.find((c) => c.id === contactId)?.email ?? "";
    const url =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      (to ? `&to=${encodeURIComponent(to)}` : "") +
      `&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Modal open={open} onClose={onClose} title={`Draft outreach · ${company.name}`}>
      {!generated ? (
        <div className="space-y-4">
          {contacts.length > 0 ? (
            <Field label="To">
              <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">No specific person</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role ? ` · ${c.role}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Angle (optional)" hint="What's this email about? e.g. introduce the AI visibility tool.">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Leave blank for a sensible default"
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={generate} disabled={loading}>
              {loading ? <Spinner /> : <Sparkles size={15} strokeWidth={1.75} />} Draft email
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Body">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-56"
            />
          </Field>
          <p className="text-[12px] text-fg-subtle">
            Edit anything before you send. Luna Desk never sends on your behalf.
          </p>
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setGenerated(false)}>
              Back
            </Button>
            <Button type="button" variant="secondary" onClick={copy}>
              <Copy size={15} strokeWidth={1.75} /> {copied ? "Copied" : "Copy"}
            </Button>
            <Button onClick={openGmail}>
              <Mail size={15} strokeWidth={1.75} /> Open in Gmail
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
