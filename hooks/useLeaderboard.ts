"use client";

import { useEffect, useState } from "react";
import { fetchGameLeaderboard } from "@/lib/game-client";
import type { LeaderboardRow } from "@/lib/types";

const leaderboardLimit = 60;
let cachedRows: LeaderboardRow[] | null = null;
let cachedAt = 0;
let leaderboardPromise: Promise<LeaderboardRow[]> | null = null;
const leaderboardFreshnessMs = 30_000;

function loadLeaderboardRows() {
  if (cachedRows && Date.now() - cachedAt < leaderboardFreshnessMs) {
    return Promise.resolve(cachedRows);
  }

  if (leaderboardPromise) {
    return leaderboardPromise;
  }

  leaderboardPromise = fetchGameLeaderboard(leaderboardLimit)
    .then((data) => {
      cachedRows = data;
      cachedAt = Date.now();
      return data;
    })
    .finally(() => {
      leaderboardPromise = null;
    });

  return leaderboardPromise;
}

export function useLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>(() => cachedRows ?? []);
  const [isLoading, setIsLoading] = useState(() => !cachedRows);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      try {
        const data = await loadLeaderboardRows();
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leaderboard.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    rows,
    isLoading,
    error
  };
}
