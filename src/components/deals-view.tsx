"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Deal } from "@/lib/crm/types";
import { Button, EmptyState, Modal, Spinner } from "@/components/ui";
import { StageBadge } from "@/components/badges";
import { DealForm, type CompanyOption } from "@/components/forms";
import { formatDate, formatMoney } from "@/lib/format";

export function DealsView({
  initial,
  companies,
}: {
  initial: Deal[];
  companies: CompanyOption[];
}) {
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const first = useRef(true);

  async function refresh(term = q) {
    setLoading(true);
    try {
      const data = await api<{ deals: Deal[] }>(
        `/api/deals${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`,
      );
      setDeals(data.deals);
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
    await api("/api/deals", { method: "POST", body: JSON.stringify(payload) });
    setCreating(false);
    await refresh();
  }
  async function update(payload: Record<string, unknown>) {
    if (!editing) return;
    await api(`/api/deals/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(null);
    await refresh();
  }
  async function remove(d: Deal) {
    if (!confirm(`Delete ${d.name}?`)) return;
    await api(`/api/deals/${d.id}`, { method: "DELETE" });
    await refresh();
  }

  const totalMrr = deals.reduce((sum, d) => sum + (d.mrr ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Deals</h1>
          <p className="text-xs text-slate-400">
            {deals.length} open in view · {formatMoney(totalMrr)} MRR
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search deals..."
              className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-60"
            />
            {loading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Spinner />
              </span>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>New deal</Button>
        </div>
      </div>

      {deals.length === 0 ? (
        <EmptyState title={q ? "No deals match your search" : "No deals yet"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                <th className="px-4 py-2.5">Deal</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5 text-right">MRR</th>
                <th className="px-4 py-2.5">Next step</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{d.name || "Untitled"}</td>
                  <td className="px-4 py-2.5">
                    {d.companyId ? (
                      <Link
                        href={`/companies/${d.companyId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {d.companyName || "Company"}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StageBadge value={d.stage} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{formatMoney(d.mrr)}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {d.nextStep ? (
                      <span>
                        {d.nextStep}
                        {d.nextStepDate ? (
                          <span className="text-slate-400"> · {formatDate(d.nextStepDate)}</span>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(d)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(d)} className="text-red-600">
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New deal">
        <DealForm
          companies={companies}
          onSave={create}
          onCancel={() => setCreating(false)}
          submitLabel="Create deal"
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit deal">
        {editing && (
          <DealForm
            initial={editing}
            companies={companies}
            onSave={update}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>
    </div>
  );
}
