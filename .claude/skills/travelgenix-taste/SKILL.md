---
name: travelgenix-taste
description: High-agency design taste engine for Travelgenix widgets, client portals, admin dashboards, and landing pages. Overrides default LLM design biases with tunable dials (variance, motion, density) mapped to Travelgenix tiers. Use whenever Andy asks to build, design, style, redesign, or elevate any UI — widgets, editor screens, dashboards, client sites, marketing pages. Works ALONGSIDE travelgenix-design (brand tokens and accessibility) and frontend-design (creative direction). This skill is the taste layer that stops generic AI output and forces intentional, distinctive design choices. Triggers on: "make it look better", "elevate the UI", "redesign this", "too AI", "add taste", "design review", "more creative", "less generic", "more premium", and any widget or UI build request where visual quality matters. Adapted from Leonxlnx/taste-skill with Travelgenix brand rules, widget embed context, and tier-based presets.
---

# Travelgenix Taste — High-Agency Design Engine

## 0. HOW THIS SKILL WORKS WITH THE STACK

This skill sits ON TOP of two others Andy has already installed. Read order:

1. **`travelgenix-design`** (read first) — the brand law. Tokens, fonts, colours, accessibility, Travelgenix dark mode. Anything in that skill overrides this one where they conflict.
2. **`frontend-design`** (read second) — creative direction, bold aesthetics, anti-slop principles at a general level.
3. **`travelgenix-taste`** (this file) — the tactical taste engine. Dials, forbidden patterns, widget context, tier presets.

**Conflict rule:** If this skill says "Geist" and `travelgenix-design` says "Inter" — Inter wins for anything Travelgenix-branded. Geist/Satoshi are allowed only for client-branded widget skins where the client's own brand font is specified.

---

## 1. THE THREE DIALS (TRAVELGENIX TIER PRESETS)

Every UI build declares three values up front:

- **DESIGN_VARIANCE:** 1 (perfect symmetry) → 10 (artsy asymmetric chaos)
- **MOTION_INTENSITY:** 1 (static) → 10 (cinematic physics)
- **VISUAL_DENSITY:** 1 (art gallery) → 10 (cockpit data packing)

### Default presets by context

| Context | Variance | Motion | Density | Notes |
|---|---|---|---|---|
| **Spark tier widgets** | 3 | 2 | 5 | Restrained, safe, works everywhere |
| **Boost tier widgets** | 5 | 4 | 5 | Balanced — the default |
| **Ignite tier widgets** | 7 | 6 | 4 | Premium feel, more creative licence |
| **Client-branded skin** | Match client brand | Match | Match | Whatever their brand demands |
| **TG admin dashboards** | 4 | 3 | 7 | Dense, functional, not flashy |
| **TG editor screens (widget editor, Luna Work CRM)** | 5 | 4 | 6 | Productive but polished |
| **TG marketing landing pages** | 7 | 6 | 4 | More editorial, more character |
| **Luna Chat widget** | 5 | 5 | 5 | Balanced, friendly, not gimmicky |
| **Destination Spotlight displays** | 6 | 5 | 4 | Editorial travel-magazine feel |

**Override rule:** If Andy explicitly asks for "bolder", "calmer", "denser" etc., adjust the dials and state them at the top of the response so he knows what he's getting.

---

## 2. DEFAULT ARCHITECTURE & CONVENTIONS

Unless Andy specifies otherwise:

**Stack for widgets:** IIFE vanilla JS + Tailwind via CDN OR inline styles (per `tg-widget-suite` skill). React only when the widget is standalone (e.g. the editor shell).

**Stack for dashboards / admin / portals:** Next.js, React Server Components by default, `'use client'` only on interactive leaves.

**Dependency verification [MANDATORY]:** Before importing any third-party lib, check `package.json`. If missing, output the install command. Never assume.

**RSC safety:** Global state and interactive motion ONLY in Client Components. Wrap providers in `'use client'`.

**State management:** `useState`/`useReducer` for local UI. Global state only for genuine prop-drilling avoidance.

**Styling:** Tailwind CSS. Check version in `package.json` before using v4 syntax. Use `@tailwindcss/postcss` or the Vite plugin for v4 — never the `tailwindcss` plugin in `postcss.config.js`.

**Icons:** Lucide React (already standard in your stack). Standardise `strokeWidth={1.75}` globally for Travelgenix UI. Do NOT mix icon libraries in the same project.

