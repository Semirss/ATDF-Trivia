alter table public.category_levels
  add column if not exists difficulty text not null default 'easy';

do $$
begin
  alter table public.category_levels
    add constraint category_levels_difficulty_check check (difficulty in ('easy','medium','hard'));
exception
  when duplicate_object then null;
end $$;

with level_counts as (
  select
    id,
    level_number,
    count(*) over (partition by category_id) as total_levels
  from public.category_levels
)
update public.category_levels cl
set difficulty = case
  when lc.level_number <= greatest(1, round(lc.total_levels * 0.25)::int) then 'easy'
  when lc.level_number <= greatest(2, round(lc.total_levels * 0.75)::int) then 'medium'
  else 'hard'
end
from level_counts lc
where cl.id = lc.id;

alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

create index if not exists messages_reply_to_message_id_idx on public.messages(reply_to_message_id);
create index if not exists messages_posted_at_idx on public.messages(posted_at desc);

drop view if exists public.leaderboard;

create view public.leaderboard as
with active_level_totals as (
  select coalesce(sum(cl.question_count), 0)::int as total_questions
  from public.category_levels cl
  join public.categories c on c.id = cl.category_id
  where cl.is_active = true and c.is_active = true
),
answer_counts as (
  select player_id, count(*)::int as questions_answered
  from public.score_events
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
  coalesce(pt.current_level_reached, 1) as current_level_reached
from public.players p
left join progress_totals pt on pt.player_id = p.id
left join answer_counts ac on ac.player_id = p.id
cross join active_level_totals alt;
