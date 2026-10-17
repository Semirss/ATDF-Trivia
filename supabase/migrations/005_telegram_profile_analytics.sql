alter table public.players
  add column if not exists telegram_id text,
  add column if not exists telegram_username text,
  add column if not exists telegram_phone text,
  add column if not exists telegram_photo_url text,
  add column if not exists source text not null default 'web';

do $$
begin
  alter table public.players
    add constraint players_source_check check (source in ('web', 'telegram'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists players_telegram_id_key
  on public.players(telegram_id)
  where telegram_id is not null;

create index if not exists players_source_idx on public.players(source);

create index if not exists reward_profiles_phone_idx on public.reward_profiles(phone);
create index if not exists reward_profiles_telegram_username_idx on public.reward_profiles(telegram_username);

create table if not exists public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  event_type text not null check (event_type in ('button_tap', 'game_played', 'level_completed')),
  event_key text not null,
  label text not null default '',
  path text not null default '',
  count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  unique(event_date, event_type, event_key, path)
);

create index if not exists analytics_daily_event_date_idx
  on public.analytics_daily(event_date desc);

create index if not exists analytics_daily_event_type_idx
  on public.analytics_daily(event_type);

alter table public.analytics_daily enable row level security;

create or replace function public.increment_analytics_daily(events jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  event_type_value text;
  event_count integer;
begin
  if jsonb_typeof(events) <> 'array' then
    return;
  end if;

  for item in select * from jsonb_array_elements(events) loop
    event_type_value := item->>'eventType';

    if event_type_value not in ('button_tap', 'game_played', 'level_completed') then
      continue;
    end if;

    begin
      event_count := greatest(1, least(coalesce((item->>'count')::integer, 1), 10000));
    exception
      when invalid_text_representation then
        event_count := 1;
    end;

    insert into public.analytics_daily (
      event_date,
      event_type,
      event_key,
      label,
      path,
      count,
      last_seen_at
    )
    values (
      coalesce(nullif(item->>'eventDate', '')::date, current_date),
      event_type_value,
      left(coalesce(nullif(item->>'eventKey', ''), 'unknown'), 120),
      left(coalesce(nullif(item->>'label', ''), 'unknown'), 120),
      left(coalesce(nullif(item->>'path', ''), '/'), 160),
      event_count,
      now()
    )
    on conflict (event_date, event_type, event_key, path)
    do update set
      count = public.analytics_daily.count + excluded.count,
      label = excluded.label,
      last_seen_at = now();
  end loop;
end;
$$;

revoke execute on function public.increment_analytics_daily(jsonb) from public;
revoke execute on function public.increment_analytics_daily(jsonb) from anon;
revoke execute on function public.increment_analytics_daily(jsonb) from authenticated;
grant execute on function public.increment_analytics_daily(jsonb) to service_role;
