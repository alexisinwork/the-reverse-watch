import { describe, expect, it } from "vitest";

import type { ProgressLink } from "./ai-watch-types";
import { createProgressFeed } from "./progress-feed";

async function collect(link: Promise<ProgressLink | null>) {
  const texts: string[] = [];
  for (let current = await link; current; current = await current.next) {
    texts.push(current.event.text);
  }
  return texts;
}

describe("createProgressFeed", () => {
  it("delivers events in order and ends on close", async () => {
    const progress = createProgressFeed();
    progress.report({ text: "one" });
    progress.report({ text: "two" });
    progress.close();
    progress.report({ text: "ignored after close" });
    expect(await collect(progress.feed)).toEqual(["one", "two"]);
  });

  it("does not stream a second card with the same brand and reference", async () => {
    const progress = createProgressFeed();
    const watch = {
      brand: "Omega",
      model: "Planet Ocean",
      referenceCode: "2201.50.00",
      sourceUrl: "https://example.com",
      imageUrl: null,
      priceNote: null,
      rationale: "",
      details: {},
    };
    progress.report({ text: "first", watch });
    progress.report({
      text: "second",
      watch: { ...watch, model: "Another title", referenceCode: "2201-50-00" },
    });
    progress.close();
    const first = await progress.feed;
    const second = await first?.next;
    expect(first?.event.watch).toEqual(watch);
    expect(second?.event.watch).toBeUndefined();
  });

  it("closes itself after the time limit", async () => {
    const progress = createProgressFeed(5);
    progress.report({ text: "started" });
    expect(await collect(progress.feed)).toEqual(["started"]);
  });
});
