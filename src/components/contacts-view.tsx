"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Contact } from "@/lib/crm/types";
import { Button, ButtonLink, EmptyState, IconButton, Modal, Spinner } from "@/components/ui";
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
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Contacts</h1>
          <p className="text-[13px] text-fg-subtle">
            {contacts.length} {contacts.length === 1 ? "record" : "records"}
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
              placeholder="Search contacts..."
              aria-label="Search contacts"
              className="w-44 rounded-lg border border-border bg-surface py-2 pl-8 pr-8 text-[13px] text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64"
            />
            {loading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle">
                <Spinner />
              </span>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2} /> New contact
          </Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title={q ? "No contacts match your search" : "No contacts yet"}
          hint={
            q ? undefined : "Import contacts from Monday, or add one with the New button above."
          }
          action={
            q ? undefined : (
              <ButtonLink href="/import">
                <Download size={16} strokeWidth={2} /> Import from Monday
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[680px] text-[14px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[12px] font-medium text-fg-subtle">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-border-soft last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5 font-medium text-fg">{c.name || "Unnamed"}</td>
                  <td className="px-4 py-2.5 text-fg-muted">{c.role ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.companyId ? (
                      <Link href={`/companies/${c.companyId}`} className="text-fg hover:text-accent-strong">
                        {c.companyName || "Company"}
                      </Link>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:text-accent-strong">
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tnum px-4 py-2.5 text-fg-muted">{c.phone ?? "—"}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-0.5">
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
