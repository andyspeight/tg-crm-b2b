"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Pencil, Plus, SearchX, Trash2, Users } from "lucide-react";
import { api } from "@/lib/client";
import type { Contact } from "@/lib/crm/types";
import {
  Button,
  ButtonLink,
  Card,
  cn,
  EmptyState,
  IconButton,
  Modal,
  Monogram,
  PageHeader,
} from "@/components/ui";
import { LifecycleBadge } from "@/components/badges";
import { ContactForm, type CompanyOption } from "@/components/forms";
import { useToast } from "@/components/feedback";
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
type Sort = "name" | "recent" | "company";

const SORTS: { id: Sort; label: string }[] = [
  { id: "name", label: "Name (A–Z)" },
  { id: "recent", label: "Recently added" },
  { id: "company", label: "Company (A–Z)" },
];

const ALPHABET = ["#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];
/** Index letter for a name — first letter uppercased, or "#" for anything else. */
function firstLetter(name?: string): string {
  const ch = (name || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
}

export function ContactsView({
  initial,
  companies,
}: {
  initial: Contact[];
  companies: CompanyOption[];
}) {
  const {
    items: contacts,
    q,
    setQ,
    loading,
    refresh,
    remove,
  } = useList<Contact>({
    resource: "contacts",
    responseKey: "contacts",
    initial,
    noun: "person",
    nounCap: "Person",
    nameOf: (c) => c.name,
    deleteMessage: "This removes the person from Luna Desk.",
  });

  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const toast = useToast();

  const counts = useMemo(() => {
    let customer = 0;
    let lead = 0;
    for (const c of contacts) {
      const g = group(c.companyLifecycle);
      if (g === "customer") customer++;
      else if (g === "lead") lead++;
    }
    return { all: contacts.length, customer, lead };
  }, [contacts]);

  const shown = useMemo(() => {
    const rows = tab === "all" ? contacts : contacts.filter((c) => group(c.companyLifecycle) === tab);
    return [...rows].sort((a, b) => {
      switch (sort) {
        case "recent":
          return (b.createdTime ?? "").localeCompare(a.createdTime ?? "");
        case "company":
          return (
            (a.companyName || "~").localeCompare(b.companyName || "~") ||
            (a.name || "").localeCompare(b.name || "")
          );
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });
  }, [contacts, tab, sort]);

  // A–Z jump bar — only meaningful when the list is in name order.
  const jumpEnabled = sort === "name";
  const presentLetters = useMemo(
    () => new Set(shown.map((c) => firstLetter(c.name))),
    [shown],
  );
  // The contact id that starts each letter block (gets the scroll anchor).
  const anchorLetterById = useMemo(() => {
    const map = new Map<string, string>();
    if (!jumpEnabled) return map;
    const seen = new Set<string>();
    for (const c of shown) {
      const l = firstLetter(c.name);
      if (!seen.has(l)) {
        seen.add(l);
        map.set(c.id, l);
      }
    }
    return map;
  }, [shown, jumpEnabled]);

  function jumpTo(letter: string) {
    const el = [`ppl-d-${letter}`, `ppl-m-${letter}`]
      .map((id) => document.getElementById(id))
      .find((e) => e && e.offsetParent !== null);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function create(payload: Record<string, unknown>) {
    try {
      await api("/api/contacts", { method: "POST", body: JSON.stringify(payload) });
      setCreating(false);
      await refresh();
      toast.success("Person added");
    } catch (e) {
      toast.error("Couldn't add person", { description: (e as Error).message });
    }
  }
  async function update(payload: Record<string, unknown>) {
    if (!editing) return;
    const name = editing.name;
    try {
      await api(`/api/contacts/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setEditing(null);
      await refresh();
      toast.success(`${name || "Person"} updated`);
    } catch (e) {
      toast.error("Couldn't save changes", { description: (e as Error).message });
    }
  }

  const TABS: { id: Tab; label: string; n: number }[] = [
    { id: "all", label: "Everyone", n: counts.all },
    { id: "customer", label: "Customers", n: counts.customer },
    { id: "lead", label: "Leads", n: counts.lead },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="People"
        description="Everyone across your customers and leads."
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <ListSearchField
              value={q}
              onChange={setQ}
              placeholder="Search people…"
              label="Search people"
              loading={loading}
            />
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2} /> New person
            </Button>
          </div>
        }
      />

      {/* Customer / lead filter + sort */}
      <div className="flex flex-wrap items-center gap-2.5">
        <TabPills tabs={TABS} active={tab} onChange={setTab} />
        <SortSelect value={sort} onChange={setSort} options={SORTS} label="Sort people" />
      </div>

      {jumpEnabled && shown.length > 12 ? (
        <div className="sticky top-[52px] z-10 -mx-1 flex flex-wrap items-center justify-center gap-0.5 rounded-xl border border-border bg-card/90 px-2 py-1.5 shadow-card backdrop-blur">
          {ALPHABET.map((L) => {
            const on = presentLetters.has(L);
            return (
              <button
                key={L}
                type="button"
                disabled={!on}
                onClick={() => jumpTo(L)}
                aria-label={`Jump to ${L === "#" ? "other" : L}`}
                className={cn(
                  "h-6 w-6 rounded-md text-[11px] font-semibold transition-colors",
                  on
                    ? "text-fg-muted hover:bg-accent-soft hover:text-accent-strong"
                    : "cursor-default text-fg-subtle/40",
                )}
              >
                {L}
              </button>
            );
          })}
        </div>
      ) : null}

      {loading && contacts.length === 0 ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={q ? <SearchX size={20} strokeWidth={1.75} /> : <Users size={20} strokeWidth={1.75} />}
          title={
            q
              ? "No people match your search"
              : tab !== "all"
                ? `No ${tab === "customer" ? "customers" : "leads"} yet`
                : "No people yet"
          }
          hint={
            q
              ? "Try a different name, company or email."
              : "Add a lead or customer from the Today screen, or import from Monday."
          }
          action={
            q ? (
              <Button variant="ghost" onClick={() => setQ("")}>
                Clear search
              </Button>
            ) : (
              <ButtonLink href="/data?tab=import">
                <Download size={16} strokeWidth={2} /> Import from Monday
              </ButtonLink>
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
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Company</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Email</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Phone</th>
                  <th className="sticky right-0 z-10 bg-card px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr
                    key={c.id}
                    id={anchorLetterById.has(c.id) ? `ppl-d-${anchorLetterById.get(c.id)}` : undefined}
                    onClick={() => setEditing(c)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditing(c);
                      }
                    }}
                    className="group scroll-mt-[104px] cursor-pointer border-b border-border-soft transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <td className="relative px-4 py-3">
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="flex items-center gap-3">
                        <Monogram name={c.name || "Unnamed"} size="sm" tone="accent" />
                        <span className="font-medium text-fg">{c.name || "Unnamed"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.companyId ? (
                        <Link
                          href={`/companies/${c.companyId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block max-w-[170px] truncate text-fg hover:text-accent-strong"
                        >
                          {c.companyName || "Company"}
                        </Link>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.companyLifecycle ? (
                        <LifecycleBadge value={c.companyLifecycle} />
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block max-w-[220px] truncate hover:text-accent-strong"
                        >
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-fg-muted">
                      {c.phone ?? <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="sticky right-0 z-10 bg-card px-2 py-2 group-hover:bg-muted">
                      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-0.5">
                        <IconButton label="Edit person" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton label="Delete person" onClick={() => remove(c)} className="hover:text-danger">
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
              <div
                key={c.id}
                id={anchorLetterById.has(c.id) ? `ppl-m-${anchorLetterById.get(c.id)}` : undefined}
                className="scroll-mt-[104px]"
              >
                <Card onClick={() => setEditing(c)} className="p-3.5">
                  <div className="flex items-start gap-3">
                    <Monogram name={c.name || "Unnamed"} size="sm" tone="accent" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate font-medium text-fg">{c.name || "Unnamed"}</span>
                        <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 gap-0.5">
                          <IconButton label="Edit person" onClick={() => setEditing(c)}>
                            <Pencil size={16} strokeWidth={1.75} />
                          </IconButton>
                          <IconButton label="Delete person" onClick={() => remove(c)} className="hover:text-danger">
                            <Trash2 size={16} strokeWidth={1.75} />
                          </IconButton>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {c.companyId ? (
                          <Link
                            href={`/companies/${c.companyId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[13px] text-fg hover:text-accent-strong"
                          >
                            {c.companyName || "Company"}
                          </Link>
                        ) : null}
                        {c.companyLifecycle ? <LifecycleBadge value={c.companyLifecycle} /> : null}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[13px] text-fg-muted">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate hover:text-accent-strong"
                          >
                            {c.email}
                          </a>
                        ) : null}
                        {c.phone ? <span className="tnum block">{c.phone}</span> : null}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New person">
        <ContactForm
          companies={companies}
          onSave={create}
          onCancel={() => setCreating(false)}
          submitLabel="Create person"
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit person">
        {editing && (
          <ContactForm
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
