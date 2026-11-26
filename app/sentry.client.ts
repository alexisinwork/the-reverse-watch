/**
 * Sentry for the browser, loaded on its own after the page has finished
 * loading (see client-errors.ts and entry.client.tsx), so its code is not
 * part of the first download. Tracing stays off as before: no sample rate
 * is set, so only errors are sent, without personal data.
 */
import * as Sentry from "@sentry/react-router";

import type { ClientError } from "./client-errors";

export function startSentry(
  dsn: string | undefined,
  environment: string | undefined,
) {
  Sentry.init({ dsn, environment, sendDefaultPii: false });
  return (report: ClientError) => {
    switch (report.source) {
      case "router":
        Sentry.sentryOnError(report.error, report.info);
        return;
      case "window":
        Sentry.captureException(report.error, {
          mechanism: {
            handled: false,
            type: "auto.browser.global_handlers.onerror",
          },
        });
        return;
      case "promise":
        Sentry.captureException(report.error, {
          mechanism: {
            handled: false,
            type: "auto.browser.global_handlers.onunhandledrejection",
          },
        });
        return;
      case "boundary":
        Sentry.captureException(report.error);
        return;
    }
  };
}
