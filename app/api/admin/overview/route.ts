import { NextResponse } from "next/server";
import { fetchAdminOverview } from "@/lib/supabase/game-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

export async function GET() {
  try {
    const data = await fetchAdminOverview();
    return NextResponse.json({ data }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load overview.";
    const status = message === "Supabase is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders });
  }
}
