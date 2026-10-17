create table if not exists public.donation_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_ref text not null unique,
  player_id uuid references public.players(id) on delete set null,
  donor_name text,
  donor_email text,
  donor_phone text,
  amount numeric(12, 2) not null check (amount >= 10 and amount <= 100000),
  currency text not null default 'ETB' check (currency in ('ETB')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'cancelled', 'refunded')),
  chapa_reference text,
  checkout_url text,
  mode text,
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donation_transactions_player_id_idx on public.donation_transactions(player_id);
create index if not exists donation_transactions_status_idx on public.donation_transactions(status);
create index if not exists donation_transactions_created_at_idx on public.donation_transactions(created_at desc);

alter table public.donation_transactions enable row level security;

drop policy if exists "Service role manages donation transactions" on public.donation_transactions;
create policy "Service role manages donation transactions"
on public.donation_transactions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
