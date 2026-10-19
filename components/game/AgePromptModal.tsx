"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RiveWidget } from "@/components/ui/RiveWidget";
import { saveRemotePlayer } from "@/lib/game-client";
import { t } from "@/lib/i18n";
import { usePlayerStore } from "@/store/playerStore";

export function AgePromptModal() {
  const isLoaded = usePlayerStore((state) => state.isLoaded);
  const playerId = usePlayerStore((state) => state.playerId);
  const name = usePlayerStore((state) => state.name);
  const currentAge = usePlayerStore((state) => state.age);
  const language = usePlayerStore((state) => state.language);
  const setProfile = usePlayerStore((state) => state.setProfile);

  const [age, setAge] = useState(18);
  const [isSaving, setIsSaving] = useState(false);

  // Show if player is fully loaded, exists, and age is 0 (or null)
  const isVisible = isLoaded && playerId && (!currentAge || currentAge < 6);

  if (!isVisible) {
    return null;
  }

  const agePercent = ((age - 6) / (99 - 6)) * 100;
  const bubblePercent = Math.min(Math.max(agePercent, 8), 92);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);

    try {
      const player = await saveRemotePlayer({
        playerId: playerId!,
        name: name || "Player",
        age
      });
      setProfile(player);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(language, "profileSaveError"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="age-prompt-backdrop pointer-events-auto fixed inset-0 z-[100] grid place-items-center p-5 backdrop-blur-md">
        <form onSubmit={submit} className="age-prompt-form w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.94, rotateX: -8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="glass-panel onboarding-card age-prompt-card rounded-[30px] p-5 text-center"
          >
            <div className="onboarding-mascot mx-auto flex justify-center">
              <RiveWidget mood="happy" />
            </div>
            <h2 className="game-page-title age-prompt-title mt-4 font-display text-3xl font-black leading-none">
              {t(language, "agePromptTitle")}
            </h2>
            <p className="game-page-subtitle age-prompt-subtitle mt-2 text-sm font-semibold leading-snug">
              {t(language, "agePromptSubtitle")}
            </p>
            <div className="mt-6">
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
            </div>
            <button type="submit" disabled={isSaving} className="shine-sweep dark-pill onboarding-start-button mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] text-sm font-black uppercase disabled:opacity-60">
              {isSaving ? t(language, "saving") : t(language, "confirmAge")}
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        </form>
      </div>
    </AnimatePresence>
  );
}
