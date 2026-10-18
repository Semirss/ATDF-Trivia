"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FileText, Gift, LoaderCircle, Play } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Category } from "@/lib/types";
import { levelWindowStart } from "@/hooks/useCategoryContent";
import { syncCategoryContent } from "@/hooks/useContentSync";
import { usePlayerStore } from "@/store/playerStore";

export function CategoryCard({ category, index }: { category: Category; index: number }) {
  const router = useRouter();
  const preloadKeyRef = useRef("");
  const [isOpening, setIsOpening] = useState(false);
  const language = usePlayerStore((state) => state.language);
  const levelsCompleted = usePlayerStore(
    (state) => state.progress.find((item) => item.categoryId === category.id)?.levelsCompleted ?? 0
  );
  const cardImageUrl = category.cardBackgroundUrl || category.mapBackgroundUrl || category.iconUrl;
  const curveId = `category-card-curve-${category.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const displayTitle = category.title.replace(/\s*\(Art\.?\s*[^)]*\)\s*$/i, "");

  useEffect(() => {
    if (!isOpening) {
      return;
    }

    const resetTimer = window.setTimeout(() => setIsOpening(false), 12_000);
    return () => window.clearTimeout(resetTimer);
  }, [isOpening]);

  function preloadCategory() {
    const startLevel = levelWindowStart(levelsCompleted);
    const preloadKey = `${category.id}:${startLevel}`;
    if (preloadKeyRef.current === preloadKey) {
      return;
    }

    preloadKeyRef.current = preloadKey;
    void router.prefetch(`/category/${category.id}`);
    void syncCategoryContent({ categoryId: category.id, startLevel, includePrevious: true }).catch(() => {
      preloadKeyRef.current = "";
    });

    for (const imageUrl of [category.cardBackgroundUrl, category.mapBackgroundUrl, category.levelPodiumUrl]) {
      if (imageUrl) {
        const image = new Image();
        image.src = imageUrl;
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotate: index % 2 === 0 ? -1 : 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: index * 0.035, type: "spring", stiffness: 260, damping: 24 }}
      className="h-full min-h-0 min-w-0 max-w-full"
    >
      <Link
        href={`/category/${category.id}`}
        prefetch
        aria-busy={isOpening}
        data-analytics-id="category-card"
        data-analytics-label={`Category ${category.title}`}
        onPointerEnter={preloadCategory}
        onPointerDown={(event) => {
          preloadCategory();
          if (event.pointerType === "touch" || event.pointerType === "pen") {
            setIsOpening(true);
          }
        }}
        onPointerCancel={() => setIsOpening(false)}
        onClick={() => setIsOpening(true)}
        onFocus={preloadCategory}
        className="category-card pressable relative flex h-full w-full min-w-0 max-w-full overflow-hidden"
        style={{ "--category-color": category.colorHex } as CSSProperties}
      >
        <svg className="category-card-curve-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={curveId} clipPathUnits="objectBoundingBox">
              <path d="M 0 0.22 C 0.20 0.31, 0.39 0.44, 0.56 0.33 C 0.72 0.22, 0.88 0.035, 1 0.065 L 1 1 L 0 1 Z" />
            </clipPath>
          </defs>
        </svg>
        <div className="category-card-body">
          <header className="category-card-header">
            <div className="category-card-heading">
              {category.iconUrl ? (
                <img
                  src={category.iconUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="category-card-icon"
                />
              ) : (
                <FileText className="category-card-icon" strokeWidth={2.4} aria-hidden="true" />
              )}
              <h2 className="category-card-title">{displayTitle}</h2>
            </div>
            <div className="category-card-actions">
              {category.isRewardBased ? <Gift className="category-card-gift" aria-label="Prize category" /> : null}
              <ChevronRight className="category-card-chevron" aria-hidden="true" />
            </div>
          </header>

          <div className="category-card-media" style={{ clipPath: `url(#${curveId})` }}>
            {cardImageUrl ? (
              <img src={cardImageUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="category-card-media-fallback" aria-hidden="true" />
            )}
            <span className="category-play-button">
              {isOpening ? (
                <>
                  <LoaderCircle className="category-play-loader animate-spin" aria-hidden="true" />
                  {t(language, "loading")}
                </>
              ) : (
                <>
                  <Play className="category-play-icon fill-current" />
                  {t(language, "play")}
                </>
              )}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
