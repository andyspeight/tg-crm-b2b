---
name: travelgenix-design
description: World-class UI/UX design intelligence for every Travelgenix project. Use this skill BEFORE writing any HTML, CSS, React, JSX, or UI code. Triggers include any request to build, design, create, style, improve, review, or fix a widget, dashboard, portal, admin panel, landing page, client-facing interface, floating widget, search UI, chat interface, booking flow, or any visual component. Also triggers for "make it look better", "improve the design", "it looks too AI", "elevate the UI", "Apple quality", "world class design", "professional look", "design review", "UX audit", or any feedback about visual quality. This skill provides 99 UX guidelines, accessibility standards, animation rules, typography systems, colour architecture, layout patterns, and a mandatory pre-delivery checklist. It works alongside the frontend-design skill — that skill handles creative vision, this skill handles professional quality and consistency. ALWAYS read this skill first for any UI work.
---

# Travelgenix Design Intelligence

World-class UI/UX design system for Travelgenix products. Adapted from UI/UX Pro Max (63k+ GitHub stars) and tailored for Travelgenix's travel-tech SaaS platform.

**Purpose:** Ensure every widget, portal, dashboard, and client-facing interface meets Apple-level design quality — clean, confident, and unmistakably professional.

**Philosophy:** Great design is invisible. Users should never think about the interface; they should think about their holidays, their bookings, their business. Every pixel serves a purpose. Every interaction feels inevitable.

---

## Mandatory Design Principles

These two rules override everything else. They are non-negotiable on every single project.

### 1. Design for 1440px, Responsive Everywhere
The primary design target for all web pages, dashboards, portals, and admin panels is **1440px wide**. This gives us generous breathing room for content-rich travel-tech layouts — multi-column dashboards, side-by-side panels, spacious data tables. Design to fill this width confidently, then ensure every layout scales gracefully down through 1280 → 1024 → 768 → 640 → 375 → 320px. Fully responsive is non-negotiable, but we design for the big screen first and adapt down.

### 2. Light Default, Dark Mode Always
**Light mode is always the default.** Every interface ships in light mode first. But **dark mode must be available in every circumstance** — no exceptions, no "we'll add it later." Every component, every page, every widget must have a working dark mode variant from day one. Use the CSS custom property system defined below so toggling between themes is a single attribute change (`data-theme="dark"`). Design both variants together, not as an afterthought.

---

## When to Apply

### Must Use (Non-Negotiable)
- Building any new UI: widgets, portals, dashboards, admin panels, client pages
- Creating or refactoring components: buttons, modals, forms, tables, cards, search bars, chat interfaces
- Choosing colours, typography, spacing, or layout systems
- Reviewing UI code for quality, accessibility, or visual consistency
- Implementing animations, transitions, or responsive behaviour
- Any client-facing interface that will be seen by travel agents or their customers

### Recommended
- UI feedback says "not professional enough" but reason is unclear
- Pre-delivery quality check before showing Andy or a client
- Aligning design across multiple Travelgenix products (Luna Brain, Luna Chat, Quick Quote, Luna Marketing)
- Building design systems or reusable component patterns

### Skip
- Pure backend/API work with no visual output
- Database operations, Airtable scripts
- Content writing (use blog/LinkedIn skills instead)
- DevOps, deployment, infrastructure

**Decision rule:** If the task changes how something **looks, feels, moves, or is interacted with**, use this skill.

---

## Travelgenix Brand Foundation

### Brand Personality
- **Warm but authoritative** — knowledgeable friend, not corporate consultant
- **Travel-industry native** — we speak the language, we know the pain points
- **AI-forward but human-centred** — technology serves people, never replaces them
- **Premium but accessible** — world-class quality at SME-friendly pricing

### Colour System

Use CSS custom properties. Never hardcode hex values in components.

