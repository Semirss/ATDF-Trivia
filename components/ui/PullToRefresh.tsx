"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { syncGameContent, syncRecentMessages } from "@/hooks/useContentSync";
import { syncPlayerSnapshot } from "@/hooks/usePlayerSync";

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const canPullRef = useRef(false);
  const draggingRef = useRef(false);
  const controls = useAnimation();

  const THRESHOLD = 80;
  const START_THRESHOLD = 12;

  /** Walk up from a touch target and return the scrollTop of the nearest
   *  scrollable ancestor (or 0 if there is none). This lets us skip
   *  pull-to-refresh when the user is inside an element that has its own
   *  vertical scroll (e.g. the level map). */
  function getAncestorScrollTop(target: EventTarget | null): number {
    let el = target as HTMLElement | null;
    while (el && el !== containerRef.current) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
        return el.scrollTop;
      }
      el = el.parentElement;
    }
    return 0;
  }

  function canStartPull(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) {
      return false;
    }

    if (el.closest("button, a, input, textarea, select, label, [role='button'], [data-no-pull='true']")) {
      return false;
    }

    return Boolean(el.closest("[data-pull-scroll='true']"));
  }

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      canPullRef.current = canStartPull(e.target) && getAncestorScrollTop(e.target) <= 0;
      draggingRef.current = false;
      currentYRef.current = 0;

      if (!canPullRef.current) {
        startXRef.current = 0;
        startYRef.current = 0;
        return;
      }

      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPullRef.current || startYRef.current <= 0 || isRefreshing) {
        return;
      }

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const deltaX = Math.abs(x - startXRef.current);
      const deltaY = y - startYRef.current;

      if (deltaY <= 0 || deltaY < START_THRESHOLD || deltaX > deltaY * 0.85) {
        return;
      }

      if (e.cancelable) e.preventDefault();

      draggingRef.current = true;
      currentYRef.current = deltaY;
      const pullDistance = Math.min(deltaY * 0.38, THRESHOLD + 16);
      controls.set({ y: pullDistance });
    };

    const handleTouchEnd = async () => {
      if (draggingRef.current && currentYRef.current > 0 && !isRefreshing) {
        if (currentYRef.current >= THRESHOLD) {
          setIsRefreshing(true);
          await controls.start({ y: 56 });

          try {
            await Promise.all([
              syncGameContent({ force: true }),
              syncRecentMessages({ force: true }),
              syncPlayerSnapshot(undefined, { force: true })
            ]);
          } finally {
            setIsRefreshing(false);
          }
        }

        await controls.start({ y: 0 });
      }

      canPullRef.current = false;
      draggingRef.current = false;
      startXRef.current = 0;
      startYRef.current = 0;
      currentYRef.current = 0;
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [controls, isRefreshing]);

  return (
    <div suppressHydrationWarning ref={containerRef} className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <motion.div
        suppressHydrationWarning
        animate={controls}
        initial={{ y: 0 }}
        className="absolute left-0 right-0 top-0 z-50 flex items-center justify-center"
        style={{ top: "-56px" }}
      >
        <div suppressHydrationWarning className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-black shadow-bevel backdrop-blur-md">
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin text-black" : "text-black/50"}`} />
        </div>
      </motion.div>
      <motion.div suppressHydrationWarning animate={controls} initial={{ y: 0 }} className="min-h-0 flex-1">
        {children}
      </motion.div>
    </div>
  );
}
