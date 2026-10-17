"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, ShieldCheck, UserRound, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { lookupTelegramPlayerFromWebApp, syncTelegramPlayerFromWebApp } from "@/lib/telegram-player";
import { hasTelegramLaunchData, isTelegramMiniApp } from "@/lib/telegram-webapp";
import { usePlayerStore } from "@/store/playerStore";
import type { TelegramPlayerLookup } from "@/lib/telegram-player";

function skipKey(telegramId: string) {
  return `trivia-telegram-skip-${telegramId}`;
}

export function TelegramAccountGate() {
  const router = useRouter();
  const pathname = usePathname();
  const playerId = usePlayerStore((state) => state.playerId);
  const language = usePlayerStore((state) => state.language);
  const [lookup, setLookup] = useState<TelegramPlayerLookup | null>(null);
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function checkTelegramAccount() {
      const hasLaunchData = hasTelegramLaunchData();
      const isTelegram = isTelegramMiniApp();
      const initialState = usePlayerStore.getState();
      const initialPlayerId = initialState.playerId;

      if (active && isTelegram && hasLaunchData && !initialPlayerId) {
        setIsCheckingTelegram(true);
        const snapshot = await syncTelegramPlayerFromWebApp({ requestPhone: false });
        if (active && (snapshot || usePlayerStore.getState().playerId) && pathname === "/onboarding") {
          router.replace("/");
        }
        if (active) setIsCheckingTelegram(false);
        return;
      }

      const result = await lookupTelegramPlayerFromWebApp();
      if (!active || !result) {
        if (active && isTelegram && !hasTelegramLaunchData() && attempts < 20) {
          attempts += 1;
          retryTimer = setTimeout(checkTelegramAccount, 250);
        } else if (active) {
          setIsCheckingTelegram(false);
        }
        return;
      }

      const currentState = usePlayerStore.getState();
      const currentPlayerId = currentState.playerId;
      const skipped = sessionStorage.getItem(skipKey(result.telegramProfile.id)) === "true";
      const isCurrentTelegramPlayer = Boolean(result.player?.id && result.player.id === currentPlayerId);

      if (isCurrentTelegramPlayer) {
        setLookup(null);
        if (!currentState.avatarUrl) {
          if (result.player?.avatarUrl) {
            usePlayerStore.getState().setProfile(result.player);
          } else {
            await syncTelegramPlayerFromWebApp({ requestPhone: false });
          }
        } else if (result.player?.avatarUrl && result.player.avatarUrl !== currentState.avatarUrl) {
          usePlayerStore.getState().setProfile(result.player);
        }
        setIsCheckingTelegram(false);
        return;
      }

      if (skipped) {
        setLookup(null);
        setIsCheckingTelegram(false);
        return;
      }

      const shouldLoadAutomatically =
        !currentPlayerId ||
        !result.exists ||
        result.player?.id === currentPlayerId ||
        pathname === "/onboarding";

      if (shouldLoadAutomatically) {
        setLookup(null);
        const snapshot = await syncTelegramPlayerFromWebApp({ requestPhone: false });
        if (active && (snapshot || usePlayerStore.getState().playerId) && pathname === "/onboarding") {
          router.replace("/");
        }
        if (active) {
          setIsCheckingTelegram(false);
        }
        return;
      }

      setIsCheckingTelegram(false);
      setLookup(result);
    }

    void checkTelegramAccount();

    return () => {
      active = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [pathname, playerId, router]);

  if (isCheckingTelegram && !lookup?.player) {
    return (
      <div className="absolute inset-0 z-[70] grid place-items-center bg-black/42 p-5 backdrop-blur-md">
        <div className="w-full max-w-xs rounded-[26px] border border-white/70 bg-[#eef0eb]/95 p-5 text-center text-black shadow-engine">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-black/58" />
          <h2 className="mt-3 font-display text-2xl font-black leading-none">{t(language, "loadingTelegram")}</h2>
          <p className="mt-2 text-sm font-bold leading-snug text-black/58">
            {t(language, "checkingTelegramProfile")}
          </p>
        </div>
      </div>
    );
  }

  if (!lookup?.player) {
    return null;
  }

  const activeLookup = lookup as TelegramPlayerLookup & { player: NonNullable<TelegramPlayerLookup["player"]> };
  const activePlayer = activeLookup.player;

  async function loadTelegramAccount() {
    setIsLoadingAccount(true);
    try {
      const snapshot = await syncTelegramPlayerFromWebApp({ requestPhone: false });
      if (snapshot || usePlayerStore.getState().playerId) {
        setLookup(null);
        router.replace("/");
        toast.success(t(language, "telegramAccountLoaded"));
      }
    } catch {
      toast.error(t(language, "unableLoadTelegramAccount"));
    } finally {
      setIsLoadingAccount(false);
    }
  }

  function keepCurrentAccount() {
    sessionStorage.setItem(skipKey(activeLookup.telegramProfile.id), "true");
    setLookup(null);
  }

  return (
    <div className="absolute inset-0 z-[70] grid place-items-center bg-black/42 p-5 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-[30px] border border-white/70 bg-[#eef0eb]/95 p-5 text-black shadow-engine">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-bevel">
              {activePlayer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activePlayer.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-7 w-7 text-black/50" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">{t(language, "telegramAccountFound")}</div>
              <div className="truncate font-display text-2xl font-black">{activePlayer.name}</div>
              <div className="truncate text-xs font-bold text-black/45">
                {activeLookup.telegramProfile.username ? `@${activeLookup.telegramProfile.username}` : activeLookup.telegramProfile.phone || t(language, "telegramPlayer")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={keepCurrentAccount}
            aria-label={t(language, "keepCurrentPlayer")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 shadow-bevel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm font-bold leading-snug text-black/58">
          {t(language, "telegramSavedDataPrompt")}
        </p>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={isLoadingAccount}
            onClick={loadTelegramAccount}
            className="shine-sweep dark-pill flex min-h-12 items-center justify-center gap-2 rounded-[18px] text-sm font-black uppercase disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {isLoadingAccount ? `${t(language, "loading")}...` : t(language, "loadTelegramAccount")}
          </button>
          <button
            type="button"
            onClick={keepCurrentAccount}
            className="min-h-11 rounded-[18px] bg-white/72 text-xs font-black uppercase text-black/58 shadow-bevel"
          >
            {t(language, "keepCurrentNewPlayer")}
          </button>
        </div>
      </div>
    </div>
  );
}
