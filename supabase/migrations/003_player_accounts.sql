create table if not exists player_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid not null unique references public.players(id) on delete cascade,
  email text not null unique,
  created_at timestamptz default now()
);

alter table player_accounts enable row level security;
