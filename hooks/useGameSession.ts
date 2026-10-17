"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { toast } from "sonner";
import { trackGamePlayed, trackLevelCompleted } from "@/lib/analytics";
import { GameRequestError, recordRemoteGameSession, recordRemoteScore, saveRemoteProgress } from "@/lib/game-client";
import { calculateStars, latestScoreEventsByQuestion } from "@/lib/game-scoring";
import { SoundManager } from "@/lib/sounds";
import { clamp, optionText, percent, shuffleArray } from "@/lib/utils";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";
import type { Category, CategoryLevel, OptionKey, Question, SavedQuestionAnswer } from "@/lib/types";

type GamePhase =
  | "loading"
  | "ready"
  | "question"
  | "answered"
  | "levelComplete"
  | "categoryComplete"
  | "profileRequired"
  | "blocked";

interface AnswerSnapshot {
  selectedOption: OptionKey | null;
  isCorrect: boolean;
  correctOption: OptionKey;
  points: number;
}

interface GameSessionOptions {
  enabled?: boolean;
}

export function useGameSession(categoryId: string, requestedLevelId?: string | null, options: GameSessionOptions = {}) {
  const enabled = options.enabled ?? true;
  const categories = useContentStore((state) => state.categories);
  const levels = useContentStore((state) => state.levels);
  const allQuestions = useContentStore((state) => state.questions);
  const config = useContentStore((state) => state.config);
  const playerId = usePlayerStore((state) => state.playerId);
  const ensureProgress = usePlayerStore((state) => state.ensureProgress);
  const updateQuestionIndex = usePlayerStore((state) => state.updateQuestionIndex);
  const saveActiveSession = usePlayerStore((state) => state.saveActiveSession);
  const clearActiveSession = usePlayerStore((state) => state.clearActiveSession);
  const recordScoreEvent = usePlayerStore((state) => state.recordScoreEvent);
  const replaceProgress = usePlayerStore((state) => state.replaceProgress);

  const [category, setCategory] = useState<Category | null>(null);
  const [level, setLevel] = useState<CategoryLevel | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctAnswered, setCorrectAnswered] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [answerSnapshot, setAnswerSnapshot] = useState<AnswerSnapshot | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(config.defaultTimeLimitSeconds);
  const [timeoutToastShown, setTimeoutToastShown] = useState(false);
  const [completedLevelCount, setCompletedLevelCount] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [recoveryQuestionIds, setRecoveryQuestionIds] = useState<string[]>([]);
  const answerLockRef = useRef(false);
  const completionLockRef = useRef(false);
  const lastTickSecondRef = useRef<number | null>(null);
  const scoreSyncsRef = useRef(new Map<string, Promise<boolean>>());
  const answerAttemptsRef = useRef<SavedQuestionAnswer[]>([]);
  const forfeitRewardQuestionRef = useRef<() => void>(() => undefined);
  const pendingGameSessionRef = useRef<{
    sessionId: string;
    playerId: string;
    categoryId: string;
    categoryTitle: string;
    levelId: string;
    levelNumber: number;
  } | null>(null);

  const activeLevels = useMemo(
    () =>
      levels
        .filter((item) => item.categoryId === categoryId && item.isActive)
        .sort((first, second) => first.levelNumber - second.levelNumber),
    [categoryId, levels]
  );

  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;
  const completionPercent = percent(currentIndex, totalQuestions);

  const loadSession = useCallback(() => {
    answerLockRef.current = false;
    completionLockRef.current = false;
    scoreSyncsRef.current.clear();
    answerAttemptsRef.current = [];
    setIsCompleting(false);
    setRecoveryQuestionIds([]);

    if (!enabled) {
      setCategory(null);
      setLevel(null);
      setQuestions([]);
      setCurrentIndex(0);
      setSessionScore(0);
      setStreak(0);
      setCorrectAnswered(0);
      setAnswerSnapshot(null);
      setTimeRemaining(config?.defaultTimeLimitSeconds || 30);
      setTimeoutToastShown(false);
      setCompletedLevelCount(0);
      setPhase("loading");
      return;
    }

    const selectedCategory = categories.find((item) => item.id === categoryId && item.isActive) ?? null;

    if (!selectedCategory) {
      setCompletedLevelCount(0);
      setPhase("blocked");
      return;
    }

    if (!playerId) {
      setCategory(selectedCategory);
      setLevel(null);
      setQuestions([]);
      setCompletedLevelCount(0);
      setPhase("profileRequired");
      return;
    }

    const progress = ensureProgress(categoryId);

    if (!progress) {
      setCategory(selectedCategory);
      setLevel(null);
      setQuestions([]);
      setCompletedLevelCount(0);
      setPhase("profileRequired");
      return;
    }

    const playerState = usePlayerStore.getState();
    let validatedLevelsCompleted = 0;

    for (const candidateLevel of activeLevels) {
      if (candidateLevel.levelNumber > progress.levelsCompleted) {
        break;
      }

      const currentQuestionIds = new Set(
        allQuestions
          .filter((question) => question.levelId === candidateLevel.id && question.isActive)
          .map((question) => question.id)
      );
      const answeredQuestionIds = new Set(
        latestScoreEventsByQuestion(
          playerState.scoreEvents.filter(
            (event) =>
              event.playerId === playerId &&
              event.categoryId === categoryId &&
              event.levelId === candidateLevel.id &&
              Boolean(event.questionId && currentQuestionIds.has(event.questionId))
          )
        ).map((event) => event.questionId)
      );

      if (
        currentQuestionIds.size < candidateLevel.questionCount ||
        answeredQuestionIds.size < candidateLevel.questionCount
      ) {
        break;
      }

      validatedLevelsCompleted = candidateLevel.levelNumber;
    }

    const progressLevel =
      activeLevels.find((item) => item.levelNumber > validatedLevelsCompleted) ?? activeLevels[activeLevels.length - 1] ?? null;
    const requestedLevel = requestedLevelId ? activeLevels.find((item) => item.id === requestedLevelId) ?? null : null;
    const selectedLevel =
      requestedLevel &&
      (requestedLevel.levelNumber <= validatedLevelsCompleted || requestedLevel.id === progressLevel?.id)
        ? requestedLevel
        : progressLevel;

    if (!selectedLevel) {
      setCategory(selectedCategory);
      setLevel(null);
      setQuestions([]);
      setCompletedLevelCount(0);
      setPhase("categoryComplete");
      return;
    }

    const levelQuestions = allQuestions
      .filter((question) => question.levelId === selectedLevel.id && question.isActive)
      .sort((first, second) => first.sortOrder - second.sortOrder);
    const savedSession = playerState.activeSessions.find(
      (session) =>
        session.playerId === playerId &&
        session.categoryId === categoryId &&
        session.levelId === selectedLevel.id
    );
    const savedQuestionIds = savedSession?.questionIds.slice(0, selectedLevel.questionCount) ?? [];
    const savedQuestions =
      savedQuestionIds
        .map((questionId) => levelQuestions.find((question) => question.id === questionId) ?? null)
        .filter((question): question is Question => question !== null);
    const canResume = Boolean(
      savedSession &&
        savedQuestionIds.length >= selectedLevel.questionCount &&
        savedQuestions.length === selectedLevel.questionCount &&
        savedSession.currentIndex >= 0 &&
        savedSession.currentIndex < selectedLevel.questionCount
    );
    const legacyCurrentAnswer =
      canResume && savedSession?.phase === "answered" && savedQuestions[savedSession.currentIndex]
        ? [{
            questionId: savedQuestions[savedSession.currentIndex].id,
            selectedOption: savedSession.selectedOption,
            currentStreak: savedSession.isCorrect ? Math.max(0, savedSession.streak - 1) : 0
          }]
        : [];
    const resumedAnswerAttempts = canResume
      ? (savedSession?.answerAttempts?.length ? savedSession.answerAttempts : legacyCurrentAnswer)
          .filter((attempt) => savedQuestionIds.includes(attempt.questionId))
      : [];
    const resumedRecoveryQuestionIds = canResume
      ? (savedSession?.recoveryQuestionIds ?? []).filter((questionId) => savedQuestionIds.includes(questionId))
      : [];

    answerAttemptsRef.current = resumedAnswerAttempts;
    setRecoveryQuestionIds(resumedRecoveryQuestionIds);

    if (savedSession && !canResume) {
      clearActiveSession(categoryId, selectedLevel.id);
    }

    if (validatedLevelsCompleted >= selectedLevel.levelNumber) {
      if (savedSession) {
        clearActiveSession(categoryId, selectedLevel.id);
      }

      const completedEvents = latestScoreEventsByQuestion(
        playerState.scoreEvents.filter(
          (event) =>
            event.playerId === playerId &&
            event.categoryId === categoryId &&
            event.levelId === selectedLevel.id
        )
      );
      const displayQuestions = levelQuestions.slice(0, selectedLevel.questionCount);
      const hasNextLevel = activeLevels.some((item) => item.levelNumber === selectedLevel.levelNumber + 1);

      setCategory(selectedCategory);
      setLevel(selectedLevel);
      setQuestions(displayQuestions);
      setCurrentIndex(Math.max(0, displayQuestions.length - 1));
      setSessionScore(completedEvents.reduce((total, event) => total + event.points, 0));
      setStreak(0);
      setCorrectAnswered(completedEvents.filter((event) => event.isCorrect).length);
      setAnswerSnapshot(null);
      setTimeRemaining(selectedLevel.timeLimitSeconds || config?.defaultTimeLimitSeconds || 30);
      setTimeoutToastShown(false);
      setCompletedLevelCount(0);
      setPhase(hasNextLevel ? "levelComplete" : "categoryComplete");
      return;
    }

    const sessionQuestions = canResume ? savedQuestions : shuffleArray(levelQuestions).slice(0, selectedLevel.questionCount);
    const initialIndex = canResume && savedSession ? clamp(savedSession.currentIndex, 0, sessionQuestions.length - 1) : 0;

    pendingGameSessionRef.current = !canResume
      ? {
        sessionId: crypto.randomUUID(),
        playerId,
        categoryId: selectedCategory.id,
        categoryTitle: selectedCategory.title,
        levelId: selectedLevel.id,
        levelNumber: selectedLevel.levelNumber
      }
      : null;

    setCategory(selectedCategory);
    setLevel(selectedLevel);
    setQuestions(sessionQuestions);
    setCurrentIndex(initialIndex);
    setSessionScore(canResume && savedSession ? savedSession.sessionScore : 0);
    setStreak(canResume && savedSession ? savedSession.streak : 0);
    setCorrectAnswered(canResume && savedSession ? savedSession.correctAnswered : 0);
    setAnswerSnapshot(
      canResume && savedSession && savedSession.phase === "answered"
        ? {
            selectedOption: savedSession.selectedOption,
            isCorrect: Boolean(savedSession.isCorrect),
            correctOption: savedSession.correctOption ?? sessionQuestions[initialIndex]?.correctOption ?? "a",
            points: savedSession.points
          }
        : null
    );
    setTimeRemaining(selectedLevel.timeLimitSeconds || config?.defaultTimeLimitSeconds || 30);
    setTimeoutToastShown(false);
    setCompletedLevelCount(0);
    setPhase(
      sessionQuestions.length >= selectedLevel.questionCount
        ? canResume && savedSession
          ? savedSession.phase === "answered"
            ? "answered"
            : "ready"
          : "ready"
        : "blocked"
    );
  }, [
    activeLevels,
    allQuestions,
    categories,
    categoryId,
    clearActiveSession,
    config?.defaultTimeLimitSeconds,
    enabled,
    ensureProgress,
    playerId,
    requestedLevelId
  ]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!enabled || phase !== "question" || !level) {
      SoundManager.stop("tick");
      return;
    }

    const limitSeconds = level.timeLimitSeconds || config?.defaultTimeLimitSeconds || 30;
    const endsAt = Date.now() + limitSeconds * 1000;
    let timer: number | null = null;

    lastTickSecondRef.current = limitSeconds;
    setTimeRemaining(limitSeconds);
    setTimeoutToastShown(false);

    function updateCountdown() {
      const remainingMs = Math.max(endsAt - Date.now(), 0);
      const nextTime = Math.max(Math.ceil(remainingMs / 1000), 0);
      setTimeRemaining(nextTime);

      if (nextTime > 0 && nextTime <= 5 && lastTickSecondRef.current !== nextTime) {
        lastTickSecondRef.current = nextTime;
        void SoundManager.play("tick");
      }

      if (nextTime <= 0) {
        return;
      }

      const nextBoundaryMs = remainingMs - (nextTime - 1) * 1000;
      timer = window.setTimeout(updateCountdown, clamp(nextBoundaryMs + 12, 40, 1000));
    }

    timer = window.setTimeout(updateCountdown, 40);

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      SoundManager.stop("tick");
    };
  }, [currentIndex, enabled, level?.id, level?.timeLimitSeconds, phase]);

  const submitAnswerAttempt = useCallback(
    (attempt: SavedQuestionAnswer, options: { keepalive?: boolean; silent?: boolean } = {}) => {
      if (!enabled || !playerId || !category || !level) {
        return Promise.resolve(false);
      }

      const existingSync = scoreSyncsRef.current.get(attempt.questionId);
      if (existingSync) {
        return existingSync;
      }

      const scoreSync = recordRemoteScore(
        {
          playerId,
          categoryId: category.id,
          levelId: level.id,
          questionId: attempt.questionId,
          currentStreak: attempt.currentStreak,
          selectedOption: attempt.selectedOption
        },
        { keepalive: options.keepalive }
      )
        .then((result) => {
          recordScoreEvent(result.event);
          return true;
        })
        .catch((error) => {
          if (!options.silent) {
            toast.error(error instanceof Error ? error.message : "Unable to sync that answer.");
          }
          return false;
        });

      scoreSyncsRef.current.set(attempt.questionId, scoreSync);
      void scoreSync.finally(() => {
        if (scoreSyncsRef.current.get(attempt.questionId) === scoreSync) {
          scoreSyncsRef.current.delete(attempt.questionId);
        }
      });
      return scoreSync;
    },
    [category, enabled, level, playerId, recordScoreEvent]
  );

  const answerQuestion = useCallback(
    (option: OptionKey | null, options: { keepalive?: boolean; silent?: boolean } = {}) => {
      if (!enabled || !currentQuestion || !level || !category || phase !== "question" || !playerId || answerLockRef.current) {
        return;
      }

      answerLockRef.current = true;
      SoundManager.stop("tick");

      const isRecoveryQuestion = recoveryQuestionIds.includes(currentQuestion.id);
      const confirmedEventsByQuestion = new Map(
        latestScoreEventsByQuestion(
          usePlayerStore.getState().scoreEvents.filter(
            (event) =>
              event.playerId === playerId &&
              event.categoryId === category.id &&
              event.levelId === level.id
          )
        ).map((event) => [event.questionId, event])
      );
      const scoringStreak = isRecoveryQuestion
        ? questions.slice(0, currentIndex).reduce((runningStreak, question) => {
            const savedAttempt = answerAttemptsRef.current.find((attempt) => attempt.questionId === question.id);
            const priorWasCorrect = savedAttempt
              ? savedAttempt.selectedOption === question.correctOption
              : confirmedEventsByQuestion.get(question.id)?.isCorrect ?? false;
            return priorWasCorrect ? runningStreak + 1 : 0;
          }, 0)
        : streak;
      const isCorrect = option === currentQuestion.correctOption;
      const nextStreak = isCorrect ? scoringStreak + 1 : 0;
      const streakMultiplier =
        isCorrect && nextStreak >= config.maxStreakBonus.triggerAt ? config.maxStreakBonus.multiplier : 1;
      const points = isCorrect ? level.pointsPerCorrect * streakMultiplier : 0;
      const nextSessionScore = isRecoveryQuestion ? sessionScore : sessionScore + points;
      const nextCorrectAnswered = isRecoveryQuestion ? correctAnswered : correctAnswered + (isCorrect ? 1 : 0);
      const nextStreakValue = isRecoveryQuestion ? streak : nextStreak;
      const answerAttempt: SavedQuestionAnswer = {
        questionId: currentQuestion.id,
        selectedOption: option,
        currentStreak: scoringStreak
      };

      answerAttemptsRef.current = [
        ...answerAttemptsRef.current.filter((attempt) => attempt.questionId !== currentQuestion.id),
        answerAttempt
      ];

      setAnswerSnapshot({
        selectedOption: option,
        isCorrect,
        correctOption: currentQuestion.correctOption,
        points
      });
      setPhase("answered");
      setStreak(nextStreakValue);
      setSessionScore(nextSessionScore);
      setCorrectAnswered(nextCorrectAnswered);
      updateQuestionIndex(category.id, currentIndex);
      saveActiveSession({
        categoryId: category.id,
        levelId: level.id,
        questionIds: questions.map((question) => question.id),
        currentIndex,
        sessionScore: nextSessionScore,
        streak: nextStreakValue,
        correctAnswered: nextCorrectAnswered,
        phase: "answered",
        selectedOption: option,
        isCorrect,
        correctOption: currentQuestion.correctOption,
        points,
        answerAttempts: answerAttemptsRef.current,
        recoveryQuestionIds
      });
      void SoundManager.play(isCorrect ? "correct" : "wrong");
      void submitAnswerAttempt(answerAttempt, options);
    },
    [
      category,
      config.maxStreakBonus.multiplier,
      config.maxStreakBonus.triggerAt,
      correctAnswered,
      currentIndex,
      currentQuestion,
      enabled,
      level,
      phase,
      playerId,
      questions,
      recoveryQuestionIds,
      saveActiveSession,
      sessionScore,
      streak,
      submitAnswerAttempt,
      updateQuestionIndex
    ]
  );

  useEffect(() => {
    forfeitRewardQuestionRef.current = () => {
      if (enabled && category?.isRewardBased && phase === "question") {
        answerQuestion(null, { keepalive: true, silent: true });
      }
    };
  }, [answerQuestion, category?.isRewardBased, enabled, phase]);

  const forfeitCurrentRewardQuestion = useCallback(() => {
    forfeitRewardQuestionRef.current();
  }, []);

  useEffect(() => {
    function forfeitIfHidden() {
      if (document.visibilityState === "hidden") {
        forfeitRewardQuestionRef.current();
      }
    }

    function forfeitNow() {
      forfeitRewardQuestionRef.current();
    }

    document.addEventListener("visibilitychange", forfeitIfHidden);
    window.addEventListener("pagehide", forfeitNow);

    return () => {
      document.removeEventListener("visibilitychange", forfeitIfHidden);
      window.removeEventListener("pagehide", forfeitNow);
    };
  }, []);

  useEffect(() => {
    if (!enabled || phase !== "question" || timeRemaining > 0 || timeoutToastShown) {
      return;
    }

    setTimeoutToastShown(true);
    toast.dismiss("time-up");
    toast.warning("Time's up", { id: "time-up", duration: 1200 });
    answerQuestion(null);
  }, [answerQuestion, enabled, phase, timeRemaining, timeoutToastShown]);

  const completeCurrentLevel = useCallback(async () => {
    if (!enabled || !level || !playerId || completionLockRef.current) {
      return;
    }

    completionLockRef.current = true;
    setIsCompleting(true);

    const questionIds = questions.map((question) => question.id);
    const saveProgress = () =>
      saveRemoteProgress({
        playerId,
        categoryId,
        currentLevel: level.levelNumber,
        sessionScore,
        questionIds
      });

    try {
      await Promise.all(Array.from(scoreSyncsRef.current.values()));

      let result;
      try {
        result = await saveProgress();
      } catch (error) {
        if (!(error instanceof GameRequestError) || error.code !== "MISSING_ANSWERS") {
          throw error;
        }

        const missingQuestionIds = Array.from(new Set(error.missingQuestionIds)).filter((questionId) =>
          questionIds.includes(questionId)
        );
        const attemptsByQuestionId = new Map(
          answerAttemptsRef.current.map((attempt) => [attempt.questionId, attempt])
        );
        const retryableAttempts = missingQuestionIds
          .map((questionId) => attemptsByQuestionId.get(questionId))
          .filter((attempt): attempt is SavedQuestionAnswer => Boolean(attempt));
        const questionsNeedingAnswer = missingQuestionIds.filter(
          (questionId) => !attemptsByQuestionId.has(questionId)
        );

        if (retryableAttempts.length > 0) {
          await Promise.all(retryableAttempts.map((attempt) => submitAnswerAttempt(attempt, { silent: true })));
        }

        if (questionsNeedingAnswer.length > 0) {
          const nextQuestionId = questionsNeedingAnswer[0];
          const nextIndex = questions.findIndex((question) => question.id === nextQuestionId);

          if (nextIndex >= 0) {
            completionLockRef.current = false;
            answerLockRef.current = false;
            setIsCompleting(false);
            setRecoveryQuestionIds(questionsNeedingAnswer);
            updateQuestionIndex(categoryId, nextIndex);
            saveActiveSession({
              categoryId,
              levelId: level.id,
              questionIds,
              currentIndex: nextIndex,
              sessionScore,
              streak,
              correctAnswered,
              phase: "question",
              selectedOption: null,
              isCorrect: null,
              correctOption: null,
              points: 0,
              answerAttempts: answerAttemptsRef.current,
              recoveryQuestionIds: questionsNeedingAnswer
            });
            setCurrentIndex(nextIndex);
            setAnswerSnapshot(null);
            setPhase("question");
            toast.warning(
              questionsNeedingAnswer.length === 1
                ? "One answer did not sync. Please answer this question again."
                : `${questionsNeedingAnswer.length} answers did not sync. Only those questions will be shown again.`
            );
            return;
          }
        }

        result = await saveProgress();
      }

      clearActiveSession(categoryId, level.id);
      replaceProgress(result.progress);
      setCompletedLevelCount(result.progress.levelsCompleted);
      setRecoveryQuestionIds([]);
      trackLevelCompleted({
        categoryId,
        categoryTitle: category?.title ?? "Category",
        levelId: level.id,
        levelNumber: level.levelNumber
      });
      void SoundManager.play("levelUp");
      setIsCompleting(false);
      startTransition(() => setPhase(result.categoryComplete ? "categoryComplete" : "levelComplete"));
    } catch (error) {
      completionLockRef.current = false;
      setIsCompleting(false);
      toast.error(error instanceof Error ? error.message : "Unable to save level progress.");
    }
  }, [
    category?.title,
    categoryId,
    clearActiveSession,
    correctAnswered,
    enabled,
    level,
    playerId,
    questions,
    replaceProgress,
    saveActiveSession,
    sessionScore,
    streak,
    submitAnswerAttempt,
    updateQuestionIndex
  ]);

  const nextQuestion = useCallback(async () => {
    if (!enabled || !level || phase !== "answered" || !playerId) {
      return;
    }

    const isRecoveryQuestion = Boolean(currentQuestion && recoveryQuestionIds.includes(currentQuestion.id));
    if (isRecoveryQuestion && currentQuestion) {
      const remainingRecoveryQuestionIds = recoveryQuestionIds.filter(
        (questionId) => questionId !== currentQuestion.id
      );

      if (remainingRecoveryQuestionIds.length > 0) {
        const nextIndex = questions.findIndex((question) => question.id === remainingRecoveryQuestionIds[0]);
        if (nextIndex >= 0) {
          startTransition(() => {
            answerLockRef.current = false;
            setRecoveryQuestionIds(remainingRecoveryQuestionIds);
            updateQuestionIndex(categoryId, nextIndex);
            saveActiveSession({
              categoryId,
              levelId: level.id,
              questionIds: questions.map((question) => question.id),
              currentIndex: nextIndex,
              sessionScore,
              streak,
              correctAnswered,
              phase: "question",
              selectedOption: null,
              isCorrect: null,
              correctOption: null,
              points: 0,
              answerAttempts: answerAttemptsRef.current,
              recoveryQuestionIds: remainingRecoveryQuestionIds
            });
            setCurrentIndex(nextIndex);
            setAnswerSnapshot(null);
            setPhase("question");
          });
          return;
        }
      }

      setRecoveryQuestionIds([]);
      saveActiveSession({
        categoryId,
        levelId: level.id,
        questionIds: questions.map((question) => question.id),
        currentIndex,
        sessionScore,
        streak,
        correctAnswered,
        phase: "answered",
        selectedOption: answerSnapshot?.selectedOption ?? null,
        isCorrect: answerSnapshot?.isCorrect ?? null,
        correctOption: answerSnapshot?.correctOption ?? null,
        points: answerSnapshot?.points ?? 0,
        answerAttempts: answerAttemptsRef.current,
        recoveryQuestionIds: []
      });
      await completeCurrentLevel();
      return;
    }

    const isLastQuestion = currentIndex + 1 >= questions.length;
    if (isLastQuestion) {
      await completeCurrentLevel();
      return;
    }

    startTransition(() => {
      answerLockRef.current = false;
      const nextIndex = currentIndex + 1;
      updateQuestionIndex(categoryId, nextIndex);
      saveActiveSession({
        categoryId,
        levelId: level.id,
        questionIds: questions.map((question) => question.id),
        currentIndex: nextIndex,
        sessionScore,
        streak,
        correctAnswered,
        phase: "question",
        selectedOption: null,
        isCorrect: null,
        correctOption: null,
        points: 0,
        answerAttempts: answerAttemptsRef.current,
        recoveryQuestionIds
      });
      setCurrentIndex(nextIndex);
      setAnswerSnapshot(null);
      setPhase("question");
    });
  }, [
    answerSnapshot,
    categoryId,
    completeCurrentLevel,
    correctAnswered,
    currentIndex,
    currentQuestion,
    enabled,
    level,
    phase,
    playerId,
    questions,
    recoveryQuestionIds,
    saveActiveSession,
    sessionScore,
    streak,
    updateQuestionIndex
  ]);

  const startQuestion = useCallback(() => {
    if (!enabled || phase !== "ready" || !category || !level || !currentQuestion || !playerId) {
      return;
    }

    const pendingSession = pendingGameSessionRef.current;
    pendingGameSessionRef.current = null;

    if (pendingSession) {
      trackGamePlayed({
        categoryId: pendingSession.categoryId,
        categoryTitle: pendingSession.categoryTitle,
        levelId: pendingSession.levelId,
        levelNumber: pendingSession.levelNumber
      });
      void recordRemoteGameSession({
        sessionId: pendingSession.sessionId,
        playerId: pendingSession.playerId,
        categoryId: pendingSession.categoryId,
        levelId: pendingSession.levelId
      }).catch(() => undefined);
    }

    answerLockRef.current = false;
    saveActiveSession({
      categoryId: category.id,
      levelId: level.id,
      questionIds: questions.map((question) => question.id),
      currentIndex,
      sessionScore,
      streak,
      correctAnswered,
      phase: "question",
      selectedOption: null,
      isCorrect: null,
      correctOption: null,
      points: 0,
      answerAttempts: answerAttemptsRef.current,
      recoveryQuestionIds
    });
    setPhase("question");
  }, [
    category,
    correctAnswered,
    currentIndex,
    currentQuestion,
    enabled,
    level,
    phase,
    playerId,
    questions,
    recoveryQuestionIds,
    saveActiveSession,
    sessionScore,
    streak
  ]);

  const stars = calculateStars(correctAnswered, totalQuestions);

  return {
    category,
    level,
    questions,
    currentQuestion,
    currentIndex,
    totalQuestions,
    completionPercent,
    sessionScore,
    streak,
    correctAnswered,
    phase,
    answerSnapshot,
    timeRemaining,
    playerId,
    optionText,
    answerQuestion,
    startQuestion,
    forfeitCurrentRewardQuestion,
    nextQuestion,
    loadSession,
    stars,
    completedLevelCount,
    isCompleting,
    isRecoveringAnswer: Boolean(currentQuestion && recoveryQuestionIds.includes(currentQuestion.id))
  };
}
