import { NextResponse } from "next/server";
import { initializeChapaDonation, isDonationSetupError, publicOriginFromRequest } from "@/lib/chapa";
import { donationInputSchema } from "@/lib/donation-input";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = donationInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid tip." }, { status: 400 });
  }

  try {
    const data = await initializeChapaDonation({
      amount: parsed.data.amount,
      playerId: parsed.data.playerId,
      donorName: parsed.data.donorName,
      donorEmail: parsed.data.donorEmail || null,
      donorPhone: parsed.data.donorPhone || null,
      origin: publicOriginFromRequest(request)
    });

    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize tip.";
    const status = isDonationSetupError(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
