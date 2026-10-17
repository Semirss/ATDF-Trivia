"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { PartnerLogoStrip } from "@/components/game/PartnerLogoStrip";
import { t } from "@/lib/i18n";
import { SoundManager } from "@/lib/sounds";
import { usePlayerStore } from "@/store/playerStore";

export function PlayIntroScene({ onPlay, isLoading = false }: { onPlay: () => void; isLoading?: boolean }) {
  const language = usePlayerStore((state) => state.language);
  const [stage, setStage] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setStage(document.querySelector<HTMLElement>(".phone-stage"));
  }, []);

  const scene = (
    <div className="play-intro-scene absolute inset-0 z-[120] flex h-full min-h-full w-full min-w-full flex-col overflow-hidden px-5">
      <Image src="/back.jpg" alt="" fill priority sizes="100vw" className="object-cover" aria-hidden="true" />
      <div className="absolute inset-0 bg-black/25" />

      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="play-intro-title relative z-10 mx-auto text-center"
      >
        <div className="font-display text-[46px] font-black leading-[0.82]">
          {/* <span className="block text-[64px] text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,0.55)]">Trivia</span>
          <span className="text-honey text-[84px]  [text-shadow:0_4px_16px_rgba(0,0,0,0.5),0_1px_0_rgba(0,0,0,0.3)]">Game</span> */}
        </div>
      </motion.div>

      <div className="relative   z-10 grid flex-1 place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 150, damping: 16 }}
          className="relative "
        >
          <div className="absolute hidden  inset-x-8  bottom-4 h-2 rounded-full bg-black/22 blur-xl" />
          <div className="scale-[1.35]">
            
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 150, damping: 16 }}
        className="play-intro-logos relative z-10 mx-auto w-full max-w-[380px]"
      >
        <PartnerLogoStrip variant="splash" />
      </motion.div>

      <motion.button
        type="button"
        onClick={() => {
          SoundManager.unlock();
          onPlay();
        }}
        disabled={isLoading}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, type: "spring", stiffness: 150, damping: 16 }}
        className="play-intro-button shine-sweep relative z-10 mx-auto flex items-center justify-center gap-2 rounded-[40px] border-2 border-white text-lg font-black uppercase text-white disabled:opacity-70"
      >
        {isLoading ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <Play className="h-5 w-5 fill-white text-white" />
        )}
        {t(language, "play")}
      </motion.button>
    </div>
  );

  // Once mounted, render directly under the phone stage so transformed page
  // wrappers cannot trap the splash below the navigation stacking context.
  // The initial inline render keeps server/client markup identical.
  return stage ? createPortal(scene, stage) : scene;
}
