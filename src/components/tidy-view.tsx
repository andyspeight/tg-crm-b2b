"use client";

import { ReactNode, useEffect, useState } from "react";
import { Building2, Combine, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  InlineAlert,
  PageHeader,
  Spinner,
  StatTile,
} from "@/components/ui";
import { LifecycleBadge } from "@/components/badges";
import { useConfirm, useToast } from "@/components/feedback";
import { formatMoney } from "@/lib/format";

// Local shapes mirror src/lib/crm/data.ts (that module is server-only, so we don't
// import from it into this client component).
interface DupCompany {
  id: string;
  name: string;
  website?: string;
  linkedin?: string;
  lifecycleStage?: string;
  mrr?: number;
  country?: string;
  contacts: number;
  deals: number;
  activities: number;
}
interface DupContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  role?: string;
  companyName?: string;
}
interface DupGroup<T> {
  reason: string;
  primaryId: string;
  records: T[];
}
interface JunkRecord {
  id: string;
  name: string;
  reason: string;
}
interface CleanupPlan {
  duplicateCompanies: DupGroup<DupCompany>[];
  duplicateContacts: DupGroup<DupContact>[];
  junkCompanies: JunkRecord[];
  junkContacts: JunkRecord[];
}
type Keyed<T> = T & { key: string };

interface DisplayRow {
  id: string;
  title: string;
  badge?: ReactNode;
  details: string[];
}

