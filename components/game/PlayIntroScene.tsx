"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, Play } from "lucide-react";
import { SoundManager } from "@/lib/sounds";

export function PlayIntroScene({ onPlay, isLoading = false }: { onPlay: () => void; isLoading?: boolean }) {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [phase, setPhase] = useState<"poster" | "splash">("poster");
  const [triviaReady, setTriviaReady] = useState(false);
  const [continueRequested, setContinueRequested] = useState(false);

  useEffect(() => {
    setStage(document.querySelector<HTMLElement>(".phone-stage"));
  }, []);

  useEffect(() => {
    if (continueRequested && triviaReady) {
      setPhase("splash");
    }
  }, [continueRequested, triviaReady]);

  const scene = (
    <div className="play-intro-scene launch-sequence absolute inset-0 z-[120] h-full min-h-full w-full min-w-full overflow-hidden">
      <Image
        src="/visuals/atdf-trivia-splash-optimized.jpg"
        alt=""
        fill
        priority
        sizes="(max-width: 1099px) 100vw, 430px"
        className="launch-preload-art"
        onLoad={() => setTriviaReady(true)}
        onError={() => setTriviaReady(true)}
      />
      {phase === "poster" ? (
        <section className="launch-stage launch-event-stage" aria-label="Africa Trade Development Forum 2026">
          <Image
            src="/visuals/atdf-event-poster-optimized.jpg"
            alt="Africa Trade Development Forum 2026 event poster"
            fill
            priority
            sizes="(max-width: 1099px) 100vw, 430px"
            className="launch-art launch-event-art"
          />
          <button
            type="button"
            className="launch-continue-button"
            disabled={continueRequested && !triviaReady}
            onClick={() => {
              setContinueRequested(true);
              if (triviaReady) {
                setPhase("splash");
              }
            }}
          >
            {continueRequested && !triviaReady ? (
              <LoaderCircle className="launch-continue-spinner" aria-hidden="true" />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
            <span>{continueRequested && !triviaReady ? "Loading" : "Continue"}</span>
          </button>
        </section>
      ) : (
        <section className="launch-stage launch-trivia-stage" aria-label="ATDF Trivia">
          <div className="launch-trivia-fallback" aria-hidden="true">
            <small>BUILDING AFRICA&apos;S EXPORTS THROUGH QUALITY</small>
            <strong>ATDF</strong>
            <span>TRIVIA</span>
          </div>
          <Image
            src="/visuals/atdf-trivia-splash-optimized.jpg"
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
