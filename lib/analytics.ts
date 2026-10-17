"use client";

type AnalyticsEventType = "button_tap" | "game_played" | "level_completed";

interface AnalyticsEventInput {
  eventType: AnalyticsEventType;
  eventKey: string;
  label: string;
  path?: string;
  count?: number;
}

interface AnalyticsBatchEvent extends Required<AnalyticsEventInput> {
  eventDate: string;
}

const pendingEvents = new Map<string, AnalyticsBatchEvent>();
let flushTimer: number | null = null;
let installed = false;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clean(value: string, fallback: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, maxLength);
}

function eventMapKey(event: AnalyticsBatchEvent) {
  return [event.eventDate, event.eventType, event.eventKey, event.path].join("|");
}

function scheduleFlush() {
  if (flushTimer !== null || typeof window === "undefined") {
    return;
  }

  flushTimer = window.setTimeout(() => {
    void flushAnalytics();
  }, 12000);
}

export function trackAnalyticsEvent(input: AnalyticsEventInput) {
  if (typeof window === "undefined") {
    return;
  }

  const event: AnalyticsBatchEvent = {
    eventDate: todayKey(),
    eventType: input.eventType,
    eventKey: clean(input.eventKey, "unknown"),
    label: clean(input.label, input.eventKey),
    path: clean(input.path ?? window.location.pathname, "/", 160),
    count: Math.max(1, Math.min(input.count ?? 1, 100))
  };
  const key = eventMapKey(event);
  const existing = pendingEvents.get(key);

  pendingEvents.set(key, existing ? { ...existing, count: existing.count + event.count } : event);
  scheduleFlush();
}

export async function flushAnalytics() {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  const events = Array.from(pendingEvents.values()).slice(0, 50);
  if (events.length === 0) {
    return;
  }

  for (const event of events) {
    pendingEvents.delete(eventMapKey(event));
  }

  try {
    await fetch("/api/game/analytics", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ events })
    });
  } catch {
    for (const event of events) {
      const key = eventMapKey(event);
      const existing = pendingEvents.get(key);
      pendingEvents.set(key, existing ? { ...existing, count: existing.count + event.count } : event);
    }
    scheduleFlush();
  }
}

export function trackGamePlayed(input: { categoryId: string; categoryTitle: string; levelId: string; levelNumber: number }) {
  trackAnalyticsEvent({
    eventType: "game_played",
    eventKey: `${input.categoryId}:${input.levelId}`,
    label: `${input.categoryTitle} L${input.levelNumber}`,
    path: `/category/${input.categoryId}/play`
  });
}

export function trackLevelCompleted(input: { categoryId: string; categoryTitle: string; levelId: string; levelNumber: number }) {
  trackAnalyticsEvent({
    eventType: "level_completed",
    eventKey: `${input.categoryId}:${input.levelId}`,
    label: `${input.categoryTitle} L${input.levelNumber}`,
    path: `/category/${input.categoryId}/play`
  });
}

function labelForElement(element: Element) {
  return (
    element.getAttribute("data-analytics-label") ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent ||
    element.tagName
  );
}

export function installButtonTapAnalytics() {
  if (installed || typeof window === "undefined") {
    return () => undefined;
  }

  installed = true;

  function handleClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const element = target.closest("button,a,[role='button']");
    if (!element || element.getAttribute("data-analytics-ignore") === "true") {
      return;
    }

    const label = clean(labelForElement(element), "button");
    const explicitKey = element.getAttribute("data-analytics-id");
    const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") ?? "" : "";
    const eventKey = clean(explicitKey || `${element.tagName.toLowerCase()}:${href || label}`, "button");

    trackAnalyticsEvent({
      eventType: "button_tap",
      eventKey,
      label
    });
  }

  function flushOnHide() {
    void flushAnalytics();
  }

  window.addEventListener("click", handleClick, true);
  window.addEventListener("pagehide", flushOnHide);
  document.addEventListener("visibilitychange", flushOnHide);

  return () => {
    installed = false;
    window.removeEventListener("click", handleClick, true);
    window.removeEventListener("pagehide", flushOnHide);
    document.removeEventListener("visibilitychange", flushOnHide);
  };
}
