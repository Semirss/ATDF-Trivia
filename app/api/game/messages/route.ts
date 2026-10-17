import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchAdminMessages } from "@/lib/supabase/game-data";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const messageSchema = z.object({
  playerId: z.string().uuid(),
  text: z.string().trim().min(1).max(140),
  replyToMessageId: z.string().uuid().optional()
});

const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(80).optional(),
  before: z.string().min(1).optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = messagesQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    before: searchParams.get("before") ?? undefined
  });

  try {
    const data = await fetchAdminMessages(
      parsedQuery.success ? parsedQuery.data.limit ?? 80 : 80,
      parsedQuery.success ? parsedQuery.data.before : undefined
    );
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
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
  const parsed = messageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      player_id: parsed.data.playerId,
      text: parsed.data.text,
      reply_to_message_id: parsed.data.replyToMessageId ?? null
    })
    .select("id, player_id, text, reply_to_message_id, posted_at, players(name, avatar_url)")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to save message." }, { status: 500 });
  }

  const row = data as {
    id: string;
    player_id: string;
    text: string;
    reply_to_message_id?: string | null;
    posted_at: string | null;
    players?: { name?: string | null; avatar_url?: string | null } | Array<{ name?: string | null; avatar_url?: string | null }> | null;
  };
  const player = Array.isArray(row.players) ? row.players[0] : row.players;

  return NextResponse.json({
    data: {
      id: row.id,
      playerId: row.player_id,
      playerName: player?.name ?? "Player",
      avatarUrl: player?.avatar_url ?? undefined,
      text: row.text,
      postedAt: row.posted_at ?? "",
      replyToMessageId: row.reply_to_message_id ?? undefined
    }
  });
}
