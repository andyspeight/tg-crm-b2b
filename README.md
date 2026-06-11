# Luna Desk — TG B2B CRM

Travelgenix's internal B2B CRM (the Monday CRM replacement). Manages the
prospect-to-customer pipeline for selling Travelgenix, plus a structured care
programme across ~300 SME clients. Internal tool only — no external access.

The canonical build brief is **[AGENTS.md](./AGENTS.md)** (read it first).

## Stack

- Next.js (App Router) + TypeScript + Tailwind v4
- Airtable as the data store, behind a swap layer (`src/lib/crm/data.ts`)
- Deployed on Vercel (team `agendasgroup`)

## Stage 1 (this build)

Repo scaffold, password auth gate on every route, the **TG B2B CRM** Airtable base,
the server-side data layer, and Companies / Contacts / Deals CRUD + search + the
company page. No AI yet. The Monday import is the next step (awaiting CSVs).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

### Environment

All secrets are server-side only (see `.env.example`):

- `APP_PASSWORD` + `AUTH_SECRET` — the Stage 1 password gate (SSO replaces this later)
- `AIRTABLE_API_KEY` — a Personal Access Token with read/write on the base
- `AIRTABLE_BASE_ID` — defaults to the created base (`appPivSWEnuM2lAhi`)

## Structure

```
src/
  middleware.ts          Auth gate on every route
  lib/
    auth.ts              Password session (HMAC cookie); SSO seam
    airtable.ts          Server-only Airtable REST client
    crm/
      config.ts          Table IDs, field names, select option sets
      types.ts           Company / Contact / Deal types
      data.ts            THE data-swap boundary (CRUD + search + validation)
  app/
    login/               Password unlock
    api/                 Auth + companies/contacts/deals/search routes
    (app)/               Authenticated app shell + pages
  components/            UI primitives, forms, list + company views
docs/airtable-ids.md     Base / table / field ID reference (for Stage 4)
```
