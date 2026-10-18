import { Howl, Howler } from "howler";

type SoundKey = "correct" | "wrong" | "levelUp" | "tick" | "bg";

const soundFiles: Record<Exclude<SoundKey, "bg">, string> = {
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  levelUp: "/sounds/levelup.mp3",
  tick: "/sounds/tick.mp3"
};

const bgFiles = [
  "/sounds/bg2.mp3",
  "/sounds/bg3.mp3"
];

// Keep Howler's mobile unlocker enabled. It creates the unlocked HTML5 audio
// pool required by iOS/WKWebView and resumes Web Audio on the first gesture.
Howler.autoUnlock = true;
Howler.autoSuspend = true;
Howler.volume(1);

const volumeByKey: Record<SoundKey, number> = {
  bg: 0.55,
  correct: 1,
  wrong: 1,
  levelUp: 1,
  tick: 1
};

const cache = new Map<string, Howl>();
let listenersAttached = false;
let lifecycleListenersAttached = false;
let audioUnlocked = false;
let unlockInProgress = false;
let unlockPrimer: Howl | null = null;
let effectsPreloadScheduled = false;
let bgPending = false;
let bgPlaybackId: number | null = null;
let bgStarting = false;
let bgPauseDepth = 0;
let bgWasPendingBeforePause = false;
let bgPausedPlaybackId: number | null = null;
let bgPausedIndex: number | null = null;
let tickStopTimer: number | null = null;
let pendingEffect: Exclude<SoundKey, "bg" | "tick"> | null = null;

function normalizeBgIndex(index: number) {
  if (bgFiles.length === 0) {
    return 0;
  }

  return ((index % bgFiles.length) + bgFiles.length) % bgFiles.length;
}

function getBgIndex() {
  if (typeof window === "undefined") return 0;

  try {
    const stored = window.localStorage.getItem("trivia-bg-index");
    const parsed = stored ? Number.parseInt(stored, 10) : 0;
    return normalizeBgIndex(Number.isFinite(parsed) ? parsed : 0);
  } catch {
    return 0;
  }
}

function setBgIndex(index: number) {
  const normalizedIndex = normalizeBgIndex(index);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("trivia-bg-index", String(normalizedIndex));
    } catch {
      // Audio still works when storage is unavailable in a private WebView.
    }
  }
}

function getDifferentBgIndex() {
  const currentIndex = getBgIndex();

  if (bgFiles.length < 2) {
    return currentIndex;
  }

  const offset = 1 + Math.floor(Math.random() * (bgFiles.length - 1));
  return normalizeBgIndex(currentIndex + offset);
}

function stopAllBackgroundTracks({ unload = false }: { unload?: boolean } = {}) {
  for (const [cacheKey, howl] of cache.entries()) {
    if (!cacheKey.startsWith("bg_")) {
      continue;
    }

    howl.stop();
    if (unload) {
      howl.unload();
      cache.delete(cacheKey);
    }
  }
}

function isMuted() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem("trivia-muted") === "true";
  } catch {
    return false;
  }
}

function getStoredVolume() {
  if (typeof window === "undefined") {
    return 1;
  }

  try {
    const stored = Number.parseFloat(window.localStorage.getItem("trivia-volume") ?? "1");
    return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1;
  } catch {
    return 1;
  }
}

function getHowl(key: SoundKey) {
  if (typeof window === "undefined") {
    return null;
  }

  // Use a dynamic cache key for background sounds so we can store multiple Howls
  const backgroundIndex = key === "bg" ? getBgIndex() : null;
  const cacheKey = backgroundIndex !== null ? `bg_${backgroundIndex}` : key;
  const existing = cache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const isBackground = key === "bg";
  const src = isBackground ? bgFiles[backgroundIndex ?? 0] : soundFiles[key as Exclude<SoundKey, "bg">];

  const howl = new Howl({
    src: [src],
    volume: volumeByKey[key],
    loop: false,
    // The music files are 5-6 MB each. HTML5 audio streams them instead of
    // downloading and decoding the full track on Android's main thread.
    html5: isBackground,
    preload: isBackground ? "metadata" : false,
    pool: isBackground ? 1 : 3,
    onend: (playbackId) => {
      if (
        isBackground &&
        bgPending &&
        bgPlaybackId === playbackId &&
        backgroundIndex === getBgIndex()
      ) {
        bgPlaybackId = null;
        SoundManager.nextBg();
      }
    },
    onplayerror: (playbackId) => {
      if (
        !isBackground ||
        bgPlaybackId !== playbackId ||
        backgroundIndex !== getBgIndex()
      ) {
        return;
      }

      bgPlaybackId = null;
      bgStarting = false;
      audioUnlocked = false;
      attachInteractionListeners();
    }
  });

  cache.set(cacheKey, howl);
  return howl;
}

function hasTransientUserActivation() {
  if (typeof navigator === "undefined" || !("userActivation" in navigator)) {
    return true;
  }

  return navigator.userActivation.isActive;
}

function contextNeedsResume() {
  const context = Howler.ctx;
  return Boolean(context && (context.state === "suspended" || context.state === "interrupted"));
}

