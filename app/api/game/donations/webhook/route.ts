import { NextResponse } from "next/server";
import { z } from "zod";
import { isDonationSetupError, verifyAndRecordChapaDonation, verifyChapaWebhookSignature } from "@/lib/chapa";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const webhookSchema = z.object({
  tx_ref: z.string().trim().min(12).max(120).optional(),
  trx_ref: z.string().trim().min(12).max(120).optional(),
  event: z.string().optional(),
  status: z.string().optional()
});

export async function POST(request: Request) {
  const body = await request.text();

  try {
    if (!verifyChapaWebhookSignature(body, request)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const parsedJson = webhookSchema.safeParse(JSON.parse(body));
    if (!parsedJson.success) {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }

    const txRef = parsedJson.data.tx_ref ?? parsedJson.data.trx_ref;
    if (!txRef) {
      return NextResponse.json({ ok: true });
    }

    const data = await verifyAndRecordChapaDonation(txRef);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process tip webhook.";
    const status = isDonationSetupError(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
