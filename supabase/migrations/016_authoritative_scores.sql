create or replace function public.reconcile_progress_scores(target_category_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  with valid_latest_scores as (
    select distinct on (se.player_id, aq.category_id, se.question_id)
      se.player_id,
      aq.category_id,
      se.question_id,
      greatest(se.points, 0)::integer as points
    from public.score_events se
    join (
      select q.id as question_id, cl.id as level_id, c.id as category_id
      from public.questions q
      join public.category_levels cl on cl.id = q.level_id and cl.is_active = true
      join public.categories c on c.id = cl.category_id and c.is_active = true
      where q.is_active = true
    ) aq
      on aq.question_id = se.question_id
      and aq.level_id = se.level_id
      and aq.category_id = se.category_id
    order by se.player_id, aq.category_id, se.question_id, se.answered_at desc, se.id desc
  ),
  category_scores as (
    select player_id, category_id, coalesce(sum(points), 0)::integer as total_score
    from valid_latest_scores
    group by player_id, category_id
  )
  update public.player_progress pp
  set score = coalesce(
    (
      select cs.total_score
      from category_scores cs
      where cs.player_id = pp.player_id
        and cs.category_id = pp.category_id
    ),
    0
  )
  where target_category_ids is null
    or pp.category_id = any(target_category_ids);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke execute on function public.reconcile_progress_scores(uuid[]) from public;
revoke execute on function public.reconcile_progress_scores(uuid[]) from anon;
revoke execute on function public.reconcile_progress_scores(uuid[]) from authenticated;
grant execute on function public.reconcile_progress_scores(uuid[]) to service_role;

create or replace function public.delete_game_questions(target_question_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_category_ids uuid[];
  questions_removed integer := 0;
  score_events_removed integer := 0;
begin
  select array_agg(distinct cl.category_id)
  into affected_category_ids
  from public.questions q
  join public.category_levels cl on cl.id = q.level_id
  where q.id = any(target_question_ids);

  delete from public.score_events
  where question_id = any(target_question_ids);
  get diagnostics score_events_removed = row_count;

  delete from public.questions
  where id = any(target_question_ids);
  get diagnostics questions_removed = row_count;

  if affected_category_ids is not null then
    perform public.reconcile_progress_scores(affected_category_ids);
  end if;

  return jsonb_build_object(
    'removed', questions_removed,
    'scoreEventsRemoved', score_events_removed
  );
end;
$$;

revoke execute on function public.delete_game_questions(uuid[]) from public;
revoke execute on function public.delete_game_questions(uuid[]) from anon;
revoke execute on function public.delete_game_questions(uuid[]) from authenticated;
grant execute on function public.delete_game_questions(uuid[]) to service_role;

select public.reconcile_progress_scores(null::uuid[]);

drop view if exists public.leaderboard;

create view public.leaderboard as
with active_questions as (
  select q.id as question_id, cl.id as level_id, c.id as category_id
  from public.questions q
  join public.category_levels cl on cl.id = q.level_id and cl.is_active = true
  join public.categories c on c.id = cl.category_id and c.is_active = true
  where q.is_active = true
),
active_question_total as (
  select count(*)::integer as total_questions
  from active_questions
),
valid_latest_scores as (
  select distinct on (se.player_id, aq.category_id, se.question_id)
    se.player_id,
    aq.category_id,
    se.question_id,
    greatest(se.points, 0)::integer as points
  from public.score_events se
  join active_questions aq
    on aq.question_id = se.question_id
    and aq.level_id = se.level_id
    and aq.category_id = se.category_id
  order by se.player_id, aq.category_id, se.question_id, se.answered_at desc, se.id desc
),
answer_totals as (
  select
    player_id,
    coalesce(sum(points), 0)::integer as total_score,
    count(*)::integer as questions_answered,
    count(distinct category_id)::integer as categories_played
  from valid_latest_scores
  group by player_id
),
progress_levels as (
  select player_id, coalesce(max(current_level), 1)::integer as current_level_reached
  from public.player_progress
  group by player_id
)
select
  p.id as player_id,
  p.name,
  p.avatar_url,
  coalesce(at.total_score, 0) as total_score,
  coalesce(at.categories_played, 0) as categories_played,
  rank() over (order by coalesce(at.total_score, 0) desc) as global_rank,
  case
    when aqt.total_questions > 0
      then least(100, round((coalesce(at.questions_answered, 0)::numeric / aqt.total_questions) * 100)::integer)
    else 0
  end as completion_percent,
  coalesce(at.questions_answered, 0) as questions_answered,
  coalesce(aqt.total_questions, 0) as total_questions,
  coalesce(pl.current_level_reached, 1) as current_level_reached,
  exists (
    select 1
    from public.reward_profiles rp
    where rp.player_id = p.id
  ) as is_verified
from public.players p
left join answer_totals at on at.player_id = p.id
left join progress_levels pl on pl.player_id = p.id
cross join active_question_total aqt;

create or replace function public.reconcile_scores_after_question_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_category_ids uuid[];
begin
  if tg_op = 'DELETE' then
    select array_agg(distinct cl.category_id)
    into affected_category_ids
    from public.category_levels cl
    where cl.id = old.level_id;
  else
    select array_agg(distinct cl.category_id)
    into affected_category_ids
    from public.category_levels cl
    where cl.id in (old.level_id, new.level_id);
  end if;

  if affected_category_ids is not null then
    perform public.reconcile_progress_scores(affected_category_ids);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists questions_reconcile_scores on public.questions;
create trigger questions_reconcile_scores
after update of is_active, level_id or delete
on public.questions
for each row
execute function public.reconcile_scores_after_question_change();
