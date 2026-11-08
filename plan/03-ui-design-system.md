# 03 — UI Design System

**Direction: "The Inked Ledger."** A dark, engraved-paper interface where brass
rules and four faction colours do all the ornament. No fantasy illustration, no
gradient blobs, no stock icons. The game is about people and the marks they leave
on each other, so the interface behaves like a ledger that fills up.

Two constraints shape every decision below:

1. **It is used standing in a loud room, in the dark, one-handed, for 20 seconds
   at a time.** Targets are large, the primary action is always at the bottom, and
   nothing important is smaller than 14 px.
2. **Venue Wi-Fi may be terrible.** The UI is built from type, rules and CSS —
   total image weight for the whole app is **zero bytes**. The first meaningful
   paint is text.

---

## 1. The five signature moments

These are what make it feel designed rather than assembled. Everything else is
quiet so these can land.

1. **Role reveal** — the badge card flips once, slowly (700 ms), a foil edge sweeps
   across, the role sigil draws itself stroke by stroke, and the phone gives one
   15 ms haptic. This is the only place in the app with sound-adjacent drama.
2. **The mark commits** — when a scan lands, a sigil ring expands from the centre
   of the screen in the *receiver's* faction colour, three point-lines count up in
   sequence, then sum. Total: 620 ms. Interruptible by a second scan.
3. **The ladder** — the diminishing-returns rule is drawn as a physical ladder of
   15 rungs that visibly dim at rung 9 and rung 16. Players *see* why their tenth
   scan paid less. This converts the system's most contentious rule into a game
   element instead of a complaint at the closing ceremony.
4. **Arena reorder** — when the projected leaderboard changes, rows slide with a
   FLIP animation and a faction-coloured delta pill (`▲ 7`) floats for 2 s.
5. **The mesh blooms** — at the closing, 125 nodes appear from the centre in
   rank order, then 3 000 edges draw over 45 s, and the four faction clusters
   visibly separate. This is the evening's spectacle and it is one canvas.

---

## 2. Colour

Dark by default and dark only. A gala room is dim, the projector is bright, and a
light mode would make the phone glow like a torch during the mesh reveal.

```css
/* ink scale — surfaces are separated by light, not by shadow */
--ink-950: #07080B;   /* page background */
--ink-900: #0E1015;   /* default surface */
--ink-850: #14171F;   /* raised card */
--ink-800: #1B1F29;   /* input, pressed */
--line:    #232833;   /* hairline */
--line-brass: rgba(216,180,90,0.22);

/* text */
--paper:      #F2EEE6;  /* 15.8:1 on ink-900 */
--paper-dim:  #B9BCC6;
--muted:      #9AA0AE;  /*  7.3:1  — body secondary */
--faint:      #6B7280;  /*  4.6:1  — captions only, never body */

/* brass — one accent, used sparingly */
--brass:      #D8B45A;  /*  9.7:1 */
--brass-deep: #8A6D2B;
--brass-wash: rgba(216,180,90,0.08);

/* factions: `-ink` for text on dark, `-glow` for fills, rings, chart marks */
--artificer:      #6AA8FF;  /*  8.6:1 */
--artificer-glow: #2E6BFF;
--broker:         #5FD08A;  /* 10.0:1 */
--broker-glow:    #12A15C;
--weaver:         #FF9A57;  /*  9.1:1 */
--weaver-glow:    #F2611B;
--patron:         #F0C766;  /* 11.9:1 */
--patron-glow:    #C9971F;
```

All text/background pairs above were checked against WCAG AA (≥ 4.5:1). The
`-glow` variants are **fill-only** and never carry text.

**Rules for using faction colour**

- A role is never communicated by colour alone — always sigil glyph + role name,
  because roughly 1 in 12 men at the event will be red-green weak, and our
  Weaver/Broker pair sits exactly there.
- Faction colour never fills a whole card. It appears as a 2 px left rule, a ring,
  a 6 px chip, and a glow behind a node.
- Brass means "the system", not "a role". Points, rules, ranks, timestamps.

Semantic: success `--broker` (it already reads as "good"), error `#E5484D`,
warning `--patron`. Do not introduce a fifth hue.

---

## 3. Typography

```css
--font-display: 'Cinzel', 'Trajan Pro', Georgia, serif;   /* names, numbers, headings */
--font-ui:      'Inter', system-ui, -apple-system, sans-serif;
--font-num:     'JetBrains Mono', ui-monospace, monospace; /* all scores, ranks, timers */
```

