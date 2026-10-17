"use client";

import { motion } from "framer-motion";

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const width = total <= 0 ? 0 : ((current + 1) / total) * 100;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/12">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-honey via-ember to-berry"
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      />
    </div>
  );
}
