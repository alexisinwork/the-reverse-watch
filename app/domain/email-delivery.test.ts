import { summarizeEmailDelivery } from "./email-delivery";

describe("email delivery aggregation", () => {
  it.each([
    ["sent", "sent", "sent"],
    ["sent", "unavailable", "sent"],
    ["unavailable", "sent", "sent"],
    ["sent", "failed", "partial"],
    ["failed", "sent", "partial"],
    ["failed", "failed", "failed"],
    ["failed", "unavailable", "failed"],
    ["misconfigured", "unavailable", "failed"],
    ["sent", "misconfigured", "partial"],
    ["already_requested", "unavailable", "already_requested"],
    ["already_requested", "failed", "partial"],
    ["unavailable", "unavailable", "unavailable"],
  ] as const)(
    "summarizes %s newsletter and %s dossier as %s",
    (newsletterStatus, dossierStatus, expectedStatus) => {
      const result = summarizeEmailDelivery(newsletterStatus, dossierStatus);
      expect(result.status).toBe(expectedStatus);
      expect(result.message).toContain("Your result remains available.");
    },
  );
});
