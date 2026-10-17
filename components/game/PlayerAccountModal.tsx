"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LockKeyhole, Mail, Send, ShieldCheck, X } from "lucide-react";
import { createRemotePlayerAccount, loginRemotePlayerAccount } from "@/lib/game-client";
import { t } from "@/lib/i18n";
import { syncTelegramPlayerFromWebApp } from "@/lib/telegram-player";
import { hasTelegramLaunchData, isTelegramMiniApp, openTelegramMiniApp } from "@/lib/telegram-webapp";
import { usePlayerStore } from "@/store/playerStore";

type AccountMode = "create" | "login";

export function PlayerAccountModal({
  initialMode,
  onClose,
  onComplete
}: {
  initialMode: AccountMode;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const playerId = usePlayerStore((state) => state.playerId);
  const name = usePlayerStore((state) => state.name);
  const accountEmail = usePlayerStore((state) => state.accountEmail);
  const hydrateSnapshot = usePlayerStore((state) => state.hydrateSnapshot);
  const linkAccount = usePlayerStore((state) => state.linkAccount);
  const saveRewardProfile = usePlayerStore((state) => state.saveRewardProfile);
  const language = usePlayerStore((state) => state.language);
  const [mode, setMode] = useState<AccountMode>(initialMode);
  const [email, setEmail] = useState(accountEmail ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTelegramSubmitting, setIsTelegramSubmitting] = useState(false);
  const [telegramContext, setTelegramContext] = useState(false);
  const isCreateMode = mode === "create";

  useEffect(() => {
    setTelegramContext(isTelegramMiniApp());
  }, []);

  async function continueWithTelegram() {
    setIsTelegramSubmitting(true);

    try {
      if (!hasTelegramLaunchData()) {
        openTelegramMiniApp("login");
        return;
      }

      const snapshot = await syncTelegramPlayerFromWebApp();

      if (snapshot || usePlayerStore.getState().playerId) {
        toast.success(t(language, "telegramAccountLoaded"));
        onComplete?.();
        onClose();
        return;
      }

      toast.error(t(language, "openBotForTelegram"));
    } finally {
      setIsTelegramSubmitting(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreateMode && !playerId) {
      toast.error(t(language, "createPlayerThenSave"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isCreateMode) {
        const account = await createRemotePlayerAccount({
          playerId: playerId!,
          fullName: name ?? t(language, "newPlayer"),
          email,
          password
        });
        linkAccount(account.email);
        if (account.rewardProfile) {
          saveRewardProfile(account.rewardProfile);
        }
        toast.success(t(language, "progressLoginSaved"));
      } else {
        const account = await loginRemotePlayerAccount({ email, password });
        hydrateSnapshot(account.snapshot);
        linkAccount(account.email);
        toast.success(t(language, "progressRestored"));
      }

      onComplete?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, "unableAccessAccount");
      if (isCreateMode && /already|linked|verified|login/i.test(message)) {
        setMode("login");
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/45 p-5 backdrop-blur-md">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border border-white/55 bg-[#eef0eb] p-5 shadow-engine">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/42">
              {isCreateMode ? t(language, "saveProgress") : t(language, "progressLogin")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-black leading-none">
              {isCreateMode ? t(language, "saveThisPlayer") : t(language, "haveAccount")}
            </h2>
            <p className="mt-2 max-w-[240px] text-xs font-semibold leading-snug text-black/45">
              {isCreateMode
                ? t(language, "emailLoginKeepsProgress")
                : t(language, "loginWithSavedEmail")}
            </p>
          </div>
          <button type="button" aria-label={t(language, "close")} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-black shadow-bevel">
            <X className="h-5 w-5" />
          </button>
        </div>

        {telegramContext ? (
          <button
            type="button"
            onClick={continueWithTelegram}
            disabled={isTelegramSubmitting}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#2AABEE] text-sm font-black uppercase text-white shadow-engine disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {isTelegramSubmitting ? t(language, "loadingTelegram") : hasTelegramLaunchData() ? t(language, "useTelegramAccount") : t(language, "openTelegramBot")}
          </button>
        ) : null}

        <div className="mt-5 grid gap-3">
          <label className="flex min-h-12 items-center gap-3 rounded-[18px] bg-white/76 px-3 shadow-bevel">
            <Mail className="h-4 w-4 shrink-0 text-black/45" />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              readOnly={isCreateMode && Boolean(accountEmail)}
              autoComplete="email"
              placeholder={t(language, "email")}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-black outline-none placeholder:text-black/32 read-only:text-black/45"
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-[18px] bg-white/76 px-3 shadow-bevel">
            <LockKeyhole className="h-4 w-4 shrink-0 text-black/45" />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              minLength={6}
              autoComplete={isCreateMode ? "new-password" : "current-password"}
              placeholder={t(language, "password")}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-black outline-none placeholder:text-black/32"
            />
          </label>
        </div>

        <button type="submit" disabled={isSubmitting} className="shine-sweep dark-pill mt-4 min-h-12 w-full rounded-[18px] text-sm font-black uppercase disabled:opacity-60">
          <span className="inline-flex items-center justify-center gap-2">
            {isCreateMode ? <ShieldCheck className="h-4 w-4" /> : null}
            {isSubmitting ? t(language, "pleaseWait") : isCreateMode ? t(language, "saveProgress") : t(language, "login")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode(isCreateMode ? "login" : "create")}
          className="mt-3 min-h-10 w-full rounded-[16px] bg-white/64 text-xs font-black uppercase text-black/58 shadow-bevel"
        >
          {isCreateMode ? t(language, "haveAccount") : t(language, "createProgressLogin")}
        </button>
      </form>
    </div>
  );
}
