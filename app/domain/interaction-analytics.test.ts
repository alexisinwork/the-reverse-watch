import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  interactionEventSchema,
  deliverInteraction,
  trustedAdvisorControl,
} from "./interaction-analytics";
const event = {
  sessionId: "a6a97217-18e4-4cb3-8c49-fd75dc272f12",
  name: "click",
  feature: "quiz",
  page: "/quiz",
  control: "Next",
  target: "/quiz",
  source: "example.com",
};
describe("anonymous interaction payload", () => {
  it("accepts a minimal tab-session interaction", () =>
    expect(interactionEventSchema.parse(event).control).toBe("Next"));
  it("rejects answer values, identifiers, full URLs and arbitrary payload fields", () => {
    expect(
      interactionEventSchema.safeParse({
        ...event,
        page: "/quiz?email=x@example.com",
      }).success,
    ).toBe(false);
    expect(
      interactionEventSchema.safeParse({ ...event, email: "x@example.com" })
        .success,
    ).toBe(false);
    expect(
      interactionEventSchema.safeParse({ ...event, answers: { wristCm: 18 } })
        .success,
    ).toBe(false);
  });
  it("associates widget events only with a public partner key", () => {
    expect(
      interactionEventSchema.safeParse({
        ...event,
        siteKey: "pk_live_AbCdEf0123456789AbCdEf01",
      }).success,
    ).toBe(true);
    expect(
      interactionEventSchema.safeParse({ ...event, siteKey: "sk_live_secret" })
        .success,
    ).toBe(false);
  });
});

describe("advisor parent messages", () => {
  const expected = {
    key: "pk_live_abcdefghijklmnopqrstuvwx",
    feature: "quiz" as const,
    origins: ["https://partner.example"],
    parent: window,
  };
  const data = {
    type: "reserve:advisor-click",
    key: expected.key,
    feature: "quiz",
    control: "advisor_tab",
  };
  const message = (
    payload: unknown = data,
    origin = "https://partner.example",
    source: MessageEventSource = window,
  ) => new MessageEvent("message", { data: payload, origin, source });
  it("accepts only a matching registered parent and tool", () =>
    expect(trustedAdvisorControl(message(), expected)).toBe("advisor_tab"));
  it("rejects wrong origins and other windows", () => {
    expect(
      trustedAdvisorControl(
        message(data, "https://unregistered.example"),
        expected,
      ),
    ).toBeNull();
    expect(
      trustedAdvisorControl(
        message(data, "https://partner.example", new MessageChannel().port1),
        expected,
      ),
    ).toBeNull();
  });
  it("rejects another partner, another tool and unexpected payload fields", () => {
    for (const payload of [
      { ...data, key: "wrong" },
      { ...data, feature: "find" },
      { ...data, email: "private@example.com" },
    ])
      expect(trustedAdvisorControl(message(payload), expected)).toBeNull();
  });
});

