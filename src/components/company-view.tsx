"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentType, ReactNode, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Circle,
  ExternalLink,
  Globe,
  HeartHandshake,
  Linkedin,
  ListTodo,
  Mail,
  MapPin,
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
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";
import { api } from "@/lib/client";
import type {
  Activity,
  ActivityType,
  CareTouch,
  Company,
  Contact,
  Deal,
  Task,
} from "@/lib/crm/types";
import { TOUCH_TYPES } from "@/lib/crm/config";
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Modal,
  Monogram,
  Select,
  Spinner,
  StatTile,
  Textarea,
  cn,
} from "@/components/ui";
import {
  HealthBadge,
  LifecycleBadge,
  StageBadge,
  healthColor,
  stageColor,
} from "@/components/badges";
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

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
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

const CUSTOMER_STAGES = ["Customer", "At Risk", "Lost / Churned"];
const ICON_LINK =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-muted hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function CompanyView({
  company: initialCompany,
  initialContacts,
  initialSuggestedContacts,
  initialDeals,
  initialActivities,
  initialTasks,
  initialCareTouches,
}: {
  company: Company;
  initialContacts: Contact[];
  initialSuggestedContacts: Contact[];
  initialDeals: Deal[];
  initialActivities: Activity[];
  initialTasks: Task[];
  initialCareTouches: CareTouch[];
}) {
  const router = useRouter();
  const [company, setCompany] = useState(initialCompany);
  const [contacts, setContacts] = useState(initialContacts);
  const [suggested, setSuggested] = useState(initialSuggestedContacts);
  const [deals, setDeals] = useState(initialDeals);
  const [activities, setActivities] = useState(initialActivities);
  const [tasks, setTasks] = useState(initialTasks);
  const [careTouches, setCareTouches] = useState(initialCareTouches);

  const [editingCompany, setEditingCompany] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [addingDeal, setAddingDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [loggingActivity, setLoggingActivity] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [loggingCare, setLoggingCare] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachContactId, setOutreachContactId] = useState<string | undefined>(undefined);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState("");

  const contactOptions = contacts.map((c) => ({ id: c.id, name: c.name }));
  const dealOptions = deals.map((d) => ({ id: d.id, name: d.name }));

  const isCustomer = CUSTOMER_STAGES.includes(company.lifecycleStage ?? "");
  const openDeals = deals.filter((d) => d.stage && d.stage !== "Won" && d.stage !== "Lost");
  const openPipeline = openDeals.reduce((sum, d) => sum + (d.mrr ?? 0), 0);
  const lastDays = daysSince(company.lastMeaningfulContact);
  const lastTone = lastDays == null ? undefined : lastDays > 60 ? "danger" : lastDays > 30 ? "warn" : "success";
  const nextTouch = careTouches.find((t) => t.status === "Scheduled");
  const careHistory = careTouches.filter((t) => t.status !== "Scheduled");
  const showCare = isCustomer || careTouches.length > 0;

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
  async function refreshCare() {
    const data = await api<{ touches: CareTouch[] }>(`/api/care/company/${company.id}`);
    setCareTouches(data.touches);
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
  /** Attach a domain-matched suggestion to this account. */
  async function linkSuggested(c: Contact) {
    setSuggested((s) => s.filter((x) => x.id !== c.id));
    await api(`/api/contacts/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify({ companyId: company.id }),
    });
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

  async function logCare(payload: { touchType: string; outcomeNotes: string }) {
    await api(`/api/care/company/${company.id}`, { method: "POST", body: JSON.stringify(payload) });
    setLoggingCare(false);
    await Promise.all([refreshCare(), refreshCompany()]);
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

  function openEmail(contactId?: string) {
    setOutreachContactId(contactId);
    setOutreachOpen(true);
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
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{company.name}</h1>
              <LifecycleBadge value={company.lifecycleStage} />
              <HealthBadge value={company.accountHealth} />
              {company.watchlist ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                  <Star size={11} strokeWidth={2} className="fill-current" /> Watching
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-fg-muted">
              {company.type && <span>{company.type}</span>}
              {(company.country || company.region) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} strokeWidth={1.75} className="text-fg-subtle" />
                  {company.country || company.region}
                </span>
              )}
              {company.sizeBand && <span>{company.sizeBand} staff</span>}
            </div>
            {/* External links */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {company.website && (
                <LinkChip href={withProtocol(company.website)} icon={<Globe size={13} strokeWidth={1.75} />}>
                  {hostLabel(company.website)}
                </LinkChip>
              )}
              {company.linkedin && (
                <LinkChip href={withProtocol(company.linkedin)} icon={<Linkedin size={13} strokeWidth={1.75} />}>
                  LinkedIn
                </LinkChip>
              )}
              {company.socials && (
                <LinkChip href={withProtocol(company.socials)} icon={<ExternalLink size={13} strokeWidth={1.75} />}>
                  Social
                </LinkChip>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              label={company.watchlist ? "Stop watching" : "Watch this account"}
              onClick={toggleWatchlist}
              className={company.watchlist ? "text-warning" : ""}
            >
              <Star size={17} strokeWidth={1.75} className={company.watchlist ? "fill-current" : ""} />
            </IconButton>
            <Button variant="ghost" size="sm" onClick={() => setEditingCompany(true)}>
              <Pencil size={15} strokeWidth={1.75} /> Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setLoggingActivity(true)}>
              <Plus size={15} strokeWidth={1.75} /> Log activity
            </Button>
            <Button size="sm" onClick={() => openEmail(undefined)}>
              <Mail size={15} strokeWidth={1.75} /> Email
            </Button>
          </div>
        </div>
      </div>

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isCustomer ? (
          <>
            <StatTile label="MRR" value={formatMoney(company.mrr)} />
            <StatTile
              label="Health"
              value={company.accountHealth ?? "—"}
              tone={healthTone(company.accountHealth)}
            />
            <StatTile label="Renewal" value={formatDate(company.renewalDate)} />
            <StatTile
              label="Last contact"
              value={lastDays == null ? "None" : lastDays === 0 ? "Today" : `${lastDays}d ago`}
              tone={lastTone}
            />
          </>
        ) : (
          <>
            <StatTile label="Open pipeline" value={openDeals.length ? formatMoney(openPipeline) : "—"} />
            <StatTile label="Open deals" value={String(openDeals.length)} />
            <StatTile label="People" value={String(contacts.length)} />
            <StatTile
              label="Last contact"
              value={lastDays == null ? "None" : lastDays === 0 ? "Today" : `${lastDays}d ago`}
              tone={lastTone}
            />
          </>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          {/* AI brief hero */}
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
                <div className="flex flex-col items-center py-3 text-center">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-strong">
                    <Sparkles size={20} strokeWidth={1.75} />
                  </span>
                  <p className="mb-3 max-w-sm text-[13px] text-fg-subtle">
                    A living summary of who they are, the relationship, deal state and the next move — so you
                    can prep for a call in one read.
                  </p>
                  <Button variant="secondary" onClick={generateBrief} disabled={briefLoading}>
                    {briefLoading ? <Spinner /> : <Sparkles size={15} strokeWidth={1.75} />} Generate brief
                  </Button>
                </div>
              )}
              {briefError ? (
                <div className="mt-3">
                  <InlineAlert variant="danger">{briefError}</InlineAlert>
                </div>
              ) : null}
            </div>
          </section>

          {/* People */}
          <Section
            title="People"
            count={contacts.length}
            action={
              <Button variant="secondary" size="sm" onClick={() => setAddingContact(true)}>
                <Plus size={15} strokeWidth={2} /> Add contact
              </Button>
            }
          >
            {contacts.length === 0 && suggested.length === 0 ? (
              <EmptyState
                title="No people yet"
                hint="Add the people you deal with, or run Link contacts to pull in anyone with a matching email domain."
                icon={<Users size={20} strokeWidth={1.75} />}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setAddingContact(true)}>
                    <Plus size={15} strokeWidth={2} /> Add contact
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border-soft">
                {contacts.map((c, i) => (
                  <ContactRow
                    key={c.id}
                    c={c}
                    index={i}
                    onDraft={() => openEmail(c.id)}
                    onEdit={() => setEditingContact(c)}
                    onRemove={() => removeContact(c)}
                  />
                ))}
              </ul>
            )}

            {suggested.length > 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-accent/40 bg-accent-soft/25 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <UserPlus size={14} strokeWidth={1.9} className="text-accent-strong" />
                  <p className="text-[12px] font-medium text-fg">
                    {suggested.length === 1 ? "This person shares" : "These people share"} this company&apos;s email
                    domain
                  </p>
                </div>
                <ul className="space-y-1">
                  {suggested.map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5 py-1">
                      <Monogram name={c.name} size="sm" tone="accent" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                        {c.email ? <p className="truncate text-[12px] text-fg-subtle">{c.email}</p> : null}
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => linkSuggested(c)}>
                        <Plus size={14} strokeWidth={2} /> Link
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          {/* Deals */}
          <Section
            title="Deals"
            count={deals.length}
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

          {/* Activity timeline */}
          <Section
            title="Activity"
            count={activities.length}
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
          {/* Details */}
          <Section
            title="Details"
            action={
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={enrich} disabled={enrichLoading}>
                  {enrichLoading ? <Spinner /> : <Wand2 size={14} strokeWidth={1.75} />} Enrich
                </Button>
                <IconButton label="Edit details" onClick={() => setEditingCompany(true)}>
                  <Pencil size={15} strokeWidth={1.75} />
                </IconButton>
              </div>
            }
          >
            <dl className="divide-y divide-border-soft">
              <Fact label="Type" value={company.type} onAdd={() => setEditingCompany(true)} />
              <Fact label="Region" value={company.region} onAdd={() => setEditingCompany(true)} />
              <Fact label="Country" value={company.country} onAdd={() => setEditingCompany(true)} />
              <Fact label="Size band" value={company.sizeBand} onAdd={() => setEditingCompany(true)} />
              {isCustomer ? (
                <>
                  <Fact label="Plan / tier" value={company.planTier} onAdd={() => setEditingCompany(true)} />
                  <Fact
                    label="MRR"
                    value={company.mrr != null ? formatMoney(company.mrr) : undefined}
                    onAdd={() => setEditingCompany(true)}
                  />
                  <Fact
                    label="Go-live"
                    value={company.goLiveDate ? formatDate(company.goLiveDate) : undefined}
                    onAdd={() => setEditingCompany(true)}
                  />
                  <Fact
                    label="Renewal"
                    value={company.renewalDate ? formatDate(company.renewalDate) : undefined}
                    onAdd={() => setEditingCompany(true)}
                  />
                  <Fact label="Care cadence" value={company.careCadence} onAdd={() => setEditingCompany(true)} />
                  <Fact
                    label="Last contact"
                    value={company.lastMeaningfulContact ? formatDate(company.lastMeaningfulContact) : undefined}
                  />
                </>
              ) : null}
              {company.productsUsed ? <Fact label="Products" value={company.productsUsed} /> : null}
            </dl>

            {company.description ? (
              <div className="mt-3 border-t border-border-soft pt-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">About</p>
                <p className="text-[13px] leading-relaxed text-fg-muted">{company.description}</p>
              </div>
            ) : null}

            <p className="mt-3 text-[11px] text-fg-subtle">
              {company.enrichedAt
                ? `Enriched ${formatDate(company.enrichedAt)}${company.enrichmentSource ? ` · ${company.enrichmentSource}` : ""}`
                : "Not enriched yet — Enrich fills the website, LinkedIn, size and a description."}
            </p>
            {enrichError ? (
              <div className="mt-3">
                <InlineAlert variant="danger">{enrichError}</InlineAlert>
              </div>
            ) : null}
          </Section>

          {/* Care programme */}
          {showCare ? (
            <Section
              title="Care programme"
              action={
                <Button variant="secondary" size="sm" onClick={() => setLoggingCare(true)}>
                  <HeartHandshake size={15} strokeWidth={1.75} /> Log touch
                </Button>
              }
            >
              {nextTouch ? (
                <div
                  className={cn(
                    "mb-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                    isOverdue(nextTouch.dueDate)
                      ? "border-danger/30 bg-danger/10"
                      : "border-border bg-surface",
                  )}
                >
                  <CalendarClock
                    size={16}
                    strokeWidth={1.75}
                    className={isOverdue(nextTouch.dueDate) ? "text-danger" : "text-accent-strong"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fg">{nextTouch.touchType ?? "Check-in"}</p>
                    <p className={cn("text-[12px]", isOverdue(nextTouch.dueDate) ? "text-danger" : "text-fg-subtle")}>
                      {isOverdue(nextTouch.dueDate) ? "Overdue · " : "Due "}
                      {formatDate(nextTouch.dueDate)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mb-3 text-[13px] text-fg-subtle">
                  No touch scheduled.{" "}
                  {company.careCadence && company.careCadence !== "None"
                    ? `Cadence is ${company.careCadence.toLowerCase()}.`
                    : "Set a cadence in the care board to schedule automatically."}
                </p>
              )}

              {careHistory.length > 0 ? (
                <ul className="space-y-1.5">
                  {careHistory.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[13px]">
                      <CheckCircle2
                        size={14}
                        strokeWidth={1.75}
                        className={t.status === "Completed" ? "text-success" : "text-fg-subtle"}
                      />
                      <span className="text-fg">{t.touchType ?? "Touch"}</span>
                      <span className="tnum ml-auto text-[12px] text-fg-subtle">{formatDate(t.dueDate)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>
          ) : null}

          {/* Tasks */}
          <Section
            title="Tasks"
            count={tasks.length}
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
                        className="mt-0.5 rounded-full text-fg-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      <CareLogModal open={loggingCare} onClose={() => setLoggingCare(false)} onSave={logCare} />

      <OutreachModal
        open={outreachOpen}
        onClose={() => setOutreachOpen(false)}
        company={{ id: company.id, name: company.name }}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, role: c.role }))}
        defaultContactId={outreachContactId}
      />
    </div>
  );
}

// --- sub-components ----------------------------------------------------------

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          {title}
          {count != null && count > 0 ? (
            <span className="tnum rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ContactRow({
  c,
  index,
  onDraft,
  onEdit,
  onRemove,
}: {
  c: Contact;
  index: number;
  onDraft: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const sub = [c.email, c.phone, c.location].filter(Boolean).join(" · ");
  return (
    <li
      className="luna-rise group flex items-center gap-3 py-2.5"
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
    >
      <Monogram name={c.name} size="sm" tone="accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-fg">
          {c.name}
          {c.role ? <span className="ml-2 font-normal text-fg-subtle">{c.role}</span> : null}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-fg-subtle">{sub || "No contact details"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {c.email ? (
          <a href={`mailto:${c.email}`} title={`Email ${c.name}`} aria-label={`Email ${c.name}`} className={ICON_LINK}>
            <Mail size={16} strokeWidth={1.75} />
          </a>
        ) : null}
        {c.phone ? (
          <a href={`tel:${c.phone}`} title={`Call ${c.name}`} aria-label={`Call ${c.name}`} className={ICON_LINK}>
            <Phone size={16} strokeWidth={1.75} />
          </a>
        ) : null}
        {c.linkedin ? (
          <a
            href={withProtocol(c.linkedin)}
            target="_blank"
            rel="noreferrer"
            title="LinkedIn profile"
            aria-label={`${c.name} on LinkedIn`}
            className={ICON_LINK}
          >
            <Linkedin size={16} strokeWidth={1.75} />
          </a>
        ) : null}
        <button
          onClick={onDraft}
          title="Draft an email with Luna"
          aria-label={`Draft an email to ${c.name}`}
          className={cn(ICON_LINK, "hover:text-accent-strong")}
        >
          <Sparkles size={16} strokeWidth={1.75} />
        </button>
        <span className="ml-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
          <IconButton label="Edit contact" onClick={onEdit} className="h-8 w-8">
            <Pencil size={15} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Remove contact" onClick={onRemove} className="h-8 w-8 hover:text-danger">
            <Trash2 size={15} strokeWidth={1.75} />
          </IconButton>
        </span>
      </div>
    </li>
  );
}

function Fact({ label, value, onAdd }: { label: string; value?: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-[13px] text-fg-subtle">{label}</dt>
      <dd className="text-right text-[14px] text-fg">
        {value ? (
          value
        ) : onAdd ? (
          <button
            onClick={onAdd}
            className="text-[13px] text-fg-subtle transition-colors hover:text-accent-strong"
          >
            + Add
          </button>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </dd>
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

function LinkChip({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-fg-muted transition-colors hover:border-accent-soft hover:text-accent-strong"
    >
      {icon}
      {children}
    </a>
  );
}

function CareLogModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: { touchType: string; outcomeNotes: string }) => Promise<void>;
}) {
  const [touchType, setTouchType] = useState<string>(TOUCH_TYPES[0]);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onSave({ touchType, outcomeNotes });
      setOutcomeNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log the touch");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log a care touch">
      <div className="space-y-4">
        <Field label="Touch type">
          <Select value={touchType} onChange={(e) => setTouchType(e.target.value)}>
            {TOUCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Outcome notes" hint="What happened? The next touch is scheduled automatically per cadence.">
          <Textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} />
        </Field>
        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Spinner /> : <HeartHandshake size={15} strokeWidth={1.75} />} Log touch
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- helpers -----------------------------------------------------------------

function healthTone(health?: string): "success" | "warn" | "danger" | undefined {
  const c = healthColor(health);
  if (c === "success") return "success";
  if (c === "warning") return "warn";
  if (c === "danger") return "danger";
  return undefined;
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function hostLabel(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");
}
