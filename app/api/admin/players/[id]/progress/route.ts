import { NextResponse } from "next/server";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const [progress, scoreEvents] = await Promise.all([
    supabase.from("player_progress").delete().eq("player_id", params.id),
    supabase.from("score_events").delete().eq("player_id", params.id)
  ]);

  const error = progress.error ?? scoreEvents.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({ ok: true });
}
