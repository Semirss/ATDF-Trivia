"use client";

import { PlayerCrudWorkspace } from "@/components/admin/PlayerCrudWorkspace";

export default function AdminPlayersPage() {
  return (
    <div>
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Players</p>
        <h1 className="font-display text-2xl font-black">Players</h1>
        <p className="mt-1 max-w-3xl text-xs font-semibold text-black/55">
          Create, update, reset, or remove live player records and inspect their real category progress, messages, and reward verification data.
        </p>
      </div>
      <PlayerCrudWorkspace mode="players" />
    </div>
  );
}
