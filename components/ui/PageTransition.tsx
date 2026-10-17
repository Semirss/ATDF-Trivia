"use client";

import { motion } from "framer-motion";

export function PageTransition({
  children,
  instant = false
}: {
  children: React.ReactNode;
  instant?: boolean;
}) {
  return (
    <motion.div
      initial={instant ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.996 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={instant ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -4, scale: 0.998 }}
      transition={instant ? { duration: 0.01 } : { duration: 0.12, ease: "easeOut" }}
      className="h-full min-h-full"
    >
      {children}
    </motion.div>
  );
}
