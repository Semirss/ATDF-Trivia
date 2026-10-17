"use client";

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

type TelegramEventPayload = {
  status?: string;
};

type TelegramEventHandler = (eventData?: TelegramEventPayload) => void;

interface TelegramInsets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface TelegramWebApp {
  version?: string;
  initData: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: TelegramInsets;
  contentSafeAreaInset?: TelegramInsets;
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  requestFullscreen?: () => void;
  requestContact?: (callback?: (shared: boolean) => void) => void;
  isVersionAtLeast?: (version: string) => boolean;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  onEvent?: (eventType: string, callback: TelegramEventHandler) => void;
  offEvent?: (eventType: string, callback: TelegramEventHandler) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function px(value: number) {
  return `${Math.max(0, Math.round(value))}px`;
}

const defaultTelegramBotUsername = "houseofchewataBot";
const checkoutRecoveryKey = "trivia-telegram-checkout-recovery-v1";
const checkoutRecoveryMaxAgeMs = 30 * 60 * 1000;

interface TelegramLaunchData {
  initData: string;
  startParam?: string;
}

interface StoredTelegramLaunchData extends TelegramLaunchData {
  savedAt: number;
}

function cleanBotUsername(value?: string) {
  const cleaned = value
    ?.trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .split(/[/?#]/)[0];

  return cleaned || defaultTelegramBotUsername;
}

export function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
}

function readStoredTelegramLaunchData() {
  if (typeof window === "undefined") {
    return null;
  }

  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      const storage = window[storageName];
      const raw = storage.getItem(checkoutRecoveryKey);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw) as Partial<StoredTelegramLaunchData>;
      const isFresh =
        typeof parsed.savedAt === "number" &&
        Date.now() - parsed.savedAt >= 0 &&
        Date.now() - parsed.savedAt <= checkoutRecoveryMaxAgeMs;

      if (typeof parsed.initData === "string" && parsed.initData.length >= 10 && isFresh) {
        return {
          initData: parsed.initData,
          startParam: typeof parsed.startParam === "string" ? parsed.startParam : undefined
        } satisfies TelegramLaunchData;
      }

      storage.removeItem(checkoutRecoveryKey);
    } catch {
      // Try the other storage provider. Some private WebViews disable one.
    }
  }

  return null;
}

export function rememberTelegramLaunchDataForCheckout() {
  if (typeof window === "undefined") {
    return false;
  }

  const webApp = getTelegramWebApp();
  if (!webApp?.initData) {
    return false;
  }

  const stored: StoredTelegramLaunchData = {
    initData: webApp.initData,
    startParam: webApp.initDataUnsafe?.start_param,
    savedAt: Date.now()
  };
  const serialized = JSON.stringify(stored);
  let saved = false;

  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      const storage = window[storageName];
      storage.setItem(checkoutRecoveryKey, serialized);
      saved = true;
    } catch {
      // The transaction player ID remains available as a fallback.
    }
  }

  return saved;
}

export function getTelegramLaunchData(): TelegramLaunchData | null {
  const webApp = getTelegramWebApp();

  if (webApp?.initData) {
    return {
      initData: webApp.initData,
      startParam: webApp.initDataUnsafe?.start_param
    };
  }

  return readStoredTelegramLaunchData();
}

export function openExternalLink(url: string) {
  const webApp = getTelegramWebApp();

  if (!webApp?.openLink) {
    return false;
  }

  try {
    webApp.openLink(url);
    return true;
  } catch {
    return false;
  }
}

export function hasTelegramLaunchData() {
  return Boolean(getTelegramLaunchData()?.initData);
}

export function isTelegramMiniApp() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  const search = typeof window === "undefined" ? "" : window.location.search.toLowerCase();
  return Boolean(getTelegramLaunchData()?.initData || userAgent.includes("telegram") || search.includes("tgwebapp"));
}

