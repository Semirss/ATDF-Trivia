"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchRemoteConfig, updateRemoteConfig } from "@/lib/admin-client";
import type { GameConfig } from "@/lib/types";

const defaultConfig: GameConfig = {
  defaultTimeLimitSeconds: 30,
  maxStreakBonus: {
    multiplier: 2,
    triggerAt: 3
  },
  leaderboardDisplayCount: 100,
  youtubeAd: {
    enabled: false,
    url: "",
    urls: [],
    ads: [],
    durationSeconds: 15,
    aspectRatio: "normal",
    levelInterval: 2,
    selectionMode: "rotate",
    triggerMode: "interval",
    targetLevels: []
  }
};

function editableYoutubeAds(config: GameConfig["youtubeAd"]): import("@/lib/types").YouTubeAdItem[] {
  if (config.ads.length > 0) {
    return config.ads;
  }

  const links = config.urls.length > 0 ? config.urls : config.url ? [config.url] : [""];
  return links.map((url) => ({
    url,
    durationSeconds: config.durationSeconds,
    targetLevels: []
  }));
}

function formatTargetLevels(levels: number[]) {
  return levels.join(", ");
}

function parseTargetLevels(value: string) {
  const levels = new Set<number>();

  for (const part of value.split(/[,\s]+/)) {
    const level = Number(part.trim());
    if (Number.isInteger(level) && level >= 1 && level <= 200) {
      levels.add(level);
    }
  }

  return Array.from(levels).sort((first, second) => first - second);
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<GameConfig>(defaultConfig);
  const [targetLevelsText, setTargetLevelsText] = useState(formatTargetLevels(defaultConfig.youtubeAd.targetLevels));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const youtubeAds = editableYoutubeAds(config.youtubeAd);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const data = await fetchRemoteConfig();
        if (!cancelled) {
          setConfig(data);
          setTargetLevelsText(formatTargetLevels(data.youtubeAd.targetLevels));
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load config.");
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveConfig() {
    setIsSaving(true);

    try {
      const saved = await updateRemoteConfig(config);
      setConfig(saved);
      setTargetLevelsText(formatTargetLevels(saved.youtubeAd.targetLevels));
      setError(null);
      toast.success("Game config saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save config.");
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save config.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateYoutubeAds(update: (ads: GameConfig["youtubeAd"]["ads"]) => GameConfig["youtubeAd"]["ads"]) {
    setConfig((current) => {
      const nextAds = update(editableYoutubeAds(current.youtubeAd));
      const ads = nextAds.length > 0 ? nextAds : [{ url: "", durationSeconds: 15, targetLevels: [] }];
      const urls = ads.map((ad) => ad.url);

      return {
        ...current,
        youtubeAd: {
          ...current.youtubeAd,
          url: urls[0] ?? "",
          urls,
          ads,
          durationSeconds: ads[0]?.durationSeconds ?? current.youtubeAd.durationSeconds
        }
      };
    });
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-black uppercase text-black/45">Settings</p>
        <h1 className="font-display text-4xl font-black">Game Config</h1>
      </div>
      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Core rules</p>
          <h2 className="text-2xl font-black">Scoring and timers</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-bold">
            Default time limit
            <input
              type="number"
              min={5}
              className="h-11 rounded-md border border-black/15 px-3"
              value={config.defaultTimeLimitSeconds}
              onChange={(event) => setConfig((current) => ({ ...current, defaultTimeLimitSeconds: Number(event.target.value) }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Streak trigger
            <input
              type="number"
              min={2}
              className="h-11 rounded-md border border-black/15 px-3"
              value={config.maxStreakBonus.triggerAt}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  maxStreakBonus: { ...current.maxStreakBonus, triggerAt: Number(event.target.value) }
                }))
              }
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Streak multiplier
            <input
              type="number"
              min={1}
              className="h-11 rounded-md border border-black/15 px-3"
              value={config.maxStreakBonus.multiplier}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  maxStreakBonus: { ...current.maxStreakBonus, multiplier: Number(event.target.value) }
                }))
              }
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Leaderboard rows
            <input
              type="number"
              min={10}
              className="h-11 rounded-md border border-black/15 px-3"
              value={config.leaderboardDisplayCount}
              onChange={(event) => setConfig((current) => ({ ...current, leaderboardDisplayCount: Number(event.target.value) }))}
            />
          </label>
        </div>

        <div className="mt-8 rounded-[24px] border border-black/10 bg-black/[0.03] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Ad section</p>
              <h2 className="text-2xl font-black">Supabase video level-win ad</h2>
              <p className="mt-1 max-w-2xl text-sm font-bold text-black/52">
                Show a video hosted in Supabase Storage after level wins. Paste a public URL that points directly to the video file.
              </p>
            </div>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-black uppercase">
              <input
                type="checkbox"
                checked={config.youtubeAd.enabled}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    youtubeAd: { ...current.youtubeAd, enabled: event.target.checked }
                  }))
                }
              />
              Enable ads
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 text-sm font-bold md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Supabase Storage video URLs</span>
                <button
                  type="button"
                  onClick={() => updateYoutubeAds((ads) => [...ads, { url: "", durationSeconds: 15, targetLevels: [] }])}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-black uppercase disabled:opacity-45"
                >
                  <Plus className="h-4 w-4" />
                  Add link
                </button>
              </div>
              <div className="grid gap-2">
                {youtubeAds.map((ad, index) => (
                  <div key={index} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                    <label className="grid gap-1">
                      <span className="text-xs font-black text-black/52">Link {index + 1}</span>
                      <input
                        type="url"
                        placeholder="https://your-project.supabase.co/storage/v1/object/public/videos/ad.mp4"
                        className="h-11 min-w-0 rounded-md border border-black/15 bg-white px-3"
                        value={ad.url}
                        onChange={(event) =>
                          updateYoutubeAds((ads) =>
                            ads.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, url: event.target.value } : item
                            )
                          )
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs font-black text-black/52">Duration</span>
                      <div className="flex h-11 items-center rounded-md border border-black/15 bg-white pr-3">
                        <input
                          type="number"
                          min={3}
                          max={180}
                          aria-label={`Duration for video URL ${index + 1}`}
                          className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none"
                          value={ad.durationSeconds}
                          onChange={(event) =>
                            updateYoutubeAds((ads) =>
                              ads.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, durationSeconds: Number(event.target.value) }
                                  : item
                              )
                            )
                          }
                        />
                        <span className="text-xs font-black text-black/45">sec</span>
                      </div>
                    </label>
                    {youtubeAds.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove video URL ${index + 1}`}
                        title={`Remove video URL ${index + 1}`}
                        onClick={() => updateYoutubeAds((ads) => ads.filter((_, itemIndex) => itemIndex !== index))}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-black/70"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                    <label className="grid gap-1 sm:col-span-full mb-4">
                      <span className="text-xs font-black text-black/52">Specific Target Levels (Optional)</span>
                      <input
                        type="text"
                        placeholder="e.g. 5, 10"
                        className="h-11 min-w-0 rounded-md border border-black/15 bg-white px-3 text-sm"
                        value={ad.targetLevels ? formatTargetLevels(ad.targetLevels) : ""}
                        onChange={(event) =>
                          updateYoutubeAds((ads) =>
                            ads.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, targetLevels: parseTargetLevels(event.target.value) }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <label className="grid gap-1 text-sm font-bold md:col-span-2">
              Video format
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "normal" as const, label: "Normal 16:9", detail: "Best for landscape videos" },
                  { value: "vertical" as const, label: "9:16 vertical", detail: "Best for vertical and phone ads" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        youtubeAd: { ...current.youtubeAd, aspectRatio: option.value }
                      }))
                    }
                    className={`rounded-[18px] border p-3 text-left transition ${
                      config.youtubeAd.aspectRatio === option.value
                        ? "border-black bg-white shadow-sm"
                        : "border-black/10 bg-white/58"
                    }`}
                  >
                    <div className="font-black">{option.label}</div>
                    <div className="mt-1 text-xs font-bold text-black/48">{option.detail}</div>
                  </button>
                ))}
              </div>
            </label>

            <label className="grid gap-1 text-sm font-bold md:col-span-2">
              Link order
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "rotate" as const, label: "Rotate links", detail: "Use link 1, then link 2, then link 3" },
                  { value: "shuffle" as const, label: "Shuffle links", detail: "Pick a saved link randomly each time" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        youtubeAd: { ...current.youtubeAd, selectionMode: option.value }
                      }))
                    }
                    className={`rounded-[18px] border p-3 text-left transition ${
                      config.youtubeAd.selectionMode === option.value
                        ? "border-black bg-white shadow-sm"
                        : "border-black/10 bg-white/58"
                    }`}
                  >
                    <div className="font-black">{option.label}</div>
                    <div className="mt-1 text-xs font-bold text-black/48">{option.detail}</div>
                  </button>
                ))}
              </div>
            </label>

            <label className="grid gap-1 text-sm font-bold md:col-span-2">
              Ad timing
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "interval" as const, label: "Every N wins", detail: "Show after a repeated level-win interval" },
                  { value: "levels" as const, label: "Selected levels", detail: "Show only after the level numbers you enter" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        youtubeAd: { ...current.youtubeAd, triggerMode: option.value }
                      }))
                    }
                    className={`rounded-[18px] border p-3 text-left transition ${
                      config.youtubeAd.triggerMode === option.value
                        ? "border-black bg-white shadow-sm"
                        : "border-black/10 bg-white/58"
                    }`}
                  >
                    <div className="font-black">{option.label}</div>
                    <div className="mt-1 text-xs font-bold text-black/48">{option.detail}</div>
                  </button>
                ))}
              </div>
            </label>

            {config.youtubeAd.triggerMode === "interval" ? (
              <label className="grid gap-1 text-sm font-bold md:col-span-2">
                Show ad every
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="h-11 min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3"
                    value={config.youtubeAd.levelInterval}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        youtubeAd: { ...current.youtubeAd, levelInterval: Number(event.target.value) }
                      }))
                    }
                  />
                  <span className="text-sm font-black text-black/54">level wins</span>
                </div>
              </label>
            ) : (
              <label className="grid gap-1 text-sm font-bold md:col-span-2">
                Target level wins
                <input
                  type="text"
                  placeholder="2, 5, 10"
                  className="h-11 rounded-md border border-black/15 bg-white px-3"
                  value={targetLevelsText}
                  onChange={(event) => {
                    setTargetLevelsText(event.target.value);
                    setConfig((current) => ({
                      ...current,
                      youtubeAd: { ...current.youtubeAd, targetLevels: parseTargetLevels(event.target.value) }
                    }));
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void saveConfig()}
          disabled={isSaving}
          className="mt-6 min-h-11 rounded-md bg-black px-4 text-sm font-black uppercase text-white disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Config"}
        </button>
      </div>
    </div>
  );
}
