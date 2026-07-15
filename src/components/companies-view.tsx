"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Company } from "@/lib/crm/types";
import { Button, EmptyState, IconButton, Modal, Monogram, PageHeader, Skeleton } from "@/components/ui";
import { HealthBadge, LifecycleBadge } from "@/components/badges";
import { CompanyForm } from "@/components/forms";
import { formatMoney } from "@/lib/format";

export function CompaniesView({ initial }: { initial: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [newLifecycle, setNewLifecycle] = useState<"" | "Customer" | "Prospect">("");
  const first = useRef(true);

  // Opened from Today's "New lead" / "New customer" quick actions.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("new");
    if (p === "customer" || p === "prospect") {
      setNewLifecycle(p === "customer" ? "Customer" : "Prospect");
      setCreating(true);
      window.history.replaceState({}, "", "/companies");
    }
  }, []);

  async function refresh(term = q) {
    setLoading(true);
    try {
      const data = await api<{ companies: Company[] }>(
        `/api/companies${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`,
      );
      setCompanies(data.companies);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => refresh(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function create(payload: Record<string, unknown>) {
    await api("/api/companies", { method: "POST", body: JSON.stringify(payload) });
    setCreating(false);
    setNewLifecycle("");
    await refresh();
  }
  async function update(payload: Record<string, unknown>) {
    if (!editing) return;
    await api(`/api/companies/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(null);
    await refresh();
  }
  async function remove(c: Company) {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    await api(`/api/companies/${c.id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description={`${companies.length} ${companies.length === 1 ? "record" : "records"}`}
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search
                size={16}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search companies..."
                aria-label="Search companies"
                className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-[14px] text-fg placeholder:text-fg-subtle shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2} /> New company
            </Button>
          </div>
        }
      />

      <div className="mt-5">
        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-0">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="ml-auto h-3 w-16" />
              </div>
            ))}
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={<Building2 size={20} strokeWidth={1.75} />}
            title={q ? "No companies match your search" : "No companies yet"}
            hint={q ? undefined : "Add your first account, or run the Monday import to seed the pipeline."}
            action={
              q ? (
                <Button variant="ghost" onClick={() => setQ("")}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => setCreating(true)}>
                  <Plus size={16} strokeWidth={2} /> New company
                </Button>
              )
            }
          />
        ) : (
          <div className="luna-fade overflow-hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[680px] text-[14px]">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Name</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Lifecycle</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Health</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Country</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">MRR</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-border-soft transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <td className="relative px-4 py-3 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent before:opacity-0 before:transition-opacity group-hover:before:opacity-100">
                      <div className="flex items-center gap-3">
                        <Monogram name={c.name} size="sm" tone="navy" />
                        <Link
                          href={`/companies/${c.id}`}
                          className="font-medium text-fg transition-colors hover:text-accent-strong"
                        >
                          {c.name || "Untitled"}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{c.type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <LifecycleBadge value={c.lifecycleStage} />
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge value={c.accountHealth} />
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{c.country ?? "—"}</td>
                    <td className="tnum px-4 py-3 text-right">
                      {c.mrr == null ? (
                        <span className="text-fg-subtle">—</span>
                      ) : (
                        <span className="font-medium text-fg">{formatMoney(c.mrr)}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                        <IconButton label="Edit company" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton
                          label="Delete company"
                          onClick={() => remove(c)}
                          className="hover:text-danger"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false);
          setNewLifecycle("");
        }}
        title={newLifecycle === "Customer" ? "New customer" : newLifecycle === "Prospect" ? "New lead" : "New company"}
      >
        <CompanyForm
          initial={newLifecycle ? { lifecycleStage: newLifecycle } : undefined}
          onSave={create}
          onCancel={() => {
            setCreating(false);
            setNewLifecycle("");
          }}
          submitLabel="Create company"
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit company">
        {editing && (
          <CompanyForm
            initial={editing}
            onSave={update}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>
    </div>
  );
}
