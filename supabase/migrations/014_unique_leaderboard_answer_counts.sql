drop view if exists public.leaderboard;

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

with ranked_duplicate_scores as (
  select
    se.id,
    row_number() over (
      partition by se.player_id, se.category_id, se.level_id, se.question_id
      order by se.answered_at desc, se.id desc
    ) as rank
  from public.score_events se
  where se.question_id is not null
)
delete from public.score_events se
using ranked_duplicate_scores rds
where se.id = rds.id
  and rds.rank > 1;

create unique index if not exists score_events_player_question_key
  on public.score_events(player_id, category_id, level_id, question_id)
  where question_id is not null;

create index if not exists score_events_player_question_lookup_idx
  on public.score_events(player_id, category_id, level_id, question_id, answered_at desc);

with ranked_scores as (
  select
    se.player_id,
    se.category_id,
    se.question_id,
    se.points,
    row_number() over (
      partition by se.player_id, se.category_id, se.question_id
      order by se.answered_at desc, se.id desc
    ) as rank
  from public.score_events se
  where se.question_id is not null
),
category_scores as (
  select
    player_id,
    category_id,
    coalesce(sum(points), 0)::int as total_score
  from ranked_scores
  where rank = 1
  group by player_id, category_id
)
update public.player_progress pp
set score = cs.total_score
from category_scores cs
where pp.player_id = cs.player_id
  and pp.category_id = cs.category_id;

create view public.leaderboard as
with active_level_totals as (
  select coalesce(sum(cl.question_count), 0)::int as total_questions
  from public.category_levels cl
  join public.categories c on c.id = cl.category_id
  where cl.is_active = true and c.is_active = true
),
answer_counts as (
  select player_id, count(distinct question_id)::int as questions_answered
  from public.score_events
  where question_id is not null
  group by player_id
),
progress_totals as (
  select
    player_id,
    coalesce(sum(score), 0)::int as total_score,
    count(distinct case when score > 0 or levels_completed > 0 then category_id end)::int as categories_played,
    coalesce(max(current_level), 1)::int as current_level_reached
  from public.player_progress
  group by player_id
)
select
  p.id as player_id,
  p.name,
  p.avatar_url,
  coalesce(pt.total_score, 0) as total_score,
  coalesce(pt.categories_played, 0) as categories_played,
  rank() over (order by coalesce(pt.total_score, 0) desc) as global_rank,
  case
    when alt.total_questions > 0
      then least(100, round((coalesce(ac.questions_answered, 0)::numeric / alt.total_questions) * 100)::int)
    else 0
  end as completion_percent,
  coalesce(ac.questions_answered, 0) as questions_answered,
  coalesce(alt.total_questions, 0) as total_questions,
  coalesce(pt.current_level_reached, 1) as current_level_reached,
  (rp.player_id is not null) as is_verified
from public.players p
left join progress_totals pt on pt.player_id = p.id
left join answer_counts ac on ac.player_id = p.id
left join public.reward_profiles rp on rp.player_id = p.id
cross join active_level_totals alt;
