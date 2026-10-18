"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LoaderCircle, LockKeyhole, MapPinned, Play, RotateCcw, Star } from "lucide-react";
import { SlowConnectionNotice } from "@/components/ui/SlowConnectionNotice";
import { t } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/i18n";
import { hexToRgba } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

type LevelStatus = "completed" | "current" | "locked";

interface LevelMapItem {
  id: string;
  levelNumber: number;
  title: string;
  difficulty: string;
  questionCount: number;
  activeQuestionCount: number;
  status: LevelStatus;
  earnedStars: number;
  savedSession: boolean;
}

function makePoint(index: number) {
  return [index % 2 === 0 ? 112 : 228, index] as const;
}

const difficultyLabels = {
  easy: "difficultyEasy",
  medium: "difficultyMedium",
  hard: "difficultyHard"
} as const;

function formatDifficulty(language: AppLanguage, difficulty: string) {
  const key = difficultyLabels[difficulty.toLowerCase() as keyof typeof difficultyLabels];
  return key ? t(language, key) : difficulty;
}

export function LevelMap({
  categoryId,
  colorHex,
  levels,
  totalLevels,
  backgroundImageUrl,
  podiumImageUrl
}: {
  categoryId: string;
  colorHex: string;
  levels: LevelMapItem[];
  totalLevels: number;
  backgroundImageUrl?: string;
  podiumImageUrl?: string;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [openingLevelId, setOpeningLevelId] = useState<string | null>(null);
  const [showJourneyShortcut, setShowJourneyShortcut] = useState(true);
  const language = usePlayerStore((state) => state.language);
  const lastVisibleLevel = levels.at(-1)?.levelNumber ?? 0;
  const remainingLevelCount = Math.max(0, totalLevels - lastVisibleLevel);
  const futureStartLevel = lastVisibleLevel + 1;
  const futureChapters = Array.from(
    { length: Math.min(4, Math.ceil(remainingLevelCount / 5)) },
    (_, index) => {
      const start = futureStartLevel + index * 5;
      return { start, end: Math.min(start + 4, totalLevels) };
    }
  );
  const levelGap = 178;
  const mapHeight = Math.max(720, levels.length * levelGap + 220 + (remainingLevelCount > 0 ? 95 : 0));
  const points = levels.map((_, index) => {
    const [x] = makePoint(index);
    return [x, mapHeight - 112 - index * levelGap] as const;
  });
  const playableLevel = levels.find((level) => level.status === "current" && level.activeQuestionCount >= level.questionCount);
  const currentLevelIndex = Math.max(0, levels.findIndex((level) => level.status === "current"));
  const currentPointY = points[currentLevelIndex]?.[1] ?? mapHeight;
  // pb-32 = 128px padding; translate(-50%,-50%) shifts the node 64px higher than the computed y.
  // Subtract that amount so the path tips land on the visual circle center.
  const PB_OFFSET = 64;
  const path = points
    .map(([x, y], index) => {
      const py = y - PB_OFFSET;
      if (index === 0) return `M ${x} ${py}`;
      const [prevX, prevY] = points[index - 1];
      const prevPy = prevY - PB_OFFSET;
      const controlY = (py + prevPy) / 2;
      return `C ${prevX} ${controlY}, ${x} ${controlY}, ${x} ${py}`;
    })
    .join(" ");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        const targetTop = currentPointY - scrollRef.current.clientHeight * 0.56;
        const maxTop = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        scrollRef.current.scrollTop = Math.max(0, Math.min(targetTop, maxTop));
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [categoryId, currentPointY, levels.length, mapHeight]);

  useEffect(() => {
    if (!playableLevel) {
      return;
    }

    const timer = window.setTimeout(() => {
      void router.prefetch(`/category/${categoryId}/play?level=${playableLevel.id}`);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [categoryId, playableLevel, router]);

  return (
    <div className="relative h-full overflow-hidden bg-[#022b46]">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: backgroundImageUrl
            ? `linear-gradient(rgba(0,31,53,0.08), rgba(0,31,53,0.16)), url(${backgroundImageUrl})`
            : `radial-gradient(circle at 72% 16%, ${hexToRgba(colorHex, 0.28)}, transparent 14rem), radial-gradient(circle at 20% 72%, rgba(255,180,200,0.34), transparent 12rem), linear-gradient(180deg,#dfe7e5,#d4dad7)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      />
      <div
        ref={scrollRef}
        data-pull-scroll="true"
        onScroll={(event) => setShowJourneyShortcut(event.currentTarget.scrollTop > 140)}
        className="level-map-scroll relative z-10 h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="relative overflow-hidden"
          style={{
            height: `max(${mapHeight}px, 100%)`,
            minHeight: "100%"
          }}
        >
          <svg
            className="absolute inset-x-0 top-0 h-full w-full"
            viewBox={`0 0 340 ${mapHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <motion.path
              d={path}
              fill="none"
              stroke={hexToRgba(colorHex, 0.42)}
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            <motion.path
              d={path}
              fill="none"
              stroke="rgba(251,248,236,0.9)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.15 }}
            />
          </svg>

          {futureChapters.length > 0 ? (
            <div
              className="absolute left-1/2 top-4 z-10 w-[min(17.5rem,calc(100%-2rem))] -translate-x-1/2"
              aria-label={`${remainingLevelCount} ${t(language, "moreLevels")}, ${t(language, "levelShort")}${futureStartLevel}–${totalLevels}`}
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.45, duration: 0.35, ease: "easeOut" }}
                className="px-3 pt-1 text-ink"
              >
                <div className="flex items-center justify-center gap-2">
                  <MapPinned className="h-5 w-5" style={{ color: colorHex }} />
                  <p className="font-display text-xl font-black tracking-[-0.03em]">
                    {t(language, "levelShort")}{futureStartLevel}–{totalLevels}
                  </p>
                </div>
                <div className="relative mt-3 flex items-start gap-1.5">
                  <div className="absolute left-3 right-3 top-2 h-0.5 rounded-full bg-black/15" />
                  {futureChapters.map((chapter, index) => (
                    <div key={chapter.start} className="relative z-10 min-w-0 flex-1 text-center">
                      <span
                        className="mx-auto block h-4 w-4 rounded-full border-2 border-black/55 bg-white/65"
                        style={index === 0 ? { borderColor: colorHex, backgroundColor: hexToRgba(colorHex, 0.3) } : undefined}
                      />
                      <span className="mt-1 block truncate text-[9px] font-black text-black/55">
                        {chapter.start}–{chapter.end}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mx-auto mt-1 h-14 w-px border-l-2 border-dashed border-black/20" />
              </motion.div>
            </div>
          ) : null}

        {levels.map((level, index) => {
          const [x, y] = points[index];
          const locked = level.status === "locked";
          const completed = level.status === "completed";
          const isCurrent = level.status === "current";
          const isOpening = openingLevelId === level.id;

          const node = (
            <div
              className="absolute z-10 pb-32"
              style={{ left: `${(x / 340) * 100}%`, top: y, transform: "translate(-50%, -50%)" }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.45, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.11, type: "spring", stiffness: 220, damping: 17 }}
                className="relative grid justify-items-center"
              >
                <div className="level-node-stage relative grid h-32 w-32 justify-items-center">
                  <div
                    className="level-podium pointer-events-none absolute left-1/2 top-[42px] z-0 h-[76px] w-[118px] -translate-x-1/2"
                    style={{
                      backgroundImage: podiumImageUrl
                        ? `url(${podiumImageUrl})`
                        : "linear-gradient(180deg,#6d6f77,#252630 45%,#ec6d94 46%,#ec6d94 72%,#46395a 73%)",
                      backgroundSize: "contain",
                      backgroundPosition: "center top",
                      backgroundRepeat: "no-repeat"
                    }}
                  />
                  {isCurrent ? <div className="absolute top-0 z-0 h-[58px] w-[58px] animate-pulseRing rounded-full bg-black/10" /> : null}
                  <div
                    className="relative z-10 grid h-[58px] w-[58px] place-items-center rounded-full border-[3px] text-center shadow-engine"
                    style={{
                      borderColor: completed || isCurrent ? colorHex : "rgba(0,0,0,0.15)",
                      background: locked
                        ? "rgba(255,255,255,0.52)"
                        : completed
                          ? "linear-gradient(180deg,#ffe19a,#f2b84b)"
                          : "linear-gradient(180deg,#ffffff,#dfe2dc)"
                    }}
                  >
                    {isOpening ? (
                      <LoaderCircle className="h-6 w-6 animate-spin text-ink" />
                    ) : locked ? (
                      <LockKeyhole className="h-5 w-5 text-black/35" />
                    ) : completed ? (
                      <Star className="h-6 w-6 fill-white text-white" />
                    ) : (
                      <Play className="h-6 w-6 fill-ink text-ink" />
                    )}
                    <span className="level-node-label absolute -bottom-2.5 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase text-white">
                      {t(language, "levelShort")}{level.levelNumber}
                    </span>
                  </div>
                </div>
                <div className="level-node-card w-28 rounded-[14px] bg-white/78 p-1.5 text-center shadow-bevel">
                  <div className="truncate text-[11px] font-black">{level.title}</div>
                  <div className="text-[8px] font-black uppercase text-black/35">{formatDifficulty(language, level.difficulty)}</div>
                  {!completed ? (
                    <div className="text-[9px] font-bold text-black/45">
                      {level.activeQuestionCount}/{level.questionCount} {t(language, "questions")}
                    </div>
                  ) : null}
                  {completed ? (
                    <div className=" flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={
                            star <= level.earnedStars
                              ? "h-3 w-3 fill-honey text-honey"
                              : "h-3 w-3 text-black/18"
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  {level.savedSession ? (
                    <div className="level-resume-pill mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase text-white">
                      <RotateCcw className="h-2.5 w-2.5" />
                      {t(language, "resume")}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
          );

          return locked ? (
            <div key={level.id}>{node}</div>
          ) : (
            <Link
              key={level.id}
              href={`/category/${categoryId}/play?level=${level.id}`}
              prefetch={false}
              aria-label={`${t(language, "play")} ${level.title}`}
              aria-busy={isOpening}
              onClick={() => setOpeningLevelId(level.id)}
            >
              {node}
            </Link>
          );
        })}
        </div>
        <div className="level-map-bottom-spacer" aria-hidden="true" />
      </div>
      {futureChapters.length > 0 && showJourneyShortcut ? (
        <div className="level-map-shortcut absolute left-1/2 z-20 -translate-x-1/2">
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.35 }}
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/60 bg-white/[0.32] px-3 py-1.5 text-ink backdrop-blur-sm"
            aria-label={`${remainingLevelCount} ${t(language, "moreLevels")}, ${t(language, "levelShort")}${lastVisibleLevel + 1}–${totalLevels}`}
          >
            <MapPinned className="h-3.5 w-3.5" style={{ color: colorHex }} />
            <span className="text-[10px] font-black">{t(language, "levelShort")}{lastVisibleLevel + 1}–{totalLevels}</span>
          </motion.button>
        </div>
      ) : null}
      {playableLevel ? (
        <Link
          href={`/category/${categoryId}/play?level=${playableLevel.id}`}
          prefetch
          aria-busy={openingLevelId === playableLevel.id}
          onClick={() => setOpeningLevelId(playableLevel.id)}
          className="shine-sweep hidden dark-pill absolute bottom-[calc(env(safe-area-inset-bottom)+86px)] left-1/2 z-20 flex min-h-12 w-44 -translate-x-1/2 items-center justify-center rounded-[18px] border-2 border-white text-base font-black uppercase"
        >
          {playableLevel.savedSession ? t(language, "resume") : t(language, "play")}
        </Link>
      ) : null}
      <SlowConnectionNotice
        active={Boolean(openingLevelId)}
        message={t(language, "slowConnection")}
        className="bottom-32"
      />
    </div>
  );
}
