import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import Privacy, { meta } from "./privacy";

describe("privacy policy", () => {
  it("explains collection, processors, rights and contact without naming AI providers", () => {
    const Stub = createRoutesStub([{ path: "/privacy", Component: Privacy }]);
    render(<Stub initialEntries={["/privacy"]} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy policy" }),
    ).toBeInTheDocument();
    for (const heading of [
      "What we collect and why",
      "Cookies and storage on your device",
      "Who processes data for us",
      "Your rights",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getAllByRole("link", { name: "alex@thereserve.watch" })[0],
    ).toHaveAttribute("href", "mailto:alex@thereserve.watch");
    expect(document.body.textContent).not.toMatch(/perplexity|muse|openai/i);
    expect(meta()[0]).toEqual({ title: "Privacy policy · The Reserve" });
  });
});
