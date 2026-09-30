import { createHash } from "node:crypto";

/**
 * A rate-limit key for the visitor's network address. The address is hashed,
 * so no IP address is ever stored or logged.
 */
export function visitorKey(prefix: string, request: Request) {
  const address =
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `${prefix}:${createHash("sha256").update(address).digest("hex")}`;
}

/** False when a browser says the request came from another website. */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}