**Primary Palette:**
```css
:root {
  /* Core brand */
  --tg-primary: #1B2B5B;        /* Deep navy — authority, trust */
  --tg-primary-light: #2A3F7A;  /* Lighter navy for hover states */
  --tg-primary-dark: #111D3E;   /* Darker navy for active states */
  
  /* Accent */
  --tg-accent: #00B4D8;         /* Bright teal — energy, travel, innovation */
  --tg-accent-light: #48CAE4;   /* Lighter teal for backgrounds */
  --tg-accent-dark: #0096B7;    /* Darker teal for text on light */
  
  /* Semantic */
  --tg-success: #10B981;        /* Green — confirmations, live status */
  --tg-warning: #F59E0B;        /* Amber — attention, pending */
  --tg-error: #EF4444;          /* Red — errors, destructive actions */
  --tg-info: #3B82F6;           /* Blue — informational */
  
  /* Surfaces */
  --tg-bg-primary: #FFFFFF;
  --tg-bg-secondary: #F8FAFC;   /* Subtle off-white for sections */
  --tg-bg-tertiary: #F1F5F9;    /* Slightly darker for cards/wells */
  --tg-border: #E2E8F0;         /* Borders and dividers */
  --tg-border-light: #F1F5F9;   /* Subtle borders */
  
  /* Text */
  --tg-text-primary: #0F172A;   /* Near-black — headings, primary text */
  --tg-text-secondary: #475569; /* Slate — body text, descriptions */
  --tg-text-tertiary: #94A3B8;  /* Light slate — captions, hints */
  --tg-text-inverse: #FFFFFF;   /* White text on dark backgrounds */
}
```

**Dark Mode (for widgets on dark client sites):**
```css
[data-theme="dark"] {
  --tg-bg-primary: #0F172A;
  --tg-bg-secondary: #1E293B;
  --tg-bg-tertiary: #334155;
  --tg-border: #334155;
  --tg-border-light: #1E293B;
  --tg-text-primary: #F8FAFC;
  --tg-text-secondary: #CBD5E1;
  --tg-text-tertiary: #64748B;
}
```

**Widget Colour Architecture:**
Travelgenix widgets support client-configurable colours. Always separate:
- **Button colour** — the primary CTA colour (client-configurable)
- **Accent colour** — secondary highlights, links, focus rings (client-configurable)
- **System colours** — success/warning/error/info (never client-configurable)

### Typography System

**Font Stack:**
```css
:root {
  --tg-font-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --tg-font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --tg-font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
}
```

**For client-facing widgets where Inter may not be loaded:**
```css
--tg-font-system: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

**Type Scale (use consistently — no arbitrary sizes):**

| Token | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| `--text-xs` | 11px | 400 | 1.4 | Captions, badges, fine print |
| `--text-sm` | 13px | 400 | 1.5 | Helper text, metadata, timestamps |
| `--text-base` | 15px | 400 | 1.6 | Body text, descriptions, form inputs |
| `--text-md` | 16px | 500 | 1.5 | Emphasized body, nav items |
| `--text-lg` | 18px | 600 | 1.4 | Section headings, card titles |
| `--text-xl` | 22px | 600 | 1.3 | Page subheadings |
| `--text-2xl` | 28px | 700 | 1.2 | Page titles |
| `--text-3xl` | 36px | 700 | 1.15 | Hero headings |

**Rules:**
- Minimum body text: 15px (avoids iOS auto-zoom and readability issues)
- Maximum line length: 65-75 characters for body text
- Line height: 1.5-1.6 for body, tighter (1.2-1.3) for headings
- Use font-weight to create hierarchy, not just size
- No text below 11px anywhere, ever

### Spacing System

Use a consistent 4px base grid. All spacing values must be multiples of 4.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
}
```

**Never use arbitrary spacing values** like 7px, 13px, 17px, 23px, 35px, 43px. If a spacing value is not a multiple of 4, it's wrong.

### Border Radius System

```css
:root {
  --radius-sm: 6px;    /* Badges, small chips */
  --radius-md: 8px;    /* Buttons, inputs, small cards */
  --radius-lg: 12px;   /* Cards, modals, dropdowns */
  --radius-xl: 16px;   /* Large cards, panels */
  --radius-2xl: 20px;  /* Feature cards, hero elements */
  --radius-full: 9999px; /* Pills, avatars, circular buttons */
}
```

