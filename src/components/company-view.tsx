"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentType, ReactNode, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Circle,
  ExternalLink,
  HeartHandshake,
  ListTodo,
  Mail,
  Megaphone,
  MonitorPlay,
  Pencil,
  Phone,
  Plus,
  Radar,
  RefreshCw,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Activity, ActivityType, Company, Contact, Deal, Task } from "@/lib/crm/types";
import {
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  Modal,
  Monogram,
  Spinner,
} from "@/components/ui";
import { HealthBadge, LifecycleBadge, StageBadge, stageColor } from "@/components/badges";
import type { BadgeColor } from "@/components/ui";
import { ActivityForm, CompanyForm, ContactForm, DealForm, TaskForm } from "@/components/forms";
import { OutreachModal } from "@/components/outreach-modal";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

const ACTIVITY_ICON: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Email: Mail,
  Call: Phone,
  Meeting: Users,
  Demo: MonitorPlay,
  "Care Touch": HeartHandshake,
  Campaign: Megaphone,
  Signal: Radar,
  Note: StickyNote,
};
function activityIcon(type?: ActivityType) {
  return ACTIVITY_ICON[type ?? "Note"] ?? StickyNote;
}

/** CSS-var token per badge colour, so a row rail matches its stage badge. */
const RAIL_TOKEN: Record<BadgeColor, string> = {
  neutral: "--color-fg-subtle",
  navy: "--color-navy",
  accent: "--color-accent-strong",
  success: "--color-success",
  warning: "--color-warning",
  danger: "--color-danger",
  info: "--color-info",
};

