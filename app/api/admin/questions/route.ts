import { NextResponse } from "next/server";
import { z } from "zod";
import { questionFormSchema } from "@/lib/validators";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const createQuestionSchema = questionFormSchema.extend({
  levelId: z.string(),
  sortOrder: z.number().int().min(0)
});

function hasTranslations(translations: Record<string, unknown>) {
  return Object.keys(translations).length > 0;
}

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json();
  const parsed = createQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid question" }, { status: 400 });
  }

  const insertPayload = {
    level_id: parsed.data.levelId,
    question_text: parsed.data.questionText,
    option_a: parsed.data.optionA,
    option_b: parsed.data.optionB,
    option_c: parsed.data.optionC,
    option_d: parsed.data.optionD,
    correct_option: parsed.data.correctOption,
    explanation: parsed.data.explanation,
    media_url: parsed.data.mediaUrl,
    is_active: parsed.data.isActive,
    sort_order: parsed.data.sortOrder,
    ...(hasTranslations(parsed.data.translations) ? { translations: parsed.data.translations } : {})
  };

  const { data, error } = await supabase
    .from("questions")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateGameContentCache();
  return NextResponse.json({ data });
}