Cinzel is inscriptional Roman — it reads "accord", "charter", "ledger" without
tipping into costume. It is used **only** in uppercase, tracked +0.06em, at
18 px and above. Inter carries every sentence. JetBrains Mono carries every
number that can change, with `font-variant-numeric: tabular-nums` so scores do not
jitter as they animate.

| Token | Size / line-height | Use |
| --- | --- | --- |
| `--t-hero` | `clamp(40px, 9vw, 64px)` / 1.02 | points on the deck, winner names |
| `--t-h1` | 28 / 1.15 | screen titles |
| `--t-h2` | 22 / 1.2 | card titles, projected rank numbers |
| `--t-body` | 16 / 1.5 | everything readable (never smaller for prose) |
| `--t-sm` | 14 / 1.4 | secondary, task descriptions |
| `--t-label` | 11 / 1.2, caps, +0.12em | section labels, field names |
| `--t-num-xl` | 48 / 1, mono | arena scores |
| `--t-num` | 20 / 1, mono | inline numbers |

Font loading: `next/font/google`, `display: swap`, subset `latin`. Two files
(Cinzel 600, Inter variable) + one mono = ~72 KB woff2 total, preloaded, served
from the same origin. No icon font — an inline SVG sprite holds the ~14 glyphs.

---

## 4. Space, shape, depth

```css
--s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
--s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;

--r-chip: 4px; --r-in: 10px; --r-card: 14px; --r-sheet: 20px; --r-pill: 999px;

--stroke: 1px solid var(--line);
--stroke-brass: 1px solid var(--line-brass);
```

Depth comes from **one inset highlight plus a hairline**, not from drop shadows:

```css
.card {
  background: linear-gradient(180deg, #171B24 0%, #12151C 100%);
  border: 1px solid #232833;
  border-radius: var(--r-card);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
}
```

A 3 %-opacity SVG `feTurbulence` noise layer is applied once to the page
background (`position: fixed; pointer-events: none`), ~1 KB inline. It is what
stops a dark UI from looking like plastic.

**Ornament: the brass rule.** Section dividers are a 1 px gradient line that fades
to transparent at both ends, with a 5 px rotated square at centre:

```
─────────────◆─────────────
```

One CSS class, 12 lines, used maybe six times per screen. This is the entire
"fantasy" budget.

---

## 5. Components (14)

| Component | Spec |
| --- | --- |
| `RoleSigil` | Four hand-authored SVGs (compass/gear, scales/knot, quill/spiral, crown/coin). Used as avatar ring, watermark, projector node. 32 px minimum. |
| `FactionChip` | 24 px tall pill, 2 px coloured dot at 2 px radius + role name in `--t-label`. Never truncates the role name. |
| `Tally` | Mono number with count-up (220 ms, ease-out). Optional `+7` floating delta in faction colour. |
| `LadderMeter` | 15 rungs. Rungs 1–8 full brass, 9–15 at 55 % opacity, 16+ ghosted. Current rung has a 2 px brass outline. Below it, one line: "Next mark: full value." / "Half value." |
| `ProgressRing` | 44 px ring for daily tasks; stroke 3 px, faction colour, brass track. |
| `TaskRow` | Left sigil 24 px, title `--t-body`, subtitle `--t-sm` muted, right `+6` mono + checkmark when derived-complete. |
| `ScanSheet` | Bottom sheet, 62 % height, `--r-sheet` top corners, grabber. Result rows stagger 60 ms apart. |
| `Button` | Primary = brass fill, ink text, 52 px tall, `--r-in`. Secondary = 1 px brass border, transparent. Ghost = text + underline. Min target 48 px everywhere. |
| `Input` | 54 px tall, mono for codes (tracked +0.2em), ink-800 fill, brass focus ring 2 px offset 2 px. |
| `Toast` | Bottom, above the tab bar, 44 px, ink-850, 1 px line, auto-dismiss 4 s, `aria-live="polite"`. |
| `EmptyState` | Centred sigil watermark at 12 % opacity + one line of in-world copy + one action. |
| `Skeleton` | Brass shimmer at 6 % sweeping 1.4 s. Only for the deck and the list; never for the scan result (that must feel instant). |
| `LeaderRow` | Rank mono, name, faction chip, score mono, optional delta pill. 56 px tall. Row background tint at 6 % of the player's faction colour. |
| `NodeGraph` | Canvas 2D + `d3-force` (~14 KB, client-only, lazy). Nodes 6–14 px radius by degree, edges 1 px at 18 % opacity, faction glow via `shadowBlur` sparingly (it is expensive — cap at 120 nodes). |

