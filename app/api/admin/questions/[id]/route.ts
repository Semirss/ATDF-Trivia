import { NextResponse } from "next/server";
import { questionFormSchema } from "@/lib/validators";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  deleteQuestionsWithScoreCleanup,
  recalculateCategoryProgressScores
} from "@/lib/supabase/score-maintenance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json();
  const parsed = questionFormSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid question" }, { status: 400 });
  }

  const updatePayload = {
    question_text: parsed.data.questionText,
    option_a: parsed.data.optionA,
    option_b: parsed.data.optionB,
    option_c: parsed.data.optionC,
    option_d: parsed.data.optionD,
    correct_option: parsed.data.correctOption,
    explanation: parsed.data.explanation,
    media_url: parsed.data.mediaUrl,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
    ...(parsed.data.translations !== undefined ? { translations: parsed.data.translations } : {})
  };

  const existingQuestion = await supabase
    .from("questions")
    .select("level_id, question_text, option_a, option_b, option_c, option_d, correct_option, is_active")
    .eq("id", params.id)
    .maybeSingle();

  if (existingQuestion.error) {
    return NextResponse.json({ error: existingQuestion.error.message }, { status: 500 });
  }

  const gameplayChanged = Boolean(
    existingQuestion.data &&
    (
      (parsed.data.questionText !== undefined && parsed.data.questionText !== existingQuestion.data.question_text) ||
      (parsed.data.optionA !== undefined && parsed.data.optionA !== existingQuestion.data.option_a) ||
      (parsed.data.optionB !== undefined && parsed.data.optionB !== existingQuestion.data.option_b) ||
      (parsed.data.optionC !== undefined && parsed.data.optionC !== existingQuestion.data.option_c) ||
      (parsed.data.optionD !== undefined && parsed.data.optionD !== existingQuestion.data.option_d) ||
      (parsed.data.correctOption !== undefined && parsed.data.correctOption !== existingQuestion.data.correct_option) ||
      (parsed.data.isActive !== undefined && parsed.data.isActive !== existingQuestion.data.is_active)
    )
  );

  const { data, error } = await supabase
    .from("questions")
    .update(updatePayload)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existingQuestion.data && gameplayChanged) {
    const deleteOldScores = await supabase
      .from("score_events")
      .delete()
      .eq("question_id", params.id);

    if (deleteOldScores.error) {
      return NextResponse.json({ error: deleteOldScores.error.message }, { status: 500 });
    }

    const levelResult = await supabase
      .from("category_levels")
      .select("category_id")
      .eq("id", existingQuestion.data.level_id)
      .maybeSingle();

    if (levelResult.error) {
      return NextResponse.json({ error: levelResult.error.message }, { status: 500 });
    }

    if (levelResult.data) {
      try {
        await recalculateCategoryProgressScores(supabase, [levelResult.data.category_id]);
      } catch (recalculateError) {
        return NextResponse.json(
          { error: recalculateError instanceof Error ? recalculateError.message : "Unable to reconcile scores." },
          { status: 500 }
        );
      }
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

  try {
    const result = await deleteQuestionsWithScoreCleanup(supabase, [params.id]);
    if (result.removed === 0) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    invalidateGameContentCache();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete question." },
      { status: 500 }
    );
  }
}
