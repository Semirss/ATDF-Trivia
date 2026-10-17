"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { syncCategoryContent, type CategoryContentMeta } from "@/hooks/useContentSync";
import { usePlayerStore } from "@/store/playerStore";

const categoryPageSize = 5;

export function levelWindowStart(levelsCompleted: number) {
  return Math.floor(Math.max(0, levelsCompleted) / categoryPageSize) * categoryPageSize + 1;
}

export function useCategoryContent(
  categoryId: string,
  {
    levelId,
    enabled = true,
    includePrevious = false
  }: { levelId?: string | null; enabled?: boolean; includePrevious?: boolean } = {}
) {
  const levelsCompleted = usePlayerStore(
    (state) => state.progress.find((item) => item.categoryId === categoryId)?.levelsCompleted ?? 0
  );
  const requestedStart = useMemo(() => levelWindowStart(levelsCompleted), [levelsCompleted]);
  const requestKey = `${categoryId}:${levelId ?? `start-${requestedStart}`}:${includePrevious ? "history" : "window"}`;
  const [meta, setMeta] = useState<CategoryContentMeta>({
    startLevel: requestedStart,
    limit: categoryPageSize,
    totalLevels: 0,
    hasPrevious: requestedStart > 1,
    hasMore: false
  });
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  useEffect(() => {
    if (!enabled || !categoryId) {
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setMeta((current) => ({ ...current, startLevel: requestedStart }));

    void syncCategoryContent({
      categoryId,
      startLevel: requestedStart,
      levelId,
      includePrevious,
      limit: categoryPageSize,
      force: retryCount > 0
    })
      .then((nextMeta) => {
        if (active) {
          setMeta(nextMeta);
          setLoadedKey(requestKey);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load this map.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [categoryId, enabled, includePrevious, levelId, requestKey, requestedStart, retryCount]);

  const isReady = enabled && loadedKey === requestKey && !error && !isLoading;

  return {
    ...meta,
    isLoading: enabled && !error && (!isReady || isLoading),
    isReady,
    error,
    retry
  };
}
