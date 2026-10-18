"use client";

import { useEffect } from "react";
import { applyTelegramViewportVars, getTelegramWebApp, requestTelegramPresentation } from "@/lib/telegram-webapp";

export function useTelegramViewport() {
  useEffect(() => {
    let webApp: ReturnType<typeof getTelegramWebApp> = null;
    let attempts = 0;

    function syncViewport() {
      applyTelegramViewportVars();
    }

    function attachTelegramViewport() {
      if (webApp) {
        return true;
      }

      webApp = getTelegramWebApp();
      if (!webApp) {
        return false;
      }

      webApp.onEvent?.("viewportChanged", syncViewport);
      webApp.onEvent?.("safeAreaChanged", syncViewport);
      webApp.onEvent?.("contentSafeAreaChanged", syncViewport);
      requestTelegramPresentation();
      syncViewport();
      return true;
    }

    function retryPresentationFromGesture() {
      requestTelegramPresentation({ requestFullscreen: true });
      applyTelegramViewportVars();
    }

    function restoreViewport() {
      syncViewport();
      window.requestAnimationFrame(syncViewport);
    }

    function restoreVisibleViewport() {
      if (!document.hidden) {
        restoreViewport();
      }
    }

    attachTelegramViewport();
    const retryTimer = window.setInterval(() => {
      attempts += 1;
      if (attachTelegramViewport() || attempts >= 20) {
        window.clearInterval(retryTimer);
      }
    }, 250);
    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("pageshow", restoreViewport);
    document.addEventListener("visibilitychange", restoreVisibleViewport);
    window.addEventListener("pointerdown", retryPresentationFromGesture, { once: true, passive: true });

    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("pageshow", restoreViewport);
      document.removeEventListener("visibilitychange", restoreVisibleViewport);
      window.removeEventListener("pointerdown", retryPresentationFromGesture);
      webApp?.offEvent?.("viewportChanged", syncViewport);
      webApp?.offEvent?.("safeAreaChanged", syncViewport);
      webApp?.offEvent?.("contentSafeAreaChanged", syncViewport);
    };
  }, []);
}
