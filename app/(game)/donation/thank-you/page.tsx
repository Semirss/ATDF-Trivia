"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, LoaderCircle, XCircle } from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";
import { syncPlayerSnapshot } from "@/hooks/usePlayerSync";
import { verifyDonation } from "@/lib/game-client";
import { markHomeSplashSeenPermanently } from "@/lib/home-splash";
import { syncTelegramPlayerFromWebApp } from "@/lib/telegram-player";
import { hasTelegramLaunchData, isTelegramMiniApp } from "@/lib/telegram-webapp";
import { isUuid } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

type DonationResult =
  | { state: "loading" }
  | { state: "success"; amount: number; currency: "ETB" }
  | { state: "pending" | "failed" | "cancelled" | "refunded" | "error"; message: string };

async function restorePlayerIdentity(playerId: string | null) {
  const expectedPlayerId = playerId && isUuid(playerId) ? playerId : null;
  const identityRequired = Boolean(expectedPlayerId || hasTelegramLaunchData() || isTelegramMiniApp());

  if (!identityRequired) {
    return true;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (expectedPlayerId) {
      await syncPlayerSnapshot(expectedPlayerId, { force: true }).catch(() => undefined);
    }

    if (hasTelegramLaunchData()) {
      await syncTelegramPlayerFromWebApp({ requestPhone: false }).catch(() => null);
    }

    const activePlayerId = usePlayerStore.getState().playerId;
    if (activePlayerId && isUuid(activePlayerId) && (!expectedPlayerId || activePlayerId === expectedPlayerId)) {
      return true;
    }

    if (attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  }

  return false;
}

function DonationThankYouContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const txRef = searchParams.get("tx_ref");
  const checkoutError = searchParams.get("checkout_error");
  const playerIdParam = searchParams.get("playerId");
  const [result, setResult] = useState<DonationResult>({ state: "loading" });
  const [verifiedPlayerId, setVerifiedPlayerId] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    markHomeSplashSeenPermanently();
  }, []);

  useEffect(() => {
    let active = true;
    let redirectTimer: number | null = null;

    async function verify() {
      if (checkoutError) {
        await restorePlayerIdentity(playerIdParam);
        if (active) {
          setResult({ state: "error", message: checkoutError });
        }
        return;
      }

      if (!txRef) {
        await restorePlayerIdentity(playerIdParam);
        if (active) {
          setResult({ state: "error", message: "Missing tip reference." });
        }
        return;
      }

      try {
        const donation = await verifyDonation(txRef);
        const transactionPlayerId = donation.playerId || playerIdParam;
        setVerifiedPlayerId(transactionPlayerId);
        const restored = await restorePlayerIdentity(transactionPlayerId);

        if (!active) {
          return;
        }

        if (
          donation.status === "success" &&
          donation.amountMatches &&
          donation.currencyMatches &&
          donation.referenceMatches &&
          donation.modeMatches
        ) {
          setResult({ state: "success", amount: donation.amount, currency: donation.currency });

          if (restored) {
            redirectTimer = window.setTimeout(() => router.replace("/"), 1200);
          } else {
            setRecoveryError("Unable to restore your player yet. Check your connection and try again.");
          }
          return;
        }

        if (donation.status === "success") {
          setResult({ state: "error", message: "Payment verification did not match the stored tip." });
          return;
        }

        setResult({
          state: donation.status,
          message: donation.status === "pending" ? "Payment is still pending." : `Payment status: ${donation.status}.`
        });
      } catch (error) {
        if (active) {
          setResult({ state: "error", message: error instanceof Error ? error.message : "Unable to verify the tip." });
        }
      }
    }

    void verify();

    return () => {
      active = false;
      if (redirectTimer !== null) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [checkoutError, playerIdParam, router, txRef]);

  const isSuccess = result.state === "success";
  const isPending = result.state === "pending" || result.state === "loading";
  const Icon = isSuccess ? CheckCircle2 : isPending ? Clock : XCircle;

  async function backToGame() {
    if (isReturning) {
      return;
    }

    setIsReturning(true);
    setRecoveryError(null);

    const restored = await restorePlayerIdentity(verifiedPlayerId || playerIdParam);
    if (!restored) {
      setRecoveryError("Unable to restore your player yet. Check your connection and try again.");
      setIsReturning(false);
      return;
    }

    router.replace("/");
  }

  return (
    <PageTransition>
      <div className="game-safe game-safe-compact grid min-h-full place-items-center px-4">
        <section className="donation-modal w-full max-w-sm rounded-[24px] p-5 text-center shadow-bevel">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/70 text-black shadow-bevel">
            {result.state === "loading" ? <LoaderCircle className="h-7 w-7 animate-spin" /> : <Icon className="h-7 w-7" />}
          </div>
          <h1 className="mt-4 font-display text-2xl font-black">
            {isSuccess ? "Thank you for the tip" : isPending ? "Tip pending" : "Tip not completed"}
          </h1>
          <p className="mt-2 text-sm font-bold opacity-70">
            {isSuccess ? `${result.amount} ${result.currency} received.` : result.state === "loading" ? "Checking payment." : result.message}
          </p>
          {isSuccess && !recoveryError ? <p className="mt-3 text-xs font-bold opacity-60">Returning to the game...</p> : null}
          {recoveryError ? <p className="mt-3 text-xs font-bold text-red-700">{recoveryError}</p> : null}
          {result.state === "loading" ? (
            <span className="donation-submit mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[18px] text-sm font-black uppercase opacity-50">
              Back to game
            </span>
          ) : (
            <button
              type="button"
              onClick={backToGame}
              disabled={isReturning}
              className="donation-submit mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] text-sm font-black uppercase disabled:opacity-60"
            >
              {isReturning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isReturning ? "Restoring player..." : "Back to game"}
            </button>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

export default function DonationThankYouPage() {
  return (
    <Suspense fallback={<div className="game-safe game-safe-compact grid min-h-full place-items-center font-black">Checking payment.</div>}>
      <DonationThankYouContent />
    </Suspense>
  );
}
