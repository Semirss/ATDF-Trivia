"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, HeartHandshake, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { initializeDonation } from "@/lib/game-client";
import { t } from "@/lib/i18n";
import { syncTelegramPlayerFromWebApp } from "@/lib/telegram-player";
import {
  getTelegramWebApp,
  hasTelegramLaunchData,
  isTelegramMiniApp,
  rememberTelegramLaunchDataForCheckout
} from "@/lib/telegram-webapp";
import { isUuid } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

const presetAmounts = [10, 50, 100] as const;
const maxDonationAmount = 100000;

export function DonationModal({
  playerId,
  donorName,
  donorEmail,
  donorPhone,
  onClose
}: {
  playerId?: string | null;
  donorName?: string | null;
  donorEmail?: string | null;
  donorPhone?: string | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const language = usePlayerStore((state) => state.language);
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amount = useMemo(() => {
    const parsedCustom = Number(customAmount);
    return customAmount.trim() ? parsedCustom : selectedAmount;
  }, [customAmount, selectedAmount]);
  const canDonate = Number.isFinite(amount) && amount >= 10 && amount <= maxDonationAmount;
  const tipButtonText = canDonate
    ? language === "am"
      ? `${amount} ${t(language, "currencyEtb")} ${t(language, "tipAction")}`
      : `${t(language, "tipAction")} ${amount} ${t(language, "currencyEtb")}`
    : t(language, "tipAction");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  async function donate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canDonate) {
      toast.error(t(language, "invalidTipAmount"));
      return;
    }

    setIsSubmitting(true);
    rememberTelegramLaunchDataForCheckout();

    try {
      const isTelegramCheckout = isTelegramMiniApp();

      if (hasTelegramLaunchData()) {
        await syncTelegramPlayerFromWebApp({ requestPhone: false });
      }

      const playerState = usePlayerStore.getState();
      const storePlayerId = playerState.playerId;
      const resolvedPlayerId = isUuid(storePlayerId)
        ? storePlayerId
        : isUuid(playerId)
          ? playerId
          : null;
      const telegramUserId = getTelegramWebApp()?.initDataUnsafe?.user?.id;
      const hasCurrentTelegramIdentity =
        Boolean(playerState.telegramId) &&
        playerState.source === "telegram" &&
        (telegramUserId === undefined || playerState.telegramId === String(telegramUserId));

      // Never create an anonymous Chapa transaction from Telegram. The
      // transaction and return URL must carry this exact player UUID so the
      // thank-you page can restore the player without relying on WebView state.
      if (isTelegramCheckout && (!resolvedPlayerId || !hasCurrentTelegramIdentity)) {
        throw new Error("Unable to restore your Telegram player. Please try again.");
      }

      const { checkoutUrl } = await initializeDonation({
        amount,
        playerId: resolvedPlayerId,
        donorName,
        donorEmail,
        donorPhone
      });

      // Keep checkout and its correctly configured return URL in the same
      // Telegram WebView so this origin's authenticated player is preserved.
      window.location.assign(checkoutUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open the secure checkout.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="donation-backdrop fixed inset-0 z-50 grid place-items-center px-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={donate}
        className="donation-modal w-full max-w-sm rounded-[28px] p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isSubmitting}
        lang={language}
      >
        <span className="donation-botanical" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="donation-icon grid h-11 w-11 shrink-0 place-items-center rounded-[16px]">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="donation-kicker text-[10px] font-black uppercase tracking-[0.16em]">{t(language, "supportGame")}</div>
              <h2 id={titleId} className="donation-title font-display text-xl font-black">{t(language, "leaveTip")}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t(language, "closeTip")}
            className="donation-close grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {presetAmounts.map((preset) => {
            const isSelected = selectedAmount === preset && (!customAmount || Number(customAmount) === preset);

            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setSelectedAmount(preset);
                  setCustomAmount(String(preset));
                }}
                aria-pressed={isSelected}
                className={`donation-preset relative min-h-14 rounded-[18px] font-black ${isSelected ? "donation-preset-active" : ""}`}
              >
                {isSelected ? (
                  <span className="donation-preset-check" aria-hidden="true">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
                <span className="donation-preset-amount">{preset}</span>
                <span className="donation-preset-currency">{t(language, "currencyEtb")}</span>
              </button>
            );
          })}
        </div>

        <label className="mt-3 grid gap-1 text-xs font-black uppercase">
          {t(language, "customAmount")}
          <div className="donation-custom-field flex items-center rounded-[18px] px-3">
            <input
              inputMode="numeric"
              min={10}
              max={maxDonationAmount}
              value={customAmount}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^\d]/g, "").slice(0, 6);
                setCustomAmount(nextValue);
                if (Number(nextValue) !== selectedAmount) {
                  setSelectedAmount(0);
                }
              }}
              placeholder={t(language, "writeAmount")}
              aria-label={t(language, "customTipAmount")}
              className="h-12 min-w-0 flex-1 bg-transparent text-base font-black outline-none"
            />
            <span className="text-xs font-black">{t(language, "currencyEtb")}</span>
          </div>
        </label>

        <button
          type="submit"
          disabled={!canDonate || isSubmitting}
          className="donation-submit mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] px-4 text-sm font-black uppercase disabled:opacity-65"
        >
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <HeartHandshake className="h-5 w-5" aria-hidden="true" />}
          <span aria-live="polite">{isSubmitting ? t(language, "openingSecureCheckout") : tipButtonText}</span>
        </button>

        <p className="donation-security mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] font-bold">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t(language, "securePaymentChapa")}
        </p>
      </form>
    </div>
  );
}
