"use client";

import { create } from "zustand";
import { makeId, nowIso } from "@/lib/utils";
import type {
  Category,
  CategoryFormValues,
  CategoryLevel,
  GameContent,
  GameConfig,
  LevelFormValues,
  Message,
  Question,
  QuestionFormValues,
  Reward
} from "@/lib/types";

const defaultConfig: GameConfig = {
  maxStreakBonus: {
    multiplier: 2,
    triggerAt: 3
  },
  defaultTimeLimitSeconds: 30,
  leaderboardDisplayCount: 100,
  youtubeAd: {
    enabled: false,
    url: "",
    urls: [],
    ads: [],
    durationSeconds: 15,
    aspectRatio: "normal",
    levelInterval: 2,
    selectionMode: "rotate",
    triggerMode: "interval",
    targetLevels: []
  }
};

const emptyContent: GameContent = {
  categories: [],
  levels: [],
  questions: [],
  messages: [],
  rewards: [],
  config: defaultConfig
};

interface ContentState {
  isLoaded: boolean;
  error: string | null;
  categories: Category[];
  levels: CategoryLevel[];
  questions: Question[];
  messages: Message[];
  rewards: Reward[];
  config: GameConfig;
  setLoadError: (error: string | null) => void;
  replaceContent: (content: GameContent) => void;
  replaceGameBootstrap: (content: GameContent) => void;
  mergeContent: (content: GameContent) => void;
  replaceCategoryChunk: (
    content: GameContent,
    window: { categoryId: string; startLevel: number; limit: number }
  ) => void;
  replaceMessages: (messages: Message[]) => void;
  appendOlderMessages: (messages: Message[]) => void;
  addCategory: (values: CategoryFormValues) => string;
  updateCategory: (id: string, values: Partial<CategoryFormValues>) => void;
  softDeleteCategory: (id: string) => void;
  reorderCategory: (id: string, direction: -1 | 1) => void;
  addLevel: (categoryId: string, values: LevelFormValues) => string;
  updateLevel: (id: string, values: Partial<LevelFormValues>) => void;
  toggleLevel: (id: string) => void;
  deleteLevel: (id: string) => void;
  reorderLevel: (id: string, direction: -1 | 1) => void;
  addQuestion: (levelId: string, values: QuestionFormValues) => string;
  updateQuestion: (id: string, values: Partial<QuestionFormValues>) => void;
  toggleQuestion: (id: string) => void;
  deleteQuestion: (id: string) => void;
  importQuestions: (levelId: string, questions: QuestionFormValues[]) => void;
  addMessage: (message: Pick<Message, "playerId" | "playerName" | "avatarUrl" | "text" | "replyToMessageId"> & { id?: string; postedAt?: string }) => void;
  deleteMessage: (id: string) => void;
  deleteMessagesByPlayer: (playerId: string) => void;
  updateConfig: (config: Partial<GameConfig>) => void;
  resetContent: () => void;
}

function sortByOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((first, second) => first.sortOrder - second.sortOrder);
}

function normalizeCategoryOrder(categories: Category[]) {
  return sortByOrder(categories).map((category, index) => ({ ...category, sortOrder: index }));
}

function normalizeLevelNumbers(levels: CategoryLevel[], categoryId: string) {
  const targetLevels = levels
    .filter((level) => level.categoryId === categoryId)
    .sort((first, second) => first.levelNumber - second.levelNumber)
    .map((level, index) => ({ ...level, levelNumber: index + 1, updatedAt: nowIso() }));

  return levels.map((level) => targetLevels.find((target) => target.id === level.id) ?? level);
}

