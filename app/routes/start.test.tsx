import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import episodesFile from "../data/youtube-episodes.json";
import { action as homeAction } from "./home";
import Start, { headers, loader } from "./start";

type LoaderResult = {
  data: unknown;
  init: { headers: Record<string, string> };
};

function runLoader(url = "https://thereserve.watch/start") {
  return loader({
    request: new Request(url),
  } as unknown as Parameters<typeof loader>[0]) as unknown as LoaderResult;
}

/** Renders /start as the visitor sees it at `iso`, and returns its HTML. */
async function renderAt(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
  const Stub = createRoutesStub([
    { path: "/start", Component: Start, loader: () => runLoader().data },
  ]);
  const { container } = render(<Stub initialEntries={["/start"]} />);
  await screen.findByRole("heading", { level: 1, name: "The Reserve" });
  return container.innerHTML;
}

const unreleased = (iso: string) =>
  episodesFile.episodes
    .filter((episode) => Date.parse(episode.publishAt) > Date.parse(iso))
    .flatMap((episode) => [episode.youtubeId, episode.title]);

describe("/start", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("before 6 December 16:00 names the first episode's day, not its title", async () => {
    const html = await renderAt("2026-12-06T15:59:00+01:00");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "First episode: Sunday 6 December",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open the YouTube channel" }),
    ).toHaveAttribute("href", "https://www.youtube.com/@TheReserveWatch");
    expect(screen.queryByText("All episodes")).toBeNull();
    for (const secret of unreleased("2026-12-06T15:59:00+01:00")) {
      expect(html).not.toContain(secret);
    }
  });

  it("on 6 December 16:05 leads with episode 1", async () => {
    await renderAt("2026-12-06T16:05:00+01:00");
    const latest = screen.getByRole("region", {
      name: "Switzerland Built the Future. Then Couldn't Afford to Sell It.",
    });
    expect(
      within(latest).getByRole("link", { name: "Watch on YouTube" }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=gjr3aGjZDug");
    expect(within(latest).getByText(/Episode 1$/)).toBeInTheDocument();
  });

  it("on 9 December 16:05 puts episode 2 on top and lists episode 1", async () => {
    const html = await renderAt("2026-12-09T16:05:00+01:00");
    const latest = screen.getByRole("region", {
      name: "Rolex Has No Shareholders to Answer To",
    });
    expect(
      within(latest).getByRole("link", { name: "Watch on YouTube" }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=rK3mmlWnVko");
    const list = screen.getByRole("region", { name: "All episodes" });
    const links = within(list)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(links).toEqual([
      "https://www.youtube.com/watch?v=rK3mmlWnVko",
      "https://www.youtube.com/watch?v=gjr3aGjZDug",
      "https://www.youtube.com/@TheReserveWatch",
    ]);
    for (const secret of unreleased("2026-12-09T16:05:00+01:00")) {
      expect(html).not.toContain(secret);
    }
  });

  it("on 7 February 2027 16:05 leads with episode 11's re-uploaded video", async () => {
    await renderAt("2027-02-07T16:05:00+01:00");
    const latest = screen.getByRole("region", {
      name: "Vostok Outlived the USSR. Its Company Didn't",
    });
    expect(
      within(latest).getByRole("link", { name: "Watch on YouTube" }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=BJ8fKyFUUoQ");
    const list = screen.getByRole("region", { name: "All episodes" });
    // Eleven episodes and the channel link.
    expect(within(list).getAllByRole("link")).toHaveLength(12);
  });

  it("links the archetype quiz and the home page's sign-up", async () => {
    await renderAt("2026-12-09T16:05:00+01:00");
    expect(
      screen.getByRole("link", { name: /Find your watch archetype/ }),
    ).toHaveAttribute("href", "/watches/archetype");
    expect(
      screen.getByPlaceholderText("Email address").closest("form"),
    ).toHaveAttribute("action", "/?index");
    expect(
      screen.getByRole("link", { name: "Privacy policy" }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("sends its sign-up to the home page's action", async () => {
    // The home action refuses a sign-up without consent before it calls
    // Beehiiv, so nothing leaves the test.
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => null,
        children: [{ index: true, action: homeAction, Component: () => null }],
      },
      { path: "/start", Component: Start, loader: () => runLoader().data },
    ]);
    render(<Stub initialEntries={["/start"]} />);
    const email = await screen.findByPlaceholderText("Email address");
    fireEvent.change(email, { target: { value: "reader@example.com" } });
    fireEvent.submit(email.closest("form")!);
    expect(
      await screen.findByText("Please confirm the email opt-in."),
    ).toBeInTheDocument();
  });

  it("keeps a profile's tags on the quiz link", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-09T16:05:00+01:00"));
    const result = runLoader(
      "https://thereserve.watch/start?utm_source=instagram&utm_medium=social&utm_campaign=bio&fbclid=x",
    );
    expect((result.data as { archetypeHref: string }).archetypeHref).toBe(
      "/watches/archetype?utm_source=instagram&utm_medium=social&utm_campaign=bio",
    );
  });

  it("lets the CDN keep the page five minutes at most, and never an error", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-09T12:00:00+01:00"));
    const result = runLoader();
    const sent = headers({
      loaderHeaders: new Headers(result.init.headers),
      errorHeaders: undefined,
    } as unknown as Parameters<typeof headers>[0]);
    expect(sent.get("Cache-Control")).toBe("public, max-age=0, s-maxage=300");
    const failed = headers({
      loaderHeaders: new Headers(),
      errorHeaders: new Headers(),
    } as unknown as Parameters<typeof headers>[0]);
    expect(failed.get("Cache-Control")).toBe("no-store");
  });
});
