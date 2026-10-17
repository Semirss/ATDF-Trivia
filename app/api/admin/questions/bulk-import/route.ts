import { NextResponse } from "next/server";
import { z } from "zod";
import { questionFormSchema } from "@/lib/validators";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const bulkImportSchema = z.object({
  levelId: z.string(),
  questions: z.array(questionFormSchema).min(1)
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
  const parsed = bulkImportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid import" }, { status: 400 });
  }

  const latestQuestion = await supabase
    .from("questions")
    .select("sort_order")
    .eq("level_id", parsed.data.levelId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestQuestion.error) {
    return NextResponse.json({ error: latestQuestion.error.message }, { status: 500 });
  }

  const startingOrder = (latestQuestion.data?.sort_order ?? -1) + 1;

  const rows = parsed.data.questions.map((question, index) => ({
    level_id: parsed.data.levelId,
    question_text: question.questionText,
    option_a: question.optionA,
    option_b: question.optionB,
    option_c: question.optionC,
    option_d: question.optionD,
    correct_option: question.correctOption,
    explanation: question.explanation,
    media_url: question.mediaUrl,
    is_active: true, // always active when bulk-imported
    sort_order: startingOrder + index,
    ...(hasTranslations(question.translations) ? { translations: question.translations } : {})
  }));

  const { data, error } = await supabase.from("questions").insert(rows).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateGameContentCache();
  return NextResponse.json({ data });
}
