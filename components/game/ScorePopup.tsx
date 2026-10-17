"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";

export interface ScoreFlight {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  points: number;
}

const starTrail = [
  { startX: -18, startY: -10, endX: -14, endY: 1, arcX: -42, arcY: -64, size: "h-4 w-4", rotate: 220, delay: 0 },
  { startX: 2, startY: -18, endX: 10, endY: -8, arcX: 22, arcY: -92, size: "h-5 w-5", rotate: 310, delay: 0.04 },
  { startX: 20, startY: 0, endX: 18, endY: 8, arcX: 54, arcY: -56, size: "h-4 w-4", rotate: 250, delay: 0.08 },
  { startX: -6, startY: 18, endX: -2, endY: 14, arcX: -14, arcY: -36, size: "h-3.5 w-3.5", rotate: 180, delay: 0.12 },
  { startX: 28, startY: -14, endX: 2, endY: -18, arcX: 70, arcY: -100, size: "h-3 w-3", rotate: 380, delay: 0.15 }
];

export function ScorePopup({ flight, onComplete }: { flight: ScoreFlight | null; onComplete: (id: string) => void }) {
  const midX = flight ? (flight.fromX + flight.toX) / 2 : 0;
  const midY = flight ? Math.min(flight.fromY, flight.toY) - 72 : 0;

  return (
    <AnimatePresence>
      {flight ? (
        <div key={flight.id} className="pointer-events-none fixed inset-0 z-[90]">
          {starTrail.map((star, index) => (
            <motion.span
              key={index}
              initial={{
                opacity: 0,
                x: flight.fromX + star.startX,
                y: flight.fromY + star.startY,
                scale: 0.36,
                rotate: 0
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [flight.fromX + star.startX, midX + star.arcX, flight.toX + star.endX],
                y: [flight.fromY + star.startY, midY + star.arcY, flight.toY + star.endY],
                scale: [0.36, 1.16, 0.78, 0.25],
                rotate: star.rotate
              }}
              transition={{ duration: 0.92, delay: star.delay, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-0 text-honey drop-shadow-[0_4px_10px_rgba(0,0,0,0.28)]"
            >
              <Star className={`${star.size} fill-current`} />
            </motion.span>
          ))}
          <motion.div
            initial={{ opacity: 0, x: flight.fromX - 16, y: flight.fromY - 16, scale: 0.42, rotate: -18 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [flight.fromX - 16, midX - 22, flight.toX - 18],
              y: [flight.fromY - 16, midY - 92, flight.toY - 18],
              scale: [0.42, 1.18, 0.86, 0.28],
              rotate: 360
            }}
            transition={{ duration: 1.02, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => onComplete(flight.id)}
            className="absolute left-0 top-0 flex items-center gap-1 rounded-full bg-honey px-2.5 py-1 font-display text-sm font-black text-black shadow-engine"
          >
            <Star className="h-4 w-4 fill-current" />
            +{flight.points}
          </motion.div>
          <motion.span
            initial={{ opacity: 0, x: flight.toX - 24, y: flight.toY - 24, scale: 0.15 }}
            animate={{ opacity: [0, 0, 0.8, 0], scale: [0.15, 0.15, 1.55, 2.1] }}
            transition={{ duration: 0.52, delay: 0.62, ease: "easeOut" }}
            className="absolute left-0 top-0 h-12 w-12 rounded-full border-2 border-honey"
          />
        </div>
      ) : null}
    </AnimatePresence>
  );
}
