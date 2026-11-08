# Syndicate Accord — Easy Answer Form

**How to use**
- Fill in the `Answer:` line for anything where the default is wrong, or write `default`.
- Leave blank = I’ll assume the default.
- You can reply in chat with just the IDs you changed, e.g. `A4 = 90 students, Patrons separate; A5 = Nov 23 is closing; B13 = winner +5`.

---

## BLOCKING (answer these first — they affect schema/dates/badges/hosting/ops)

| ID  | Question (short)                                                          | Default                                                                                                             | Your answer                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | QR/payload format                                                         | ✅ Settled: plain-text `SA1\|042917\|Layla Haddad\|W`; 6-digit code is the ID; name/role display-only                | settled                                                                                                                                                                                                |
| A2  | How do players log in? (badge+PIN / email+password / Google / magic link) | Badge code + 4-digit PIN, issued at check-in                                                                        | university email email@aurak.ac.ae along with a set 6 digit pincode                                                                                                                                    |
| A3  | Who assigns roles and is intake in-app or separate?                       | Separate form (Tally/Google) before event → CSV import; app reveals role                                            | intake using microsoft forms. build a separate roles association and fantasy builder for a clear charachter bio before event starts. must look professional. should have no bearing on the final event |
| A4  | How many players? Do Patrons compete on the same leaderboard?             | 125 competitors incl. Patrons on one board; Patrons excluded from *Top Initiator* and *Master Connector*            | patrons are students they compete on the same board                                                                                                                                                    |
| A5  | **Real dates** (what is Nov 23? start days/weekend/closing)               | **23 Nov = Day 0** (role issue + first scans); Days 1–7 = 24–30 Nov; closing 30 Nov; weekend 28–29 Nov              | 23 nov, monday is the event closing date                                                                                                                                                               |
| A6  | Venue connectivity (captive portal/open/unreliable; ~device count)        | Assume unreliable, no port access, ~200 devices. Build offline queue + snapshot closing                             | assume reliable. no need for relentless offline service.                                                                                                                                               |
| A7  | Any money involved? (tickets/sponsor/paid build/free)                     | Free club event → Vercel Hobby. If money involved, switch to Cloudflare Workers                                     |                                                                                                                                                                                                        |
| A8  | Hosts: how many, who approves, coverage/SLA?                              | 2–3 hosts, one on duty per session, phone-first admin, <2h approval target, bulk approve                            | can be decided later on the admin panel                                                                                                                                                                |
| A9  | **Badge printing** (who prints, format, printer quality, deadline)        | Club prints 3.5×5.5 in cards, 600 dpi, QR 12 mm + 4 mm quiet zone, 5 spares/role; app generates print-ready PNG/PDF |                                                                                                                                                                                                        |
| A10 | Prizes + consent + data retention                                         | Symbolic prizes. Check-in consent for name+role on leaderboard. Export then delete 60 days after closing            | cash prizes tbd                                                                                                                                                                                        |

---

## GAME RULES (affect points/state — defaults are usable, but disputes happen here)

| ID | Topic | Default | Your answer |
|---|---|---|---|
| B1 | Patron + cross-faction stacking? | **Stacks.** Cross-faction patron scan = 3+2+2 = **7** base |  |
| B2 | When does a “day” end? | **04:00 Asia/Dubai** rollover |  |
| B3 | +1 receive points capped? | Capped at **8 receive points/day** |  |
| B4 | Diminishing returns scope/order | Per **scanner per day**, ordered by scan time |  |
| B5 | Fractional points handling | Keep **exact 2-decimal** totals; display rounded on arena, exact on ledger |  |
| B6 | Daily Cross definition | 2 receivers whose roles are different from each other **and** both different from scanner |  |
| B7 | Role Call scope/cadence | **All 3 other roles**, once/week, +10 |  |
| B8 | Patron Touch uses/value | **5 uses/week** at flat +5, then +2 for later patron scans, then base only after 10 *(confirm — easy dispute)* |  |
| B9 | Triple Thread definition | **Closed triangle** of 3 live pairs, +4 each, max 3 triangles/player/week *(vague in source)* |  |
| B10 | Echo Note pays when? editable? | Pays when **both** notes exist (derived/retroactive), 280 chars, **no editing** |  |
| B11 | Questionnaires: who writes prompts? can decline? | Sender picks template or writes 3–5 prompts ≤120 chars; recipient may decline once/pair; expires 7 days |  |
| B12 | Questionnaire points (source undefined) | **+4 each** per completed questionnaire, max 3/player/day; official host questionnaires +6 |  |
| B13 | Game result points + confirmation | Winner **+6**, loser +2, draw +3 each. Opponent confirms; no confirmation in 12h → auto-void |  |
| B14 | Questionnaire Chain | 3 **distinct partner roles** (excl. own), once, +9 |  |
| B15 | Snitch “Stitch” visibility; can go negative? | **Visible** chip (“Stitch −1, next mark”). Points **clamp at 0** |  |
| B16 | Patron’s Favour metric or vote? | Computed: most points from Patron interactions + optional Patron wildcard vote |  |
| B17 | Syndicate Lead on top or instead? | Awarded **on top**, announced last |  |
| B18 | If host voids a scan, can pair scan again? | **Yes** (partial unique index where `voided_at is null`) |  |
| B19 | Scores visible live or hidden until closing? | **Live total + rank visible**; category standings + mesh hidden until closing |  |
| B20 | Can players see who scanned them / their history? | **Yes** to own history and who scanned them; cannot see others’ connections |  |
| B21 | Mid-event rule changes retroactive? | Allowed with `rules_version` bump + announcement; retroactive by default |  |