**Layout containment:** `max-w-[1400px] mx-auto` or `max-w-7xl` for full pages. For widgets, respect the host container — never force a width the host didn't ask for.

**Viewport stability [CRITICAL]:** NEVER `h-screen`. Always `min-h-[100dvh]` for full-height sections. iOS Safari collapses `h-screen` catastrophically.

**Grid over flex-math:** NEVER `w-[calc(33%-1rem)]`. Use CSS Grid for reliable structures.

**Anti-emoji policy [CRITICAL]:** Zero emojis in code, markup, text, alt text. Replace with Lucide icons or clean SVGs.

---

## 3. WIDGET-SPECIFIC GUARDRAILS (TG ADDITION)

Widgets live inside other people's websites. This is a different design problem.

- **CSS isolation:** Every widget class MUST be namespaced (`tg-widget-[name]-*`). NEVER emit styles that could leak into the host page. No bare `.button`, `.container`, `.card`.
- **No `<html>` or `<body>` styles.** Widgets cannot set viewport rules, font-family defaults, or reset margins globally.
- **Font loading:** If the widget needs Inter (or any font), inject it via `<link>` with a unique ID check to avoid double-loading when multiple widgets are on the same page.
- **Shadow DOM consideration:** For Ignite-tier premium widgets, consider shadow DOM to prevent host CSS bleed. Default is still scoped classes.
- **Responsive without breakpoints leaking:** Widgets must adapt to their container width, not the viewport. Use `container queries` (`@container`) where supported, media queries only as fallback.
- **Dark mode dual-rendering:** Every widget renders both light and dark. Detect via `prefers-color-scheme` OR accept a `theme="light|dark|auto"` attribute on the embed tag. Never force.
- **Client brand overrides:** Every widget exposes CSS custom properties (`--tg-brand`, `--tg-accent`, `--tg-radius`) that client configs can set. Respect them.

---

## 4. DESIGN ENGINEERING DIRECTIVES (BIAS CORRECTION)

### Rule 1: Deterministic Typography

- **Display/headlines:** `text-4xl md:text-6xl tracking-tighter leading-none` for landing pages. `text-2xl md:text-3xl tracking-tight` for admin screens. `text-lg md:text-xl` for widget internals.
- **Font lock:** Inter for ALL Travelgenix-branded surfaces (widgets, editor, admin, marketing). Client-branded widget skins may use the client's font — in which case follow the client's pairing.
- **Serif ban for software UI:** Dashboards, editor screens, admin panels — sans-serif only. Inter + JetBrains Mono for any monospace numbers.
- **Body/paragraphs:** `text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[65ch]`.

### Rule 2: Colour Calibration

- **Travelgenix surfaces:** Navy `#1B2B5B` (primary), Teal `#00B4D8` (accent). Zinc/Slate for neutrals. Off-white `#FAFAFA`, off-black `#0A0A0A`.
- **Pure black ban:** Never `#000000`. Use `zinc-950` or `#0A0A0A`.
- **Saturation cap:** Accents < 80% saturation. No neon.
- **"Lila ban":** No purple gradients, no AI-purple glows. This is the single biggest AI tell in 2025–26.
- **Consistency:** One palette per project. Don't fluctuate warm/cool greys within the same screen.

### Rule 3: Layout Diversification

- **Anti-centre bias:** Centred hero sections banned when `DESIGN_VARIANCE > 4`. Use split screen (50/50), left-aligned content + right-aligned asset, or asymmetric white space.
- **Mobile override:** Any asymmetric layout at `md:` and above MUST fall back to strict single-column (`w-full`, `px-4`, `py-8`) below 768px. No horizontal scroll, ever.

### Rule 4: Materiality — Anti-Card Overuse

- **Dashboard hardening:** For `VISUAL_DENSITY > 6`, generic card boxes are BANNED. Group via `border-t`, `divide-y`, or pure negative space. Data metrics breathe.
- **Cards ONLY when elevation carries meaning** (a modal, a floating panel, a hovering result). A "feature card" is usually better as a bordered or divided row.
- **Shadow execution:** When shadow is used, tint it to the background hue. No default `shadow-md`. Prefer `shadow-[0_20px_40px_-15px_rgba(27,43,91,0.08)]` for Travelgenix navy-tinted depth.

