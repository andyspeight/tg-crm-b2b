"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { ArrowLeft, ExternalLink, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Company, Contact, Deal } from "@/lib/crm/types";
import { Button, EmptyState, IconButton, Modal } from "@/components/ui";
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
      await api(`/api/contacts/${editingContact.id}`, { method: "PATCH", body: JSON.stringify(payload) });
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
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> Companies
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-fg">{company.name}</h1>
              <LifecycleBadge value={company.lifecycleStage} />
              <HealthBadge value={company.accountHealth} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
              {company.type && <span>{company.type}</span>}
              {company.country && <span>{company.country}</span>}
              {company.website && (
                <a
                  href={withProtocol(company.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-accent-strong"
                >
                  Website <ExternalLink size={12} strokeWidth={1.75} />
                </a>
              )}
              {company.linkedin && (
                <a
                  href={withProtocol(company.linkedin)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-accent-strong"
                >
                  LinkedIn <ExternalLink size={12} strokeWidth={1.75} />
                </a>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={toggleWatchlist}>
              <Star
                size={15}
                strokeWidth={1.75}
                className={company.watchlist ? "fill-current text-warning" : ""}
              />
              {company.watchlist ? "Watching" : "Watch"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingCompany(true)}>
              <Pencil size={15} strokeWidth={1.75} /> Edit
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
                <Plus size={15} strokeWidth={2} /> Add deal
              </Button>
            }
          >
            {deals.length === 0 ? (
              <EmptyState title="No deals yet" hint="Add the first deal to start the pipeline." />
            ) : (
              <ul className="divide-y divide-border-soft">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-fg">{d.name}</p>
                      <p className="mt-0.5 text-[13px] text-fg-subtle">
                        {d.nextStep ? `Next: ${d.nextStep}` : "No next step"}
                        {d.nextStepDate ? (
                          <span className="tnum"> · {formatDate(d.nextStepDate)}</span>
                        ) : null}
                      </p>
                    </div>
                    <StageBadge value={d.stage} />
                    <span className="tnum w-20 text-right text-[14px] text-fg-muted">
                      {formatMoney(d.mrr)}
                    </span>
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
                <Plus size={15} strokeWidth={2} /> Add contact
              </Button>
            }
          >
            {contacts.length === 0 ? (
              <EmptyState title="No contacts yet" hint="Add the people you deal with at this account." />
            ) : (
              <ul className="divide-y divide-border-soft">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-fg">
                        {c.name}
                        {c.role ? <span className="ml-2 font-normal text-fg-subtle">{c.role}</span> : null}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-fg-subtle">
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
            <EmptyState
              title="The timeline arrives in Stage 2"
              hint="Notes, calls, emails and care touches will appear here."
            />
          </Section>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <Section title="Details">
            <dl className="divide-y divide-border-soft">
              <KV label="Region">{company.region ?? "—"}</KV>
              <KV label="Plan / tier">{company.planTier ?? "—"}</KV>
              <KV label="MRR">
                <span className="tnum">{formatMoney(company.mrr)}</span>
              </KV>
              <KV label="Go-live">
                <span className="tnum">{formatDate(company.goLiveDate)}</span>
              </KV>
              <KV label="Renewal">
                <span className="tnum">{formatDate(company.renewalDate)}</span>
              </KV>
              <KV label="Size band">{company.sizeBand ?? "—"}</KV>
              <KV label="Care cadence">{company.careCadence ?? "—"}</KV>
              <KV label="Last contact">
                <span className="tnum">{formatDate(company.lastMeaningfulContact)}</span>
              </KV>
            </dl>
            {company.description ? (
              <p className="mt-3 border-t border-border-soft pt-3 text-[14px] text-fg-muted">
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
            className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle transition-colors hover:text-danger"
          >
            <Trash2 size={14} strokeWidth={1.75} /> Delete this company
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

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-[13px] text-fg-subtle">{label}</dt>
      <dd className="text-right text-[14px] text-fg">{children}</dd>
    </div>
  );
}

function RowActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <IconButton label="Edit" onClick={onEdit}>
        <Pencil size={16} strokeWidth={1.75} />
      </IconButton>
      <IconButton label="Remove" onClick={onRemove} className="hover:text-danger">
        <Trash2 size={16} strokeWidth={1.75} />
      </IconButton>
    </span>
  );
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
