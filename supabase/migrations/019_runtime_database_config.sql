-- Runtime database target configuration is stored only in the master project.
-- The payload is encrypted by the application before it is written here.
create table if not exists public.runtime_database_config (
  slot text primary key check (slot = 'active'),
  encrypted_payload text not null,
  updated_at timestamptz not null default now()
);

alter table public.runtime_database_config enable row level security;

revoke all on table public.runtime_database_config from anon, authenticated;
grant all on table public.runtime_database_config to service_role;
