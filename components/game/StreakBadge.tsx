"use client";

import { Flame } from "lucide-react";

export function StreakBadge({ streak, triggerAt }: { streak: number; triggerAt: number }) {
  if (streak < triggerAt) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-black/82 px-3 py-2 text-xs font-black uppercase text-white shadow-bevel">
      <Flame className="h-4 w-4 fill-ember text-ember" />
      Combo x{streak}
    </div>
  );
}
