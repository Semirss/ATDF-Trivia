"use client";

import Image from "next/image";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { MoreVertical, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PageTransition } from "@/components/ui/PageTransition";
import { syncRecentMessages } from "@/hooks/useContentSync";
import { mentionTokenForName, markChatReadAt } from "@/lib/chat-state";
import { fetchRemoteMessages, postRemoteMessage } from "@/lib/game-client";
import { t } from "@/lib/i18n";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { usePlayerStore } from "@/store/playerStore";
import { useContentStore } from "@/store/contentStore";
import type { Message } from "@/lib/types";

const pageSize = 80;
const mentionPattern = /(@[A-Za-z0-9_.-]{2,32})/g;

function isNearBottom(element: HTMLDivElement | null) {
  if (!element) {
    return true;
  }

  return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}

function renderMessageText(text: string, currentPlayerToken: string) {
  return text.split(mentionPattern).map((part, index) => {
    const mention = part.startsWith("@") ? part.slice(1).toLowerCase() : "";
    const isCurrentPlayer = currentPlayerToken.length > 0 && mention === currentPlayerToken;

    if (!mention) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <span key={`${part}-${index}`} className={isCurrentPlayer ? "font-black text-ember" : "chat-mention font-black"}>
        {part}
      </span>
    );
  });
}

