"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pencil, Plus, Search, SearchX, Trash2, Users } from "lucide-react";
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
  SkeletonRow,
  Spinner,
} from "@/components/ui";
import { LifecycleBadge } from "@/components/badges";
import { ContactForm, type CompanyOption } from "@/components/forms";
import { useConfirm, useToast } from "@/components/feedback";

const CUSTOMER_LC = new Set(["Customer", "At Risk"]);
const LEAD_LC = new Set(["Prospect", "Engaged", "Opportunity"]);
type Group = "customer" | "lead" | "other";
function group(lc?: string): Group {
  if (lc && CUSTOMER_LC.has(lc)) return "customer";
  if (lc && LEAD_LC.has(lc)) return "lead";
  return "other";
}
type Tab = "all" | "customer" | "lead";

export function ContactsView({
  initial,
  companies,
}: {
  initial: Contact[];
  companies: CompanyOption[];
}) {
  const [contacts, setContacts] = useState<Contact[]>(initial);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const first = useRef(true);
  const pending = useRef<Set<string>>(new Set());
  const toast = useToast();
  const confirm = useConfirm();

  async function refresh(term = q) {
    setLoading(true);
    try {
      const data = await api<{ contacts: Contact[] }>(
        `/api/contacts${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`,
      );
      // Keep optimistically-removed rows hidden until their deferred delete lands.
      setContacts(data.contacts.filter((c) => !pending.current.has(c.id)));
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

  const shown = useMemo(
    () => (tab === "all" ? contacts : contacts.filter((c) => group(c.companyLifecycle) === tab)),
    [contacts, tab],
  );

  async function create(payload: Record<string, unknown>) {
    try {
      await api("/api/contacts", { method: "POST", body: JSON.stringify(payload) });
      setCreating(false);
      await refresh();
      toast.success("Contact added");
    } catch (e) {
      toast.error("Couldn't add contact", { description: (e as Error).message });
    }
  }
  async function update(payload: Record<string, unknown>) {
    if (!editing) return;
    const name = editing.name;
    try {
      await api(`/api/contacts/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setEditing(null);
      await refresh();
      toast.success(`${name || "Contact"} updated`);
    } catch (e) {
      toast.error("Couldn't save changes", { description: (e as Error).message });
    }
  }
  async function remove(c: Contact) {
    const ok = await confirm({
      title: `Delete ${c.name || "this contact"}?`,
      message: "This removes the person from Luna Desk.",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    // Optimistic: hide now, actually delete when the undo window closes.
    const idx = contacts.findIndex((x) => x.id === c.id);
    pending.current.add(c.id);
    setContacts((xs) => xs.filter((x) => x.id !== c.id));

    let undone = false;
    toast.success(`${c.name || "Contact"} deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          pending.current.delete(c.id);
          setContacts((xs) => {
            if (xs.some((x) => x.id === c.id)) return xs;
            const next = [...xs];
            next.splice(Math.min(idx, next.length), 0, c);
            return next;
          });
        },
      },
    });

    window.setTimeout(async () => {
      if (undone) return;
      try {
        await api(`/api/contacts/${c.id}`, { method: "DELETE" });
      } catch (e) {
        toast.error(`Couldn't delete ${c.name || "contact"}`, { description: (e as Error).message });
        await refresh();
      } finally {
        pending.current.delete(c.id);
      }
    }, 6000);
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
            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people…"
                aria-label="Search people"
                className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-[15px] text-fg transition-colors placeholder:text-fg-subtle hover:border-fg-subtle/50 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                  <Spinner />
                </span>
              )}
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2} /> New contact
            </Button>
          </div>
        }
      />

      {/* Customer / lead filter */}
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[13px] shadow-card">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
              tab === t.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
            <span className="tnum rounded bg-card px-1.5 text-[11px] text-fg-subtle">{t.n}</span>
          </button>
        ))}
      </div>

      {loading && contacts.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
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
              <ButtonLink href="/import">
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
                    onClick={() => setEditing(c)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditing(c);
                      }
                    }}
                    className="group cursor-pointer border-b border-border-soft transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
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
                        <IconButton label="Edit contact" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton label="Delete contact" onClick={() => remove(c)} className="hover:text-danger">
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
              <Card key={c.id} onClick={() => setEditing(c)} className="p-3.5">
                <div className="flex items-start gap-3">
                  <Monogram name={c.name || "Unnamed"} size="sm" tone="accent" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium text-fg">{c.name || "Unnamed"}</span>
                      <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 gap-0.5">
                        <IconButton label="Edit contact" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton label="Delete contact" onClick={() => remove(c)} className="hover:text-danger">
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
            ))}
          </div>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New contact">
        <ContactForm
          companies={companies}
          onSave={create}
          onCancel={() => setCreating(false)}
          submitLabel="Create contact"
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit contact">
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