function hostLabel(url?: string): string {
  return (url || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function TidyView() {
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [companyGroups, setCompanyGroups] = useState<Keyed<DupGroup<DupCompany>>[]>([]);
  const [contactGroups, setContactGroups] = useState<Keyed<DupGroup<DupContact>>[]>([]);
  const [junkCompanies, setJunkCompanies] = useState<JunkRecord[]>([]);
  const [junkContacts, setJunkContacts] = useState<JunkRecord[]>([]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const p = await api<CleanupPlan>("/api/cleanup");
      setCompanyGroups(p.duplicateCompanies.map((g, i) => ({ ...g, key: `c${i}` })));
      setContactGroups(p.duplicateContacts.map((g, i) => ({ ...g, key: `p${i}` })));
      setJunkCompanies(p.junkCompanies);
      setJunkContacts(p.junkContacts);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't scan for duplicates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dupCompanyCount = companyGroups.reduce((n, g) => n + g.records.length - 1, 0);
  const dupContactCount = contactGroups.reduce((n, g) => n + g.records.length - 1, 0);
  const junkCount = junkCompanies.length + junkContacts.length;
  const nothing = companyGroups.length === 0 && contactGroups.length === 0 && junkCount === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tidy up"
        description="Merge duplicate companies and people, and clear out junk — you review and confirm every change."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw size={15} strokeWidth={1.75} />} Re-scan
          </Button>
        }
      />

      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Dup. companies"
          value={String(companyGroups.length)}
          sub={dupCompanyCount ? `${dupCompanyCount} to merge` : "None found"}
          icon={<Building2 size={16} strokeWidth={1.75} />}
        />
        <StatTile
          label="Dup. people"
          value={String(contactGroups.length)}
          sub={dupContactCount ? `${dupContactCount} to merge` : "None found"}
          icon={<Users size={16} strokeWidth={1.75} />}
        />
        <StatTile
          label="Junk records"
          value={String(junkCount)}
          sub={junkCount ? "Nothing to act on" : "All clear"}
          tone={junkCount ? "warn" : undefined}
          icon={<Trash2 size={16} strokeWidth={1.75} />}
        />
      </div>

      {loading && !loaded ? (
        <Card className="flex items-center gap-2 p-6 text-[13px] text-fg-subtle">
          <Spinner /> Scanning your records for duplicates and junk…
        </Card>
      ) : nothing ? (
        <EmptyState
          icon={<Sparkles size={20} strokeWidth={1.75} />}
          title="Everything's tidy"
          hint="No duplicate companies or people, and no junk records. Re-scan any time after an import."
        />
      ) : (
        <>
          {companyGroups.length > 0 ? (
            <Section title="Duplicate companies" count={companyGroups.length}>
              {companyGroups.map((g) => (
                <DupGroupCard
                  key={g.key}
                  kind="companies"
                  reason={g.reason}
                  suggestedPrimaryId={g.primaryId}
                  rows={g.records.map((c) => ({
                    id: c.id,
                    title: c.name,
                    badge: c.lifecycleStage ? <LifecycleBadge value={c.lifecycleStage as never} /> : undefined,
                    details: [
                      hostLabel(c.website),
                      c.country || "",
                      c.mrr != null ? `${formatMoney(c.mrr)} MRR` : "",
                      `${c.contacts} ${c.contacts === 1 ? "contact" : "contacts"}`,
                      c.deals ? `${c.deals} ${c.deals === 1 ? "deal" : "deals"}` : "",
                    ].filter(Boolean),
                  }))}
                  onMerged={() => setCompanyGroups((gs) => gs.filter((x) => x.key !== g.key))}
                />
              ))}
            </Section>
          ) : null}

          {contactGroups.length > 0 ? (
            <Section title="Duplicate people" count={contactGroups.length}>
              {contactGroups.map((g) => (
                <DupGroupCard
                  key={g.key}
                  kind="contacts"
                  reason={g.reason}
                  suggestedPrimaryId={g.primaryId}
                  rows={g.records.map((c) => ({
                    id: c.id,
                    title: c.name,
                    badge: c.companyName ? <Badge color="neutral">{c.companyName}</Badge> : undefined,
                    details: [c.email || "", c.phone || "", c.role || ""].filter(Boolean),
                  }))}
                  onMerged={() => setContactGroups((gs) => gs.filter((x) => x.key !== g.key))}
                />
              ))}
            </Section>
          ) : null}

          {junkCount > 0 ? (
            <Section title="Junk records" count={junkCount}>
              {junkCompanies.length > 0 ? (
                <JunkList
                  type="companies"
                  noun="company"
                  nounPlural="companies"
                  icon={<Building2 size={15} strokeWidth={1.75} />}
                  records={junkCompanies}
                  onDeleted={(ids) =>
                    setJunkCompanies((rs) => rs.filter((r) => !ids.includes(r.id)))
                  }
                />
              ) : null}
              {junkContacts.length > 0 ? (
                <JunkList
                  type="contacts"
                  noun="person"
                  nounPlural="people"
                  icon={<Users size={15} strokeWidth={1.75} />}
                  records={junkContacts}
                  onDeleted={(ids) =>
                    setJunkContacts((rs) => rs.filter((r) => !ids.includes(r.id)))
                  }
                />
              ) : null}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-subtle">{title}</h2>
        <span className="tnum rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-fg-muted">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function DupGroupCard({
  reason,
  rows,
  suggestedPrimaryId,
  kind,
  onMerged,
}: {
  reason: string;
  rows: DisplayRow[];
  suggestedPrimaryId: string;
  kind: "companies" | "contacts";
  onMerged: () => void;
}) {
  const [primaryId, setPrimaryId] = useState(suggestedPrimaryId);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const primary = rows.find((r) => r.id === primaryId);
  const secondaries = rows.filter((r) => r.id !== primaryId && !excluded.has(r.id));

  function toggle(id: string) {
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function merge() {
    if (!secondaries.length || !primary) return;
    const n = secondaries.length;
    const ok = await confirm({
      tone: "default",
      title: `Merge ${n} ${n === 1 ? "record" : "records"} into ${primary.title || "the kept record"}?`,
      message:
        kind === "companies"
          ? "Contacts, deals, activity and care touches move onto the kept company. Its blank fields are filled from the duplicates, then the duplicates are deleted."
          : "Activity moves onto the kept person. Their blank fields are filled from the duplicates, then the duplicates are deleted.",
      confirmLabel: `Merge ${n}`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api("/api/cleanup/merge", {
        method: "POST",
        body: JSON.stringify({ type: kind, primaryId, secondaryIds: secondaries.map((s) => s.id) }),
      });
      toast.success(`Merged ${n} into ${primary.title || "the kept record"}`);
      onMerged();
    } catch (e) {
      toast.error("Couldn't merge", { description: (e as Error).message });
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Badge color="info">{reason}</Badge>
        <span className="text-[12px] text-fg-subtle">{rows.length} records</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const isPrimary = r.id === primaryId;
          const merging = !isPrimary && !excluded.has(r.id);
          return (
            <label
              key={r.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                isPrimary
                  ? "border-accent/40 bg-accent-soft/40"
                  : merging
                    ? "border-border bg-surface hover:border-fg-subtle/40"
                    : "border-border-soft bg-muted/30 opacity-60",
              )}
            >
              <input
                type="radio"
                name={`primary-${suggestedPrimaryId}`}
                checked={isPrimary}
                onChange={() => setPrimaryId(r.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--accent-strong)]"
                aria-label={`Keep ${r.title}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-fg">{r.title || "(no name)"}</span>
                  {r.badge}
                  {isPrimary ? <Badge color="success">Keep</Badge> : null}
                </div>
                {r.details.length ? (
                  <p className="mt-0.5 truncate text-[12.5px] text-fg-subtle">{r.details.join(" · ")}</p>
                ) : null}
              </div>
              {!isPrimary ? (
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-fg-muted">
                  <input
                    type="checkbox"
                    checked={merging}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 accent-[color:var(--accent-strong)]"
                    aria-label={`Merge ${r.title} in`}
                  />
                  Merge
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] text-fg-subtle">
          Keeping <span className="font-medium text-fg-muted">{primary?.title || "—"}</span>
        </p>
        <Button size="sm" onClick={merge} disabled={busy || secondaries.length === 0}>
          {busy ? <Spinner /> : <Combine size={15} strokeWidth={1.75} />} Merge{" "}
          {secondaries.length ? secondaries.length : ""}
        </Button>
      </div>
    </Card>
  );
}

function JunkList({
  type,
  noun,
  nounPlural,
  icon,
  records,
  onDeleted,
}: {
  type: "companies" | "contacts";
  noun: string;
  nounPlural: string;
  icon: ReactNode;
  records: JunkRecord[];
  onDeleted: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(records.map((r) => r.id)));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const ids = records.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allSelected = ids.length === records.length && records.length > 0;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(records.map((r) => r.id)));
  }

  async function del() {
    if (!ids.length) return;
    const ok = await confirm({
      title: `Delete ${ids.length} ${ids.length === 1 ? noun : nounPlural}?`,
      message: "These records have nothing useful on them. This can't be undone.",
      confirmLabel: `Delete ${ids.length}`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api("/api/cleanup/delete", { method: "POST", body: JSON.stringify({ type, ids }) });
      toast.success(`Deleted ${ids.length} ${ids.length === 1 ? noun : nounPlural}`);
      onDeleted(ids);
    } catch (e) {
      toast.error("Couldn't delete", { description: (e as Error).message });
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-fg-muted">
            {icon}
          </span>
          {records.length} junk {records.length === 1 ? noun : nounPlural}
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="text-[12px] font-medium text-accent-strong hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <ul className="mb-3 divide-y divide-border-soft">
        {records.map((r) => (
          <li key={r.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="h-4 w-4 accent-[color:var(--accent-strong)]"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{r.name}</span>
              <span className="shrink-0 text-[11px] text-fg-subtle">{r.reason}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button variant="danger" size="sm" onClick={del} disabled={busy || ids.length === 0}>
          {busy ? <Spinner /> : <Trash2 size={15} strokeWidth={1.75} />} Delete {ids.length || ""}
        </Button>
      </div>
    </Card>
  );
}
