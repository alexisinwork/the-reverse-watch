import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const { reportClientError } = vi.hoisted(() => ({
  reportClientError: vi.fn(),
}));

vi.mock("./client-errors", () => ({ reportClientError }));

import { ErrorBoundary, redactAnalyticsUrl } from "./root";

describe("root error reporting", () => {
  beforeEach(() => reportClientError.mockClear());

  it("captures unexpected errors while preserving the branded boundary", () => {
    const error = new Error("unexpected diagnostic failure");

    render(<ErrorBoundary error={error} params={{}} />);

    expect(reportClientError).toHaveBeenCalledWith({
      source: "boundary",
      error,
    });
    expect(
      screen.getByRole("heading", { name: "Archive unavailable" }),
    ).toBeVisible();
  });

  it("does not report an expected missing route", () => {
    render(
      <ErrorBoundary
        error={{
          status: 404,
          statusText: "Not Found",
          internal: true,
          data: null,
        }}
        params={{}}
      />,
    );

    expect(reportClientError).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Record not found" }),
    ).toBeVisible();
  });
});

describe("analytics URL privacy", () => {
  it("removes query parameters before analytics collection", () => {
    expect(
      redactAnalyticsUrl({
        type: "pageview",
        url: "https://thereserve.watch/quiz?token=private#summary",
      }),
    ).toEqual({
      type: "pageview",
      url: "https://thereserve.watch/quiz",
    });
  });

  it("drops malformed URLs", () => {
    expect(redactAnalyticsUrl({ type: "event", url: "not a URL" })).toBeNull();
  });
});