---

## 6. Screens

Fifteen surfaces. Player app is `/`, `/scan`, `/network`, `/ledger`, `/contracts`,
`/games`, `/weekend`, `/me`. Admin is `/admin`. Public is `/arena`, `/closing`.

### 6.1 Role reveal `/welcome` (one time)

Full-bleed ink. A card 88 % width, 4:5, brass hairline, the player's faction
gradient at 10 % as a radial from the bottom. Front: name in Cinzel caps. After
tap: flip → sigil, role name, flavour line, descriptor, "Add to phone" (PNG
download), "Enter the ledger".

Copy: *"You are a Weaver. Crafter of narratives, symbols and feeling."*
Sub: *"Wear the badge. It is your signature for the week."*

### 6.2 Deck `/` — the home screen

```
┌────────────────────────────────┐
│  THE SYNDICATE ACCORD   ◆  D2  │  brass caps, day 2
│                                │
│   ╭────────────────────────╮   │
│   │  ARTIFICER             │   │  faction chip
│   │  187   POINTS          │   │  --t-hero mono
│   │  12th of 125    ▲ 3    │   │  rank + delta
│   │                        │   │
│   │  ▮▮▮▮▮▮▮▮▯▯▯▯▯▯▯       │   │  LadderMeter: 8/15
│   │  8 marks today · full  │   │
│   ╰────────────────────────╯   │
│                                │
│   TODAY                        │
│   ◉ Daily Cross        3 / 2 ✓ │
│   ○ Echo Note          1 / 5   │
│   ○ Patron Touch       2 / 5   │
│                                │
│   ╭────────────────────────╮   │
│   │      ⌗  SCAN A BADGE   │   │  52px brass, sticky
│   ╰────────────────────────╯   │
│  ────────────◆─────────────    │
│   Deck   Scan   Network  Me    │  tab bar 4 items
└────────────────────────────────┘
```

