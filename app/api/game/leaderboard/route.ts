import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchCachedLeaderboard } from "@/lib/supabase/game-content-cache";
import { fetchLeaderboardRow } from "@/lib/supabase/game-data";

const limitSchema = z.coerce.number().int().min(1).max(500).optional();
const playerIdSchema = z.string().uuid().optional();
const cacheHeaders = {
  "Cache-Control": "public, max-age=30, stale-while-revalidate=120"
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = limitSchema.safeParse(searchParams.get("limit") ?? undefined);
  const parsedPlayerId = playerIdSchema.safeParse(searchParams.get("playerId") ?? undefined);

  try {
    if (parsedPlayerId.success && parsedPlayerId.data) {
      const data = await fetchLeaderboardRow(parsedPlayerId.data);
      return NextResponse.json({ data }, { headers: cacheHeaders });
    }

    const data = await fetchCachedLeaderboard(parsedLimit.success ? parsedLimit.data : undefined);
    return NextResponse.json({ data }, { headers: cacheHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load leaderboard.";
    const status = message === "Supabase is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
