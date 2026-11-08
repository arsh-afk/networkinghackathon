# Role-Builder — Implementation Plan

**Project:** Character bio generator for The Syndicate Accord  
**Location:** `role-builder/` — independent of `app/`, no shared codebase  
**Constraint:** Must look professional; no bearing on the final event game logic  

---

## 1. What This App Is

A standalone pre-event webapp that:

1. **Collects player intake data** (name, interests, hobbies, optional descriptor) via a clean form
2. **Randomly assigns one of four roles** (Artificer / Broker / Weaver / Patron) using weighted pools per role
3. **Generates a polished character bio** by merging a role-specific template with the player's input
4. **Displays the result** as a shareable card the player can screenshot or download as PNG
5. **Exports a CSV** for the main app to ingest later

It runs **before** the event, is **not connected** to the Supabase database, and has **no point-scoring or scanning logic**.

---

## 2. Tech Stack

Same stack as the main app for consistency, but completely independent:

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | CSS modules + shared design tokens (inline, copied from `app/globals.css`) |
| State | React useState + local storage (no DB required) |
| Export | `html2canvas` for PNG card export |
| Hosting | Vercel Hobby (same account region `bom1`) — separate project from main app |

No external API calls needed. All rendering is client-side or server-rendered static.

---

## 3. Pages & Flow

```
/onboard          → Welcome screen explaining what this is
/intake           → Form: name, email (@aurak.ac.ae), interests (tags), descriptor (60 chars)
/reveal           → Animated role reveal (matches main app's 700ms flip)
/bio              → Polished bio card with faction colour, sigil, generated text
/export           → Download PNG card + copy CSV row
```

### 3.1 Onboard (`/onboard`)
- Branding header: "The Syndicate Accord — Character Builder"
- Brief explanation: "Before the event, tell us about yourself. We'll craft your character."
- Privacy note: "This data stays in your browser until you download your card. Nothing is stored on a server."
- CTA: "Begin" → `/intake`

### 3.2 Intake (`/intake`)
Fields:
- **Full name** (required, 2–40 chars, Latin characters only)
- **AURAK email** (required, validates `@aurak.ac.ae`)
- **Interests / Hobbies** (optional, tag-style input, max 8 tags, ≤20 chars each)
- **Descriptor** (optional, 0–60 chars — appears under role name on badge/card)

Validation: inline, real-time. Submit button disabled until name + email are valid.

### 3.3 Reveal (`/reveal`)
- Card flip animation (CSS 3D transform, 700 ms)
- Faction sigil draws itself stroke-by-stroke (SVG path animation)
- One haptic pulse if available (`navigator.vibrate([15])`)
- Shows: role name, faction colour, short flavour line
- CTA: "View Your Character" → `/bio`

### 3.4 Bio Card (`/bio`)
The hero screen. Displays a professional card:

```
┌─────────────────────────────┐
│  [Faction Sigil SVG]         │
│                              │
│  ROLE NAME                   │
│  "flavour line"              │
│                              │
│  ─────────────────────────── │
│  Name:  Player Name          │
│  Email: p@aurak.ac.ae        │
│  Descriptor: (if provided)   │
│                              │
│  Traits (generated from      │
│  interests):                 │
│  • builder                  │
│  • strategist                 │
│                              │
│  [Download Card as PNG]      │
│  [Start Over]                │
└─────────────────────────────┘
```

### 3.5 Export (`/export`)
- Generates a CSV row: `name,email,role,descriptor`
- Button: "Download CSV Row" (saves as `character.csv`)
- Button: "Copy to Clipboard" (copies just the CSV row)
- QR code link preview (optional — shows how the card will appear on a printed badge)

---

## 4. Role Templates

Each role has a template that blends the user's interests into a cohesive persona.

### Artificer (Blue `#6AA8FF`)
> *Shaper of tools and hidden mechanisms*

Template logic:
- Interests map to technical traits: "builder", "engineer", "system", "code", "craft"
- Flavour varies by interest keywords
- Generated line: "An artificer who channels [interest] into intricate mechanisms"

### Broker (Green `#5FD08A`)
> *Mover of resources, information and alliances*

Template logic:
- Interests map to strategic traits: "negotiator", "organiser", "strategist", "leader"
- Generated line: "A broker who leverages [interest] to forge lasting alliances"

### Weaver (Orange `#FF9A57`)
> *Crafter of narratives, symbols and feeling*

Template logic:
- Interests map to creative traits: "storyteller", "designer", "artist", "creator"
- Generated line: "A weaver who spins [interest] into threads of meaning"

### Patron (Gold `#F0C766`)
> *Holder of influence who tips the balance*

Template logic:
- Interests map to mentorship/influence traits: "guide", "mentor", "advocate", "champion"
- Generated line: "A patron who raises [interest] to empower those around them"

