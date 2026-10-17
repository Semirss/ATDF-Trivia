"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { deleteRemoteMessage, deleteRemoteMessagesByPlayer, fetchAdminMessages } from "@/lib/admin-client";
import type { Message } from "@/lib/types";

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function loadMessages(successMessage?: string) {
    try {
      const data = await fetchAdminMessages();
      setMessages(data);
      setError(null);
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load messages.");
    }
  }

  useEffect(() => {
    void loadMessages();
  }, []);

  const uniquePlayers = Array.from(
    new Map(messages.map((message) => [message.playerId, { playerId: message.playerId, playerName: message.playerName }])).values()
  );
  const filteredMessages = messages.filter((message) => {
    const query = search.trim().toLowerCase();
    const matchesPlayer = !selectedPlayerId || message.playerId === selectedPlayerId;
    const matchesSearch =
      !query || `${message.playerName} ${message.text}`.toLowerCase().includes(query);
    return matchesPlayer && matchesSearch;
  });
  const focusedPlayer = uniquePlayers.find((player) => player.playerId === selectedPlayerId) ?? null;
  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleMessages = filteredMessages.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, selectedPlayerId]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div>
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Moderation</p>
        <h1 className="font-display text-2xl font-black">Messages</h1>
        <p className="mt-1 max-w-3xl text-xs font-semibold text-black/55">
          Search live chat, isolate one player’s thread, and delete individual messages or a full player message set from the admin side.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
          <label className="grid gap-1 text-xs font-bold">
            Search messages
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Player name or message text"
              className="h-9 rounded-xl border border-black/12 bg-black/[0.03] px-3 text-sm outline-none"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold">
            Player
            <select
              value={selectedPlayerId ?? ""}
              onChange={(event) => setSelectedPlayerId(event.target.value || null)}
              className="h-9 rounded-xl border border-black/12 bg-black/[0.03] px-3 text-sm outline-none"
            >
              <option value="">All players</option>
              {uniquePlayers.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.playerName}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-1.5">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-black/45">Messages</div>
              <div className="text-base font-black">{messages.length}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-1.5">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-black/45">Filtered</div>
              <div className="text-base font-black">{filteredMessages.length}</div>
            </div>
          </div>
        </div>

        {focusedPlayer ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2">
            <div className="flex-1 text-xs font-bold text-black/62">
              Showing only <span className="font-black text-black">{focusedPlayer.playerName}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlayerId(null)}
              className="inline-flex h-8 items-center rounded-lg border border-black/10 bg-white px-2.5 text-[10px] font-black uppercase"
            >
              Clear filter
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteRemoteMessagesByPlayer(focusedPlayer.playerId);
                  setSelectedPlayerId(null);
                  await loadMessages("Player messages deleted.");
                } catch (deleteError) {
                  toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete messages.");
                }
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[10px] font-black uppercase text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete all for player
            </button>
          </div>
        ) : null}

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
          <div className="hidden grid-cols-[160px_minmax(0,1fr)_150px_40px] gap-3 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 md:grid">
            <span>Player</span>
            <span>Message</span>
            <span>Sent</span>
            <span />
          </div>
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className="grid gap-1 border-t border-gray-100 px-3 py-2 first:border-t-0 md:grid-cols-[160px_minmax(0,1fr)_150px_40px] md:items-center md:gap-3"
            >
              <button
                type="button"
                onClick={() => setSelectedPlayerId(message.playerId)}
                className="truncate text-left text-sm font-black text-gray-900 hover:underline"
              >
                {message.playerName}
              </button>
              <p className="min-w-0 text-sm font-medium leading-5 text-gray-700 md:truncate" title={message.text}>
                {message.text}
              </p>
              <div className="text-[11px] font-semibold text-gray-500">
                {message.postedAt ? new Date(message.postedAt).toLocaleString() : ""}
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteRemoteMessage(message.id);
                    await loadMessages("Message deleted.");
                  } catch (deleteError) {
                    toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete message.");
                  }
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Delete message from ${message.playerName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {filteredMessages.length === 0 ? (
            <div className="border-t border-gray-100 px-4 py-8 text-center">
              <div className="text-base font-black">No messages in this view</div>
              <div className="mt-1 text-xs font-bold text-black/55">
                Try a different search or clear the current player filter.
              </div>
            </div>
          ) : null}
        </div>

        {filteredMessages.length > 0 ? (
          <AdminPagination
            itemLabel="messages"
            page={page}
            pageSize={pageSize}
            totalItems={filteredMessages.length}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
            pageSizeOptions={[20, 40, 75, 100]}
          />
        ) : null}
      </div>
    </div>
  );
}
