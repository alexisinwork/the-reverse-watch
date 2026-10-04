/**
 * The partner JSON API (/api/v1/…): who is calling, cross-site (CORS)
 * headers, and the live stream of search steps.
 *
 * Two ways in:
 * - From a partner's own server: `Authorization: Bearer sk_live_…` (the
 *   secret key, never put in a web page).
 * - From a partner's web page: the public key (`X-Reserve-Key: pk_live_…`
 *   or `?key=pk_live_…`), accepted only when the browser's Origin is one of
 *   that site's registered addresses.
 *
 * Only search constraints are accepted; nothing identifying a visitor is
 * read, stored or passed to the AI providers.
 */
import type { AiSearchView, ProgressLink } from "./ai-watch-types";
import { originAllowed } from "./partner-sites";
import {
  findSiteByPublicKey,
  findSiteBySecretKey,
  type PartnerSite,
} from "./partner-sites.server";
import type { RateLimitPolicy } from "./rate-limit.server";
import { consumeSharedRateLimit } from "./rate-limit-upstash.server";
import { visitorKey } from "./visitor-key.server";

export type ApiCaller = {
  site: PartnerSite;
  /** "server": secret key; "browser": public key from a registered website. */
  via: "server" | "browser";
  /** The browser's Origin, echoed in CORS headers. */
  origin: string | null;
};

const ALLOWED_HEADERS = "Content-Type, X-Reserve-Key, Accept";

function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": ALLOWED_HEADERS,
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

export function apiJson(
  body: unknown,
  status = 200,
  origin: string | null = null,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...corsHeaders(origin),
      ...extra,
    },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  origin: string | null = null,
) {
  return apiJson({ error: { code, message } }, status, origin);
}

/**
 * The answer to a browser's CORS preflight. Which key will be used isn't
 * known yet (preflights carry no custom header values), so any origin may
 * ask; the real request is then checked against the key's websites.
 */
export function apiPreflight(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("Origin")),
  });
}

/** The calling partner, or the error Response to return. */
export async function authenticateApiRequest(
  request: Request,
): Promise<ApiCaller | Response> {
  const origin = request.headers.get("Origin");
  const authorization = request.headers.get("Authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

  if (bearer) {
    if (origin) {
      // A secret key in a browser is a leaked key: refuse it outright.
      return apiError(
        400,
        "secret_key_in_browser",
        "Secret keys are for your server only. Use your public key (pk_live_…) in web pages.",
      );
    }
    const site = await findSiteBySecretKey(bearer);
    return site
      ? { site, via: "server", origin: null }
      : apiError(401, "invalid_key", "Unknown or inactive secret key.");
  }

  const publicKey =
    request.headers.get("X-Reserve-Key") ??
    new URL(request.url).searchParams.get("key");
  if (!publicKey) {
    return apiError(
      401,
      "missing_key",
      "Send your secret key (Authorization: Bearer sk_live_…) from your server, or your public key (X-Reserve-Key) from your website.",
      origin,
    );
  }
  const site = await findSiteByPublicKey(publicKey.trim());
  if (!site) {
    return apiError(
      401,
      "invalid_key",
      "Unknown or inactive public key.",
      origin,
    );
  }
  if (!originAllowed(origin, site.allowedOrigins)) {
    return apiError(
      403,
      "origin_not_allowed",
      origin
        ? `${origin} is not registered for this key. Ask The Reserve to add it.`
        : "Public keys work only from your registered websites. From a server, use your secret key.",
    );
  }
  return { site, via: "browser", origin };
}

// One partner's server may search often on behalf of many visitors, so it
// gets a larger shared allowance than one visitor's browser.
const SERVER_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 300,
  windowMs: 10 * 60 * 1_000,
};

/** The rate-limit key and policy for a caller's new searches. */
export function apiRateLimit(
  caller: ApiCaller,
  feature: string,
  request: Request,
  visitorPolicy: RateLimitPolicy,
): { rateKey: string; policy: RateLimitPolicy } {
  return caller.via === "server"
    ? { rateKey: `api:${caller.site.id}:${feature}`, policy: SERVER_POLICY }
    : { rateKey: visitorKey(`api-${feature}`, request), policy: visitorPolicy };
}

/** Limits a whole API call (not just fresh searches) for one caller. */
export async function apiCallAllowed(
  caller: ApiCaller,
  feature: string,
  request: Request,
  visitorPolicy: RateLimitPolicy,
) {
  const { rateKey, policy } = apiRateLimit(
    caller,
    feature,
    request,
    visitorPolicy,
  );
  return (await consumeSharedRateLimit(rateKey, policy)).allowed;
}

export function wantsStream(request: Request) {
  return (
    (request.headers.get("Accept") ?? "").includes("text/event-stream") ||
    new URL(request.url).searchParams.get("stream") === "1"
  );
}

/**
 * Server-sent events: one `progress` event per search step (with the watch
 * when a step confirmed one), then one `result` event, then the stream
 * ends. `result` carries what `toEvent` builds from the finished search.
 */
export function apiStream<T>(
  progress: Promise<ProgressLink | null>,
  result: Promise<T>,
  origin: string | null,
  toEvent: (value: T) => unknown = (value) => value,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        let link = await progress;
        while (link) {
          send("progress", link.event);
          link = await link.next;
        }
        send("result", toEvent(await result));
      } catch {
        send("result", { result: { status: "unavailable" } });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      ...corsHeaders(origin),
    },
  });
}

/** What every search endpoint returns for a finished search. */
export function searchBody(result: AiSearchView) {
  return { result };
}
