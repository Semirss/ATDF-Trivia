import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mapPlayer } from "@/lib/data-mappers";
import { fetchPlayerSnapshot } from "@/lib/supabase/game-data";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const telegramPlayerSchema = z.object({
  initData: z.string().min(10),
  startParam: z.string().optional(),
  mode: z.enum(["lookup", "sync"]).optional().default("sync"),
  currentPlayerId: z.string().uuid().optional()
});

const telegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  photo_url: z.string().url().optional(),
  // Present for Telegram Login/OIDC-style payloads. Mini App requestContact is read from the bot profile table.
  phone_number: z.string().optional()
});

type Supabase = NonNullable<Awaited<ReturnType<typeof createServiceSupabaseClient>>>;
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

interface ExistingPlayerResult {
  data: PlayerRow | null;
  error: string | null;
  status?: number;
}

interface BotProfile {
  phone: string;
  username: string | null;
  age: number | null;
}

function cleanOptionalUrl(value?: string | null) {
  return value?.trim() || null;
}

function legacyTelegramPhotoUrl(player?: PlayerRow | null) {
  const value = (player as { telegram_photo_url?: unknown } | null | undefined)?.telegram_photo_url;
  return typeof value === "string" ? cleanOptionalUrl(value) : null;
}

function safeTimingEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return null;
  }

  params.delete("hash");
  const authDate = Number(params.get("auth_date") ?? 0);
  const maxAgeSeconds = 60 * 60 * 24 * 30;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(authDate) || authDate <= 0 || authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) {
    return null;
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (!safeTimingEqual(calculatedHash, hash)) {
    return null;
  }

  const rawUser = params.get("user");
  if (!rawUser) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawUser);
  } catch {
    return null;
  }
  const parsedUser = telegramUserSchema.safeParse(parsedJson);

  return parsedUser.success ? parsedUser.data : null;
}

function cleanTelegramUsername(value?: string | null) {
  const normalized = value?.trim().replace(/^@/, "");
  return normalized || null;
}

function emptyBotProfile(): BotProfile {
  return { phone: "", username: null, age: null };
}

function firstProfileValue(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function cleanProfileString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function cleanProfileAge(value: unknown) {
  const age = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;

  if (!Number.isInteger(age) || age < 6 || age > 99) {
    return null;
  }

  return age;
}

async function findBotProfile(supabase: Supabase, telegramId: string): Promise<BotProfile> {
  if (!supabase) {
    return emptyBotProfile();
  }

  // Migration 012 gives us one canonical lookup. The previous fallback scanned up
  // to 18 table/column combinations sequentially, which made a cold Telegram
  // launch appear stuck when most of those tables did not exist.
  const tableName = process.env.TELEGRAM_USERS_TABLE?.trim() || "telegram_user_profiles";
  const idColumn = process.env.TELEGRAM_USERS_ID_COLUMN?.trim() || "telegram_id";
  const looseSupabase = supabase as any;
  const { data } = await looseSupabase
    .from(tableName)
    .select("*")
    .eq(idColumn, telegramId)
    .maybeSingle();
  const profile = data as Record<string, unknown> | null;

  if (!profile) {
    return emptyBotProfile();
  }

  const phone = firstProfileValue(profile, ["phone", "phone_number", "phoneNumber", "mobile", "mobile_number"]);
  const username = firstProfileValue(profile, ["username", "telegram_username", "telegramUsername"]);
  const age = firstProfileValue(profile, ["age", "user_age", "telegram_age", "telegramAge"]);

  return {
    phone: cleanProfileString(phone),
    username: cleanTelegramUsername(cleanProfileString(username)),
    age: cleanProfileAge(age)
  };
}

function displayName(user: z.infer<typeof telegramUserSchema>) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || `Telegram ${user.id}`;
}

async function findUniqueRewardPlayerId(
  supabase: Supabase,
  field: "phone" | "telegram_username",
  value: string
) {
  const query = supabase.from("reward_profiles").select("player_id").limit(2);
  const result = field === "telegram_username" ? await query.ilike(field, value) : await query.eq(field, value);

  if (result.error) {
    return { playerId: null, error: result.error.message };
  }

  const matches = result.data ?? [];
  if (matches.length !== 1) {
    return { playerId: null, error: null };
  }

  return { playerId: matches[0].player_id, error: null };
}

async function findPlayerById(supabase: Supabase, playerId: string): Promise<ExistingPlayerResult> {
  const player = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();

  if (player.error) {
    return { data: null, error: player.error.message, status: 500 };
  }

  return { data: player.data ?? null, error: null };
}

