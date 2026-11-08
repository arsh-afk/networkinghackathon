# 01 — Architecture, Hosting & Capacity

**The Syndicate Accord · single webapp · 125 concurrent users · free hosting only**

---

## TL;DR — the decision

| Layer | Choice | Why |
| --- | --- | --- |
| App | **Next.js (App Router) + TypeScript**, one repo, three surfaces (player PWA, host console, projector view) | One deploy, one auth model, server components keep the client bundle small over bad venue Wi-Fi |
| Host | **Vercel Hobby (free)** | 100 GB transfer, 1 M function invocations, 4 CPU-hours, 300 s max duration. No sleeping, no card |
| Function region | **`bom1` (Mumbai)** by default, tested against **`dxb1` (Dubai)** | Colocate with the database. One extra ~60 ms hop for the player beats three extra 60 ms hops to the DB |
| Database | **Supabase Free Postgres**, region `ap-south-1` (Mumbai) | Real SQL (window functions, unique partial indexes) is what makes the scoring engine cheap and correct |
| Auth | **Badge code + 4-digit PIN → signed httpOnly session cookie.** No Supabase Auth, no email | Supabase's built-in sender is **2 emails/hour and only to your own team addresses**, so magic links cannot onboard 125 people. Also removes the entire "email doesn't arrive" failure class |
| Data access | **Server-only**, service-role key in the server runtime, RLS enabled with *no* policies | The browser never holds a DB credential. All rules live in SQL functions the client cannot call directly |
| Realtime | **None.** Edge-cached polling with ETag | Stays far below Supabase's 200-connection cap, survives a bad Wi-Fi handover, costs nothing, and a leaderboard that is 5 s old is indistinguishable from live |
| Files | **None** (spec already says no uploads) | Badge art is generated client-side to PNG; LinkedIn proof is a URL + text |
| Background jobs | **None.** Vercel Hobby cron runs at most once per day, so all expiry is lazy-at-read or an admin button | Removes the entire class of "the worker died" bugs during a live event |

**Total cost: $0.** No credit card is required by any of the three services.

---

## 1. Requirements → architectural consequences

Every line of the source document has a consequence. These are the ones that
change what we build.

