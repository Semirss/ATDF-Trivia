create table if not exists public.youtube_ad_views (
  id uuid primary key,
  player_id uuid references public.players(id) on delete set null,
  video_id text not null,
  video_url text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  watched_seconds integer not null default 0 check (watched_seconds >= 0)
);

create index if not exists youtube_ad_views_video_started_idx
  on public.youtube_ad_views(video_id, started_at desc);

create index if not exists youtube_ad_views_player_started_idx
  on public.youtube_ad_views(player_id, started_at desc);

alter table public.youtube_ad_views enable row level security;

create or replace view public.youtube_ad_view_stats
with (security_invoker = true)
as
select
  video_id,
  max(video_url) as video_url,
  count(*)::integer as views,
  count(completed_at)::integer as completed_views,
  coalesce(sum(watched_seconds), 0)::integer as watched_seconds,
  max(started_at) as last_viewed_at
from public.youtube_ad_views
group by video_id;

revoke all on public.youtube_ad_views from anon, authenticated;
revoke all on public.youtube_ad_view_stats from anon, authenticated;
grant all on public.youtube_ad_views to service_role;
grant select on public.youtube_ad_view_stats to service_role;
