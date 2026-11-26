import { vi } from "vitest";

import {
  type ClientError,
  errorReportingReady,
  loadReportingOnFirstError,
  QUEUE_LIMIT,
  reportClientError,
  resetClientErrorsForTest,
} from "./client-errors";

describe("browser error queue until Sentry loads", () => {
  beforeEach(() => resetClientErrorsForTest());

  it("keeps errors that happen before Sentry and sends them in order", () => {
    const first = new Error("first");
    const second = new Error("second");
    reportClientError({ source: "window", error: first });
    reportClientError({ source: "promise", error: second });

    const sent: ClientError[] = [];
    errorReportingReady((report) => sent.push(report));

    expect(sent).toEqual([
      { source: "window", error: first },
      { source: "promise", error: second },
    ]);
  });

  it("sends later errors straight away", () => {
    const sent: ClientError[] = [];
    errorReportingReady((report) => sent.push(report));
    const later = new Error("later");
    reportClientError({ source: "boundary", error: later });
    expect(sent).toEqual([{ source: "boundary", error: later }]);
  });

  it("reports one error once when the router and the error page both see it", () => {
    const error = new Error("render failure");
    reportClientError({ source: "boundary", error });
    reportClientError({ source: "boundary", error });
    const sent: ClientError[] = [];
    errorReportingReady((report) => sent.push(report));
    expect(sent).toHaveLength(1);
  });

  it("starts loading Sentry at the first early error", () => {
    const start = vi.fn();
    loadReportingOnFirstError(start);
    expect(start).not.toHaveBeenCalled();
    reportClientError({ source: "window", error: new Error("early") });
    reportClientError({ source: "window", error: new Error("second") });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("starts at once when an error is already waiting", () => {
    reportClientError({ source: "window", error: new Error("before") });
    const start = vi.fn();
    loadReportingOnFirstError(start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("keeps at most the queue limit while Sentry is loading", () => {
    for (let index = 0; index < QUEUE_LIMIT + 10; index += 1) {
      reportClientError({ source: "window", error: new Error(`e${index}`) });
    }
    const sent: ClientError[] = [];
    errorReportingReady((report) => sent.push(report));
    expect(sent).toHaveLength(QUEUE_LIMIT);
  });
});
