"use client";

import { useEffect, useState } from "react";
import { fetchGameLeaderboard, fetchGameLeaderboardRow } from "@/lib/game-client";
import type { LeaderboardRow } from "@/lib/types";

const leaderboardLimit = 30;
let cachedRows: LeaderboardRow[] | null = null;
let cachedAt = 0;
let leaderboardPromise: Promise<LeaderboardRow[]> | null = null;
const cachedOwnRows = new Map<string, LeaderboardRow | null>();
const ownRowPromises = new Map<string, Promise<LeaderboardRow | null>>();
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

function loadOwnLeaderboardRow(playerId: string) {
  if (cachedOwnRows.has(playerId)) {
    return Promise.resolve(cachedOwnRows.get(playerId) ?? null);
  }

  const pending = ownRowPromises.get(playerId);
  if (pending) {
    return pending;
  }

  const promise = fetchGameLeaderboardRow(playerId)
    .then((row) => {
      cachedOwnRows.set(playerId, row);
      return row;
    })
    .finally(() => {
      ownRowPromises.delete(playerId);
    });

  ownRowPromises.set(playerId, promise);
  return promise;
}

export function useLeaderboard(playerId?: string) {
  const [rows, setRows] = useState<LeaderboardRow[]>(() => cachedRows ?? []);
  const [ownRow, setOwnRow] = useState<LeaderboardRow | null>(() =>
    playerId ? cachedRows?.find((row) => row.playerId === playerId) ?? cachedOwnRows.get(playerId) ?? null : null
  );
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

  useEffect(() => {
    if (!playerId) {
      setOwnRow(null);
      return;
    }

    const listedRow = rows.find((row) => row.playerId === playerId);
    if (listedRow) {
      cachedOwnRows.set(playerId, listedRow);
      setOwnRow(listedRow);
      return;
    }

    let cancelled = false;
    setOwnRow(cachedOwnRows.get(playerId) ?? null);

    void loadOwnLeaderboardRow(playerId).then((row) => {
      if (!cancelled) {
        setOwnRow(row);
      }
    }).catch(() => {
      // The main leaderboard remains usable if only the personal row fails.
    });

    return () => {
      cancelled = true;
    };
  }, [playerId, rows]);

  return {
    rows,
    ownRow,
    isLoading,
    error
  };
}
