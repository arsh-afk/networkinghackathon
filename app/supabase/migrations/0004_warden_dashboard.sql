-- Minimal activity data for approximate online counts in the warden dashboard.
alter table player_sessions
  add column if not exists last_seen_at timestamptz;

update player_sessions
set last_seen_at = created_at
where last_seen_at is null;

alter table player_sessions
  alter column last_seen_at set default now();

create index if not exists player_sessions_presence_idx
  on player_sessions (last_seen_at desc, player_id)
  where revoked_at is null;

create index if not exists audit_log_at_idx
  on audit_log (at desc);

create index if not exists snapshots_created_at_idx
  on snapshots (created_at desc);

create or replace function admin_update_game_config(p_changes jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  before_config jsonb;
  after_config jsonb;
  score_fields text[] := array[
    'tier1_n','tier2_n','tier1_mult','tier2_mult','tier3_mult',
    'diversity_mult','mono_mult','weekly_scan_cap','patron_scan_bonus',
    'patron_touch_t1_n','patron_touch_t1_pts','patron_touch_t2_n',
    'patron_touch_t2_pts','receive_cap'
  ];
begin
  if not exists (select 1 from admin_users where id = p_actor and is_active) then
    raise exception 'Active administrator required';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'Non-empty settings object required';
  end if;

  select to_jsonb(cfg) into before_config
  from game_config cfg
  where id = 1
  for update;
  if before_config is null then
    raise exception 'Game configuration row is missing';
  end if;

  update game_config set
    event_name = case when p_changes ? 'event_name' then p_changes->>'event_name' else event_name end,
    tz = case when p_changes ? 'tz' then p_changes->>'tz' else tz end,
    starts_at = case when p_changes ? 'starts_at' then (p_changes->>'starts_at')::timestamptz else starts_at end,
    weekend_at = case when p_changes ? 'weekend_at' then (p_changes->>'weekend_at')::timestamptz else weekend_at end,
    locks_at = case when p_changes ? 'locks_at' then (p_changes->>'locks_at')::timestamptz else locks_at end,
    day_rollover_h = case when p_changes ? 'day_rollover_h' then (p_changes->>'day_rollover_h')::int else day_rollover_h end,
    phase = case when p_changes ? 'phase' then (p_changes->>'phase')::phase_t else phase end,
    tier1_n = case when p_changes ? 'tier1_n' then (p_changes->>'tier1_n')::int else tier1_n end,
    tier2_n = case when p_changes ? 'tier2_n' then (p_changes->>'tier2_n')::int else tier2_n end,
    tier1_mult = case when p_changes ? 'tier1_mult' then (p_changes->>'tier1_mult')::numeric else tier1_mult end,
    tier2_mult = case when p_changes ? 'tier2_mult' then (p_changes->>'tier2_mult')::numeric else tier2_mult end,
    tier3_mult = case when p_changes ? 'tier3_mult' then (p_changes->>'tier3_mult')::numeric else tier3_mult end,
    diversity_mult = case when p_changes ? 'diversity_mult' then (p_changes->>'diversity_mult')::numeric else diversity_mult end,
    mono_mult = case when p_changes ? 'mono_mult' then (p_changes->>'mono_mult')::numeric else mono_mult end,
    weekly_scan_cap = case when p_changes ? 'weekly_scan_cap' then (p_changes->>'weekly_scan_cap')::numeric else weekly_scan_cap end,
    patron_scan_bonus = case when p_changes ? 'patron_scan_bonus' then (p_changes->>'patron_scan_bonus')::int else patron_scan_bonus end,
    patron_touch_t1_n = case when p_changes ? 'patron_touch_t1_n' then (p_changes->>'patron_touch_t1_n')::int else patron_touch_t1_n end,
    patron_touch_t1_pts = case when p_changes ? 'patron_touch_t1_pts' then (p_changes->>'patron_touch_t1_pts')::int else patron_touch_t1_pts end,
    patron_touch_t2_n = case when p_changes ? 'patron_touch_t2_n' then (p_changes->>'patron_touch_t2_n')::int else patron_touch_t2_n end,
    patron_touch_t2_pts = case when p_changes ? 'patron_touch_t2_pts' then (p_changes->>'patron_touch_t2_pts')::int else patron_touch_t2_pts end,
    receive_cap = case when p_changes ? 'receive_cap' then (p_changes->>'receive_cap')::int else receive_cap end,
    rules_version = rules_version + case when p_changes ?| score_fields then 1 else 0 end
  where id = 1;

  select to_jsonb(cfg) into after_config from game_config cfg where id = 1;
  insert into audit_log (actor_type, actor_id, action, target, before, after)
  values ('admin', p_actor, 'admin.game_config.update', 'game_config:1', before_config, after_config);
  return after_config;
end;
$$;

revoke all on function admin_update_game_config(jsonb, uuid) from public, anon, authenticated;
grant execute on function admin_update_game_config(jsonb, uuid) to service_role;
