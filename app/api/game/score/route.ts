import { NextResponse } from "next/server";
import { z } from "zod";
import { mapConfig, mapScoreEvent } from "@/lib/data-mappers";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const scoreSchema = z.object({
  playerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  levelId: z.string().uuid(),
  questionId: z.string().uuid(),
  currentStreak: z.number().int().min(0),
  selectedOption: z.enum(["a", "b", "c", "d"]).nullable()
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  const serviceSupabase = supabase;

  const body: unknown = await request.json();
  const parsed = scoreSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid score payload" }, { status: 400 });
  }

  const scorePayload = parsed.data;

  async function findExistingScoreEvent() {
    return serviceSupabase
      .from("score_events")
      .select("*")
      .eq("player_id", scorePayload.playerId)
      .eq("category_id", scorePayload.categoryId)
      .eq("level_id", scorePayload.levelId)
      .eq("question_id", scorePayload.questionId)
      .order("answered_at", { ascending: false })
      .limit(1);
  }

  const [questionResult, levelResult, configResult] = await Promise.all([
    serviceSupabase
      .from("questions")
      .select("*")
      .eq("id", scorePayload.questionId)
      .eq("level_id", scorePayload.levelId)
      .eq("is_active", true)
      .single(),
    serviceSupabase
      .from("category_levels")
      .select("*")
      .eq("id", scorePayload.levelId)
      .eq("category_id", scorePayload.categoryId)
      .single(),
    serviceSupabase.from("game_config").select("*")
  ]);

  if (questionResult.error || levelResult.error || configResult.error || !questionResult.data || !levelResult.data) {
    return NextResponse.json({ error: "Question not found for level" }, { status: 404 });
  }

  const isCorrect = scorePayload.selectedOption === questionResult.data.correct_option;
  const config = mapConfig(configResult.data);
  const nextStreak = isCorrect ? scorePayload.currentStreak + 1 : 0;
  const streakMultiplier =
    isCorrect && nextStreak >= config.maxStreakBonus.triggerAt ? config.maxStreakBonus.multiplier : 1;
  const points = isCorrect ? levelResult.data.points_per_correct * streakMultiplier : 0;
  const existingScoreEvent = await findExistingScoreEvent();

  if (existingScoreEvent.error) {
    return NextResponse.json({ error: existingScoreEvent.error.message }, { status: 500 });
  }

  const existingEvent = existingScoreEvent.data?.[0];
  if (existingEvent) {
    return NextResponse.json({
      isCorrect: existingEvent.is_correct,
      points: existingEvent.points,
      correctOption: questionResult.data.correct_option,
      event: mapScoreEvent(existingEvent)
    });
  }

  const scoreEventResult = await serviceSupabase
    .from("score_events")
    .insert({
      player_id: scorePayload.playerId,
      category_id: scorePayload.categoryId,
      level_id: scorePayload.levelId,
      question_id: scorePayload.questionId,
      is_correct: isCorrect,
      points
    })
    .select("*")
    .single();

  if (scoreEventResult.error || !scoreEventResult.data) {
    if (scoreEventResult.error?.code === "23505") {
      const racedScoreEvent = await findExistingScoreEvent();
      const racedEvent = racedScoreEvent.data?.[0];

      if (!racedScoreEvent.error && racedEvent) {
        invalidateLeaderboardCache();
        return NextResponse.json({
          isCorrect: racedEvent.is_correct,
          points: racedEvent.points,
          correctOption: questionResult.data.correct_option,
          event: mapScoreEvent(racedEvent)
        });
      }
    }

    return NextResponse.json({ error: scoreEventResult.error?.message ?? "Unable to record score." }, { status: 500 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({
    isCorrect,
    points,
    correctOption: questionResult.data.correct_option,
    event: mapScoreEvent(scoreEventResult.data)
  });
}
