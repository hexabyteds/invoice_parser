# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** EazeeBooks
**Updated:** 2026-08-17 (rewritten to match the implemented UI — the previous version documented a navy/green light theme that was never built; this reflects what actually ships)
**Category:** AI Invoice / Billing / Financial SaaS

---

## Global Rules

### Color Palette

Dark-only public/auth surface. Near-black canvas, indigo→violet as the single brand accent, semantic status colors for financial states (paid/processed = green, pending = amber, overdue/error = red).

| Role | Hex | Usage |
|------|-----|-------|
| Canvas | `#020617` / `#030712` | Page background (`bg-[#020617]`, `bg-[#030712]` — both used, treat as equivalent) |
| Surface | `#0F172A` (slate-900) | Cards, panels, inputs |
| Surface muted | `#020617`/`60%` (slate-950/60) | Recessed bands (e.g. IntegrationsBand) |
| Border | slate-800 (`#1E293B`) | Card/section borders |
| Border (hover/focus) | slate-700 / indigo-500 | Hover and `focus-within` states |
| Text primary | white | Headings, key values |
| Text secondary | slate-400 | Body copy, descriptions |
| Text tertiary | slate-500 | Captions, timestamps, metadata |
| Brand gradient | indigo-600 → violet-600 (`#4F46E5` → `#7C3AED`) | Primary CTAs, badges, active states |
| Success | green-400 (`#4ADE80`) on green-500/10 bg | Processed/paid status, positive deltas |
| Warning | amber-400 on amber-500/10 bg | Reviewing/pending status |
| Destructive | red-400 (`#F87171`) / red-500 | Form errors, destructive actions |
| Focus ring | `#6366F1` (indigo-500) | `:focus-visible` outline, global |

**Notes:** This is the same dark, indigo/violet-accented family used by Stripe, Mercury, Ramp, and Linear — validated as a legitimate trust-appropriate dark palette for financial/dev-tool SaaS, not just a generic "AI startup" look. Keep it dark-only on public/auth pages; the authenticated dashboard has a separate light/dark toggle (see `.dark` overrides in `index.css`) that is out of scope for the public site.

### Typography

- **Display font:** Plus Jakarta Sans (`font-display` utility) — hero headlines, page titles, large numerals
- **Body/UI font:** Inter — everything else (paragraphs, labels, buttons, nav)
- **Mood:** confident, modern fintech — not corporate-navy, not playful/startup-generic
- **Google Fonts (already loaded in `frontend/index.html`):**
  `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap`
- Tailwind v4 tokens (`frontend/src/index.css`):
  ```css
  @theme {
    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    --font-display: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
  }
  ```

### Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| Section padding (marketing) | `py-24` (96px) | Landing/features/pricing sections |
| Card padding | `p-6`–`p-8` | Cards, form panels |
| Card radius | `rounded-3xl` (24px) | Cards, panels, modals, pricing cards |
| Control radius | `rounded-xl` (12px) | Inputs, buttons inside cards |
| Pill radius | `rounded-full` | Nav bar, primary CTAs, toggle switches, badges |

### Shadows

| Level | Value | Usage |
|-------|-------|-------|
| CTA glow | `shadow-lg shadow-indigo-950/30` | Primary gradient buttons |
| Popular-plan glow | `shadow-2xl shadow-indigo-500/20` | Featured pricing card |
| Panel | `shadow-2xl` | Auth cards, dropdowns |

---

## Component Specs

### Buttons

```
/* Primary — gradient pill */
bg-gradient-to-r from-indigo-600 to-violet-600
hover:from-indigo-500 hover:to-violet-500
text-white font-semibold rounded-full (marketing) / rounded-xl (forms)
px-7 py-4 (marketing) / py-4 (form submit, full width)
shadow-lg shadow-indigo-950/30
transition-all duration-200
disabled:opacity-60 disabled:cursor-not-allowed

/* Secondary — outline */
border border-slate-700 text-white
hover:bg-slate-900 (marketing) / hover:bg-slate-800 (in-card)
rounded-full / rounded-xl
transition duration-200
```

### Cards

