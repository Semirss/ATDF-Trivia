export const CHAT_LAST_READ_KEY = "trivia-chat-last-read-at";
export const CHAT_READ_EVENT = "trivia-chat-read";

export function getLastChatReadAt() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(CHAT_LAST_READ_KEY) ?? "";
}

export function markChatReadAt(postedAt: string | undefined) {
  if (typeof window === "undefined" || !postedAt) {
    return;
  }

  window.localStorage.setItem(CHAT_LAST_READ_KEY, postedAt);
  window.dispatchEvent(new CustomEvent(CHAT_READ_EVENT, { detail: postedAt }));
}

export function mentionTokenForName(name: string | null | undefined) {
  return (name ?? "").trim().replace(/\s+/g, "").toLowerCase();
}
