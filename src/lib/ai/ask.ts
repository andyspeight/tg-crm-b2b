import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, textFrom } from "./client";
import {
  activityRecency,
  getCompany,
  listActivitiesByIds,
  listCareBoard,
  listCompanies,
  listContactsByIds,
  listDeals,
  listDealsByIds,
  searchAll,
} from "@/lib/crm/data";
import {
  ACCOUNT_HEALTH,
  COMPANY_TYPES,
  DEAL_STAGES,
  LIFECYCLE_STAGES,
  REGIONS,
  TOUCH_TYPES,
} from "@/lib/crm/config";
import type { Company, Deal } from "@/lib/crm/types";

/** Fast, strong tool use for an interactive command bar. */
const ASK_MODEL = "claude-sonnet-5";
const MAX_STEPS = 5;

/** A record the answer refers to, so the UI can link straight to it. */
export interface AskResult {
  type: "company" | "contact" | "deal";
  id: string;
  name: string;
  sub?: string;
  href: string;
}

/** A write Luna has drafted; nothing happens until the user confirms it. */
export interface AskProposal {
  type: "task" | "care_touch" | "note";
  summary: string;
  params: Record<string, unknown>;
}

export interface AskResponse {
  answer: string;
  results: AskResult[];
  proposals: AskProposal[];
}

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function ageDays(dateStr?: string): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

const companyHref = (id: string) => `/companies/${id}`;
const dealHref = (d: { companyId?: string }) => (d.companyId ? `/companies/${d.companyId}` : "/deals");
const contactHref = (c: { companyId?: string }) => (c.companyId ? `/companies/${c.companyId}` : "/contacts");

function compactCompany(c: Company) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    country: c.country,
    region: c.region,
    lifecycleStage: c.lifecycleStage,
    accountHealth: c.accountHealth,
    mrr: c.mrr,
    lastContact: c.lastMeaningfulContact,
  };
}

function compactDeal(d: Deal) {
  return {
    id: d.id,
    name: d.name,
    stage: d.stage,
    mrr: d.mrr,
    company: d.companyName,
    nextStep: d.nextStep,
    nextStepDate: d.nextStepDate,
  };
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search",
    description: "Fuzzy-search companies and contacts by name (and company by country/website). Use to find a specific account or person.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Name or partial name to search for." } },
      required: ["query"],
    },
  },
  {
    name: "list_companies",
    description:
      "List companies matching filters. Use for questions like 'UK tour operators we haven't spoken to in 60 days' or 'all Amber-health customers'.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: `Company type. One of: ${COMPANY_TYPES.join(", ")}.` },
        region: { type: "string", description: `One of: ${REGIONS.join(", ")}.` },
        country: { type: "string" },
        lifecycleStage: { type: "string", description: `One of: ${LIFECYCLE_STAGES.join(", ")}.` },
        accountHealth: { type: "string", description: `One of: ${ACCOUNT_HEALTH.join(", ")}.` },
        watchlist: { type: "boolean" },
        notContactedDays: {
          type: "number",
          description: "Only companies with no meaningful contact in at least this many days.",
        },
        limit: { type: "number", description: "Max rows to return (default 25, max 50)." },
      },
    },
  },
  {
    name: "list_deals",
    description:
      "List deals in the new-business pipeline, filtered. Use for 'stale deals', 'deals with no next step', 'proposals worth over £500/mo'. Open deals only unless a stage is given.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", description: `Deal stage. One of: ${DEAL_STAGES.join(", ")}.` },
        staleDays: { type: "number", description: "Only deals with no activity in at least this many days." },
        minMrr: { type: "number", description: "Minimum monthly value (MRR) in GBP." },
        missingNextStep: { type: "boolean", description: "Only deals with no next step or no next-step date." },
        limit: { type: "number", description: "Max rows (default 25, max 50)." },
      },
    },
  },
  {
    name: "pipeline_summary",
    description: "Totals across the pipeline: deal count and MRR per stage, open vs won vs lost. Use for 'how's my pipeline?'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "care_summary",
    description:
      "Customer-care overview: how many customers, the Green/Amber/Red health split, overdue care touches, and customers with no upcoming touch.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_company",
    description:
      "Full detail on one account — profile, AI brief, contacts, open deals and recent activity. Use to brief Andy before a call. Give an id (preferred) or a name.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string", description: "Company name, if the id isn't known." },
      },
    },
  },
  {
    name: "deals_closing_soon",
    description:
      "Open deals with an expected close date within the next N days. Use for 'what's closing this month?' and forecast questions.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Window in days (default 30)." } },
    },
  },
  {
    name: "recent_activity",
    description:
      "Momentum snapshot: how many deals were created and how many accounts were contacted in the last N days. Use for 'how active have we been lately?'.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Look-back window in days (default 30)." } },
    },
  },
  {
    name: "propose_task",
    description:
      "Draft a task for Andy to confirm. Use when he asks to create/add a task, reminder or to-do. Never say it's done — it is only created when he confirms.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueDate: { type: "string", description: "ISO date YYYY-MM-DD, if a due date is given." },
        companyName: { type: "string", description: "Company to link the task to, if any." },
      },
      required: ["title"],
    },
  },
  {
    name: "propose_care_touch",
    description:
      "Draft a logged care touch (a completed check-in / QBR / training nudge, etc.) for a customer, for Andy to confirm. Use when he says he has spoken to or checked in on a customer. Completing it schedules the next touch on cadence.",
    input_schema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        touchType: { type: "string", description: `One of: ${TOUCH_TYPES.join(", ")}.` },
        outcomeNotes: { type: "string", description: "What happened / the outcome." },
      },
      required: ["companyName"],
    },
  },
  {
    name: "propose_note",
    description: "Draft a note to add to a company's activity timeline, for Andy to confirm.",
    input_schema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        text: { type: "string" },
      },
      required: ["companyName", "text"],
    },
  },
];

