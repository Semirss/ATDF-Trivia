"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Lightbulb, ShieldCheck } from "lucide-react";
import { CategoryCard } from "@/components/game/CategoryCard";
import { DonationModal } from "@/components/game/DonationModal";
import { PartnerLogoStrip } from "@/components/game/PartnerLogoStrip";
import { PlayIntroScene } from "@/components/game/PlayIntroScene";
import { PageTransition } from "@/components/ui/PageTransition";
import { useCategories } from "@/hooks/useCategories";
import { markHomeSplashSeen, shouldShowHomeSplash } from "@/lib/home-splash";
import { t } from "@/lib/i18n";
import { syncTelegramPlayerFromWebApp } from "@/lib/telegram-player";
import { isTelegramMiniApp } from "@/lib/telegram-webapp";
import { isUuid } from "@/lib/utils";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";

const PlayerAccountModal = dynamic(
  () => import("@/components/game/PlayerAccountModal").then((module) => module.PlayerAccountModal),
  { ssr: false }
);

export default function HomePage() {
  const router = useRouter();
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introChecked, setIntroChecked] = useState(false);
  const [isIntroLoading, setIsIntroLoading] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);
  const categories = useCategories();
  const contentLoaded = useContentStore((state) => state.isLoaded);
  const contentError = useContentStore((state) => state.error);
  const levels = useContentStore((state) => state.levels);
  const name = usePlayerStore((state) => state.name);
  const playerId = usePlayerStore((state) => state.playerId);
  const accountEmail = usePlayerStore((state) => state.accountEmail);
  const telegramPhone = usePlayerStore((state) => state.telegramPhone);
  const source = usePlayerStore((state) => state.source);
  const rewardProfiles = usePlayerStore((state) => state.rewardProfiles);
  const progress = usePlayerStore((state) => state.progress);
  const language = usePlayerStore((state) => state.language);
  const hasVerification = Boolean(playerId && rewardProfiles.some((profile) => profile.playerId === playerId));
  const hasProgressLogin = Boolean(accountEmail || source === "telegram");
  const completedLevels = progress
    .filter((item) => item.playerId === playerId)
    .reduce((sum, item) => sum + item.levelsCompleted, 0);
  const totalLevels = levels.filter((level) => level.isActive).length;
  const completionPercent = totalLevels > 0 ? Math.min(100, Math.round((completedLevels / totalLevels) * 100)) : 0;
  const displayName = name?.trim().split(/\s+/)[0] || t(language, "newChallenger");

  useEffect(() => {
    setShowIntro(shouldShowHomeSplash());
    setIntroChecked(true);
  }, []);

  if (!introChecked) {
    return <div className="h-full w-full bg-[#002b45]" aria-hidden="true" />;
  }

  if (showIntro) {
    return (
      <PlayIntroScene
        isLoading={isIntroLoading}
        onPlay={async () => {
          markHomeSplashSeen();
          if (!usePlayerStore.getState().isLoaded) {
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(resolve, 500);
              const unsubscribe = usePlayerStore.subscribe((state) => {
                if (state.isLoaded) {
                  clearTimeout(timeout);
                  unsubscribe();
                  resolve();
                }
              });
            });
          }

          const latestName = usePlayerStore.getState().name;
          const latestPlayerId = usePlayerStore.getState().playerId;
          if ((name || latestName) && (playerId || latestPlayerId)) {
            setShowIntro(false);
            return;
          }

          if (isTelegramMiniApp() && !(latestPlayerId && isUuid(latestPlayerId))) {
            setIsIntroLoading(true);
            try {
              await syncTelegramPlayerFromWebApp({ requestPhone: false });
            } catch {
              // Onboarding handles an unavailable Telegram identity.
            } finally {
              setIsIntroLoading(false);
            }
            if (usePlayerStore.getState().playerId) {
              setShowIntro(false);
              return;
            }
          }

          if (usePlayerStore.getState().name) setShowIntro(false);
          else router.push("/onboarding");
        }}
      />
    );
  }

  return (
    <PageTransition>
      <div className="game-safe home-safe" data-pull-scroll="true">
        {verificationOpen ? <PlayerAccountModal initialMode="create" onClose={() => setVerificationOpen(false)} /> : null}
        {donationOpen ? (
          <DonationModal
            playerId={playerId}
            donorName={name}
            donorEmail={accountEmail}
            donorPhone={telegramPhone}
            onClose={() => setDonationOpen(false)}
          />
        ) : null}

        <section className="home-reference-hero" aria-label={`${t(language, "sloganLearn")}, ${t(language, "sloganPlay")}, ${t(language, "sloganBuildStronger")} ${t(language, "sloganAfrica")}`}>
          <button type="button" onClick={() => setDonationOpen(true)} className="home-tip-button">
            <Lightbulb className="h-5 w-5" strokeWidth={2.4} />
            <span>{t(language, "tipAction")}</span>
          </button>
          <p className="home-slogan">
            <span>{t(language, "sloganLearn")}</span>
            <span>{t(language, "sloganPlay")}</span>
            <span>{t(language, "sloganBuildStronger")}</span>
            <span>{t(language, "sloganAfrica")}</span>
          </p>
          <Image
            src="/visuals/atdf-2026-seal-optimized.png"
            alt="ATDF 2026"
            width={124}
            height={124}
            priority
            className="home-atdf-seal"
          />
        </section>

        <main className="home-content-sheet">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="home-main-title"
          >
            <span>{t(language, "triviaTitle")}</span> <em>{t(language, "gamesTitle")}</em>
          </motion.h1>

          <button
            type="button"
            onClick={() => !hasProgressLogin && setVerificationOpen(true)}
            className="home-progress-card"
          >
            <span className="home-player-initial">{displayName.charAt(0).toUpperCase()}</span>
            <span className="home-progress-copy">
              <strong>{displayName}</strong>
              <small>{hasVerification ? t(language, "verifiedPlayer") : t(language, "continueLearningJourney")}</small>
              <span className="home-progress-track">
                <i style={{ width: `${Math.max(completionPercent, 7)}%` }} />
              </span>
            </span>
            <span className="home-progress-value">
              <ChevronRight className="h-5 w-5" />
              <strong>{completionPercent}%</strong>
            </span>
            {hasProgressLogin ? <ShieldCheck className="home-progress-shield h-4 w-4" /> : null}
          </button>

          <section className="home-sponsors">
            <p>{t(language, "ourSponsors")}</p>
            <PartnerLogoStrip />
          </section>

          <section className="home-category-grid category-grid">
            {!contentLoaded ? <div className="home-state-card">{t(language, "loadingCategories")}</div> : null}
            {contentError ? <div className="home-state-card home-state-error">{contentError}</div> : null}
            {categories.map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))}
          </section>
        </main>
      </div>
    </PageTransition>
  );
}
