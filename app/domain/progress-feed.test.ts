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

  it("closes itself after the time limit", async () => {
    const progress = createProgressFeed(5);
    progress.report({ text: "started" });
    expect(await collect(progress.feed)).toEqual(["started"]);
  });
});
