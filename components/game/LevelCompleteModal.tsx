"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LoaderCircle, Star } from "lucide-react";
import { VideoAdOverlay } from "@/components/game/VideoAdOverlay";
import { SlowConnectionNotice } from "@/components/ui/SlowConnectionNotice";
import { t } from "@/lib/i18n";
import { getYouTubeAd } from "@/lib/youtube-ad";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";

interface LevelCompleteModalProps {
  categoryId: string;
  title: string;
  score: number;
  correct: number;
  total: number;
  stars: number;
  categoryComplete: boolean;
  completedLevelCount: number;
}

export function LevelCompleteModal({
  categoryId,
  title,
  score,
  correct,
  total,
  stars,
  categoryComplete,
  completedLevelCount
}: LevelCompleteModalProps) {
  const router = useRouter();
  const language = usePlayerStore((state) => state.language);
  const playerName = usePlayerStore((state) => state.name);
  const avatarUrl = usePlayerStore((state) => state.avatarUrl);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const youtubeAd = useContentStore((state) => state.config.youtubeAd);
  const youtubeAdItem = useMemo(
    () => getYouTubeAd(youtubeAd, completedLevelCount),
    [completedLevelCount, youtubeAd]
  );
  const mapHref = `/category/${categoryId}`;
  const profileImage = avatarUrl && !avatarFailed ? avatarUrl : "/robot-mascot.png";

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/52 p-5 backdrop-blur-md">
      <SlowConnectionNotice
        active={isReturning}
        message={t(language, "slowConnection")}
        className="bottom-24"
      />
      {youtubeAdItem ? (
        <VideoAdOverlay
          config={youtubeAd}
          url={youtubeAdItem.url}
          durationSeconds={youtubeAdItem.durationSeconds}
          onComplete={() => {
            setIsReturning(true);
            router.replace(mapHref);
          }}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 16 }}
          className="level-complete-card w-full max-w-sm rounded-[30px] p-5 text-center shadow-engine"
        >
          <div className="level-complete-avatar mx-auto h-28 w-28 overflow-hidden rounded-full p-1.5 shadow-engine">
            <Image
              src={profileImage}
              alt={avatarUrl && !avatarFailed ? `${playerName ?? "Player"} profile` : "Trivia bot"}
              width={100}
              height={100}
              sizes="100px"
              onError={() => setAvatarFailed(true)}
              className={`h-full w-full rounded-full ${avatarUrl && !avatarFailed ? "object-cover" : "bg-white/80 object-contain p-2"}`}
            />
          </div>
          <h2 className="level-complete-heading mt-3 font-display text-2xl font-black">
            {categoryComplete ? t(language, "categoryClear") : t(language, "levelClear")}
          </h2>
          <p className="level-complete-subtitle mt-1 text-sm font-bold">{title}</p>
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={star <= stars ? "h-8 w-8 fill-honey text-honey" : "level-complete-star-muted h-8 w-8"}
              />
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="level-complete-stat rounded-[18px] p-3 shadow-bevel">
              <div className="level-complete-stat-value font-display text-2xl font-black">{score}</div>
              <div className="level-complete-stat-label text-xs font-black uppercase">{t(language, "score")}</div>
            </div>
            <div className="level-complete-stat rounded-[18px] p-3 shadow-bevel">
              <div className="level-complete-stat-value font-display text-2xl font-black">
                {correct}/{total}
              </div>
              <div className="level-complete-stat-label text-xs font-black uppercase">{t(language, "correctStat")}</div>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Link
              href={mapHref}
              aria-busy={isReturning}
              onClick={() => setIsReturning(true)}
              className="shine-sweep dark-pill flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-xs font-black uppercase"
            >
              {isReturning ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {isReturning ? t(language, "loading") : t(language, "nextMap")}
              {!isReturning ? <ArrowRight className="h-4 w-4" /> : null}
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
