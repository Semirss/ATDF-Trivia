import { NextResponse } from "next/server";
import { donationInputSchema } from "@/lib/donation-input";
import { initializeChapaDonation, isDonationSetupError, publicOriginFromRequest } from "@/lib/chapa";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorRedirect(request: Request, message: string) {
  const url = new URL("/tip/thank-you", publicOriginFromRequest(request));
  url.searchParams.set("checkout_error", message);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "origin");
  return response;
}

async function openCheckout(request: Request, body: Record<string, FormDataEntryValue | string | null>) {
  const parsed = donationInputSchema.safeParse(body);

  if (!parsed.success) {
    return errorRedirect(request, parsed.error.issues[0]?.message ?? "Invalid tip.");
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
    const checkoutUrl = new URL(data.checkoutUrl);

    if (checkoutUrl.protocol !== "https:") {
      throw new Error("The payment provider returned an insecure checkout URL.");
    }

    const response = NextResponse.redirect(checkoutUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "origin");
    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to initialize tip.";
    const message = isDonationSetupError(detail)
      ? detail
      : "Unable to open the secure checkout. Please try again.";
    return errorRedirect(request, message);
  }
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  return openCheckout(request, {
    amount: searchParams.get("amount"),
    playerId: searchParams.get("playerId"),
    donorName: null,
    donorEmail: null,
    donorPhone: null
  });
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return errorRedirect(request, "Invalid tip request.");
  }

  return openCheckout(request, {
    amount: formData.get("amount"),
    playerId: formData.get("playerId"),
    donorName: formData.get("donorName"),
    donorEmail: formData.get("donorEmail"),
    donorPhone: formData.get("donorPhone")
  });
}
