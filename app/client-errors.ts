/**
 * Error reporting in the browser without Sentry in the first download
 * (owner decision, 2026-11-26: Sentry may load after the first paint).
 *
 * Until Sentry has loaded, errors wait in a short queue; once it is ready
 * they are sent in the order they happened, so an error in the first second
 * is not lost. An error before then also starts loading Sentry at once.
 * Server errors are reported by entry.server.tsx and never pass through here.
 */
import type { ClientOnErrorFunction } from "react-router";

export type RouterErrorInfo = Parameters<ClientOnErrorFunction>[1];

/** Where an error was caught, so Sentry can label it the way its own
 * handlers would have. */
export type ClientError =
  | { source: "router"; error: unknown; info: RouterErrorInfo }
  | { source: "boundary" | "window" | "promise"; error: unknown };

type Sender = (report: ClientError) => void;

/** Enough for a burst of errors on one page; more would only repeat. */
export const QUEUE_LIMIT = 25;

const queue: ClientError[] = [];
const reported = new WeakSet<object>();
let sender: Sender | null = null;
let onFirstError: (() => void) | null = null;

export function reportClientError(report: ClientError) {
  if (typeof window === "undefined") return;
  // The router's error handler and the error page can both see one error.
  const { error } = report;
  if (typeof error === "object" && error !== null) {
    if (reported.has(error)) return;
    reported.add(error);
  }
  if (sender) {
    sender(report);
    return;
  }
  if (queue.length < QUEUE_LIMIT) queue.push(report);
  const start = onFirstError;
  onFirstError = null;
  start?.();
}

/** Called once Sentry has loaded: sends the queued errors, then every new
 * one as it happens. */
export function errorReportingReady(send: Sender) {
  sender = send;
  for (const report of queue.splice(0)) send(report);
}

/** Lets an early error start loading Sentry before the page is idle. */
export function loadReportingOnFirstError(start: () => void) {
  if (sender) return;
  if (queue.length > 0) {
    start();
    return;
  }
  onFirstError = start;
}

/** For tests only: forget queued errors and the sender. */
export function resetClientErrorsForTest() {
  queue.splice(0);
  sender = null;
  onFirstError = null;
}
