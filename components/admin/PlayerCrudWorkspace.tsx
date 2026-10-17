"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Download, LoaderCircle, MessageSquare, Pencil, RotateCcw, Save, Send, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AssetUploader } from "@/components/admin/AssetUploader";
import {
  createAdminPlayer,
  deleteAdminPlayer,
  fetchAdminPlayerDetail,
  fetchAdminPlayers,
  fetchRemoteLeaderboard,
  resetAdminPlayerProgress,
  sendAdminPlayerMessage,
  updateAdminPlayer
} from "@/lib/admin-client";
import type { AdminPlayerDetail, AdminPlayerSummary, LeaderboardRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { csvTimestamp, downloadCsv } from "@/lib/csv";

const emptyForm = {
  name: "",
  age: 18,
  avatarUrl: ""
};

function AvatarBadge({
  avatarUrl,
  name,
  className
}: {
  avatarUrl?: string;
  name: string;
  className?: string;
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={cn("h-14 w-14 rounded-[18px] object-cover shadow-bevel", className)} />;
  }

  return (
    <div
      className={cn(
        "grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-[#111417] to-[#31363b] font-display text-lg font-black uppercase text-honey shadow-engine",
        className
      )}
    >
      {name.slice(0, 1) || "P"}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-black/[0.03] px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-black/45">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

export function PlayerCrudWorkspace({ mode }: { mode: "players" | "leaderboard" }) {
  const [players, setPlayers] = useState<AdminPlayerSummary[]>([]);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminPlayerDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [isSendingAdminMessage, setIsSendingAdminMessage] = useState(false);

  async function refreshWorkspace(nextSelectedId?: string | null, successMessage?: string) {
    try {
      const [playerData, leaderboardData] = await Promise.all([fetchAdminPlayers(), fetchRemoteLeaderboard()]);
      setPlayers(playerData);
      setLeaderboardRows(leaderboardData);
      setError(null);

      const fallbackId =
        nextSelectedId !== undefined
          ? nextSelectedId
          : isCreating
            ? null
            : selectedId && playerData.some((player) => player.id === selectedId)
              ? selectedId
              : playerData[0]?.id ?? null;

      setSelectedId(fallbackId);

      if (!fallbackId) {
        setDetail(null);
        setForm(emptyForm);
      } else {
        const latestDetail = await fetchAdminPlayerDetail(fallbackId);
        setDetail(latestDetail);
        setForm({
          name: latestDetail.name,
          age: latestDetail.age,
          avatarUrl: latestDetail.avatarUrl ?? ""
        });
        setIsCreating(false);
        setIsEditing(false);
      }

      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load players.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const [playerData, leaderboardData] = await Promise.all([fetchAdminPlayers(), fetchRemoteLeaderboard()]);
        if (cancelled) {
          return;
        }

        setPlayers(playerData);
        setLeaderboardRows(leaderboardData);
        setSelectedId(playerData[0]?.id ?? null);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load players.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      if (!isCreating) {
        setDetail(null);
        setForm(emptyForm);
      }
      return;
    }

    const activeSelectedId = selectedId;
    let cancelled = false;
    setIsLoadingDetail(true);

    async function loadDetail() {
      try {
        const data = await fetchAdminPlayerDetail(activeSelectedId);
        if (cancelled) {
          return;
        }

        setDetail(data);
        setForm({
          name: data.name,
          age: data.age,
          avatarUrl: data.avatarUrl ?? ""
        });
        setIsCreating(false);
        setIsEditing(false);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load player details.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [isCreating, selectedId]);

  const leaderboardById = new Map(leaderboardRows.map((row) => [row.playerId, row]));
  const byId = new Map(players.map((player) => [player.id, player]));
  const ranked = leaderboardRows
    .map((row) => byId.get(row.playerId))
    .filter((player): player is AdminPlayerSummary => Boolean(player));
  const seenPlayers = new Set(ranked.map((player) => player.id));
  const remainingPlayers = players
    .filter((player) => !seenPlayers.has(player.id))
    .sort((left, right) => right.totalScore - left.totalScore || left.name.localeCompare(right.name));
  const orderedPlayers =
    mode === "leaderboard"
      ? [...ranked, ...remainingPlayers]
      : [...players].sort((left, right) => {
          const leftStamp = left.lastPlayedAt ? new Date(left.lastPlayedAt).getTime() : 0;
          const rightStamp = right.lastPlayedAt ? new Date(right.lastPlayedAt).getTime() : 0;
          return rightStamp - leftStamp || right.totalScore - left.totalScore || left.name.localeCompare(right.name);
        });
  const filteredPlayers = orderedPlayers.filter((player) => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const rank = leaderboardById.get(player.id)?.globalRank;
    const searchable = [player.name, player.age, player.totalScore, player.categoriesPlayed, player.messageCount, player.sessionCount, rank ? `#${rank}` : ""]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visiblePlayers = filteredPlayers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const activeProgress = detail?.progressItems.filter((item) => item.levelsCompleted < item.totalLevels) ?? [];
  const completedProgress = detail?.progressItems.filter((item) => item.levelsCompleted >= item.totalLevels && item.totalLevels > 0) ?? [];
  const accuracyPercent =
    detail && detail.totalAnswers > 0 ? Math.round((detail.correctAnswers / detail.totalAnswers) * 100) : 0;

  useEffect(() => {
    setPage(1);
  }, [search, mode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function selectPlayer(playerId: string) {
    setIsCreating(false);
    setIsEditing(false);
    setSelectedId(playerId);
    setAdminMessage("");
  }

  function startCreate() {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedId(null);
    setDetail(null);
    setForm(emptyForm);
    setAdminMessage("");
  }

  function exportPlayers() {
    downloadCsv(
      `trivia-${mode}-${csvTimestamp()}.csv`,
      [
        "Rank",
        "Player ID",
        "Name",
        "Age",
        "Score",
        "Sessions",
        "Categories",
        "Levels Completed",
        "Messages",
        "Verified",
        "Joined",
        "Last Played"
      ],
      filteredPlayers.map((player) => [
        leaderboardById.get(player.id)?.globalRank ?? "",
        player.id,
        player.name,
        player.age,
        player.totalScore,
        player.sessionCount,
        player.categoriesPlayed,
        player.levelsCompleted,
        player.messageCount,
        player.rewardVerified ? "Yes" : "No",
        player.createdAt,
        player.lastPlayedAt ?? ""
      ])
    );
  }

  async function handleSave() {
    const payload = {
      name: form.name.trim(),
      age: Number(form.age),
      avatarUrl: form.avatarUrl.trim() || undefined
    };

    if (payload.name.length < 2) {
      toast.error("Player name must be at least 2 characters.");
      return;
    }

    if (!Number.isInteger(payload.age) || payload.age < 6 || payload.age > 99) {
      toast.error("Player age must be between 6 and 99.");
      return;
    }

    setIsSaving(true);

    try {
      if (isCreating) {
        const created = await createAdminPlayer(payload);
        setIsCreating(false);
        await refreshWorkspace(created.id, "Player created.");
        return;
      }

      if (!selectedId) {
        toast.error("Select a player first.");
        return;
      }

      await updateAdminPlayer(selectedId, payload);
      await refreshWorkspace(selectedId, "Player updated.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save player.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetProgress() {
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm("Reset this player's progress and score history?");
    if (!confirmed) {
      return;
    }

    setIsResetting(true);

    try {
      await resetAdminPlayerProgress(selectedId);
      await refreshWorkspace(selectedId, "Player progress reset.");
    } catch (resetError) {
      toast.error(resetError instanceof Error ? resetError.message : "Unable to reset player progress.");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm("Delete this player and all related progress, messages, and rewards?");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteAdminPlayer(selectedId);
      setDetail(null);
      await refreshWorkspace(undefined, "Player deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete player.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSendAdminMessage() {
    if (!selectedId || !detail) {
      toast.error("Select a player first.");
      return;
    }

    const trimmed = adminMessage.trim();
    if (!trimmed) {
      toast.error("Write a message first.");
      return;
    }

    setIsSendingAdminMessage(true);

    try {
      await sendAdminPlayerMessage(selectedId, trimmed);
      setAdminMessage("");
      await refreshWorkspace(selectedId, "Message sent to player.");
    } catch (messageError) {
      toast.error(messageError instanceof Error ? messageError.message : "Unable to send message.");
    } finally {
      setIsSendingAdminMessage(false);
    }
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.72fr)]">
      <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">
              {mode === "leaderboard" ? "Ranked Players" : "Live Players"}
            </div>
            <h2 className="text-lg font-black">{mode === "leaderboard" ? "Leaderboard" : "Player management"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportPlayers}
              disabled={filteredPlayers.length === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black uppercase disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-black px-3 text-xs font-black uppercase text-white"
            >
              <UserPlus className="h-4 w-4" />
              New player
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-xs font-bold">
            Search players
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, rank, score, sessions"
              className="h-9 rounded-xl border border-black/12 bg-black/[0.03] px-3 text-sm outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[180px]">
            <MetricChip label="Players" value={players.length} />
            <MetricChip label="Ranked" value={leaderboardRows.length} />
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <div className="mt-3 space-y-1.5">
          {isLoading ? (
            <div className="grid min-h-40 place-items-center rounded-[24px] border border-black/10 bg-black/[0.03]">
              <LoaderCircle className="h-6 w-6 animate-spin text-black/55" />
            </div>
          ) : null}

          {!isLoading && filteredPlayers.length === 0 ? (
            <div className="rounded-[24px] border border-black/10 bg-black/[0.03] px-4 py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-black/28" />
              <div className="mt-3 text-lg font-black">No live players found</div>
              <div className="mt-1 text-sm font-bold text-black/52">
                {search ? "Try a different search term." : "Create the first player record from here."}
              </div>
            </div>
          ) : null}

          {visiblePlayers.map((player) => {
            const row = leaderboardById.get(player.id);
            const isSelected = !isCreating && selectedId === player.id;

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => selectPlayer(player.id)}
                className={cn(
                  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-gray-400 hover:bg-gray-50",
                  isSelected && "border-gray-950 bg-gray-50 ring-1 ring-gray-950"
                )}
              >
                <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_64px_72px_64px_68px]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarBadge avatarUrl={player.avatarUrl} name={player.name} className="h-9 w-9 rounded-xl shadow-none" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-black">{player.name}</span>
                        {row ? <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-black text-honey">#{row.globalRank}</span> : null}
                        {player.rewardVerified ? (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Verified" />
                        ) : null}
                      </div>
                      <div className="truncate text-[11px] font-semibold text-black/45">
                        Age {player.age} · Last {formatDate(player.lastPlayedAt)}
                      </div>
                    </div>
                  </div>
                  {[
                    ["Score", player.totalScore],
                    ["Sessions", player.sessionCount],
                    ["Levels", player.levelsCompleted],
                    ["Messages", player.messageCount]
                  ].map(([label, value]) => (
                    <div key={label} className="text-right">
                      <div className="text-sm font-black text-black">{value}</div>
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-black/40">{label}</div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {filteredPlayers.length > 0 ? (
          <AdminPagination
            itemLabel="players"
            page={page}
            pageSize={pageSize}
            totalItems={filteredPlayers.length}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
            pageSizeOptions={[12, 20, 30, 50]}
          />
        ) : null}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">
              {isCreating ? "Create Player" : detail ? "Player Detail" : "Workspace"}
            </div>
            <h2 className="text-lg font-black">
              {isCreating ? "New player record" : detail ? detail.name : "Select a player"}
            </h2>
          </div>
          {detail ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-black/58">
                <ShieldCheck className={detail.rewardVerified ? "h-3.5 w-3.5 text-mint" : "h-3.5 w-3.5 text-black/30"} />
                {detail.rewardVerified ? "Verified" : "Standard"}
              </div>
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-[10px] font-black uppercase"
              >
                <Pencil className="h-3.5 w-3.5" />
                {isEditing ? "Close edit" : "Edit"}
              </button>
            </div>
          ) : null}
        </div>

        {!isCreating && !detail && !isLoadingDetail ? (
          <div className="mt-6 rounded-[26px] border border-black/10 bg-black/[0.03] px-5 py-10 text-center">
            <div className="text-lg font-black">Pick a player to edit live data</div>
            <div className="mt-2 text-sm font-bold text-black/55">
              You can update names, ages, avatars, progress state, and remove records from here.
            </div>
          </div>
        ) : null}

        {isLoadingDetail ? (
          <div className="mt-6 grid min-h-48 place-items-center rounded-[26px] border border-black/10 bg-black/[0.03]">
            <LoaderCircle className="h-6 w-6 animate-spin text-black/55" />
          </div>
        ) : null}

        {isCreating || detail ? (
          <div className="mt-3 space-y-3">
            {isCreating || isEditing ? (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold">
                Player name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nova"
                  className="h-11 rounded-2xl border border-black/12 bg-black/[0.03] px-3 outline-none"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Age
                <input
                  type="number"
                  min={6}
                  max={99}
                  value={form.age}
                  onChange={(event) => setForm((current) => ({ ...current, age: Number(event.target.value) }))}
                  className="h-11 rounded-2xl border border-black/12 bg-black/[0.03] px-3 outline-none"
                />
              </label>
            </div>

            <AssetUploader
              label="Profile image"
              value={form.avatarUrl}
              folder="players/avatars"
              compact
              description="Upload a player portrait from any device, or paste a public image URL."
              onChange={(nextValue) => setForm((current) => ({ ...current, avatarUrl: nextValue }))}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-black px-4 text-sm font-black uppercase text-white shadow-engine disabled:opacity-60"
              >
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isCreating ? "Create player" : "Save player"}
              </button>

              {!isCreating ? (
                <button
                  type="button"
                  onClick={handleResetProgress}
                  disabled={isResetting || !selectedId}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-black/10 bg-white px-4 text-sm font-black uppercase disabled:opacity-60"
                >
                  {isResetting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reset progress
                </button>
              ) : null}

              {!isCreating ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || !selectedId}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-red-200 bg-red-50 px-4 text-sm font-black uppercase text-red-700 disabled:opacity-60"
                >
                  {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete player
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setSelectedId(players[0]?.id ?? null);
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-black/10 bg-white px-4 text-sm font-black uppercase"
                >
                  Cancel
                </button>
              )}
            </div>
              </div>
            ) : null}

            {detail ? (
              <>
                <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-black/45">
                    <MessageSquare className="h-4 w-4" />
                    Message player from admin
                  </div>
                  <textarea
                    value={adminMessage}
                    onChange={(event) => setAdminMessage(event.target.value)}
                    maxLength={240}
                    rows={2}
                    placeholder={`Write a direct admin message to ${detail.name}`}
                    className="min-h-16 w-full resize-none rounded-xl border border-black/12 bg-white/72 p-2.5 text-sm font-bold outline-none placeholder:text-black/32"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-black/42">{adminMessage.trim().length}/240</div>
                    <button
                      type="button"
                      onClick={handleSendAdminMessage}
                      disabled={isSendingAdminMessage || !adminMessage.trim()}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-black px-3 text-xs font-black uppercase text-white disabled:opacity-60"
                    >
                      {isSendingAdminMessage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send message
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <MetricChip label="Total score" value={detail.totalScore} />
                  <MetricChip label="Sessions" value={detail.sessionCount} />
                  <MetricChip label="Accuracy" value={`${accuracyPercent}%`} />
                  <MetricChip label="Answers" value={detail.totalAnswers} />
                  <MetricChip label="Messages" value={detail.messageCount} />
                  <MetricChip label="Levels" value={detail.levelsCompleted} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Timeline</div>
                    <div className="mt-2 space-y-1 text-xs font-bold text-black/66">
                      <div>Joined: {formatDate(detail.createdAt, true)}</div>
                      <div>Last played: {formatDate(detail.lastPlayedAt, true)}</div>
                      <div>Reward status: {detail.rewardVerified ? "Verified profile saved" : "No reward profile yet"}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Live categories</div>
                    <div className="mt-2 text-2xl font-black">{detail.categoriesPlayed}</div>
                    <div className="text-xs font-bold text-black/55">{detail.levelsCompleted} levels completed</div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <details className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-black/55">
                      Current categories ({activeProgress.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {activeProgress.length === 0 ? <div className="text-sm font-bold text-black/55">No active category progress yet.</div> : null}
                      {activeProgress.map((item) => (
                        <div key={item.categoryId} className="rounded-2xl border border-white/70 bg-white/82 p-3 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.categoryColorHex }} />
                                <span className="font-black">{item.categoryTitle}</span>
                              </div>
                              <div className="text-xs font-bold capitalize text-black/48">
                                {item.difficulty} | Level {item.currentLevel} | {item.levelsCompleted}/{item.totalLevels} cleared
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-black">{item.score}</div>
                              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-black/45">Score</div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs font-bold text-black/50">
                            Question slot {item.currentQuestionIndex + 1} | Last played {formatDate(item.lastPlayedAt, true)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>

                  <details className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-black/55">
                      Played history ({completedProgress.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {completedProgress.length === 0 ? <div className="text-sm font-bold text-black/55">No completed category runs yet.</div> : null}
                      {completedProgress.map((item) => (
                        <div key={item.categoryId} className="rounded-2xl border border-white/70 bg-white/82 p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-black">{item.categoryTitle}</div>
                              <div className="text-xs font-bold text-black/48">
                                Finished {item.totalLevels}/{item.totalLevels} levels | Last played {formatDate(item.lastPlayedAt)}
                              </div>
                            </div>
                            <div className="text-lg font-black">{item.score}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>

                  <details className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-black/55">
                      Reward profiles ({detail.rewardProfiles.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {detail.rewardProfiles.length === 0 ? <div className="text-sm font-bold text-black/55">No reward profile saved yet.</div> : null}
                      {detail.rewardProfiles.map((profile) => (
                        <div key={profile.id} className="rounded-2xl border border-white/70 bg-white/82 p-3 shadow-sm">
                          <div className="font-black">{profile.fullName}</div>
                          <div className="mt-1 text-sm font-bold text-black/58">{profile.email}</div>
                          <div className="text-sm font-bold text-black/58">{profile.phone}</div>
                          <div className="text-sm font-bold text-black/58">
                            Telegram: {profile.telegramUsername || "Not provided"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
