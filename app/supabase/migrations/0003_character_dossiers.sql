-- Character dossiers are generated from role-builder intake data.
create table if not exists character_dossiers (
  email text primary key check (email ~* '^[^@\s]+@aurak\.ac\.ae$'),
  character_data jsonb not null,
  dossier_text text not null,
  registration_token_hash bytea unique,
  registration_expires_at timestamptz,
  registered_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table character_dossiers enable row level security;
revoke all on table character_dossiers from anon, authenticated;
grant all on table character_dossiers to service_role;