async function resumeContext(fromUserGesture = false) {
  const context = Howler.ctx;
  if (!context || !contextNeedsResume()) {
    return true;
  }

  // A fresh iOS AudioContext must be resumed inside a gesture. Once audio has
  // been unlocked, foreground/page-show resumes are normally allowed as well.
  if (!fromUserGesture && !audioUnlocked && !hasTransientUserActivation()) {
    return false;
  }

  await context.resume().catch(() => undefined);
  return context.state === "running";
}

function preloadEffects() {
  (["correct", "wrong", "levelUp", "tick"] as const).forEach((key) => {
    const howl = getHowl(key);
    if (howl?.state() === "unloaded") {
      howl.load();
    }
  });
}

function scheduleEffectsPreload() {
  if (typeof window === "undefined" || effectsPreloadScheduled) {
    return;
  }

  effectsPreloadScheduled = true;
  const load = () => preloadEffects();

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(load, { timeout: 1500 });
  } else {
    setTimeout(load, 250);
  }
}

function primeMobileAudioUnlock() {
  if (typeof window === "undefined" || unlockPrimer) {
    return;
  }

  // Creating a non-preloaded Web Audio Howl makes Howler install its iOS
  // touch/click unlock listeners before the user's first interaction.
  unlockPrimer = new Howl({
    src: [soundFiles.tick],
    volume: 0,
    html5: false,
    preload: false
  });
}

function startBgNow() {
  if (isMuted() || bgStarting || bgPauseDepth > 0) {
    return;
  }

  const howl = getHowl("bg");
  if (!howl) {
    return;
  }

  if (bgPlaybackId !== null && (howl.playing(bgPlaybackId) || howl.state() === "loading")) {
    return;
  }

  bgStarting = true;

  if (bgPlaybackId !== null) {
    howl.stop(bgPlaybackId);
  }
  const playId = howl.play();
  bgPlaybackId = typeof playId === "number" ? playId : null;
  bgStarting = false;
}

async function playOneShotNow(key: Exclude<SoundKey, "bg">) {
  if (isMuted()) {
    return;
  }

  const howl = getHowl(key);
  if (!howl) {
    return;
  }

  if (!(await resumeContext())) {
    return;
  }

  if (howl.state() === "loaded") {
    howl.stop();
  }
  howl.play();
}

async function playTickNow() {
  if (isMuted()) {
    return;
  }

  const howl = getHowl("tick");
  if (!howl) {
    return;
  }

  await resumeContext();

  if (Howler.ctx && Howler.ctx.state !== "running") {
    return;
  }

  if (tickStopTimer !== null) {
    window.clearTimeout(tickStopTimer);
    tickStopTimer = null;
  }

  if (howl.state() === "loaded") {
    howl.stop();
  }
  const playId = howl.play();
  const numericPlayId = typeof playId === "number" ? playId : null;

  // Keep the countdown tick short even if the source file has a longer tail.
  tickStopTimer = window.setTimeout(() => {
    if (numericPlayId !== null && howl.playing(numericPlayId)) {
      howl.stop(numericPlayId);
    }
    tickStopTimer = null;
  }, 360);
}

function detachInteractionListeners() {
  if (typeof window === "undefined" || !listenersAttached) {
    return;
  }

  window.removeEventListener("touchstart", unlockFromInteraction);
  window.removeEventListener("touchend", unlockFromInteraction);
  window.removeEventListener("click", unlockFromInteraction);
  window.removeEventListener("keydown", unlockFromInteraction);
  listenersAttached = false;
}

function unlockFromInteraction() {
  if (audioUnlocked || unlockInProgress) {
    return;
  }

  unlockInProgress = true;
  void resumeContext(true)
    .then((resumed) => {
      if (!resumed) {
        return;
      }

      audioUnlocked = true;
      detachInteractionListeners();
      unlockPrimer?.unload();
      unlockPrimer = null;
      scheduleEffectsPreload();

      if (bgPending) {
        startBgNow();
      }

      if (pendingEffect) {
        const effect = pendingEffect;
        pendingEffect = null;
        void playOneShotNow(effect);
      }
    })
    .finally(() => {
      unlockInProgress = false;
    });
}

function restoreAudioAfterForeground() {
  if (typeof document !== "undefined" && document.hidden) {
    return;
  }

  if (!audioUnlocked) {
    attachInteractionListeners();
    return;
  }

  void resumeContext().then(() => {
    if (bgPending && !isMuted()) {
      startBgNow();
    }
  });
}

function attachLifecycleListeners() {
  if (typeof window === "undefined" || lifecycleListenersAttached) {
    return;
  }

  lifecycleListenersAttached = true;
  window.addEventListener("focus", restoreAudioAfterForeground);
  window.addEventListener("pageshow", restoreAudioAfterForeground);
  document.addEventListener("visibilitychange", restoreAudioAfterForeground);
}

function attachInteractionListeners() {
  if (typeof window === "undefined" || listenersAttached) {
    return;
  }

  primeMobileAudioUnlock();
  listenersAttached = true;
  window.addEventListener("touchstart", unlockFromInteraction, { passive: true });
  window.addEventListener("touchend", unlockFromInteraction, { passive: true });
  window.addEventListener("click", unlockFromInteraction, { passive: true });
  window.addEventListener("keydown", unlockFromInteraction);
}

