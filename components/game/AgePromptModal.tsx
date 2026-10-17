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
      <div className="pointer-events-auto fixed inset-0 z-[100] grid place-items-center bg-black/45 p-5 backdrop-blur-md">
        <form onSubmit={submit} className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.94, rotateX: -8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="glass-panel rounded-[30px] p-5 text-center shadow-engine"
          >
            <div className="mx-auto flex justify-center">
              <RiveWidget mood="happy" />
            </div>
            <h2 className="game-page-title mt-4 font-display text-3xl font-black leading-none">
              {t(language, "agePromptTitle")}
            </h2>
            <p className="game-page-subtitle mt-2 text-sm font-semibold leading-snug">
              {t(language, "agePromptSubtitle")}
            </p>
            <div className="mt-6">
              <div className="rounded-[24px] bg-white/70 p-4 shadow-bevel">
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-white/60 bg-gradient-to-b from-black to-black/88 text-white shadow-engine">
                  <div>
                    <div className="font-display text-4xl font-black leading-none">{age}</div>
                    <div className="text-[10px] font-black uppercase text-white/60">{t(language, "years")}</div>
                  </div>
                </div>
                <div className="relative mt-5">
                  <div
                    className="absolute -top-3 z-10 h-[72px] w-[72px] -translate-x-1/2 rounded-full border-2 border-white bg-honey text-ink shadow-engine transition-all"
                    style={{ left: `${bubblePercent}%` }}
                  >
                    <div className="grid h-full place-items-center">
                      <div className="text-center">
                        <div className="font-display text-3xl font-black leading-none">{age}</div>
                        <div className="text-[10px] font-black uppercase text-black/55">{t(language, "age")}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-16">
                    <span className="text-xs font-black text-black/45">6</span>
                    <input
                      value={age}
                      onChange={(event) => setAge(Number(event.target.value))}
                      required
                      type="range"
                      min={6}
                      max={99}
                      className="age-slider h-2 flex-1 appearance-none rounded-full bg-transparent"
                      style={{
                        background: `linear-gradient(90deg, #f2b84b 0%, #f2b84b ${agePercent}%, rgba(20,20,20,0.82) ${agePercent}%, rgba(20,20,20,0.82) 100%)`
                      }}
                    />
                    <span className="text-xs font-black text-black/45">99</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 rounded-[18px] bg-white/80 px-4 py-3 text-left shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">{t(language, "selectedAge")}</div>
                  <div className="text-lg font-black text-black">{age} {t(language, "yearsOld")}</div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-honey/24 px-3 py-1 text-xs font-black uppercase text-black/62">
                  <Sparkles className="h-3.5 w-3.5 text-ember" />
                  {t(language, "slideToSelect")}
                </div>
              </div>
            </div>
            <button type="submit" disabled={isSaving} className="shine-sweep dark-pill mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] text-sm font-black uppercase disabled:opacity-60">
              {isSaving ? t(language, "saving") : t(language, "confirmAge")}
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        </form>
      </div>
    </AnimatePresence>
  );
}
