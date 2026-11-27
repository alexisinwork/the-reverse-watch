import { render, screen, within } from "@testing-library/react";

import {
  Attribution,
  attributionTable,
  share,
  type AttributionRow,
} from "./admin-analytics";

const row = (
  source: string,
  medium: string | null,
  campaign: string | null,
  sessions: number,
  subscriptions = 0,
): AttributionRow => ({
  source,
  medium,
  campaign,
  sessions,
  quizStarts: Math.min(sessions, 2),
  quizCompletions: Math.min(sessions, 1),
  toolCompletions: Math.min(sessions, 1),
  subscriptions,
});

describe("source → campaign table", () => {
  it("rounds shares and shows a dash without sessions", () => {
    expect(share(1, 8)).toBe("13%");
    expect(share(1, 40)).toBe("2.5%");
    expect(share(1, 3)).toBe("33%");
    expect(share(0, 5)).toBe("0%");
    expect(share(0, 0)).toBe("–");
  });

  it("keeps direct on its own line, even before anyone came directly", () => {
    const empty = attributionTable([row("instagram", "social", "bio", 4, 1)]);
    expect(empty.direct).toMatchObject({ source: "direct", sessions: 0 });
    expect(empty.totals.sessions).toBe(4);
    const both = attributionTable([
      row("direct", "none", null, 3, 1),
      row("direct", null, null, 2),
      row("youtube", "video", "ep1", 5, 2),
    ]);
    expect(both.others.map((r) => r.source)).toEqual(["youtube"]);
    expect(both.direct).toMatchObject({ sessions: 5, subscriptions: 1 });
    expect(both.totals).toMatchObject({ sessions: 10, subscriptions: 3 });
  });

  it("shows each platform and episode with its sign-up rate", () => {
    render(
      <Attribution
        rows={[
          row("youtube", "video", "ep1", 8, 1),
          row("instagram", "social", "bio", 4, 1),
          row("direct", "none", null, 2),
        ]}
        byLanding={[{ landing: "/start", sessions: 4, subscriptions: 1 }]}
      />,
    );
    const table = screen.getAllByRole("table")[0]!;
    const youtube = within(table).getByRole("row", { name: /youtube/ });
    expect(youtube).toHaveTextContent("ep1");
    expect(youtube).toHaveTextContent("13%");
    const direct = within(table).getByRole("row", { name: /^direct/ });
    expect(direct).toHaveTextContent(/after an episode's ad/);
    expect(
      within(table).getByRole("row", { name: /All sessions/ }),
    ).toHaveTextContent("14");
    expect(screen.getByText("/start")).toBeInTheDocument();
  });
});
