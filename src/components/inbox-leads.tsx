"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail, Plus, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/client";
import {
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  Input,
  Monogram,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { useToast } from "@/components/feedback";
import { formatDate } from "@/lib/format";

type Candidate = {
  email: string;
  name: string;
  company: string;
  domain: string;
  count: number;
  lastEmailedAt: string;
};
type ScanResult = { ran: boolean; reason?: string; scanned: number; candidates: Candidate[] };

/**
 * Inbox leads — people the user has emailed who aren't in the CRM yet. Scans
 * Sent mail on open, and lets each candidate be added as a lead (one tap) or
 * dismissed. Nothing is written until the user acts, so the inbox's noise never
 * turns into junk records.
 */
export function InboxLeads() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState(0);
  const [rows, setRows] = useState<Candidate[]>([]);
  const [companyEdits, setCompanyEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const toast = useToast();

  async function scan() {
    setState("loading");
    setError("");
    setReason("");
    try {
      const r = await api<ScanResult>("/api/leads/inbox");
      setRows(r.candidates ?? []);
      setScanned(r.scanned ?? 0);
      setCompanyEdits(Object.fromEntries((r.candidates ?? []).map((c) => [c.email, c.company])));
      if (!r.ran && r.reason) setReason(r.reason);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't scan your inbox.");
      setState("error");
    }
  }

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setRowBusy(email: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(email);
      else next.delete(email);
      return next;
    });
  }
  const removeRow = (email: string) => setRows((prev) => prev.filter((c) => c.email !== email));

  async function addLead(c: Candidate) {
    setRowBusy(c.email, true);
    try {
      await api("/api/leads/inbox", {
        method: "POST",
        body: JSON.stringify({
          action: "add",
          email: c.email,
          name: c.name,
          company: (companyEdits[c.email] ?? "").trim(),
        }),
      });
      removeRow(c.email);
      toast.success(`${c.name || c.email} added as a lead`);
    } catch (e) {
      toast.error("Couldn't add lead", { description: (e as Error).message });
    } finally {
      setRowBusy(c.email, false);
    }
  }

  async function dismiss(c: Candidate) {
    setRowBusy(c.email, true);
    try {
      await api("/api/leads/inbox", {
        method: "POST",
        body: JSON.stringify({ action: "dismiss", email: c.email }),
      });
      removeRow(c.email);
    } catch (e) {
      toast.error("Couldn't dismiss", { description: (e as Error).message });
    } finally {
      setRowBusy(c.email, false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inbox leads"
        description="People you've emailed who aren't in Luna Desk yet — add the real leads, dismiss the rest."
        actions={
          <Button variant="secondary" onClick={scan} disabled={state === "loading"}>
            {state === "loading" ? <Spinner /> : <RefreshCw size={16} strokeWidth={1.75} />} Rescan
          </Button>
        }
      />

      {reason ? (
        <div className="mt-4">
          <InlineAlert variant="info">
            {reason} <Link href="/settings" className="font-medium underline">Open Settings</Link>
          </InlineAlert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <InlineAlert variant="danger">{error}</InlineAlert>
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-fg-subtle">
          <Spinner /> Scanning your Sent mail — this can take a few seconds…
        </div>
      ) : state === "ready" && rows.length === 0 && !reason ? (
        <div className="mt-6">
          <EmptyState
            title="You're all caught up"
            hint={`Scanned ${scanned} sent ${scanned === 1 ? "email" : "emails"} — everyone you've emailed is already in Luna Desk (or dismissed).`}
          />
        </div>
      ) : rows.length > 0 ? (
        <>
          <ul className="mt-4 space-y-2">
            {rows.map((c) => {
              const b = busy.has(c.email);
              return (
                <li
                  key={c.email}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                >
                  <Monogram name={c.name || c.email} size="sm" tone="accent" />
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="truncate text-[14px] font-medium text-fg">{c.name || c.email}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Mail size={12} strokeWidth={1.9} /> {c.email}
                      </span>
                      <span className="tnum">· emailed {c.count}×</span>
                      {c.lastEmailedAt ? <span className="tnum">· last {formatDate(c.lastEmailedAt)}</span> : null}
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <Input
                      value={companyEdits[c.email] ?? ""}
                      onChange={(e) => setCompanyEdits((prev) => ({ ...prev, [c.email]: e.target.value }))}
                      placeholder="Company (optional)"
                      aria-label={`Company for ${c.name || c.email}`}
                      className="h-9 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={() => addLead(c)} disabled={b}>
                      {b ? <Spinner /> : <Plus size={15} strokeWidth={2} />} Add lead
                    </Button>
                    <IconButton
                      label={`Dismiss ${c.name || c.email}`}
                      onClick={() => dismiss(c)}
                      disabled={b}
                      className="hover:text-danger"
                    >
                      <X size={16} strokeWidth={1.9} />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 px-1 text-[12px] text-fg-subtle">
            Showing {rows.length} from {scanned} sent emails. Nothing is added until you tap “Add lead”, and
            dismissed people won’t come back.
          </p>
        </>
      ) : null}
    </div>
  );
}
