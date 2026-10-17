"use client";

import { PlayerCrudWorkspace } from "@/components/admin/PlayerCrudWorkspace";

export default function AdminLeaderboardPage() {
  return (
    <div>
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Rankings</p>
        <h1 className="font-display text-2xl font-black">Leaderboard</h1>
        <p className="mt-1 max-w-3xl text-xs font-semibold text-black/55">
          This board is driven by live Supabase progress and scores. You can inspect ranked players, edit them, reset their runs, or delete a row by deleting the player.
        </p>
      </div>
      <PlayerCrudWorkspace mode="leaderboard" />
    </div>
  );
}
