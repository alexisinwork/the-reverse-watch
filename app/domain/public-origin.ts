/**
 * The site's public address, for links that leave a page: the widget's
 * "Powered by The Reserve" credit, the partner snippets on /partners and
 * /admin/sites, the API description and the archetype's share link.
 *
 * APP_URL names it. A local or unencrypted address in APP_URL is used only
 * while the request itself is local (scripts/dev-partners.ts runs the site
 * with APP_URL=http://localhost:5173), so a development value never reaches
 * visitors. On 2026-11-27 production had APP_URL=http://localhost:5173 and
 * every widget's credit pointed there.
 */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.startsWith("127.") ||
    host === "[::1]"
  );
}

export function publicOrigin(
  request: Request,
  configured: string | undefined = process.env.APP_URL,
): string {
  const own = new URL(request.url);
  const value = configured?.trim();
  if (!value) return own.origin;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return own.origin;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return own.origin;
  // A visitor on a public address never gets a local or http:// one.
  if (
    !isLocalHostname(own.hostname) &&
    (url.protocol !== "https:" || isLocalHostname(url.hostname))
  )
    return own.origin;
  return url.origin;
}
