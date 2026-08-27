import { render, screen } from "@testing-library/react";

import { BEEHIIV_FORM_ID } from "../components/beehiiv-signup";
import Home, { meta } from "./home";

describe("landing page", () => {
  it("preserves the documentary landing-page copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "The Reserve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/we investigate the filings, the balance sheets/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Archival Documentary")).toBeInTheDocument();
  });

  it("loads the existing Beehiiv form without embedding a credential", () => {
    render(<Home />);
    const script = document.querySelector<HTMLScriptElement>(
      "script[data-beehiiv-form]",
    );

    expect(script).toHaveAttribute("data-beehiiv-form", BEEHIIV_FORM_ID);
    expect(script).toHaveAttribute(
      "src",
      "https://subscribe-forms.beehiiv.com/v3/loader.js",
    );
  });

  it("retains the original document metadata", () => {
    expect(meta()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "The Reserve · Documentary & Horological Forensics",
        }),
      ]),
    );
  });
});
