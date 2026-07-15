"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Link2, Users } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Card, InlineAlert, PageHeader, Spinner, StatTile } from "@/components/ui";

interface ContactLink {
  contactId: string;
  contactName: string;
  email: string;
  companyId: string;
  companyName: string;
}

const BATCH = 100;

export function RelinkContacts() {
  const [links, setLinks] = useState<ContactLink[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);

  async function loadPlan() {
    setLoadError("");
    setLinks(null);
    setFinished(false);
    setDone(0);
    try {
      const d = await api<{ links: ContactLink[] }>("/api/contacts/relink");
      setLinks(d.links);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't work out the links");
    }
  }

  useEffect(() => {
    loadPlan();
  }, []);

  async function run() {
    if (!links) return;
    setRunning(true);
    setDone(0);
    let count = 0;
    for (let i = 0; i < links.length; i += BATCH) {
      const pairs = links.slice(i, i + BATCH).map((l) => ({
        contactId: l.contactId,
        companyId: l.companyId,
      }));
      try {
        const { linked } = await api<{ linked: number }>("/api/contacts/relink", {
          method: "POST",
          body: JSON.stringify({ pairs }),
        });
        count += linked;
      } catch {
        // keep going — a failed batch just isn't counted
      }
      setDone(Math.min(i + BATCH, links.length));
    }
    setDone(count);
    setFinished(true);
    setRunning(false);
  }

  const total = links?.length ?? 0;
  // Group the preview by company so it reads as "these people join this account".
  const byCompany = groupByCompany(links ?? []);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Link contacts to companies"
        description="Reunite imported people with their account by matching their email domain — so everyone shows up on the right company page."
      />

      {loadError ? <InlineAlert variant="danger">{loadError}</InlineAlert> : null}

      <Card className="space-y-4 p-5">
        {links === null ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-fg-subtle">
            <Spinner /> Working out who belongs where…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Can be linked" value={String(total)} tone={total ? "success" : undefined} />
              <StatTile label="Companies" value={String(byCompany.length)} />
            </div>

            {finished ? (
              <InlineAlert variant="success">
                Linked {done} {done === 1 ? "contact" : "contacts"}. They now appear on their company pages.
              </InlineAlert>
            ) : total === 0 ? (
              <p className="text-[13px] text-fg-subtle">
                Nothing to link right now. Enrich more companies (so they have a website to match on)
                and check back.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-fg-muted">
                  {running ? `Linking… ${done}/${total}` : `Ready to link ${total} people.`}
                </p>
                <Button onClick={run} disabled={running}>
                  {running ? <Spinner /> : <Link2 size={15} strokeWidth={1.75} />} Link {total}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {!finished && byCompany.length > 0 ? (
        <Card className="p-4">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Preview
          </p>
          <ul className="space-y-3">
            {byCompany.slice(0, 40).map((g) => (
              <li key={g.companyId} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong">
                  <Users size={14} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/companies/${g.companyId}`}
                    className="text-[13px] font-medium text-fg hover:text-accent-strong"
                  >
                    {g.companyName || "Unknown company"}
                  </Link>
                  <p className="truncate text-[12px] text-fg-subtle">
                    {g.people.map((p) => p.contactName).join(", ")}
                  </p>
                </div>
                <span className="tnum shrink-0 text-[12px] text-fg-subtle">{g.people.length}</span>
              </li>
            ))}
          </ul>
          {byCompany.length > 40 ? (
            <p className="mt-3 px-1 text-[12px] text-fg-subtle">
              …and {byCompany.length - 40} more companies.
            </p>
          ) : null}
        </Card>
      ) : null}

      {finished ? (
        <div className="flex items-center gap-2 px-1 text-[13px] text-success">
          <CheckCircle2 size={15} strokeWidth={2} /> Done. You can run this again after enriching more accounts.
        </div>
      ) : null}
    </div>
  );
}

function groupByCompany(links: ContactLink[]) {
  const map = new Map<string, { companyId: string; companyName: string; people: ContactLink[] }>();
  for (const l of links) {
    const g = map.get(l.companyId) ?? { companyId: l.companyId, companyName: l.companyName, people: [] };
    g.people.push(l);
    map.set(l.companyId, g);
  }
  return [...map.values()].sort((a, b) => b.people.length - a.people.length);
}
