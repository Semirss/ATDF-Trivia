"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultLanguage, normalizeLanguage } from "@/lib/i18n";
import { makeId, nowIso } from "@/lib/utils";
import type { AppLanguage } from "@/lib/i18n";
import type { Player, PlayerProgress, PlayerSnapshot, RewardProfile, SavedGameSession, ScoreEvent } from "@/lib/types";

interface PlayerState {
  isLoaded: boolean;
  playerId: string | null;
  name: string | null;
  age: number | null;
  avatarUrl: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  telegramPhone: string | null;
  source: "web" | "telegram" | null;
  language: AppLanguage;
  createdAt: string | null;
  accountEmail: string | null;
  rewardProfiles: RewardProfile[];
  progress: PlayerProgress[];
  scoreEvents: ScoreEvent[];
  activeSessions: SavedGameSession[];
  setLanguage: (language: AppLanguage) => void;
  setProfile: (player: Player) => void;
  hydrateSnapshot: (snapshot: PlayerSnapshot) => void;
  linkAccount: (email: string) => void;
  clearProfile: () => void;
  saveRewardProfile: (profile: RewardProfile) => void;
  getProgress: (categoryId: string) => PlayerProgress | null;
  ensureProgress: (categoryId: string) => PlayerProgress | null;
  updateQuestionIndex: (categoryId: string, questionIndex: number) => void;
  saveActiveSession: (session: Omit<SavedGameSession, "id" | "playerId" | "updatedAt">) => void;
  clearActiveSession: (categoryId: string, levelId: string) => void;
  clearActiveSessionsForCategory: (categoryId: string) => void;
  recordScoreEvent: (event: ScoreEvent) => void;
  completeLevel: (categoryId: string, currentLevel: number, sessionScore: number, hasNextLevel: boolean) => void;
  replaceProgress: (progress: PlayerProgress) => void;
  resetProgress: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      isLoaded: false,
      playerId: null,
      name: null,
      age: null,
      avatarUrl: null,
      telegramId: null,
      telegramUsername: null,
      telegramPhone: null,
      source: null,
      language: defaultLanguage,
      createdAt: null,
      accountEmail: null,
      rewardProfiles: [],
      progress: [],
      scoreEvents: [],
      activeSessions: [],
      setLanguage(language) {
        set({ language: normalizeLanguage(language) });
      },
      setProfile(player) {
        set({
          playerId: player.id,
          name: player.name,
          age: player.age,
          createdAt: player.createdAt,
          avatarUrl: player.avatarUrl ?? null,
          telegramId: player.telegramId ?? null,
          telegramUsername: player.telegramUsername ?? null,
          telegramPhone: player.telegramPhone ?? null,
          source: player.source ?? "web",
          isLoaded: true
        });
      },
      hydrateSnapshot(snapshot) {
        set((state) => ({
          playerId: snapshot.player.id,
          name: snapshot.player.name,
          age: snapshot.player.age,
          avatarUrl: snapshot.player.avatarUrl ?? null,
          telegramId: snapshot.player.telegramId ?? null,
          telegramUsername: snapshot.player.telegramUsername ?? null,
          telegramPhone: snapshot.player.telegramPhone ?? null,
          source: snapshot.player.source ?? "web",
          createdAt: snapshot.player.createdAt,
          rewardProfiles: snapshot.rewardProfiles,
          progress: snapshot.progress,
          scoreEvents: snapshot.scoreEvents,
          activeSessions: state.activeSessions.filter((session) => session.playerId === snapshot.player.id),
          isLoaded: true
        }));
      },
      linkAccount(email) {
        set({ accountEmail: email });
      },
      clearProfile() {
        set({
          isLoaded: true,
          playerId: null,
          name: null,
          age: null,
          avatarUrl: null,
          telegramId: null,
          telegramUsername: null,
          telegramPhone: null,
          source: null,
          createdAt: null,
          accountEmail: null,
          rewardProfiles: [],
          progress: [],
          scoreEvents: [],
          activeSessions: []
        });
      },
      saveRewardProfile(profile) {
        const playerId = get().playerId;
        if (!playerId || profile.playerId !== playerId) {
          return;
        }

        set((state) => ({
          rewardProfiles: [profile, ...state.rewardProfiles.filter((item) => item.playerId !== playerId)]
        }));
      },
      getProgress(categoryId) {
        const playerId = get().playerId;
        if (!playerId) {
          return null;
        }

        return get().progress.find((progress) => progress.playerId === playerId && progress.categoryId === categoryId) ?? null;
      },
      ensureProgress(categoryId) {
        const playerId = get().playerId;
        if (!playerId) {
          return null;
        }

        const existing = get().progress.find(
          (progress) => progress.playerId === playerId && progress.categoryId === categoryId
        );

        if (existing) {
          return existing;
        }

        const created: PlayerProgress = {
          id: makeId("progress"),
          playerId,
          categoryId,
          currentLevel: 1,
          currentQuestionIndex: 0,
          score: 0,
          levelsCompleted: 0,
          lastPlayedAt: nowIso()
        };

        set((state) => ({ progress: [...state.progress, created] }));
        return created;
      },
      updateQuestionIndex(categoryId, questionIndex) {
        const playerId = get().playerId;
        if (!playerId) {
          return;
        }

        set((state) => ({
          progress: state.progress.map((progress) =>
            progress.playerId === playerId && progress.categoryId === categoryId
              ? { ...progress, currentQuestionIndex: questionIndex, lastPlayedAt: nowIso() }
              : progress
          )
        }));
      },
      saveActiveSession(session) {
        const playerId = get().playerId;
        if (!playerId) {
          return;
        }

        const savedSession: SavedGameSession = {
          id: makeId("session"),
          playerId,
          ...session,
          updatedAt: nowIso()
        };

        set((state) => ({
          activeSessions: [
            savedSession,
            ...state.activeSessions.filter(
              (item) =>
                !(
                  item.playerId === playerId &&
                  item.categoryId === session.categoryId &&
                  item.levelId === session.levelId
                )
            )
          ]
        }));
      },
      clearActiveSession(categoryId, levelId) {
        const playerId = get().playerId;
        if (!playerId) {
          return;
        }

        set((state) => ({
          activeSessions: state.activeSessions.filter(
            (session) =>
              !(session.playerId === playerId && session.categoryId === categoryId && session.levelId === levelId)
          )
        }));
      },
      clearActiveSessionsForCategory(categoryId) {
        const playerId = get().playerId;
        if (!playerId) {
          return;
        }

        set((state) => ({
          activeSessions: state.activeSessions.filter(
            (session) => !(session.playerId === playerId && session.categoryId === categoryId)
          )
        }));
      },
      recordScoreEvent(event) {
        const playerId = get().playerId;
        if (!playerId || event.playerId !== playerId) {
          return;
        }

        set((state) => ({
          scoreEvents: [event, ...state.scoreEvents.filter((item) => item.id !== event.id)]
        }));
      },
      completeLevel(categoryId, currentLevel, sessionScore, hasNextLevel) {
        const playerId = get().playerId;
        if (!playerId) {
          return;
        }

        const existing = get().ensureProgress(categoryId);
        if (!existing) {
          return;
        }

        const nextProgress: PlayerProgress = {
          ...existing,
          currentLevel: hasNextLevel ? currentLevel + 1 : currentLevel,
          currentQuestionIndex: 0,
          score: existing.score + sessionScore,
          levelsCompleted: Math.max(existing.levelsCompleted, currentLevel),
          lastPlayedAt: nowIso()
        };

        set((state) => ({
          progress: state.progress.map((progress) => (progress.id === existing.id ? nextProgress : progress)),
          activeSessions: state.activeSessions.filter(
            (session) => !(session.playerId === playerId && session.categoryId === categoryId)
          )
        }));
      },
      replaceProgress(progress) {
        set((state) => ({
          progress: [
            progress,
            ...state.progress.filter(
              (item) => !(item.playerId === progress.playerId && item.categoryId === progress.categoryId)
            )
          ]
        }));
      },
      resetProgress() {
        set({ progress: [], scoreEvents: [], activeSessions: [] });
      }
    }),
    {
      name: "trivia-quest-player",
      storage: createJSONStorage(() => localStorage),
      version: 1
    }
  )
);
