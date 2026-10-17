"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle } from "lucide-react";

export function SlowConnectionNotice({
  active,
  message,
  delayMs = 1200,
  className = "bottom-24"
}: {
  active: boolean;
  message: string;
  delayMs?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);

    if (!active) {
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return (
    <AnimatePresence>
      {visible ? (
        <div className={`pointer-events-none absolute left-1/2 z-[70] -translate-x-1/2 ${className}`}>
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            role="status"
            aria-live="polite"
            className="flex max-w-[min(310px,calc(100vw-32px))] items-center gap-2 whitespace-nowrap rounded-full border border-white/60 bg-black/[0.78] px-3 py-2 text-[11px] font-bold text-white shadow-engine backdrop-blur-md"
          >
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            <span>{message}</span>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
