"use client";

import { useEffect } from "react";
import { isUuid } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";
import type { PlayerSnapshot } from "@/lib/types";

const playerSyncFreshnessMs = 30_000;
const playerSyncPromises = new Map<string, Promise<void>>();
const lastPlayerSyncAt = new Map<string, number>();

export function syncPlayerSnapshot(
  playerId = usePlayerStore.getState().playerId,
  { force = false }: { force?: boolean } = {}
) {
  if (!playerId) {
    return Promise.resolve();
  }

  if (!isUuid(playerId)) {
    usePlayerStore.getState().clearProfile();
    return Promise.resolve();
  }

  if (
    !force &&
    (lastPlayerSyncAt.get(playerId) ?? 0) > 0 &&
    Date.now() - (lastPlayerSyncAt.get(playerId) ?? 0) < playerSyncFreshnessMs
  ) {
    return Promise.resolve();
  }

  const activeSync = playerSyncPromises.get(playerId);
  if (activeSync) {
    return activeSync;
  }

  const syncPromise = (async () => {
    try {
      const response = await fetch(`/api/game/player?playerId=${encodeURIComponent(playerId)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        if (response.status === 404) {
          usePlayerStore.getState().clearProfile();
        }
        return;
      }

      const payload = (await response.json()) as { data: PlayerSnapshot };
      usePlayerStore.getState().hydrateSnapshot(payload.data);
      lastPlayerSyncAt.set(playerId, Date.now());
    } finally {
      playerSyncPromises.delete(playerId);
    }
  })();

  playerSyncPromises.set(playerId, syncPromise);
  return syncPromise;
}

export function usePlayerSync() {
  const playerId = usePlayerStore((state) => state.playerId);

  useEffect(() => {
    function refreshWhenVisible() {
      if (!document.hidden) {
        void syncPlayerSnapshot(playerId).catch((error) => console.error("Unable to refresh player", error));
      }
    }

    void syncPlayerSnapshot(playerId).catch((error) => console.error("Unable to load player", error));
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [playerId]);
}
