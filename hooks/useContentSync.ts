"use client";

import { useEffect } from "react";
import { fetchRemoteMessages } from "@/lib/game-client";
import { useContentStore } from "@/store/contentStore";
import type { GameContent, Message } from "@/lib/types";

const contentCacheKey = "trivia-game-content-v2";
const gameBootstrapCacheKey = "trivia-game-bootstrap-v2";
const messagesCacheKey = "trivia-game-messages-v2";
const contentRequestVersion = "3";
const contentFreshnessMs = 5 * 60_000;
const categoryFreshnessMs = 10 * 60_000;
const messagesFreshnessMs = 30_000;
let contentSyncPromise: Promise<void> | null = null;
let gameBootstrapSyncPromise: Promise<void> | null = null;
let messagesSyncPromise: Promise<Message[]> | null = null;
let lastRecentMessages: Message[] | null = null;
let lastContentSyncAt = 0;
let lastGameBootstrapSyncAt = 0;
let lastMessagesSyncAt = 0;
const categorySyncPromises = new Map<string, Promise<CategoryContentMeta>>();
const categorySyncResults = new Map<
  string,
  { categoryId: string; data: GameContent; includePrevious: boolean; meta: CategoryContentMeta; syncedAt: number }
>();

interface SyncOptions {
  force?: boolean;
}

export interface CategoryContentMeta {
  startLevel: number;
  limit: number;
  totalLevels: number;
  hasPrevious: boolean;
  hasMore: boolean;
}

function contentWithCurrentMessages(content: GameContent) {
  return {
    ...content,
    messages: useContentStore.getState().messages
  };
}

function cacheGameContent(content: GameContent) {
  if (typeof window === "undefined") {
    return;
  }

  const write = () => {
    try {
      window.localStorage.setItem(contentCacheKey, JSON.stringify({ content, cachedAt: Date.now() }));
    } catch {
      // Storage can be unavailable in privacy mode; the network path still works.
    }
  };

  const requestIdleCallback = (
    window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;

  if (requestIdleCallback) {
    requestIdleCallback(write, { timeout: 2_000 });
  } else {
    window.setTimeout(write, 250);
  }
}

function cacheGameBootstrap(content: GameContent) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(gameBootstrapCacheKey, JSON.stringify({ content, cachedAt: Date.now() }));
  } catch {
    // The network path remains available when storage is disabled.
  }
}

function hydrateCachedGameContent() {
  if (typeof window === "undefined" || useContentStore.getState().isLoaded) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(contentCacheKey);
    if (!raw) {
      return;
    }

    const cached = JSON.parse(raw) as { content?: GameContent };
    if (
      !cached.content ||
      !Array.isArray(cached.content.categories) ||
      !Array.isArray(cached.content.levels) ||
      !Array.isArray(cached.content.questions)
    ) {
      return;
    }

    useContentStore.getState().replaceContent(contentWithCurrentMessages(cached.content));
  } catch {
    window.localStorage.removeItem(contentCacheKey);
  }
}

function hydrateCachedGameBootstrap() {
  if (typeof window === "undefined" || useContentStore.getState().isLoaded) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(gameBootstrapCacheKey);
    if (!raw) {
      return;
    }

    const cached = JSON.parse(raw) as { content?: GameContent };
    if (!cached.content || !Array.isArray(cached.content.categories)) {
      return;
    }

    useContentStore.getState().replaceGameBootstrap(contentWithCurrentMessages(cached.content));
  } catch {
    window.localStorage.removeItem(gameBootstrapCacheKey);
  }
}

function hydrateCachedMessages() {
  if (typeof window === "undefined" || useContentStore.getState().messages.length > 0) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(messagesCacheKey);
    if (!raw) {
      return;
    }

    const messages = JSON.parse(raw) as Message[];
    if (Array.isArray(messages)) {
      useContentStore.getState().replaceMessages(messages.slice(0, 80));
    }
  } catch {
    window.localStorage.removeItem(messagesCacheKey);
  }
}

export function syncGameContent({ force = false }: SyncOptions = {}) {
  if (!force && lastContentSyncAt > 0 && Date.now() - lastContentSyncAt < contentFreshnessMs) {
    return Promise.resolve();
  }

  if (contentSyncPromise) {
    return contentSyncPromise;
  }

  contentSyncPromise = (async () => {
    try {
      const response = await fetch(`/api/game/content?v=${contentRequestVersion}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!useContentStore.getState().isLoaded) {
          useContentStore.getState().setLoadError(payload.error ?? "Unable to load content.");
        }
        return;
      }

      const payload = (await response.json()) as { data: GameContent };
      useContentStore.getState().replaceContent(contentWithCurrentMessages(payload.data));
      lastContentSyncAt = Date.now();
      cacheGameContent(payload.data);
    } catch (error) {
      if (!useContentStore.getState().isLoaded) {
        useContentStore.getState().setLoadError(error instanceof Error ? error.message : "Unable to load content.");
      }
    } finally {
      contentSyncPromise = null;
    }
  })();

  return contentSyncPromise;
}

export function syncGameBootstrap({ force = false }: SyncOptions = {}) {
  if (!force && lastGameBootstrapSyncAt > 0 && Date.now() - lastGameBootstrapSyncAt < contentFreshnessMs) {
    return Promise.resolve();
  }

  if (gameBootstrapSyncPromise) {
    return gameBootstrapSyncPromise;
  }

  gameBootstrapSyncPromise = (async () => {
    try {
      const response = await fetch(`/api/game/content?scope=bootstrap&v=${contentRequestVersion}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!useContentStore.getState().isLoaded) {
          useContentStore.getState().setLoadError(payload.error ?? "Unable to load content.");
        }
        return;
      }

      const payload = (await response.json()) as { data: GameContent };
      useContentStore.getState().replaceGameBootstrap(contentWithCurrentMessages(payload.data));
      lastGameBootstrapSyncAt = Date.now();
      cacheGameBootstrap(payload.data);
    } catch (error) {
      if (!useContentStore.getState().isLoaded) {
        useContentStore.getState().setLoadError(error instanceof Error ? error.message : "Unable to load content.");
      }
    } finally {
      gameBootstrapSyncPromise = null;
    }
  })();

  return gameBootstrapSyncPromise;
}

