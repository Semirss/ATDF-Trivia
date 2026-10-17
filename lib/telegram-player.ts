"use client";

import { getTelegramLaunchData, requestTelegramContact } from "@/lib/telegram-webapp";
import { isUuid } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";
import type { Player, PlayerSnapshot } from "@/lib/types";

let pendingTelegramSync: Promise<PlayerSnapshot | null> | null = null;
let pendingTelegramLookup: Promise<TelegramPlayerLookup | null> | null = null;
let pendingTelegramPhoneRequest: Promise<TelegramPlayerLookup | null> | null = null;

const contactSyncAttempts = 10;
const contactSyncDelayMs = 900;
const contactSentStatus = "sent";
const contactCancelledStatus = "cancelled";
const telegramRequestTimeoutMs = 12_000;

export interface TelegramPlayerLookup {
  exists: boolean;
  player: Player | null;
  telegramProfile: {
    id: string;
    name: string;
    username: string | null;
    phone: string;
    age: number | null;
  };
}

function telegramRequestBody(mode: "lookup" | "sync") {
  const launchData = getTelegramLaunchData();

  if (!launchData?.initData) {
    return null;
  }

  const currentPlayerId = usePlayerStore.getState().playerId;

  return {
    initData: launchData.initData,
    startParam: launchData.startParam,
    currentPlayerId: isUuid(currentPlayerId) ? currentPlayerId : undefined,
    mode
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchTelegramPlayer(body: ReturnType<typeof telegramRequestBody>) {
  if (!body) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), telegramRequestTimeoutMs);

  try {
    return await fetch("/api/game/telegram-player", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function contactRequestKey(telegramId: string) {
  return `trivia-telegram-contact-${telegramId}`;
}

function getContactRequestStatus(telegramId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const key = contactRequestKey(telegramId);
  const sessionStatus = window.sessionStorage.getItem(key);

  // Older builds stored a permanent "sent" marker before the webhook existed.
  // Remove it so users can share contact again on a fresh Telegram session.
  if (window.localStorage.getItem(key)) {
    window.localStorage.removeItem(key);
  }

  return sessionStatus;
}

function markContactRequestStatus(telegramId: string, status: typeof contactSentStatus | typeof contactCancelledStatus) {
  if (typeof window === "undefined") {
    return;
  }

  const key = contactRequestKey(telegramId);
  window.sessionStorage.setItem(key, status);
  window.localStorage.removeItem(key);
}

export async function lookupTelegramPlayerFromWebApp() {
  const body = telegramRequestBody("lookup");

  if (!body) {
    return null;
  }

  if (pendingTelegramLookup) {
    return pendingTelegramLookup;
  }

  pendingTelegramLookup = fetchTelegramPlayer(body)
    .then(async (response) => {
      if (!response?.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        data: TelegramPlayerLookup;
      };

      return payload.data;
    })
    .catch(() => null)
    .finally(() => {
      pendingTelegramLookup = null;
    });

  return pendingTelegramLookup;
}

async function waitForTelegramPhoneAfterContact() {
  const initialLookup = await lookupTelegramPlayerFromWebApp();

  if (!initialLookup || initialLookup.telegramProfile.phone) {
    return initialLookup;
  }

  const telegramId = initialLookup.telegramProfile.id;
  if (getContactRequestStatus(telegramId)) {
    return initialLookup;
  }

  const shared = await requestTelegramContact();
  if (!shared) {
    markContactRequestStatus(telegramId, contactCancelledStatus);
    return initialLookup;
  }

  markContactRequestStatus(telegramId, contactSentStatus);
  let latestLookup = initialLookup;

  for (let attempt = 0; attempt < contactSyncAttempts; attempt += 1) {
    await wait(contactSyncDelayMs);
    const nextLookup = await lookupTelegramPlayerFromWebApp();

    if (!nextLookup) {
      continue;
    }

    latestLookup = nextLookup;

    if (nextLookup.telegramProfile.phone) {
      break;
    }
  }

  return latestLookup;
}

async function ensureTelegramPhoneBeforeSync() {
  if (pendingTelegramPhoneRequest) {
    return pendingTelegramPhoneRequest;
  }

  pendingTelegramPhoneRequest = waitForTelegramPhoneAfterContact().finally(() => {
    pendingTelegramPhoneRequest = null;
  });

  return pendingTelegramPhoneRequest;
}

export async function syncTelegramPlayerFromWebApp(options: { requestPhone?: boolean } = {}) {
  const body = telegramRequestBody("sync");

  if (!body) {
    return null;
  }

  if (pendingTelegramSync) {
    return pendingTelegramSync;
  }

  if (options.requestPhone !== false) {
    await ensureTelegramPhoneBeforeSync();
  }

  pendingTelegramSync = fetchTelegramPlayer(body)
    .then(async (response) => {
      if (!response?.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        data: {
          player: Player;
          snapshot: PlayerSnapshot | null;
        };
      };

      if (payload.data.snapshot) {
        usePlayerStore.getState().hydrateSnapshot(payload.data.snapshot);
        return payload.data.snapshot;
      }

      usePlayerStore.getState().setProfile(payload.data.player);
      return null;
    })
    .catch(() => null)
    .finally(() => {
      pendingTelegramSync = null;
    });

  return pendingTelegramSync;
}
