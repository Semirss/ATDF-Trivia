"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PlayerAccountModal } from "@/components/game/PlayerAccountModal";
import { RiveWidget } from "@/components/ui/RiveWidget";
import { PageTransition } from "@/components/ui/PageTransition";
import { saveRemotePlayer } from "@/lib/game-client";
import { t } from "@/lib/i18n";
import { isUuid } from "@/lib/utils";
import { syncTelegramPlayerFromWebApp } from "@/lib/telegram-player";
import { isTelegramMiniApp, hasTelegramLaunchData } from "@/lib/telegram-webapp";
import { usePlayerStore } from "@/store/playerStore";

export default function OnboardingPage() {
  const router = useRouter();
  const setProfile = usePlayerStore((state) => state.setProfile);
  const existingPlayerId = usePlayerStore((state) => state.playerId);
  const language = usePlayerStore((state) => state.language);
  const [step] = useState<"name" | "age">("name");
  const [name, setName] = useState("");
  const [age, setAge] = useState(18);
  const [isSaving, setIsSaving] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // Whether we are still performing the Telegram pre-check on mount
  const [isTelegramChecking, setIsTelegramChecking] = useState(true);
  const didCheck = useRef(false);
  const agePercent = ((age - 6) / (99 - 6)) * 100;
  const bubblePercent = Math.min(Math.max(agePercent, 8), 92);

  // ── Telegram pre-check ──────────────────────────────────────────────────────
  // Run once on mount. If the user is already in Telegram and has an account,
  // redirect them home automatically. If they are a new Telegram user, pre-fill
  // their name/age from the Telegram profile so they don't have to type it.
  // If we are not in Telegram at all, skip the check immediately.
  useEffect(() => {
    if (didCheck.current) return;
    didCheck.current = true;

    // If a player is already loaded in the store, skip directly to home.
    if (existingPlayerId && isUuid(existingPlayerId)) {
      router.replace("/");
      return;
    }

    const inTelegram = isTelegramMiniApp();

    if (!inTelegram) {
      // Not a Telegram Mini App — show the form immediately, no pre-check needed.
      setIsTelegramChecking(false);
      return;
    }

    async function runTelegramCheck() {
      // Wait up to ~3 s for initData to become available (Telegram injects it
      // asynchronously on some clients), then perform the sync.
      let attempts = 0;
      while (!hasTelegramLaunchData() && attempts < 12) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        attempts += 1;
      }

      try {
        const snapshot = await syncTelegramPlayerFromWebApp({ requestPhone: false });

        const latestPlayerId = usePlayerStore.getState().playerId;

        if (snapshot || (latestPlayerId && isUuid(latestPlayerId))) {
          // ✅ Existing user found — go home, no registration needed.
          router.replace("/");
          return;
        }

        // 🆕 New Telegram user — pre-fill name from Telegram profile if available.
        // The store may have a name set by setProfile after a partial sync.
        const latestName = usePlayerStore.getState().name;
        const latestAge = usePlayerStore.getState().age;
        if (latestName) setName(latestName);
        if (latestAge && latestAge >= 6 && latestAge <= 99) setAge(latestAge);
      } catch {
        // Ignore sync errors — just show the form.
      } finally {
        setIsTelegramChecking(false);
      }
    }

    void runTelegramCheck();
  }, [existingPlayerId, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);

    try {
      const safePlayerId = existingPlayerId && isUuid(existingPlayerId) ? existingPlayerId : undefined;
      const player = await saveRemotePlayer({
        playerId: safePlayerId,
        name: name.trim() || "Player",
        age
      });
      setProfile(player);
      router.push("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(language, "profileSaveError"));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Loading screen while Telegram pre-check is running ──────────────────
  if (isTelegramChecking) {
    return (
      <PageTransition>
        <div className="game-safe game-safe-compact onboarding-screen grid min-h-full place-items-center">
          <div className="glass-panel onboarding-card onboarding-loading-card rounded-[30px] p-8 text-center">
            <LoaderCircle className="onboarding-loading-spinner mx-auto h-8 w-8 animate-spin" />
            <p className="onboarding-loading-title mt-4 font-display text-lg font-black leading-none">
              {t(language, "loadingTelegram")}
            </p>
            <p className="onboarding-loading-subtitle mt-2 text-sm font-bold">
              {t(language, "checkingTelegramProfile")}
            </p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="game-safe game-safe-compact onboarding-screen grid min-h-full place-items-center">
        {loginOpen ? (
          <PlayerAccountModal initialMode="login" onClose={() => setLoginOpen(false)} onComplete={() => router.push("/")} />
        ) : null}
        <form onSubmit={submit} className="onboarding-form w-full">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 34, scale: 0.94, rotateX: -8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="glass-panel onboarding-card rounded-[30px] p-5 text-center"
          >
            <div className="onboarding-mascot mx-auto flex justify-center">
              <RiveWidget mood={step === "age" ? "happy" : "thinking"} />
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="onboarding-title mt-4 font-display text-3xl font-black leading-none"
            >
              {step === "name" ? t(language, "whatsYourName") : t(language, "howOldAreYou")}
            </motion.h1>
            <div className="mt-6">
              {step === "name" ? (
                <motion.input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder={t(language, "yourName")}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="onboarding-name-input h-14 w-full rounded-[20px] border px-4 text-center font-display text-xl font-black outline-none"
                />
              ) : (
                <div className="atdf-age-panel rounded-[24px] p-4">
                  <div className="atdf-age-display mx-auto grid h-24 w-24 place-items-center rounded-full text-white">
                    <div>
                      <div className="font-display text-4xl font-black leading-none">{age}</div>
                      <div className="atdf-age-years text-[10px] font-black uppercase">{t(language, "years")}</div>
                    </div>
                  </div>
                  <div className="relative mt-5">
                    <div
                      className="atdf-age-bubble absolute -top-3 z-10 h-[72px] w-[72px] -translate-x-1/2 rounded-full transition-all"
                      style={{ left: `${bubblePercent}%` }}
                    >
                      <div className="grid h-full place-items-center">
                        <div className="text-center">
                          <div className="font-display text-3xl font-black leading-none">{age}</div>
                          <div className="atdf-age-bubble-label text-[10px] font-black uppercase">{t(language, "age")}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-16">
                      <span className="atdf-age-limit text-xs font-black">6</span>
                      <input
                        value={age}
                        onChange={(event) => setAge(Number(event.target.value))}
                        required
                        type="range"
                        min={6}
                        max={99}
                        className="age-slider atdf-age-slider h-2 flex-1 appearance-none rounded-full bg-transparent"
                        style={{
                          background: `linear-gradient(90deg, #69bd43 0%, #69bd43 ${agePercent}%, rgba(6,47,69,0.22) ${agePercent}%, rgba(6,47,69,0.22) 100%)`
                        }}
                      />
                      <span className="atdf-age-limit text-xs font-black">99</span>
                    </div>
                  </div>
                  <div className="atdf-age-summary mt-3 grid gap-2 rounded-[18px] px-4 py-3 text-left">
                    <div className="atdf-age-summary-label text-[10px] font-black uppercase tracking-[0.18em]">{t(language, "selectedAge")}</div>
                    <div className="atdf-age-summary-value text-lg font-black">{age} {t(language, "yearsOld")}</div>
                  </div>
                  <div className="atdf-age-hint mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t(language, "slideToSelect")}
                  </div>
                </div>
              )}
            </div>
            <button type="submit" disabled={isSaving} className="shine-sweep dark-pill onboarding-start-button mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] text-sm font-black uppercase disabled:opacity-60">
              {isSaving ? t(language, "saving") : t(language, "start")}
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="onboarding-account-button mt-3 min-h-11 w-full rounded-[18px] text-xs font-black uppercase"
            >
              {t(language, "haveAccount")}
            </button>
          </motion.div>
        </form>
      </div>
    </PageTransition>
  );
}
