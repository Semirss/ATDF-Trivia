create table if not exists public.telegram_user_profiles (
  telegram_id text primary key,
  phone text,
  username text,
  first_name text,
  last_name text,
  age integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_user_profiles_phone_idx
  on public.telegram_user_profiles(phone);

alter table public.telegram_user_profiles enable row level security;
