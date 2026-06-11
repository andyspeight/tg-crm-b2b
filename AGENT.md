[tg-b2b-crm-brief (1).md](https://github.com/user-attachments/files/28837222/tg-b2b-crm-brief.1.md)
# Luna Desk — TG B2B CRM — Build Brief for Claude Code (v1.1)

**Project:** Luna Desk — Travelgenix's own B2B CRM (repo: `tg-crm-b2b`)
**Owner:** Andy Speight, CEO, Travelgenix
**Date:** 10 June 2026 (v1.1 — decisions locked, intelligence layer added)
**Status:** Brief approved → scaffold Stage 1

---

## 1. What this is and why it exists

Travelgenix currently runs its own sales and account management on Monday CRM. This project replaces Monday with a purpose-built, AI-powered B2B CRM that does two jobs:

1. **New business outreach** — manage the full prospect-to-customer pipeline for selling Travelgenix to travel agents, tour operators, OTAs, homeworkers and consortia.
2. **Existing customer care** — a structured care programme across ~300 SME clients (80% UK, 6 countries) so no client "wilts" post-sale. Post-go-live wilting is the company's #1 identified churn driver; this CRM is the internal engine that makes care proactive instead of reactive.

This is **not** the travel CRM product (`travelgenix-crm` / Luna Work CRM — that's a CRM *for travel agents about their travellers*). Luna Desk is Travelgenix's internal B2B system about Travelgenix's own prospects and clients. Keep them completely separate: separate repo, separate data store, separate deployment.

Design philosophy (from current AI-native CRM research — Attio, Folk, Day.ai class):
- **Zero-admin bias.** The biggest failure of legacy CRMs is that they're filing cabinets you have to feed. Wherever possible, data should be captured or enriched automatically (LinkedIn, web, email, calendar), not typed in.
- **AI is the architecture, not a bolt-on.** Every record should be AI-readable; every screen should have an AI action that saves time.
- **Relationship-first, simple, fast.** One person plus a small AI-first team uses this daily. Optimise for "open it on a phone, know exactly what to do next in 10 seconds."
- **Marketing is native, not stitched on.** The big gap in tools like Attio is no native outreach/marketing — we already own Luna Marketing, so the CRM↔Luna Marketing link is the differentiator and a P0 integration.

---

## 2. Users

- **Andy** — CEO, owns sales and marketing personally. Primary daily user. Mobile-heavy.
- **Small internal team** — occasional users (view pipeline, log activity, run care touches).
- No external/client access ever. Internal tool only.

---

## 3. Stack, repo and conventions — DECISIONS LOCKED

- **Name:** Luna Desk. Repo `tg-crm-b2b`, developed via Claude Code on the web, committing directly to GitHub (the tg-onboarding pattern). No paste-into-GitHub workflow for this repo.
- **Framework:** Next.js (App Router) + TypeScript + Tailwind v4. Deploy on Vercel, team `agendasgroup`.
- **Canonical brief:** this document becomes `AGENTS.md` at repo root; repo `CLAUDE.md` is a one-line `@AGENTS.md` pointer.
- **Skills:** port Andy's skills into `.claude/skills/` exactly as done in tg-onboarding: `travelgenix-design`, `travelgenix-taste`, `travelgenix-security`, `travelgenix-humanizer`, `airtable-operations`, `project-handover`, `frontend-design`. Consult design + security skills before any UI or API code.
- **Data store: Airtable (LOCKED).** A new dedicated base, "TG B2B CRM". Rationale: (a) scale is small (~300 customers + low-thousands of prospects), (b) Luna Marketing already lives in Airtable (`appSoIlSe0sNaJ4BZ`) so segment/campaign linking is trivial, (c) Andy can inspect and hand-edit data, (d) the airtable-operations skill gives full automation. All Airtable access is **server-side only** via Next.js API routes — the API key must never reach the client.
- **Data-swap layer:** all data access behind `src/lib/crm/data.ts` so the backend could be swapped to Supabase later without touching UI.
- **AI:** Anthropic API, called server-side. Centralise prompts in `src/lib/ai/` with one module per AI feature.
- **External data:** Bright Data is the default provider for LinkedIn data, enrichment and signal monitoring (see §7) — calls wrapped in `src/lib/intel/` behind a provider interface so it can be swapped. **Only public-data, ToS-cautious methods**: structured dataset/scraper APIs. Never fake accounts, never logged-in LinkedIn automation — that approach got Proxycurl sued out of existence by LinkedIn in 2025/26.
- **Auth (LOCKED):** behind Travelgenix Control SSO (`tg_session` cookie on `.travelify.io`, `tg-auth-gate.js` pattern) from day one. If first deploys land off the travelify domain, a server-checked password gate is the temporary stand-in — never an open deploy. **No unauthenticated access to any API route or page.** Lesson learned from `travelgenix-crm`: its Supabase tables shipped with RLS off and exposed PII — do not repeat the class of mistake.
- **Build style:** staged builds, never big-bang. Each stage deployable and usable on its own.

---

## 4. Data model (Airtable tables)

Create the base programmatically per the airtable-operations skill. Field-level detail is left to the build session, but the tables and key fields are:

**Companies** (the account — primary object)
- Name, website, type (Travel Agent / Tour Operator / OTA / Homeworker / Consortium / Niche Specialist / Partner / Other), country, region (UK / non-UK), LinkedIn URL, socials
- Lifecycle stage: `Prospect → Engaged → Opportunity → Customer → At Risk → Lost / Churned`
- For customers: plan/tier, MRR, go-live date, renewal/anniversary date, account health (Green/Amber/Red), care cadence, last meaningful contact (computed from Activities), products used
- Enrichment fields: company description, size band, enriched-at timestamp, enrichment source
- Watchlist flag (drives signal monitoring, §7.3)
- Links: Contacts, Deals, Activities, Tasks, Care Touches, Signals, Campaign Engagement
- AI fields (written by the app): AI Brief (one-paragraph living summary), Next Best Action

**Contacts**
- Name, role, email, phone, LinkedIn URL, company link, marketing opt-in status, notes
- Enrichment fields: headline, location, enriched-at, source

**Deals** (new business pipeline) — **stages LOCKED**
- Company link, value (MRR + setup fee), stage: `New Lead → Contacted → Demo Booked → Demo Done → Proposal → Negotiation → Won → Lost`
- Source (referral, PTS/TNG partnership, inbound, outbound, LinkedIn import, event, AI Visibility tool, other), expected close date, lost reason, owner, next step + next step date

**Activities** (the timeline — append-only)
- Type (note / email / call / meeting / demo / care touch / campaign / signal), company + contact + deal links, date, summary, raw content, source (manual / Gmail / Calendly / Luna Marketing / Signal monitor / AI)

**Tasks**
- Title, due date, company/deal link, status, owner, created-by (manual vs AI-suggested)

**Care Touches** (the customer care programme) — **cadences LOCKED**
- Company link, touch type (check-in call / QBR / training nudge / feature announcement / renewal conversation / win-back), due date, status, outcome notes
- Defaults: top-tier customers monthly, standard quarterly; every customer gets ≥1 meaningful touch per quarter. Generated automatically from cadence + health.

**Signals** (news & social monitoring output — see §7.3)
- Company/contact link, signal type (news / LinkedIn post / job change / funding / award / website change / other), headline, URL, date found, relevance score, status (new / seen / actioned / dismissed)

**Campaign Engagement** (synced from Luna Marketing)
- Contact link, campaign, sent/opened/clicked, date. Read-mostly; powers "who's warm" signals.

---

## 5. Day-one feature set (P0 — Monday CRM is cancelled when these work)

1. **Today view (home screen).** Tasks due, care touches due, deals with next-step date today/overdue, plus a **Signals rail** (new intel on watched accounts) once §7.3 lands. Mobile-first. This screen alone should answer "what do I do next?"
2. **Pipeline Kanban.** Drag-and-drop deals across stages, value totals per stage, stale-deal flagging (no activity in 14 days = amber, 30 = red). Quick-add deal.
3. **Company page.** Everything about one account on one screen: details, contacts, open deal, full activity timeline, tasks, care status, signals, campaign engagement — plus the **AI Brief panel** (§6).
4. **Customer care board.** All ~300 customers filterable by health and cadence; overdue care touches surfaced loudly; one-tap "log touch" that records the outcome and schedules the next one per cadence.
5. **Quick capture.** Add a note/call/task from anywhere in ≤2 taps. Notes accept paste-dump text — AI tidies and files them.
6. **Search.** Instant fuzzy search across companies and contacts.
7. **Monday CRM migration.** One-off import: Andy exports Monday boards to CSV/Excel; an import script maps them into Companies/Contacts/Deals with a dry-run preview before writing. Existing ~300 customers seeded with default cadence + Green health, then triaged.

---

## 6. The AI layer

All AI features are server-side Anthropic API calls with prompts in `src/lib/ai/`.

- **AI Account Brief (P0).** On any company page: a generated, cached, refresh-on-demand summary — who they are, relationship history, open deal state, recent signals, risk flags, suggested next move. The flagship feature; replaces re-reading a Monday board before every call.
- **Draft outreach (P0).** From a company/contact: draft a personalised email in Travelgenix voice (humanizer rules — no AI tells, UK English, no competitor mentions), informed by enrichment + recent signals ("saw your post about X…"). Lands as a Gmail draft or copies to clipboard. **Never auto-send.**
- **Next Best Action (Stage 5).** Nightly job scores every account and writes one suggested action; the best surface on the Today view.
- **Natural-language query (Stage 5).** "UK tour operators we haven't spoken to in 60 days" → filtered view.
- **Weekly digest (Stage 5).** Monday-morning summary: pipeline movement, deals at risk, care touches missed, notable signals, wins.
- **Auto-classification (Stage 5).** Pasted notes auto-tagged; follow-ups extracted into Tasks.

---

## 7. The intelligence layer (LinkedIn import, enrichment, signal monitoring)

All three share one plumbing layer: `src/lib/intel/` wrapping Bright Data's structured-data APIs (LinkedIn profile/company datasets, SERP/news search) behind a provider interface. Bright Data is chosen because it works from public data and has the strongest legal track record in this space — the fake-account/scraper-login route is what killed Proxycurl. Budget note: Bright Data bills per record/request — every intel feature must be on-demand or watchlist-scoped, never "enrich everything nightly."

### 7.1 LinkedIn lead import (Stage 3)
- **Paste-a-URL import:** paste any LinkedIn profile or company URL into quick-add → server fetches structured data via Bright Data → preview card → one tap creates the Contact + Company, pre-filled and marked source = "LinkedIn import", lifecycle = Prospect.
- Works in bulk too: paste a list of URLs, get a preview table, import selected.
- Dedupe on import: match by LinkedIn URL, then company domain, then fuzzy name — never create duplicates silently; show "already exists → open record" instead.
- **P2 (later, not v1):** a folk-style Chrome extension that imports the profile you're viewing in one click. Design the import API route now so the extension can reuse it.
- Compliance rule baked in: public-profile data only, via the provider API. The app never asks for, stores, or automates Andy's LinkedIn login.

### 7.2 Data enrichment (Stage 3)
- **On create** (manual add, LinkedIn import, or Monday import batch): enrich Company from its website + LinkedIn company page (description, size band, socials, location) and Contact from public profile data (role, headline). AI condenses raw enrichment into the record fields and feeds the AI Brief.
- **Refresh button** on every company/contact to re-enrich on demand; stamp enriched-at + source.
- Enrichment failures degrade gracefully — a record with just a name is still a valid record.
- Migration bonus: after the Monday import, run a one-off enrichment pass over the ~300 customers so every account starts with a populated profile.

### 7.3 Signal monitoring — "always watching" (Stage 5)
- **Watchlist-scoped, not whole-database** (cost + noise control). Auto-watched: all open deals past "Contacted", all top-tier customers, all Amber/Red-health customers. Plus a manual watch toggle on any record. Roughly 50–100 watched accounts, not 2,000.
- **Vercel cron job** (daily): for each watched account, query news + public social (LinkedIn posts, X) via Bright Data search/discover for the company name, key contacts, and domain. New findings are deduped (by URL), scored for relevance by AI, written to the **Signals** table, and logged as an Activity on the company timeline.
- Signal types to catch: press/news mentions, funding/awards, LinkedIn posts by key contacts, job changes (champion moved = risk + new-door opportunity), notable website changes.
- **Surfacing:** Signals rail on the Today view (new/high-relevance first), signals strip on the company page, and signals feed both the AI Brief and Draft Outreach ("congratulate them on the award" beats cold copy). One-tap actions: dismiss / create task / draft outreach.
- Guardrails: relevance threshold before anything surfaces (no noise), per-day API call cap, and everything logged so cost is visible.

---

## 8. Integrations

- **Luna Marketing (P0, the differentiator).** Same Airtable ecosystem. Two directions:
  - *CRM → Luna:* build a segment from any CRM filter (e.g. "Amber-health UK agents") and push it as a Luna Marketing audience for a campaign.
  - *Luna → CRM:* campaign engagement (sends/opens/clicks via Brevo events already in Luna's base) syncs into Campaign Engagement and logs an Activity, so warmth shows on the company timeline.
- **Gmail (P0-lite).** Create drafts from the CRM (AI outreach). Stage 5: surface recent email threads per contact on the company page (read via Gmail search; do not build a full email client).
- **Calendly (Stage 5).** New demo booking → auto-create/advance a Deal to "Demo Booked" + log Activity.
- **tg-onboarding handoff (Stage 5).** Deal hits "Won" → create the client record that kicks off the onboarding journey in tg-onboarding; CRM lifecycle → Customer with starter care cadence. Design the seam now (a `handoff` function in the data layer); wire it when tg-onboarding's backend lands.

---

## 9. Non-goals (do not build in v1)

- No traveller/booking data of any kind — that's Luna Work CRM's world.
- No client-facing or external access.
- No full email client, calendar client, or telephony.
- No multi-step automated sequences / auto-sending — AI drafts, Andy sends.
- No LinkedIn login automation, connection-request bots, or auto-messaging — ToS suicide; see §7.1.
- No whole-database continuous monitoring — watchlist only.
- No complex reporting suite — Today view + pipeline totals + weekly digest cover v1.
- No multi-tenancy. If Luna Desk is ever productised for clients, that's a separate decision later.

---

## 10. Phasing (staged, each stage shippable)

- **Stage 1 — Skeleton + data.** Repo scaffold, auth gate, Airtable base created, data layer, Companies/Contacts/Deals CRUD, search, company page (no AI yet). Monday import run.
- **Stage 2 — Working CRM.** Today view, pipeline Kanban, activities, tasks, quick capture, customer care board + cadence engine. *Monday can be cancelled at the end of Stage 2/3.*
- **Stage 3 — AI + intel core.** AI Account Brief, draft outreach (Gmail drafts), LinkedIn paste-import (§7.1), enrichment on create + refresh (§7.2), one-off enrichment pass over migrated customers.
- **Stage 4 — Luna Marketing link.** Segments out, engagement in.
- **Stage 5 — Proactive layer.** Signal monitoring cron + Signals rail (§7.3), Next Best Action, weekly digest, NL query, Calendly, Gmail thread view, auto-classification, tg-onboarding handoff.
- **Later/P2:** Chrome extension for one-click LinkedIn import.

---

## 11. Design & quality bar

- Consult `travelgenix-design`, `travelgenix-taste` and `frontend-design` skills before UI work. Internal-tool preset: calm, dense-but-breathable, fast, zero gimmicks. Mobile-first for Today view and quick capture; desktop-optimised for Kanban and care board.
- UK English everywhere. Travelgenix voice for any generated copy; run humanizer rules on AI output.
- Security checklist (`travelgenix-security`) before every deploy: server-side keys only (Airtable, Anthropic, Bright Data), auth on every route, input validation on all writes, rate limiting on AI and intel endpoints, external API spend capped and logged.

---

## 12. Success criteria

- Monday CRM subscription cancelled within ~4 weeks of Stage 2.
- Every one of the ~300 customers has a health status, a populated enriched profile, and a scheduled next care touch.
- Zero deals with no next step + date.
- A LinkedIn lead goes from "URL pasted" to "enriched record with drafted outreach" in under two minutes.
- Andy's pre-call prep time drops from minutes of board-reading to one AI Brief read.
- Campaign warmth and account signals visible on company timelines by end of Stage 5.

---

## 13. Decisions locked (10 June 2026)

1. Name: **Luna Desk**; repo `tg-crm-b2b`.
2. Backend: **Airtable**, behind a swap layer.
3. Auth: **Travelgenix Control SSO from day one** (password gate only as off-domain stopgap).
4. Pipeline stages: the 8 stages in §4 as written.
5. Care cadences: top-tier monthly, standard quarterly, every customer ≥1 touch/quarter.
6. Intel provider: **Bright Data**, public-data methods only; no LinkedIn login automation ever.
7. AI drafts outreach but **never auto-sends**.

## 14. Remaining to-dos for Andy

1. **Monday export** — export the Monday boards to CSV when Stage 1 starts (and note which boards exist).
2. **Bright Data account** — confirm an account/API key exists (the Bright Data tooling is already in the skills stack) and set a monthly spend cap for enrichment + monitoring.