### Shadow System

```css
:root {
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.08), 0 10px 10px rgba(0, 0, 0, 0.04);
  --shadow-float: 0 25px 50px rgba(0, 0, 0, 0.12); /* Floating widgets, popovers */
}
```

Use shadow sparingly. Elevation should convey hierarchy: higher elements cast larger shadows. Never use random `box-shadow` values — always use tokens.

---

## Design Rules by Priority

Follow priority 1→10. Higher priority rules are non-negotiable.

### Priority 1: Accessibility (CRITICAL)

| Rule | Standard |
|------|----------|
| `color-contrast` | Minimum 4.5:1 for normal text, 3:1 for large text (18px+ bold or 24px+) |
| `focus-states` | Visible focus rings (2-4px) on all interactive elements. NEVER remove outline. Use `--tg-accent` for focus colour |
| `alt-text` | Descriptive alt text on all meaningful images |
| `aria-labels` | `aria-label` on icon-only buttons. Descriptive labels, not "button" or "click here" |
| `keyboard-nav` | Tab order matches visual order. Full keyboard support for all interactions |
| `form-labels` | Every input has a visible `<label>` with `for` attribute. No placeholder-only labels |
| `skip-links` | "Skip to main content" link for keyboard users on full pages |
| `heading-hierarchy` | Sequential h1→h6. Never skip levels. One h1 per page |
| `color-not-only` | Never convey information by colour alone. Always add icon, text, or pattern |
| `reduced-motion` | Respect `prefers-reduced-motion`. Disable/reduce all animations when set |
| `escape-routes` | Every modal and multi-step flow has cancel/back/close |
| `screen-reader` | Meaningful text for screen readers. Logical reading order. Use `aria-live` for dynamic content |

### Priority 2: Touch & Interaction (CRITICAL)

| Rule | Standard |
|------|----------|
| `touch-target` | Minimum 44×44px clickable area. Extend hit area with padding if visual element is smaller |
| `touch-spacing` | Minimum 8px gap between clickable elements |
| `hover-not-required` | Never rely on hover for critical information. Everything must work on touch |
| `loading-buttons` | Disable button during async ops. Show spinner. Prevent double-submit |
| `error-feedback` | Clear error messages positioned near the problem field |
| `cursor-pointer` | `cursor: pointer` on all clickable non-link elements |
| `press-feedback` | Visual feedback within 100ms of click/tap (opacity change, subtle scale, colour shift) |
| `safe-area` | Keep interactive elements away from screen edges, notches, and browser chrome |

### Priority 3: Performance (HIGH)

| Rule | Standard |
|------|----------|
| `image-optimization` | WebP/AVIF with fallbacks. `srcset` for responsive. Lazy load below fold |
| `image-dimensions` | Always declare `width`/`height` or use `aspect-ratio` to prevent layout shift |
| `font-loading` | `font-display: swap` to avoid invisible text. Preload only critical fonts |
| `critical-css` | Inline critical above-fold CSS. Defer non-critical styles |
| `lazy-loading` | Lazy load non-hero content. Route-level code splitting for React |
| `skeleton-screens` | Show skeleton/shimmer for any load >300ms. Never leave blank space |
| `content-jumping` | Reserve space for async content. Target CLS < 0.1 |
| `debounce-throttle` | Debounce search inputs (300ms). Throttle scroll/resize handlers |

### Priority 4: Style Consistency (HIGH)

| Rule | Standard |
|------|----------|
| `design-tokens` | Use CSS custom properties for ALL colours, spacing, radii, shadows. Zero hardcoded values |
| `icon-system` | Use one icon library consistently (Lucide preferred for Travelgenix). Same stroke width, same size tokens |
| `no-emoji-icons` | NEVER use emoji as functional icons. They render differently across platforms and break theming |
| `elevation-scale` | Follow the shadow token system. Cards < Dropdowns < Modals < Floating widgets |
| `state-clarity` | Every interactive element needs distinct default/hover/active/focus/disabled states |
| `dark-mode` | Light mode is ALWAYS the default. Dark mode MUST be available in every circumstance — no exceptions. Design both variants together. Dark mode uses desaturated lighter tones, not inverted colours |
| `primary-action` | Each screen has ONE primary CTA. All other actions are visually subordinate |
| `brand-consistency` | Same design language across all Travelgenix products. A Luna Brain widget should feel related to Luna Chat |