| Requirement (source §) | Consequence |
| --- | --- |
| "Only one scan per unique pair is ever counted" (§4) | Enforced by a **partial unique index on the unordered pair**, not by application logic. Two phones scanning each other in the same 200 ms cannot both win |
| "Scores are calculated from raw scan data when requested… No heavy real-time triggers" (§4) | **Nothing is pre-aggregated.** One SQL function derives the entire ledger. Voids, rule tweaks and replays are automatically correct |
| Diminishing returns and a daily diversity multiplier (§4) | The multiplier is only knowable at end of day → per-scan `points_awarded` cannot be the truth. Store **base points**, derive the weighted total. (This contradicts the source doc's `scans.points_awarded` column — see `02`, §2.3) |
| "No photo or file uploads" (§5, §7, §8, §9) | No object storage, no upload endpoints, no virus surface, no Supabase Storage egress |
| Mandatory physical badge, one QR per player (§2, A1) | The QR is **plain text** — `SA1\|<6 digits>\|<name>\|<role letter>` — so the in-app scanner just decodes a string and never opens a URL. The code identifies; it does not authenticate. Points come from the row behind the code, never from the printed fields |
| Manual host approval for snitches and LinkedIn proof (§8, §9) | Admin console is a **first-class surface**, not an afterthought. Hosts will use it on a phone, in a dark room, one-handed |
| "Scanning and submissions lock at end of Day 7" (§3) | A `game_config.phase` gate checked inside the database function, not the UI |
| Weekend track unlocks Saturday morning (§9) | Same gate, computed from `game_config`, timezone `Asia/Dubai` |
| Global mesh only at the closing session (§10) | Freeze a **snapshot JSON** at lock. The closing ceremony must not depend on a live database query |
| Free hosting only (§12) | No queue, no worker, no cron under a minute, no WebSocket fleet, no Redis |

---

## 2. Non-goals (explicitly out of scope)

- Native apps, push notifications, SMS.
- Chat/DMs. Notes are one-shot, attached to a pair, capped.
- Uploads of any kind.
- Real-time sub-second score updates. Nobody at a gala needs to see a counter move 300 ms after a scan; they need it to be right.
- Multi-event / multi-tenant. One event, one deployment, archived afterwards.
- Offline-first editing beyond the scan queue (a scan is the only action worth queuing).

---

## 3. Hosting comparison — current free-tier numbers

All figures checked against vendor documentation on **8 Nov 2026**. Free tiers
move; re-verify anything that a decision hangs on.

### 3.1 The shortlist

| Platform | What you actually get free | Fit for this app | Verdict |
| --- | --- | --- | --- |
| **Vercel Hobby** | 100 GB fast data transfer · 1 M function invocations · **4 CPU-hours** active CPU · 360 GB-hours provisioned memory · 1 M CDN requests · 300 s max duration · **cron max 1×/day** · over-limit = feature off for ~30 days · **non-commercial use only** | Excellent. 125 users is a rounding error for the request quota; the CPU-hours ceiling is the only thing to watch (see §5.4) | ✅ **Hosting** |
| **Supabase Free** | 500 MB database · 5 GB egress (+5 GB cached) · 50 k MAU · 200 peak Realtime connections · 2 M Realtime messages · 500 k Edge Function invocations · 2 projects · **pauses after ~7 days of low activity** · **no backups** · 1-day log retention | Excellent for ~5 k rows. No RLS headaches if we go server-only. Pausing is a real pre-event risk with a one-line fix | ✅ **Database** |
| **Cloudflare Workers + D1 + Durable Objects** | **100 000 requests/day** · 10 ms CPU/request · D1: 5 M rows read/day, 100 k rows written/day, 500 MB per DB · DO available on Free (SQLite backend), 1 GB per object · no sleeping · commercial use allowed | The most generous free tier of the four, and no ToS asterisk. Costs: Next.js needs the OpenNext adapter, D1 has no RLS, and you must build sessions yourself (which we are doing anyway) | 🥈 **Fallback / Plan B** |
| **Firebase Spark** | 50 k document reads/day · 20 k writes/day · 1 GiB · 10 GiB/mo egress · **Cloud Functions require Blaze** · Cloud Storage unavailable on Spark for new buckets | Rejected. With no functions, scoring must live in the client (cheatable) or in security rules (cannot express diminishing returns + end-of-day multipliers). 50 k reads/day is also a genuine ceiling once realtime listeners and leaderboards are in play | ❌ |
| **Render Free** | 750 instance-hours/mo · 512 MB / **0.1 CPU** · **spins down after 15 min idle, ~1 min cold start** · free Postgres **expires 30 days after creation** | Rejected for this app. A one-minute cold start on the first scan after a lull is a queue at the badge table, and a database that deletes itself is not a database for a live event | ❌ |

### 3.2 Why not Firebase, in one paragraph

The source doc offers Firebase as an option. It is the wrong fit for **this**
game specifically, because the game's integrity comes from server-side
arithmetic: a scan's value depends on the scanner's role, the receiver's role,
the receiver's rank, how many scans the scanner has already made *today*, and
which roles they have touched *today*. That is a rule engine, not a document
write. On Spark there is no place to put a rule engine, so it would end up in
the browser. Everything else in the stack could be made to work — the scoring
model is what disqualifies it.

### 3.3 Where the free tiers actually hurt (and the fix)

| Trap | Reality | Fix in this plan |
| --- | --- | --- |
| Supabase pauses after 7 days of low activity | Very likely if you build on Nov 8 and the event starts Nov 23 | **Daily keep-warm**: a GitHub Actions cron (free) hits `/api/health` once a day, which runs one trivial DB query. Also an admin dashboard button that does the same |
| Supabase Free has no backups | A bad admin void or a dropped table is unrecoverable | **Nightly `pg_dump` → private GitHub repo / Drive** via GitHub Actions, plus a manual "export everything" button before the closing session |
| Vercel cron is 1×/day, ±59 min | Cannot do "close the day at 00:00 sharp" | The lock is **computed from `game_config` timestamps at read time**, so it is exact without a job. The daily cron only writes a snapshot for safety |
| Supabase built-in SMTP = 2 emails/hour, team addresses only | Magic-link login would silently fail for everyone | No email in the auth path at all |
| Vercel Hobby is non-commercial | A free student gala is fine; a ticketed event with a sponsor paying for it is arguable | §11 R3 — if the event takes money, move hosting to Cloudflare Workers (same repo, OpenNext adapter) |
| Vercel over-limit = feature off for 30 days | No "pay the difference" escape hatch | Stay under 25 % of every quota (§5.4) and monitor during the week |
| Venue Wi-Fi | Unknown, probably NAT'd, probably 200 people on it | Offline queue + cached roster + manual code entry + paper fallback (§8) |

Sources: Vercel [Hobby plan](https://vercel.com/docs/plans/hobby) and [fair use](https://vercel.com/docs/limits/fair-use-guidelines) and [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) · Supabase [billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp) · Cloudflare [Workers limits](https://developers.cloudflare.com/workers/platform/limits), [D1 limits](https://developers.cloudflare.com/d1/platform/limits), [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits) · Firebase [pricing](https://firebase.google.com/pricing) and [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) · Render [free tier](https://render.com/docs/free).

### 3.4 Region choice

Supabase has no Middle East region. From Ras Al Khaimah the realistic options
are Mumbai (`ap-south-1`, ~30–60 ms), Frankfurt (`eu-central-1`, ~110 ms) and
Singapore (~130 ms). Vercel has a Dubai region (`dxb1`).

Two candidate layouts:

| Layout | Player → function | Function → DB | Total for a 3-query request |
| --- | --- | --- | --- |
| A: functions `dxb1`, DB Mumbai | ~20 ms | ~3 × 60 ms | ~200 ms |
| B: functions `bom1`, DB Mumbai | ~70 ms | ~1–3 ms | ~80 ms |

**Start with B**, and collapse each request into a **single** database round trip
(one RPC per action, one view per page) so the layout is mostly irrelevant. Then
measure both for an hour with a synthetic client and pick the winner on p95. Do
not "optimise" this before there is a number.

---

## 4. System architecture

```
                        ┌──────────────────────────────────────────────┐
  player phone          │  VERCEL EDGE (Hobby)                         │
  ┌───────────┐   HTTPS │  ┌────────────────────────────────────────┐  │
  │ PWA       │────────▶│  │ /                dynamic (session)     │  │
  │ /deck     │         │  │ /scan            dynamic (camera)      │  │
  │ /network  │         │  │ /arena           cached 5 s  ◀── ETag   │  │
  │ /ledger   │         │  │ /api/*           route handlers        │  │
  │ /admin    │         │  └───────────────┬────────────────────────┘  │
  └───────────┘         └──────────────────┼───────────────────────────┘
        │                                   │ service-role key (server only)
        │ IndexedDB scan queue              ▼
        │ (offline)              ┌────────────────────────────┐
        └──────────────────────▶ │ SUPABASE (Free, Mumbai)    │
                                 │  Postgres                  │
  ┌───────────┐   /arena        │   players, scans, notes,   │
  │ projector │────────────────▶│   challenges, questionnaires│
  │ (laptop)  │                 │   reports, linkedin,        │
  └───────────┘                 │   adjustments, audit        │
                                │                            │
  ┌───────────┐   /admin        │  fn: rpc_scan              │
  │ host      │────────────────▶│  fn: fn_ledger             │
  │ console   │                 │  fn: fn_winners            │
  └───────────┘                 │  fn: fn_network_edges      │
                                └────────────────────────────┘
                                           ▲
                    GitHub Actions / Vercel │  (free)
                    daily keep-warm + nightly pg_dump
```

Three client surfaces, one deployment:

1. **Player app** — `/`, `/scan`, `/network`, `/ledger`, `/games`, `/contracts`,
   `/weekend`, `/me`. Mobile-first, installable PWA.
2. **Host console** — `/admin`. Same auth, `is_admin` flag. Phone-first.
3. **Projector** — `/arena`, `/closing`. Wide, dark, big type, no auth (a
   read-only display token in the query string so it can't be scraped widely).

---

## 5. Capacity model for 125 concurrent users

The number that matters is not "125 concurrent users" — it is **actions per
second during the 20 minutes after the opening speech**, when 125 people all try
to scan each other at once.

### 5.1 Assumptions

| Variable | Assumption | Basis |
| --- | --- | --- |
| Players | 125 | Given |
| Days | 7, of which ~3 have high in-person activity | Event shape |
| Peak window | 20:00–22:00 local, ~90 min of active scanning | Gala schedule |
| Scans per player per day | 25 at peak, 12 average | 125 players × 7,750 possible pairs; a scan takes ~2 min of conversation |
| HTTP calls per action | 1 write + 1 refresh (the rest is cached) | Design target |
| Leaderboard viewers | ~60 % of players while it is on screen | Polling, 15 s, only when visible |
| Sessions per player | 1 | Enforced |
| Payload per API response | ~6 KB gzipped | Compact JSON, numbers not prose |

### 5.2 Peak request rate

```
Worst realistic burst:   125 people × 1 scan each in 90 s
                       = 1.39 scans/s
× 2 calls per scan     = 2.8 req/s
+ leaderboard polling  = 75 clients / 15 s = 5.0 req/s
+ page navigations     ≈ 2 req/s
─────────────────────────────────────────────
Peak ≈ 10 req/s  (p99 burst ≈ 40 req/s)
```

Forty requests per second is nothing for any of these platforms. **Request
throughput is not the risk.** The risks are quotas with monthly/daily
granularity and cold starts, both of which are addressed below.

### 5.3 Concurrency correctness (the part people get wrong)

An event app fails on races, not on throughput:

| Race | Control |
| --- | --- |
| A scans B while B scans A | Unordered-pair partial unique index → second insert gets `ALREADY_PAIRED`, UI shows "You already hold this thread" |
| Same scan retried 4× by the offline queue | `client_uuid uuid unique` + `on conflict do nothing`; replay returns the original result |
| Two devices, same player | One active session per player; badge version bumped invalidates old QR |
| Admin voids while player reads | Ledger is derived per request; a void is visible on the next read, no cache invalidation to get wrong |
| Clock skew across phones | `game_day` computed **server-side** from `Asia/Dubai`; client timestamps clamped to ±2 h and only used for intra-day ordering |

Postgres serialises the unique-index conflict for us. No advisory locks, no
transactions spanning two round trips, no optimistic-concurrency UI.

### 5.4 Quota budget — 125 users, 7 days

| Resource | Est. usage | Free limit | Utilisation | Headroom |
| --- | --- | --- | --- | --- |
| Vercel function invocations /mo | ~150 k | 1 M | **15 %** | 6.7× |
| Vercel fast data transfer /mo | ~1.2 GB | 100 GB | **1.2 %** | 80× |
| Vercel CDN requests /mo | ~55 k | 1 M | **5.5 %** | 18× |
| **Vercel active CPU /mo** | **~2.2 CPU-h** (150 k × ~52 ms) | **4 CPU-h** | **55 %** | **1.8×** ← *tightest* |
| Supabase egress /mo | ~1.1 GB | 5 GB | **22 %** | 4.5× |
| Supabase DB size | ~15 MB | 500 MB | **3 %** | 33× |
| Supabase Realtime connections | **0** | 200 | **0 %** | — |
| Supabase Edge invocations | **0** | 500 k | **0 %** | — |
| Writes per day | ~1.5 k | n/a on Supabase | — | — |

**Only one limit is within an order of magnitude: Vercel active CPU.** Three
mitigations, all already in the design:

1. **Cache `/arena` at the edge** with `s-maxage=5, stale-while-revalidate=30`.
   A hundred phones refreshing the leaderboard produce *one* function invocation
   every 5 seconds, not a hundred. This alone removes ~40 % of all invocations.
2. **One RPC per action.** Every write is a single SQL function that returns the
   number the UI needs, so a scan costs one round trip and a few milliseconds of
   CPU rather than four queries of JSON shuffling.
3. **No client-side score computation, no server-side rendering of large lists.**
   Server components render shell + numbers; the network graph is client-only and
   lazy-loaded, so it never runs on the server.

Budget rule for the team: **keep handler CPU under 50 ms.** Vercel's observability
tab shows per-route CPU time; check it after the load test in §11.

### 5.5 Latency targets

| Interaction | Target p95 | How |
| --- | --- | --- |
| Scan commit (tap → points shown) | **< 600 ms** | One RPC, optimistic UI, no page reload |
| Leaderboard read | < 120 ms | Edge cache, 5 s |
| Deck load (warm) | < 400 ms | Cached shell, one query |
| Deck load (cold, 4G) | < 2.0 s LCP | < 200 KB JS on the initial route |
| Projector refresh | 3 s | Polling a static JSON |

---

## 6. API surface

Route handlers (or server actions) only. The browser never talks to Postgres
directly. Every response is `private, no-store` unless noted, because all of it is
per-user.

| Method | Route | Purpose | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | badge code + PIN → session cookie | Rate limited 10/min/IP, 5 failures → 15 min lockout |
| `POST` | `/api/auth/logout` | clear session | |
| `GET` | `/api/me` | player + today's tiers + task progress + points | single SQL call |
| `POST` | `/api/scans` | commit a scan | body: `{text \| code, clientUuid, clientTs?, via}` — the server parses `SA1\|…` text or accepts a bare 6-digit code from manual entry, then calls `rpc_scan(code, …)`; **idempotent**; returns the breakdown |
| `GET` | `/api/me/network` | connections + per-connection history | paginated, 50/page |
| `POST` | `/api/notes` | echo note | one per player per pair |
| `GET/POST` | `/api/games` | list / create challenge | state machine in `02` §6 |
| `POST` | `/api/games/:id/report` | report result | |
| `POST` | `/api/games/:id/confirm` | opponent confirms | |
| `GET/POST` | `/api/questionnaires` | list / send | |
| `POST` | `/api/questionnaires/:id/answer` | submit answers | |
| `POST` | `/api/reports` | snitch | max 2 successful/day, enforced in SQL |
| `GET/POST` | `/api/weekend` | LinkedIn submissions | blocked until `phase >= weekend` |
| `GET` | `/api/leaderboard` | player-visible standings | cached 15 s; name, role, score, rank only |
| `GET` | `/arena/data` | projector payload | **cached** `s-maxage=3, swr=30`, no auth, snapshot-backed |
| `GET` | `/admin/queue` | pending reports + LinkedIn | admin only |
| `POST` | `/admin/:kind/:id/review` | approve/reject | admin only, audited |
| `POST` | `/admin/scans/:id/void` | void a scan | admin only, audited |
| `POST` | `/admin/adjust` | manual points | admin only, audited, reason required |
| `POST` | `/admin/phase` | advance phase / lock | admin only |
| `POST` | `/admin/snapshot` | freeze closing snapshot | admin only |
| `GET` | `/admin/export?kind=edges\|players\|ledger\|anomalies` | CSV | admin only |
| `GET` | `/api/health` | keep-warm + uptime | returns `{ok, db, phase}`; no auth, no data |

Error shape is uniform: `{ ok: false, code: "ALREADY_PAIRED", message, hint }`,
where `code` drives the UI copy and `message` is the in-world sentence.

---

## 7. Security & integrity

### 7.1 Posture

- `service_role` key exists **only** in server environment variables. No
  `NEXT_PUBLIC_*` secret of any kind.
- RLS is **enabled on every table with zero policies**. The anon key, if it ever
  leaks, reads nothing. Server code bypasses RLS by design; there is exactly one
  place where a player ID enters a query, and it comes from the session.
- Sessions: 256-bit random token in an `httpOnly, Secure, SameSite=Lax` cookie,
  stored as a SHA-256 hash server-side, 14-day expiry, rotated on login.
- PINs: 4 digits is only 10 000 guesses, so PIN hashing is argon2id **and**
  lockout is the real control (5 failures → 15 min, 25 failures → host reset).
- All mutations are `POST` with an `Origin`/`Sec-Fetch-Site` same-origin check.
- Every admin mutation writes `audit_log` (actor, action, target, before/after).

### 7.2 Threat model

| Threat | Impact | Control |
| --- | --- | --- |
| Scanning your own badge | Fake points | Rejected in SQL (`no_self` check constraint) |
| Scanning the same person repeatedly | Score inflation | Partial unique index on the pair |
| Photographing / screenshotting someone's badge QR and scanning it later | Fake connections | The QR is plain text, so a photo yields a **code, not a session**. Codes are event-scoped, single-issue and rotatable; the pair still has to be new to score; the snitch system and the anomaly report (§7.3) surface the pattern; hosts void in one tap |
| Guessing badge codes | Farming points without meeting people | 6 digits = 10⁶ combinations of which 125 are real: ~8 000 guesses per hit, ~200 minutes at 40 lookups/min, for **one** point — and only for a pair you have not already used. Lookup rate limiting is the second lock; the arithmetic is the third |
| A QR minted elsewhere with a forged role or name | Inflated cross-faction or patron points | The printed name and role are **display only**. The server resolves field 2 and computes from the database row; a mismatch is logged as an integrity anomaly |
| Brute-forcing a PIN | Account takeover | argon2id + exponential lockout + host-issued reset |
| Session theft | Impersonation | httpOnly + Secure + short expiry + single active session |
| `is_admin` self-grant | Total compromise | No route writes to that column; it is set by SQL migration only |
| Scraping the leaderboard | Privacy | `/arena` exposes name, role, score, rank. Never emails, never connection lists |
| Host misuse | Perceived unfairness | Every action is attributed and listed in a public "ledger of the hosts" the organiser can review after the event |

### 7.3 Integrity signals (computed, not policed)

An `anomalies` view flags, for human review: players with >25 scans in an hour,
pairs where one side scanned but the other never reciprocated *any* interaction,
badge codes scanned from >15 distinct devices, players whose scan timestamps are
suspiciously regular, and **QRs whose printed name or role disagrees with the
roster** (stale or forged badge). Hosts see it on the admin home screen as a
number, not a wall of alerts.

### 7.4 Personal data

Collect the minimum: display name, role, optional descriptor, a badge code, a PIN
hash. **No email addresses, no phone numbers, no photos.** Under UAE PDPL this
keeps the app in the "small, disclosed, purpose-limited" category. Publish a
one-screen privacy note at check-in, export everything, and delete the project
60 days after the event (the snapshot JSON is enough for the club's records).

---

## 8. Offline and venue resilience

This is the highest-probability failure at a live event, higher than any quota.

**Design: the scan is the unit of offline work.**

1. On login, the app caches the roster (`badge_code → display name, role`) in
   IndexedDB (~10 KB for 125 players). Because the QR also carries name and role,
   a scan of an *uncached* badge still renders a correct-looking result sheet
   offline — the 6-digit code is the only thing that actually has to reach the
   server.
2. A scan is written to IndexedDB **first**, then POSTed. The UI shows the
   optimistic breakdown immediately (points are deterministic on the client for
   the *known* case) labelled **"pending"** until the server confirms.
3. The queue retries with backoff (1 s → 30 s, jitter), and flushes on
   `visibilitychange` and `online`. Each entry carries a `client_uuid`, so a
   double flush is harmless.
4. If the server rejects (`ALREADY_PAIRED`, `SELF`, `LOCKED`), the entry is
   removed and the row flips to an error state with an explanation — never a
   silent loss.
5. **Manual code entry** is always available: type the 8 characters, no camera.
6. **Paper fallback**: a printed grid per badge code. If the app is down for more
   than 15 minutes, hosts collect rows and bulk-import a CSV at the next break
   (`/admin/import`, idempotent on pair).
7. The projector reads the **snapshot JSON**, not the live DB, so the closing
   ceremony can run from a laptop with the network unplugged.

Camera notes: `getUserMedia` requires HTTPS (Vercel gives it). iOS Safari does not
support `BarcodeDetector`, so the decoder must be `@zxing/browser` over a `<video>`
element, lazy-loaded (~180 KB) **only** on `/scan`. Ask for camera permission on
the scan screen with a visible "type the code instead" link — never on app load.

The decoder's only job is **text out**. `parseBadgeText()` (`02` §2.2) turns that
text into `{ code, name, role }`; anything that is not `SA1|<6 digits>|…` — a menu
QR, a poster, a screenshot of a different app — yields *"Not a Syndicate mark"*
and the camera keeps running. Nothing is ever fetched or opened from a QR.

---

## 9. Operations runbook

### 9.1 Before the event (T-3 days)

- [ ] Vercel project in `bom1`; Supabase project in `ap-south-1`; both owned by a
      **club** account, not a personal one.
- [ ] `.env` secrets set in Vercel only (`SUPABASE_URL`, `SERVICE_ROLE_KEY`,
      `SESSION_SECRET`, `ARENA_TOKEN`).
- [ ] **Keep-warm**: GitHub Actions cron hits `/api/health` daily; verify it has
      run for 3 consecutive days.
- [ ] **Backups**: nightly `pg_dump` to a private repo; verify a restore into a
      fresh local Postgres.
- [ ] Seed 125 fake players, run the load test (§11), record CPU time per route.
- [ ] Print 5 spare badges per role (lost badge = same role, new code).
- [ ] Rehearse the closing flow on the actual projector laptop, offline.
- [ ] On-call rota for Days 1–7, with one person who can deploy.

### 9.2 During the event

| Signal | Action |
| --- | --- |
| "Nobody can log in" | Check badge codes were imported; check `players.is_active`; check keep-warm |
| "Scores are wrong" | Read `/admin/export?kind=ledger`, find the pair, void if needed. The ledger recomputes instantly |
| "The app is slow" | Check Vercel function CPU and Supabase connection count; turn leaderboard polling from 15 s to 30 s via a config flag |
| "Project DB paused" | Restore in the Supabase dashboard (~2 min); the snapshot carries the ceremony |
| Daily, 09:00 | Export a CSV and glance at the anomalies count |

### 9.3 After the event

1. `/admin/phase` → `locked`. Snapshot written.
2. `/admin/export` → all four CSVs + `snapshot.json` + `pg_dump`, stored in the
   club drive.
3. Run the closing view offline from the snapshot.
4. 60 days later: delete the Supabase project and the Vercel project.

---

## 10. Build schedule — 8 Nov → 23 Nov

Two people can do this in 15 days with the cut-list below; one person needs the
cut-list.

| Phase | Dates | Deliverable | Definition of done |
| --- | --- | --- | --- |
| **P0 Skeleton** | Nov 8–9 | Repo, Next app, Supabase project, schema migration, seed script, deploy pipeline | `main` deploys; `/api/health` returns `{ok:true, db:"ok"}` |
| **P1 Identity** | Nov 10–11 | Players table, badge-code + PIN login, session cookie, role reveal screen, badge PNG export, admin CSV import | 125 seeded players can log in on a phone; a wrong PIN locks out |
| **P2 Scan + ledger** | Nov 12–14 | `rpc_scan`, offline queue, scan result sheet, deck, `/api/me`, full scoring function, leaderboard | Two phones scan each other both ways; second is rejected; scores match a hand-computed fixture |
| **P3 Tasks + games** | Nov 15–16 | Task derivation, game state machine, echo notes | A day's fixture produces exactly the expected task points |
| **P4 Admin + weekend** | Nov 17–18 | Host console (void, review, adjust, import), LinkedIn track, snitch flow | Host can run an entire day from a phone |
| **P5 Arena + closing** | Nov 19–20 | `/arena`, `/closing`, mesh graph, winner queries, snapshot/export | Closing runs on the real projector, with the network cable pulled |
| **P6 Hardening** | Nov 21 | Load test, quota audit, accessibility pass, backup restore rehearsal | §11 checklist green |
| **P7 Buffer** | Nov 22 | Bug fixing, content/copy, printed badge QA | Zero open P0 bugs |
| **Go live** | Nov 23 | Event start | — |

### Cut-list (drop in this order if behind)

1. Personal network **visualisation** (keep the list view) — the mesh only matters at the closing.
2. Questionnaires (optional mechanic; the points are nice-to-have).
3. Triple Thread (ambiguous rule, low impact).
4. LinkedIn auto-checks (it is manual approval anyway).
5. Snitch system (controversial; a host can handle reports verbally).

**Never cut:** offline queue, admin void, snapshot/export, or the scan RPC's
uniqueness guarantee.

---

## 11. Test plan

| Layer | What | How |
| --- | --- | --- |
| Scoring | 12 fixtures: single scan, cross-role, patron, 9th scan, 16th scan, 3-role day, own-role-only day, all tasks, voided scan, replay, lock boundary, timezone rollover | Vitest against a local Postgres (`supabase start`), assert exact totals |
| Correctness under concurrency | 50 parallel scans of the same pair | k6 or a Node script; assert exactly 1 row, 49 clean rejections |
| Load | 125 virtual users, 30 min, mixed read/write at §5.2 rates | k6 against a preview deployment; record p95 and Vercel CPU per route |
| Auth | Wrong PIN lockout, session expiry, admin route 403 for non-admin, foreign-Origin POST rejection | Scripted API tests |
| Offline | Airplane mode mid-scan → queue → restore → no duplicates | Manual on two phones, both iOS and Android |
| Device | iPhone Safari, Android Chrome, one old Android, projector Chrome | Manual |
| Recovery | Restore the nightly dump; serve `/closing` with DB unreachable | Manual |
| Accessibility | Contrast, 48 px targets, screen reader on the scan result, reduced motion | axe + manual |

---

## 12. Risk register

| # | Risk | P | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Venue Wi-Fi unusable | High | High | Offline queue, cached roster, manual codes, paper fallback, snapshot-based closing |
| R2 | Supabase project paused before the event | Medium | High | Daily keep-warm + calendar reminder + restore is 2 minutes |
| R3 | Vercel Hobby considered commercial use | Low | High | If the event charges admission or has a sponsor paying for the build, host the same repo on Cloudflare Workers instead |
| R4 | Vercel active CPU exhausted | Low | Medium | Edge-cache the leaderboard, one RPC per action, monitor; polling interval is a config flag |
| R5 | Scoring rule disputes ("why did my 9th scan only give half?") | High | Medium | **Show the ladder in the UI** (`03` §6.2). A rule players can see is not a controversy |
| R6 | Ambiguous rules implemented wrongly (Triple Thread, Patron Touch) | High | Medium | `04-open-questions.md`; implement behind flags so thresholds are config, not code |
| R7 | Badge printing quality → unreadable QR | Medium | High | Print a 12 mm QR with 4 mm quiet zone, test-scan every batch of 10, keep the 6-digit code in 16 px mono underneath so any failed scan has a typed fallback |
| R8 | One player dominates anyway | Medium | Medium | Weekly caps + diminishing returns + cross-faction and patron bonuses that reward breadth |
| R9 | Host approval queue becomes a bottleneck | Medium | Medium | Phone-first admin console, bulk approve, approval SLA in the runbook |
| R10 | Data loss (no Supabase backups) | Low | High | Nightly dump; export before the closing session |
