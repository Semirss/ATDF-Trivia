"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone, ShieldCheck, UserRound, X } from "lucide-react";
import { saveRemoteRewardProfile } from "@/lib/game-client";
import { t } from "@/lib/i18n";
import { usePlayerStore } from "@/store/playerStore";

export function RewardProfileModal({
  onClose,
  onComplete
}: {
  onClose: () => void;
  onComplete?: () => void;
}) {
  const playerId = usePlayerStore((state) => state.playerId);
  const name = usePlayerStore((state) => state.name);
  const accountEmail = usePlayerStore((state) => state.accountEmail);
  const telegramUsername = usePlayerStore((state) => state.telegramUsername);
  const telegramPhone = usePlayerStore((state) => state.telegramPhone);
  const source = usePlayerStore((state) => state.source);
  const saveRewardProfile = usePlayerStore((state) => state.saveRewardProfile);
  const language = usePlayerStore((state) => state.language);

  const [fullName, setFullName] = useState(name ?? "");
  const [email, setEmail] = useState(accountEmail ?? "");
  const [phone, setPhone] = useState(telegramPhone ?? "");
  const [manualTelegramUsername, setManualTelegramUsername] = useState(telegramUsername ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!playerId) {
      toast.error(t(language, "createPlayerFirstToast"));
      return;
    }

    setIsSubmitting(true);
    try {
      const profile = await saveRemoteRewardProfile({
        playerId,
        fullName,
        email,
        phone,
        telegramUsername: manualTelegramUsername
      });
      saveRewardProfile(profile);
      toast.success(t(language, "prizeContactSaved"));
      if (onComplete) {
        onComplete();
      } else {
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(language, "unableSavePrizeContact"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/45 p-5 backdrop-blur-md">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border border-white/55 bg-[#eef0eb] p-5 shadow-engine">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/42">{t(language, "verifyForPrizes")}</p>
            <h2 className="mt-1 font-display text-2xl font-black leading-none">{t(language, "prizeContact")}</h2>
            <p className="mt-2 max-w-[250px] text-xs font-semibold leading-snug text-black/45">
              {t(language, "prizeContactDescription")}
            </p>
          </div>
          <button type="button" aria-label={t(language, "close")} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-black shadow-bevel">
            <X className="h-5 w-5" />
          </button>
        </div>

        {source === "telegram" ? (
          <div className="mt-4 rounded-[18px] bg-[#2AABEE]/12 px-3 py-2 text-xs font-bold text-black/58 shadow-bevel">
            {t(language, "telegramProfileLoaded")}{telegramUsername ? `: @${telegramUsername}` : ""}.
          </div>
        ) : null}

        <div className="mt-5 grid gap-3">
          <label className="flex min-h-12 items-center gap-3 rounded-[18px] bg-white/76 px-3 shadow-bevel">
            <UserRound className="h-4 w-4 shrink-0 text-black/45" />
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              minLength={2}
              autoComplete="name"
              placeholder={t(language, "fullName")}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-black outline-none placeholder:text-black/32"
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-[18px] bg-white/76 px-3 shadow-bevel">
            <Mail className="h-4 w-4 shrink-0 text-black/45" />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              autoComplete="email"
              placeholder={t(language, "email")}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-black outline-none placeholder:text-black/32"
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-[18px] bg-white/76 px-3 shadow-bevel">
            <Phone className="h-4 w-4 shrink-0 text-black/45" />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              autoComplete="tel"
              placeholder={t(language, "phoneNumber")}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-black outline-none placeholder:text-black/32"
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-[18px] bg-white/76 px-3 shadow-bevel">
            <MessageCircle className="h-4 w-4 shrink-0 text-black/45" />
            <input
              value={manualTelegramUsername}
              onChange={(event) => setManualTelegramUsername(event.target.value)}
              required
              autoComplete="off"
              placeholder={t(language, "telegramUsername")}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-black outline-none placeholder:text-black/32"
            />
          </label>
        </div>

        <button type="submit" disabled={isSubmitting} className="shine-sweep dark-pill mt-4 min-h-12 w-full rounded-[18px] text-sm font-black uppercase disabled:opacity-60">
          <span className="inline-flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {isSubmitting ? t(language, "pleaseWait") : t(language, "verifyForPrizes")}
          </span>
        </button>
      </form>
    </div>
  );
}