function sortMessagesNewestFirst(messages: Message[]) {
  return [...messages].sort((first, second) => {
    const firstTime = first.postedAt ? new Date(first.postedAt).getTime() : 0;
    const secondTime = second.postedAt ? new Date(second.postedAt).getTime() : 0;
    return secondTime - firstTime;
  });
}

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map<string, Message>();

  for (const message of [...current, ...incoming]) {
    byId.set(message.id, message);
  }

  return sortMessagesNewestFirst(Array.from(byId.values()));
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const byId = new Map(current.map((item) => [item.id, item]));

  for (const item of incoming) {
    byId.set(item.id, item);
  }

  return Array.from(byId.values());
}

export const useContentStore = create<ContentState>()(
  (set, get) => ({
    isLoaded: false,
    error: null,
    ...emptyContent,
    setLoadError(error) {
      set({ error, isLoaded: true });
    },
    replaceContent(content) {
      set({ ...content, isLoaded: true, error: null });
    },
    replaceGameBootstrap(content) {
      set((state) => ({
        categories: content.categories,
        config: content.config,
        levels: state.levels,
        questions: state.questions,
        messages: state.messages,
        rewards: state.rewards,
        isLoaded: true,
        error: null
      }));
    },
    mergeContent(content) {
      set((state) => ({
        categories: normalizeCategoryOrder(mergeById(state.categories, content.categories)),
        levels: mergeById(state.levels, content.levels).sort(
          (first, second) => first.categoryId.localeCompare(second.categoryId) || first.levelNumber - second.levelNumber
        ),
        questions: mergeById(state.questions, content.questions).sort(
          (first, second) => first.levelId.localeCompare(second.levelId) || first.sortOrder - second.sortOrder
        ),
        messages: mergeMessages(state.messages, content.messages),
        rewards: mergeById(state.rewards, content.rewards),
        config: content.config,
        isLoaded: true,
        error: null
      }));
    },
    replaceCategoryChunk(content, window) {
      set((state) => {
        const endLevel = window.startLevel + window.limit;
        const replacedLevels = state.levels.filter(
          (level) =>
            level.categoryId === window.categoryId &&
            level.levelNumber >= window.startLevel &&
            level.levelNumber < endLevel
        );
        const replacedLevelIds = new Set([
          ...replacedLevels.map((level) => level.id),
          ...content.levels.map((level) => level.id)
        ]);
        const retainedLevels = state.levels.filter(
          (level) =>
            !(
              level.categoryId === window.categoryId &&
              level.levelNumber >= window.startLevel &&
              level.levelNumber < endLevel
            )
        );
        const retainedQuestions = state.questions.filter((question) => !replacedLevelIds.has(question.levelId));

        return {
          categories: normalizeCategoryOrder(mergeById(state.categories, content.categories)),
          levels: mergeById(retainedLevels, content.levels).sort(
            (first, second) => first.categoryId.localeCompare(second.categoryId) || first.levelNumber - second.levelNumber
          ),
          questions: mergeById(retainedQuestions, content.questions).sort(
            (first, second) => first.levelId.localeCompare(second.levelId) || first.sortOrder - second.sortOrder
          ),
          messages: state.messages,
          rewards: mergeById(state.rewards, content.rewards),
          config: content.config,
          isLoaded: true,
          error: null
        };
      });
    },
    replaceMessages(messages) {
      set({ messages: sortMessagesNewestFirst(messages) });
    },
    appendOlderMessages(messages) {
      set((state) => ({ messages: mergeMessages(state.messages, messages) }));
    },
    addCategory(values) {
      const id = makeId("cat");
      const timestamp = nowIso();
      const category: Category = {
        id,
        title: values.title,
        iconUrl: values.iconUrl,
        difficulty: values.difficulty,
        isRewardBased: values.isRewardBased,
        isActive: values.isActive,
        sortOrder: get().categories.length,
        colorHex: values.colorHex,
        description: values.description,
        mapBackgroundUrl: values.mapBackgroundUrl,
        levelPodiumUrl: values.levelPodiumUrl,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      set((state) => ({ categories: normalizeCategoryOrder([...state.categories, category]) }));
      return id;
    },
    updateCategory(id, values) {
      set((state) => ({
        categories: state.categories.map((category) =>
          category.id === id
            ? {
                ...category,
                ...values,
                iconUrl: values.iconUrl ?? category.iconUrl,
                mapBackgroundUrl: values.mapBackgroundUrl ?? category.mapBackgroundUrl,
                levelPodiumUrl: values.levelPodiumUrl ?? category.levelPodiumUrl,
                updatedAt: nowIso()
              }
            : category
        )
      }));
    },
    softDeleteCategory(id) {
      set((state) => ({
        categories: state.categories.map((category) =>
          category.id === id ? { ...category, isActive: false, updatedAt: nowIso() } : category
        )
      }));
    },
    reorderCategory(id, direction) {
      const categories = normalizeCategoryOrder(get().categories);
      const index = categories.findIndex((category) => category.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= categories.length) {
        return;
      }

      const next = [...categories];
      const current = next[index];
      const swap = next[nextIndex];
      next[index] = swap;
      next[nextIndex] = current;
      set({ categories: normalizeCategoryOrder(next) });
    },
    addLevel(categoryId, values) {
      const categoryLevels = get().levels.filter((level) => level.categoryId === categoryId);
      const id = makeId("level");
      const timestamp = nowIso();
      const level: CategoryLevel = {
        id,
        categoryId,
        levelNumber: categoryLevels.length + 1,
        title: values.title,
        difficulty: values.difficulty,
        questionCount: values.questionCount,
        timeLimitSeconds: values.timeLimitSeconds,
        pointsPerCorrect: values.pointsPerCorrect,
        isActive: values.isActive,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      set((state) => ({ levels: normalizeLevelNumbers([...state.levels, level], categoryId) }));
      return id;
    },
    updateLevel(id, values) {
      set((state) => ({
        levels: state.levels.map((level) =>
          level.id === id
            ? {
                ...level,
                ...values,
                questionCount: values.questionCount ?? level.questionCount,
                timeLimitSeconds: values.timeLimitSeconds ?? level.timeLimitSeconds,
                pointsPerCorrect: values.pointsPerCorrect ?? level.pointsPerCorrect,
                updatedAt: nowIso()
              }
            : level
        )
      }));
    },
    toggleLevel(id) {
      set((state) => ({
        levels: state.levels.map((level) =>
          level.id === id ? { ...level, isActive: !level.isActive, updatedAt: nowIso() } : level
        )
      }));
    },
    deleteLevel(id) {
      const level = get().levels.find((item) => item.id === id);
      if (!level) {
        return;
      }

      set((state) => ({
        levels: normalizeLevelNumbers(
          state.levels.filter((item) => item.id !== id),
          level.categoryId
        ),
        questions: state.questions.filter((question) => question.levelId !== id)
      }));
    },
    reorderLevel(id, direction) {
      const level = get().levels.find((item) => item.id === id);
      if (!level) {
        return;
      }

      const categoryLevels = get()
        .levels.filter((item) => item.categoryId === level.categoryId)
        .sort((first, second) => first.levelNumber - second.levelNumber);
      const index = categoryLevels.findIndex((item) => item.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= categoryLevels.length) {
        return;
      }

      const ordered = [...categoryLevels];
      const current = ordered[index];
      const swap = ordered[nextIndex];
      ordered[index] = swap;
      ordered[nextIndex] = current;
      const renumbered = ordered.map((item, itemIndex) => ({ ...item, levelNumber: itemIndex + 1, updatedAt: nowIso() }));

      set((state) => ({
        levels: state.levels.map((item) => renumbered.find((renumberedLevel) => renumberedLevel.id === item.id) ?? item)
      }));
    },
    addQuestion(levelId, values) {
      const levelQuestions = get().questions.filter((question) => question.levelId === levelId);
      const id = makeId("question");
      const timestamp = nowIso();
      const question: Question = {
        id,
        levelId,
        questionText: values.questionText,
        optionA: values.optionA,
        optionB: values.optionB,
        optionC: values.optionC,
        optionD: values.optionD,
        correctOption: values.correctOption,
        explanation: values.explanation,
        translations: values.translations ?? {},
        mediaUrl: values.mediaUrl,
        isActive: values.isActive,
        sortOrder: levelQuestions.length,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      set((state) => ({ questions: [...state.questions, question] }));
      return id;
    },
    updateQuestion(id, values) {
      set((state) => ({
        questions: state.questions.map((question) =>
          question.id === id ? { ...question, ...values, updatedAt: nowIso() } : question
        )
      }));
    },
    toggleQuestion(id) {
      set((state) => ({
        questions: state.questions.map((question) =>
          question.id === id ? { ...question, isActive: !question.isActive, updatedAt: nowIso() } : question
        )
      }));
    },
    deleteQuestion(id) {
      set((state) => ({ questions: state.questions.filter((question) => question.id !== id) }));
    },
    importQuestions(levelId, questionValues) {
      const timestamp = nowIso();
      const currentLength = get().questions.filter((question) => question.levelId === levelId).length;
      const imported = questionValues.map<Question>((values, index) => ({
        id: makeId("question"),
        levelId,
        questionText: values.questionText,
        optionA: values.optionA,
        optionB: values.optionB,
        optionC: values.optionC,
        optionD: values.optionD,
        correctOption: values.correctOption,
        explanation: values.explanation,
        translations: values.translations ?? {},
        mediaUrl: values.mediaUrl,
        isActive: values.isActive,
        sortOrder: currentLength + index,
        createdAt: timestamp,
        updatedAt: timestamp
      }));

      set((state) => ({ questions: [...state.questions, ...imported] }));
    },
    addMessage(message) {
      set((state) => {
        if (message.id && state.messages.some((m) => m.id === message.id)) {
          return state;
        }

        const isRecentOptimistic = state.messages.some((m) => {
          const isOptimistic = m.id.startsWith("msg-") || m.id.startsWith("temp-");
          return isOptimistic && m.playerId === message.playerId && m.text === message.text;
        });

        if (message.id && isRecentOptimistic) {
          return {
            messages: sortMessagesNewestFirst(state.messages.map((m) =>
              (m.id.startsWith("msg-") || m.id.startsWith("temp-")) &&
              m.playerId === message.playerId &&
              m.text === message.text
                ? {
                    id: message.id!,
                    playerId: message.playerId,
                    playerName: message.playerName,
                    avatarUrl: message.avatarUrl,
                    text: message.text,
                    postedAt: message.postedAt ?? nowIso(),
                    replyToMessageId: message.replyToMessageId
                  }
                : m
            ))
          };
        }

        return {
          messages: sortMessagesNewestFirst([
            {
              id: message.id ?? makeId("msg"),
              playerId: message.playerId,
              playerName: message.playerName,
              avatarUrl: message.avatarUrl,
              text: message.text,
              postedAt: message.postedAt ?? nowIso(),
              replyToMessageId: message.replyToMessageId
            },
            ...state.messages
          ])
        };
      });
    },
    deleteMessage(id) {
      set((state) => ({ messages: state.messages.filter((message) => message.id !== id) }));
    },
    deleteMessagesByPlayer(playerId) {
      set((state) => ({ messages: state.messages.filter((message) => message.playerId !== playerId) }));
    },
    updateConfig(config) {
      set((state) => ({
        config: {
          ...state.config,
          ...config,
          maxStreakBonus: {
            ...state.config.maxStreakBonus,
            ...config.maxStreakBonus
          },
          youtubeAd: {
            ...state.config.youtubeAd,
            ...config.youtubeAd
          }
        }
      }));
    },
    resetContent() {
      set({ ...emptyContent, isLoaded: false, error: null });
    }
  })
);
