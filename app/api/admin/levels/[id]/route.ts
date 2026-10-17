import { NextResponse } from "next/server";
import { z } from "zod";
import { levelFormSchema } from "@/lib/validators";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { recalculateCategoryProgressScores } from "@/lib/supabase/score-maintenance";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createServiceSupabaseClient>>>;

const updateLevelSchema = levelFormSchema.partial().extend({
  levelNumber: z.number().int().min(1).optional()
});

function isMissingRpc(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.code === "42883" || error.message?.includes("delete_category_level");
}

async function deleteLevelWithClientCleanup(supabase: Supabase, levelId: string) {
  const levelResult = await supabase
    .from("category_levels")
    .select("id, category_id, level_number")
    .eq("id", levelId)
    .maybeSingle();

  if (levelResult.error) {
    return { error: levelResult.error.message, status: 500 };
  }

  if (!levelResult.data) {
    return { error: "Level not found.", status: 404 };
  }

  const level = levelResult.data;
  const laterLevels = await supabase
    .from("category_levels")
    .select("id, level_number")
    .eq("category_id", level.category_id)
    .gt("level_number", level.level_number)
    .order("level_number", { ascending: true });

  if (laterLevels.error) {
    return { error: laterLevels.error.message, status: 500 };
  }

  const hasLaterLevels = (laterLevels.data?.length ?? 0) > 0;
  const scoreEventsResult = await supabase
    .from("score_events")
    .select("player_id, category_id, points")
    .eq("level_id", levelId);

  if (scoreEventsResult.error) {
    return { error: scoreEventsResult.error.message, status: 500 };
  }

  const removedPointsByProgress = new Map<string, number>();
  for (const event of scoreEventsResult.data ?? []) {
    const key = `${event.player_id}:${event.category_id}`;
    removedPointsByProgress.set(key, (removedPointsByProgress.get(key) ?? 0) + event.points);
  }

  const progressResult = await supabase.from("player_progress").select("*").eq("category_id", level.category_id);

  if (progressResult.error) {
    return { error: progressResult.error.message, status: 500 };
  }

  for (const progress of progressResult.data ?? []) {
    const removedPoints =
      progress.levels_completed >= level.level_number
        ? removedPointsByProgress.get(`${progress.player_id}:${progress.category_id}`) ?? 0
        : 0;
    const nextScore = Math.max(0, progress.score - removedPoints);
    const nextLevelsCompleted =
      progress.levels_completed >= level.level_number ? Math.max(0, progress.levels_completed - 1) : progress.levels_completed;
    const nextCurrentLevel =
      progress.current_level > level.level_number || (progress.current_level === level.level_number && !hasLaterLevels)
        ? Math.max(1, progress.current_level - 1)
        : progress.current_level;
    const nextQuestionIndex = progress.current_level >= level.level_number ? 0 : progress.current_question_index;

    if (
      nextScore === progress.score &&
      nextLevelsCompleted === progress.levels_completed &&
      nextCurrentLevel === progress.current_level &&
      nextQuestionIndex === progress.current_question_index
    ) {
      continue;
    }

    const updateProgress = await supabase
      .from("player_progress")
      .update({
        score: nextScore,
        levels_completed: nextLevelsCompleted,
        current_level: nextCurrentLevel,
        current_question_index: nextQuestionIndex,
        last_played_at: new Date().toISOString()
      })
      .eq("id", progress.id);

    if (updateProgress.error) {
      return { error: updateProgress.error.message, status: 500 };
    }
  }

  const deleteScores = await supabase.from("score_events").delete().eq("level_id", levelId);
  if (deleteScores.error) {
    return { error: deleteScores.error.message, status: 500 };
  }

  const deleteLevel = await supabase.from("category_levels").delete().eq("id", levelId);
  if (deleteLevel.error) {
    return { error: deleteLevel.error.message, status: 500 };
  }

  for (const laterLevel of laterLevels.data ?? []) {
    const updateLevel = await supabase
      .from("category_levels")
      .update({
        level_number: laterLevel.level_number - 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", laterLevel.id);

    if (updateLevel.error) {
      return { error: updateLevel.error.message, status: 500 };
    }
  }

  return { data: { deleted: true, scoreEventsRemoved: scoreEventsResult.data?.length ?? 0 } };
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json();
  const parsed = updateLevelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid level" }, { status: 400 });
  }

  const existingLevel = await supabase
    .from("category_levels")
    .select("category_id")
    .eq("id", params.id)
    .maybeSingle();

  if (existingLevel.error) {
    return NextResponse.json({ error: existingLevel.error.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("category_levels")
    .update({
      level_number: parsed.data.levelNumber,
      title: parsed.data.title,
      difficulty: parsed.data.difficulty,
      question_count: parsed.data.questionCount,
      time_limit_seconds: parsed.data.timeLimitSeconds,
      points_per_correct: parsed.data.pointsPerCorrect,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existingLevel.data) {
    try {
      await recalculateCategoryProgressScores(supabase, [existingLevel.data.category_id]);
    } catch (recalculateError) {
      return NextResponse.json(
        { error: recalculateError instanceof Error ? recalculateError.message : "Unable to reconcile progress." },
        { status: 500 }
      );
    }
  }

  invalidateGameContentCache();
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const rpcResult = await (supabase as any).rpc("delete_category_level", {
    target_level_id: params.id
  });

  if (!rpcResult.error) {
    if (rpcResult.data?.deleted === false) {
      return NextResponse.json({ error: "Level not found." }, { status: 404 });
    }

    invalidateGameContentCache();
    return NextResponse.json({ ok: true, data: rpcResult.data });
  }

  if (!isMissingRpc(rpcResult.error)) {
    return NextResponse.json({ error: rpcResult.error.message }, { status: 500 });
  }

  const fallbackResult = await deleteLevelWithClientCleanup(supabase, params.id);

  if ("error" in fallbackResult) {
    return NextResponse.json({ error: fallbackResult.error }, { status: fallbackResult.status });
  }

  invalidateGameContentCache();
  return NextResponse.json({ ok: true, data: fallbackResult.data });
}
