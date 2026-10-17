import { createServiceSupabaseClient } from "@/lib/supabase/server";

type ServiceSupabase = NonNullable<Awaited<ReturnType<typeof createServiceSupabaseClient>>>;

interface ScoreEventRow {
  level_id?: string | null;
  question_id: string | null;
  points: number;
  answered_at: string | null;
}

function latestValidScoreTotal(events: ScoreEventRow[], validQuestionIds: Set<string>) {
  const latestByQuestion = new Map<string, ScoreEventRow>();

  for (const event of events) {
    if (!event.question_id || !validQuestionIds.has(event.question_id) || latestByQuestion.has(event.question_id)) {
      continue;
    }

    latestByQuestion.set(event.question_id, event);
  }

  return Array.from(latestByQuestion.values()).reduce((total, event) => total + Math.max(0, event.points), 0);
}

export async function calculateAuthoritativeCategoryScore(
  supabase: ServiceSupabase,
  playerId: string,
  categoryId: string
) {
  const activeLevelsResult = await supabase
    .from("category_levels")
    .select("id")
    .eq("category_id", categoryId)
    .eq("is_active", true);

  if (activeLevelsResult.error) {
    throw new Error(activeLevelsResult.error.message);
  }

  const activeLevelIds = (activeLevelsResult.data ?? []).map((level) => level.id);
  if (activeLevelIds.length === 0) {
    return 0;
  }

  const [questionsResult, scoreEventsResult] = await Promise.all([
    supabase.from("questions").select("id").in("level_id", activeLevelIds).eq("is_active", true),
    supabase
      .from("score_events")
      .select("question_id, points, answered_at")
      .eq("player_id", playerId)
      .eq("category_id", categoryId)
      .order("answered_at", { ascending: false })
  ]);

  const error = questionsResult.error ?? scoreEventsResult.error;
  if (error) {
    throw new Error(error.message);
  }

  const validQuestionIds = new Set((questionsResult.data ?? []).map((question) => question.id));
  return latestValidScoreTotal((scoreEventsResult.data ?? []) as ScoreEventRow[], validQuestionIds);
}

export async function recalculateCategoryProgressScores(
  supabase: ServiceSupabase,
  categoryIds: string[]
) {
  const uniqueCategoryIds = Array.from(new Set(categoryIds));
  if (uniqueCategoryIds.length === 0) {
    return;
  }

  const rpcResult = await (supabase as any).rpc("reconcile_player_progress", {
    target_category_ids: uniqueCategoryIds
  });

  if (!rpcResult.error) {
    return;
  }

  const missingRpc =
    rpcResult.error.code === "PGRST202" ||
    rpcResult.error.code === "42883" ||
    rpcResult.error.message?.includes("reconcile_player_progress");

  if (!missingRpc) {
    throw new Error(rpcResult.error.message);
  }

  for (const categoryId of uniqueCategoryIds) {
    const levelsResult = await supabase
      .from("category_levels")
      .select("id, level_number, question_count")
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("level_number", { ascending: true });

    if (levelsResult.error) {
      throw new Error(levelsResult.error.message);
    }

    const levels = levelsResult.data ?? [];
    const activeLevelIds = new Set(levels.map((level) => level.id));
    const questionsResult = activeLevelIds.size > 0
      ? await supabase
          .from("questions")
          .select("id, level_id")
          .in("level_id", Array.from(activeLevelIds))
          .eq("is_active", true)
      : { data: [], error: null };

    if (questionsResult.error) {
      throw new Error(questionsResult.error.message);
    }

    const activeQuestions = questionsResult.data ?? [];
    const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));
    const questionIdsByLevel = new Map<string, Set<string>>();

    for (const question of activeQuestions) {
      const levelQuestions = questionIdsByLevel.get(question.level_id) ?? new Set<string>();
      levelQuestions.add(question.id);
      questionIdsByLevel.set(question.level_id, levelQuestions);
    }

    const progressResult = await supabase
      .from("player_progress")
      .select("id, player_id")
      .eq("category_id", categoryId);

    if (progressResult.error) {
      throw new Error(progressResult.error.message);
    }

    for (const progress of progressResult.data ?? []) {
      const eventsResult = await supabase
        .from("score_events")
        .select("level_id, question_id, points, answered_at")
        .eq("player_id", progress.player_id)
        .eq("category_id", categoryId)
        .order("answered_at", { ascending: false });

      if (eventsResult.error) {
        throw new Error(eventsResult.error.message);
      }

      const latestEvents = new Map<string, ScoreEventRow>();
      for (const event of (eventsResult.data ?? []) as ScoreEventRow[]) {
        if (!event.question_id || !activeQuestionIds.has(event.question_id) || latestEvents.has(event.question_id)) {
          continue;
        }
        latestEvents.set(event.question_id, event);
      }

      if (latestEvents.size === 0) {
        const deleteProgressResult = await supabase
          .from("player_progress")
          .delete()
          .eq("id", progress.id);

        if (deleteProgressResult.error) {
          throw new Error(deleteProgressResult.error.message);
        }
        continue;
      }

      let levelsCompleted = 0;
      let currentLevel = levels[0]?.level_number ?? 1;
      let foundIncompleteLevel = false;

      for (const level of levels) {
        const levelQuestionIds = questionIdsByLevel.get(level.id) ?? new Set<string>();
        const answeredCount = Array.from(levelQuestionIds).filter((questionId) => latestEvents.has(questionId)).length;
        const isComplete =
          levelQuestionIds.size >= Math.max(1, level.question_count) &&
          answeredCount >= Math.max(1, level.question_count);

        if (!foundIncompleteLevel && isComplete) {
          levelsCompleted = level.level_number;
          currentLevel = level.level_number;
          continue;
        }

        if (!foundIncompleteLevel) {
          currentLevel = level.level_number;
          foundIncompleteLevel = true;
        }
      }

      const score = Array.from(latestEvents.values()).reduce(
        (total, event) => total + Math.max(0, event.points),
        0
      );
      const updateResult = await supabase
        .from("player_progress")
        .update({
          score,
          levels_completed: levelsCompleted,
          current_level: currentLevel,
          current_question_index: 0
        })
        .eq("id", progress.id);

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }
    }
  }
}