export async function askLuna(question: string): Promise<AskResponse> {
  const refs = new Map<string, AskResult>();
  const addRef = (r: AskResult) => {
    const key = `${r.type}:${r.id}`;
    if (!refs.has(key)) refs.set(key, r);
  };
  const proposals: AskProposal[] = [];

  let recencyCache: Awaited<ReturnType<typeof activityRecency>> | null = null;
  const recency = async () => (recencyCache ??= await activityRecency());

  async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : undefined);
    const n = (k: string) => (typeof input[k] === "number" ? (input[k] as number) : undefined);
    const clampLimit = (v: number | undefined) => Math.min(v && v > 0 ? v : 25, 50);

    switch (name) {
      case "search": {
        const query = s("query") ?? "";
        if (!query.trim()) return { error: "Provide a query." };
        const { companies, contacts } = await searchAll(query, 12);
        companies.forEach((c) =>
          addRef({
            type: "company",
            id: c.id,
            name: c.name,
            sub: [c.type, c.lifecycleStage].filter(Boolean).join(" · "),
            href: companyHref(c.id),
          }),
        );
        contacts.forEach((c) =>
          addRef({ type: "contact", id: c.id, name: c.name, sub: c.companyName ?? c.role, href: contactHref(c) }),
        );
        return {
          companies: companies.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            lifecycleStage: c.lifecycleStage,
            accountHealth: c.accountHealth,
          })),
          contacts: contacts.map((c) => ({ id: c.id, name: c.name, role: c.role, company: c.companyName, email: c.email })),
        };
      }

      case "list_companies": {
        let cs = await listCompanies();
        const type = s("type");
        const region = s("region");
        const country = s("country");
        const lifecycleStage = s("lifecycleStage");
        const accountHealth = s("accountHealth");
        const notContactedDays = n("notContactedDays");
        if (type) cs = cs.filter((c) => norm(c.type) === norm(type));
        if (region) cs = cs.filter((c) => norm(c.region) === norm(region));
        if (country) cs = cs.filter((c) => norm(c.country) === norm(country));
        if (lifecycleStage) cs = cs.filter((c) => norm(c.lifecycleStage) === norm(lifecycleStage));
        if (accountHealth) cs = cs.filter((c) => norm(c.accountHealth) === norm(accountHealth));
        if (input.watchlist === true) cs = cs.filter((c) => c.watchlist);
        if (typeof notContactedDays === "number") {
          const rec = await recency();
          cs = cs.filter((c) => {
            const last = c.lastMeaningfulContact || rec.byCompany[c.id] || c.createdTime;
            const age = ageDays(last);
            return age === null || age >= notContactedDays;
          });
        }
        const total = cs.length;
        cs = cs.sort((a, b) => (b.mrr ?? 0) - (a.mrr ?? 0) || a.name.localeCompare(b.name));
        const rows = cs.slice(0, clampLimit(n("limit")));
        rows.forEach((c) =>
          addRef({
            type: "company",
            id: c.id,
            name: c.name,
            sub: [c.type, c.accountHealth].filter(Boolean).join(" · "),
            href: companyHref(c.id),
          }),
        );
        return { matched: total, showing: rows.length, companies: rows.map(compactCompany) };
      }

      case "list_deals": {
        let ds = await listDeals();
        const stage = s("stage");
        const staleDays = n("staleDays");
        const minMrr = n("minMrr");
        if (stage) ds = ds.filter((d) => norm(d.stage) === norm(stage));
        else ds = ds.filter((d) => d.stage !== "Won" && d.stage !== "Lost"); // open pipeline by default
        if (typeof minMrr === "number") ds = ds.filter((d) => (d.mrr ?? 0) >= minMrr);
        if (input.missingNextStep === true) ds = ds.filter((d) => !d.nextStep || !d.nextStepDate);
        if (typeof staleDays === "number") {
          const rec = await recency();
          ds = ds.filter((d) => {
            const last = rec.byDeal[d.id] || (d.companyId ? rec.byCompany[d.companyId] : undefined) || d.createdTime;
            const age = ageDays(last);
            return age === null || age >= staleDays;
          });
        }
        const total = ds.length;
        ds = ds.sort((a, b) => (b.mrr ?? 0) - (a.mrr ?? 0));
        const rows = ds.slice(0, clampLimit(n("limit")));
        rows.forEach((d) =>
          addRef({
            type: "deal",
            id: d.id,
            name: d.name,
            sub: [d.stage, d.companyName].filter(Boolean).join(" · "),
            href: dealHref(d),
          }),
        );
        return { matched: total, showing: rows.length, deals: rows.map(compactDeal) };
      }

      case "pipeline_summary": {
        const ds = await listDeals();
        const byStage = new Map<string, { count: number; mrr: number }>();
        for (const d of ds) {
          const key = d.stage || "Unknown";
          const e = byStage.get(key) || { count: 0, mrr: 0 };
          e.count += 1;
          e.mrr += d.mrr ?? 0;
          byStage.set(key, e);
        }
        const sum = (arr: Deal[]) => ({ count: arr.length, mrr: arr.reduce((t, d) => t + (d.mrr ?? 0), 0) });
        const open = ds.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
        return {
          totalDeals: ds.length,
          open: sum(open),
          won: sum(ds.filter((d) => d.stage === "Won")),
          lost: sum(ds.filter((d) => d.stage === "Lost")),
          stages: DEAL_STAGES.map((st) => ({ stage: st, ...(byStage.get(st) || { count: 0, mrr: 0 }) })),
        };
      }

      case "care_summary": {
        const rows = await listCareBoard();
        const today = new Date().toISOString().slice(0, 10);
        const health = { Green: 0, Amber: 0, Red: 0 };
        const overdue: typeof rows = [];
        let noUpcoming = 0;
        for (const r of rows) {
          const h = r.company.accountHealth;
          if (h && h in health) health[h] += 1;
          if (!r.nextTouch) noUpcoming += 1;
          else if ((r.nextTouch.dueDate || "9999-99-99") < today) overdue.push(r);
        }
        overdue.sort((a, b) => (a.nextTouch?.dueDate || "").localeCompare(b.nextTouch?.dueDate || ""));
        const shown = overdue.slice(0, 15);
        shown.forEach((r) =>
          addRef({
            type: "company",
            id: r.company.id,
            name: r.company.name,
            sub: `care due ${r.nextTouch?.dueDate ?? "?"}`,
            href: companyHref(r.company.id),
          }),
        );
        return {
          customers: rows.length,
          health,
          overdueCount: overdue.length,
          noUpcomingCount: noUpcoming,
          overdue: shown.map((r) => ({
            id: r.company.id,
            name: r.company.name,
            health: r.company.accountHealth,
            dueDate: r.nextTouch?.dueDate,
            touchType: r.nextTouch?.touchType,
          })),
        };
      }

      case "get_company": {
        let id = s("id") ?? "";
        const name = s("name") ?? "";
        if (!id && name) {
          const { companies } = await searchAll(name, 5);
          const match = companies.find((c) => norm(c.name) === norm(name)) || companies[0];
          if (!match) return { error: `No company found matching "${name}".` };
          id = match.id;
        }
        if (!id) return { error: "Provide a company id or name." };
        const company = await getCompany(id);
        const [contacts, deals, activities] = await Promise.all([
          listContactsByIds(company.contactIds),
          listDealsByIds(company.dealIds),
          listActivitiesByIds(company.activityIds),
        ]);
        const openDeals = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
        addRef({
          type: "company",
          id: company.id,
          name: company.name,
          sub: [company.type, company.accountHealth].filter(Boolean).join(" · "),
          href: companyHref(company.id),
        });
        contacts.forEach((c) => addRef({ type: "contact", id: c.id, name: c.name, sub: c.role, href: contactHref(c) }));
        openDeals.forEach((d) => addRef({ type: "deal", id: d.id, name: d.name, sub: d.stage, href: dealHref(d) }));
        const recent = activities
          .slice()
          .sort((a, b) => (b.date || b.createdTime || "").localeCompare(a.date || a.createdTime || ""))
          .slice(0, 6);
        return {
          company: {
            ...compactCompany(company),
            description: company.description,
            aiBrief: company.aiBrief,
            nextBestAction: company.nextBestAction,
            goLiveDate: company.goLiveDate,
            renewalDate: company.renewalDate,
            careCadence: company.careCadence,
          },
          contacts: contacts.map((c) => ({ id: c.id, name: c.name, role: c.role, email: c.email })),
          openDeals: openDeals.map(compactDeal),
          recentActivity: recent.map((a) => ({ date: a.date || a.createdTime, type: a.type, summary: a.summary })),
        };
      }

      case "deals_closing_soon": {
        const days = n("days") ?? 30;
        const today = new Date().toISOString().slice(0, 10);
        const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
        const ds = (await listDeals())
          .filter((d) => d.stage !== "Won" && d.stage !== "Lost")
          .filter((d) => d.expectedCloseDate && d.expectedCloseDate >= today && d.expectedCloseDate <= until)
          .sort((a, b) => (a.expectedCloseDate || "").localeCompare(b.expectedCloseDate || ""));
        const rows = ds.slice(0, 25);
        rows.forEach((d) =>
          addRef({
            type: "deal",
            id: d.id,
            name: d.name,
            sub: [d.stage, d.expectedCloseDate].filter(Boolean).join(" · "),
            href: dealHref(d),
          }),
        );
        return { days, count: ds.length, totalMrr: ds.reduce((t, d) => t + (d.mrr ?? 0), 0), deals: rows.map(compactDeal) };
      }

      case "recent_activity": {
        const days = n("days") ?? 30;
        const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        const deals = await listDeals();
        const newDeals = deals.filter((d) => (d.createdTime || "").slice(0, 10) >= cutoff);
        const rec = await recency();
        const accountsContacted = Object.values(rec.byCompany).filter((dt) => (dt || "").slice(0, 10) >= cutoff).length;
        newDeals.slice(0, 10).forEach((d) => addRef({ type: "deal", id: d.id, name: d.name, sub: d.stage, href: dealHref(d) }));
        return {
          days,
          newDealsCount: newDeals.length,
          newDealsMrr: newDeals.reduce((t, d) => t + (d.mrr ?? 0), 0),
          accountsContacted,
          newDeals: newDeals.slice(0, 10).map(compactDeal),
        };
      }

      case "propose_task": {
        const title = (s("title") ?? "").trim();
        if (!title) return { error: "A task needs a title." };
        const dueDate = s("dueDate");
        const companyName = s("companyName");
        let companyId: string | undefined;
        let resolvedName: string | undefined;
        if (companyName) {
          const { companies } = await searchAll(companyName, 3);
          const match = companies.find((c) => norm(c.name) === norm(companyName)) || companies[0];
          if (match) {
            companyId = match.id;
            resolvedName = match.name;
          }
        }
        const summary = `Create task: “${title}”${dueDate ? ` · due ${dueDate}` : ""}${resolvedName ? ` · ${resolvedName}` : ""}`;
        proposals.push({ type: "task", summary, params: { title, dueDate, companyId, companyName: resolvedName ?? companyName } });
        return { ok: true, prepared: summary, note: "Drafted — awaiting Andy's confirmation." };
      }

      case "propose_care_touch": {
        const companyName = (s("companyName") ?? "").trim();
        if (!companyName) return { error: "Which customer is this care touch for?" };
        const { companies } = await searchAll(companyName, 3);
        const match = companies.find((c) => norm(c.name) === norm(companyName)) || companies[0];
        if (!match) return { error: `No company found matching "${companyName}".` };
        const touchType = s("touchType");
        const outcomeNotes = s("outcomeNotes");
        const summary = `Log ${touchType || "care touch"} · ${match.name}${outcomeNotes ? ` — “${outcomeNotes}”` : ""}`;
        proposals.push({
          type: "care_touch",
          summary,
          params: { companyId: match.id, companyName: match.name, touchType, outcomeNotes },
        });
        return { ok: true, prepared: summary, note: "Drafted — awaiting Andy's confirmation." };
      }

      case "propose_note": {
        const companyName = (s("companyName") ?? "").trim();
        const text = (s("text") ?? "").trim();
        if (!companyName || !text) return { error: "A note needs a company and some text." };
        const { companies } = await searchAll(companyName, 3);
        const match = companies.find((c) => norm(c.name) === norm(companyName)) || companies[0];
        if (!match) return { error: `No company found matching "${companyName}".` };
        const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;
        proposals.push({
          type: "note",
          summary: `Note on ${match.name}: “${preview}”`,
          params: { companyId: match.id, companyName: match.name, text },
        });
        return { ok: true, prepared: `Note drafted for ${match.name}`, note: "Awaiting Andy's confirmation." };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = `You are Luna, the assistant inside Luna Desk — Travelgenix's internal B2B CRM. You answer questions about Travelgenix's own prospects and customers by calling the read-only tools provided. Today is ${today}.

Rules:
- Always ground answers in tool results. Never invent companies, numbers, or history. If the tools return nothing, say so plainly.
- Be brief and direct — a sentence or two, or a short list. This is a fast command bar, not a report. UK English. Show money in GBP (£); MRR is a monthly figure (e.g. £1,200/mo).
- Name the specific companies, contacts and deals you refer to; the app turns them into clickable links automatically, so never write URLs or record ids.
- Prefer one or two well-chosen tool calls. Don't over-fetch.

Vocabulary you can filter on:
- Company types: ${COMPANY_TYPES.join(", ")}
- Lifecycle stages: ${LIFECYCLE_STAGES.join(", ")}
- Regions: ${REGIONS.join(", ")}; account health: ${ACCOUNT_HEALTH.join(", ")}
- Deal stages: ${DEAL_STAGES.join(", ")} (Won and Lost are closed; the rest are open)

You can also DO a few things for Andy, always behind his confirmation:
- propose_task — draft a task, reminder or to-do
- propose_care_touch — log that he has checked in on a customer (completing it schedules the next touch on cadence)
- propose_note — add a note to a company's timeline
When he asks you to do one of these, call the matching propose_ tool with your best interpretation and resolve the company by name. Then tell him you've drafted it for confirmation — never say it is done, because nothing is written until he confirms below. If you can't tell which company he means, ask.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const isLast = step === MAX_STEPS - 1;
    const resp = await anthropic().messages.create({
      model: ASK_MODEL,
      max_tokens: 1024,
      system,
      // On the final step, drop the tools so the model must answer from what it has.
      ...(isLast ? {} : { tools: TOOLS }),
      messages,
    });

    if (!isLast && resp.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        let out: unknown;
        try {
          out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : "tool failed" };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(out).slice(0, 12_000),
        });
      }
      messages.push({ role: "assistant", content: resp.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return {
      answer: textFrom(resp) || "I couldn't find an answer to that.",
      results: [...refs.values()].slice(0, 15),
      proposals,
    };
  }

  return {
    answer: "That took too many steps — try narrowing the question.",
    results: [...refs.values()].slice(0, 15),
    proposals,
  };
}
