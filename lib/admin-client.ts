import type {
  AdminAnalyticsSummary,
  AdminPlayerDetail,
  AdminOverview,
  AdminPlayerSummary,
  CategoryFormValues,
  GameConfig,
  GameContent,
  LeaderboardRow,
  LevelFormValues,
  Message,
  QuestionFormValues,
  UploadAssetResponse
} from "@/lib/types";

export interface RuntimeDatabaseStatus {
  source: "master" | "runtime";
  activeUrl: string | null;
  masterUrl: string | null;
  updatedAt: string | null;
  masterConfigured: boolean;
  encryptionConfigured: boolean;
  serviceRoleConfigured: boolean;
}

export interface RuntimeDatabaseTestResult {
  host: string;
  counts: { players: number; categories: number; gameConfig: number };
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  const requestInput =
    method === "GET" && typeof input === "string" && input.startsWith("/api/admin/")
      ? `${input}${input.includes("?") ? "&" : "?"}_fresh=${Date.now()}`
      : input;

  const response = await fetch(requestInput, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, max-age=0",
      Pragma: "no-cache",
      ...(init?.headers ?? {})
    }
  });

  const responseText = await response.text();
  let payload: { error?: string } & Record<string, unknown> = {};

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as { error?: string } & Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status} ${response.statusText || "Unknown error"}).`);
  }

  return payload as T;
}

export async function fetchRemoteContent() {
  const payload = await requestJson<{ data: GameContent }>(`/api/admin/content?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache"
    }
  });
  return payload.data;
}

export async function createRemoteCategory(values: CategoryFormValues) {
  return requestJson<{ data: { id: string } }>("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(values)
  });
}

export async function updateRemoteCategory(id: string, values: CategoryFormValues) {
  return requestJson<{ data: { id: string } }>(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(values)
  });
}

export async function createRemoteLevel(categoryId: string, levelNumber: number, values: LevelFormValues) {
  return requestJson<{ data: { id: string } }>("/api/admin/levels", {
    method: "POST",
    body: JSON.stringify({ ...values, categoryId, levelNumber })
  });
}

export async function createRemoteQuestion(levelId: string, sortOrder: number, values: QuestionFormValues) {
  return requestJson<{ data: { id: string } }>("/api/admin/questions", {
    method: "POST",
    body: JSON.stringify({ ...values, levelId, sortOrder })
  });
}

export async function bulkImportRemoteQuestions(levelId: string, questions: QuestionFormValues[]) {
  return requestJson<{ data: Array<{ id: string }> }>("/api/admin/questions/bulk-import", {
    method: "POST",
    body: JSON.stringify({ levelId, questions })
  });
}

export async function bulkRemoveRemoteQuestions(levelIds: string[]) {
  return requestJson<{ data: { removed: number } }>("/api/admin/questions/bulk-remove", {
    method: "POST",
    body: JSON.stringify({ levelIds })
  });
}

export async function deleteRemoteCategory(id: string) {
  return requestJson<{ ok: true }>(`/api/admin/categories/${id}`, {
    method: "DELETE"
  });
}

export async function updateRemoteCategoryPartial(id: string, values: Partial<CategoryFormValues> & { sortOrder?: number }) {
  return requestJson<{ data: { id: string } }>(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(values)
  });
}

export async function updateRemoteLevel(id: string, values: Partial<LevelFormValues> & { levelNumber?: number }) {
  return requestJson<{ data: { id: string } }>(`/api/admin/levels/${id}`, {
    method: "PUT",
    body: JSON.stringify(values)
  });
}

export async function deleteRemoteLevel(id: string) {
  return requestJson<{ ok: true }>(`/api/admin/levels/${id}`, {
    method: "DELETE"
  });
}

export async function updateRemoteQuestion(id: string, values: Partial<QuestionFormValues>) {
  return requestJson<{ data: { id: string } }>(`/api/admin/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(values)
  });
}

export async function deleteRemoteQuestion(id: string) {
  return requestJson<{ ok: true }>(`/api/admin/questions/${id}`, {
    method: "DELETE"
  });
}

export async function fetchAdminOverview() {
  const payload = await requestJson<{ data: AdminOverview }>(`/api/admin/overview?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache"
    }
  });
  return payload.data;
}

export async function fetchAdminAnalytics() {
  const payload = await requestJson<{ data: AdminAnalyticsSummary }>("/api/admin/analytics", { cache: "no-store" });
  return payload.data;
}

