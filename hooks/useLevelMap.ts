"use client";

import { useEffect, useMemo } from "react";
import { calculateStars, latestScoreEventsByQuestion } from "@/lib/game-scoring";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";
import type { CategoryLevel, SavedGameSession } from "@/lib/types";

type LevelMapStatus = "completed" | "current" | "locked";

function canResumeSession(session: SavedGameSession, level: CategoryLevel, activeQuestionIds: Set<string>) {
  const requiredQuestionCount = level.questionCount;
  const hasEnoughQuestions = session.questionIds.length >= requiredQuestionCount;
  const questionIdsAreActive = session.questionIds
    .slice(0, requiredQuestionCount)
    .every((questionId) => activeQuestionIds.has(questionId));
  const currentIndexIsValid = session.currentIndex >= 0 && session.currentIndex < requiredQuestionCount;

  return hasEnoughQuestions && questionIdsAreActive && currentIndexIsValid;
}

export function useLevelMap(
  categoryId: string,
  { startLevel = 1, limit = 5 }: { startLevel?: number; limit?: number } = {}
) {
  const levels = useContentStore((state) => state.levels);
  const questions = useContentStore((state) => state.questions);
  const getProgress = usePlayerStore((state) => state.getProgress);
  const activeSessions = usePlayerStore((state) => state.activeSessions);
  const scoreEvents = usePlayerStore((state) => state.scoreEvents);

  useEffect(() => {
    // Use getState() to avoid adding ensureProgress to the dep array.
    // Subscribing to it caused an infinite loop: ensureProgress mutates
    // the store → new function ref → effect re-fires → repeat.
    usePlayerStore.getState().ensureProgress(categoryId);
  }, [categoryId]);

  const progress = getProgress(categoryId);
  const activeLevels = useMemo(
    () =>
      levels
        .filter(
          (level) =>
            level.categoryId === categoryId &&
            level.isActive &&
            level.levelNumber >= startLevel &&
            level.levelNumber < startLevel + limit
        )
        .sort((first, second) => first.levelNumber - second.levelNumber),
    [categoryId, levels, limit, startLevel]
  );
  const completedThrough = progress?.levelsCompleted ?? 0;
  const levelEvidence = useMemo(() => {
    let completionChainIsValid = true;

    return activeLevels.map((level) => {
      const activeQuestionIds = new Set(
        questions
          .filter((question) => question.levelId === level.id && question.isActive)
          .map((question) => question.id)
      );
      const answeredEvents = latestScoreEventsByQuestion(
        scoreEvents.filter(
          (event) =>
            event.playerId === progress?.playerId &&
            event.categoryId === categoryId &&
            event.levelId === level.id &&
            Boolean(event.questionId && activeQuestionIds.has(event.questionId))
        )
      );
      const hasCurrentCompletionEvidence =
        activeQuestionIds.size >= level.questionCount && answeredEvents.length >= level.questionCount;
      const completed =
        completionChainIsValid &&
        level.levelNumber <= completedThrough &&
        hasCurrentCompletionEvidence;

      if (!completed) {
        completionChainIsValid = false;
      }

      return { level, activeQuestionIds, answeredEvents, completed };
    });
  }, [activeLevels, categoryId, completedThrough, progress?.playerId, questions, scoreEvents]);
  const currentLevel = levelEvidence.find((item) => !item.completed)?.level.levelNumber ?? null;
  const completedLevelIds = useMemo(
    () => new Set(levelEvidence.filter((item) => item.completed).map((item) => item.level.id)),
    [levelEvidence]
  );
  const activeLevelStateKey = activeLevels.map((level) => `${level.id}:${level.levelNumber}`).join("|");

  useEffect(() => {
    if (!progress?.playerId || activeLevels.length === 0) {
      return;
    }

    const activeLevelById = new Map(activeLevels.map((level) => [level.id, level]));
    const activeQuestionIdsByLevel = new Map(
      activeLevels.map((level) => [
        level.id,
        new Set(
          questions
            .filter((question) => question.levelId === level.id && question.isActive)
            .map((question) => question.id)
        )
      ])
    );

    for (const session of activeSessions) {
      if (session.playerId !== progress.playerId || session.categoryId !== categoryId) {
        continue;
      }

      const sessionLevel = activeLevelById.get(session.levelId);
      const activeQuestionIds = sessionLevel ? activeQuestionIdsByLevel.get(sessionLevel.id) ?? new Set<string>() : null;
      const shouldClearSession =
        !sessionLevel ||
        completedLevelIds.has(sessionLevel.id) ||
        !activeQuestionIds ||
        !canResumeSession(session, sessionLevel, activeQuestionIds);

      if (shouldClearSession) {
        usePlayerStore.getState().clearActiveSession(categoryId, session.levelId);
      }
    }
  }, [activeLevelStateKey, activeLevels, activeSessions, categoryId, completedLevelIds, progress?.playerId, questions]);

  return levelEvidence
    .map(({ level, activeQuestionIds, answeredEvents, completed }) => {
      const activeQuestionCount = activeQuestionIds.size;
      const status: LevelMapStatus =
        completed ? "completed" : level.levelNumber === currentLevel ? "current" : "locked";
      const savedSession = activeSessions.some(
        (session) =>
          status === "current" &&
          session.playerId === progress?.playerId &&
          session.categoryId === categoryId &&
          session.levelId === level.id &&
          canResumeSession(session, level, activeQuestionIds)
      );
      const correctAnswers = answeredEvents.filter((event) => event.isCorrect).length;

      return {
        ...level,
        activeQuestionCount,
        status,
        earnedStars: completed ? calculateStars(correctAnswers, level.questionCount) : 0,
        savedSession
      };
    });
}
