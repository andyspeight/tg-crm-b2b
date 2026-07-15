"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Pencil, Plus, Search, SearchX, Trash2, Users } from "lucide-react";
import { api } from "@/lib/client";
import type { Contact } from "@/lib/crm/types";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Modal,
  Monogram,
  PageHeader,
  SkeletonRow,
  Spinner,
} from "@/components/ui";
import { ContactForm, type CompanyOption } from "@/components/forms";

export function ContactsView({
  initial,
  companies,
}: {
  initial: Contact[];
  companies: CompanyOption[];
}) {
  const [contacts, setContacts] = useState<Contact[]>(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const first = useRef(true);

  async function refresh(term = q) {
    setLoading(true);
    try {
      const data = await api<{ contacts: Contact[] }>(
        `/api/contacts${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`,
      );
      setContacts(data.contacts);
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
    await api("/api/contacts", { method: "POST", body: JSON.stringify(payload) });
    setCreating(false);
    await refresh();
  }
  async function update(payload: Record<string, unknown>) {
    if (!editing) return;
    await api(`/api/contacts/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(null);
    await refresh();
  }
  async function remove(c: Contact) {
    if (!confirm(`Delete ${c.name}?`)) return;
    await api(`/api/contacts/${c.id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        description={`${contacts.length} ${contacts.length === 1 ? "record" : "records"}`}
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
                placeholder="Search contacts…"
                aria-label="Search contacts"
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

      {loading && contacts.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={q ? <SearchX size={20} strokeWidth={1.75} /> : <Users size={20} strokeWidth={1.75} />}
          title={q ? "No contacts match your search" : "No contacts yet"}
          hint={
            q
              ? "Try a different name, company or email."
              : "Import contacts from Monday, or add one with the New button above."
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
            <table className="w-full min-w-[680px] text-[14px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Name
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Role
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Company
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Email
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    Phone
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-border-soft transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <td className="relative px-4 py-3">
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="flex items-center gap-3">
                        <Monogram name={c.name || "Unnamed"} size="sm" tone="accent" />
                        <span className="font-medium text-fg">{c.name || "Unnamed"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{c.role ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.companyId ? (
                        <Link
                          href={`/companies/${c.companyId}`}
                          className="text-fg hover:text-accent-strong"
                        >
                          {c.companyName || "Company"}
                        </Link>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="hover:text-accent-strong">
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-fg-muted">
                      {c.phone ?? <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                        <IconButton label="Edit contact" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton
                          label="Delete contact"
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

          {/* Mobile card list */}
          <div className="luna-fade space-y-2.5 sm:hidden">
            {contacts.map((c) => (
              <Card key={c.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <Monogram name={c.name || "Unnamed"} size="sm" tone="accent" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium text-fg">{c.name || "Unnamed"}</span>
                      <div className="flex shrink-0 gap-0.5">
                        <IconButton label="Edit contact" onClick={() => setEditing(c)}>
                          <Pencil size={16} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton
                          label="Delete contact"
                          onClick={() => remove(c)}
                          className="hover:text-danger"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </IconButton>
                      </div>
                    </div>
                    {c.role ? (
                      <p className="mt-0.5 text-[13px] text-fg-muted">{c.role}</p>
                    ) : null}
                    {c.companyId ? (
                      <Link
                        href={`/companies/${c.companyId}`}
                        className="mt-1 block text-[13px] text-fg hover:text-accent-strong"
                      >
                        {c.companyName || "Company"}
                      </Link>
                    ) : null}
                    <div className="mt-1.5 space-y-0.5 text-[13px] text-fg-muted">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="block truncate hover:text-accent-strong">
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