export async function fetchAdminPlayers() {
  const payload = await requestJson<{ data: AdminPlayerSummary[] }>("/api/admin/players", { cache: "no-store" });
  return payload.data;
}

export async function fetchAdminPlayerDetail(id: string) {
  const payload = await requestJson<{ data: AdminPlayerDetail }>(`/api/admin/players/${id}`, { cache: "no-store" });
  return payload.data;
}

export async function createAdminPlayer(values: { name: string; age: number; avatarUrl?: string }) {
  const payload = await requestJson<{ data: { id: string } }>("/api/admin/players", {
    method: "POST",
    body: JSON.stringify(values)
  });
  return payload.data;
}

export async function updateAdminPlayer(id: string, values: { name: string; age: number; avatarUrl?: string }) {
  const payload = await requestJson<{ data: { id: string } }>(`/api/admin/players/${id}`, {
    method: "PUT",
    body: JSON.stringify(values)
  });
  return payload.data;
}

export async function deleteAdminPlayer(id: string) {
  return requestJson<{ ok: true }>(`/api/admin/players/${id}`, {
    method: "DELETE"
  });
}

export async function resetAdminPlayerProgress(id: string) {
  return requestJson<{ ok: true }>(`/api/admin/players/${id}/progress`, {
    method: "DELETE"
  });
}

export async function fetchAdminMessages() {
  const payload = await requestJson<{ data: Message[] }>("/api/admin/messages", { cache: "no-store" });
  return payload.data;
}

export async function sendAdminPlayerMessage(playerId: string, text: string) {
  const payload = await requestJson<{ data: Message }>("/api/admin/messages", {
    method: "POST",
    body: JSON.stringify({ playerId, text })
  });
  return payload.data;
}

export async function deleteRemoteMessage(messageId: string) {
  return requestJson<{ ok: true }>("/api/admin/messages", {
    method: "DELETE",
    body: JSON.stringify({ messageId })
  });
}

export async function deleteRemoteMessagesByPlayer(playerId: string) {
  return requestJson<{ ok: true }>("/api/admin/messages", {
    method: "DELETE",
    body: JSON.stringify({ playerId })
  });
}

export async function fetchRemoteConfig() {
  const payload = await requestJson<{ data: GameConfig }>("/api/admin/config", { cache: "no-store" });
  return payload.data;
}

export async function fetchRuntimeDatabaseStatus() {
  const payload = await requestJson<{ data: RuntimeDatabaseStatus }>("/api/admin/database", { cache: "no-store" });
  return payload.data;
}

export async function testRuntimeDatabase(values: { url: string; anonKey: string; serviceRoleKey: string }) {
  const payload = await requestJson<{ data: RuntimeDatabaseTestResult }>("/api/admin/database", {
    method: "POST",
    body: JSON.stringify(values)
  });
  return payload.data;
}

export async function activateRuntimeDatabase(values: { url: string; anonKey: string; serviceRoleKey: string }) {
  const payload = await requestJson<{ data: { status: RuntimeDatabaseStatus; test: RuntimeDatabaseTestResult } }>("/api/admin/database", {
    method: "PUT",
    body: JSON.stringify(values)
  });
  return payload.data;
}

export async function revertRuntimeDatabase() {
  const payload = await requestJson<{ data: RuntimeDatabaseStatus }>("/api/admin/database", { method: "DELETE" });
  return payload.data;
}

export async function updateRemoteConfig(values: GameConfig) {
  const payload = await requestJson<{ data: GameConfig }>("/api/admin/config", {
    method: "PUT",
    body: JSON.stringify(values)
  });
  return payload.data;
}

export async function fetchRemoteLeaderboard(limit?: number) {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const payload = await requestJson<{ data: LeaderboardRow[] }>(`/api/admin/leaderboard${query}`, {
    cache: "no-store"
  });
  return payload.data;
}

export async function fetchRemoteLeaderboardRow(playerId: string) {
  const payload = await requestJson<{ data: LeaderboardRow | null }>(
    `/api/admin/leaderboard?playerId=${encodeURIComponent(playerId)}`,
    {
      cache: "no-store"
    }
  );
  return payload.data;
}

export async function uploadAdminAsset(file: File, folder: string) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("folder", folder);

  const response = await fetch("/api/admin/uploads", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Upload failed.");
  }

  const payload = (await response.json()) as { data: UploadAssetResponse };
  return payload.data;
}
