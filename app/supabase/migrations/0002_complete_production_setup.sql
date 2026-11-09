-- =========================================================================
-- THE SYNDICATE ACCORD — COMPLETE PRODUCTION POSTGRES SCHEMA & RPC FUNCTIONS
-- Run this once in the Supabase SQL Editor.
-- =========================================================================

create extension if not exists pgcrypto;

-- Enums
do $$ begin create type role_t as enum ('artificer','broker','weaver','patron'); exception when duplicate_object then null; end $$;
do $$ begin create type phase_t as enum ('setup','live','weekend','locked','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type challenge_status as enum ('sent','accepted','reported','confirmed','disputed','cancelled','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type review_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type linkedin_task as enum ('activation','signal','targeted','value','comment','patron_reach'); exception when duplicate_object then null; end $$;

-- 1. Game Config
create table if not exists game_config (
  id                  int primary key default 1 check (id = 1),
  event_name          text    not null default 'The Syndicate Accord',
  tz                  text    not null default 'Asia/Dubai',
  starts_at           timestamptz not null default '2026-11-16T00:00:00+04:00',
  weekend_at          timestamptz not null default '2026-11-21T00:00:00+04:00',
  locks_at            timestamptz not null default '2026-11-23T23:59:59+04:00',
  day_rollover_h      int     not null default 0, -- Midnight local
  rules_version       int     not null default 1,
  phase               phase_t not null default 'live',
  tier1_n             int     not null default 8,
  tier2_n             int     not null default 15,
  tier1_mult          numeric not null default 1.00,
  tier2_mult          numeric not null default 0.50,
  tier3_mult          numeric not null default 0.25,
  diversity_mult      numeric not null default 1.25,
  mono_mult           numeric not null default 0.75,
  weekly_scan_cap     numeric not null default 220,
  patron_scan_bonus   int     not null default 1, -- A4 reduced
  patron_touch_t1_n   int     not null default 3,
  patron_touch_t1_pts int     not null default 3,
  patron_touch_t2_n   int     not null default 3,
  patron_touch_t2_pts int     not null default 1,
  receive_cap         int     not null default 8
);

insert into game_config (id, event_name) values (1, 'The Syndicate Accord')
on conflict (id) do nothing;

-- 2. Players (Minimal PII: AURAK email only for auth/audit; deleted post-event)
create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  email         text unique check (email is null or email ~* '^[^@\s]+@aurak\.ac\.ae$'),
  display_name  text not null check (char_length(display_name) between 2 and 40),
  role          role_t not null,
  descriptor    text check (char_length(descriptor) <= 60),
  badge_code    char(6) not null unique check (badge_code ~ '^[0-9]{6}$'),
  badge_version int  not null default 1,
  pin_hash      text not null,
  is_active     boolean not null default true,
  is_admin      boolean not null default false,
  consent_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists players_role_idx on players (role) where is_active;
create index if not exists players_badge_idx on players (badge_code) where is_active;

-- 3. Retired Badges
create table if not exists retired_badges (
  code       char(6) primary key check (code ~ '^[0-9]{6}$'),
  player_id  uuid not null references players(id) on delete cascade,
  retired_at timestamptz not null default now(),
  reason     text
);

-- 4. Player Sessions
create table if not exists player_sessions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  token_hash  bytea not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  user_agent  text
);
create index if not exists player_sessions_player_idx on player_sessions (player_id) where revoked_at is null;

-- 5. Admin Users & Sessions
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique check (char_length(username) between 2 and 40),
  password_hash text not null,
  display_name  text,
  is_active     boolean not null default true,
  created_by    uuid references admin_users(id),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists admin_sessions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references admin_users(id) on delete cascade,
  token_hash  bytea not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  user_agent  text
);

