import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { deleteQuestionsWithScoreCleanup } from "@/lib/supabase/score-maintenance";

const bulkRemoveSchema = z.object({
  levelIds: z.array(z.string().uuid()).min(1).max(100)
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = bulkRemoveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid bulk remove request." }, { status: 400 });
  }

  const questionsResult = await supabase
    .from("questions")
    .select("id")
    .in("level_id", parsed.data.levelIds);

  if (questionsResult.error) {
    return NextResponse.json({ error: questionsResult.error.message }, { status: 500 });
  }

  try {
    const result = await deleteQuestionsWithScoreCleanup(
      supabase,
      (questionsResult.data ?? []).map((question) => question.id)
    );
    invalidateGameContentCache();
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove questions." },
      { status: 500 }
    );
  }
}
