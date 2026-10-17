import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseStorageVideoUrl } from "@/lib/video-ad-url";

export const dynamic = "force-dynamic";

const adViewSchema = z.object({
  viewId: z.string().uuid(),
  playerId: z.string().uuid().nullable().optional(),
  videoId: z.string().trim().min(1).max(80),
  videoUrl: z.string().url().max(2048).refine(isSupabaseStorageVideoUrl),
  event: z.enum(["started", "completed"]),
  watchedSeconds: z.number().int().min(0).max(3600).optional().default(0)
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = adViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ad view payload." }, { status: 400 });
  }

  const payload = {
    id: parsed.data.viewId,
    player_id: parsed.data.playerId ?? null,
    video_id: parsed.data.videoId,
    video_url: parsed.data.videoUrl,
    watched_seconds: parsed.data.event === "completed" ? parsed.data.watchedSeconds : 0,
    ...(parsed.data.event === "completed" ? { completed_at: new Date().toISOString() } : {})
  };
  const { error } = await supabase.from("youtube_ad_views").upsert(payload, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
