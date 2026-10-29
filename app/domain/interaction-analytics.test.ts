import { describe, expect, it, vi } from "vitest";
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
