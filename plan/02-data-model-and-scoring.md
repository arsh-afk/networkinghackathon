# 02 — Data Model & Scoring Engine

Everything in this file is Postgres. The client never computes a score, and the
server never assembles one in JavaScript: **one function derives the whole ledger
in one query.**

---

## 1. Design stance: derive, don't accumulate

The source document proposes `scans.points_awarded`. That column cannot be
correct, because the diversity multiplier is only knowable at the end of the day
(you need to know how many distinct roles the player touched *today*), and the
daily tier depends on the order of scans that arrive later.

So:

| Stored | Derived |
| --- | --- |
| Raw events: scans, notes, challenges, questionnaires, reports, link-edit submissions, admin adjustments | Points, multipliers, task awards, ranks, caps, winners |

Consequences, all good:

- A **voided scan** needs no repair job — it disappears from the next read.
- A **rule change** (say, Patron Touch from 5 uses to 3) is a one-line edit plus a
  `rules_version` bump; nobody's history has to be rewritten.
- **Offline scans that arrive late** land in the right place, because ordering is
  a query concern.
- Scores are **auditable**: the same function that renders the leaderboard
  produces the CSV the organisers can defend.

The only numbers we store are `ledger_adjustments` (manual host awards) and a
frozen `snapshot` at lock time.

---

## 2. Schema

```sql
create extension if not exists pgcrypto;

create type role_t as enum ('artificer','broker','weaver','patron');
create type phase_t as enum ('setup','live','weekend','locked','closed');
create type challenge_status as enum ('sent','accepted','reported','confirmed',
                                       'disputed','cancelled','expired');
create type review_status as enum ('pending','approved','rejected');
create type linkedin_task as enum ('activation','signal','targeted','value',
                                   'comment','patron_reach');
```

### 2.1 `game_config` — one row, the whole event's clock and knobs

```sql
create table game_config (
  id              int primary key default 1 check (id = 1),
  event_name      text    not null default 'The Syndicate Accord',
  tz              text    not null default 'Asia/Dubai',
  starts_at       timestamptz not null,
  weekend_at      timestamptz not null,      -- Saturday 00:00 local
  locks_at        timestamptz not null,      -- Sunday 23:59 local
  day_rollover_h  int     not null default 4,  -- a "day" ends at 04:00, not midnight
  rules_version   int     not null default 1,
  phase           phase_t not null default 'setup',
  -- tunable rule numbers, so a threshold is never a code change
  tier1_n         int     not null default 8,    -- full points for the first 8
  tier2_n         int     not null default 15,   -- then 50% until 15
  tier1_mult      numeric not null default 1.00,
  tier2_mult      numeric not null default 0.50,
  tier3_mult      numeric not null default 0.25,
  diversity_mult  numeric not null default 1.25, -- >=3 distinct roles in a day
  mono_mult       numeric not null default 0.75, -- only own role all day
  weekly_scan_cap numeric not null default 220,  -- soft cap on scan points
  patron_full_uses int    not null default 5,
  patron_touch_pts int    not null default 5,
  receive_cap     int     not null default 8      -- +1 receives counted per day
);
```

`phase` and the timestamps are what gate the weekend track and the final lock, so
"unlocks Saturday morning" is data, not a deploy.

The `day_rollover_h = 4` detail matters. A gala conversation at 01:30 should count
toward the day that just ended, not open a new day at midnight and hand everyone a
fresh full-value tier. Question **B2** in `04` confirms this.

### 2.2 `players`

```sql
create table players (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null check (char_length(display_name) between 2 and 40),
  role          role_t not null,
  descriptor    text check (char_length(descriptor) <= 60),
  badge_code    char(6) not null unique check (badge_code ~ '^[0-9]{6}$'),
  badge_version int  not null default 1,
  pin_hash      text not null,
  is_active     boolean not null default true,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index players_role_idx on players (role) where is_active;
```

`^[0-9]{6}$` — six digits, stored as `char(6)` so a leading zero survives (never an
integer). Displayed and spoken as `042 917`.

**The code is an identifier, not a credential.** It is printed in the open and its
job is to name a person, not to prove a secret. That is correct for this game —
scanning a stranger's badge is the entire point — but it moves the integrity work
to two places: the server resolves the code instead of trusting the QR, and
lookups are rate-limited (below).