### Rule 5: Interactive UI States [MANDATORY]

LLMs default to static "success" states. You MUST generate the full cycle:

- **Loading:** Skeleton loaders that match final layout dimensions. No generic circular spinners on content areas (spinners are fine for submit buttons).
- **Empty:** Beautifully composed empty states with a clear next action. "No enquiries yet" is not an empty state — "No enquiries yet. Your form goes live as soon as you paste the embed code." IS.
- **Error:** Inline, contextual, specific. Not a toast that disappears.
- **Tactile feedback:** `:active` states use `-translate-y-[1px]` or `scale-[0.98]`. Button press must feel physical.
- **Focus-visible:** Every interactive element has a visible focus ring. Accessibility is non-negotiable (ties to `travelgenix-design` rules).

### Rule 6: Data & Form Patterns

- Label ABOVE input. Helper text in markup (optional content, always present structure). Error text below input. `gap-2` between input block elements.
- Inputs use the same radius as buttons in the same form — consistency within scope.

---

## 5. CREATIVE PROACTIVITY (ANTI-SLOP)

When `MOTION_INTENSITY > 4`, actively reach for these instead of defaults:

- **Liquid glass refraction (not just `backdrop-blur`):** Add `border border-white/10` and `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]` on glass panels. Physical edge simulation.
- **Magnetic micro-physics (MOTION > 5):** Buttons that subtly pull toward the cursor. NEVER use `useState` for this. Use Framer Motion's `useMotionValue` and `useTransform` — outside React render cycle, or mobile performance collapses.
- **Perpetual micro-interactions (MOTION > 5):** Continuous subtle motion on status dots, avatars, data streams. Pulse, shimmer, float. Spring physics only: `type: "spring", stiffness: 100, damping: 20`. No linear easing.
- **Layout transitions:** Framer's `layout` and `layoutId` for re-ordering, resizing, shared element transitions.
- **Staggered reveals:** Use `staggerChildren` (parent + children in same Client Component tree) or CSS cascade (`animation-delay: calc(var(--index) * 80ms)`) for list mounts.

---

## 6. PERFORMANCE GUARDRAILS

- **Widgets are guests.** They run in someone else's page. Never block the main thread. Lazy-load heavy deps. Debounce scroll/resize.
- **Grain/noise filters:** Apply to `fixed inset-0 z-[...] pointer-events-none` overlays only. Never on scrolling containers.
- **Hardware acceleration:** Animate `transform` and `opacity`. Never `top`/`left`/`width`/`height`.
- **Z-index restraint:** No arbitrary `z-50` spamming. Reserve z-indexes for systemic layers: sticky nav (20), modal backdrop (50), modal content (60), toast (70).
- **Perpetual animation isolation:** Wrap any infinite loop in its own tiny `React.memo`'d Client Component. Never re-render a parent layout.

---

## 7. AI TELLS — FORBIDDEN PATTERNS

Strictly avoid unless explicitly requested:

### Visual
- Neon/outer glows on buttons
- Pure black `#000000`
- Oversaturated accents
- Gradient text on headlines
- Custom mouse cursors (accessibility violation + performance cost)
- Emoji anywhere

### Typography
- Inter for client-branded work where the client has their own font (Inter is fine, and required, for TG-branded surfaces)
- Oversized H1s that scream — control hierarchy with weight and colour, not just size
- Serif fonts on dashboards or admin UIs

### Layout
- 3-equal-card feature rows (the single most common AI tell)
- Floating elements with awkward gaps — every margin mathematically deliberate
- Centred everything

### Content
- "John Doe", "Jane Doe", "Sarah Chen" — use realistic, varied names
- Standard SVG egg avatars or Lucide `User` icon placeholders — use real-looking initials or actual photo placeholders
- Round numbers: `99%`, `50%`, `10,000` — use organic: `47.2%`, `2,847`, `£59,430`
- "Acme", "Nexus", "SmartFlow" startup-slop brand names — invent contextual ones
- AI filler: "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve" — plain specific verbs only
- Broken Unsplash URLs — use `https://picsum.photos/seed/[deterministic-string]/800/600`

### Components
- shadcn/ui in its default state — always customise radii, colours, shadows, padding to the project aesthetic
- Default Tailwind drop shadows (`shadow-md`, `shadow-lg`) — tint and tune

---

