"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, X } from "lucide-react";
import { SoundManager } from "@/lib/sounds";
import { recordRemoteAdView } from "@/lib/game-client";
import { getVideoAdId } from "@/lib/video-ad-url";
import { usePlayerStore } from "@/store/playerStore";
import type { GameConfig } from "@/lib/types";

type PlayerStatus = "loading" | "ready" | "playing" | "failed";

export function VideoAdOverlay({
  config,
  url,
  durationSeconds,
  onComplete
}: {
  config: GameConfig["youtubeAd"];
  url: string;
  durationSeconds: number;
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewIdRef = useRef(crypto.randomUUID());
  const viewStartedRef = useRef(false);
  const viewCompletedRef = useRef(false);
  const playerId = usePlayerStore((state) => state.playerId);
  const videoId = useMemo(() => getVideoAdId(url), [url]);
  const canContinue = remaining <= 0 || playerStatus === "failed";

  const markAdStarted = useCallback(() => {
    if (viewStartedRef.current) return;
    viewStartedRef.current = true;
    void recordRemoteAdView({
      viewId: viewIdRef.current,
      playerId,
      videoId,
      videoUrl: url,
      event: "started"
    }).catch(() => undefined);
  }, [playerId, url, videoId]);

  const completeAd = useCallback(() => {
    if (viewStartedRef.current && !viewCompletedRef.current) {
      viewCompletedRef.current = true;
      void recordRemoteAdView({
        viewId: viewIdRef.current,
        playerId,
        videoId,
        videoUrl: url,
        event: "completed",
        watchedSeconds: Math.max(0, durationSeconds - remaining)
      }).catch(() => undefined);
    }
    onComplete();
  }, [durationSeconds, onComplete, playerId, remaining, url, videoId]);

  const tryToPlay = useCallback(() => {
    void videoRef.current?.play().catch(() => {
      setPlayerStatus("ready");
    });
  }, []);

  useEffect(() => {
    SoundManager.stopBg();
    return () => SoundManager.stopBg();
  }, []);

  useEffect(() => {
    setRemaining(durationSeconds);
    setPlayerStatus("loading");
    viewIdRef.current = crypto.randomUUID();
    viewStartedRef.current = false;
    viewCompletedRef.current = false;
  }, [durationSeconds, url]);

  useEffect(() => {
    if (playerStatus !== "playing" || remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [playerStatus, remaining]);

  function retryVideo() {
    if (!videoRef.current) return;
    setPlayerStatus("loading");
    videoRef.current.load();
    window.setTimeout(tryToPlay, 100);
  }

  return (
    <div className="absolute inset-0 z-[70] grid place-items-center bg-black/72 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 170, damping: 18 }}
        className="video-ad-card w-full max-w-sm rounded-[30px] p-4 shadow-engine"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-honey">Sponsored</div>
            <div className="text-lg font-black">Watch to continue</div>
          </div>
          <button
            type="button"
            onClick={completeAd}
            disabled={!canContinue}
            aria-label="Close ad"
            className="video-ad-close grid h-9 w-9 shrink-0 place-items-center rounded-full disabled:opacity-35"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="video-ad-frame relative overflow-hidden rounded-[22px]"
          style={{ aspectRatio: config.aspectRatio === "vertical" ? "9 / 16" : "16 / 9" }}
        >
          <video
            ref={videoRef}
            key={url}
            src={url}
            title="Video ad"
            autoPlay
            muted
            controls
            playsInline
            preload="auto"
            controlsList="nodownload noremoteplayback"
            onLoadedData={() => setPlayerStatus("ready")}
            onCanPlay={tryToPlay}
            onPlay={() => {
              setPlayerStatus("playing");
              markAdStarted();
            }}
            onPause={() => setPlayerStatus((current) => current === "failed" ? current : "ready")}
            onEnded={() => {
              setRemaining(0);
              setPlayerStatus("ready");
            }}
            onError={() => setPlayerStatus("failed")}
            className="h-full w-full bg-black object-contain"
          />

          {playerStatus === "loading" ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/45 p-6 text-center text-sm font-black text-white">
              Loading video.
            </div>
          ) : null}

          {playerStatus === "failed" ? (
            <div className="absolute inset-0 grid place-items-center bg-black/90 p-6 text-center text-white">
              <div>
                <Play className="mx-auto h-10 w-10 text-honey" />
                <div className="mt-3 text-sm font-black">This video could not be loaded.</div>
                <p className="mx-auto mt-2 max-w-[260px] text-xs font-bold opacity-65">
                  Check that the Supabase Storage URL is public and points directly to a playable video file.
                </p>
                <button
                  type="button"
                  onClick={retryVideo}
                  className="mx-auto mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-[14px] bg-white px-4 text-xs font-black uppercase text-black"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry video
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
            {playerStatus === "loading"
              ? "Loading video."
              : playerStatus === "failed"
                ? "Video unavailable"
                : canContinue
                  ? "Ready"
                  : playerStatus === "playing"
                    ? `${remaining}s left`
                    : "Press play to continue"}
          </div>
          <button
            type="button"
            onClick={completeAd}
            disabled={!canContinue}
            className="video-ad-continue shine-sweep min-h-11 rounded-[18px] px-4 text-xs font-black uppercase disabled:opacity-45"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
}
