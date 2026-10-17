import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { fetchAdminPlayerDetail } from "@/lib/supabase/game-data";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const updateAdminPlayerSchema = z.object({
  name: z.string().trim().min(2).max(40),
  age: z.number().int().min(6).max(99),
  avatarUrl: z.string().url().optional().or(z.literal("")).optional()
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await fetchAdminPlayerDetail(params.id);

    if (!data) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load player.";
    const status = message === "Supabase is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateAdminPlayerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid player." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("players")
    .update({
      name: parsed.data.name,
      age: parsed.data.age,
      avatar_url: parsed.data.avatarUrl || null
    })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to update player." }, { status: 500 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { error } = await supabase.from("players").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({ ok: true });
}