export const SoundManager = {
  boot() {
    attachInteractionListeners();
    attachLifecycleListeners();
    Howler.volume(getStoredVolume());
    Howler.mute(isMuted());
  },
  unlock() {
    attachInteractionListeners();
    unlockFromInteraction();
  },
  play(key: SoundKey) {
    attachInteractionListeners();
    if (isMuted()) {
      return;
    }

    if (key === "bg") {
      bgPending = true;
      if (audioUnlocked) {
        startBgNow();
      }
      return;
    }

    if (!audioUnlocked) {
      // Mobile browsers can finish their audio unlock just after the React
      // click handler. Keep the important answer/result sound so that first
      // interaction is not silently lost while the context resumes.
      if (key !== "tick") {
        pendingEffect = key;
      }
      return;
    }

    if (key === "tick") {
      void playTickNow();
      return;
    }

    void playOneShotNow(key);
  },
  setMuted(muted: boolean) {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("trivia-muted", String(muted));
      } catch {
        // Keep the in-memory mute state even if WebView storage is unavailable.
      }
    }

    Howler.mute(muted);

    if (muted) {
      pendingEffect = null;
      bgPending = false;
      bgPlaybackId = null;
      bgStarting = false;
      
      stopAllBackgroundTracks({ unload: true });
      cache.get("tick")?.stop();
      if (tickStopTimer !== null) {
        window.clearTimeout(tickStopTimer);
        tickStopTimer = null;
      }
      return;
    }

    bgPending = true;
    attachInteractionListeners();
    if (audioUnlocked) {
      startBgNow();
    }
  },
  getMuted() {
    return isMuted();
  },
  getVolume() {
    return getStoredVolume();
  },
  setVolume(volume: number) {
    const normalizedVolume = Math.min(1, Math.max(0, volume));

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("trivia-volume", String(normalizedVolume));
      } catch {
        // The live volume still changes if storage is unavailable.
      }
    }

    Howler.volume(normalizedVolume);
  },
  startBg() {
    bgPending = true;
    attachInteractionListeners();
    if (audioUnlocked && !isMuted()) {
      startBgNow();
    }
  },
  pauseBg() {
    if (bgPauseDepth === 0) {
      bgWasPendingBeforePause = bgPending;
      bgPending = false;
      bgStarting = false;
      bgPausedIndex = getBgIndex();
      bgPausedPlaybackId = null;

      const howl = cache.get(`bg_${bgPausedIndex}`);
      if (bgPlaybackId !== null && howl?.playing(bgPlaybackId)) {
        howl.pause(bgPlaybackId);
        bgPausedPlaybackId = bgPlaybackId;
      }
    }

    bgPauseDepth += 1;
  },
  resumeBg() {
    if (bgPauseDepth <= 0) {
      return;
    }

    bgPauseDepth -= 1;
    if (bgPauseDepth > 0) {
      return;
    }

    const shouldResume = bgWasPendingBeforePause || bgPending;
    const pausedIndex = bgPausedIndex;
    const pausedPlaybackId = bgPausedPlaybackId;

    bgWasPendingBeforePause = false;
    bgPausedIndex = null;
    bgPausedPlaybackId = null;
    bgPending = shouldResume;

    if (!shouldResume || isMuted()) {
      return;
    }

    if (!audioUnlocked) {
      attachInteractionListeners();
      return;
    }

    const pausedHowl = pausedIndex !== null ? cache.get(`bg_${pausedIndex}`) : null;
    if (pausedHowl && pausedPlaybackId !== null && pausedIndex === getBgIndex()) {
      if (contextNeedsResume()) {
        void resumeContext().then((resumed) => {
          if (resumed && bgPauseDepth === 0 && !isMuted()) {
            pausedHowl.play(pausedPlaybackId);
            bgPlaybackId = pausedPlaybackId;
          }
        });
        return;
      }

      pausedHowl.play(pausedPlaybackId);
      bgPlaybackId = pausedPlaybackId;
      return;
    }

    startBgNow();
  },
  stopBg() {
    bgPending = false;
    bgPlaybackId = null;
    bgStarting = false;
    bgPauseDepth = 0;
    bgWasPendingBeforePause = false;
    bgPausedPlaybackId = null;
    bgPausedIndex = null;
    stopAllBackgroundTracks({ unload: true });
  },
  stop(key: Exclude<SoundKey, "bg">) {
    if (key === "tick" && tickStopTimer !== null) {
      window.clearTimeout(tickStopTimer);
      tickStopTimer = null;
    }

    cache.get(key)?.stop();
  },
  nextBg() {
    if (typeof window === "undefined") return;
    this.stopBg();
    const nextIndex = normalizeBgIndex(getBgIndex() + 1);
    setBgIndex(nextIndex);
    this.startBg();
  },
  shuffleBg() {
    if (typeof window === "undefined") return;
    this.stopBg();
    setBgIndex(getDifferentBgIndex());
    this.startBg();
  }
};
