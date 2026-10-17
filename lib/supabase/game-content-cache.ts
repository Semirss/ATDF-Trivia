import "server-only";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { fetchGameCoreContent, fetchLeaderboard } from "@/lib/supabase/game-data";

const gameContentTag = "game-core-content";
const leaderboardTag = "game-leaderboard";

export const fetchCachedGameCoreContent = unstable_cache(
  fetchGameCoreContent,
  ["game-core-content-v1"],
  {
    revalidate: 300,
    tags: [gameContentTag]
  }
);

export const fetchCachedLeaderboard = unstable_cache(
  async (limit?: number) => fetchLeaderboard(limit),
  ["game-leaderboard-v2"],
  {
    revalidate: 30,
    tags: [leaderboardTag]
  }
);

export function invalidateLeaderboardCache() {
  revalidateTag(leaderboardTag);
  revalidatePath("/api/game/leaderboard");
}

export function invalidateGameContentCache() {
  revalidateTag(gameContentTag);
  revalidatePath("/api/game/content");
  invalidateLeaderboardCache();
}