## 8. DIAL DEFINITIONS (REFERENCE)

### DESIGN_VARIANCE

- **1–3 Predictable:** Flex `justify-center`, symmetric 12-col grids, equal paddings. Safe, conservative. Good for widgets embedded in unpredictable host sites.
- **4–7 Offset:** Overlapping elements (`margin-top: -2rem`), varied aspect ratios (4:3 next to 16:9), left-aligned headers over centred data.
- **8–10 Asymmetric:** Masonry, fractional grids (`2fr 1fr 1fr`), massive empty zones (`padding-left: 20vw`). Editorial/marketing only.

### MOTION_INTENSITY

- **1–3 Static:** No automatic animation. CSS `:hover`/`:active` only. Accessibility default.
- **4–7 Fluid CSS:** `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`. Animation-delay cascades on load. Transform + opacity only.
- **8–10 Choreography:** Scroll-triggered reveals, parallax, Framer Motion hooks. Never raw `window.addEventListener('scroll')` — use Intersection Observer or Framer's `useScroll`.

### VISUAL_DENSITY

- **1–3 Art gallery:** White space everywhere. Huge section gaps. Expensive and airy.
- **4–7 Daily app:** Normal spacing. Standard web app breathing room.
- **8–10 Cockpit:** Tight paddings, no card boxes, 1px dividers only. Monospace for all numbers. Luna Work CRM pipeline view at peak density is 7.

### Reduced motion

**Mandatory:** Every animation respects `@media (prefers-reduced-motion: reduce)`. When set, disable all perpetual motion, reduce transitions to instant, keep only essential feedback.

---

## 9. BENTO PARADIGM (FOR DASHBOARD-HEAVY SCREENS)

For Luna Work CRM, Luna Marketing dashboards, widget editor preview panels — use Bento 2.0:

- **Palette:** Background `#FAFAFA` light / `#0A0A0A` dark. Cards pure white / `zinc-950` with `border border-zinc-200/60 dark:border-zinc-800/60`.
- **Radius:** `rounded-3xl` or `rounded-[2rem]` for major containers. `rounded-xl` for inner elements. Consistent scale.
- **Shadow:** Diffusion shadow: `shadow-[0_20px_40px_-15px_rgba(27,43,91,0.06)]` (navy-tinted for Travelgenix).
- **Padding:** `p-6 md:p-8` inside cards. Generous.
- **Labels:** Section titles OUTSIDE and ABOVE their card groups, not stuffed inside.
- **Perpetual cards:** Every dashboard has at least one "alive" element — breathing status dot, updating counter, shimmering skeleton on loading data, auto-rotating carousel.

---

## 10. PRE-FLIGHT CHECK

Before outputting any UI code, verify:

- [ ] Which tier / context? Dials declared at the top of the response.
- [ ] Brand rules from `travelgenix-design` satisfied (tokens, colours, Inter, accessibility).
- [ ] Widget context: CSS isolated, no host-page leak, dark mode works, container-responsive.
- [ ] Mobile collapse guaranteed for any asymmetric layout.
- [ ] `min-h-[100dvh]` not `h-screen`.
- [ ] Empty, loading, error states all present.
- [ ] Cards replaced with dividers/borders where density allows.
- [ ] No AI tells from Section 7.
- [ ] Reduced motion respected.
- [ ] Perpetual motion isolated in memoized Client Components.
- [ ] `useEffect` cleanup functions present on all subscriptions/animations.
- [ ] Focus-visible rings on every interactive element.

If any box unchecked, fix before outputting. No exceptions.

---

## 11. WORKED EXAMPLE: WIDGET TIER MAPPING

Andy asks: "Build the Testimonials widget."

Wrong approach: start coding with generic defaults.

Right approach:
1. Declare tier: "Assuming Boost-tier defaults — Variance 5, Motion 4, Density 5. Say if you want Ignite (7/6/4) or Spark (3/2/5)."
2. Read `travelgenix-design` for tokens.
3. Read `tg-widget-suite` for file structure, auth, registration.
4. Build with: Inter font, Travelgenix navy + teal accent, asymmetric card layout (not 3-equal-cards), perpetual breathing on "verified" badges, tinted navy shadow, empty state with clear CTA, full dark mode, container-responsive.
5. Pre-flight check before declaring done.

---

© Travelgenix. Adapted from Leonxlnx/taste-skill (MIT).
