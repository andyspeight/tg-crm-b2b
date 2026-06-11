"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { api } from "@/lib/client";
import type { Company, Contact, Deal } from "@/lib/crm/types";
import { Button, EmptyState, Modal } from "@/components/ui";
import { HealthBadge, LifecycleBadge, StageBadge } from "@/components/badges";
import { CompanyForm, ContactForm, DealForm } from "@/components/forms";
import { formatDate, formatMoney } from "@/lib/format";

export function CompanyView({
  company: initialCompany,
  initialContacts,
  initialDeals,
}: {
  company: Company;
  initialContacts: Contact[];
  initialDeals: Deal[];
}) {
  const router = useRouter();
  const [company, setCompany] = useState(initialCompany);
  const [contacts, setContacts] = useState(initialContacts);
  const [deals, setDeals] = useState(initialDeals);

  const [editingCompany, setEditingCompany] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [addingDeal, setAddingDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  async function refreshContacts() {
    const data = await api<{ contacts: Contact[] }>(`/api/contacts?companyId=${company.id}`);
    setContacts(data.contacts);
  }
  async function refreshDeals() {
    const data = await api<{ deals: Deal[] }>(`/api/deals?companyId=${company.id}`);
    setDeals(data.deals);
  }

  async function saveCompany(payload: Record<string, unknown>) {
    const data = await api<{ company: Company }>(`/api/companies/${company.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setCompany(data.company);
    setEditingCompany(false);
  }

  async function toggleWatchlist() {
    const data = await api<{ company: Company }>(`/api/companies/${company.id}`, {
      method: "PATCH",
      body: JSON.stringify({ watchlist: !company.watchlist }),
    });
    setCompany(data.company);
  }

  async function deleteCompany() {
    if (!confirm(`Delete ${company.name} and unlink its records? This cannot be undone.`)) return;
    await api(`/api/companies/${company.id}`, { method: "DELETE" });
    router.push("/companies");
  }

  async function saveContact(payload: Record<string, unknown>) {
    if (editingContact) {
      await api(`/api/contacts/${editingContact.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setEditingContact(null);
    } else {
      await api(`/api/contacts`, { method: "POST", body: JSON.stringify(payload) });
      setAddingContact(false);
    }
    await refreshContacts();
  }
  async function removeContact(c: Contact) {
    if (!confirm(`Remove ${c.name}?`)) return;
    await api(`/api/contacts/${c.id}`, { method: "DELETE" });
    await refreshContacts();
  }

  async function saveDeal(payload: Record<string, unknown>) {
    if (editingDeal) {
      await api(`/api/deals/${editingDeal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setEditingDeal(null);
    } else {
      await api(`/api/deals`, { method: "POST", body: JSON.stringify(payload) });
      setAddingDeal(false);
    }
    await refreshDeals();
  }
  async function removeDeal(d: Deal) {
    if (!confirm(`Remove ${d.name}?`)) return;
    await api(`/api/deals/${d.id}`, { method: "DELETE" });
    await refreshDeals();
  }

  return (
    <div className="space-y-5">
      <Link href="/companies" className="text-xs text-slate-400 hover:text-slate-600">
        &larr; Companies
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{company.name}</h1>
              <LifecycleBadge value={company.lifecycleStage} />
              <HealthBadge value={company.accountHealth} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              {company.type && <span>{company.type}</span>}
              {company.country && <span>{company.country}</span>}
              {company.website && (
                <a
                  href={withProtocol(company.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Website
                </a>
              )}
              {company.linkedin && (
                <a
                  href={withProtocol(company.linkedin)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  LinkedIn
                </a>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleWatchlist}
              title="Toggle watchlist"
            >
              {company.watchlist ? "★ Watching" : "☆ Watch"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingCompany(true)}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          <Section
            title="Deals"
            action={
              <Button size="sm" onClick={() => setAddingDeal(true)}>
                Add deal
              </Button>
            }
          >
            {deals.length === 0 ? (
              <EmptyState title="No deals yet" />
            ) : (
              <ul className="divide-y divide-slate-50">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {d.nextStep ? `Next: ${d.nextStep}` : "No next step"}
                        {d.nextStepDate ? ` · ${formatDate(d.nextStepDate)}` : ""}
                      </p>
                    </div>
                    <StageBadge value={d.stage} />
                    <span className="w-20 text-right text-sm text-slate-600">{formatMoney(d.mrr)}</span>
                    <RowActions onEdit={() => setEditingDeal(d)} onRemove={() => removeDeal(d)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Contacts"
            action={
              <Button size="sm" onClick={() => setAddingContact(true)}>
                Add contact
              </Button>
            }
          >
            {contacts.length === 0 ? (
              <EmptyState title="No contacts yet" />
            ) : (
              <ul className="divide-y divide-slate-50">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {c.name}
                        {c.role ? <span className="ml-2 font-normal text-slate-400">{c.role}</span> : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                    <RowActions onEdit={() => setEditingContact(c)} onRemove={() => removeContact(c)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Activity timeline">
            <EmptyState title="The timeline arrives in Stage 2" hint="Notes, calls, emails and care touches will appear here." />
          </Section>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <Section title="Details" action={null}>
            <dl className="divide-y divide-slate-50">
              <KV label="Region">{company.region ?? "—"}</KV>
              <KV label="Plan / tier">{company.planTier ?? "—"}</KV>
              <KV label="MRR">{formatMoney(company.mrr)}</KV>
              <KV label="Go-live">{formatDate(company.goLiveDate)}</KV>
              <KV label="Renewal">{formatDate(company.renewalDate)}</KV>
              <KV label="Size band">{company.sizeBand ?? "—"}</KV>
              <KV label="Care cadence">{company.careCadence ?? "—"}</KV>
              <KV label="Last contact">{formatDate(company.lastMeaningfulContact)}</KV>
            </dl>
            {company.description ? (
              <p className="mt-3 border-t border-slate-50 pt-3 text-sm text-slate-600">
                {company.description}
              </p>
            ) : null}
          </Section>

          <Section title="AI brief">
            <EmptyState title="No brief yet" hint="The AI Account Brief lands in Stage 3." />
          </Section>

          <Section title="Signals">
            <EmptyState title="No signals" hint="Watchlist monitoring arrives in Stage 5." />
          </Section>

          <button
            onClick={deleteCompany}
            className="text-xs text-slate-400 hover:text-red-600"
          >
            Delete this company
          </button>
        </div>
      </div>

      {/* Modals */}
      <Modal open={editingCompany} onClose={() => setEditingCompany(false)} title="Edit company">
        <CompanyForm
          initial={company}
          onSave={saveCompany}
          onCancel={() => setEditingCompany(false)}
          submitLabel="Save changes"
        />
      </Modal>

      <Modal
        open={addingContact || !!editingContact}
        onClose={() => {
          setAddingContact(false);
          setEditingContact(null);
        }}
        title={editingContact ? "Edit contact" : "Add contact"}
      >
        <ContactForm
          initial={editingContact ?? undefined}
          lockedCompanyId={company.id}
          onSave={saveContact}
          onCancel={() => {
            setAddingContact(false);
            setEditingContact(null);
          }}
          submitLabel={editingContact ? "Save changes" : "Add contact"}
        />
      </Modal>

      <Modal
        open={addingDeal || !!editingDeal}
        onClose={() => {
          setAddingDeal(false);
          setEditingDeal(null);
        }}
        title={editingDeal ? "Edit deal" : "Add deal"}
      >
        <DealForm
          initial={editingDeal ?? undefined}
          lockedCompanyId={company.id}
          onSave={saveDeal}
          onCancel={() => {
            setAddingDeal(false);
            setEditingDeal(null);
          }}
          submitLabel={editingDeal ? "Save changes" : "Add deal"}
        />
      </Modal>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-right text-sm text-slate-700">{children}</dd>
    </div>
  );
}

function RowActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 items-center">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-600">
        Remove
      </Button>
    </span>
  );
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
