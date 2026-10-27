import type { FoundWatch, ProgressEvent, ProgressLink } from "./ai-watch-types";
import { uniqueWatchResults } from "./watch-result-dedup";

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
  const seen: FoundWatch[] = [];
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
      if (event.watch) {
        const unique = uniqueWatchResults([...seen, event.watch]);
        if (unique.length <= seen.length) {
          event = { text: event.text };
        } else {
          seen.push(event.watch);
        }
      }
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
