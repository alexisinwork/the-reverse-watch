import { describe, expect, it } from "vitest";

import { shouldReportSentryServerError } from "./sentry-error";

describe("Sentry server error filtering", () => {
  it("reports unexpected server errors", () => {
    expect(shouldReportSentryServerError(new Error("unexpected"), false)).toBe(
      true,
    );
  });

  it("ignores aborted requests and expected route misses", () => {
    expect(shouldReportSentryServerError(new Error("aborted"), true)).toBe(
      false,
    );
    expect(
      shouldReportSentryServerError(
        {
          status: 404,
          statusText: "Not Found",
          internal: true,
          data: null,
        },
        false,
      ),
    ).toBe(false);
  });
});
