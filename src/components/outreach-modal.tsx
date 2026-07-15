"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Plug, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Field, InlineAlert, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";

type ContactOption = { id: string; name: string; email?: string; role?: string };
type Conn = { configured: boolean; connected: boolean; email?: string };

export function OutreachModal({
  open,
  onClose,
  company,
  contacts,
  defaultContactId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  company: { id: string; name: string };
  contacts: ContactOption[];
  defaultContactId?: string;
  onSent?: () => void | Promise<void>;
}) {
  const [contactId, setContactId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [angle, setAngle] = useState("");

  const [conn, setConn] = useState<Conn | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = defaultContactId ?? contacts[0]?.id ?? "";
    setContactId(first);
    setTo(contacts.find((c) => c.id === first)?.email ?? "");
    setAngle("");
    setSubject("");
    setBody("");
    setError("");
    setSentTo("");
    setCopied(false);
    setConn(null);
    api<Conn>("/api/google/status")
      .then(setConn)
      .catch(() => setConn({ configured: false, connected: false }));
    // Reset only when the dialog opens or the target contact changes — not on every
    // parent re-render (contacts is a fresh array each time), so a draft isn't wiped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultContactId]);

  function pickContact(id: string) {
    setContactId(id);
    const email = contacts.find((c) => c.id === id)?.email;
    if (email !== undefined) setTo(email ?? "");
  }

  async function draft() {
    setError("");
    setDrafting(true);
    try {
      const data = await api<{ subject: string; body: string }>("/api/ai/outreach", {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, contactId, goal: angle }),
      });
      setSubject(data.subject);
      setBody(data.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft the email");
    } finally {
      setDrafting(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const validEmail = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(to.trim());
  const canSend = validEmail && subject.trim() && body.trim() && !sending;

  async function send() {
    if (!canSend) return;
    setError("");
    setSending(true);
    try {
      await api<{ ok: boolean }>("/api/email/send", {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, contactId: contactId || undefined, to: to.trim(), subject, body }),
      });
      setSentTo(to.trim());
      await onSent?.();
      setTimeout(onClose, 1100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send";
      setError(msg);
      // If the token dropped, reflect the disconnected state so the UI adapts.
      if (/connect/i.test(msg)) setConn((c) => (c ? { ...c, connected: false } : c));
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <Modal open={open} onClose={onClose} title="Sent">
        <div className="flex flex-col items-center py-6 text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/12 text-success">
            <CheckCircle2 size={26} strokeWidth={1.9} />
          </span>
          <p className="text-[15px] font-medium text-fg">Email sent to {sentTo}</p>
          <p className="mt-1 text-[13px] text-fg-subtle">It&apos;s logged on the timeline and sitting in your Gmail Sent.</p>
        </div>
      </Modal>
    );
  }

  const connected = !!conn?.connected;

  return (
    <Modal open={open} onClose={onClose} title={`Email · ${company.name}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {contacts.length > 0 ? (
            <Field label="Contact">
              <Select value={contactId} onChange={(e) => pickContact(e.target.value)}>
                <option value="">Someone else…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role ? ` · ${c.role}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="To">
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Angle (optional)" hint="What's it about? Luna uses this to draft.">
              <Input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="e.g. introduce the AI visibility tool" />
            </Field>
          </div>
          <Button type="button" variant="secondary" onClick={draft} disabled={drafting}>
            {drafting ? <Spinner /> : <Sparkles size={15} strokeWidth={1.75} />} Draft with Luna
          </Button>
        </div>

        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short, plain subject" />
        </Field>
        <Field label="Message">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-52" placeholder="Write your email, or let Luna draft it above." />
        </Field>

        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

        {conn && !connected ? (
          <InlineAlert variant="info">
            {conn.configured
              ? "Gmail isn't connected yet."
              : "Gmail sending isn't set up yet."}{" "}
            <Link href="/settings" className="font-medium underline" onClick={onClose}>
              Open Settings
            </Link>{" "}
            to connect and send from here.
          </InlineAlert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[12px] text-fg-subtle">
            {connected && conn?.email ? `Sends as ${conn.email}` : "Never sends on its own — you send."}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={copy} disabled={!subject && !body}>
              <Copy size={15} strokeWidth={1.75} /> {copied ? "Copied" : "Copy"}
            </Button>
            {connected ? (
              <Button type="button" onClick={send} disabled={!canSend}>
                {sending ? <Spinner /> : <Send size={15} strokeWidth={1.75} />} Send
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
      </div>
    </Modal>
  );
}
