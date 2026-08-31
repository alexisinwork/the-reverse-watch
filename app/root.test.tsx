import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock("@sentry/react-router", () => ({ captureException }));

import { ErrorBoundary } from "./root";

describe("root error reporting", () => {
  beforeEach(() => captureException.mockClear());

  it("captures unexpected errors while preserving the branded boundary", () => {
    const error = new Error("unexpected diagnostic failure");

    render(<ErrorBoundary error={error} params={{}} />);

    expect(captureException).toHaveBeenCalledWith(error);
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

    expect(captureException).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Record not found" }),
    ).toBeVisible();
  });
});
