"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Company } from "@/lib/crm/types";
import { COMPANY_TYPES } from "@/lib/crm/config";
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Modal,
  Monogram,
  PageHeader,
  Select,
} from "@/components/ui";
import { HealthBadge, LifecycleBadge } from "@/components/badges";
import { CompanyForm } from "@/components/forms";
import { useToast } from "@/components/feedback";
import { formatMoney } from "@/lib/format";
import { useList } from "@/components/use-list";
import { ListSearchField, ListSkeleton, SortSelect, TabPills } from "@/components/list-kit";

const CUSTOMER_LC = new Set(["Customer", "At Risk"]);
const LEAD_LC = new Set(["Prospect", "Engaged", "Opportunity"]);
type Group = "customer" | "lead" | "other";
function group(lc?: string): Group {
  if (lc && CUSTOMER_LC.has(lc)) return "customer";
  if (lc && LEAD_LC.has(lc)) return "lead";
  return "other";
}
type Tab = "all" | "customer" | "lead";
type Sort = "name" | "recent" | "mrr" | "health";

const SORTS: { id: Sort; label: string }[] = [
  { id: "name", label: "Name (A–Z)" },
  { id: "recent", label: "Recently added" },
  { id: "mrr", label: "MRR (high–low)" },
  { id: "health", label: "Health (worst first)" },
];
const HEALTH_RANK: Record<string, number> = { Red: 0, Amber: 1, Green: 2 };