**Generation.** Random 6 digits, uniqueness-checked against both `players` and
`retired_badges`, rejecting `000000`, `123456` and repeated-digit patterns.
Sequential allocation (`000001`, `000002`, …) would let anyone enumerate the
roster, which is exactly the behaviour the anti-monopoly rules exist to prevent.

**Payload — plain text, no URL.**

```
SA1|042917|Layla Haddad|W
```

| # | Field | Example | Rule |
| --- | --- | --- | --- |
| 1 | Version | `SA1` | payload version; anything else → `NOT_A_MARK` |
| 2 | Code | `042917` | exactly 6 digits, zero-padded |
| 3 | Name | `Layla Haddad` | **display only**, ≤40 chars, may be empty |
| 4 | Role | `W` | `A`rtificer · `B`roker · `W`eaver · `P`atron, **display only** |

A URL QR would open a browser on any phone — the wrong behaviour at a badge table,
and it turns a photograph of a badge into a phishing surface. A text QR shows the
code in any camera app and does nothing else, which is exactly what "the scanner
only parses the text" buys us.

One shared parser, used by the client for optimistic display and by the server for
the authoritative lookup:

```ts
const ROLES = { A: 'artificer', B: 'broker', W: 'weaver', P: 'patron' } as const;

export function parseBadgeText(raw: string) {
  const parts = raw.trim().split('|');
  if (parts.length < 2 || parts[0] !== 'SA1') return null;
  if (!/^\d{6}$/.test(parts[1])) return null;
  const role = ROLES[parts.at(-1) as keyof typeof ROLES];
  const name = parts.slice(2, -1).join('|')
    .replace(/[\u0000-\u001f]/g, '').slice(0, 40);
  return { code: parts[1], name, role };
}
```

`slice(2, -1).join('|')` means a name containing the delimiter still parses. The
name is untrusted input: cap it, strip control characters, and let React escape
it — it is rendered on someone else's phone.

**Trust rule.** Fields 3 and 4 are never used for scoring. Anyone can mint a QR
reading `SA1|042917|Somebody|P`; if points came from the payload, scanning a
forged patron badge would be worth 7 base points a hit. The server looks up field
2 and ignores the rest. When the QR's name or role disagrees with the row, the row
wins and the scan is logged as a badge-integrity anomaly — usually a stale badge,
occasionally a forged one, always worth a host's glance.

**Retired badges** (lost card, reissue — same role, new code):

```sql
create table retired_badges (
  code       char(6) primary key check (code ~ '^[0-9]{6}$'),
  player_id  uuid not null references players(id) on delete cascade,
  retired_at timestamptz not null default now(),
  reason     text
);
```

