import type { GameConfig, YouTubeAdItem } from "@/lib/types";
import { isSupabaseStorageVideoUrl } from "@/lib/video-ad-url";

export function normalizeYouTubeAdDuration(value: unknown, fallback = 15) {
  const numericValue = typeof value === "number" ? value : Number(value);
  const numericFallback = Number.isFinite(fallback) ? fallback : 15;
  const duration = Number.isFinite(numericValue) ? numericValue : numericFallback;
  return Math.max(3, Math.min(180, Math.round(duration)));
}

export function normalizeYouTubeAdUrls(urls: unknown, legacyUrl?: unknown) {
  const values: string[] = [];

  if (Array.isArray(urls)) {
    for (const url of urls) {
      if (typeof url === "string") {
        values.push(url);
      }
    }
  }

  if (typeof legacyUrl === "string") {
    values.push(legacyUrl);
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!isSupabaseStorageVideoUrl(trimmed) || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function normalizeYouTubeAdTargetLevels(value: unknown) {
  const rawLevels = Array.isArray(value) ? value : [];
  const levels = new Set<number>();

  for (const item of rawLevels) {
    const level = typeof item === "number" ? item : Number(item);
    if (Number.isInteger(level) && level >= 1 && level <= 200) {
      levels.add(level);
    }
  }

  return Array.from(levels).sort((first, second) => first - second);
}

export function normalizeYouTubeAds(
  ads: unknown,
  legacyUrls?: unknown,
  legacyUrl?: unknown,
  legacyDuration?: unknown
) {
  const fallbackDuration = normalizeYouTubeAdDuration(legacyDuration);
  const candidates: YouTubeAdItem[] = [];

  if (Array.isArray(ads)) {
    for (const item of ads) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }

      const source = item as Record<string, unknown>;
      if (typeof source.url !== "string") {
        continue;
      }

      candidates.push({
        url: source.url,
        durationSeconds: normalizeYouTubeAdDuration(
          source.durationSeconds ?? source.duration_seconds,
          fallbackDuration
        ),
        targetLevels: normalizeYouTubeAdTargetLevels(source.targetLevels ?? source.target_levels)
      });
    }
  }

  for (const url of normalizeYouTubeAdUrls(legacyUrls, legacyUrl)) {
    candidates.push({ url, durationSeconds: fallbackDuration });
  }

  const seen = new Set<string>();
  const normalized: YouTubeAdItem[] = [];

  for (const item of candidates) {
    const url = item.url.trim();
    if (!isSupabaseStorageVideoUrl(url) || seen.has(url)) {
      continue;
    }

    seen.add(url);
    normalized.push({
      url,
      durationSeconds: normalizeYouTubeAdDuration(item.durationSeconds, fallbackDuration),
      targetLevels: normalizeYouTubeAdTargetLevels(item.targetLevels)
    });
  }

  return normalized;
}

export function getYouTubeAd(
  config: GameConfig["youtubeAd"],
  completedLevelCount: number,
  random: () => number = Math.random
) {
  if (!config.enabled || completedLevelCount <= 0) {
    return null;
  }

  const ads = normalizeYouTubeAds(config.ads, config.urls, config.url, config.durationSeconds);
  if (ads.length === 0) {
    return null;
  }

  const specificAds = ads.filter((ad) => ad.targetLevels && ad.targetLevels.length > 0);
  const matchedSpecificAds = specificAds.filter((ad) => ad.targetLevels!.includes(completedLevelCount));

  if (matchedSpecificAds.length > 0) {
    return matchedSpecificAds[Math.floor(random() * matchedSpecificAds.length)] ?? null;
  }

  const generalAds = ads.filter((ad) => !ad.targetLevels || ad.targetLevels.length === 0);
  if (generalAds.length === 0) {
    return null;
  }

  let adIndex = 0;

  if (config.triggerMode === "levels") {
    const targetLevels = normalizeYouTubeAdTargetLevels(config.targetLevels);
    const targetIndex = targetLevels.indexOf(completedLevelCount);

    if (targetIndex < 0) {
      return null;
    }

    adIndex = targetIndex;
  } else {
    const interval = Math.max(1, Math.min(50, Math.round(config.levelInterval)));
    if (completedLevelCount % interval !== 0) {
      return null;
    }

    adIndex = Math.max(0, Math.floor(completedLevelCount / interval) - 1);
  }

  if (config.selectionMode === "shuffle" && generalAds.length > 1) {
    return generalAds[Math.floor(random() * generalAds.length)] ?? generalAds[0] ?? null;
  }

  return generalAds[adIndex % generalAds.length] ?? null;
}

export function getYouTubeAdUrl(
  config: GameConfig["youtubeAd"],
  completedLevelCount: number,
  random: () => number = Math.random
) {
  return getYouTubeAd(config, completedLevelCount, random)?.url ?? "";
}