export function syncCategoryContent({
  categoryId,
  startLevel,
  levelId,
  includePrevious = false,
  limit = 5,
  force = false
}: {
  categoryId: string;
  startLevel?: number;
  levelId?: string | null;
  includePrevious?: boolean;
  limit?: number;
  force?: boolean;
}) {
  const normalizedStart = Math.max(1, Math.floor(startLevel ?? 1));
  const normalizedLimit = Math.max(1, Math.min(5, Math.floor(limit)));
  const key = `${categoryId}:${levelId ? `level-${levelId}` : `start-${normalizedStart}`}:${normalizedLimit}:${includePrevious ? "history" : "window"}`;
  const exactCached = categorySyncResults.get(key);
  const cached =
    exactCached ??
    (levelId
      ? Array.from(categorySyncResults.values()).find(
          (result) =>
            result.categoryId === categoryId &&
            result.data.levels.some((level) => level.id === levelId)
        )
      : undefined);

  if (!force && cached && Date.now() - cached.syncedAt < categoryFreshnessMs) {
    useContentStore.getState().replaceCategoryChunk(contentWithCurrentMessages(cached.data), {
      categoryId,
      startLevel: cached.includePrevious ? 1 : cached.meta.startLevel,
      limit: cached.includePrevious ? cached.meta.startLevel + cached.meta.limit - 1 : cached.meta.limit
    });
    return Promise.resolve(cached.meta);
  }

  const activeSync = categorySyncPromises.get(key);
  if (activeSync) {
    return activeSync;
  }

  const params = new URLSearchParams({
    scope: "category",
    v: contentRequestVersion,
    categoryId,
    startLevel: String(normalizedStart),
    limit: String(normalizedLimit)
  });
  if (levelId) {
    params.set("levelId", levelId);
  }
  if (includePrevious) {
    params.set("includePrevious", "true");
  }

  const syncPromise = (async () => {
    const response = await fetch(`/api/game/content?${params.toString()}`);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? "Unable to load this map.");
    }

    const payload = (await response.json()) as { data: GameContent; meta: CategoryContentMeta };
    useContentStore.getState().replaceCategoryChunk(contentWithCurrentMessages(payload.data), {
      categoryId,
      startLevel: includePrevious ? 1 : payload.meta.startLevel,
      limit: includePrevious ? payload.meta.startLevel + payload.meta.limit - 1 : payload.meta.limit
    });
    categorySyncResults.set(key, {
      categoryId,
      data: payload.data,
      includePrevious,
      meta: payload.meta,
      syncedAt: Date.now()
    });
    return payload.meta;
  })().finally(() => {
    categorySyncPromises.delete(key);
  });

  categorySyncPromises.set(key, syncPromise);
  return syncPromise;
}

export function syncRecentMessages({ force = false }: SyncOptions = {}) {
  if (!force && lastMessagesSyncAt > 0 && Date.now() - lastMessagesSyncAt < messagesFreshnessMs) {
    return Promise.resolve(lastRecentMessages ?? useContentStore.getState().messages.slice(0, 80));
  }

  if (messagesSyncPromise) {
    return messagesSyncPromise;
  }

  messagesSyncPromise = fetchRemoteMessages({ limit: 80 })
    .then((messages) => {
      useContentStore.getState().replaceMessages(messages);
      lastRecentMessages = messages;
      lastMessagesSyncAt = Date.now();
      try {
        window.localStorage.setItem(messagesCacheKey, JSON.stringify(messages));
      } catch {
        // Realtime chat remains available when persistent storage is blocked.
      }
      return messages;
    })
    .finally(() => {
      messagesSyncPromise = null;
    });

  return messagesSyncPromise;
}

export function useContentSync() {
  useEffect(() => {
    function refreshWhenVisible() {
      if (!document.hidden) {
        void syncGameContent();
        void syncRecentMessages().catch((error) => console.error("Unable to refresh chat messages", error));
      }
    }

    hydrateCachedGameContent();
    hydrateCachedMessages();
    void syncGameContent();
    void syncRecentMessages().catch((error) => console.error("Unable to load chat messages", error));
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);
}

export function useGameContentSync() {
  useEffect(() => {
    let idleCallbackId: number | null = null;
    let messageTimerId: number | null = null;

    function loadMessagesAfterStartup() {
      void syncRecentMessages().catch((error) => console.error("Unable to load chat messages", error));
    }

    function refreshWhenVisible() {
      if (!document.hidden) {
        void syncGameBootstrap();
      }
    }

    hydrateCachedGameBootstrap();
    hydrateCachedMessages();
    void syncGameBootstrap();

    const requestIdleCallback = (
      window as unknown as {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (requestIdleCallback) {
      idleCallbackId = requestIdleCallback(loadMessagesAfterStartup, { timeout: 5_000 });
    } else {
      messageTimerId = window.setTimeout(loadMessagesAfterStartup, 3_000);
    }

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      if (idleCallbackId !== null) {
        (
          window as unknown as {
            cancelIdleCallback?: (id: number) => void;
          }
        ).cancelIdleCallback?.(idleCallbackId);
      }
      if (messageTimerId !== null) {
        window.clearTimeout(messageTimerId);
      }
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);
}
