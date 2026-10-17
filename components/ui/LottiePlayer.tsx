"use client";

import { Sparkles } from "lucide-react";

export function LottiePlayer({ label = "animation" }: { label?: string }) {
  return (
    <div aria-label={label} className="relative grid h-28 w-28 place-items-center rounded-full bg-white/55 shadow-bevel">
      <div className="absolute inset-3 animate-pulseRing rounded-full bg-honey/70" />
      <Sparkles className="relative h-10 w-10 text-ember" />
    </div>
  );
}