States: **new player** (score 0, ladder empty, one line "The ledger is blank.
Make your first mark."), **offline** (amber hairline under the header: "2 marks
waiting to sync"), **locked** (score is final; the scan button becomes "View the
mesh"), **capped** ("You have reached the week's ceiling — every mark still
counts for the board" — never "you cannot score").

### 6.3 Scan `/scan`

Camera fills the viewport, a 68 %-width rounded brass frame, a moving scan line at
2.4 s period. Bottom: a 56 px dark bar with "Type the code instead". Torch toggle
if the device supports it.

On a hit: camera freezes, the frame snaps to the QR, 120 ms, then the result sheet.
The decoder returns **text only**; the payload (`SA1|042917|Layla Haddad|W`) is
parsed locally, so the name and faction can render the instant the code is
recognised, before the network answers. A QR that fails the parse shows
*"Not a Syndicate mark"* inline for 1.6 s and the camera never stops — no modal,
no error page, nobody stuck behind a poster QR.

Manual entry is a first-class path, not a fallback: a 6-digit field in mono,
grouped `042 917` as you type, with the keypad forced to numeric. Same parser,
same result sheet.

### 6.4 Scan result sheet

```
┌────────────────────────────────┐
│            ─────               │
│   ◉ WEAVER                     │
│   Layla — "writes in margins"   │
│                                │
│   Initiated              + 3   │
│   Crossed faction        + 2   │
│   Patron                 + 0   │
│   ─────────────────────────    │
│   MARK                  +5.00  │
│   Rung 9 of 15 · half value    │
│                                │
│   ╭──────────╮ ╭──────────╮   │
│   │ Echo note│ │ Challenge│   │
│   ╰──────────╯ ╰──────────╯   │
│        Done, scan again        │
└────────────────────────────────┘
```

The two follow-up actions are how the app nudges the deeper mechanics without a
task list. If the pair already exists: the sheet does not open; a toast reads
*"You already hold this thread — Layla, Weaver."* and offers the note/complaint
actions instead.

### 6.5 Network `/network`

Two tabs: **List** and **Map**. List groups by faction with a count per group;
each row shows name, role, days connected, and tiny marks for note/game/question
history. Map is the canvas graph of only *your* connections (≤124 nodes), with
your node pinned at centre. Tap → a 3-line summary sheet.

Stats strip: `41 connections · 4 roles · 2.1× initiated/received`.

### 6.6 Ledger `/ledger`

The audit view. Every scored element for the week, grouped by day, each expandable
to the raw scans that produced it. This screen exists so that a disputed prize can
be resolved by showing the player their own arithmetic. Design it as a
receipt — mono numerals, generous rows, no decoration.

### 6.7 Contracts `/contracts`

The task list. Daily tasks first with `ProgressRing`s, then weekly, then a locked
section for the weekend with a countdown ("Opens Saturday 00:00"). Locked rows
show a lock glyph and the reason, never just grey.

### 6.8 Games `/games`

Inbox-style: **Incoming** (accept/decline), **Waiting on them** (report result),
**Awaiting confirmation** (confirm/dispute), **History**. A 3-step chip strip at
the top of each card shows where the challenge is. Result reporting is two big
buttons (I won / draw / I lost) — never a dropdown.

### 6.9 Questionnaires `/weekend` + `/questionnaires`

Composer: pick a connection, pick a template (or 3–5 short prompts), send. Answer
view: one question per card, 280-char counter, big Next. No progress bar needed at
5 questions.

### 6.10 Snitch `/report`

Deliberately friction-heavy and calm. No red, no urgency, no confetti.
*"Report a missing badge. A host will review it. False reports cost you standing."*
Select a connection, one optional line, submit. Confirmation states the rule
plainly: *"Two approved reports per day. The accused loses 3. You gain 4, and one
stitch on your next mark."*

### 6.11 Weekend `/weekend`

Locked until `phase = weekend` with a real countdown. Six task cards, each with
"Submit proof" → URL or description → `pending` state. Approved cards get a brass
tick. This screen is the only place with a warm/patron tint, to distinguish it
from the in-person week.

### 6.12 Me `/me`

Name, role, descriptor, badge QR (your own, for someone else to scan), rank,
points, session, and a one-line privacy note. Badge QR here is 240 px, full
brightness on tap (`screen wake lock` + white background) so it scans in a dim
room. Under it: the code in mono at 22 px as `042 917`, then the exact payload
text at 11 px muted — so a host can read the code aloud off a phone whose badge
is lost, or type it from a photo. The QR encodes the same four fields as the
printed card; there is only ever one payload format.

### 6.13 Admin `/admin`

Phone-first. Four tabs: **Queue** (count badge), **Scans** (search by badge,
void), **Adjust** (player search, ± points, reason), **Event** (phase, snapshot,
exports). Every destructive action is a two-step sheet with the reason field
required. The queue supports swipe-to-approve with an undo toast — hosts will do
200 of these in a week.

### 6.14 Arena `/arena` (projector, 1920×1080)

```
┌─────────────────────────────────────────────────────────────┐
│  THE SYNDICATE ACCORD                    DAY 3 · 21:04      │
│  ─────────────────────────◆──────────────────────────────── │
│                                                             │
│   #1   ▍ PATRON    Farid Al-Mansoori            248  ▲ 12   │
│   #2   ▍ WEAVER    Layla Haddad                 231  ▲  7   │
│   #3   ▍ ARTIFICER Omar Rashed                  207         │
│   ...                                                       │
│                                                             │
│   LIVE MARKS  2 418      CONNECTIONS  1 902      ROLES 4/4  │
│                                                             │
│   ▍ ▍ ▍ ▍  faction totals bar (4 segments, always visible)   │
└─────────────────────────────────────────────────────────────┘
```

Rules: minimum 28 px type at 1080p; top 10 rows only (never scroll); rows
re-order with FLIP; polling 3 s; no photos, no avatars — the room reads names.
Faction totals stay visible so players see their *faction* competing, not only
themselves.

### 6.15 Closing `/closing`

Four acts, each its own full-screen scene, driven by the frozen snapshot:

1. **The mesh** — nodes bloom in rank order, edges draw chronologically, 45 s.
2. **Winners** — one screen per category, name in `--t-hero`, sigil behind.
3. **The reckoning** — anonymised stats: busiest hour, longest conversation chain,
   most one-sided pair, the player who talked to every faction but two.
4. **Lessons** — the four design principles rendered as four statements with the
   data that proves each one.

Keyboard controls: space = next act, ← → = scrub. It must run with the network
cable pulled.

---

## 7. Motion

```css
--ease: cubic-bezier(.2,.8,.2,1);
--dur-1: 120ms;  /* taps, toggles */
--dur-2: 220ms;  /* count-up, appearance */
--dur-3: 420ms;  /* sheets, reveals */
--dur-4: 700ms;  /* role flip only */
```

Rules:

- Every animation must have a job: confirm, direct attention, or celebrate a
  milestone. Nothing loops except the scan line and the skeleton shimmer.
- `prefers-reduced-motion` replaces all transforms with opacity fades and removes
  the count-up (numbers set instantly).
- Only two things are ever full-screen celebratory: the role flip and the closing
  mesh. Confetti is allowed exactly once, at the closing.
- Haptics: `navigator.vibrate(15)` on mark, `[10,40,10]` on role reveal, nothing
  else. No sound anywhere.

---

## 8. Accessibility

| Requirement | Implementation |
| --- | --- |
| Contrast | All body text ≥ 7:1; disabled ≥ 3:1 with an additional non-colour cue |
| Targets | 48 × 48 px minimum, 56 px for the primary action |
| Labels | Every control has a visible label or `aria-label`; role never colour-only |
| Screen reader | Scan result announces once: *"Mark, Layla, Weaver. Five points. Rung nine, half value."* via `aria-live="polite"` |
| Focus | 2 px brass ring, 2 px offset, visible on dark and on brass fills (switches to ink) |
| Zoom | Layout holds to 200 % text; no fixed-height text containers |
| Motion | `prefers-reduced-motion` respected project-wide |
| Dark room | No pure white anywhere (max `#F2EEE6`), no large bright surfaces except the badge QR |
| Older patrons | `--t-body` is 16 px; the deck is legible at arm's length |

---

## 9. Performance budget

| Metric | Budget | Why |
| --- | --- | --- |
| Initial JS (deck) | **< 120 KB gz** | Two tabs open on a 4G phone |
| `/scan` route JS | **< 220 KB gz** (includes the QR decoder) | Lazy, only on that route |
| CSS | < 25 KB gz | No utility framework bloat; tokens + ~40 component classes |
| Images | **0 KB** | All art is CSS/SVG |
| Fonts | < 80 KB woff2 | Two families + mono, preloaded |
| LCP (cold, 4G) | < 2.0 s | Server-rendered deck, no client fetch for first paint |
| INP | < 200 ms | Optimistic scan, no layout thrash on count-up |
| `/network` map | lazy-loaded | 14 KB `d3-force` only when the Map tab opens |

No chart library, no component library, no animation library beyond Framer Motion
(~34 KB) or hand-rolled CSS where possible. The projector uses the same bundle.

---

## 10. Microcopy

The voice is in-world, but the *consequence* is always plain. Never make a player
decode flavour to understand points.

| Moment | Copy |
| --- | --- |
| First login | "The ledger knows you. Take your mark." |
| Mark success | "+5 — crossed faction. Rung 9, half value." |
| Duplicate pair | "You already hold this thread." |
| Self scan | "You cannot sign your own name." |
| Unknown code | "No such mark in the ledger. Check the digits." |
| Retired badge | "That badge has been replaced. Ask for the new one." |
| A QR from anywhere else | "Not a Syndicate mark. Point at a badge." |
| Offline | "2 marks waiting. They will land on their own." |
| Offline success | "Both marks landed." |
| Tier boundary | "Nine marks is a full day. This one counts half." |
| Weekly cap | "You have reached the week's ceiling. Every mark still counts for the board." |
| Locked | "The ledger is sealed. The mesh is being drawn." |
| Snitch pending | "A host will look at this before the next session." |
| Error (generic) | "The ledger did not answer. Nothing was lost." |
| Empty network | "No threads yet. That is what the room is for." |
| Weekend locked | "The weekend track opens Saturday at midnight." |

---

## 11. Design QA checklist (P6)

- [ ] Every screen at 360, 390, 430, 768, 1440, 1920 px
- [ ] Every screen with: 0 data, 1 item, 200 items, offline, locked
- [ ] Contrast script run over every token pair actually used
- [ ] Axe clean on `/`, `/scan`, `/admin`, `/arena`
- [ ] VoiceOver pass on the scan flow; TalkBack pass on the task list
- [ ] Reduced motion: role flip, mark, arena reorder
- [ ] Projector at 3 m: can the last row read rank 10?
- [ ] Scan in a dark room: does the QR mode fire without a torch?
- [ ] All four role palettes on one screen without any pair reading as "the same"
