create or replace function public.delete_category_level(target_level_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_level record;
  score_events_removed integer := 0;
  points_removed integer := 0;
  progress_rows_updated integer := 0;
  later_level_count integer := 0;
  levels_renumbered integer := 0;
begin
  select id, category_id, level_number
  into target_level
  from public.category_levels
  where id = target_level_id;

  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;

  select count(*)::integer, coalesce(sum(points), 0)::integer
  into score_events_removed, points_removed
  from public.score_events
  where level_id = target_level_id;

  select count(*)::integer
  into later_level_count
  from public.category_levels
  where category_id = target_level.category_id
    and level_number > target_level.level_number;

  with removed_scores as (
    select
      player_id,
      category_id,
      coalesce(sum(points), 0)::integer as points_removed
    from public.score_events
    where level_id = target_level_id
    group by player_id, category_id
  ),
  updated_progress as (
    update public.player_progress pp
    set
      score = greatest(
        0,
        pp.score - case
          when pp.levels_completed >= target_level.level_number then coalesce(
            (
              select rs.points_removed
              from removed_scores rs
              where rs.player_id = pp.player_id
                and rs.category_id = pp.category_id
            ),
            0
          )
          else 0
        end
      ),
      levels_completed = case
        when pp.levels_completed >= target_level.level_number then greatest(0, pp.levels_completed - 1)
        else pp.levels_completed
      end,
      current_level = case
        when pp.current_level > target_level.level_number
          or (pp.current_level = target_level.level_number and later_level_count = 0)
          then greatest(1, pp.current_level - 1)
        else pp.current_level
      end,
      current_question_index = case
        when pp.current_level >= target_level.level_number then 0
        else pp.current_question_index
      end,
      last_played_at = now()
    where pp.category_id = target_level.category_id
      and (
        pp.levels_completed >= target_level.level_number
        or pp.current_level > target_level.level_number
        or (pp.current_level = target_level.level_number and later_level_count = 0)
        or exists (
          select 1
          from removed_scores rs
          where rs.player_id = pp.player_id
            and rs.category_id = pp.category_id
        )
      )
    returning 1
  )
  select count(*)::integer
  into progress_rows_updated
  from updated_progress;

  delete from public.score_events
  where level_id = target_level_id;

  delete from public.category_levels
  where id = target_level_id;

  update public.category_levels
  set
    level_number = -level_number,
    updated_at = now()
  where category_id = target_level.category_id
    and level_number > target_level.level_number;

  update public.category_levels
  set
    level_number = abs(level_number) - 1,
    updated_at = now()
  where category_id = target_level.category_id
    and level_number < 0;

  get diagnostics levels_renumbered = row_count;

  return jsonb_build_object(
    'deleted', true,
    'levelId', target_level_id,
    'categoryId', target_level.category_id,
    'deletedLevelNumber', target_level.level_number,
    'scoreEventsRemoved', score_events_removed,
    'pointsRemoved', points_removed,
    'progressRowsUpdated', progress_rows_updated,
    'levelsRenumbered', levels_renumbered
  );
end;
$$;

revoke execute on function public.delete_category_level(uuid) from public;
revoke execute on function public.delete_category_level(uuid) from anon;
revoke execute on function public.delete_category_level(uuid) from authenticated;
grant execute on function public.delete_category_level(uuid) to service_role;