### Priority 5: Layout & Responsive (HIGH)

| Rule | Standard |
|------|----------|
| `mobile-first` | Design mobile first. Scale up to tablet and desktop |
| `viewport-meta` | `width=device-width, initial-scale=1`. NEVER disable zoom |
| `breakpoints` | Consistent: 375 / 640 / 768 / 1024 / 1280 / 1440. Use `min-width` media queries |
| `no-horizontal-scroll` | Zero horizontal scroll on any viewport. Test at 320px minimum |
| `spacing-rhythm` | All spacing from the 4px grid system. Consistent vertical rhythm |
| `container-width` | **Target 1440px** as the primary design width for web pages — this gives generous space for content-rich layouts. Max content width: 1440px for main pages/dashboards, 800px for reading content, 480px for forms. Fully responsive down to 320px |
| `z-index-scale` | Defined layers: content(0), sticky(10), dropdown(20), overlay(30), modal(40), toast(50), tooltip(60) |
| `safe-padding` | Fixed headers/footers reserve space so content is never hidden behind them |
| `line-length` | 35-60 chars mobile, 60-75 chars desktop. Never full-width paragraphs on wide screens |
| `visual-hierarchy` | Establish hierarchy via size, weight, spacing, and contrast — not colour alone |

### Priority 6: Typography & Colour (MEDIUM)

| Rule | Standard |
|------|----------|
| `type-scale` | Use the defined type scale tokens. No arbitrary font sizes |
| `line-height` | 1.5-1.6 for body. 1.2-1.3 for headings. Never use `line-height: 1` on multi-line text |
| `font-pairing` | Maximum 2 font families per interface. Display + body is enough |
| `weight-hierarchy` | Bold (600-700) for headings, Medium (500) for labels/emphasis, Regular (400) for body |
| `semantic-colour` | Use semantic tokens (primary, error, success) not raw hex. Components should not know their colour |
| `text-contrast` | Primary text ≥4.5:1 contrast. Secondary text ≥3:1. Test both light and dark modes |
| `number-tabular` | Use tabular figures for prices, data columns, dates, and timers (prevents layout shift) |
| `truncation` | Prefer wrapping. If truncating, use ellipsis AND provide full text via tooltip |

### Priority 7: Animation & Motion (MEDIUM)

| Rule | Standard |
|------|----------|
| `duration` | Micro-interactions: 150-300ms. Transitions: ≤400ms. Nothing >500ms |
| `transform-only` | Animate `transform` and `opacity` only. Never animate `width`, `height`, `top`, `left` |
| `easing` | `ease-out` for entering elements. `ease-in` for exiting. Never `linear` for UI |
| `exit-faster` | Exit animations ~60-70% of enter duration. Feels more responsive |
| `motion-meaning` | Every animation conveys cause-effect. No decorative-only motion |
| `stagger` | List/grid items stagger entrance by 30-50ms per item. Not all-at-once |
| `interruptible` | User action cancels in-progress animation immediately |
| `no-blocking` | Never block user input during animation. UI stays interactive |
| `reduced-motion` | All animations disabled/reduced when `prefers-reduced-motion: reduce` is set |
| `scale-feedback` | Subtle scale (0.97-1.03) on press for cards/buttons. Restore on release |
| `opacity-threshold` | Fading elements: don't linger below opacity 0.2. Either fully fade or stay visible |

### Priority 8: Forms & Feedback (MEDIUM)

