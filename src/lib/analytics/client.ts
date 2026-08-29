"use client";

// Client-side analytics buffer (analytics-spec §5).
// - fire-and-forget, never throws
// - buffers and flushes every 5s, on route change, and on visibility→hidden
// - uses navigator.sendBeacon for the unload flush
// - anonymous sessions get a session_id from day one

const SESSION_KEY = "closet_sid";
const FLUSH_MS = 5000;

type QueuedEvent = {
  event: string;
  props?: Record<string, unknown>;
  item_id?: string | null;
  tx_id?: string | null;
  ts: string;
};

type QueuedImpression = {
  item_id: string;
  tier: "A" | "B" | "C";
  match_score: number | null;
  position: number;
  feed_mode: "chronological" | "ranked";
};

let queue: QueuedEvent[] = [];
let impressionQueue: QueuedImpression[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        (crypto.randomUUID?.() ??
          `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

export function track(
  event: string,
  props?: Record<string, unknown>,
  ids?: { item_id?: string | null; tx_id?: string | null },
): void {
  try {
    queue.push({
      event,
      props,
      item_id: ids?.item_id ?? null,
      tx_id: ids?.tx_id ?? null,
      ts: new Date().toISOString(),
    });
    ensureStarted();
    if (queue.length >= 20) flush();
  } catch {
    /* swallow */
  }
}

export function trackImpressions(rows: QueuedImpression[]): void {
  try {
    impressionQueue.push(...rows);
    ensureStarted();
  } catch {
    /* swallow */
  }
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  timer = setInterval(flush, FLUSH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

export function flush(useBeacon = false): void {
  if (typeof window === "undefined") return;
  if (queue.length === 0 && impressionQueue.length === 0) return;

  const payload = {
    session_id: getSessionId(),
    events: queue,
    impressions: impressionQueue,
  };
  queue = [];
  impressionQueue = [];

  const body = JSON.stringify(payload);
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/track",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* swallow */
  }
}
