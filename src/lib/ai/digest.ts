import "server-only";
import { anthropic, textFrom } from "./client";
import { activityRecency, listCareBoard, listCompanies, listDeals, listOpenTasks } from "@/lib/crm/data";
import { computeNextActions } from "@/lib/crm/next-actions";
import type { CareTouch } from "@/lib/crm/types";

/** Fast model — the digest is a narrative over facts we compute deterministically. */
const MODEL = "claude-sonnet-5";

export interface DigestFacts {
  openDeals: number;
  openMrr: number;
  closingThisWeek: { count: number; mrr: number };
  atRisk: { name: string; health: string }[];
  overdueCare: number;
  careDueThisWeek: number;
  tasksDueThisWeek: number;
  staleDeals: number;
  topPriorities: { label: string; company: string }[];
}

export interface Digest {
  generatedFor: string;
  facts: DigestFacts;
  narrative: string;
}

const DAY = 86_400_000;
const isOpen = (stage?: string) => stage !== "Won" && stage !== "Lost";

export async function generateDigest(): Promise<Digest> {
  const [companies, deals, recency, careBoard, tasks] = await Promise.all([
    listCompanies(),
    listDeals(),
    activityRecency(),
    listCareBoard(),
    listOpenTasks(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);

  const nextTouchByCompany = new Map<string, CareTouch>();
  for (const { company, nextTouch } of careBoard) {
    if (nextTouch && company.id) nextTouchByCompany.set(company.id, nextTouch);
  }

  const openDealList = deals.filter((d) => isOpen(d.stage));
  const openMrr = openDealList.reduce((t, d) => t + (d.mrr ?? 0), 0);

  const closing = openDealList.filter(
    (d) => d.expectedCloseDate && d.expectedCloseDate >= today && d.expectedCloseDate <= weekAhead,
  );

  const atRisk = companies
    .filter((c) => c.lifecycleStage === "Customer" && (c.accountHealth === "Amber" || c.accountHealth === "Red"))
    .sort((a, b) => (a.accountHealth === "Red" ? -1 : 1) - (b.accountHealth === "Red" ? -1 : 1))
    .slice(0, 8)
    .map((c) => ({ name: c.name, health: c.accountHealth as string }));

  let overdueCare = 0;
  let careDueThisWeek = 0;
  for (const { nextTouch } of careBoard) {
    const due = nextTouch?.dueDate;
    if (!due) continue;
    if (due < today) overdueCare += 1;
    else if (due <= weekAhead) careDueThisWeek += 1;
  }

  const tasksDueThisWeek = tasks.filter(
    (t) => t.status !== "Done" && t.dueDate && t.dueDate >= today && t.dueDate <= weekAhead,
  ).length;

  const staleDeals = openDealList.filter((d) => {
    const last = recency.byDeal[d.id] || (d.companyId ? recency.byCompany[d.companyId] : undefined) || d.createdTime;
    if (!last) return false;
    const t = Date.parse(last);
    return !Number.isNaN(t) && Date.now() - t >= 14 * DAY;
  }).length;

  const nextActions = computeNextActions(
    { companies, deals, nextTouchByCompany, lastByCompany: recency.byCompany, lastByDeal: recency.byDeal },
    6,
  );
  const topPriorities = nextActions.map((a) => ({ label: a.label, company: a.companyName }));

  const facts: DigestFacts = {
    openDeals: openDealList.length,
    openMrr,
    closingThisWeek: { count: closing.length, mrr: closing.reduce((t, d) => t + (d.mrr ?? 0), 0) },
    atRisk,
    overdueCare,
    careDueThisWeek,
    tasksDueThisWeek,
    staleDeals,
    topPriorities,
  };

  const system = `You write Andy's Monday-morning briefing for Luna Desk, Travelgenix's internal B2B CRM.

Voice: calm, direct, British — a sharp colleague, not a chatbot. UK English. No throat-clearing, no "I hope this finds you well", no emoji, no headings like "Executive summary". Money in GBP with £ (MRR is monthly, e.g. £1,200/mo).

Use ONLY the FACTS given. Never invent names, numbers or events. If a section has nothing, say so in a few words rather than padding.

Format: one short opening line, then a few compact labelled lines — Focus, At risk, Care, Pipeline — each a sentence or a couple of tight clauses. Finish with a single line: the one thing to get done this week. Keep the whole thing under 180 words.`;

  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: `Today is ${today}.\n\nFACTS:\n${JSON.stringify(facts, null, 2)}` }],
  });

  return { generatedFor: today, facts, narrative: textFrom(msg) };
}
