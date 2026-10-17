import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { fetchAdminPlayers } from "@/lib/supabase/game-data";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const adminPlayerSchema = z.object({
  name: z.string().trim().min(2).max(40),
  age: z.number().int().min(6).max(99),
  avatarUrl: z.string().url().optional().or(z.literal("")).optional()
});

export async function GET() {
  try {
    const data = await fetchAdminPlayers();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load players.";
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
  const parsed = adminPlayerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid player." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("players")
    .insert({
      name: parsed.data.name,
      age: parsed.data.age,
      avatar_url: parsed.data.avatarUrl || null
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to create player." }, { status: 500 });
  }

  invalidateLeaderboardCache();
  return NextResponse.json({ data });
}
