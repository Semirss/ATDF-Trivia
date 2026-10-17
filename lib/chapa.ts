import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const chapaBaseUrl = "https://api.chapa.co/v1";
const defaultCurrency = "ETB";
const donationMigrationMessage =
  "Tip payments are not configured yet. Apply the Chapa payments migration in Supabase, then retry.";

type DonationStatus = "pending" | "success" | "failed" | "cancelled" | "refunded";

type ChapaInitializeResponse = {
  status?: string;
  message?: unknown;
  data?: {
    checkout_url?: string;
  };
};

type ChapaVerifyResponse = {
  status?: string;
  message?: unknown;
  data?: {
    amount?: number | string;
    currency?: string;
    status?: string;
    reference?: string;
    tx_ref?: string;
    mode?: string;
    [key: string]: unknown;
  };
};

export type DonationInitInput = {
  amount: number;
  playerId?: string | null;
  donorName?: string | null;
  donorEmail?: string | null;
  donorPhone?: string | null;
  origin: string;
};

function chapaSecretKey() {
  const key = process.env.CHAPA_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("CHAPA_SECRET_KEY is not configured.");
  }

  if (key.toUpperCase().includes("PUBK")) {
    throw new Error("CHAPA_SECRET_KEY must use your Chapa secret key, not the public key. Test secret keys contain CHASECK_TEST; production must use the live secret key.");
  }

  return key;
}

function chapaKeyMode(key: string) {
  return key.toUpperCase().startsWith("CHASECK_TEST") ? "test" : "live";
}

function normalizeAmount(value: number | string | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

function normalizeEthiopianPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (/^251[79]\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  if (/^[79]\d{8}$/.test(digits)) {
    return `0${digits}`;
  }

  return /^0[79]\d{8}$/.test(digits) ? digits : null;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

function readableErrorMessage(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => readableErrorMessage(item)).filter(Boolean).join("; ") || null;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const formatted = entries
      .map(([key, item]) => {
        const message = readableErrorMessage(item);
        return message ? `${key}: ${message}` : null;
      })
      .filter(Boolean)
      .join("; ");

    return formatted || JSON.stringify(value);
  }

  return String(value);
}

function donationStatusFromChapa(status: string | undefined): DonationStatus {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "success") {
    return "success";
  }

  if (normalized === "failed") {
    return "failed";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }

  if (normalized === "refunded") {
    return "refunded";
  }

  return "pending";
}

function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value ?? "");
}

function isMissingDonationTable(message: string | undefined) {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("donation_transactions") &&
    (normalized.includes("schema cache") || normalized.includes("does not exist") || normalized.includes("not found"))
  );
}

export function isDonationSetupError(message: string) {
  return (
    message.includes("not configured") ||
    message.includes("Tip payments are not configured") ||
    message.includes("CHAPA_SECRET_KEY must use your Chapa secret key")
  );
}

export function donationTxRef() {
  return `trivia-tip-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function publicOriginFromRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "");

  if (host) {
    return `${forwardedProto}://${host}`.replace(/\/+$/, "");
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/+$/, "")}`;
  }

  return requestUrl.origin;
}

export async function initializeChapaDonation(input: DonationInitInput) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const txRef = donationTxRef();
  const safePlayerId = isUuid(input.playerId) ? input.playerId : null;
  const safeDonorPhone = normalizeEthiopianPhone(input.donorPhone);
  const amount = normalizeAmount(input.amount);

  if (!amount || amount < 10 || amount > 100000) {
    throw new Error("Tip amount must be between 10 and 100,000 ETB.");
  }

  const { data: donation, error: insertError } = await supabase
    .from("donation_transactions")
    .insert({
      tx_ref: txRef,
      player_id: safePlayerId,
      donor_name: input.donorName?.trim() || null,
      donor_email: input.donorEmail?.trim() || null,
      donor_phone: safeDonorPhone,
      amount,
      currency: defaultCurrency,
      status: "pending",
      metadata: {
        source: "trivia-game"
      }
    })
    .select("id, tx_ref")
    .single();

  if (insertError || !donation) {
    if (isMissingDonationTable(insertError?.message)) {
      throw new Error(donationMigrationMessage);
    }

    throw new Error(insertError?.message ?? "Unable to create tip transaction.");
  }

  const payload: Record<string, unknown> = {
    amount: String(amount),
    currency: defaultCurrency,
    tx_ref: txRef,
    callback_url: `${input.origin}/api/game/donations/callback`,
    return_url: `${input.origin}/tip/thank-you?tx_ref=${encodeURIComponent(txRef)}${safePlayerId ? `&playerId=${encodeURIComponent(safePlayerId)}` : ""}`,
    customization: {
      title: "Trivia Tip",
      description: `Tip Trivia Games ${amount} ETB`
    },
    meta: {
      donation_id: donation.id,
      player_id: safePlayerId,
      source: "trivia-game",
      hide_receipt: false
    }
  };

  const donorName = input.donorName?.trim();
  if (donorName) {
    const [firstName, ...rest] = donorName.split(/\s+/);
    payload.first_name = firstName;
    payload.last_name = rest.join(" ") || "Donor";
  }

  if (input.donorEmail?.trim()) {
    payload.email = input.donorEmail.trim();
  }

  if (safeDonorPhone) {
    payload.phone_number = safeDonorPhone;
  }

  const response = await fetch(`${chapaBaseUrl}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chapaSecretKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const chapa = (await response.json().catch(() => null)) as ChapaInitializeResponse | null;
  const checkoutUrl = chapa?.data?.checkout_url;

  if (!response.ok || chapa?.status !== "success" || !checkoutUrl) {
    await supabase
      .from("donation_transactions")
      .update({
        status: "failed",
        metadata: {
          source: "trivia-game",
          chapa_initialize_error: toJson(chapa ?? { status: response.status })
        } satisfies Json,
        updated_at: new Date().toISOString()
      })
      .eq("tx_ref", txRef);

    throw new Error(readableErrorMessage(chapa?.message) ?? "Unable to initialize Chapa checkout.");
  }

  await supabase
    .from("donation_transactions")
    .update({
      checkout_url: checkoutUrl,
      updated_at: new Date().toISOString()
    })
    .eq("tx_ref", txRef);

  return {
    txRef,
    checkoutUrl
  };
}

