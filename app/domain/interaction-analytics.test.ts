import { describe, expect, it } from "vitest";
import { interactionEventSchema } from "./interaction-analytics";
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
