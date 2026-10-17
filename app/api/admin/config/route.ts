import { NextResponse } from "next/server";
import { z } from "zod";
import { mapConfig } from "@/lib/data-mappers";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseStorageVideoUrl } from "@/lib/video-ad-url";
import {
  normalizeYouTubeAds,
  normalizeYouTubeAdTargetLevels
} from "@/lib/youtube-ad";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const videoUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => !value || isSupabaseStorageVideoUrl(value), "Enter a public Supabase Storage video URL.");
const youtubeAdItemSchema = z.object({
  url: videoUrlSchema,
  durationSeconds: z.number().int().min(3).max(180),
  targetLevels: z.array(z.number().int().min(1).max(200)).max(50).optional()
});

const configSchema = z.object({
  defaultTimeLimitSeconds: z.number().int().min(5).max(180),
  maxStreakBonus: z.object({
    multiplier: z.number().int().min(1).max(10),
    triggerAt: z.number().int().min(2).max(20)
  }),
  leaderboardDisplayCount: z.number().int().min(10).max(500),
  youtubeAd: z
    .object({
      enabled: z.boolean(),
      url: videoUrlSchema.optional().default(""),
      urls: z.array(videoUrlSchema).optional().default([]),
      ads: z.array(youtubeAdItemSchema).optional().default([]),
      durationSeconds: z.number().int().min(3).max(180),
      aspectRatio: z.enum(["normal", "vertical"]),
      levelInterval: z.number().int().min(1).max(50),
      selectionMode: z.enum(["rotate", "shuffle"]).optional().default("rotate"),
      triggerMode: z.enum(["interval", "levels"]).optional().default("interval"),
      targetLevels: z.array(z.number().int().min(1).max(200)).max(50).optional().default([])
    })
    .transform((value) => {
      const ads = normalizeYouTubeAds(value.ads, value.urls, value.url, value.durationSeconds);
      const urls = ads.map((ad) => ad.url);

      return {
        ...value,
        url: urls[0] ?? "",
        urls,
        ads,
        durationSeconds: ads[0]?.durationSeconds ?? value.durationSeconds,
        targetLevels: normalizeYouTubeAdTargetLevels(value.targetLevels)
      };
    })
    .superRefine((value, context) => {
      if (value.enabled && value.urls.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one Supabase Storage video URL is required when ads are enabled."
        });
      }

      if (value.enabled && value.triggerMode === "levels" && value.targetLevels.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least one target level when level targeting is selected."
        });
      }
    })
});

export async function GET() {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { data, error } = await supabase.from("game_config").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapConfig(data) });
}

export async function PUT(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = configSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid config." }, { status: 400 });
  }

  const rows = [
    {
      key: "max_streak_bonus",
      value: {
        multiplier: parsed.data.maxStreakBonus.multiplier,
        trigger_at: parsed.data.maxStreakBonus.triggerAt
      }
    },
    {
      key: "default_time_limit_seconds",
      value: parsed.data.defaultTimeLimitSeconds
    },
    {
      key: "leaderboard_display_count",
      value: parsed.data.leaderboardDisplayCount
    },
    {
      key: "youtube_ad_config",
      value: {
        enabled: parsed.data.youtubeAd.enabled,
        url: parsed.data.youtubeAd.url,
        urls: parsed.data.youtubeAd.urls,
        ads: parsed.data.youtubeAd.ads.map((ad) => ({
          url: ad.url,
          duration_seconds: ad.durationSeconds,
          target_levels: ad.targetLevels
        })),
        duration_seconds: parsed.data.youtubeAd.durationSeconds,
        aspect_ratio: parsed.data.youtubeAd.aspectRatio,
        level_interval: parsed.data.youtubeAd.levelInterval,
        selection_mode: parsed.data.youtubeAd.selectionMode,
        trigger_mode: parsed.data.youtubeAd.triggerMode,
        target_levels: parsed.data.youtubeAd.targetLevels
      }
    }
  ];

  const { error } = await supabase.from("game_config").upsert(rows, { onConflict: "key" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateGameContentCache();
  return NextResponse.json({ data: parsed.data });
}
