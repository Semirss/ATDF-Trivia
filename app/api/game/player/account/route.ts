import { NextResponse } from "next/server";
import { z } from "zod";
import { mapRewardProfile } from "@/lib/data-mappers";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { fetchPlayerSnapshot } from "@/lib/supabase/game-data";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createAccountSchema = z.object({
  playerId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(72),
  phone: z.string().trim().min(5).max(30).optional(),
  telegramUsername: z.string().trim().min(2).max(40).optional()
});

function accountTable(supabase: NonNullable<Awaited<ReturnType<typeof createServiceSupabaseClient>>>) {
  return (supabase as any).from("player_accounts");
}

function isDuplicateEmailAuthError(message: string | undefined) {
  return Boolean(message?.toLowerCase().match(/already|registered|duplicate|exists/));
}

async function saveVerificationProfile({
  supabase,
  playerId,
  fullName,
  email,
  phone,
  telegramUsername
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof createServiceSupabaseClient>>>;
  playerId: string;
  fullName: string;
  email: string;
  phone: string;
  telegramUsername: string;
}) {
  const existingRewardEmail = await supabase
    .from("reward_profiles")
    .select("player_id")
    .ilike("email", email)
    .neq("player_id", playerId)
    .limit(1)
    .maybeSingle();

  if (existingRewardEmail.error) {
    return { data: null, error: existingRewardEmail.error.message, status: 500 };
  }

  if (existingRewardEmail.data) {
    return { data: null, error: "That email is already used by another verified player. Login instead.", status: 409 };
  }

  const rewardProfile = await supabase
    .from("reward_profiles")
    .upsert(
      {
        player_id: playerId,
        full_name: fullName,
        phone,
        email,
        telegram_username: telegramUsername
      },
      { onConflict: "player_id" }
    )
    .select("*")
    .single();

  if (rewardProfile.error || !rewardProfile.data) {
    const isDuplicate = (rewardProfile.error as { code?: string } | null)?.code === "23505";
    return {
      data: null,
      error: isDuplicate ? "That email is already used by another verified player." : rewardProfile.error?.message ?? "Unable to save verification profile.",
      status: isDuplicate ? 409 : 500
    };
  }

  return { data: mapRewardProfile(rewardProfile.data), error: null, status: 200 };
}

export async function GET(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return NextResponse.json({ error: "Login token is required." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Invalid login session." }, { status: 401 });
  }

  const account = await accountTable(supabase)
    .select("player_id, email")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (account.error) {
    return NextResponse.json({ error: account.error.message }, { status: 500 });
  }

  if (!account.data) {
    return NextResponse.json({ error: "No player account is linked to this login." }, { status: 404 });
  }

  const snapshot = await fetchPlayerSnapshot(account.data.player_id);
  if (!snapshot) {
    return NextResponse.json({ error: "Linked player was not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      email: account.data.email,
      snapshot
    }
  });
}

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid account details." }, { status: 400 });
  }

  const { playerId, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const phone = parsed.data.phone?.trim();
  const telegramUsername = parsed.data.telegramUsername?.trim();
  const shouldSaveVerification = Boolean(phone || telegramUsername);

  if (shouldSaveVerification && (!phone || !telegramUsername)) {
    return NextResponse.json({ error: "Phone number and Telegram username are required for verification." }, { status: 400 });
  }

  const player = await supabase.from("players").select("id, name").eq("id", playerId).maybeSingle();
  if (player.error) {
    return NextResponse.json({ error: player.error.message }, { status: 500 });
  }

  if (!player.data) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const existingForPlayer = await accountTable(supabase)
    .select("player_id, email")
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingForPlayer.error) {
    return NextResponse.json({ error: existingForPlayer.error.message }, { status: 500 });
  }

  const existingForEmail = await accountTable(supabase)
    .select("player_id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingForEmail.error) {
    return NextResponse.json({ error: existingForEmail.error.message }, { status: 500 });
  }

  if (existingForEmail.data && existingForEmail.data.player_id !== playerId) {
    return NextResponse.json({ error: "That email is already linked to another player." }, { status: 409 });
  }

  if (existingForPlayer.data) {
    if (shouldSaveVerification && phone && telegramUsername) {
      if (existingForPlayer.data.email !== normalizedEmail) {
        return NextResponse.json(
          { error: `This player is already linked to ${existingForPlayer.data.email}. Use that email for verification.` },
          { status: 409 }
        );
      }

      const rewardProfile = await saveVerificationProfile({
        supabase,
        playerId,
        fullName: parsed.data.fullName ?? player.data.name ?? "Player",
        email: normalizedEmail,
        phone,
        telegramUsername
      });

      if (rewardProfile.error) {
        return NextResponse.json({ error: rewardProfile.error }, { status: rewardProfile.status });
      }

      invalidateLeaderboardCache();
      return NextResponse.json({
        data: {
          email: existingForPlayer.data.email,
          rewardProfile: rewardProfile.data
        }
      });
    }

    return NextResponse.json({ error: "This player already has a login account." }, { status: 409 });
  }

  const createdUser = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true
  });

  if (createdUser.error || !createdUser.data.user) {
    if (isDuplicateEmailAuthError(createdUser.error?.message)) {
      return NextResponse.json(
        { error: "That email already has a login account. Use I have an account to continue." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: createdUser.error?.message ?? "Unable to create login account." }, { status: 500 });
  }

  const linked = await accountTable(supabase).insert({
    auth_user_id: createdUser.data.user.id,
    player_id: playerId,
    email: normalizedEmail
  });

  if (linked.error) {
    await supabase.auth.admin.deleteUser(createdUser.data.user.id).catch(() => undefined);
    if ((linked.error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "That email is already linked to another player." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: linked.error.message }, { status: 500 });
  }

  let rewardProfile = null;
  if (shouldSaveVerification && phone && telegramUsername) {
    const savedRewardProfile = await saveVerificationProfile({
      supabase,
      playerId,
      fullName: parsed.data.fullName ?? player.data.name ?? "Player",
      email: normalizedEmail,
      phone,
      telegramUsername
    });

    if (savedRewardProfile.error) {
      await accountTable(supabase).delete().eq("player_id", playerId);
      await supabase.auth.admin.deleteUser(createdUser.data.user.id).catch(() => undefined);
      return NextResponse.json({ error: savedRewardProfile.error }, { status: savedRewardProfile.status });
    }

    rewardProfile = savedRewardProfile.data;
  }

  if (rewardProfile) {
    invalidateLeaderboardCache();
  }
  return NextResponse.json({
    data: {
      email: normalizedEmail,
      rewardProfile
    }
  });
}