async function findExistingPlayerForTelegram({
  supabase,
  telegramId,
  telegramPhone,
  telegramUsername
}: {
  supabase: Supabase;
  telegramId: string;
  telegramPhone: string;
  telegramUsername: string | null;
}): Promise<ExistingPlayerResult> {
  const existingByTelegram = await supabase.from("players").select("*").eq("telegram_id", telegramId).maybeSingle();

  if (existingByTelegram.error) {
    return { data: null, error: existingByTelegram.error.message, status: 500 };
  }

  if (existingByTelegram.data) {
    return { data: existingByTelegram.data, error: null };
  }

  const candidatePlayerIds = new Set<string>();

  if (telegramPhone) {
    const phoneMatch = await findUniqueRewardPlayerId(supabase, "phone", telegramPhone);
    if (phoneMatch.error) {
      return { data: null, error: phoneMatch.error, status: 500 };
    }
    if (phoneMatch.playerId) {
      candidatePlayerIds.add(phoneMatch.playerId);
    }
  }

  if (telegramUsername) {
    const usernameMatch = await findUniqueRewardPlayerId(supabase, "telegram_username", telegramUsername);
    if (usernameMatch.error) {
      return { data: null, error: usernameMatch.error, status: 500 };
    }
    if (usernameMatch.playerId) {
      candidatePlayerIds.add(usernameMatch.playerId);
    }
  }

  if (candidatePlayerIds.size > 1) {
    return {
      data: null,
      error: "Multiple existing game profiles match this Telegram account. Merge them in admin before linking.",
      status: 409
    };
  }

  const [candidatePlayerId] = Array.from(candidatePlayerIds);
  if (!candidatePlayerId) {
    return { data: null, error: null };
  }

  const player = await findPlayerById(supabase, candidatePlayerId);
  if (player.error || !player.data) {
    return player;
  }

  if (player.data.telegram_id && player.data.telegram_id !== telegramId) {
    return {
      data: null,
      error: "That existing game profile is already linked to another Telegram account.",
      status: 409
    };
  }

  return player;
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured." }, { status: 503 });
  }

  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = telegramPlayerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Telegram launch data." }, { status: 400 });
  }

  const telegramUser = verifyTelegramInitData(parsed.data.initData, botToken);
  if (!telegramUser) {
    return NextResponse.json({ error: "Telegram launch data could not be verified." }, { status: 401 });
  }

  const telegramId = String(telegramUser.id);
  const botProfile = await findBotProfile(supabase, telegramId);

  // Phone: prefer explicit login/OIDC phone_number, otherwise use the bot profile table populated after requestContact.
  const profileTelegramPhone = telegramUser.phone_number?.trim() || botProfile.phone;
  // Age: only available from your bot's user table (TELEGRAM_USERS_TABLE env var)
  const telegramAge = botProfile.age;

  if (!profileTelegramPhone && !botProfile.age) {
    // Bot/contact table lookup returned nothing — the Telegram contact webhook or TELEGRAM_USERS_TABLE may not be configured.
    console.warn(
      `[telegram-player] No bot profile found for telegram_id=${telegramId}. ` +
      `Apply migration 012 and set the Telegram contact webhook, or set TELEGRAM_USERS_TABLE/TELEGRAM_USERS_ID_COLUMN.`
    );
  }
  const telegramAvatarUrl = cleanOptionalUrl(telegramUser.photo_url);
  const telegramUsername = cleanTelegramUsername(telegramUser.username) ?? botProfile.username;
  const name = displayName(telegramUser).slice(0, 40);

  let existing = await findExistingPlayerForTelegram({
    supabase,
    telegramId,
    telegramPhone: profileTelegramPhone,
    telegramUsername
  });

  if (existing.error) {
    return NextResponse.json({ error: existing.error }, { status: existing.status ?? 500 });
  }

  const lookupTelegramPhone = profileTelegramPhone || existing.data?.telegram_phone || "";
  const telegramProfile = {
    id: telegramId,
    name,
    username: telegramUsername,
    phone: lookupTelegramPhone,
    age: telegramAge
  };

  if (parsed.data.mode === "lookup") {
    return NextResponse.json({
      data: {
        exists: Boolean(existing.data),
        player: existing.data ? mapPlayer(existing.data) : null,
        telegramProfile
      }
    });
  }

  if (!existing.data && parsed.data.currentPlayerId) {
    const currentPlayer = await findPlayerById(supabase, parsed.data.currentPlayerId);

    if (currentPlayer.error) {
      return NextResponse.json({ error: currentPlayer.error }, { status: currentPlayer.status ?? 500 });
    }

    if (currentPlayer.data?.telegram_id && currentPlayer.data.telegram_id !== telegramId) {
      return NextResponse.json(
        { error: "The current player is already linked to another Telegram account." },
        { status: 409 }
      );
    }

    if (currentPlayer.data) {
      existing = currentPlayer;
    }
  }

  const telegramPhone = profileTelegramPhone || existing.data?.telegram_phone || "";
  const existingAvatarUrl = cleanOptionalUrl(existing.data?.avatar_url) ?? legacyTelegramPhotoUrl(existing.data);
  const avatarUrl = telegramAvatarUrl ?? existingAvatarUrl;

  const playerResponse = existing.data
    ? await supabase
        .from("players")
        .update({
          telegram_id: existing.data.telegram_id ?? telegramId,
          telegram_username: telegramUsername,
          telegram_phone: telegramPhone || existing.data.telegram_phone,
          avatar_url: avatarUrl,
          source: "telegram",
          ...(telegramAge !== null ? { age: telegramAge } : {})
        })
        .eq("id", existing.data.id)
        .select("*")
        .single()
    : await supabase
        .from("players")
        .insert({
          name,
          age: telegramAge ?? 0,
          avatar_url: telegramAvatarUrl,
          telegram_id: telegramId,
          telegram_username: telegramUsername,
          telegram_phone: telegramPhone || null,
          source: "telegram"
        })
        .select("*")
        .single();

  if (playerResponse.error || !playerResponse.data) {
    return NextResponse.json({ error: playerResponse.error?.message ?? "Unable to sync Telegram player." }, { status: 500 });
  }

  const snapshot = await fetchPlayerSnapshot(playerResponse.data.id);

  return NextResponse.json({
    data: {
      player: mapPlayer(playerResponse.data),
      snapshot
    }
  });
}
