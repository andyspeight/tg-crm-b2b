"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Company } from "@/lib/crm/types";
import { Button, EmptyState, IconButton, Modal, Spinner } from "@/components/ui";
import { HealthBadge, LifecycleBadge } from "@/components/badges";
import { CompanyForm } from "@/components/forms";
import { formatMoney } from "@/lib/format";

export function CompaniesView({ initial }: { initial: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const first = useRef(true);

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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Companies</h1>
          <p className="text-[13px] text-fg-subtle">
            {companies.length} {companies.length === 1 ? "record" : "records"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies..."
              aria-label="Search companies"
              className="w-44 rounded-lg border border-border bg-surface py-2 pl-8 pr-8 text-[13px] text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64"
            />
            {loading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle">
                <Spinner />
              </span>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2} /> New company
          </Button>
        </div>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          title={q ? "No companies match your search" : "No companies yet"}
          hint={q ? undefined : "Add your first account, or run the Monday import to seed the pipeline."}
          action={
            q ? undefined : (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} strokeWidth={2} /> New company
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[680px] text-[14px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[12px] font-medium text-fg-subtle">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Lifecycle</th>
                <th className="px-4 py-2.5">Health</th>
                <th className="px-4 py-2.5">Country</th>
                <th className="px-4 py-2.5 text-right">MRR</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-border-soft last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/companies/${c.id}`}
                      className="font-medium text-fg hover:text-accent-strong"
                    >
                      {c.name || "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">{c.type ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <LifecycleBadge value={c.lifecycleStage} />
                  </td>
                  <td className="px-4 py-2.5">
                    <HealthBadge value={c.accountHealth} />
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">{c.country ?? "—"}</td>
                  <td className="tnum px-4 py-2.5 text-right text-fg-muted">{formatMoney(c.mrr)}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-0.5">
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

      <Modal open={creating} onClose={() => setCreating(false)} title="New company">
        <CompanyForm onSave={create} onCancel={() => setCreating(false)} submitLabel="Create company" />
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
