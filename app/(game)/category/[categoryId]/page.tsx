"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { LevelMap } from "@/components/game/LevelMap";
import { PageTransition } from "@/components/ui/PageTransition";
import { SlowConnectionNotice } from "@/components/ui/SlowConnectionNotice";
import { useCategoryContent } from "@/hooks/useCategoryContent";
import { useLevelMap } from "@/hooks/useLevelMap";
import { t } from "@/lib/i18n";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";

export default function CategoryMapPage({ params }: { params: { categoryId: string } }) {
  const isLoaded = useContentStore((state) => state.isLoaded);
  const categories = useContentStore((state) => state.categories);
  const category = categories.find((item) => item.id === params.categoryId);
  const categoryContent = useCategoryContent(params.categoryId, { enabled: isLoaded, includePrevious: true });
  const levels = useLevelMap(params.categoryId, {
    startLevel: 1,
    limit: categoryContent.startLevel + categoryContent.limit - 1
  });
  const progress = usePlayerStore((state) => state.progress);
  const language = usePlayerStore((state) => state.language);
  const totalScore = useMemo(() => progress.reduce((sum, item) => sum + item.score, 0), [progress]);

  if (!isLoaded && !category) {
    return (
      <PageTransition instant>
        <div className="game-safe grid min-h-full place-items-center">
          <div className="glass-panel rounded-[26px] p-5 text-center font-black">{t(language, "loadingCategory")}</div>
        </div>
      </PageTransition>
    );
  }

  if (!category) {
    return (
      <PageTransition instant>
        <div className="game-safe grid min-h-full place-items-center">
          <div className="glass-panel rounded-[26px] p-5 text-center">
            <h1 className="font-display text-2xl font-black">{t(language, "categoryMissing")}</h1>
            <Link href="/" className="dark-pill mt-4 inline-flex rounded-[16px] px-4 py-2.5 text-xs font-black uppercase">
              {t(language, "home")}
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (categoryContent.isLoading) {
    return (
      <PageTransition instant>
        <div className="game-safe relative grid min-h-full place-items-center">
          <div className="glass-panel rounded-[26px] p-5 text-center font-black">{t(language, "loadingMap")}</div>
          <SlowConnectionNotice active message={t(language, "slowConnection")} className="bottom-24" />
        </div>
      </PageTransition>
    );
  }

  if (categoryContent.error) {
    return (
      <PageTransition instant>
        <div className="game-safe grid min-h-full place-items-center">
          <div className="glass-panel rounded-[26px] p-5 text-center">
            <p className="text-sm font-bold text-black/65">{categoryContent.error}</p>
            <button
              type="button"
              onClick={categoryContent.retry}
              className="dark-pill mt-4 rounded-[16px] px-4 py-2.5 text-xs font-black uppercase"
            >
              {t(language, "retry")}
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition instant>
      <div className="relative h-full overflow-hidden">
        <Link
          href="/"
          className="map-category-back"
          aria-label={t(language, "home")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="map-score pointer-events-none absolute right-4 z-20">
          <div className="map-score-card rounded-[18px] px-4 py-2 text-right">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-white/55">{t(language, "score")}</span>
            <span className="font-display text-2xl font-black leading-none">{totalScore}</span>
          </div>
        </div>
        <div className="absolute inset-0">
          <LevelMap
            categoryId={category.id}
            colorHex={category.colorHex}
            levels={levels}
            totalLevels={categoryContent.totalLevels}
            backgroundImageUrl={category.mapBackgroundUrl}
            podiumImageUrl={category.levelPodiumUrl}
          />
        </div>
      </div>
    </PageTransition>
  );
}
