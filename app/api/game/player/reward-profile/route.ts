import { NextResponse } from "next/server";
import { z } from "zod";
import { mapRewardProfile } from "@/lib/data-mappers";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const rewardProfileSchema = z.object({
  playerId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().email(),
  telegramUsername: z.string().trim().min(2).max(40)
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = rewardProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reward profile." }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const existingEmail = await supabase
    .from("reward_profiles")
    .select("player_id")
    .ilike("email", normalizedEmail)
    .neq("player_id", parsed.data.playerId)
    .limit(1)
    .maybeSingle();

  if (existingEmail.error) {
    return NextResponse.json({ error: existingEmail.error.message }, { status: 500 });
  }

  if (existingEmail.data) {
    return NextResponse.json(
      { error: "That email is already used by another verified player. Login instead." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("reward_profiles")
    .upsert(
      {
        player_id: parsed.data.playerId,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        email: normalizedEmail,
        telegram_username: parsed.data.telegramUsername
      },
      { onConflict: "player_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to save reward profile." }, { status: 500 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({ data: mapRewardProfile(data) });
}