---

## IDENTITY & DATA

| ID  | Topic                                   | Default                                                                                          | Your answer |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| C1  | Store emails?                           | **No email.** Name + role + optional descriptor only                                             |             |
| C2  | Photos/avatars?                         | **Procedural faction sigil + initials.** No photos                                               |             |
| C3  | Lost phone mid-week?                    | Host issues “new device” → old session revoked, new PIN shown; badge unchanged                   |             |
| C4  | One player on two devices?              | **One active session.** New login revokes old                                                    |             |
| C5  | Roster CSV columns; Arabic/RTL names?   | `name, role, descriptor` — Latin transliteration, 40/60 chars max                                |             |
| C6  | Data after event                        | Export snapshot + CSVs to club drive, delete DB **60 days** after closing                        |             |
| C7  | Public spectator page?                  | Yes: `/arena` read-only, names+roles+scores only, unguessable token URL                          |             |
| C8  | Admin accounts                          | **One per host**, all `is_admin`, all audited                                                    |             |
| C9  | Badge codes sequential or random?       | **Random** 6 digits, checked against active+retired, reject obvious patterns                     |             |
| C10 | Lost/reissued badge — old code behavior | Old code returns `RETIRED_BADGE` **with owner name** to host, scores nothing; new code same role |             |
| C11 | QR carry descriptor?                    | **No** — name and role only; descriptor from DB                                                  |             |

---

## OPERATIONS

| ID  | Topic                                | Default                                                                  | Your answer                                                                                                                  |
| --- | ------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| D1  | Who owns Vercel/Supabase accounts?   | **Club-owned** accounts, two people with recovery access                 | me the author and main admin                                                                                                 |
| D2  | Domain?                              | `*.vercel.app` for beta; custom subdomain if club has one                |                                                                                                                              |
| D3  | Nightly DB dump location             | Private GitHub repo (daily, 7-day retention) + copy on organiser’s Drive |                                                                                                                              |
| D4  | On-call/deploy coverage during event | Two people with deploy access; rota in host runbook                      |                                                                                                                              |
| D5  | Projector machine details            | Windows laptop, Chrome, 1920×1080, offline-capable local copy            |                                                                                                                              |
| D6  | Closing presentation control         | Space/arrows + hidden auto mode every 45s                                | if possible admin controls and presentation controls on two seperate devices to allow for on the spot corrections if need be |

---

## DESIGN & BRAND

| ID | Topic | Default | Your answer |
|---|---|---|---|
| E1 | Visual direction | Dark “inked ledger” (brass + faction glows) as in `03-ui-design-system.md` |  |
| E2 | Club brand assets/colors/fonts | Brass `#D8B45A`; club logo monochrome watermark at 8% on closing screens |  |
| E3 | Copy tone | **In-world labels, plain consequences** |  |
| E4 | English only or English+Arabic (RTL)? | **English only**, Latin names, no RTL in v1 |  |
| E5 | Sound? | **No audio.** Haptics only |  |
| E6 | 60-char descriptor: enough? who writes? | 60 chars, player-editable once, defaults empty |  |

---

## Quick copy-paste reply template (fill what you know)

```text
BLOCKING
A2: default / <answer>
A3: default / <answer>
A4: default / <answer>
A5 (real dates): <answer>
A6: default / <answer>
A7: default / <answer>
A8: default / <answer>
A9 (badge printing): <answer>
A10: default / <answer>

RULES (only if different)
B1:  B2:  B3:  B4:  B5:  B6:  B7:  B8:  B9:  B10:
B11: B12: B13: B14: B15: B16: B17: B18: B19: B20: B21:

OTHER (optional)
C: ...
D: ...
E: ...
```
