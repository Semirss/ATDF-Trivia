"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, LoaderCircle, Play, ShieldCheck, XCircle } from "lucide-react";
import { AnswerOption } from "@/components/game/AnswerOption";
import { LevelCompleteModal } from "@/components/game/LevelCompleteModal";
import { ProgressBar } from "@/components/game/ProgressBar";
import { RewardGate } from "@/components/game/RewardGate";
import { ScorePopup, type ScoreFlight } from "@/components/game/ScorePopup";
import { StreakBadge } from "@/components/game/StreakBadge";
import { TimerRing } from "@/components/game/TimerRing";
import { WrongAnswerFlash } from "@/components/game/WrongAnswerFlash";
import { SlowConnectionNotice } from "@/components/ui/SlowConnectionNotice";
import { useCategoryContent } from "@/hooks/useCategoryContent";
import { useGameSession } from "@/hooks/useGameSession";
import { getLocalizedQuestion, t } from "@/lib/i18n";
import { SoundManager } from "@/lib/sounds";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";
import type { OptionKey } from "@/lib/types";

const optionKeys: OptionKey[] = ["a", "b", "c", "d"];
const questionSpring = { type: "spring", stiffness: 210, damping: 24, mass: 0.85 } as const;

function PlayContent({ params }: { params: { categoryId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLevelId = searchParams.get("level");
  const recoveryKey = requestedLevelId ?? `${params.categoryId}:current`;
  const scorePillRef = useRef<HTMLDivElement | null>(null);
  const recoveredLevelRef = useRef<string | null>(null);
  const [scoreFlight, setScoreFlight] = useState<ScoreFlight | null>(null);
  const contentLoaded = useContentStore((state) => state.isLoaded);
  const categories = useContentStore((state) => state.categories);
  const config = useContentStore((state) => state.config);
  const rewardProfiles = usePlayerStore((state) => state.rewardProfiles);
  const playerId = usePlayerStore((state) => state.playerId);
  const language = usePlayerStore((state) => state.language);
  const hasRewardProfile = Boolean(playerId && rewardProfiles.some((profile) => profile.playerId === playerId));
  const selectedCategory = categories.find((item) => item.id === params.categoryId && item.isActive) ?? null;
  const showRewardGate = Boolean(contentLoaded && playerId && selectedCategory?.isRewardBased && !hasRewardProfile);
  const categoryContent = useCategoryContent(params.categoryId, {
    levelId: requestedLevelId,
    enabled: contentLoaded,
    includePrevious: true
  });
  const retryCategoryContent = categoryContent.retry;
  const session = useGameSession(params.categoryId, requestedLevelId, {
    enabled: contentLoaded && categoryContent.isReady && !showRewardGate
  });
  const { forfeitCurrentRewardQuestion } = session;
  const shouldSilenceBg =
    !showRewardGate && ["loading", "ready", "question", "answered", "levelComplete", "categoryComplete"].includes(session.phase);

  useEffect(() => {
    if (
      session.phase === "blocked" &&
      categoryContent.isReady &&
      recoveredLevelRef.current !== recoveryKey
    ) {
      recoveredLevelRef.current = recoveryKey;
      retryCategoryContent();
    }
  }, [categoryContent.isReady, recoveryKey, retryCategoryContent, session.phase]);

  useEffect(() => {
    if (shouldSilenceBg) {
      SoundManager.stopBg();
    } else {
      SoundManager.startBg();
    }

    return () => {
      SoundManager.startBg();
    };
  }, [shouldSilenceBg]);

  useEffect(() => {
    function handlePopState() {
      forfeitCurrentRewardQuestion();
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [forfeitCurrentRewardQuestion]);

  if (showRewardGate) {
    return (
      <div className="game-safe game-safe-compact grid min-h-full place-items-center">
        <RewardGate
          categoryId={params.categoryId}
          onClose={() => router.push(`/category/${params.categoryId}`)}
          onComplete={session.loadSession}
        />
      </div>
    );
  }

  if (!contentLoaded || categoryContent.isLoading) {
    return (
      <div className="game-safe game-safe-compact grid min-h-full place-items-center font-black">
        {t(language, "loadingLevel")}
      </div>
    );
  }

  if (categoryContent.error) {
    return (
      <div className="game-safe game-safe-compact grid min-h-full place-items-center">
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
    );
  }

  if (session.phase === "profileRequired") {
    return (
      <div className="game-safe game-safe-compact grid min-h-full place-items-center">
        <div className="glass-panel rounded-[26px] p-5 text-center">
          <h1 className="font-display text-2xl font-black">{t(language, "createPlayerFirst")}</h1>
          <Link href="/onboarding" className="dark-pill mt-4 inline-flex rounded-[16px] px-4 py-2.5 text-xs font-black uppercase">
            {t(language, "getStarted")}
          </Link>
        </div>
      </div>
    );
  }

  if (session.phase === "blocked" && recoveredLevelRef.current !== recoveryKey) {
    return (
      <div className="game-safe game-safe-compact grid min-h-full place-items-center font-black">
        {t(language, "loadingLevel")}
      </div>
    );
  }

  if (session.phase === "blocked") {
    return (
      <div className="game-safe game-safe-compact grid min-h-full place-items-center">
        <div className="glass-panel rounded-[26px] p-5 text-center">
          <h1 className="font-display text-2xl font-black">{t(language, "levelNeedsQuestions")}</h1>
          <p className="mt-2 text-sm font-bold text-black/58">
            {t(language, "levelNotReady")}
          </p>
          <Link href={`/category/${params.categoryId}`} className="dark-pill mt-4 inline-flex rounded-[16px] px-4 py-2.5 text-xs font-black uppercase">
            {t(language, "backToMap")}
          </Link>
        </div>
      </div>
    );
  }

  const question = session.currentQuestion;
  const localizedQuestion = question ? getLocalizedQuestion(question, language) : null;
  const reveal = session.phase === "answered";
  const wrongFlash = Boolean(session.answerSnapshot && !session.answerSnapshot.isCorrect);
  const answerWasCorrect = Boolean(session.answerSnapshot?.isCorrect);
  const answerOptions = question
    ? optionKeys
        .map((key) => {
          const optionField = `option${key.toUpperCase()}` as "optionA" | "optionB" | "optionC" | "optionD";
          const text = localizedQuestion?.[optionField] ?? session.optionText(question, key);

          return { key, text };
        })
        .filter((option) => option.text.trim().length > 0)
    : [];

  function answerWithFlight(key: OptionKey, element: HTMLButtonElement) {
    if (question && !session.isRecoveringAnswer && key === question.correctOption && scorePillRef.current) {
      const sourceRect = element.getBoundingClientRect();
      const targetRect = scorePillRef.current.getBoundingClientRect();
      const nextStreak = session.streak + 1;
      const multiplier = nextStreak >= config.maxStreakBonus.triggerAt ? config.maxStreakBonus.multiplier : 1;
      const points = session.level ? session.level.pointsPerCorrect * multiplier : 0;

      setScoreFlight({
        id: `${question.id}-${Date.now()}`,
        fromX: sourceRect.left + sourceRect.width * 0.64,
        fromY: sourceRect.top + sourceRect.height / 2,
        toX: targetRect.left + targetRect.width / 2,
        toY: targetRect.top + targetRect.height / 2,
        points
      });
    }

    session.answerQuestion(key);
  }

  return (
    <div className={`game-safe game-play-safe ${reveal ? "game-play-safe-reveal" : ""} relative min-h-full`}>
      <WrongAnswerFlash active={wrongFlash} />
      <SlowConnectionNotice
        active={session.isCompleting}
        message={t(language, "slowConnection")}
        className="bottom-24"
      />
      <ScorePopup
        flight={scoreFlight}
        onComplete={(id) => {
          setScoreFlight((current) => (current?.id === id ? null : current));
        }}
      />
      {(session.phase === "levelComplete" || session.phase === "categoryComplete") && session.level ? (
        <LevelCompleteModal
          categoryId={params.categoryId}
          title={session.level.title}
          score={session.sessionScore}
          correct={session.correctAnswered}
          total={session.totalQuestions}
          stars={session.stars}
          categoryComplete={session.phase === "categoryComplete"}
          completedLevelCount={session.completedLevelCount}
        />
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="play-top-row flex shrink-0 items-center justify-between"
      >
        <Link
          href={`/category/${params.categoryId}`}
          aria-label="Back"
          onClick={forfeitCurrentRewardQuestion}
          className="play-back-button grid h-9 w-9 place-items-center rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <motion.div
          ref={scorePillRef}
          animate={scoreFlight ? { scale: [1, 1.08, 1], boxShadow: ["0 0 0 rgba(242,184,75,0)", "0 0 22px rgba(242,184,75,0.7)", "0 0 0 rgba(242,184,75,0)"] } : { scale: 1 }}
          transition={{ duration: 0.42, delay: 0.58, ease: "easeOut" }}
          className="play-score-pill rounded-full px-3 py-1 text-xs font-black"
        >
          {t(language, "score")} {session.sessionScore}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.04, duration: 0.22, ease: "easeOut" }}
        className="play-progress-card mt-2 shrink-0 rounded-[18px] p-2.5"
      >
        <div className="play-progress-meta mb-2 flex items-center justify-between text-xs font-black uppercase">
          <span>{session.level ? `${t(language, "level")} ${session.level.levelNumber}` : t(language, "loading")}</span>
          <span>
            {t(language, "questionShort")} {Math.min(session.currentIndex + 1, session.totalQuestions)}/{session.totalQuestions}
          </span>
        </div>
        <ProgressBar current={session.currentIndex} total={session.totalQuestions} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.08, duration: 0.24, ease: "easeOut" }}
        className="play-timer-slot"
      >
        <TimerRing timeRemaining={session.timeRemaining} total={session.level?.timeLimitSeconds ?? 30} />
      </motion.div>

      <div className="flex min-h-0 shrink-0 justify-center">
        <StreakBadge streak={session.streak} triggerAt={config.maxStreakBonus.triggerAt} />
      </div>

      <div className="play-round-area mt-1 min-h-0 flex-1">
        <AnimatePresence initial={false} mode="sync">
          {session.phase === "ready" && session.level ? (
            <motion.section
              key={`ready-${session.level.id}`}
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.99 }}
              transition={questionSpring}
              className="play-ready-wrap grid h-full min-h-0 place-items-center"
            >
              <div className="play-ready-panel w-full rounded-[26px] p-5 text-center shadow-bevel">
                <span className="play-ready-icon mx-auto grid h-14 w-14 place-items-center rounded-full">
                  <ShieldCheck className="h-7 w-7" />
                </span>
                <p className="play-ready-kicker mt-4 text-[10px] font-black uppercase tracking-[0.16em]">
                  {t(language, "level")} {session.level.levelNumber} · {session.totalQuestions} {t(language, "questions")}
                </p>
                <h1 className="play-ready-title mt-1 font-display text-2xl font-black">
                  {t(language, "readyToPlay")}
                </h1>
                <p className="play-ready-copy mx-auto mt-2 max-w-[290px] text-sm font-bold leading-snug">
                  {t(language, "timerStartsAfterStart")}
                </p>
                <button
                  type="button"
                  onClick={session.startQuestion}
                  className="shine-sweep dark-pill mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] text-sm font-black uppercase"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {t(language, "startQuestion")}
                </button>
              </div>
            </motion.section>
          ) : question ? (
            <motion.section
              key={question.id}
              initial={{ opacity: 0, y: 30, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.992 }}
              transition={questionSpring}
              className="flex h-full min-h-0 flex-col"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className={`play-question-panel ${reveal ? "play-question-panel-answered" : ""} shrink-0 rounded-[22px] p-3`}
              >
                <p className="play-question-eyebrow text-[10px] font-black uppercase">{session.category?.title}</p>
                <h1 className="play-question-text mt-1 text-balance font-display font-black">
                  {localizedQuestion?.questionText ?? question.questionText}
                </h1>
                {reveal && localizedQuestion?.explanation ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className={`play-explanation ${answerWasCorrect ? "play-explanation-correct" : "play-explanation-wrong"} mt-2 rounded-[16px] p-2.5`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
                      <span className="play-explanation-icon grid h-5 w-5 place-items-center rounded-full">
                        {answerWasCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      </span>
                      {answerWasCorrect ? t(language, "correct") : t(language, "wrong")} {t(language, "answer")}
                    </div>
                    <p className="text-[11px] font-extrabold leading-snug">{localizedQuestion.explanation}</p>
                  </motion.div>
                ) : null}
              </motion.div>

              <div className="play-answer-grid mt-2 grid shrink-0 gap-2">
                {answerOptions.map((option, index) => (
                  <motion.div
                    key={option.key}
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: index * 0.045, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AnswerOption
                      optionKey={option.key}
                      text={option.text}
                      disabled={session.phase !== "question"}
                      selected={session.answerSnapshot?.selectedOption === option.key}
                      correct={session.answerSnapshot?.correctOption === option.key}
                      reveal={reveal}
                      onSelect={answerWithFlight}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>

      {reveal ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="play-continue-dock"
        >
          <button
            type="button"
            onClick={session.nextQuestion}
            disabled={session.isCompleting}
            aria-busy={session.isCompleting}
            className="shine-sweep dark-pill min-h-12 w-full rounded-[18px] text-sm font-black uppercase"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {session.isCompleting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {session.isCompleting ? t(language, "savingProgress") : t(language, "continue")}
            </span>
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

export default function PlayPage({ params }: { params: { categoryId: string } }) {
  const language = usePlayerStore((state) => state.language);

  return (
    <Suspense fallback={<div className="game-safe game-safe-compact grid min-h-full place-items-center font-black">{t(language, "loadingLevel")}</div>}>
      <PlayContent params={params} />
    </Suspense>
  );
}
