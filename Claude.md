[CLAUDE.md](https://github.com/user-attachments/files/28837111/CLAUDE.md)
# CLAUDE.md — Contract Loader

> Development guide for Claude Code. Read this fully before touching anything. It is the single source of truth for how this repo works, what is built, what is next, and the mistakes that have already cost time. Keep it updated as you work.

---

## 1. What this is

Contract Loader is Travelgenix's **contracting engine**. Travelgenix's ~300 SME travel clients load their own directly-contracted product (hotels, villas/apartments, car hire, transfers) through a beautiful, simple admin UI. The product then becomes bookable on the Travelgenix platform.

We are the **API PROVIDER**. Consumers (the Travelgenix booking platform, agents, OTAs, third-party devs) authenticate and build **against our documented API**. We never connect outward to them. A booking is created by a consumer calling our booking API, then shows read-only in the loader.

- Live: **https://contract-loader.vercel.app**
- Repo: **andyspeight/contract-loader** (private)
- Owner: Andy Speight (CEO). Non-technical, works in the browser, has memory loss, communicates briefly. Resurface only for genuine decisions, max one question at a time.

---

## 2. How to work here (READ THIS — it is why you exist)

The old workflow was: Claude writes a whole file, Andy downloads it and uploads it to GitHub by hand, Vercel auto-deploys. That manual push loop was the bottleneck this handover removes.

**You have direct git access. Use it.**

1. Work in the repo. Edit files in place. Do NOT produce files for Andy to upload. Do NOT paste whole files into chat for manual copying.
2. **Build before you push.** `npm install --no-audit --no-fund` then `npm run build`. A green build is the gate. Never push a red build.
3. Commit with a clear message and push to `main`. Vercel auto-deploys `main` to production (Node 24.x). Preview deploys happen on branches/PRs.
4. After pushing, confirm the Vercel deployment went READY (Vercel MCP `list_deployments` / `get_deployment`), and for UI changes do a quick live check.
5. **Commit order matters.** When adding new files that import a shared helper, commit/push the shared `lib/*` file in the same push as (or before) the routes that import it. A route pushed without its helper fails the build with module-not-found.

Things Claude Code still cannot do (Andy does these in the browser):
- Set or change Vercel environment variables (Vercel UI).
- Supabase schema/data changes go through the **Supabase MCP** (`apply_migration` for DDL, `execute_sql` for data). Project ref `iexryjynfaktfbvzlwlx`.

Working preferences (Andy): staged builds over big-bang; iterate, never rebuild from scratch; no em dashes, no Oxford commas in copy; warm, direct, concise.

---

## 3. Stack and conventions

- **Next.js 14.2.x (app router), React 18.3.1, lucide-react 0.383.0, @supabase/supabase-js.**
- **NO Tailwind.** Styling is a per-page inline `<style>{CSS}</style>` block using `cl-*` class names, with a local `theme` useState toggling `data-theme` on the root `.cl-app` div (light default, dark via `.cl-app[data-theme="dark"]`).
- `app/layout.js` loads Inter via next/font and wraps all routes. **No middleware** — every new route is PUBLIC by default; `/api/v1/*` self-gates via `verifyApiKey`.
- `app/page.jsx` is one giant client component (the whole admin UI: nav + every view + every editor + the CSS block). It is large (~550 KB). Treat it with care (see the feature-drop guard in section 8).
- Client data flow: read `GET /api/state`; write `POST /api/mutate` (single action-based endpoint, `COLS` whitelists per table, **83 actions**). `account_id` is injected server-side, never trusted from the client.
- Client mutation pattern: `run(() => api("action", payload))` then `refresh()` (refetch `/api/state`). `api(action, payload)` POSTs `/api/mutate`.
- **Inline editor pattern** (used by every editor row — match it): local `f` useState seeded from props (no reset effect), `dirty = JSON.stringify(f) !== JSON.stringify(baseline)`, Save is `cl-btn-primary` when dirty and a ghost "Saved" when clean, delete is confirm-then-remove, add uses a draft row. Shared `EditActs` component renders the Save/Remove/Add cluster. Editors reuse `Field` / `Section` / `cl-cv-veh` / `cl-qgrid` / `cl-ed-row` / `cl-ed-foot` / `cl-ed-static`.

### Rate maths (generated columns, reused by accommodation, car AND transfer rates)
- `sell = gross ? base : pct ? round(base*(1+mv/100),2) : fixed ? base+mv : base`
- `cost = gross ? round(base*(1-comm/100),2) : base`

### markup_type enum — IMPORTANT asymmetry
- `contracts.markup_type` = `('percentage','fixed')` ONLY. Gross rows store `markup_type = NULL`. Same for `transfer_rate.markup_type`.
- **`car_rate.markup_type` ALSO accepts `'none'`.** Validate car rates against `[percentage, fixed, none]`. Do NOT impose the transfer null-for-gross rule on car rates. Always mirror the working create action (`carQuickLoad` / `transferQuickLoad`) for validation parity.

---

## 4. Repo structure

- `app/page.jsx` — the entire admin UI (client component).
- `app/layout.js` — root layout, Inter font.
- `app/api/state/route.js` — GET, returns `{properties, settings, cars, stations, transfers}`.
- `app/api/mutate/route.js` — POST, 83 actions, COLS whitelists, ownership-checked.
- `app/api/media/upload`, `app/api/geocode`, `app/api/extract` (AI scan), `app/api/bookings`, `app/api/cron/purge-docs`.
- `app/api/connections/route.js` + `app/connections/page.jsx` — API key minting (admin-token gated).
- `app/connect/page.jsx` + `public/contracting-api/*` — public API docs (Redoc + OpenAPI 3.1 + markdown).
- `app/api/v1/{cars,bookings}/*` — the public Contracting API (provider surface).
- `lib/` — `supabaseAdmin.js` (`getAdmin()` service-role client scoped to schema `contracts`), `account.js` (`resolveAccountId()`, demo account until SSO), `loadState.js`, `pricing.js`, `cars.js`, `transfers.js`, `facilities.js`, `media.js`, `validate.js`, `docs.js`, `metrics.js`, `apiAuth.js`, `apiHttp.js`, `carApi.js`, `bookingApi.js`.
- `vercel.json` (root) — cron for purge-docs (needs `CRON_SECRET`).

---

## 5. Infra and IDs

**Supabase** — project "Travelgenix CRM", ref `iexryjynfaktfbvzlwlx`, region eu-west-1, URL `https://iexryjynfaktfbvzlwlx.supabase.co`. Dedicated `contracts` schema, RLS ON and locked (service_role bypasses). Buckets: `contract-media` (public), `contract-docs` (private, signed-URL read).
- Demo tenant: account id `96364461-f140-4b13-b939-e075bd0bce66`, external_ref `"demo"`. Auth is stubbed to this until SSO lands.
- **After ANY DB rebuild you MUST re-apply** PostgREST schema exposure + grants or the app returns "Could not load contracts":
  `alter role authenticator set pgrst.db_schemas='public, graphql_public, luna_travel, contracts';` + `notify pgrst, 'reload schema';` + service_role grants and default privileges on the `contracts` schema.

**Vercel** — team slug `agendasgroup` (id `team_60GtIq862EeN5iuKz2mbafeR`), project id `prj_jGAsI81kpQmCzjSULv0YDMG4zy45`. Auto-deploys `main`. Node 24.x.
- Env vars (Prod + Preview, set in Vercel UI by Andy): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable, safe), `SUPABASE_SERVICE_ROLE_KEY` (secret), `ANTHROPIC_API_KEY` (secret), `CRON_SECRET` (secret), `CONTRACT_ADMIN_TOKEN` (secret — gates `/api/connections`; route fails closed 503 if unset). `NEXT_PUBLIC_*` bake in at build, so redeploy after changing them.