export async function deleteQuestionsWithScoreCleanup(
  supabase: ServiceSupabase,
  questionIds: string[]
) {
  const uniqueQuestionIds = Array.from(new Set(questionIds));
  if (uniqueQuestionIds.length === 0) {
    return { removed: 0, scoreEventsRemoved: 0 };
  }

  const rpcResult = await (supabase as any).rpc("delete_game_questions", {
    target_question_ids: uniqueQuestionIds
  });

  if (!rpcResult.error) {
    return {
      removed: Number(rpcResult.data?.removed ?? 0),
      scoreEventsRemoved: Number(rpcResult.data?.scoreEventsRemoved ?? 0)
    };
  }

  const missingRpc =
    rpcResult.error.code === "PGRST202" ||
    rpcResult.error.code === "42883" ||
    rpcResult.error.message?.includes("delete_game_questions");

  if (!missingRpc) {
    throw new Error(rpcResult.error.message);
  }

  const questionsResult = await supabase
    .from("questions")
    .select("id, level_id")
    .in("id", uniqueQuestionIds);

  if (questionsResult.error) {
    throw new Error(questionsResult.error.message);
  }

  const questions = questionsResult.data ?? [];
  if (questions.length === 0) {
    return { removed: 0, scoreEventsRemoved: 0 };
  }

  const levelIds = Array.from(new Set(questions.map((question) => question.level_id)));
  const levelsResult = await supabase
    .from("category_levels")
    .select("id, category_id")
    .in("id", levelIds);

  if (levelsResult.error) {
    throw new Error(levelsResult.error.message);
  }

  const categoryIds = Array.from(new Set((levelsResult.data ?? []).map((level) => level.category_id)));
  const existingQuestionIds = questions.map((question) => question.id);
  const scoreEventsResult = await supabase
    .from("score_events")
    .delete()
    .in("question_id", existingQuestionIds)
    .select("id");

  if (scoreEventsResult.error) {
    throw new Error(scoreEventsResult.error.message);
  }

  const deleteQuestionsResult = await supabase
    .from("questions")
    .delete()
    .in("id", existingQuestionIds)
    .select("id");

  if (deleteQuestionsResult.error) {
    throw new Error(deleteQuestionsResult.error.message);
  }

  await recalculateCategoryProgressScores(supabase, categoryIds);

  return {
    removed: deleteQuestionsResult.data?.length ?? 0,
    scoreEventsRemoved: scoreEventsResult.data?.length ?? 0
  };
}
