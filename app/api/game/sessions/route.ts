import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const gameSessionSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  levelId: z.string().uuid()
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = gameSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid game session payload." }, { status: 400 });
  }

  const { error } = await supabase.from("player_game_sessions").upsert(
    {
      id: parsed.data.sessionId,
      player_id: parsed.data.playerId,
      category_id: parsed.data.categoryId,
      level_id: parsed.data.levelId
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