describe("shared anonymous widget session", () => {
  const seed = "00000000-0000-4000-8000-000000000001";
  it("starts independent tool contexts with the same parent-page nonce", async () => {
    try {
      for (const feature of ["quiz", "archetype", "find"]) {
        vi.resetModules();
        window.history.replaceState(
          {},
          "",
          `/embed/pk_live_abcdefghijklmnopqrstuvwx/${feature}?_reserve_session=${seed}`,
        );
        const { currentInteractionSession } =
          await import("./interaction-analytics");
        expect(currentInteractionSession()).toBe(seed);
      }
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });
  it("ignores injected session parameters on first-party pages", async () => {
    try {
      vi.resetModules();
      window.history.replaceState({}, "", `/quiz?_reserve_session=${seed}`);
      const { currentInteractionSession } =
        await import("./interaction-analytics");
      expect(currentInteractionSession()).not.toBe(seed);
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });
});

describe("browser analytics delivery", () => {
  const delivery = {
    ...event,
    name: "click" as const,
    feature: "quiz" as const,
    eventId: "00000000-0000-4000-8000-000000000001",
  };
  it("retries a server failure once with one stable event ID", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await deliverInteraction(delivery, fetchImpl, async () => {})).toBe(
      true,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![1]?.body).toBe(
      fetchImpl.mock.calls[1]![1]?.body,
    );
    expect(fetchImpl.mock.calls[0]![1]?.keepalive).toBe(true);
  });
  it("does not retry rejected or rate-limited requests", async () => {
    for (const status of [400, 403, 409, 429]) {
      const f = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status }));
      expect(await deliverInteraction(delivery, f, async () => {})).toBe(false);
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it("does not duplicate an older event without a delivery ID", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("lost connection"));
    expect(
      await deliverInteraction(
        { ...delivery, eventId: undefined },
        f,
        async () => {},
      ),
    ).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("acknowledges success without any retry", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    expect(await deliverInteraction(delivery, f, async () => {})).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("first touch on The Reserve's own pages", () => {
  const setReferrer = (value: string) =>
    Object.defineProperty(document, "referrer", {
      value,
      configurable: true,
    });
  const visit = async (address: string, referrer = "") => {
    vi.resetModules();
    window.history.replaceState({}, "", address);
    setReferrer(referrer);
    return import("./interaction-analytics");
  };
  // Earlier tests in this file opened first-party pages in the same tab.
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    setReferrer("");
  });

  it("keeps the source from /start to the quiz, across a full page load", async () => {
    const start = await visit(
      "/start?utm_source=instagram&utm_medium=social&utm_campaign=bio",
      "https://l.instagram.com/",
    );
    const landed = start.interactionContext();
    expect(landed).toMatchObject({
      source: "instagram",
      medium: "social",
      campaign: "bio",
      landing: "/start",
      page: "/start",
    });
    // The quiz link on /start is a plain link: a new page load, no tags in
    // the address and our own site as the referrer.
    const quiz = await visit(
      "/watches/archetype",
      "https://thereserve.watch/start",
    );
    const later = quiz.interactionContext();
    expect(later).toMatchObject({
      sessionId: landed.sessionId,
      source: "instagram",
      medium: "social",
      campaign: "bio",
      landing: "/start",
      feature: "archetype",
      page: "/watches/archetype",
    });
    expect(
      interactionEventSchema.safeParse({ ...later, name: "quiz_start" })
        .success,
    ).toBe(true);
  });

  it("counts a typed address as direct, and a Short apart from its video", async () => {
    const typed = await visit("/");
    expect(typed.interactionContext()).toMatchObject({
      source: "direct",
      medium: "none",
      landing: "/",
    });
    window.sessionStorage.clear();
    const short = await visit(
      "/watches/find?utm_source=youtube&utm_medium=shorts&utm_campaign=ep11",
    );
    expect(short.interactionContext()).toMatchObject({
      source: "youtube",
      medium: "shorts",
      campaign: "ep11 shorts",
    });
  });

  it("keeps partner frames on their per-page source, without storage", async () => {
    const frame = await visit(
      "/embed/pk_live_abcdefghijklmnopqrstuvwx/quiz",
      "https://partner.example/page",
    );
    const context = frame.interactionContext();
    expect(context).toMatchObject({ source: "partner.example" });
    expect(context).not.toHaveProperty("medium");
    expect(context).not.toHaveProperty("landing");
    expect(window.sessionStorage.length).toBe(0);
  });

  it("accepts the sign-up event and refuses an entry page with a query", () => {
    const signup = {
      sessionId: "a6a97217-18e4-4cb3-8c49-fd75dc272f12",
      name: "newsletter_signup",
      feature: "site",
      page: "/start",
      source: "tiktok",
      medium: "social",
      campaign: "bio",
      landing: "/start",
    };
    expect(interactionEventSchema.safeParse(signup).success).toBe(true);
    expect(
      interactionEventSchema.safeParse({ ...signup, landing: "/start?x=1" })
        .success,
    ).toBe(false);
    expect(
      interactionEventSchema.safeParse({ ...signup, medium: "Social Media" })
        .success,
    ).toBe(false);
    expect(
      interactionEventSchema.safeParse({ ...signup, email: "a@b.com" }).success,
    ).toBe(false);
  });
});
