"use client";

import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { Fragment, useEffect } from "react";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { BottomNav } from "@/components/ui/BottomNav";
import { GameTopBar } from "@/components/game/GameTopBar";
import { TelegramAccountGate } from "@/components/game/TelegramAccountGate";
import { AgePromptModal } from "@/components/game/AgePromptModal";
import { rememberInitialGamePath } from "@/lib/home-splash";
import { SoundManager } from "@/lib/sounds";
import { useAnalyticsTracking } from "@/hooks/useAnalyticsTracking";
import { useGameContentSync } from "@/hooks/useContentSync";
import { useMessageRealtime } from "@/hooks/useMessageRealtime";
import { usePlayerSync } from "@/hooks/usePlayerSync";
import { useTelegramViewport } from "@/hooks/useTelegramViewport";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useAnalyticsTracking();
  useTelegramViewport();
  useGameContentSync();
  usePlayerSync();
  const isMapPage = /^\/category\/[^/]+$/.test(pathname);
  const isMessagesPage = pathname === "/messages";
  useMessageRealtime(!isMessagesPage);
  const isLeaderboardPage = pathname === "/leaderboard";
  const isSettingsPage = pathname === "/settings";
  const hideTopBar = pathname.includes("/play") || pathname === "/onboarding" || isMapPage || isLeaderboardPage || isSettingsPage;
  const hideNav = pathname.includes("/play") || pathname === "/onboarding";

  useEffect(() => {
    rememberInitialGamePath(pathname);
  }, [pathname]);

  useEffect(() => {
    void SoundManager.boot();
    void SoundManager.startBg();

    return () => {
      void SoundManager.stopBg();
    };
  }, []);

  return (
    <main className="game-viewport">
      <section className={`phone-stage ${isMessagesPage ? "phone-stage-chat" : ""}`}>
        {!hideTopBar ? <GameTopBar /> : null}
        {isMessagesPage ? (
          <AnimatePresence initial={false} mode="sync">
            <Fragment key={pathname}>{children}</Fragment>
          </AnimatePresence>
        ) : (
          <PullToRefresh>
            <AnimatePresence initial={false} mode="sync">
              <Fragment key={pathname}>{children}</Fragment>
            </AnimatePresence>
          </PullToRefresh>
        )}
        <TelegramAccountGate />
        <AgePromptModal />
        {!hideNav ? <BottomNav /> : null}
      </section>
    </main>
  );
}
