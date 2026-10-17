import { NextResponse } from "next/server";
import { z } from "zod";
import { mapPlayer } from "@/lib/data-mappers";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { fetchPlayerSnapshot } from "@/lib/supabase/game-data";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const playerSchema = z.object({
  playerId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(40),
  age: z.number().int().min(0).max(99),
  avatarUrl: z.string().url().optional().or(z.literal("")).optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  try {
    const snapshot = await fetchPlayerSnapshot(playerId);

    if (!snapshot) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json({ data: snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load player.";
    const status = message === "Supabase is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = playerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid player profile." }, { status: 400 });
  }

  const shouldUpdateAvatar =
    typeof body === "object" &&
    body !== null &&
    Object.prototype.hasOwnProperty.call(body, "avatarUrl");
  const payload: {
    name: string;
    age: number;
    avatar_url?: string | null;
  } = {
    name: parsed.data.name,
    age: parsed.data.age
  };

  if (shouldUpdateAvatar) {
    payload.avatar_url = parsed.data.avatarUrl || null;
  }

  const response = parsed.data.playerId
    ? await supabase.from("players").update(payload).eq("id", parsed.data.playerId).select("*").single()
    : await supabase.from("players").insert({ ...payload, avatar_url: parsed.data.avatarUrl || null }).select("*").single();

  if (response.error || !response.data) {
    return NextResponse.json({ error: response.error?.message ?? "Unable to save player." }, { status: 500 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({ data: mapPlayer(response.data) });
}
