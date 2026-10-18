import { NextResponse } from "next/server";
import { z } from "zod";
import { categoryFormSchema } from "@/lib/validators";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const updateCategorySchema = categoryFormSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional()
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json();
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid category" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("categories")
    .update({
      title: parsed.data.title,
      icon_url: parsed.data.iconUrl,
      difficulty: parsed.data.difficulty,
      is_reward_based: parsed.data.isRewardBased,
      is_active: parsed.data.isActive,
      sort_order: parsed.data.sortOrder,
      color_hex: parsed.data.colorHex,
      description: parsed.data.description,
      card_background_url: parsed.data.cardBackgroundUrl,
      map_background_url: parsed.data.mapBackgroundUrl,
      level_podium_url: parsed.data.levelPodiumUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateGameContentCache();
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { error } = await supabase.from("categories").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateGameContentCache();
  return NextResponse.json({ ok: true });
}
