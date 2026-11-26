import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import {
  errorReportingReady,
  loadReportingOnFirstError,
  reportClientError,
} from "./client-errors";

const sentryEnv: Record<string, unknown> = import.meta.env;
const sentryDsn =
  typeof sentryEnv.SENTRY_DSN === "string" ? sentryEnv.SENTRY_DSN : undefined;
const sentryEnvironment =
  typeof sentryEnv.MODE === "string" ? sentryEnv.MODE : undefined;

// Until Sentry has loaded, page-level errors go to the queue in
// client-errors.ts; Sentry's own handlers take over once it is ready.
const onWindowError = (event: ErrorEvent) =>
  reportClientError({
    source: "window",
    error: event.error ?? new Error(event.message),
  });
const onRejection = (event: PromiseRejectionEvent) =>
  reportClientError({ source: "promise", error: event.reason });
window.addEventListener("error", onWindowError);
window.addEventListener("unhandledrejection", onRejection);

let loading = false;
function loadSentry() {
  if (loading) return;
  loading = true;
  void import("./sentry.client").then(({ startSentry }) => {
    const send = startSentry(sentryDsn, sentryEnvironment);
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onRejection);
    errorReportingReady(send);
  });
}

// Owner decision, 2026-11-26: Sentry loads after the page has loaded and the
// browser is idle, or at once if an error happens first.
loadReportingOnFirstError(loadSentry);
function whenIdle() {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadSentry, { timeout: 4000 });
  } else {
    setTimeout(loadSentry, 2000);
  }
}
if (document.readyState === "complete") {
  whenIdle();
} else {
  window.addEventListener("load", whenIdle, { once: true });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter
        onError={(error, info) =>
          reportClientError({ source: "router", error, info })
        }
      />
    </StrictMode>,
  );
});
