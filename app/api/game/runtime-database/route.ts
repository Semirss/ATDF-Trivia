import { NextResponse } from "next/server";
import { getRuntimePublicConfig } from "@/lib/supabase/runtime-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const config = await getRuntimePublicConfig();
    return NextResponse.json(config, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