**Airtable** — project state row in base `appj9tksreHOwkhYg`, table `tblpyhPNhiQg3XkkT`, record `recGWPezzhPOedfqX`.

---

## 6. Database model (high level)

All in schema `contracts`, RLS locked, service_role grants only. Net/gross resolves via generated `effective_sell` / `effective_cost` on every rate table.

- **Accommodation** (~14 tables): `property` (type hotel/villa/apartment; amenities, lat/lon, nearest_airport, policies, tourist_tax), `room_unit` (beds jsonb, unit_count = physical rooms), `contract`, `rate`, `rate_period`, `supplement`, `offer`, `cancellation_band`, `stay_rule`, `allocation`, `stop_sale`, `child_age_band`, `occupancy_price`. Media on property/room_unit as `.images`/`.videos` jsonb. Facilities = `{facilities:[key], custom:[text]}`, catalogue app-held in `lib/facilities.js` (hotel vs self-catering split).
- **Car hire** (6 tables): `car_station` (collection_type enum; HAS account_id), `car_contract` (col is `sell_to` not sell_until; cancellation_policy jsonb; HAS account_id), `car_vehicle` (the bookable unit; HAS account_id), `car_rate_period` (**NO account_id**), `car_rate` (per-day length tiers min_days/max_days; **NO account_id**), `car_extra` (charge_basis enum; payable prepaid|local; HAS account_id; **COLS lacks "id" so inserts must add it explicitly**). FKs cascade except `pickup_station_id` (set null).
- **Transfers** (8 tables + 8 enums): `transfer_contract` (supplier_name is the identifier, no reference col), `transfer_point`, `transfer_route` (point_a/point_b), `transfer_vehicle` (private/shared), `transfer_rate_period`, `transfer_rate` (route+vehicle+period, NULL period = all-year), `transfer_extra`, `transfer_stop_sale`. **All transfer child rows carry account_id** so the generic `ownedRow` helper works for every one.
- **Booking view** (3 tables) + `api_key` + `car_booking` (the API's server-side booking record; driver PII is server-only and NEVER returned).

### Ownership (security-critical — every mutate action enforces this)
- Tables WITH `account_id` → generic `ownedRow(db, table, id, accountId)`.
- Tables WITHOUT `account_id` (`car_rate_period`, `car_rate`) → transitive helpers: `ownedCarPeriod` (→ car_contract_id → ownedCarContract), `ownedCarRate` (→ car_vehicle_id → ownedRow car_vehicle). `addCarRate` also verifies the vehicle and period are on the same owned contract.
- Every update/remove checks ownership BEFORE the write. No delete-by-id without an ownership check (that is an IDOR hole).

---

## 7. Current state (verified 8–9 Jun 2026)

**Live and deployed:**
- Accommodation: full loader, Stage 2 depth (supplements, offers, cancellation, stay rules, allocations, stop sales), dashboard, AI reports, media, facilities, occupancy/child pricing, geocoding, AI contract scan (Stage 1), source-doc archive (12-month retention).
- Villas/apartments: done (one villa = one property + one unit; per-week default + per-night; refundable deposit).
- Car hire: Stages 1–4 done; **per-contract EDIT mode + car-extras editor** done.
- Transfers: DB + loader + extras editor + **per-contract EDIT mode** + 9 demo contracts; live end to end.
- Edit mode: transfers and cars both have full inline per-contract editing (terms, children, rates) plus the car-extras editor. `mutate` is **83 actions** (incl 16 transfer-edit + 13 car-edit).
- Reporting: accommodation Reports, **Booking reports**, **Car reports** (separate `BookingReportsView` / `CarReportsView` with `cl-anl-*` styling). Backend = report routes + engine + `loadState` exporters (`loadBookingsAll`, `loadCarBookings`, `loadCarBookingsAll`).
- Public Contracting API: **CAR HIRE ONLY is live** (`/api/v1/cars/*` + the shared `/api/v1/bookings/*` quote→hold→confirm lifecycle), plus API keys (Stage C-1) and the OpenAPI/Redoc/`connect` docs for cars. **Accommodation and transfer endpoints are NOT built** (all paths 404 as of 9 Jun) and rate limiting is not in place. Full per-type API status and remaining work is in **API-ROADMAP.md** — read it before any `/api/v1/*` work.

**Production check (this session):** `https://contract-loader.vercel.app/api/state` returns 200 with 12 properties + cars + transfers; the live page carries both reporting and edit mode. Last `page.jsx` deploy 2026-06-07 20:19 UTC; deploys since are an unrelated auth/SSO slice.

---

## 8. Hard lessons — do not repeat these

1. **CONCURRENCY / FORK (the big one).** Multiple Claude surfaces have edited this project. A feature can be live in production but absent from a working copy, or vice versa. The reporting suite was once wiped because a `page.jsx` was replaced from a copy that never received the reporting graft. **Before replacing or heavily editing `page.jsx`, grep for the major components and confirm none are being dropped:** `BookingReportsView`, `CarReportsView`, `ReportsView`, `BookingsView`, `TransferEditor`, `CarEditor`, `TransfersView`, `CarView`. With direct git access this is far less likely, but still: edit in place, never overwrite from a stale copy.
2. **Verify ground truth before building.** Grep the code and query the DB. Do not trust a summary that says "not built". Features may already exist.
3. **Build is the gate.** Always `npm run build` green before pushing.
4. **Verify exports after a change.** A past production crash was an empty deployed `pricing.js`. Confirm a file actually exports what importers need.
5. **Diagnose before patching** (Travelgenix debug protocol): symptom → expected → actual → blast radius → regression boundary, then at least three ranked hypotheses with evidence, then fix with a predicted success signal. Hard stop after two failed fixes; never patch a patch.
6. **Mirror the working create action** (`carQuickLoad` / `transferQuickLoad`) when adding edit/validation so enums and rules stay consistent.
7. Known CSS note: `.cl-seg` is defined twice — keep the metrics one scoped to `.cl-segwrap .cl-seg`.
8. Data note: demo Faro car station country is stored as "Portugal", not ISO "PT".

---

## 9. Backlog / next steps

In rough priority:

1. **Drop 3 — WOW polish** (page.jsx only): bring the transfer result card and the transfer + car traveller previews up to the accommodation `ResultCard` / `PropertyPreview` standard.
2. **Public API (see API-ROADMAP.md for the full plan).** (a) Build the **accommodation** endpoints (read + availability/pricing honouring sellable = inventory − reservations − stop-sales − closures) and wire `product.type=accommodation` into the shared bookings lifecycle. (b) Build the **transfer** endpoints the same way (`product.type=transfer`). (c) **Stage C — RATE LIMITING `/api/v1/*` is CRITICAL and blocks any live key** (test keys only until then); add an Idempotency-Key store + structured logging. (d) Stage D — confirm the `api.travelify.io/v1` base URL, move the OpenAPI off `1.1.0-draft`, document accommodation + transfer paths, add quickstart/errors/changelog/sandbox. Cars are done.
3. Transfers join cars in the v1.1 API + a transfer bookings view.
4. Accommodation per-item EDIT for allocations / occupancy / child bands / rate periods (cars + transfers are done; accommodation rate periods are not). While there, add ownership checks to accom `addRate` / `addPeriod`.
5. Villa AI-scan; car AI-scan; vehicle image upload (car + transfer); attach/replace a source doc on an existing/manual contract.
6. Make `quickLoad` / `cloneContract` / `carQuickLoad` / `transferQuickLoad` transactional.

### Known limitations
- `/api/v1/*` not rate-limited yet (see above). `/api/connections` is admin-token gated, single shared token until SSO.
- Deleting a car/transfer vehicle that has bookings can FK-error (caught as a generic 500).
- Car/transfer rate edits cannot change the route/vehicle/period — change via remove + add.
- One provider + one station per car contract. Multi-villa complex unsupported. Scan can't represent split-period seasons.
- Booking-view data is demo until the public booking API has live consumers.

### Separate flag (different repo, not this one)
- Luna Work CRM has `public` tables RLS-disabled and API-exposed, including `public.contacts` exposing `passport_number`. Needs its own hardening sweep. Do not let that pattern near this repo: here RLS stays locked and `account_id` is always server-side.

---

## 10. Security baseline (every change must hold these)

- RLS stays ON and locked; only `service_role` (via `getAdmin()`) touches `contracts`.
- `account_id` is resolved server-side (`resolveAccountId()`), never read from the client.
- Every mutate action validates enums, whitelists columns via `COLS`, and checks ownership before any write.
- `/api/v1/*` validates the Bearer key and scopes to the key's account; non-entitled resources return 404, not 403.
- Never return driver/guest PII from the API.

---

_Keep this file current. When you finish a meaningful change, update sections 7 and 9 so the next run starts informed._
