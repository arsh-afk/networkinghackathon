-- Syndicate Accord — schema reflecting applied decisions (plan/02 + plan/APPLIED-DECISIONS.md)
-- Idempotent-ish for fresh setups; review before production. Fixture-driven scoring RPCs still TODO.

create extension if not exists pgcrypto;

do $$ begin create type role_t as enum ('artificer','broker','weaver','patron'); exception when duplicate_object then null; end $$;
do $$ begin create type phase_t as enum ('setup','live','weekend','locked','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type challenge_status as enum ('sent','accepted','reported','confirmed','disputed','cancelled','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type review_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type linkedin_task as enum ('activation','signal','targeted','value','comment','patron_reach'); exception when duplicate_object then null; end $$;

create table if not exists game_config (
  id                  int primary key default 1 check (id = 1),
  event_name          text    not null default 'The Syndicate Accord',
  tz                  text    not null default 'Asia/Dubai',
  starts_at           timestamptz,
  weekend_at          timestamptz,
  locks_at            timestamptz,
  day_rollover_h      int     not null default 0, -- B2 override: midnight
  rules_version       int     not null default 1,
  phase               phase_t not null default 'setup',
  tier1_n             int     not null default 8,
  tier2_n             int     not null default 15,
  tier1_mult          numeric not null default 1.00,
  tier2_mult          numeric not null default 0.50,
  tier3_mult          numeric not null default 0.25,
  diversity_mult      numeric not null default 1.25,
  mono_mult           numeric not null default 0.75,
  weekly_scan_cap     numeric not null default 220,
  patron_scan_bonus   int     not null default 1, -- A4 reduced (base bonus component)
  patron_touch_t1_n   int     not null default 3,
  patron_touch_t1_pts int     not null default 3,
  patron_touch_t2_n   int     not null default 3,
  patron_touch_t2_pts int     not null default 1,
  receive_cap         int     not null default 8
);

-- Main game players (A2/C1/C6): minimal PII. No character/bio data stored here.
create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  email         text unique check (email is null or email ~* '^[^@\s]+@aurak\.ac\.ae$'),
  display_name  text not null check (char_length(display_name) between 2 and 40),
  role          role_t not null,
  descriptor    text check (char_length(descriptor) <= 60),
  badge_code    char(6) not null unique check (badge_code ~ '^[0-9]{6}$'),
  badge_version int  not null default 1,
  pin_hash      text not null, -- 6-digit PIN hash (A2)
  is_active     boolean not null default true,
  consent_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists retired_badges (
  code       char(6) primary key check (code ~ '^[0-9]{6}$'),
  player_id  uuid not null references players(id) on delete cascade,
  retired_at timestamptz not null default now(),
  reason     text
);

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

-- A8: Game warden/admin accounts (separate from players). Bootstrap Arsh can add users.
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

-- A2: login/conflict reports visible to admins
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

-- TODO (plan 02): notes, challenges, questionnaires, reports, linkedin_submissions,
-- ledger_adjustments, snapshots; RLS enable + revoke grants; game_day_for(); rpc_scan();
-- fn_ledger()/fn_winners() with A4 reduced patron values and fixture tests.
