"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Download, Layers, Pencil, Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { api } from "@/lib/client";
import type { Deal } from "@/lib/crm/types";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Modal,
  Monogram,
  PageHeader,
  Spinner,
  StatTile,
} from "@/components/ui";
import { StageBadge } from "@/components/badges";
import { DealForm, type CompanyOption } from "@/components/forms";
import { useConfirm, useToast } from "@/components/feedback";
import { formatDate, formatMoney } from "@/lib/format";

export function DealsView({ initial, companies }: { initial: Deal[]; companies: CompanyOption[] }) {
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const first = useRef(true);
  const pending = useRef<Set<string>>(new Set());
  const toast = useToast();
  const confirm = useConfirm();

  // Opened from Today's "New deal" quick action.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setCreating(true);
      window.history.replaceState({}, "", "/deals");
    }
  }, []);

  async function refresh(term = q) {
    setLoading(true);
    try {
      const data = await api<{ deals: Deal[] }>(
        `/api/deals${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`,
      );
      // Keep optimistically-removed rows hidden until their deferred delete lands.
      setDeals(data.deals.filter((d) => !pending.current.has(d.id)));
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
    try {
      await api("/api/deals", { method: "POST", body: JSON.stringify(payload) });
      setCreating(false);
      await refresh();
      toast.success("Deal added");
    } catch (e) {
      toast.error("Couldn't add deal", { description: (e as Error).message });
    }
  }
  async function update(payload: Record<string, unknown>) {
    if (!editing) return;
    const name = editing.name;
    try {
      await api(`/api/deals/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setEditing(null);
      await refresh();
      toast.success(`${name || "Deal"} updated`);
    } catch (e) {
      toast.error("Couldn't save changes", { description: (e as Error).message });
    }
  }
  async function remove(d: Deal) {
    const ok = await confirm({
      title: `Delete ${d.name || "this deal"}?`,
      message: "This removes the deal from your pipeline.",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    // Optimistic: hide now, actually delete when the undo window closes.
    const idx = deals.findIndex((x) => x.id === d.id);
    pending.current.add(d.id);
    setDeals((xs) => xs.filter((x) => x.id !== d.id));

    let undone = false;
    toast.success(`${d.name || "Deal"} deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          pending.current.delete(d.id);
          setDeals((xs) => {
            if (xs.some((x) => x.id === d.id)) return xs;
            const next = [...xs];
            next.splice(Math.min(idx, next.length), 0, d);
            return next;
          });
        },
      },
    });

    window.setTimeout(async () => {
      if (undone) return;
      try {
        await api(`/api/deals/${d.id}`, { method: "DELETE" });
      } catch (e) {
        toast.error(`Couldn't delete ${d.name || "deal"}`, { description: (e as Error).message });
        await refresh();
      } finally {
        pending.current.delete(d.id);
      }
    }, 6000);
  }

  const totalMrr = deals.reduce((sum, d) => sum + (d.mrr ?? 0), 0);
  const dealLabel = deals.length === 1 ? "deal" : "deals";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deals"
        description="Your new-business pipeline"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2} /> New deal
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <StatTile
            label="Open deals"
            value={String(deals.length)}
            icon={<Layers size={16} strokeWidth={1.75} />}
          />
          <StatTile
            label="Pipeline MRR"
            value={formatMoney(totalMrr)}
            tone="navy"
            icon={<TrendingUp size={16} strokeWidth={1.75} />}
          />
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search deals…"
            aria-label="Search deals"
            className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-[15px] text-fg transition-colors placeholder:text-fg-subtle hover:border-fg-subtle/50 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
              <Spinner />
            </span>
          )}
        </div>
      </div>

      {deals.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={20} strokeWidth={1.75} />}
          title={q ? "No deals match your search" : "No deals yet"}
          hint={
            q
              ? "Try a different term, or clear the search to see the full pipeline."
              : "Import your pipeline from Monday, or add a deal with the New deal button above."
          }
          action={
            q ? (
              <Button variant="ghost" onClick={() => setQ("")}>
                Clear search
              </Button>
            ) : (
              <ButtonLink href="/import" variant="secondary">
                <Download size={16} strokeWidth={2} /> Import from Monday
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="luna-fade hidden overflow-x-auto overflow-hidden rounded-2xl border border-border bg-card shadow-card sm:block">
            <table className="w-full text-[14px]">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Deal
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Company
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    MRR
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Next step
                  </th>
                  <th className="sticky right-0 z-10 bg-card px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setEditing(d)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditing(d);
                      }
                    }}
                    className="group cursor-pointer border-b border-border-soft transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <td className="relative px-4 py-3">
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="flex items-center gap-3">
                        <Monogram name={d.name || "Untitled"} tone="navy" />
                        <span className="font-medium text-fg">{d.name || "Untitled"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {d.companyId ? (
                        <Link
                          href={`/companies/${d.companyId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-fg transition-colors hover:text-accent-strong"
                        >
                          {d.companyName || "Company"}
                        </Link>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge value={d.stage} />
                    </td>
                    <td
                      className={
                        d.mrr == null
                          ? "tnum px-4 py-3 text-right text-fg-subtle"
                          : "tnum px-4 py-3 text-right font-medium text-fg"
                      }
                    >
                      {formatMoney(d.mrr)}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {d.nextStep ? (
                        <span>
                          {d.nextStep}
                          {d.nextStepDate ? (
                            <span className="tnum text-fg-subtle"> · {formatDate(d.nextStepDate)}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="sticky right-0 z-10 bg-card px-2 py-2 group-hover:bg-muted">
                      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-0.5">
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
              <tfoot>
                <tr className="border-t border-border bg-muted/40">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle"
                  >
                    Total pipeline · {deals.length} {dealLabel}
                  </td>
                  <td className="tnum px-4 py-3 text-right font-semibold text-fg">
                    {formatMoney(totalMrr)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="space-y-3 sm:hidden">
            {deals.map((d, i) => (
              <li key={d.id} className="luna-rise" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <Card onClick={() => setEditing(d)}>
                  <div className="flex items-start gap-3 p-4">
                    <Monogram name={d.name || "Untitled"} tone="navy" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <span className="truncate font-medium text-fg">{d.name || "Untitled"}</span>
                        <span
                          className={
                            d.mrr == null
                              ? "tnum shrink-0 text-fg-subtle"
                              : "tnum shrink-0 font-medium text-fg"
                          }
                        >
                          {formatMoney(d.mrr)}
                        </span>
                      </div>
                      {d.companyId ? (
                        <Link
                          href={`/companies/${d.companyId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 block truncate text-[13px] text-fg-muted transition-colors hover:text-accent-strong"
                        >
                          {d.companyName || "Company"}
                        </Link>
                      ) : (
                        <span className="mt-0.5 block text-[13px] text-fg-subtle">—</span>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <StageBadge value={d.stage} />
                        <div onClick={(e) => e.stopPropagation()} className="flex gap-0.5">
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
                      </div>
                      {d.nextStep ? (
                        <p className="mt-2 text-[13px] text-fg-muted">
                          {d.nextStep}
                          {d.nextStepDate ? (
                            <span className="tnum text-fg-subtle"> · {formatDate(d.nextStepDate)}</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
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
