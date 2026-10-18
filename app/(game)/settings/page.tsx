"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Globe2, Shuffle, Volume1, Volume2, VolumeX } from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";
import { supportedLanguages, t } from "@/lib/i18n";
import { SoundManager } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

export default function SettingsPage() {
  const router = useRouter();
  const language = usePlayerStore((state) => state.language);
  const setLanguage = usePlayerStore((state) => state.setLanguage);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    SoundManager.boot();
    setSoundEnabled(!SoundManager.getMuted());
    setVolume(Math.round(SoundManager.getVolume() * 100));
  }, []);

  function toggleSound() {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    SoundManager.setMuted(!nextEnabled);
    if (nextEnabled) SoundManager.unlock();
  }

  function changeVolume(nextVolume: number) {
    setVolume(nextVolume);
    SoundManager.setVolume(nextVolume / 100);
  }

  function shuffleMusic() {
    SoundManager.unlock();
    SoundManager.shuffleBg();
  }

  return (
    <PageTransition>
      <div className="game-safe settings-safe">
        <button type="button" onClick={() => router.back()} className="settings-back" aria-label={t(language, "settingsBack")}>
          <ArrowLeft className="h-5 w-5" />
        </button>

        <main className="settings-panel" lang={language}>
          <header>
            <small>{t(language, "settingsApp")}</small>
            <h1>{t(language, "settingsTitle")}</h1>
            <span />
          </header>

          <section className="settings-section">
            <h2><Globe2 className="h-5 w-5" />{t(language, "settingsLanguage")}</h2>
            <div className="settings-language-grid">
              {supportedLanguages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLanguage(item.code)}
                  className={cn("settings-language-choice", language === item.code && "is-active")}
                >
                  {language === item.code ? <Check className="h-5 w-5" /> : null}
                  <span>{t(language, item.code === "en" ? "languageEnglish" : "languageAmharic")}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section settings-sound-section">
            <h2><Volume2 className="h-5 w-5" />{t(language, "settingsSound")}</h2>
            <div className="settings-sound-card">
              <div className="settings-sound-row">
                <span className="settings-sound-icon">
                  {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </span>
                <span className="settings-sound-copy">
                  <strong>{t(language, "settingsSound")}</strong>
                  <small>{t(language, "settingsSoundDescription")}</small>
                </span>
                <button
                  type="button"
                  aria-pressed={soundEnabled}
                  onClick={toggleSound}
                  className={cn("settings-sound-toggle", soundEnabled && "is-active")}
                >
                  <i />
                  <span>{t(language, soundEnabled ? "soundOn" : "soundOff")}</span>
                </button>
              </div>

              <label className="settings-volume-control">
                <span className="sr-only">{t(language, "volume")}</span>
                <Volume1 className="h-4 w-4" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={volume}
                  disabled={!soundEnabled}
                  aria-label={t(language, "volume")}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                />
                <Volume2 className="h-5 w-5" />
                <output>{volume}%</output>
              </label>

              <div className="settings-shuffle-row">
                <span className="settings-shuffle-icon"><Shuffle className="h-4 w-4" /></span>
                <span className="settings-shuffle-copy">
                  <strong>{t(language, "shuffleMusic")}</strong>
                  <small>{t(language, "shuffleMusicDescription")}</small>
                </span>
                <button
                  type="button"
                  disabled={!soundEnabled}
                  onClick={shuffleMusic}
                  className="settings-shuffle-button"
                  aria-label={t(language, "shuffleMusic")}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>{t(language, "shuffle")}</span>
                </button>
              </div>
            </div>
          </section>

          <Image src="/visuals/atdf-2026-seal.png" alt="" width={128} height={128} className="settings-watermark" aria-hidden="true" />
        </main>
      </div>
    </PageTransition>
  );
}
