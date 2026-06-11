"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Contact } from "@/lib/crm/types";
import { Button, EmptyState, Modal, Spinner } from "@/components/ui";
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Contacts</h1>
          <p className="text-xs text-slate-400">{contacts.length} records</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts..."
              className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-60"
            />
            {loading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Spinner />
              </span>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>New contact</Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState title={q ? "No contacts match your search" : "No contacts yet"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
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
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{c.name || "Unnamed"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.role ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.companyId ? (
                      <Link
                        href={`/companies/${c.companyId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {c.companyName || "Company"}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:text-indigo-600">
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.phone ?? "—"}</td>
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