| Rule | Standard |
|------|----------|
| `visible-labels` | Every input has a visible label. Placeholder is NOT a label |
| `error-placement` | Errors below the relevant field, not at page top. Use `aria-live` for screen readers |
| `submit-feedback` | Loading spinner → success/error state. Never leave user wondering |
| `required-indicator` | Mark required fields with asterisk. State which are required vs optional |
| `empty-states` | Helpful message + action when no content. Never a blank screen |
| `toast-dismiss` | Auto-dismiss in 3-5 seconds. Include dismiss button. Use `aria-live="polite"` |
| `confirmation` | Confirm before destructive actions. Use red/danger styling for destructive CTAs |
| `inline-validation` | Validate on blur, not on keystroke. Show error after user finishes input |
| `input-types` | Semantic input types (`email`, `tel`, `number`, `url`) for correct mobile keyboards |
| `progressive-disclosure` | Don't overwhelm. Reveal complex options progressively |
| `error-clarity` | Error messages state cause + fix. "Enter a valid email address" not "Invalid input" |
| `autosave` | Long forms auto-save drafts. Warn before dismissing with unsaved changes |
| `focus-on-error` | After submit error, auto-focus the first invalid field |

### Priority 9: Navigation (HIGH)

| Rule | Standard |
|------|----------|
| `back-behaviour` | Back navigation is predictable. Preserves scroll position and form state |
| `active-state` | Current page/section is visually highlighted in navigation |
| `nav-labels` | Navigation items have both icon AND text label. Icon-only nav harms discoverability |
| `deep-linking` | Key screens reachable via URL/deep link |
| `breadcrumbs` | Use breadcrumbs for 3+ level deep hierarchies |
| `modal-escape` | Every modal has clear close affordance. Escape key closes. Click-outside closes |
| `overflow-menu` | When actions exceed space, use overflow/more menu. Don't cram |
| `state-preservation` | Navigating back restores previous scroll, filters, and input values |
| `persistent-nav` | Core navigation reachable from deep pages. Don't hide it in sub-flows |
| `destructive-separation` | Dangerous actions (delete, disconnect) visually separated from normal navigation |

### Priority 10: Charts & Data Visualisation (LOW)

| Rule | Standard |
|------|----------|
| `chart-type-match` | Trend→line, Comparison→bar, Proportion→pie/donut, Timeline→gantt |
| `accessible-colours` | Avoid red/green only. Supplement colour with patterns or labels |
| `legend-visible` | Always show legend near chart. Not hidden below fold |
| `tooltip-on-interact` | Tooltips showing exact values on hover/tap |
| `empty-data` | Meaningful empty state: "No data yet" + guidance. Never a blank chart |
| `responsive-chart` | Charts reflow on small screens. Fewer ticks, simplified labels |
| `gridlines-subtle` | Grid lines low-contrast (gray-200). They shouldn't compete with data |

---

## Component Patterns

### Buttons
```
Primary:    bg: --tg-accent, text: white, radius: --radius-md, height: 44px min
Secondary:  bg: transparent, border: 1px --tg-border, text: --tg-text-primary
Ghost:      bg: transparent, text: --tg-accent, no border
Danger:     bg: --tg-error, text: white (destructive actions only)

States:     hover (darken 8%), active (darken 12%), disabled (opacity 0.5, cursor: not-allowed)
Loading:    spinner replaces text, button width preserved, pointer-events: none
```

### Cards
```
bg: --tg-bg-primary, border: 1px --tg-border, radius: --radius-lg, shadow: --shadow-sm
Padding: --space-6 (24px)
Hover (if interactive): shadow: --shadow-md, translateY(-1px), transition 200ms ease-out
```

### Modals
```
Overlay:    bg: rgba(0,0,0,0.5), backdrop-filter: blur(4px)
Content:    bg: --tg-bg-primary, radius: --radius-xl, shadow: --shadow-xl, max-width: 560px
Padding:    --space-8 (32px)
Animation:  fade in overlay 200ms, slide up + fade content 250ms ease-out
Close:      X button top-right, Escape key, click outside
```

### Floating Widgets (Luna Brain, Luna Chat, Quick Quote)
```
Container:  radius: --radius-xl, shadow: --shadow-float, max-height: 600px
Position:   fixed bottom-right, 20px from edges
Animation:  scale(0.95) + opacity(0) → scale(1) + opacity(1), 250ms ease-out
Toggle:     56×56px circle, shadow: --shadow-lg
z-index:    2147483647 (max, to sit above all client page content)
```

