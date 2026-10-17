import { NextResponse } from "next/server";
import { categoryFormSchema } from "@/lib/validators";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json();
  const parsed = categoryFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid category" }, { status: 400 });
  }

  const lastCategory = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastCategory.error) {
    return NextResponse.json({ error: lastCategory.error.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      title: parsed.data.title,
      icon_url: parsed.data.iconUrl,
      difficulty: parsed.data.difficulty,
      is_reward_based: parsed.data.isRewardBased,
      is_active: parsed.data.isActive,
      sort_order: (lastCategory.data?.sort_order ?? -1) + 1,
      color_hex: parsed.data.colorHex,
      description: parsed.data.description,
      map_background_url: parsed.data.mapBackgroundUrl,
      level_podium_url: parsed.data.levelPodiumUrl
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateGameContentCache();
  return NextResponse.json({ data });
}