export function getTelegramMiniAppUrl(startParam = "login") {
  const botUsername = cleanBotUsername(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
  const safeStartParam = startParam.trim();
  const query = safeStartParam ? `?startapp=${encodeURIComponent(safeStartParam)}` : "?startapp";

  return `https://t.me/${botUsername}${query}`;
}

export function openTelegramMiniApp(startParam = "login") {
  const url = getTelegramMiniAppUrl(startParam);

  if (typeof window === "undefined") {
    return url;
  }

  const webApp = getTelegramWebApp();

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return url;
  }

  window.location.href = url;
  return url;
}

export function requestTelegramContact() {
  const webApp = getTelegramWebApp();

  if (typeof window === "undefined" || !webApp?.requestContact) {
    return Promise.resolve(false);
  }

  const requestContact = webApp.requestContact;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: number | null = null;

    const finish = (shared: boolean) => {
      if (settled) {
        return;
      }

      settled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      webApp.offEvent?.("contactRequested", handleContactRequested);
      resolve(shared);
    };

    const handleContactRequested: TelegramEventHandler = (eventData) => {
      if (eventData?.status === "sent") {
        finish(true);
      }

      if (eventData?.status === "cancelled") {
        finish(false);
      }
    };

    timer = window.setTimeout(() => finish(false), 15000);
    webApp.onEvent?.("contactRequested", handleContactRequested);

    try {
      requestContact((shared) => finish(Boolean(shared)));
    } catch {
      finish(false);
    }
  });
}

function isVersionAtLeast(webApp: TelegramWebApp, minimumVersion: string) {
  if (typeof webApp.isVersionAtLeast === "function") {
    return webApp.isVersionAtLeast(minimumVersion);
  }

  if (!webApp.version) {
    return false;
  }

  const currentParts = webApp.version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const minimumParts = minimumVersion.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(currentParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const current = currentParts[index] ?? 0;
    const minimum = minimumParts[index] ?? 0;

    if (current > minimum) {
      return true;
    }

    if (current < minimum) {
      return false;
    }
  }

  return true;
}

export function requestTelegramPresentation() {
  const webApp = getTelegramWebApp();

  if (!webApp) {
    return;
  }

  try {
    webApp.ready?.();
    webApp.expand?.();

    if (isVersionAtLeast(webApp, "7.7")) {
      webApp.disableVerticalSwipes?.();
    }

    if (isVersionAtLeast(webApp, "8.0")) {
      webApp.requestFullscreen?.();
    }
  } catch {
    // Telegram presentation APIs are best-effort and depend on client support.
  }
}

export function applyTelegramViewportVars() {
  const webApp = getTelegramWebApp();
  const root = document.documentElement;
  const isTelegram = isTelegramMiniApp();

  if (!isTelegram) {
    root.removeAttribute("data-telegram-webapp");
    root.style.setProperty("--tg-viewport-height", "100dvh");
    root.style.setProperty("--tg-safe-top", "0px");
    root.style.setProperty("--tg-safe-bottom", "0px");
    root.style.setProperty("--game-topbar-y", "12px");
    root.style.setProperty("--game-safe-top", "56px");
    root.style.setProperty("--home-safe-top", "44px");
    return;
  }

  root.dataset.telegramWebapp = "true";
  requestTelegramPresentation();

  const viewportHeight = webApp?.viewportStableHeight || webApp?.viewportHeight || window.innerHeight;
  const safeTop = Math.max(webApp?.safeAreaInset?.top ?? 0, webApp?.contentSafeAreaInset?.top ?? 0);
  const safeBottom = Math.max(webApp?.safeAreaInset?.bottom ?? 0, webApp?.contentSafeAreaInset?.bottom ?? 0);

  root.style.setProperty("--tg-viewport-height", px(viewportHeight));
  root.style.setProperty("--tg-safe-top", px(safeTop));
  root.style.setProperty("--tg-safe-bottom", px(safeBottom));
  root.style.setProperty("--game-topbar-y", "92px");
  root.style.setProperty("--game-safe-top", "132px");
  root.style.setProperty("--home-safe-top", "118px");
}
