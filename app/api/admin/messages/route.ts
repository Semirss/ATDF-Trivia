import { NextResponse } from "next/server";
import { z } from "zod";
import { mapMessage } from "@/lib/data-mappers";
import { mentionTokenForName } from "@/lib/chat-state";
import { fetchAdminMessages } from "@/lib/supabase/game-data";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const adminMessageSchema = z.object({
  playerId: z.string().uuid(),
  text: z.string().trim().min(1).max(240)
});

const deleteSchema = z
  .object({
    messageId: z.string().uuid().optional(),
    playerId: z.string().uuid().optional()
  })
  .refine((value) => value.messageId || value.playerId, "messageId or playerId is required");

export async function GET() {
  try {
    const data = await fetchAdminMessages();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load messages.";
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
  const parsed = adminMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message." }, { status: 400 });
  }

  const playerResult = await supabase
    .from("players")
    .select("id, name")
    .eq("id", parsed.data.playerId)
    .maybeSingle();

  if (playerResult.error) {
    return NextResponse.json({ error: playerResult.error.message }, { status: 500 });
  }

  if (!playerResult.data) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const mention = mentionTokenForName(playerResult.data.name);
  const text = mention ? `Admin: @${mention} ${parsed.data.text}` : `Admin: ${parsed.data.text}`;
  const { data, error } = await supabase
    .from("messages")
    .insert({
      player_id: parsed.data.playerId,
      text,
      reply_to_message_id: null
    })
    .select("id, player_id, text, reply_to_message_id, posted_at, players(name, avatar_url)")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to send message." }, { status: 500 });
  }

  return NextResponse.json({ data: mapMessage(data) });
}

export async function DELETE(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid delete request." }, { status: 400 });
  }

  const query = supabase.from("messages").delete();
  const response = parsed.data.messageId
    ? await query.eq("id", parsed.data.messageId)
    : await query.eq("player_id", parsed.data.playerId as string);

  if (response.error) {
    return NextResponse.json({ error: response.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
