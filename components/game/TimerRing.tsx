"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function TimerRing({ timeRemaining, total }: { timeRemaining: number; total: number }) {
  const radius = 47;
  const circumference = 2 * Math.PI * radius;
  const safeTimeRemaining = Math.max(0, Math.ceil(timeRemaining));
  const progress = total <= 0 ? 0 : Math.min(1, safeTimeRemaining / total);
  const dashOffset = circumference * (1 - progress);
  const urgent = safeTimeRemaining <= 5;

  return (
    <div className="timer-ring relative grid place-items-center">
      <svg viewBox="0 0 120 120" className={cn("absolute inset-0", urgent && "animate-pulse")}>
        <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.75)" strokeWidth="12" fill="none" />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          stroke={urgent ? "#ff4d4d" : "#f2b84b"}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="timer-core grid place-items-center rounded-full bg-black/80 text-white shadow-bevel">
        <span className="font-display text-xl font-black">{safeTimeRemaining}</span>
      </div>
    </div>
  );
}
