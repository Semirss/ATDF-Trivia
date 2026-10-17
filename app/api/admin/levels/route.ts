import { NextResponse } from "next/server";
import { z } from "zod";
import { levelFormSchema } from "@/lib/validators";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const createLevelSchema = levelFormSchema.extend({
  categoryId: z.string(),
  levelNumber: z.number().int().min(1)
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json();
  const parsed = createLevelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid level" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("category_levels")
    .insert({
      category_id: parsed.data.categoryId,
      level_number: parsed.data.levelNumber,
      title: parsed.data.title,
      difficulty: parsed.data.difficulty,
      question_count: parsed.data.questionCount,
      time_limit_seconds: parsed.data.timeLimitSeconds,
      points_per_correct: parsed.data.pointsPerCorrect,
      is_active: parsed.data.isActive
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateGameContentCache();
  return NextResponse.json({ data });
}
