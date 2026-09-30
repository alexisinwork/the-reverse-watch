import type { ProgressEvent, ProgressLink } from "./ai-watch-types";

/**
 * A live feed of search steps. `report` adds an event, `close` ends the
 * feed; `feed` is the first link, ready to return from a loader or action.
 * The feed also closes itself after `maxMs`, so a stuck search can never
 * hold the page's stream open.
 */
export function createProgressFeed(maxMs = 38_000) {
  let resolveNext!: (link: ProgressLink | null) => void;
  const feed = new Promise<ProgressLink | null>((resolve) => {
    resolveNext = resolve;
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    resolveNext(null);
  };
  const timer = setTimeout(close, maxMs);
  return {
    feed,
    report: (event: ProgressEvent) => {
      if (closed) return;
      let resolveAfter!: (link: ProgressLink | null) => void;
      const next = new Promise<ProgressLink | null>((resolve) => {
        resolveAfter = resolve;
      });
      resolveNext({ event, next });
      resolveNext = resolveAfter;
    },
    close,
  };
}
