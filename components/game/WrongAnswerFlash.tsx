"use client";

import { AnimatePresence, motion } from "framer-motion";

export function WrongAnswerFlash({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 bg-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.28, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.34 }}
        />
      ) : null}
    </AnimatePresence>
  );
}
