"use client";

import { motion } from "framer-motion";

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const width = total <= 0 ? 0 : ((current + 1) / total) * 100;

  return (
    <div className="play-progress-track h-2 overflow-hidden rounded-full">
      <motion.div
        className="play-progress-fill h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      />
    </div>
  );
}