---

## 5. Design System

Reuses the exact colour tokens from `app/src/app/globals.css`:

```css
/* Copy these directly — they must match the main app exactly */
--ink-950: #07080B;
--ink-900: #0E1015;
--ink-850: #14171F;
--ink-800: #1B1F29;
--line:    #232833;
--brass:   #D8B45A;
--artificer:      #6AA8FF;
--broker:         #5FD08A;
--weaver:         #FF9A57;
--patron:         #F0C766;
```

Typography: Same Geist fonts from `app/src/app/fonts/`. Include via `next/font/local` pointing to copied font files, or use Google Fonts fallback (`Outfit` for headings, `Inter` for body) if self-hosting isn't feasible.

Card style: `--ink-850` background, `--line` border, brass accent for headers.

---

## 6. File Structure

```
role-builder/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── .gitignore
├── public/
│   ├── fonts/GeistVF.woff
│   ├── fonts/GeistMonoVF.woff
│   └── icons/favicon.ico
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx             → redirects to /onboard
    │   ├── onboard/
    │   │   └── page.tsx
    │   ├── intake/
    │   │   └── page.tsx
    │   ├── reveal/
    │   │   └── page.tsx
    │   ├── bio/
    │   │   └── page.tsx
    │   └── export/
    │       └── page.tsx
    ├── components/
    │   ├── Card.tsx              → reusable bio card
    │   ├── Sigil.tsx             → SVG faction sigils (4 variants)
    │   ├── TagInput.tsx          → interest/tag input component
    │   └── FlipReveal.tsx        → role reveal animation
    ├── lib/
    │   ├── roles.ts              → role definitions, templates, trait mapping
    │   ├── generate-bio.ts       → pure function: input → bio object
    │   ├── csv-export.ts         → CSV row generator
    │   └── store.ts              → localStorage persistence helper
    └── styles/
        └── globals.css           ← copy of app/globals.css + card-specific rules
```

---

## 7. Build Steps (ordered)

### Step 1 — Scaffold
- `npx create-next-app@latest role-builder --typescript --tailwind false --eslint --app --src-dir --import-alias "@/*"`
- Copy font files from `app/src/app/fonts/`
- Copy `globals.css` from `app/src/app/globals.css` and extend with card-specific tokens
- Add `html2canvas` dependency

### Step 2 — Core Data Model
- Write `lib/roles.ts` with all 4 roles, their colours, sigil SVG paths, and template mappings
- Write `lib/generate-bio.ts` — takes `{name, email, interests[], descriptor}` → returns bio object
- Write `lib/store.ts` — localStorage get/set helpers for draft preservation

### Step 3 — Intake Page
- Build `TagInput` component
- Build the intake form with validation
- Wire to store on submit → navigate to `/reveal`

### Step 4 — Reveal Animation
- Build `FlipReveal.tsx` with CSS 3D card flip
- Trigger `vibrate([15])` on completion
- Route to `/bio`

### Step 5 — Bio Card
- Build `Sigil.tsx` (4 SVG paths, one per faction)
- Assemble `Card.tsx` with faction-coloured border, sigil, name, role, descriptor, generated traits
- Use CSS `aspect-ratio` for proper card proportions on all screens

### Step 6 — Export
- Build `csv-export.ts` — outputs `name,email,role,descriptor`
- Add download button using `<a download>` pattern
- Add clipboard copy with feedback toast
- Optional: show QR code preview using `qrcode.react` or simple canvas render

### Step 7 — Polish
- Ensure all animations respect `prefers-reduced-motion`
- Test on mobile Safari and Chrome (tag input, vibrate API, html2canvas)
- Lighthouse audit → target >90 on all categories
- Verify card exports at 2× resolution (for print-quality badges later)

---

## 8. Output Format (CSV Row)

The exported CSV matches what the main app expects:

```csv
name,email,role,descriptor
Layla Haddad,l.haddad22@aurak.ac.ae,Artificer,"Crafts mechanisms from code and silence"
```

This file can be manually imported by the host into the main app's admin panel when roles are assigned.

---

## 9. What This Does NOT Do

- ❌ No connection to the main app's Supabase database
- ❌ No role assignment enforcement (that happens in the main app)
- ❌ No scoring, scanning, or game logic
- ❌ No authentication (it's a pre-event tool, not part of the event runtime)
- ❌ No data retention beyond the user's browser session (privacy-first)

---

## 10. Deployment Notes

- Deploy as a separate Vercel project from the main app
- Use a subdomain like `roles.syndicateaccord.ae` (or `.vercel.app` for beta)
- Set `NEXT_PUBLIC_BASE_URL` in Vercel env for any absolute URL references
- No secrets required — everything is client-side
- Cache: one-day static revalidation is fine since the app is pre-event only