export function CompaniesView({ initial }: { initial: Company[] }) {
  const {
    items: companies,
    q,
    setQ,
    loading,
    refresh,
    remove,
  } = useList<Company>({
    resource: "companies",
    responseKey: "companies",
    initial,
    noun: "company",
    nounCap: "Company",
    nameOf: (c) => c.name,
    deleteMessage: "This removes the account and unlinks its people, deals and activity.",
  });

  const [tab, setTab] = useState<Tab>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [newLifecycle, setNewLifecycle] = useState<"" | "Customer" | "Prospect">("");
  const router = useRouter();
  const toast = useToast();

  // Opened from Today's "New lead" / "New customer" quick actions.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("new");
    if (p === "customer" || p === "prospect") {
      setNewLifecycle(p === "customer" ? "Customer" : "Prospect");
      setCreating(true);
      window.history.replaceState({}, "", "/companies");
    }
  }, []);

  // Type + health narrow the base; tab counts reflect that base so they never lie.
  const base = useMemo(() => {
    return companies.filter(
      (c) =>
        (!typeFilter || c.type === typeFilter) &&
        (!healthFilter || c.accountHealth === healthFilter),
    );
  }, [companies, typeFilter, healthFilter]);

  const counts = useMemo(() => {
    let customer = 0;
    let lead = 0;
    for (const c of base) {
      const g = group(c.lifecycleStage);
      if (g === "customer") customer++;
      else if (g === "lead") lead++;
    }
    return { all: base.length, customer, lead };
  }, [base]);

  const shown = useMemo(() => {
    const rows = tab === "all" ? base : base.filter((c) => group(c.lifecycleStage) === tab);
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "recent":
          return (b.createdTime ?? "").localeCompare(a.createdTime ?? "");
        case "mrr":
          return (b.mrr ?? -1) - (a.mrr ?? -1);
        case "health":
          return (
            (HEALTH_RANK[a.accountHealth ?? ""] ?? 3) - (HEALTH_RANK[b.accountHealth ?? ""] ?? 3) ||
            (a.name || "").localeCompare(b.name || "")
          );
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });
    return sorted;
  }, [base, tab, sort]);

  async function create(payload: Record<string, unknown>) {
    try {
      await api("/api/companies", { method: "POST", body: JSON.stringify(payload) });
      setCreating(false);
      setNewLifecycle("");
      await refresh();
      toast.success("Company added");
    } catch (e) {
      toast.error("Couldn't add company", { description: (e as Error).message });
    }
  }
  async function update(payload: Record<string, unknown>) {
    if (!editing) return;
    const name = editing.name;
    try {
      await api(`/api/companies/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setEditing(null);
      await refresh();
      toast.success(`${name} updated`);
    } catch (e) {
      toast.error("Couldn't save changes", { description: (e as Error).message });
    }
  }

  const TABS: { id: Tab; label: string; n: number }[] = [
    { id: "all", label: "All", n: counts.all },
    { id: "customer", label: "Customers", n: counts.customer },
    { id: "lead", label: "Leads", n: counts.lead },
  ];

  const filtered = q || typeFilter || healthFilter || tab !== "all";
  const open = (c: Company) => router.push(`/companies/${c.id}`);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Companies"
        description={`${companies.length} ${companies.length === 1 ? "account" : "accounts"}`}
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <ListSearchField
              value={q}
              onChange={setQ}
              placeholder="Search companies…"
              label="Search companies"
              loading={loading}
            />
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2} /> New company
            </Button>
          </div>
        }
      />

      {/* Filters + sort */}
      <div className="flex flex-wrap items-center gap-2.5">
        <TabPills tabs={TABS} active={tab} onChange={setTab} />
        <div className="w-36">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
            className="h-9 text-[13px]"
          >
            <option value="">All types</option>
            {COMPANY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-32">
          <Select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            aria-label="Filter by health"
            className="h-9 text-[13px]"
          >
            <option value="">All health</option>
            <option value="Green">Green</option>
            <option value="Amber">Amber</option>
            <option value="Red">Red</option>
          </Select>
        </div>
        <SortSelect value={sort} onChange={setSort} options={SORTS} label="Sort companies" />
      </div>

      {loading && companies.length === 0 ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={filtered ? <SearchX size={20} strokeWidth={1.75} /> : <Building2 size={20} strokeWidth={1.75} />}
          title={filtered ? "No companies match these filters" : "No companies yet"}
          hint={
            filtered
              ? "Try clearing a filter or search term."
              : "Add your first account, or run the Monday import to seed the pipeline."
          }
          action={
            filtered ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQ("");
                  setTypeFilter("");
                  setHealthFilter("");
                  setTab("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} strokeWidth={2} /> New company
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="luna-fade hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card sm:block">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Name</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Lifecycle</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Health</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Country</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">MRR</th>
                  <th className="sticky right-0 z-10 bg-card px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => open(c)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(c);
                      }
                    }}
                    className="group cursor-pointer border-b border-border-soft transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <td className="relative px-4 py-3">
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="flex items-center gap-3">
                        <Monogram name={c.name} size="sm" tone="navy" />
                        <Link
                          href={`/companies/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block max-w-[220px] truncate font-medium text-fg transition-colors hover:text-accent-strong"
                        >
                          {c.name || "Untitled"}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{c.type ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.lifecycleStage ? (
                        <LifecycleBadge value={c.lifecycleStage} />
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.accountHealth ? (
                        <HealthBadge value={c.accountHealth} />
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{c.country ?? "—"}</td>
                    <td className="tnum px-4 py-3 text-right">
                      {c.mrr == null ? (
                        <span className="text-fg-subtle">—</span>
                      ) : (
                        <span className="font-medium text-fg">{formatMoney(c.mrr)}</span>
                      )}
                    </td>
                    <td className="sticky right-0 z-10 bg-card px-2 py-2 group-hover:bg-muted">
                      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-0.5">
                        <IconButton label="Edit company" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton label="Delete company" onClick={() => remove(c)} className="hover:text-danger">
                          <Trash2 size={16} strokeWidth={1.75} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="luna-fade space-y-2.5 sm:hidden">
            {shown.map((c) => (
              <Card key={c.id} onClick={() => open(c)} className="p-3.5">
                <div className="flex items-start gap-3">
                  <Monogram name={c.name} size="sm" tone="navy" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium text-fg">{c.name || "Untitled"}</span>
                      <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 gap-0.5">
                        <IconButton label="Edit company" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton label="Delete company" onClick={() => remove(c)} className="hover:text-danger">
                          <Trash2 size={16} strokeWidth={1.75} />
                        </IconButton>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {c.type ? <span className="text-[13px] text-fg-muted">{c.type}</span> : null}
                      {c.lifecycleStage ? <LifecycleBadge value={c.lifecycleStage} /> : null}
                      {c.accountHealth ? <HealthBadge value={c.accountHealth} /> : null}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-fg-muted">
                      <span>{c.country ?? ""}</span>
                      {c.mrr != null ? <span className="tnum font-medium text-fg">{formatMoney(c.mrr)}</span> : null}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

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
