"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Company } from "@/lib/crm/types";
import { Button, EmptyState, Modal, Spinner } from "@/components/ui";
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

  // Debounced search (skips the initial render — we already have server data).
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Companies</h1>
          <p className="text-xs text-slate-400">{companies.length} records</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies..."
              className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-60"
            />
            {loading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Spinner />
              </span>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>New company</Button>
        </div>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          title={q ? "No companies match your search" : "No companies yet"}
          hint={q ? undefined : "Create your first company, or run the Monday import."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
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
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/companies/${c.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {c.name || "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.type ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <LifecycleBadge value={c.lifecycleStage} />
                  </td>
                  <td className="px-4 py-2.5">
                    <HealthBadge value={c.accountHealth} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.country ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{formatMoney(c.mrr)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(c)} className="text-red-600">
                      Delete
                    </Button>
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
