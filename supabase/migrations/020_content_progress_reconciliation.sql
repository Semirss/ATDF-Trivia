-- Keep live player progress tied to the questions that currently exist.
-- Historical analytics live in analytics_events/player_game_sessions; gameplay
-- progress must never remain completed after its playable content is replaced.

create or replace function public.reconcile_player_progress(target_category_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
  deleted_count integer := 0;
begin
  with target_progress as (
    select pp.id, pp.player_id, pp.category_id
    from public.player_progress pp
    where target_category_ids is null
      or pp.category_id = any(target_category_ids)
  ),
  active_levels as (
    select cl.id, cl.category_id, cl.level_number, greatest(cl.question_count, 1) as required_questions
    from public.category_levels cl
    join (
      select distinct category_id
      from target_progress
    ) targets on targets.category_id = cl.category_id
    where cl.is_active = true
  ),
  active_questions as (
    select q.id as question_id, al.id as level_id, al.category_id
    from public.questions q
    join active_levels al on al.id = q.level_id
    where q.is_active = true
  ),
  valid_latest_scores as (
    select distinct on (se.player_id, aq.category_id, se.question_id)
      se.player_id,
      aq.category_id,
      aq.level_id,
      se.question_id,
      greatest(se.points, 0)::integer as points
    from public.score_events se
    join active_questions aq
      on aq.question_id = se.question_id
      and aq.level_id = se.level_id
      and aq.category_id = se.category_id
    join target_progress tp
      on tp.player_id = se.player_id
      and tp.category_id = aq.category_id
    order by se.player_id, aq.category_id, se.question_id, se.answered_at desc, se.id desc
  ),
  score_totals as (
    select player_id, category_id, coalesce(sum(points), 0)::integer as total_score
    from valid_latest_scores
    group by player_id, category_id
  ),
  level_question_counts as (
    select al.id as level_id, count(aq.question_id)::integer as active_question_count
    from active_levels al
    left join active_questions aq on aq.level_id = al.id
    group by al.id
  ),
  level_answer_counts as (
    select player_id, category_id, level_id, count(*)::integer as answered_question_count
    from valid_latest_scores
    group by player_id, category_id, level_id
  ),
  level_status as (
    select
      tp.id as progress_id,
      al.level_number,
      (
        lqc.active_question_count >= al.required_questions
        and coalesce(lac.answered_question_count, 0) >= al.required_questions
      ) as is_complete
    from target_progress tp
    join active_levels al on al.category_id = tp.category_id
    join level_question_counts lqc on lqc.level_id = al.id
    left join level_answer_counts lac
      on lac.player_id = tp.player_id
      and lac.category_id = tp.category_id
      and lac.level_id = al.id
  ),
  contiguous_level_status as (
    select
      progress_id,
      level_number,
      bool_and(is_complete) over (
        partition by progress_id
        order by level_number
        rows between unbounded preceding and current row
      ) as is_contiguously_complete
    from level_status
  ),
  progress_state as (
    select
      tp.id as progress_id,
      coalesce(st.total_score, 0)::integer as total_score,
      coalesce(max(cls.level_number) filter (where cls.is_contiguously_complete), 0)::integer as levels_completed,
      coalesce(
        min(cls.level_number) filter (where not cls.is_contiguously_complete),
        max(cls.level_number),
        1
      )::integer as current_level
    from target_progress tp
    left join score_totals st
      on st.player_id = tp.player_id
      and st.category_id = tp.category_id
    left join contiguous_level_status cls on cls.progress_id = tp.id
    group by tp.id, st.total_score
  )
  update public.player_progress pp
  set
    score = ps.total_score,
    levels_completed = ps.levels_completed,
    current_level = ps.current_level,
    current_question_index = 0
  from progress_state ps
  where pp.id = ps.progress_id
    and (
      pp.score is distinct from ps.total_score
      or pp.levels_completed is distinct from ps.levels_completed
      or pp.current_level is distinct from ps.current_level
      or pp.current_question_index is distinct from 0
    );

  get diagnostics updated_count = row_count;

  -- A replaced question set should look unplayed, not like an empty old run.
  -- Keep zero-score attempts when current score events exist (for example, a
  -- player answered everything incorrectly), but remove rows with no evidence
  -- tied to the current content.
  delete from public.player_progress pp
  where (target_category_ids is null or pp.category_id = any(target_category_ids))
    and not exists (
      select 1
      from public.score_events se
      join public.questions q
        on q.id = se.question_id
        and q.is_active = true
      join public.category_levels cl
        on cl.id = q.level_id
        and cl.is_active = true
      where se.player_id = pp.player_id
        and se.category_id = pp.category_id
        and se.level_id = cl.id
    );

  get diagnostics deleted_count = row_count;
  return updated_count + deleted_count;
end;
$$;

revoke execute on function public.reconcile_player_progress(uuid[]) from public;
revoke execute on function public.reconcile_player_progress(uuid[]) from anon;
revoke execute on function public.reconcile_player_progress(uuid[]) from authenticated;
grant execute on function public.reconcile_player_progress(uuid[]) to service_role;

-- Keep the old RPC name working for deployed clients and existing admin code.
create or replace function public.reconcile_progress_scores(target_category_ids uuid[] default null)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.reconcile_player_progress(target_category_ids);
$$;

revoke execute on function public.reconcile_progress_scores(uuid[]) from public;
revoke execute on function public.reconcile_progress_scores(uuid[]) from anon;
revoke execute on function public.reconcile_progress_scores(uuid[]) from authenticated;
grant execute on function public.reconcile_progress_scores(uuid[]) to service_role;

-- Deleting playable content must not be blocked by obsolete score rows.
alter table public.score_events
  drop constraint if exists score_events_question_id_fkey;
alter table public.score_events
  add constraint score_events_question_id_fkey
  foreign key (question_id) references public.questions(id) on delete cascade;

create or replace function public.reconcile_after_questions_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_category_ids uuid[];
begin
  select array_agg(distinct cl.category_id)
  into affected_category_ids
  from old_questions changed
  join public.category_levels cl on cl.id = changed.level_id;

  if affected_category_ids is not null then
    perform public.reconcile_player_progress(affected_category_ids);
  end if;

  return null;
end;
$$;

create or replace function public.reconcile_after_questions_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_question_ids uuid[];
  affected_category_ids uuid[];
begin
  select array_agg(old_row.id), array_agg(distinct cl.category_id)
  into affected_question_ids, affected_category_ids
  from old_questions old_row
  join new_questions new_row on new_row.id = old_row.id
  join public.category_levels cl on cl.id in (old_row.level_id, new_row.level_id)
  where row(
    old_row.level_id,
    old_row.question_text,
    old_row.option_a,
    old_row.option_b,
    old_row.option_c,
    old_row.option_d,
    old_row.correct_option,
    old_row.is_active
  ) is distinct from row(
    new_row.level_id,
    new_row.question_text,
    new_row.option_a,
    new_row.option_b,
    new_row.option_c,
    new_row.option_d,
    new_row.correct_option,
    new_row.is_active
  );

  if affected_question_ids is not null then
    delete from public.score_events
    where question_id = any(affected_question_ids);
  end if;

  if affected_category_ids is not null then
    perform public.reconcile_player_progress(affected_category_ids);
  end if;

  return null;
end;
$$;

drop trigger if exists questions_reconcile_scores on public.questions;
drop trigger if exists questions_reconcile_progress_after_delete on public.questions;
create trigger questions_reconcile_progress_after_delete
after delete on public.questions
referencing old table as old_questions
for each statement
execute function public.reconcile_after_questions_deleted();

drop trigger if exists questions_reconcile_progress_after_update on public.questions;
create trigger questions_reconcile_progress_after_update
after update on public.questions
referencing old table as old_questions new table as new_questions
for each statement
execute function public.reconcile_after_questions_updated();

-- Repair rows that became stale before this migration existed.
select public.reconcile_player_progress(null::uuid[]);