function formatMessageTime(postedAt: string) {
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function ChatAvatar({ avatarUrl, playerName }: { avatarUrl?: string; playerName: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const useFallback = !avatarUrl || imageFailed;
  const initials =
    playerName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "P";

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <div className="chat-avatar h-9 w-9 shrink-0 overflow-hidden rounded-full">
      {useFallback ? (
        <span className="chat-avatar-initials" aria-hidden="true">{initials}</span>
      ) : (
        <Image
          src={avatarUrl || "/robot-mascot.png"}
          alt={`${playerName} profile`}
          width={36}
          height={36}
          sizes="36px"
          onError={() => setImageFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      )}
    </div>
  );
}

export default function MessagesPage() {
  const playerId = usePlayerStore((state) => state.playerId);
  const playerName = usePlayerStore((state) => state.name);
  const playerAvatarUrl = usePlayerStore((state) => state.avatarUrl);
  const language = usePlayerStore((state) => state.language);

  const messages = useContentStore((state) => state.messages);
  const addMessage = useContentStore((state) => state.addMessage);
  const replaceMessages = useContentStore((state) => state.replaceMessages);
  const appendOlderMessages = useContentStore((state) => state.appendOlderMessages);

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentPlayerToken = mentionTokenForName(playerName);

  const visibleMessages = useMemo(() => [...messages].reverse(), [messages]);
  const messagesById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const scrollElement = scrollRef.current;
      scrollElement?.scrollTo({ top: scrollElement.scrollHeight, behavior });
    });
  }, []);

  const loadOlderMessages = useCallback(async () => {
    const oldestMessage = messages[messages.length - 1];
    const scrollElement = scrollRef.current;

    if (!oldestMessage?.postedAt || isLoadingOlder || !hasMore || !scrollElement) {
      return;
    }

    const previousHeight = scrollElement.scrollHeight;
    const previousTop = scrollElement.scrollTop;
    setIsLoadingOlder(true);

    try {
      const olderMessages = await fetchRemoteMessages({ before: oldestMessage.postedAt, limit: pageSize });
      appendOlderMessages(olderMessages);
      setHasMore(olderMessages.length === pageSize);
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - previousHeight + previousTop;
        }
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load older messages.");
    } finally {
      setIsLoadingOlder(false);
    }
  }, [appendOlderMessages, hasMore, isLoadingOlder, messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentMessages() {
      try {
        const recentMessages = await syncRecentMessages({ force: true });
        if (!cancelled) {
          replaceMessages(recentMessages);
          setHasMore(recentMessages.length === pageSize);
          scrollToBottom("auto");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load messages.");
        }
      }
    }

    void loadRecentMessages();

    return () => {
      cancelled = true;
    };
  }, [replaceMessages, scrollToBottom]);

  useEffect(() => {
    markChatReadAt(messages[0]?.postedAt);
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    let channel: { unsubscribe: () => Promise<unknown> } | null = null;

    async function subscribe() {
      const supabase = await createBrowserSupabaseClient();
      if (!supabase || cancelled) return;

      channel = supabase
        .channel("messages-live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async () => {
            const shouldStickToBottom = isNearBottom(scrollRef.current);

            try {
              const [latestMessage] = await fetchRemoteMessages({ limit: 1 });
              if (latestMessage) {
                addMessage(latestMessage);
                if (shouldStickToBottom || latestMessage.playerId === playerId) scrollToBottom("smooth");
              }
            } catch (error) {
              console.error("Failed to sync live message", error);
            }
          }
        )
        .subscribe();
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void channel.unsubscribe();
    };
  }, [addMessage, playerId, scrollToBottom]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || !playerId) return;

    setIsSending(true);
    const messageText = text.trim().slice(0, 140);
    const senderName = playerName || "Player";
    const replyToMessageId = replyTo?.id;
    setText("");
    setReplyTo(null);

    const tempId = `temp-${Date.now()}`;
    addMessage({
      id: tempId,
      playerId,
      playerName: senderName,
      avatarUrl: playerAvatarUrl ?? undefined,
      text: messageText,
      postedAt: new Date().toISOString(),
      replyToMessageId
    });
    scrollToBottom("smooth");

    try {
      const savedMessage = await postRemoteMessage({ playerId, text: messageText, replyToMessageId });
      addMessage(savedMessage);
      scrollToBottom("smooth");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send message.");
      const rollbackMessages = useContentStore.getState().messages.filter((message) => message.id !== tempId);
      replaceMessages(rollbackMessages);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <PageTransition>
      <div className="game-safe chat-safe flex h-full min-h-0 flex-col">
        <header className="chat-reference-header shrink-0">
          <div className="chat-atdf-stamp" aria-hidden="true">
            <Image
              src="/visuals/atdf-2026-seal.png"
              alt=""
              width={104}
              height={104}
              sizes="104px"
              priority
            />
          </div>
          <p className="chat-header-kicker">Live Board</p>
          <h1 className="chat-header-title">{t(language, "chat")}</h1>
          <span className="chat-title-rule" />
        </header>

        <div
          ref={scrollRef}
          className="chat-message-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
          onScroll={(event) => {
            if (event.currentTarget.scrollTop <= 24) {
              void loadOlderMessages();
            }
          }}
        >
          <div className="flex min-h-full flex-col gap-2 py-1">
            <div className="mt-auto" aria-hidden="true" />
            {isLoadingOlder ? (
              <div className="chat-status py-2 text-center text-[11px] font-black uppercase">{t(language, "loadingOlderMessages")}</div>
            ) : null}
            {!hasMore && messages.length > 0 ? (
              <div className="chat-status py-2 text-center text-[11px] font-black uppercase">{t(language, "startOfChat")}</div>
            ) : null}
            {messages.length === 0 ? (
              <div className="chat-empty rounded-[24px] px-5 py-8 text-center text-[13px] font-bold">
                {t(language, "noLiveMessages")}
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {visibleMessages.map((message) => {
                const repliedMessage = message.replyToMessageId ? messagesById.get(message.replyToMessageId) : null;
                const isOwnMessage = message.playerId === playerId;
                const mentionsCurrentPlayer =
                  currentPlayerToken.length > 0 && message.text.toLowerCase().includes(`@${currentPlayerToken}`);

                return (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="chat-message-row group flex w-full min-w-0 items-end gap-2"
                  >
                    <ChatAvatar
                      avatarUrl={isOwnMessage ? playerAvatarUrl ?? message.avatarUrl : message.avatarUrl}
                      playerName={message.playerName}
                    />
                    <article className={`chat-message-card min-w-0 flex-1 rounded-[22px] px-3.5 py-2.5 backdrop-blur-xl ${isOwnMessage ? "chat-message-own rounded-br-[7px]" : "chat-message-other rounded-bl-[7px]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="chat-author break-words text-[12px] font-black">{message.playerName}</span>
                            {mentionsCurrentPlayer ? (
                              <span className="chat-mentioned rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">
                                {t(language, "mentionedYou")}
                              </span>
                            ) : null}
                          </div>
                          {message.replyToMessageId ? (
                            <div className="chat-inline-reply mt-2 rounded-[13px] border-l-2 px-3 py-2">
                              <div className="chat-inline-reply-author break-words text-[10px] font-black">
                                {t(language, "replyTo")} {repliedMessage?.playerName ?? t(language, "olderMessage")}
                              </div>
                              <div className="chat-inline-reply-text whitespace-pre-wrap break-words text-[11px] font-bold">
                                {repliedMessage?.text ?? t(language, "loadOriginalMessage")}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyTo(message)}
                          aria-label={`${t(language, "replyTo")} ${message.playerName}`}
                          className="chat-reply-action grid h-8 w-8 shrink-0 place-items-center rounded-full transition active:scale-95"
                        >
                          <MoreVertical className="h-4 w-4" strokeWidth={2.4} />
                        </button>
                      </div>
                      <p className="chat-message-body mt-1 whitespace-pre-wrap break-words text-[14px] font-medium leading-relaxed">
                        {renderMessageText(message.text, currentPlayerToken)}
                      </p>
                      <div className="chat-message-time mt-1 text-right text-[9px] font-bold uppercase tracking-wide">
                        {formatMessageTime(message.postedAt)}
                      </div>
                    </article>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div className="h-1 shrink-0" />
          </div>
        </div>

        <form
          onSubmit={submit}
          className="chat-composer z-10 shrink-0 rounded-full p-1.5"
        >
          {replyTo ? (
            <div className="chat-composer-reply mb-1 flex items-center justify-between gap-2 rounded-[19px] px-3 py-2">
              <div className="min-w-0">
                <div className="chat-composer-reply-label text-[10px] font-black uppercase">{t(language, "replyingTo")} {replyTo.playerName}</div>
                <div className="chat-composer-reply-text truncate text-[12px] font-bold">{replyTo.text}</div>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} aria-label={t(language, "cancelReply")} className="chat-cancel-reply grid h-8 w-8 shrink-0 place-items-center rounded-full">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-1">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={200}
              placeholder={playerId ? t(language, "typeMessage") : t(language, "createPlayerFirst")}
              disabled={!playerId}
              className="chat-composer-input h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-[14px] font-medium outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || !playerId || isSending}
              aria-label={t(language, "send")}
              className="chat-send-button grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-engine transition active:scale-95 disabled:opacity-30"
            >
              <Send className="ml-0.5 h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </PageTransition>
  );
}
