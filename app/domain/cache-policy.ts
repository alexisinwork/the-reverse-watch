/**
 * CDN caching for pages that look the same to every visitor.
 *
 * Browsers always revalidate (`max-age=0`), so a visitor never keeps an old
 * page. Vercel's CDN keeps a copy for an hour (`s-maxage`) and, after that,
 * keeps serving the old copy for up to a day while it fetches a fresh one in
 * the background (`stale-while-revalidate`). A new deployment starts with an
 * empty cache.
 *
 * The hour is an editorial choice, not a measurement: a newly published story
 * appears in lists within about an hour. Shorten it here if that is too slow.
 */
export const PUBLIC_PAGE_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/** Errors and partner widget pages must never be shared from the CDN. */
export const NO_STORE = "no-store";

type HeadersInput = {
  parentHeaders: Headers;
  errorHeaders?: Headers | undefined;
};

/**
 * The `headers` export for a public content page.
 *
 * Inside a partner widget the parent layout already sends
 * `private, no-store`: each view is counted for the partner's invoice, so it
 * must reach the server. That parent value is kept as it is.
 */
export function publicPageHeaders({
  parentHeaders,
  errorHeaders,
}: HeadersInput): Headers {
  if (parentHeaders.has("Cache-Control")) {
    return parentHeaders;
  }
  const headers = new Headers(parentHeaders);
  // A missing story (404) or a failed read must not be kept for an hour.
  const isError = errorHeaders !== undefined;
  headers.set("Cache-Control", isError ? NO_STORE : PUBLIC_PAGE_CACHE_CONTROL);
  return headers;
}
