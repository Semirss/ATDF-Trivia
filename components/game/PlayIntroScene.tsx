"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, Play } from "lucide-react";
import { SoundManager } from "@/lib/sounds";

export function PlayIntroScene({ onPlay, isLoading = false }: { onPlay: () => void; isLoading?: boolean }) {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [phase, setPhase] = useState<"poster" | "splash">("poster");

  useEffect(() => {
    setStage(document.querySelector<HTMLElement>(".phone-stage"));
  }, []);

  const scene = (
    <div className="play-intro-scene launch-sequence absolute inset-0 z-[120] h-full min-h-full w-full min-w-full overflow-hidden">
      {phase === "poster" ? (
        <section className="launch-stage launch-event-stage" aria-label="Africa Trade Development Forum 2026">
          <Image
            src="/visuals/atdf-event-poster.png"
            alt="Africa Trade Development Forum 2026 event poster"
            fill
            priority
            sizes="(max-width: 1099px) 100vw, 430px"
            className="launch-art launch-event-art"
          />
          <button type="button" className="launch-continue-button" onClick={() => setPhase("splash")}>
            <span>Continue</span>
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
      ) : (
        <section className="launch-stage launch-trivia-stage" aria-label="ATDF Trivia">
          <Image
            src="/visuals/atdf-trivia-splash.png"
            alt="ATDF Trivia — Building Africa’s Exports Through Quality"
            fill
            priority
            sizes="(max-width: 1099px) 100vw, 430px"
            className="launch-art launch-trivia-art"
          />
          <button
            type="button"
            className="launch-play-hit-area"
            aria-label="Play ATDF Trivia"
            disabled={isLoading}
            onClick={() => {
              SoundManager.unlock();
              onPlay();
            }}
          >
            {isLoading ? (
              <LoaderCircle className="launch-play-spinner" aria-hidden="true" />
            ) : (
              <>
                <Play className="launch-play-icon" aria-hidden="true" />
                <span>Play</span>
              </>
            )}
          </button>
        </section>
      )}
    </div>
  );

  // Once mounted, render directly under the phone stage so transformed page
  // wrappers cannot trap the splash below the navigation stacking context.
  // The initial inline render keeps server/client markup identical.
  return stage ? createPortal(scene, stage) : scene;
}
