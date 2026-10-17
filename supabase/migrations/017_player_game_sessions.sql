create table if not exists public.player_game_sessions (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  level_id uuid not null references public.category_levels(id) on delete cascade,
  started_at timestamptz not null default now()
);

create index if not exists player_game_sessions_player_started_idx
  on public.player_game_sessions(player_id, started_at desc);

create index if not exists player_game_sessions_started_idx
  on public.player_game_sessions(started_at desc);

alter table public.player_game_sessions enable row level security;

-- Existing score history represents at least one historical session per played level.
insert into public.player_game_sessions (id, player_id, category_id, level_id, started_at)
select
  gen_random_uuid(),
  scores.player_id,
  scores.category_id,
  scores.level_id,
  coalesce(min(scores.answered_at), now())
from public.score_events scores
where not exists (
  select 1
  from public.player_game_sessions sessions
  where sessions.player_id = scores.player_id
    and sessions.category_id = scores.category_id
    and sessions.level_id = scores.level_id
)
group by scores.player_id, scores.category_id, scores.level_id;