-- 6. Auth Conflicts
create table if not exists auth_conflicts (
  id          uuid primary key default gen_random_uuid(),
  email       text,
  badge_code  char(6),
  detail      text,
  status      review_status not null default 'pending',
  resolved_by uuid references admin_users(id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- 7. Scans (Core engine)
create table if not exists scans (
  id            uuid primary key default gen_random_uuid(),
  scanner_id    uuid not null references players(id),
  receiver_id   uuid not null references players(id),
  base_points   int  not null,
  game_day      date not null,
  created_at    timestamptz not null default now(),
  client_ts     timestamptz,
  via           text not null default 'qr' check (via in ('qr','code','admin','import')),
  client_uuid   uuid not null unique,
  voided_at     timestamptz,
  voided_by     uuid references admin_users(id),
  void_reason   text,
  constraint no_self check (scanner_id <> receiver_id)
);

create unique index if not exists scans_pair_once
  on scans (least(scanner_id, receiver_id), greatest(scanner_id, receiver_id))
  where voided_at is null;
create index if not exists scans_scanner_day_idx on scans (scanner_id, game_day, created_at) where voided_at is null;
create index if not exists scans_receiver_day_idx on scans (receiver_id, game_day) where voided_at is null;

-- 8. Challenges (Mini-games)
create table if not exists challenges (
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
create unique index if not exists challenges_pair_day_once
  on challenges (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id), game_day)
  where status = 'confirmed';

-- 9. Echo Notes
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  scan_id     uuid not null references scans(id) on delete cascade,
  author_id   uuid not null references players(id),
  target_id   uuid not null references players(id),
  body        text not null check (char_length(body) between 1 and 280),
  created_at  timestamptz not null default now(),
  unique (scan_id, author_id)
);

-- 10. Reports (Integrity & Snitch)
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references players(id),
  reported_id uuid not null references players(id),
  note        text,
  game_day    date not null,
  status      review_status not null default 'pending',
  reviewed_by uuid references admin_users(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint no_self_report check (reporter_id <> reported_id)
);

-- 11. Weekend LinkedIn Submissions
create table if not exists linkedin_submissions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id),
  task        linkedin_task not null,
  proof_url   text,
  description text check (char_length(description) <= 500),
  status      review_status not null default 'pending',
  reviewed_by uuid references admin_users(id),
  reviewed_at timestamptz,
  game_day    date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (player_id, task)
);

-- 12. Manual Points Adjustments
create table if not exists ledger_adjustments (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id),
  delta      numeric not null,
  reason     text not null,
  created_by uuid not null references admin_users(id),
  created_at timestamptz not null default now()
);

-- 13. Audit Log
create table if not exists audit_log (
  id         bigserial primary key,
  actor_type text not null check (actor_type in ('admin','system','player')),
  actor_id   uuid,
  action     text not null,
  target     text,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);

-- 14. Snapshots (Closing ceremony freeze)
create table if not exists snapshots (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'closing',
  payload     jsonb not null,
  created_by  uuid references admin_users(id),
  created_at  timestamptz not null default now()
);

-- =========================================================================
-- STORED PROCEDURES & RPC
-- =========================================================================

-- Date calculation considering day rollover hour and timezone
create or replace function game_day_for(ts timestamptz)
returns date language sql stable as $$
  select ((ts at time zone (select tz from game_config where id = 1)) - make_interval(hours =>
           (select day_rollover_h from game_config where id = 1)))::date;
$$;

-- Atomic Scan RPC
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
    return jsonb_build_object('ok',false,'code','BAD_BADGE','message','Invalid mark format.');
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
  -- A4: Cross-faction = +2, Patron base bonus = +1 (stacks to 6)
  base := 3
        + case when them.role <> me.role then 2 else 0 end
        + case when them.role = 'patron' then cfg.patron_scan_bonus else 0 end;

  -- Idempotent replay
  select id into scan_id from scans where client_uuid = p_client;
  if found then
    return jsonb_build_object('ok',true,'replay',true,'scan_id',scan_id);
  end if;

  -- Duplicate pair guard
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

  select count(*) into seq
    from scans s
   where s.scanner_id = me.id and s.game_day = day and s.voided_at is null;

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
                          case when them.role = 'patron' then cfg.patron_scan_bonus else 0 end)),
    'base', base,
    'tier', case when seq <= cfg.tier1_n then 1 when seq <= cfg.tier2_n then 2 else 3 end,
    'tier_mult', mult,
    'scan_points', round(base * mult, 2),
    'day_seq', seq,
    'receiver_points', 1
  );
end $$;

-- RLS: Enabled on all tables, with server-only service_role access.
alter table game_config enable row level security;
alter table players enable row level security;
alter table retired_badges enable row level security;
alter table player_sessions enable row level security;
alter table admin_users enable row level security;
alter table admin_sessions enable row level security;
alter table auth_conflicts enable row level security;
alter table scans enable row level security;
alter table challenges enable row level security;
alter table notes enable row level security;
alter table reports enable row level security;
alter table linkedin_submissions enable row level security;
alter table ledger_adjustments enable row level security;
alter table audit_log enable row level security;
alter table snapshots enable row level security;

-- Revoke all direct client access
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

