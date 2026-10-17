import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CategoryLevel, LeaderboardRow, Message, Player, PlayerProgress, PlayerSnapshot, RewardProfile, ScoreEvent } from "@/lib/types";

export class GameRequestError extends Error {
  status: number;
  code?: string;
  missingQuestionIds: string[];

  constructor(message: string, status: number, payload: { code?: string; missingQuestionIds?: string[] } = {}) {
    super(message);
    this.name = "GameRequestError";
    this.status = status;
    this.code = payload.code;
    this.missingQuestionIds = payload.missingQuestionIds ?? [];
  }
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 0) {
  const timeoutController = timeoutMs > 0 ? new AbortController() : null;
  const sourceSignal = init?.signal;
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const forwardAbort = () => timeoutController?.abort();
  if (timeoutController && sourceSignal) {
    if (sourceSignal.aborted) {
      timeoutController.abort();
    } else {
      sourceSignal.addEventListener("abort", forwardAbort, { once: true });
    }
  }

  if (timeoutController) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, timeoutMs);
  }

  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      signal: timeoutController?.signal ?? sourceSignal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    if (timedOut) {
      throw new Error("Connection is too slow. Please try again.");
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    sourceSignal?.removeEventListener("abort", forwardAbort);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      missingQuestionIds?: string[];
    };
    throw new GameRequestError(payload.error ?? "Request failed.", response.status, payload);
  }

  return (await response.json()) as T;
}

export async function saveRemotePlayer(payload: {
  playerId?: string;
  name: string;
  age: number;
  avatarUrl?: string;
}) {
  const response = await requestJson<{ data: Player }>("/api/game/player", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function uploadPlayerAvatar(playerId: string, file: File) {
  const formData = new FormData();
  formData.set("playerId", playerId);
  formData.set("file", file);

  const response = await fetch("/api/game/player/avatar", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Avatar upload failed.");
  }

  const payload = (await response.json()) as { data: Player };
  return payload.data;
}

export async function saveRemoteRewardProfile(payload: {
  playerId: string;
  fullName: string;
  phone: string;
  email: string;
  telegramUsername: string;
}) {
  const response = await requestJson<{ data: RewardProfile }>("/api/game/player/reward-profile", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function postRemoteMessage(payload: { playerId: string; text: string; replyToMessageId?: string }) {
  const response = await requestJson<{ data: Message }>("/api/game/messages", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function submitQuestionSuggestion(payload: {
  playerId?: string | null;
  playerName?: string | null;
  questionText: string;
}) {
  const response = await requestJson<{ data: { id: string } }>("/api/game/question-submissions", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function initializeDonation(payload: {
  amount: number;
  playerId?: string | null;
  donorName?: string | null;
  donorEmail?: string | null;
  donorPhone?: string | null;
}, signal?: AbortSignal) {
  const response = await requestJson<{ data: { txRef: string; checkoutUrl: string } }>("/api/game/donations/initialize", {
    method: "POST",
    body: JSON.stringify(payload),
    signal
  });

  return response.data;
}

export async function verifyDonation(txRef: string) {
  const response = await requestJson<{
    data: {
      txRef: string;
      playerId: string | null;
      amount: number;
      currency: "ETB";
      status: "pending" | "success" | "failed" | "cancelled" | "refunded";
      amountMatches: boolean;
      currencyMatches: boolean;
      referenceMatches: boolean;
      modeMatches: boolean;
    };
  }>(`/api/game/donations/verify?tx_ref=${encodeURIComponent(txRef)}`, { cache: "no-store" });

  return response.data;
}

export async function fetchRemoteMessages(options: { before?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.before) {
    params.set("before", options.before);
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const response = await requestJson<{ data: Message[] }>(`/api/game/messages${query ? `?${query}` : ""}`, { cache: "no-store" });
  return response.data;
}

export async function fetchGameLeaderboard(limit?: number) {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const response = await requestJson<{ data: LeaderboardRow[] }>(`/api/game/leaderboard${query}`, {
    cache: "no-store"
  });
  return response.data;
}

export async function fetchGameLeaderboardRow(playerId: string) {
  const response = await requestJson<{ data: LeaderboardRow | null }>(
    `/api/game/leaderboard?playerId=${encodeURIComponent(playerId)}`,
    { cache: "no-store" }
  );
  return response.data;
}

export async function createRemotePlayerAccount(payload: {
  playerId: string;
  fullName?: string;
  email: string;
  password: string;
  phone?: string;
  telegramUsername?: string;
}) {
  const response = await requestJson<{ data: { email: string; rewardProfile: RewardProfile | null } }>("/api/game/player/account", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function loginRemotePlayerAccount(payload: { email: string; password: string }) {
  const supabase = await createBrowserSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase public client is not configured.");
  }

  const signedIn = await supabase.auth.signInWithPassword({
    email: payload.email.trim().toLowerCase(),
    password: payload.password
  });

  if (signedIn.error || !signedIn.data.session?.access_token) {
    throw new Error(signedIn.error?.message ?? "Unable to sign in.");
  }

  const response = await requestJson<{ data: { email: string; snapshot: PlayerSnapshot } }>("/api/game/player/account", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${signedIn.data.session.access_token}`
    }
  });

  return response.data;
}

export async function recordRemoteScore(payload: {
  playerId: string;
  categoryId: string;
  levelId: string;
  questionId: string;
  currentStreak: number;
  selectedOption: "a" | "b" | "c" | "d" | null;
}, options: { keepalive?: boolean } = {}) {
  return requestJson<{
    isCorrect: boolean;
    points: number;
    correctOption: "a" | "b" | "c" | "d";
    event: ScoreEvent;
  }>("/api/game/score", {
    method: "POST",
    keepalive: options.keepalive,
    body: JSON.stringify(payload)
  }, 25000);
}

export async function recordRemoteGameSession(payload: {
  sessionId: string;
  playerId: string;
  categoryId: string;
  levelId: string;
}) {
  return requestJson<{ ok: true }>("/api/game/sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function recordRemoteAdView(payload: {
  viewId: string;
  playerId?: string | null;
  videoId: string;
  videoUrl: string;
  event: "started" | "completed";
  watchedSeconds?: number;
}) {
  return requestJson<{ ok: true }>("/api/game/ad-views", {
    method: "POST",
    keepalive: true,
    body: JSON.stringify(payload)
  });
}

export async function saveRemoteProgress(payload: {
  playerId: string;
  categoryId: string;
  currentLevel: number;
  sessionScore: number;
  questionIds: string[];
}) {
  return requestJson<{
    nextLevel: CategoryLevel | null;
    categoryComplete: boolean;
    progress: PlayerProgress;
  }>("/api/game/progress", {
    method: "POST",
    body: JSON.stringify(payload)
  }, 25000);
}
