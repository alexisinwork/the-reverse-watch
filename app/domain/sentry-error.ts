import { isRouteErrorResponse } from "react-router";

export function shouldReportSentryServerError(
  error: unknown,
  requestAborted: boolean,
) {
  if (requestAborted) return false;
  return !(isRouteErrorResponse(error) && error.status === 404);
}