Resolution order in the scan RPC: active player → retired badge (`RETIRED_BADGE`,
returned **with the owner's name** so a host instantly knows whose card it is) →
`BAD_BADGE`. Codes are never reused within an event, so a retired card can never
resolve to the wrong person.

Sessions live in their own table, hashed:

```sql
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  token_hash  bytea not null unique,          -- sha256(token)
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  user_agent  text
);
create index sessions_player_idx on sessions (player_id) where revoked_at is null;
```

Single active session per player: on login, revoke the previous one. Question C4.

### 2.3 `scans` — the core table

```sql
create table scans (
  id            uuid primary key default gen_random_uuid(),
  scanner_id    uuid not null references players(id),
  receiver_id   uuid not null references players(id),
  base_points   int  not null,                -- 3 / 5 / 7, before any multiplier
  game_day      date not null,                -- server-computed, Asia/Dubai
  created_at    timestamptz not null default now(),
  client_ts     timestamptz,                  -- clamped, used only for ordering
  via           text not null default 'qr' check (via in ('qr','code','admin','import')),
  client_uuid   uuid not null unique,         -- idempotency for the offline queue
  voided_at     timestamptz,
  voided_by     uuid references players(id),
  void_reason   text,
  constraint no_self check (scanner_id <> receiver_id)
);

-- "Only one scan per unique pair is ever counted", enforced by the database.
create unique index scans_pair_once
  on scans (least(scanner_id, receiver_id), greatest(scanner_id, receiver_id))
  where voided_at is null;

create index scans_scanner_day_idx on scans (scanner_id, game_day, created_at)
  where voided_at is null;
create index scans_receiver_day_idx on scans (receiver_id, game_day)
  where voided_at is null;
```

`least/greatest` in the index is what makes A→B and B→A the same edge. Voiding
frees the pair to be scanned again (question B18) because the index is partial.

### 2.4 The rest

```sql
-- Echo Notes: both parties must write one for either to score.
create table notes (
  id          uuid primary key default gen_random_uuid(),
  scan_id     uuid not null references scans(id) on delete cascade,
  author_id   uuid not null references players(id),
  target_id   uuid not null references players(id),
  body        text not null check (char_length(body) between 1 and 280),
  created_at  timestamptz not null default now(),
  unique (scan_id, author_id)
);

create table challenges (
  id             uuid primary key default gen_random_uuid(),
  challenger_id  uuid not null references players(id),
  opponent_id    uuid not null references players(id),
  game           text not null check (game in ('ttt','c4','rps','other')),
  status         challenge_status not null default 'sent',
  game_day       date not null,
  reported_by    uuid references players(id),
  reported_result text check (reported_result in ('win','loss','draw')),
  reported_at    timestamptz,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  constraint no_self_game check (challenger_id <> opponent_id)
);
-- at most one scored game per pair per day
create unique index challenges_pair_day_once
  on challenges (least(challenger_id, opponent_id),
                 greatest(challenger_id, opponent_id), game_day)
  where status in ('confirmed');

create table questionnaire_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  questions   jsonb not null,               -- array of {id, prompt, maxLen}
  created_by  uuid references players(id),
  is_official boolean not null default false,
  constraint three_to_five check (jsonb_array_length(questions) between 3 and 5)
);

create table questionnaires (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references questionnaire_templates(id),
  sender_id    uuid not null references players(id),
  recipient_id uuid not null references players(id),
  status       review_status not null default 'pending',
  answers      jsonb,
  sent_at      timestamptz not null default now(),
  answered_at  timestamptz,
  constraint no_self_q check (sender_id <> recipient_id)
);

create table reports (                       -- the snitch system
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references players(id),
  reported_id uuid not null references players(id),
  note        text,
  game_day    date not null,
  status      review_status not null default 'pending',
  reviewed_by uuid references players(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint no_self_report check (reporter_id <> reported_id)
);
create unique index reports_pair_day_pending
  on reports (reporter_id, reported_id, game_day) where status = 'pending';

create table linkedin_submissions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id),
  task        linkedin_task not null,
  proof_url   text,
  description text check (char_length(description) <= 500),
  status      review_status not null default 'pending',
  reviewed_by uuid references players(id),
  reviewed_at timestamptz,
  game_day    date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (player_id, task)                  -- each weekend task scores once
);

create table ledger_adjustments (            -- manual host awards only
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id),
  delta      numeric not null,
  reason     text not null,
  created_by uuid not null references players(id),
  created_at timestamptz not null default now()
);

create table audit_log (
  id         bigserial primary key,
  actor_id   uuid references players(id),
  action     text not null,
  target     text,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);

create table snapshots (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                -- 'closing'
  payload     jsonb not null,
  created_by  uuid references players(id),
  created_at  timestamptz not null default now()
);
```

RLS posture (`01` §7.1):

```sql
alter table players enable row level security;   -- ... on every table
-- deliberately no policies
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
```

---

## 3. The scan RPC

One call, one round trip, one atomic decision. `security definer` so it can read
`players` while the caller has no grants.

```sql
create or replace function game_day_for(ts timestamptz)
returns date language sql stable as $$
  select ((ts at time zone (select tz from game_config)) - make_interval(hours =>
           (select day_rollover_h from game_config)))::date;
$$;

-- p_code is the parsed 6-digit code (from parseBadgeText, or typed by hand).
-- The name and role printed in the QR are deliberately not parameters here: a
-- forged badge must not be able to change what a scan is worth.
create or replace function rpc_scan(
  p_scanner uuid,
  p_code    char(6),
  p_client  uuid,
  p_via     text default 'qr',
  p_client_ts timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg   game_config;
  me    players;
  them  players;
  day   date;
  base  int;
  scan_id uuid;
  seq   int;
  mult  numeric;
begin
  select * into cfg from game_config where id = 1;
  if cfg.phase not in ('live','weekend') then
    return jsonb_build_object('ok',false,'code','LOCKED','message','The ledger is sealed.');
  end if;

  select * into me from players where id = p_scanner and is_active;
  if not found then
    return jsonb_build_object('ok',false,'code','NO_PLAYER');
  end if;

  if p_code !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok',false,'code','BAD_BADGE');
  end if;

  select * into them from players where badge_code = p_code and is_active;
  if not found then
    if exists (select 1 from retired_badges where code = p_code) then
      return jsonb_build_object('ok',false,'code','RETIRED_BADGE',
        'message','That badge has been replaced. Ask for the new one.');
    end if;
    return jsonb_build_object('ok',false,'code','BAD_BADGE',
                              'message','No such mark in the ledger.');
  end if;
  if them.id = me.id then
    return jsonb_build_object('ok',false,'code','SELF',
                              'message','You cannot sign your own name.');
  end if;

  day  := game_day_for(now());
  base := 3
        + case when them.role <> me.role      then 2 else 0 end   -- cross-faction
        + case when them.role = 'patron'      then 2 else 0 end;  -- patron

  -- idempotent replay: the offline queue may send the same scan twice
  select id into scan_id from scans where client_uuid = p_client;
  if found then
    return jsonb_build_object('ok',true,'replay',true,'scan_id',scan_id);
  end if;

  -- already paired? (pre-check gives a clean message; the index is the real guard)
  if exists (
    select 1 from scans s
     where s.voided_at is null
       and least(s.scanner_id, s.receiver_id)    = least(me.id, them.id)
       and greatest(s.scanner_id, s.receiver_id) = greatest(me.id, them.id)
  ) then
    return jsonb_build_object('ok',false,'code','ALREADY_PAIRED',
                              'message','You already hold this thread.');
  end if;

  begin
    insert into scans (scanner_id, receiver_id, base_points, game_day,
                       client_uuid, via, client_ts)
    values (me.id, them.id, base, day, p_client, p_via,
            least(greatest(coalesce(p_client_ts, now()), now() - interval '2 hours'),
                  now()))
    returning id into scan_id;
  exception when unique_violation then
    return jsonb_build_object('ok',false,'code','ALREADY_PAIRED',
                              'message','You already hold this thread.');
  end;

  -- where this scan sits in today's ladder
  select count(*) + 1 into seq
    from scans s
   where s.scanner_id = me.id and s.game_day = day and s.voided_at is null
     and s.id <> scan_id;

  mult := case when seq <= cfg.tier1_n then cfg.tier1_mult
               when seq <= cfg.tier2_n then cfg.tier2_mult
               else cfg.tier3_mult end;

  return jsonb_build_object(
    'ok', true, 'scan_id', scan_id,
    'receiver', jsonb_build_object('name', them.display_name, 'role', them.role,
                                    'descriptor', them.descriptor),
    'breakdown', jsonb_build_array(
       jsonb_build_object('label','Initiated','points',3),
       jsonb_build_object('label','Crossed faction','points',
                          case when them.role <> me.role then 2 else 0 end),
       jsonb_build_object('label','Patron','points',
                          case when them.role = 'patron' then 2 else 0 end)),
    'base', base,
    'tier', case when seq <= cfg.tier1_n then 1 when seq <= cfg.tier2_n then 2 else 3 end,
    'tier_mult', mult,
    'scan_points', round(base * mult, 2),
    'day_seq', seq,
    'receiver_points', 1,
    'receiver_capped', (select count(*) from scans x
                         where x.receiver_id = them.id and x.game_day = day
                           and x.voided_at is null) > cfg.receive_cap
  );
end $$;
```

`numeric` and `round(…, 2)` everywhere rather than floats: 3 × 0.25 must be
exactly 0.75, and a leaderboard sorted on a float will eventually disagree with
the CSV.

---

## 4. Scoring specification

### 4.1 Scan points

| Component | Points | Attribution |
| --- | --- | --- |
| Initiate a scan | +3 | Scanner |
| Receive a scan | +1 | Receiver (capped at 8/day — question B3) |
| Different-role connection | +2 | Scanner |
| Scan a Patron | +2 | Scanner (stacks with cross-faction → 7 base) |

Base values: same role non-patron **3**, cross-faction non-patron **5**, patron
(same or cross) **7**.

### 4.2 Diminishing returns, per scanner, per day

Ordered by `coalesce(client_ts, created_at), created_at, id`:

| Position in the day | Multiplier |
| --- | --- |
| 1–8 | 1.00 |
| 9–15 | 0.50 |
| 16+ | 0.25 |

### 4.3 Diversity multiplier, per scanner, per day

| Condition | Multiplier |
| --- | --- |
| ≥ 3 distinct receiver roles that day | × 1.25 |
| Only the scanner's own role that day (1 role, own) | × 0.75 |
| Otherwise | × 1.00 |

Applied **after** diminishing returns, to the whole day's scan subtotal. Worked
example below makes the ordering concrete.

### 4.4 Weekly soft cap

Scan points contribute at most `weekly_scan_cap` (default 220). Anything beyond
is still recorded and shown, but contributes zero — with the UI saying so, so it
reads as a ceiling on the *board*, not a punishment.

### 4.5 Worked example (use this as the first test fixture)

**Aria, Broker.** One day, ten scans, in this order:

| # | Receiver role | Base | Tier | Weighted |
| --- | --- | --- | --- | --- |
| 1 | Weaver | 5 | 1.00 | 5.00 |
| 2 | Patron | 7 | 1.00 | 7.00 |
| 3 | Artificer | 5 | 1.00 | 5.00 |
| 4 | Broker (own) | 3 | 1.00 | 3.00 |
| 5 | Weaver | 5 | 1.00 | 5.00 |
| 6 | Broker | 3 | 1.00 | 3.00 |
| 7 | Patron | 7 | 1.00 | 7.00 |
| 8 | Weaver | 5 | 1.00 | 5.00 |
| 9 | Broker | 3 | 0.50 | 1.50 |
| 10 | Artificer | 5 | 0.50 | 2.50 |
| | | **48** | | **44.00** |

Distinct roles touched: Weaver, Patron, Artificer, Broker = **4** → diversity
×1.25 → **55.00 scan points for the day.**

Then the day's tasks: Daily Cross +6, two Echo Notes +6, and Role Call +10 once in
the week if this is the day it closes. Receiver side: each of those ten people
earned +1, subject to their own 8/day cap.

This fixture is the acceptance test for P2. If the SQL and this table agree to the
penny, the engine is right.

---

## 5. Derived tasks

All task awards are computed inside the ledger function; nothing is marked
"completed" anywhere. Each row below is a CTE.

| Task | Rule (default) | Points | Cadence | Question |
| --- | --- | --- | --- | --- |
| **Daily Cross** | ≥2 scans that day whose receivers are (a) not the scanner's role and (b) different roles from each other | +6 | per day | B6 |
| **Echo Note** | A pair where both players wrote a note → +3 each; max 5 pairs/day | +3 p.p. | per day | B10 |
| **Role Call** | Connected with all 3 *other* roles at least once | +10 | once | B7 |
| **Patron Touch** | First 5 scans instigated with a Patron | +5 each | once per scan, 5 uses | B8 |
| **Triple Thread** | Three players where all three pairs have a live scan → each participant | +4 | once per triangle, max 3 | B9 |
| **Game Challenger** | 3 *confirmed* games with 3 distinct opponents in one day | +10 | per day | B13 |
| **Questionnaire Chain** | Completed questionnaires with 3 distinct partner roles | +9 | once | B14 |

Notes that matter:

- **Role Call** must exclude the scanner's own role, otherwise everyone gets it
  free within a minute of scanning one friend. Question B7.
- **Echo Note** must award *retroactively* when the second note lands, which is
  why it is derived rather than awarded at write time.
- **Patron Touch** is not cumulative with the base patron +2; it is a flat +5
  bonus on the first N patron scans. Question B8 asks whether they intended a
  diminishing taper instead.
- **Triple Thread** is the vaguest rule in the source document. Default: a closed
  triangle of three live pairs. Question B9.

### 5.1 Game points

| Result | Winner | Loser | Draw (each) |
| --- | --- | --- | --- |
| Points | +6 | +2 | +3 |

One scored game per pair per day (`challenges_pair_day_once`), and the reported
result is only scored once both sides are satisfied (`status = 'confirmed'`).

### 5.2 Snitch system

| Event | Effect |
| --- | --- |
| Report approved | Reporter **+4**, reported player **−3** |
| Reporter's "Stitch" | −1 on the reporter's next successful scan (one per approved report, applied to the next scan after `reviewed_at`) |
| Caps | Max 2 approved reports per reporter per day; a pending duplicate on the same pair/day is blocked by index |

Question B15: whether the Stitch should be a *flag* shown in the UI (my
preference — visible consequences are fairer than hidden ones) and whether the
−3 can push a player below zero (default: no, clamped at 0 lifetime).

### 5.3 Weekend LinkedIn track

Gated by `game_config.phase = 'weekend'` **and** `now() between weekend_at and
locks_at`. Proof is a URL or ≤500-character description, host-approved.

| Task | Points |
| --- | --- |
| Account Activation | +15 |
| Syndicate Signal | +12 |
| Targeted Connect | +10 |
| Value Post | +14 |
| Cross-Circle Comment | +9 |
| Patron Reach | +8 |

Maximum +68. Each task scores once per player (unique index), and only on
`approved`.

---

## 6. The ledger function (shape)

```sql
create or replace function fn_ledger(p_as_of timestamptz default now())
returns table (
  player_id uuid, display_name text, role role_t,
  scan_pts numeric, receive_pts numeric, task_pts numeric,
  game_pts numeric, weekend_pts numeric, snitch_pts numeric, adjust_pts numeric,
  total numeric,
  initiated int, received int, unique_connections int, roles_reached int,
  active_days int, scan_points_capped boolean
)
language sql stable security definer as $$
with
cfg as (select * from game_config where id = 1),
live as (
  select s.*, coalesce(s.client_ts, s.created_at) as ord
    from scans s, cfg
   where s.voided_at is null and s.created_at <= p_as_of
),
seqd as (
  select l.*,
         row_number() over (partition by l.scanner_id, l.game_day
                            order by l.ord, l.created_at, l.id) as seq
    from live l
),
weighted as (
  select s.scanner_id, s.game_day, s.base_points,
         case when s.seq <= c.tier1_n then c.tier1_mult
              when s.seq <= c.tier2_n then c.tier2_mult
              else c.tier3_mult end as tier_mult
    from seqd s, cfg c
),
scanner_day as (
  select w.scanner_id, w.game_day,
         sum(w.base_points * w.tier_mult) as raw,
         count(distinct r.role) as roles_touched,
         count(distinct r.role) filter (where r.role <> p.role) as other_roles
    from weighted w
    join players r on r.id = (select receiver_id from scans
                               where scanner_id = w.scanner_id
                                 and game_day = w.game_day
                                 and voided_at is null
                               limit 1)          -- simplified; real SQL joins seqd
    join players p on p.id = w.scanner_id
   group by 1,2
),
scan_daily as (
  select d.scanner_id, d.game_day,
         d.raw * case when d.roles_touched >= 3 then c.diversity_mult
                      when d.other_roles = 0 then c.mono_mult
                      else 1 end as pts
    from scanner_day d, cfg c
),
scan_total as (
  select scanner_id,
         least(sum(pts), (select weekly_scan_cap from cfg)) as pts,
         sum(pts) > (select weekly_scan_cap from cfg) as capped
    from scan_daily group by 1
),
receive_total as (
  select l.receiver_id as player_id, sum(1) as pts      -- capped per day, see below
    from (select receiver_id, game_day,
                 row_number() over (partition by receiver_id, game_day
                                    order by ord) as rn
            from live) l, cfg c
   where l.rn <= c.receive_cap
   group by 1
),
... -- tasks (§5), games (§5.1), weekend (§5.3), snitch (§5.2), adjustments
select ...
$$;
```

*(The `scanner_day` CTE above is abbreviated for readability — the shipped version
joins `seqd` directly on `receiver_id`. Do not copy-paste; the fixtures in §11 of
`01` are the contract.)*

`fn_winners()` is `fn_ledger()` plus category CTEs:

| Category | Metric (default) | Tie-break |
| --- | --- | --- |
| Top Initiator | `initiated` desc | earliest timestamp reaching that count |
| Master Connector | `unique_connections` desc | total points |
| Cross-Faction Champion | distinct non-own roles, then count | total points |
| Patron's Favour | points earned from patron scans (or patron vote — question B16) | total points |
| Sprint / Game Commander | confirmed wins | total points |
| Role Champion ×4 | `total` within each role | connections |
| Weekend Operator | `weekend_pts` | total |
| Consistent Agent | `active_days` (days with ≥1 live action) | total |
| Syndicate Lead | `total` (optional, question B17) | connections |

---

## 7. State machines

```
challenge:  sent ──accept──▶ accepted ──report──▶ reported ──confirm──▶ confirmed
              │                  │                   │
              └──cancel/expire───┴───────────────────┴──dispute──▶ disputed ──host──▶ confirmed | cancelled

questionnaire: pending ──answer──▶ approved ──(both parties score)──▶ (derived)
                  └──expire(7d, lazy)──▶ rejected

report:  pending ──approve──▶ approved   (reporter +4, reported −3)
             └──reject──▶ rejected

linkedin: pending ──approve──▶ approved (+points, once per task)
              └──reject──▶ rejected   (player may resubmit → new row, unique index
                                       on (player_id, task) forces an update instead)
```

Expiry without a worker: `sent` challenges older than 24 h and unanswered
questionnaires older than 7 days are treated as expired **at read time** by a
`case` in the queries. The admin console offers "tick now" which runs an
`update … where` for housekeeping, but nothing depends on it.

---

## 8. Admin console

| Action | Route | Guard | Notes |
| --- | --- | --- | --- |
| Review queue (snitch, LinkedIn, disputed games) | `GET /admin` | `is_admin` | One list, three tabs, bulk approve |
| Approve / reject | `POST /admin/:kind/:id/review` | `is_admin` | Audited |
| Void a scan | `POST /admin/scans/:id/void` | `is_admin` | Reason required; pair becomes scannable again |
| Manual points | `POST /admin/adjust` | `is_admin` | Writes `ledger_adjustments`, never touches `scans` |
| Import players | `POST /admin/import` | `is_admin` | CSV: name, role, descriptor; generates random 6-digit codes + PINs, and the badge payloads for printing |
| Bulk import scans (paper fallback) | `POST /admin/import-scans` | `is_admin` | CSV of scanner→receiver; idempotent on pair |
| Advance phase / lock | `POST /admin/phase` | `is_admin` | Writes `game_config`, audited |
| Freeze snapshot | `POST /admin/snapshot` | `is_admin` | Writes `snapshots`, also to local JSON |
| Export | `GET /admin/export?kind=…` | `is_admin` | edges / players / ledger / anomalies / submissions |

Every admin write is one SQL function that also inserts the audit row, so the
console cannot forget to log.

### 8.1 Exports

| Kind | Columns |
| --- | --- |
| `edges` | `source,badge,role,target,badge,role,day,base,weighted,voided` |
| `players` | `badge,name,role,descriptor,total,rank` |
| `ledger` | per player per day per component (the thing you defend a prize with) |
| `anomalies` | the signals in `01` §7.3 |
| `snapshot.json` | entire graph + leaderboard + winners, frozen |

The `edges` CSV is the input to any graph tool (Gephi, D3, an LLM prompt). The
snapshot is what the closing ceremony reads.

---

## 9. Seed data

One migration + one script generates 125 players across the four roles with
realistic distributions (patrons ~10 %), 3 000 scans over 7 game days with a
Zipf-ish popularity curve, notes on 40 % of pairs, 120 games, 40 questionnaires,
8 reports, 30 weekend submissions. Same seed → same expected ledger, so the
fixtures are reproducible. This is also the load-test data (`01` §11).
