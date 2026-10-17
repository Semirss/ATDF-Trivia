type TriviaWindow = Window & {
  __triviaInitialPath?: string;
  __triviaHomeSplashSeen?: boolean;
};

const homeSplashSessionKey = "trivia-home-splash-seen-v1";
// Permanent marker survives full-page navigations (e.g. Chapa payment redirect)
const homeSplashPermanentKey = "trivia-home-splash-seen-perm";

function hasSeenHomeSplashThisSession() {
  try {
    return window.sessionStorage.getItem(homeSplashSessionKey) === "true";
  } catch {
    return false;
  }
}

function hasSeenHomeSplashPermanently() {
  try {
    return window.localStorage.getItem(homeSplashPermanentKey) === "true";
  } catch {
    return false;
  }
}

function rememberHomeSplashForSession() {
  try {
    window.sessionStorage.setItem(homeSplashSessionKey, "true");
  } catch {
    // The in-memory flag still prevents a repeat when storage is unavailable.
  }
}

function getTriviaWindow() {
  return window as TriviaWindow;
}

export function rememberInitialGamePath(pathname?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const triviaWindow = getTriviaWindow();
  triviaWindow.__triviaInitialPath ??= pathname ?? window.location.pathname;
}

export function shouldShowHomeSplash() {
  if (typeof window === "undefined") {
    return true;
  }

  rememberInitialGamePath();
  const triviaWindow = getTriviaWindow();

  const seenThisSession = hasSeenHomeSplashThisSession();
  const seenPermanently = hasSeenHomeSplashPermanently();

  return triviaWindow.__triviaInitialPath === "/" && !triviaWindow.__triviaHomeSplashSeen && !seenThisSession && !seenPermanently;
}

export function markHomeSplashSeen() {
  if (typeof window === "undefined") {
    return;
  }

  getTriviaWindow().__triviaHomeSplashSeen = true;
  rememberHomeSplashForSession();
}

/**
 * Persist the splash-seen state in localStorage so it survives full-page
 * navigations (e.g. after the Chapa payment flow redirects back into the app).
 * Call this on any page that the user reaches after having already seen the intro.
 */
export function markHomeSplashSeenPermanently() {
  if (typeof window === "undefined") {
    return;
  }

  getTriviaWindow().__triviaHomeSplashSeen = true;
  rememberHomeSplashForSession();
  try {
    window.localStorage.setItem(homeSplashPermanentKey, "true");
  } catch {
    // Ignore — session flag already prevents the intro on the current session.
  }
}