export function CompanyView({
  company: initialCompany,
  initialContacts,
  initialDeals,
  initialActivities,
  initialTasks,
}: {
  company: Company;
  initialContacts: Contact[];
  initialDeals: Deal[];
  initialActivities: Activity[];
  initialTasks: Task[];
}) {
  const router = useRouter();
  const [company, setCompany] = useState(initialCompany);
  const [contacts, setContacts] = useState(initialContacts);
  const [deals, setDeals] = useState(initialDeals);
  const [activities, setActivities] = useState(initialActivities);
  const [tasks, setTasks] = useState(initialTasks);

  const [editingCompany, setEditingCompany] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [addingDeal, setAddingDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [loggingActivity, setLoggingActivity] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState("");

  const contactOptions = contacts.map((c) => ({ id: c.id, name: c.name }));
  const dealOptions = deals.map((d) => ({ id: d.id, name: d.name }));

  async function refreshCompany() {
    const data = await api<{ company: Company }>(`/api/companies/${company.id}`);
    setCompany(data.company);
  }
  async function refreshContacts() {
    const data = await api<{ contacts: Contact[] }>(`/api/contacts?companyId=${company.id}`);
    setContacts(data.contacts);
  }
  async function refreshDeals() {
    const data = await api<{ deals: Deal[] }>(`/api/deals?companyId=${company.id}`);
    setDeals(data.deals);
  }
  async function refreshActivities() {
    const data = await api<{ activities: Activity[] }>(`/api/activities?companyId=${company.id}`);
    setActivities(data.activities);
  }
  async function refreshTasks() {
    const data = await api<{ tasks: Task[] }>(`/api/tasks?companyId=${company.id}`);
    setTasks(data.tasks);
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

  async function logActivity(payload: Record<string, unknown>) {
    await api(`/api/activities`, { method: "POST", body: JSON.stringify(payload) });
    setLoggingActivity(false);
    await Promise.all([refreshActivities(), refreshCompany()]);
  }
  async function removeActivity(a: Activity) {
    if (!confirm("Delete this activity?")) return;
    await api(`/api/activities/${a.id}`, { method: "DELETE" });
    await refreshActivities();
  }

  async function addTask(payload: Record<string, unknown>) {
    await api(`/api/tasks`, { method: "POST", body: JSON.stringify(payload) });
    setAddingTask(false);
    await refreshTasks();
  }
  async function toggleTask(t: Task) {
    await api(`/api/tasks/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: t.status === "Done" ? "Open" : "Done" }),
    });
    await refreshTasks();
  }
  async function removeTask(t: Task) {
    await api(`/api/tasks/${t.id}`, { method: "DELETE" });
    await refreshTasks();
  }

  async function generateBrief() {
    setBriefError("");
    setBriefLoading(true);
    try {
      const data = await api<{ brief: string; nextBestAction: string }>(
        `/api/ai/brief/${company.id}`,
        { method: "POST" },
      );
      setCompany((c) => ({ ...c, aiBrief: data.brief, nextBestAction: data.nextBestAction }));
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Could not generate the brief");
    } finally {
      setBriefLoading(false);
    }
  }

  async function enrich() {
    setEnrichError("");
    setEnrichLoading(true);
    try {
      const data = await api<{ company: Company }>(`/api/intel/enrich/company/${company.id}`, {
        method: "POST",
      });
      setCompany(data.company);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Could not enrich this company");
    } finally {
      setEnrichLoading(false);
    }
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
      <div className="luna-fade rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <Monogram name={company.name} size="lg" tone="navy" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{company.name}</h1>
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
            <Button variant="ghost" size="sm" onClick={() => setEditingCompany(true)}>
              <Pencil size={15} strokeWidth={1.75} /> Edit
            </Button>
            <Button size="sm" onClick={() => setOutreachOpen(true)}>
              <Mail size={15} strokeWidth={1.75} /> Draft outreach
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
              <Button variant="secondary" size="sm" onClick={() => setAddingDeal(true)}>
                <Plus size={15} strokeWidth={2} /> Add deal
              </Button>
            }
          >
            {deals.length === 0 ? (
              <EmptyState
                title="No deals yet"
                hint="Add the first deal to start the pipeline."
                icon={<Briefcase size={20} strokeWidth={1.75} />}
              />
            ) : (
              <ul className="divide-y divide-border-soft">
                {deals.map((d, i) => (
                  <li
                    key={d.id}
                    className="luna-rise group flex items-center gap-3 py-2.5"
                    style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  >
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(${RAIL_TOKEN[stageColor(d.stage)]})` }}
                      aria-hidden
                    />
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
                    <span className="tnum w-20 text-right text-[14px] font-medium text-fg">
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
              <Button variant="secondary" size="sm" onClick={() => setAddingContact(true)}>
                <Plus size={15} strokeWidth={2} /> Add contact
              </Button>
            }
          >
            {contacts.length === 0 ? (
              <EmptyState
                title="No contacts yet"
                hint="Add the people you deal with at this account."
                icon={<Users size={20} strokeWidth={1.75} />}
              />
            ) : (
              <ul className="divide-y divide-border-soft">
                {contacts.map((c, i) => (
                  <li
                    key={c.id}
                    className="luna-rise group flex items-center gap-3 py-2.5"
                    style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  >
                    <Monogram name={c.name} size="sm" tone="accent" />
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

          <Section
            title="Activity timeline"
            action={
              <Button variant="secondary" size="sm" onClick={() => setLoggingActivity(true)}>
                <Plus size={15} strokeWidth={2} /> Log activity
              </Button>
            }
          >
            {activities.length === 0 ? (
              <EmptyState
                title="No activity yet"
                hint="Log a note, call, meeting or demo to start the timeline."
                icon={<StickyNote size={20} strokeWidth={1.75} />}
              />
            ) : (
              <ul className="luna-fade divide-y divide-border-soft">
                {activities.map((a) => {
                  const Icon = activityIcon(a.type);
                  return (
                    <li key={a.id} className="group flex gap-3 py-2.5">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-fg-subtle">
                        <Icon size={14} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="text-[14px] font-medium text-fg">{a.summary}</p>
                          <span className="tnum ml-auto shrink-0 text-[12px] text-fg-subtle">
                            {formatDateTime(a.date)}
                          </span>
                        </div>
                        {a.rawContent ? (
                          <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-fg-muted">
                            {a.rawContent}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-fg-subtle">
                          {a.type}
                          {a.source && a.source !== "Manual" ? ` · ${a.source}` : ""}
                        </p>
                      </div>
                      <IconButton
                        label="Delete activity"
                        onClick={() => removeActivity(a)}
                        className="opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                      >
                        <Trash2 size={15} strokeWidth={1.75} />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <Section
            title="Details"
            action={
              <Button variant="secondary" size="sm" onClick={enrich} disabled={enrichLoading}>
                {enrichLoading ? <Spinner /> : <RefreshCw size={14} strokeWidth={1.75} />} Enrich
              </Button>
            }
          >
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
            {company.enrichedAt ? (
              <p className="mt-2 text-[11px] text-fg-subtle">
                Enriched {formatDate(company.enrichedAt)}
                {company.enrichmentSource ? ` · ${company.enrichmentSource}` : ""}
              </p>
            ) : null}
            {enrichError ? (
              <div className="mt-3">
                <InlineAlert variant="danger">{enrichError}</InlineAlert>
              </div>
            ) : null}
          </Section>

          <Section
            title="Tasks"
            action={
              <Button variant="secondary" size="sm" onClick={() => setAddingTask(true)}>
                <Plus size={15} strokeWidth={2} /> Add
              </Button>
            }
          >
            {tasks.length === 0 ? (
              <EmptyState
                title="No tasks"
                hint="Add a follow-up so nothing slips."
                icon={<ListTodo size={20} strokeWidth={1.75} />}
              />
            ) : (
              <ul className="space-y-0.5">
                {tasks.map((t) => {
                  const done = t.status === "Done";
                  const overdue = !done && isOverdue(t.dueDate);
                  return (
                    <li key={t.id} className="group flex items-start gap-2 py-1">
                      <button
                        onClick={() => toggleTask(t)}
                        aria-label={done ? "Mark not done" : "Mark done"}
                        className="mt-0.5 text-fg-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
                      >
                        {done ? (
                          <CheckCircle2 size={16} strokeWidth={1.75} className="text-success" />
                        ) : (
                          <Circle size={16} strokeWidth={1.75} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] ${done ? "text-fg-subtle line-through" : "text-fg"}`}>
                          {t.title}
                        </p>
                        {t.dueDate ? (
                          <p className={`tnum text-[11px] ${overdue ? "text-danger" : "text-fg-subtle"}`}>
                            Due {formatDate(t.dueDate)}
                          </p>
                        ) : null}
                      </div>
                      <IconButton
                        label="Delete task"
                        onClick={() => removeTask(t)}
                        className="h-7 w-7 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <section className="rail-accent luna-fade overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between gap-2 border-b border-border-soft bg-accent-soft/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} strokeWidth={1.75} className="text-accent-strong" />
                <h2 className="text-[14px] font-semibold text-fg">AI brief</h2>
              </div>
              {company.aiBrief ? (
                <Button variant="secondary" size="sm" onClick={generateBrief} disabled={briefLoading}>
                  {briefLoading ? <Spinner /> : <RefreshCw size={14} strokeWidth={1.75} />} Refresh
                </Button>
              ) : null}
            </div>
            <div className="p-4">
              {company.aiBrief ? (
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-fg-muted">
                    {company.aiBrief}
                  </p>
                  {company.nextBestAction ? (
                    <div className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
                        Next best action
                      </p>
                      <p className="mt-0.5 text-[13px] text-fg">{company.nextBestAction}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center py-2 text-center">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-strong">
                    <Sparkles size={20} strokeWidth={1.75} />
                  </span>
                  <Button variant="secondary" onClick={generateBrief} disabled={briefLoading}>
                    {briefLoading ? <Spinner /> : <Sparkles size={15} strokeWidth={1.75} />} Generate brief
                  </Button>
                  <p className="mt-2 max-w-xs text-[12px] text-fg-subtle">
                    Summarises the account, deal state and the next move.
                  </p>
                </div>
              )}
              {briefError ? (
                <div className="mt-3">
                  <InlineAlert variant="danger">{briefError}</InlineAlert>
                </div>
              ) : null}
            </div>
          </section>

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

      <Modal open={loggingActivity} onClose={() => setLoggingActivity(false)} title="Log activity">
        <ActivityForm
          lockedCompanyId={company.id}
          contacts={contactOptions}
          deals={dealOptions}
          onSave={logActivity}
          onCancel={() => setLoggingActivity(false)}
        />
      </Modal>

      <Modal open={addingTask} onClose={() => setAddingTask(false)} title="Add task">
        <TaskForm
          lockedCompanyId={company.id}
          deals={dealOptions}
          onSave={addTask}
          onCancel={() => setAddingTask(false)}
        />
      </Modal>

      <OutreachModal
        open={outreachOpen}
        onClose={() => setOutreachOpen(false)}
        company={{ id: company.id, name: company.name }}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, role: c.role }))}
      />
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
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
    <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
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
