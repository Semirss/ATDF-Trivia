import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface TelegramContactUpdate {
  message?: {
    from?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    contact?: {
      phone_number?: string;
      user_id?: number;
      first_name?: string;
      last_name?: string;
    };
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const actualSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (expectedSecret && actualSecret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid Telegram webhook secret." }, { status: 401 });
  }

  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const update = (await request.json().catch(() => null)) as TelegramContactUpdate | null;
  const from = update?.message?.from;
  const contact = update?.message?.contact;
  const telegramUserId = contact?.user_id ?? from?.id;
  const fromUserId = from?.id;
  const phone = cleanString(contact?.phone_number);

  if (!telegramUserId || !fromUserId || !phone || telegramUserId !== fromUserId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const telegramId = String(telegramUserId);
  const now = new Date().toISOString();
  const looseSupabase = supabase as any;
  const upsertProfile = await looseSupabase
    .from("telegram_user_profiles")
    .upsert(
      {
        telegram_id: telegramId,
        phone,
        username: cleanString(from?.username) || null,
        first_name: cleanString(contact?.first_name) || cleanString(from?.first_name) || null,
        last_name: cleanString(contact?.last_name) || cleanString(from?.last_name) || null,
        updated_at: now
      },
      { onConflict: "telegram_id" }
    );

  if (upsertProfile.error) {
    return NextResponse.json({ error: upsertProfile.error.message }, { status: 500 });
  }

  const playerUpdate: { telegram_phone: string; telegram_username?: string } = {
    telegram_phone: phone
  };
  const username = cleanString(from?.username);
  if (username) {
    playerUpdate.telegram_username = username;
  }

  const updatePlayer = await supabase
    .from("players")
    .update(playerUpdate)
    .eq("telegram_id", telegramId);

  if (updatePlayer.error) {
    return NextResponse.json({ error: updatePlayer.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
