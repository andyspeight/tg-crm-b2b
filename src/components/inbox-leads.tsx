"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Mail, Plus, RefreshCw, Search, UserPlus, X } from "lucide-react";
import { api } from "@/lib/client";
import {
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  Input,
  Modal,
  Monogram,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { LifecycleBadge } from "@/components/badges";
import { useToast } from "@/components/feedback";
import { formatDate } from "@/lib/format";
import type { Company } from "@/lib/crm/types";

type Candidate = {
  email: string;
  name: string;
  company: string;
  domain: string;
  count: number;
  lastEmailedAt: string;
};
type ScanResult = { ran: boolean; reason?: string; scanned: number; candidates: Candidate[] };
type AddExtra = { as?: "lead" | "customer"; company?: string; companyId?: string };

/**
 * Inbox leads — people the user has emailed who aren't in the CRM yet. Scans
 * Sent mail on open; each candidate can be added as a lead or a customer, or
 * linked to an existing account. Nothing is written until the user acts.
 */
export function InboxLeads() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState(0);
  const [rows, setRows] = useState<Candidate[]>([]);
  const [companyEdits, setCompanyEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [linkFor, setLinkFor] = useState<Candidate | null>(null);
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
    // Company list powers the "Link to company" picker — load once, quietly.
    api<{ companies: Company[] }>("/api/companies")
      .then((d) => setCompanies(d.companies ?? []))
      .catch(() => {});
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

  async function add(c: Candidate, extra: AddExtra, done: string) {
    setRowBusy(c.email, true);
    try {
      await api("/api/leads/inbox", {
        method: "POST",
        body: JSON.stringify({ action: "add", email: c.email, name: c.name, ...extra }),
      });
      removeRow(c.email);
      setLinkFor(null);
      toast.success(done);
    } catch (e) {
      toast.error("Couldn't add", { description: (e as Error).message });
    } finally {
      setRowBusy(c.email, false);
    }
  }

  const who = (c: Candidate) => c.name || c.email;
  const addLead = (c: Candidate) =>
    add(c, { as: "lead", company: (companyEdits[c.email] ?? "").trim() }, `${who(c)} added as a lead`);
  const addCustomer = (c: Candidate) =>
    add(c, { as: "customer", company: (companyEdits[c.email] ?? "").trim() }, `${who(c)} added as a customer`);
  const linkCompany = (c: Candidate, company: Company) =>
    add(c, { companyId: company.id }, `${who(c)} linked to ${company.name}`);

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
        description="People you've emailed who aren't in Luna Desk yet — add them as a lead or a customer, link them to an existing account, or dismiss."
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
                  className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border border-border bg-card p-3 shadow-card"
                >
                  <Monogram name={who(c)} size="sm" tone="accent" />
                  <div className="min-w-0 flex-1 basis-52">
                    <div className="truncate text-[14px] font-medium text-fg">{who(c)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Mail size={12} strokeWidth={1.9} /> {c.email}
                      </span>
                      <span className="tnum">· emailed {c.count}×</span>
                      {c.lastEmailedAt ? <span className="tnum">· last {formatDate(c.lastEmailedAt)}</span> : null}
                    </div>
                  </div>
                  <div className="w-full sm:w-44">
                    <Input
                      value={companyEdits[c.email] ?? ""}
                      onChange={(e) => setCompanyEdits((prev) => ({ ...prev, [c.email]: e.target.value }))}
                      placeholder="New company (optional)"
                      aria-label={`Company for ${who(c)}`}
                      className="h-9 text-[13px]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" onClick={() => addLead(c)} disabled={b}>
                      {b ? <Spinner /> : <Plus size={15} strokeWidth={2} />} Lead
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => addCustomer(c)} disabled={b}>
                      <UserPlus size={15} strokeWidth={1.9} /> Customer
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setLinkFor(c)} disabled={b}>
                      <Building2 size={15} strokeWidth={1.9} /> Link
                    </Button>
                    <IconButton
                      label={`Dismiss ${who(c)}`}
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
            Showing {rows.length} from {scanned} sent emails. <b className="font-medium text-fg-muted">Lead</b> adds a
            prospect + pipeline card; <b className="font-medium text-fg-muted">Customer</b> adds a customer contact;{" "}
            <b className="font-medium text-fg-muted">Link</b> attaches them to an existing account. Dismissed people
            won’t come back.
          </p>
        </>
      ) : null}

      <LinkCompanyModal
        candidate={linkFor}
        companies={companies}
        busy={linkFor ? busy.has(linkFor.email) : false}
        onClose={() => setLinkFor(null)}
        onPick={(company) => linkFor && linkCompany(linkFor, company)}
      />
    </div>
  );
}

// --- link-to-existing-company picker ----------------------------------------

function LinkCompanyModal({
  candidate,
  companies,
  busy,
  onClose,
  onPick,
}: {
  candidate: Candidate | null;
  companies: Company[];
  busy: boolean;
  onClose: () => void;
  onPick: (company: Company) => void;
}) {
  const [q, setQ] = useState("");

  // Seed the search with the candidate's domain-derived company so the likely
  // match surfaces first; reset whenever a different candidate opens the picker.
  useEffect(() => {
    setQ(candidate?.company ?? "");
  }, [candidate]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? companies.filter((c) => c.name.toLowerCase().includes(term)) : companies;
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
  }, [companies, q]);

  return (
    <Modal open={candidate !== null} onClose={onClose} title="Link to an existing company">
      <div className="space-y-3">
        <p className="text-[13px] text-fg-subtle">
          Attach {candidate ? <span className="font-medium text-fg">{candidate.name || candidate.email}</span> : "this person"}{" "}
          to an account already in Luna Desk. They’ll inherit that account’s lifecycle (so a customer’s contact shows
          as a customer).
        </p>
        <div className="relative">
          <Search
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Search companies…"
            aria-label="Search companies"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-[14px] text-fg placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <ul className="max-h-[46vh] divide-y divide-border-soft overflow-y-auto rounded-xl border border-border-soft">
          {shown.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-fg-subtle">
              {companies.length === 0 ? "Loading companies…" : "No companies match."}
            </li>
          ) : (
            shown.map((company) => (
              <li key={company.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(company)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-60"
                >
                  <Monogram name={company.name} size="sm" tone="navy" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">{company.name}</span>
                  {company.lifecycleStage ? <LifecycleBadge value={company.lifecycleStage} /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}