### Form Inputs
```
Height:     44px minimum (touch target)
Border:     1px --tg-border, radius: --radius-md
Focus:      border-color: --tg-accent, ring: 0 0 0 3px rgba(accent, 0.15)
Error:      border-color: --tg-error, ring: 0 0 0 3px rgba(error, 0.1)
Padding:    0 --space-3 (12px horizontal)
Font:       --text-base (15px)
Label:      --text-sm (13px), font-weight 500, margin-bottom --space-1 (4px)
```

---

## Anti-Patterns (Things That Make UI Look Amateur)

### Never Do These
1. **Emoji as structural icons** — Use Lucide or SVG icons. Emoji render differently across platforms
2. **Hardcoded hex colours** — Always use CSS custom properties
3. **Arbitrary spacing** — If it's not a multiple of 4, it's wrong
4. **Placeholder-only labels** — Placeholders disappear. Labels don't
5. **Missing loading states** — Users must always know something is happening
6. **Disabled without explanation** — If a button is disabled, explain why (tooltip)
7. **Walls of text** — Break content into scannable chunks. Headings, spacing, visual hierarchy
8. **Tiny click targets** — Nothing interactive under 44×44px
9. **Random shadows** — Use the elevation system. Random shadows scream "amateur"
10. **Inconsistent radius** — Pick a radius token and stick with it per context
11. **Low-contrast text** — Grey text on grey backgrounds is the #1 sign of lazy design
12. **Layout shift on load** — Reserve space for everything. CLS must be near zero
13. **Flash of unstyled content** — Font loading strategy prevents this
14. **Mixing icon styles** — Don't mix filled and outline icons at the same hierarchy level
15. **Overusing colour** — Colour should highlight, not overwhelm. Most UI is neutral tones with strategic accent

### Signs of AI-Generated UI (Avoid These)
1. Overuse of purple/blue gradients on white
2. Every section has a different visual treatment
3. Excessive rounded corners (everything looks like a pill)
4. Icon + heading + paragraph repeated in a 3-column grid (the "features section" cliché)
5. Overly generous spacing that wastes screen real estate
6. Generic stock photography with overlay gradients
7. Shadows that are too strong or too uniform
8. Text that's too large — especially body text over 18px
9. Buttons that are too tall, too wide, or have too much padding
10. Unnecessary animations on everything

---

## Pre-Delivery Checklist

**Run through this EVERY time before delivering UI code to Andy.**

### Mandatory Principles ✓
- [ ] Designed at 1440px target width with generous use of space
- [ ] Fully responsive down to 320px (tested at 375, 768, 1024, 1440)
- [ ] Light mode is the default
- [ ] Dark mode is fully implemented and functional (not a placeholder)

### Visual Quality ✓
- [ ] No emoji used as icons (SVG/Lucide only)
- [ ] All icons from one consistent family and stroke weight
- [ ] Colours use CSS custom properties (zero hardcoded hex in components)
- [ ] Spacing uses the 4px grid system (no arbitrary values)
- [ ] Border radius uses token system (no arbitrary values)
- [ ] Shadows use elevation system (no arbitrary box-shadow)
- [ ] Typography follows the type scale (no arbitrary font sizes)
- [ ] Visual hierarchy is clear: one primary CTA, subordinate secondary actions
- [ ] No signs of "AI-generated UI" from the anti-patterns list

### Interaction ✓
- [ ] All clickable elements have cursor: pointer
- [ ] All interactive elements have hover/active/focus/disabled states
- [ ] Touch targets ≥44×44px
- [ ] Press feedback within 100ms
- [ ] Loading states for all async operations
- [ ] Error states with clear recovery path
- [ ] Empty states with helpful message and action

### Accessibility ✓
- [ ] Colour contrast ≥4.5:1 for text
- [ ] Focus rings visible on all interactive elements
- [ ] All images have alt text
- [ ] All icon buttons have aria-label
- [ ] Form inputs have visible labels
- [ ] Heading hierarchy is sequential (no skipped levels)
- [ ] Keyboard navigation works logically
- [ ] `prefers-reduced-motion` respected