```
bg-slate-900 border border-slate-800 rounded-3xl p-6-8
hover:border-slate-700 (where interactive)
Featured/popular variant: border-indigo-500 + shadow-2xl shadow-indigo-500/20
```

### Inputs (auth/forms)

```
flex items-center rounded-xl border bg-slate-800 (auth) / bg-slate-900 (register) px-4
border-slate-700, focus-within:border-indigo-500
Error state: border-red-500, error text text-red-400 text-sm below field
Leading icon: lucide-react, 20px, text-slate-400/500
Password fields: trailing show/hide icon button — must have >=44x44px hit area (add padding, not just a 20px icon)
```

### Badges / Status pills

```
rounded-full px-2.5-4 py-1-2 text-xs-sm font-medium
Processed/paid: bg-green-500/10 text-green-400
Pending/reviewing: bg-amber-500/10 text-amber-400
Popular/featured: bg-gradient-to-r from-indigo-600 to-violet-600 text-white
```

### Navigation

```
Fixed pill navbar: rounded-full border border-slate-800 bg-slate-900/70 backdrop-blur-xl
Mobile: dedicated dropdown panel (not a bare hidden->flex toggle), rounded-3xl, own backdrop-blur
Primary CTA always visible in nav (desktop + mobile), single obvious "Start Free"
```

### Footer

```
border-t border-slate-800 bg-slate-950
Columns: Brand+blurb / Product (Features, Pricing, Start Free) / Company (Contact mailto, Privacy, Terms)
Only link to pages/profiles that actually exist — no placeholder social icons
```

---

## Style Guidelines

**Style:** Modern Dark SaaS (fintech-adjacent) — near-black canvas, single indigo/violet brand accent, generous whitespace, gradient-pill CTAs, subtle scroll-triggered motion.

**Best for:** B2B financial/document-processing SaaS aimed at operators who already trust dark, developer/fintech-grade tools (vs. a light corporate-navy "enterprise sales" look).

**Key effects:** `whileInView` fade/slide-up on section entry (Framer Motion, ~0.4–0.5s, staggered by index), hover `y: -2 to -10` lift on cards, layoutId shared-element transitions on toggles (billing monthly/yearly).

### Page Pattern — Marketing Landing

**Section order (already implemented, keep):** 1. Hero (product value + live product glimpse), 2. Integrations/works-with band, 3. How it works (4-step), 4. Pricing teaser, 5. FAQ, 6. Final CTA, 7. Footer.

**Conversion strategy:** Single clear primary action ("Start Free — No Card Required") repeated at hero + final CTA; secondary "Book Demo" via mailto; pricing always one click away.

### Page Pattern — Auth

**Login:** minimal and focused — brand mark, short trust line, form, forgot-password + signup links. No invented metrics, no revenue charts.
**Register:** may keep a light value-reinforcement side panel (what you get, in plain language) since it's the conversion moment — but same rule: no fabricated statistics or fake activity feeds.

---

## Anti-Patterns (Do NOT Use)

- ❌ Fabricated statistics, fake activity feeds, or real-sounding-but-invented company/client names presented as if genuine (this was found live in `Hero.jsx` / `AuthLayout.jsx` and is being corrected)
- ❌ Marketing-heavy login screen (stat cards / charts / testimonials on `/login`)
- ❌ Emojis as icons — use SVG icons (project already standardizes on `lucide-react`)
- ❌ Missing `cursor:pointer` — all clickable elements must have it
- ❌ Layout-shifting hovers — avoid scale transforms that shift surrounding layout
- ❌ Low contrast text — maintain 4.5:1 minimum contrast ratio
- ❌ Instant state changes — always use transitions (150–300ms)
- ❌ Invisible focus states — focus states must be visible for a11y
- ❌ Icon-only interactive controls with <44×44px hit area (e.g. unpadded password show/hide toggles)
- ❌ Ornate decoration, unnecessary 3D/skeuomorphism

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (lucide-react)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum against the dark canvas
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile (except intentionally-scrollable tables, with a visible hint)
- [ ] No invented stats, testimonials, customers, or integrations
- [ ] Interactive icon-only buttons have >=44×44px hit area
