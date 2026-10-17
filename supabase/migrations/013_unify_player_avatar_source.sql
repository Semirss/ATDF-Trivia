do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'telegram_photo_url'
  ) then
    update public.players
    set avatar_url = telegram_photo_url
    where nullif(trim(coalesce(avatar_url, '')), '') is null
      and nullif(trim(coalesce(telegram_photo_url, '')), '') is not null;
  end if;
end $$;

alter table public.players
  drop column if exists telegram_photo_url;