export async function verifyAndRecordChapaDonation(txRef: string) {
  const supabase = await createServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: donation, error: donationError } = await supabase
    .from("donation_transactions")
    .select("*")
    .eq("tx_ref", txRef)
    .maybeSingle();

  if (donationError) {
    if (isMissingDonationTable(donationError.message)) {
      throw new Error(donationMigrationMessage);
    }

    throw new Error(donationError.message);
  }

  if (!donation) {
    throw new Error("Tip transaction not found.");
  }

  const secretKey = chapaSecretKey();
  const response = await fetch(`${chapaBaseUrl}/transaction/verify/${encodeURIComponent(txRef)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  const chapa = (await response.json().catch(() => null)) as ChapaVerifyResponse | null;
  const existingMetadata =
    typeof donation.metadata === "object" && donation.metadata !== null && !Array.isArray(donation.metadata)
      ? (donation.metadata as Record<string, Json | undefined>)
      : {};

  if (!response.ok || !chapa?.data) {
    await supabase
      .from("donation_transactions")
      .update({
        metadata: {
          ...existingMetadata,
          chapa_verify_error: toJson(chapa ?? { status: response.status })
        } satisfies Json,
        updated_at: new Date().toISOString()
      })
      .eq("tx_ref", txRef);

    throw new Error(readableErrorMessage(chapa?.message) ?? `Unable to verify Chapa payment (HTTP ${response.status}).`);
  }

  const verifiedAmount = normalizeAmount(chapa?.data?.amount);
  const verifiedCurrency = chapa?.data?.currency;
  const nextStatus = donationStatusFromChapa(chapa?.data?.status ?? chapa?.status);
  const amountMatches = verifiedAmount !== null && Math.abs(verifiedAmount - Number(donation.amount)) < 0.01;
  const currencyMatches = verifiedCurrency === donation.currency;
  const referenceMatches = chapa.data.tx_ref === donation.tx_ref;
  const modeMatches = chapa.data.mode?.trim().toLowerCase() === chapaKeyMode(secretKey);
  const trustedStatus =
    nextStatus === "success" && (!amountMatches || !currencyMatches || !referenceMatches || !modeMatches)
      ? "failed"
      : nextStatus;

  await supabase
    .from("donation_transactions")
    .update({
      status: trustedStatus,
      chapa_reference: chapa?.data?.reference ?? donation.chapa_reference,
      mode: chapa?.data?.mode ?? donation.mode,
      verified_at: trustedStatus === "success" ? new Date().toISOString() : donation.verified_at,
      metadata: {
        ...existingMetadata,
        chapa_verify_response: toJson(chapa),
        amount_matches: amountMatches,
        currency_matches: currencyMatches,
        reference_matches: referenceMatches,
        mode_matches: modeMatches
      } satisfies Json,
      updated_at: new Date().toISOString()
    })
    .eq("tx_ref", txRef);

  return {
    txRef,
    playerId: donation.player_id,
    amount: Number(donation.amount),
    currency: donation.currency,
    status: trustedStatus,
    amountMatches,
    currencyMatches,
    referenceMatches,
    modeMatches
  };
}

function safeEqual(left: string, right: string) {
  if (!/^[a-f\d]{64}$/i.test(left) || !/^[a-f\d]{64}$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyChapaWebhookSignature(body: string, request: Request) {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("CHAPA_WEBHOOK_SECRET is not configured.");
  }

  const xSignature = request.headers.get("x-chapa-signature")?.trim();
  const chapaSignature = request.headers.get("chapa-signature")?.trim();
  const payloadHash = createHmac("sha256", secret).update(body).digest("hex");
  const secretHash = createHmac("sha256", secret).update(secret).digest("hex");

  return Boolean(
    (xSignature && safeEqual(payloadHash, xSignature)) ||
    (chapaSignature && safeEqual(secretHash, chapaSignature))
  );
}
