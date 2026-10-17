import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const analyticsEventSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventType: z.enum(["button_tap", "game_played", "level_completed"]),
  eventKey: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  path: z.string().trim().min(1).max(160),
  count: z.number().int().min(1).max(10000)
});

const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(50)
});

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, skipped: true, warning: "Supabase is not configured." });
    }

    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = analyticsBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  const { error } = await (supabase as any).rpc("increment_analytics_daily", {
    events: parsed.data.events
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
