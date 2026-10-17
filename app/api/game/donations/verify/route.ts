import { NextResponse } from "next/server";
import { z } from "zod";
import { isDonationSetupError, verifyAndRecordChapaDonation } from "@/lib/chapa";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const txRefSchema = z.string().trim().min(12).max(120);

export async function GET(request: Request) {
  const txRef = new URL(request.url).searchParams.get("tx_ref");
  const parsed = txRefSchema.safeParse(txRef);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tip reference." }, { status: 400 });
  }

  try {
    const data = await verifyAndRecordChapaDonation(parsed.data);
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify tip.";
    const status = isDonationSetupError(message) ? 503 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
