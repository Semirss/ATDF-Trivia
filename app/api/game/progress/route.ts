import { NextResponse } from "next/server";
import { z } from "zod";
import { mapLevel, mapPlayerProgress } from "@/lib/data-mappers";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { calculateAuthoritativeCategoryScore } from "@/lib/supabase/score-maintenance";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const progressSchema = z.object({
  playerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  currentLevel: z.number().int().min(1),
  sessionScore: z.number().int().min(0),
  questionIds: z.array(z.string().uuid()).min(1).max(100).optional()
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json();
  const parsed = progressSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
  }

  const existingResult = await supabase
    .from("player_progress")
    .select("*")
    .eq("player_id", parsed.data.playerId)
    .eq("category_id", parsed.data.categoryId)
    .maybeSingle();

  if (existingResult.error) {
    return NextResponse.json(
      { error: existingResult.error.message },
      { status: 500 }
    );
  }

  const existing = existingResult.data;
  const completedLevelResult = await supabase
    .from("category_levels")
    .select("id, question_count, is_active")
    .eq("category_id", parsed.data.categoryId)
    .eq("level_number", parsed.data.currentLevel)
    .maybeSingle();

  if (completedLevelResult.error || !completedLevelResult.data || !completedLevelResult.data.is_active) {
    return NextResponse.json({ error: "That level is no longer available." }, { status: 409 });
  }

  const alreadyCompletedLevel = (existing?.levels_completed ?? 0) >= parsed.data.currentLevel;

  if (!alreadyCompletedLevel) {
    const [activeQuestionsResult, answerEventsResult] = await Promise.all([
      supabase
        .from("questions")
        .select("id")
        .eq("level_id", completedLevelResult.data.id)
        .eq("is_active", true),
      supabase
        .from("score_events")
        .select("question_id")
        .eq("player_id", parsed.data.playerId)
        .eq("category_id", parsed.data.categoryId)
        .eq("level_id", completedLevelResult.data.id)
    ]);

    const answerValidationError = activeQuestionsResult.error ?? answerEventsResult.error;
    if (answerValidationError) {
      return NextResponse.json({ error: answerValidationError.message }, { status: 500 });
    }

    const activeQuestionIds = new Set((activeQuestionsResult.data ?? []).map((question) => question.id));
    const answeredQuestionIds = new Set(
      (answerEventsResult.data ?? [])
        .map((event) => event.question_id)
        .filter((questionId): questionId is string => Boolean(questionId && activeQuestionIds.has(questionId)))
    );
    const requiredQuestionCount = completedLevelResult.data.question_count;
    const submittedQuestionIds = Array.from(new Set(parsed.data.questionIds ?? []))
      .filter((questionId) => activeQuestionIds.has(questionId))
      .slice(0, requiredQuestionCount);
    const missingQuestionIds = submittedQuestionIds.filter((questionId) => !answeredQuestionIds.has(questionId));

    if (
      activeQuestionIds.size < requiredQuestionCount ||
      (parsed.data.questionIds && submittedQuestionIds.length < requiredQuestionCount)
    ) {
      return NextResponse.json(
        { error: "That level's question set changed. Reload the level and try again." },
        { status: 409 }
      );
    }

    if (parsed.data.questionIds && missingQuestionIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some answers did not reach the server. Reconnecting them now.",
          code: "MISSING_ANSWERS",
          missingQuestionIds
        },
        { status: 409 }
      );
    }

    if (!parsed.data.questionIds && answeredQuestionIds.size < requiredQuestionCount) {
      return NextResponse.json(
        { error: "Finish every active question before completing this level." },
        { status: 409 }
      );
    }
  }

  const completedThrough = Math.max(existing?.levels_completed ?? 0, parsed.data.currentLevel);
  const nextLevelResult = await supabase
    .from("category_levels")
    .select("*")
    .eq("category_id", parsed.data.categoryId)
    .gt("level_number", completedThrough)
    .eq("is_active", true)
    .order("level_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextLevelResult.error) {
    return NextResponse.json({ error: nextLevelResult.error.message }, { status: 500 });
  }

  const nextLevel = nextLevelResult.data;
  const nextCurrentLevel = nextLevel
    ? Math.max(existing?.current_level ?? nextLevel.level_number, nextLevel.level_number)
    : Math.max(existing?.current_level ?? parsed.data.currentLevel, parsed.data.currentLevel);
  let nextScore: number;

  try {
    nextScore = await calculateAuthoritativeCategoryScore(
      supabase,
      parsed.data.playerId,
      parsed.data.categoryId
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify the score." },
      { status: 500 }
    );
  }

  const updatedProgress = await supabase
    .from("player_progress")
    .upsert(
      {
        id: existing?.id,
        player_id: parsed.data.playerId,
        category_id: parsed.data.categoryId,
        current_level: nextCurrentLevel,
        current_question_index: 0,
        score: nextScore,
        levels_completed: completedThrough,
        last_played_at: new Date().toISOString()
      },
      { onConflict: "player_id,category_id" }
    )
    .select("*")
    .single();

  if (updatedProgress.error || !updatedProgress.data) {
    return NextResponse.json(
      {
        error: updatedProgress.error?.message ?? "Unable to save progress."
      },
      { status: 500 }
    );
  }

  invalidateLeaderboardCache();
  return NextResponse.json({
    nextLevel: nextLevel ? mapLevel(nextLevel) : null,
    categoryComplete: !nextLevel,
    progress: mapPlayerProgress(updatedProgress.data)
  });
}