### Responsive ✓
- [ ] Works at 320px width minimum
- [ ] No horizontal scroll on any viewport
- [ ] Font sizes readable on mobile (≥15px body)
- [ ] Touch targets adequate on mobile
- [ ] Line length controlled (35-75 chars depending on viewport)
- [ ] Images responsive with srcset or object-fit

### Performance ✓
- [ ] No layout shift (images have dimensions, fonts use swap)
- [ ] Skeleton screens for loads >300ms
- [ ] Images optimised (WebP, lazy loaded below fold)
- [ ] Animations use transform/opacity only
- [ ] Debounced search/filter inputs

---

## Product-Specific Guidelines

### Luna Brain (Floating Knowledge Widget)
- Maximum z-index to sit above client page content
- Respects client's configured button/accent colours
- Smooth open/close with scale + opacity animation
- Chat-style message bubbles with clear user/bot distinction
- Search results use deep linking format: `[SEARCH:type:destination:iata:country]`
- Pre-loads data on startup with 5-min auto-refresh
- Must work embedded on any website with any background colour

### Luna Chat (Live Chat Widget)
- Similar container to Luna Brain but with agent presence indicator
- Typing indicators for both agent and visitor
- Message status: sent → delivered → read
- File/image sharing with preview
- Connection status indicator (online/reconnecting/offline)

### Quick Quote (Booking Widget)
- Search form: destination, dates, passengers — progressive disclosure
- Results: card-based with clear pricing hierarchy
- Booking flow: minimal steps, autosave, back-navigation preserves state
- Supplier logos: official assets, consistent sizing, clear space respected
- Price display: large, clear, with "from" qualifier where needed

### Luna Marketing (Admin + Client Portal)
- Dashboard: calendar view, metrics cards, action items — information density balanced with whitespace
- Content queue: status dots, platform icons, drag-drop reordering
- Client portal: clean, simple, minimal options. Clients are not power users
- Review flow: approve/reject with clear feedback mechanism

### Travelgenix Admin (Internal Dashboards)
- Higher information density acceptable (power user context)
- Data tables: sortable, filterable, with clear column headers
- Bulk actions: select all, clear selection, action confirmation
- Status indicators: consistent colour coding across all dashboards

---

## Implementation Notes for Claude

When building any UI in this environment:

1. **Read this skill FIRST** before writing any visual code
2. **Also read** `/mnt/skills/public/frontend-design/SKILL.md` for creative direction — that skill adds the creative spark, this skill ensures professional quality
3. **For React (.jsx) artifacts**: Use Tailwind utility classes mapped to these design tokens. Import Lucide icons
4. **For HTML artifacts**: Define CSS custom properties in a `<style>` block using the tokens above
5. **For widgets**: Always consider that the widget lives on someone else's website. Scope styles, use shadow DOM concepts, max z-index
6. **Test mentally**: Before delivering, walk through the pre-delivery checklist. Flag anything uncertain to Andy

### Tailwind Mapping

When using Tailwind in React artifacts, map tokens approximately:
- `--tg-primary` → `slate-900` / custom
- `--tg-accent` → `cyan-500` / custom  
- `--tg-text-primary` → `slate-900`
- `--tg-text-secondary` → `slate-600`
- `--tg-text-tertiary` → `slate-400`
- `--tg-bg-secondary` → `slate-50`
- `--tg-bg-tertiary` → `slate-100`
- `--tg-border` → `slate-200`
- Spacing: `p-1`(4px) `p-2`(8px) `p-3`(12px) `p-4`(16px) `p-5`(20px) `p-6`(24px) `p-8`(32px)
- Radius: `rounded-md`(8px) `rounded-lg`(12px) `rounded-xl`(16px)

---

*Based on UI/UX Pro Max by NextLevelBuilder (github.com/nextlevelbuilder/ui-ux-pro-max-skill, 63k+ stars) — adapted for Travelgenix by Claude.*
