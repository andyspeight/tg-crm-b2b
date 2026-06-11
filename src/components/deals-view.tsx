"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Deal } from "@/lib/crm/types";
import { Button, EmptyState, IconButton, Modal, Spinner } from "@/components/ui";
import { StageBadge } from "@/components/badges";
import { DealForm, type CompanyOption } from "@/components/forms";
import { formatDate, formatMoney } from "@/lib/format";

export function DealsView({ initial, companies }: { initial: Deal[]; companies: CompanyOption[] }) {
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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Deals</h1>
          <p className="text-[13px] text-fg-subtle">
            {deals.length} in view · <span className="tnum">{formatMoney(totalMrr)}</span> MRR
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
              placeholder="Search deals..."
              aria-label="Search deals"
              className="w-44 rounded-lg border border-border bg-surface py-2 pl-8 pr-8 text-[13px] text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64"
            />
            {loading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle">
                <Spinner />
              </span>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2} /> New deal
          </Button>
        </div>
      </div>

      {deals.length === 0 ? (
        <EmptyState
          title={q ? "No deals match your search" : "No deals yet"}
          hint={q ? undefined : "Add a deal to start tracking the new-business pipeline."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[12px] font-medium text-fg-subtle">
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
                <tr key={d.id} className="border-b border-border-soft last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5 font-medium text-fg">{d.name || "Untitled"}</td>
                  <td className="px-4 py-2.5">
                    {d.companyId ? (
                      <Link href={`/companies/${d.companyId}`} className="text-fg hover:text-accent-strong">
                        {d.companyName || "Company"}
                      </Link>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StageBadge value={d.stage} />
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-fg-muted">{formatMoney(d.mrr)}</td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {d.nextStep ? (
                      <span>
                        {d.nextStep}
                        {d.nextStepDate ? (
                          <span className="tnum text-fg-subtle"> · {formatDate(d.nextStepDate)}</span>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-0.5">
                      <IconButton label="Edit deal" onClick={() => setEditing(d)}>
                        <Pencil size={16} strokeWidth={1.75} />
                      </IconButton>
                      <IconButton
                        label="Delete deal"
                        onClick={() => remove(d)}
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
