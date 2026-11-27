import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { vi } from "vitest";

const analytics = vi.hoisted(() => ({
  currentFirstTouch: vi.fn(),
  sendNewsletterSignup: vi.fn(),
}));
vi.mock("../domain/interaction-analytics", () => analytics);

import { BeehiivSignup } from "./beehiiv-signup";

function renderSignup(result: Record<string, unknown>) {
  const received: FormData[] = [];
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <BeehiivSignup />,
      action: async ({ request }) => {
        received.push(await request.formData());
        return result;
      },
    },
  ]);
  const view = render(<Stub />);
  return { received, view };
}

function subscribe() {
  fireEvent.change(screen.getByPlaceholderText("Email address"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
}

describe("newsletter sign-up attribution", () => {
  beforeEach(() => {
    analytics.currentFirstTouch.mockReturnValue({
      source: "youtube",
      medium: "video",
      campaign: "ep1",
      landing: "/watches/find",
    });
    analytics.sendNewsletterSignup.mockReset();
  });

  it("sends the tab's first touch with the address and counts a new subscription", async () => {
    const { received } = renderSignup({
      ok: true,
      message: "Subscribed.",
      subscribed: true,
    });
    subscribe();
    await screen.findByText("Subscribed.");
    const form = received[0]!;
    expect(form.get("touchSource")).toBe("youtube");
    expect(form.get("touchMedium")).toBe("video");
    expect(form.get("touchCampaign")).toBe("ep1");
    expect(form.get("touchLanding")).toBe("/watches/find");
    expect(analytics.sendNewsletterSignup).toHaveBeenCalledTimes(1);
    // The analytics event is sent without arguments: never the address.
    expect(analytics.sendNewsletterSignup.mock.calls[0]).toEqual([]);
  });

  it("does not count an unlock for someone already subscribed", async () => {
    renderSignup({ ok: true, message: "You are already subscribed." });
    subscribe();
    await screen.findByText("You are already subscribed.");
    await waitFor(() =>
      expect(analytics.sendNewsletterSignup).not.toHaveBeenCalled(),
    );
  });

  it("still signs up without a first touch (blocked storage)", async () => {
    analytics.currentFirstTouch.mockReturnValue(undefined);
    const { received } = renderSignup({ ok: false, message: "Try again." });
    subscribe();
    await screen.findByText("Try again.");
    expect(received[0]!.get("touchSource")).toBeNull();
    expect(received[0]!.get("email")).toBe("reader@example.com");
  });
});
