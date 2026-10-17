import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const questionSubmissionSchema = z.object({
  playerId: z.string().uuid().nullable().optional(),
  playerName: z.string().trim().max(60).nullable().optional(),
  questionText: z.string().trim().min(4).max(1000)
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = questionSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid question." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("question_submissions")
    .insert({
      player_id: parsed.data.playerId ?? null,
      player_name: parsed.data.playerName ?? "",
      question_text: parsed.data.questionText,
      source: "home_robot"
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to save question." }, { status: 500 });
  }

  return NextResponse.json({ data });
}
