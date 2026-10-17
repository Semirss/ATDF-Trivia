"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useContentStore } from "@/store/contentStore";

interface MessageInsertPayload {
  id?: string;
  player_id?: string;
  text?: string;
  reply_to_message_id?: string | null;
  posted_at?: string | null;
}

export function useMessageRealtime(enabled = true) {
  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      return;
    }

    let channel: ReturnType<NonNullable<Awaited<ReturnType<typeof createBrowserSupabaseClient>>>["channel"]> | null = null;

    async function subscribe() {
      const supabase = await createBrowserSupabaseClient();
      if (!supabase || cancelled) return;

      channel = supabase
        .channel("game-message-badges")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const message = payload.new as MessageInsertPayload;

            if (!message.id || !message.player_id || !message.text) return;

            useContentStore.getState().addMessage({
              id: message.id,
              playerId: message.player_id,
              playerName: "Player",
              text: message.text,
              postedAt: message.posted_at ?? new Date().toISOString(),
              replyToMessageId: message.reply_to_message_id ?? undefined
            });
          }
        )
        .subscribe();
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void channel.unsubscribe();
    };
  }, [enabled]);
}
