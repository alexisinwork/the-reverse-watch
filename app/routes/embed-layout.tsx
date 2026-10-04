/**
 * /embed/:key/… — The Reserve's pages inside a partner's website. The key
 * is the partner's public key; only the websites registered for it may show
 * these pages in a frame (frame-ancestors, set by the root middleware from
 * embedFrameContext). The pages themselves are the site's own route modules
 * (see routes.ts); they read the partner site from partnerSiteContext and
 * hide the newsletter, dossier email and subscription check.
 */
import { useEffect, useMemo } from "react";
import { Outlet, redirect, useLoaderData, useLocation } from "react-router";

import type { Route } from "./+types/embed-layout";
import { postToHost } from "../components/embed-bridge";
import { EmbedSurfaceProvider, type EmbedSurface } from "../components/surface";
import { embedFrameContext, partnerSiteContext } from "../embed-context";
import {
  isPartnerFeature,
  sitePathForEmbed,
  themeCss,
  themeFromSearch,
  themeToSearch,
  type PartnerFeature,
} from "../domain/partner-sites";
import { findSiteByPublicKey } from "../domain/partner-sites.server";
import "../styles/embed.css";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, params, context }, next) => {
    // The public key is in the partner's page source. Opened directly in a
    // tab (not in a frame), a widget would skip the subscription and use up
    // the partner's quota, so the visitor gets The Reserve's own page.
    // Browsers without Fetch Metadata send no header and are let through;
    // frame-ancestors still limits who may frame the page.
    if (request.headers.get("Sec-Fetch-Dest") === "document") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect(sitePathForEmbed(new URL(request.url)));
    }
    const site = await findSiteByPublicKey(params.key);
    if (!site) {
      // React Router uses thrown Responses to preserve HTTP status boundaries.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw new Response("Unknown or inactive widget key", { status: 404 });
    }
    context.set(partnerSiteContext, site);
    context.set(embedFrameContext, site.allowedOrigins);
    return next();
  },
];

function featureOf(pathname: string, key: string): PartnerFeature {
  const segment = pathname.split(`/embed/${key}/`)[1]?.split("/")[0];
  return isPartnerFeature(segment) ? segment : "stories";
}

function siteOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:")
        return url.origin;
    } catch {
      // Fall back to the request's own origin.
    }
  }
  return new URL(request.url).origin;
}

export function loader({ request, params, context }: Route.LoaderArgs) {
  const site = context.get(partnerSiteContext)!;
  const url = new URL(request.url);
  // The site's saved theme, then whatever the widget tag overrides.
  const overrides = themeFromSearch(url.searchParams);
  return {
    key: params.key,
    css: themeCss({ ...site.theme, ...overrides }),
    themeQuery: themeToSearch(overrides).toString(),
    siteOrigin: siteOrigin(request),
  };
}

export function headers() {
  return {
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "private, no-store",
  };
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [{ name: "robots", content: "noindex, nofollow" }];
}

/** Tells the host page how tall the widget is and where it went. */
function useHostBridge(feature: PartnerFeature) {
  const location = useLocation();
  useEffect(() => {
    const shell = document.querySelector(".embed-shell");
    if (!shell) return;
    const height = () => Math.ceil(shell.getBoundingClientRect().height);
    postToHost({ type: "reserve:ready", feature, height: height() });
    let last = 0;
    const observer = new ResizeObserver(() => {
      const next = height();
      if (next !== last) {
        last = next;
        postToHost({ type: "reserve:resize", height: next });
      }
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [feature]);
  useEffect(() => {
    postToHost({
      type: "reserve:navigate",
      feature,
      path: `${location.pathname}${location.search}`,
    });
  }, [feature, location.pathname, location.search]);
}

export default function EmbedLayout() {
  const { key, css, themeQuery, siteOrigin } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const feature = featureOf(pathname, key);
  const surface = useMemo<EmbedSurface>(
    () => ({ key, feature, themeQuery, siteOrigin }),
    [key, feature, themeQuery, siteOrigin],
  );
  useHostBridge(feature);
  return (
    <EmbedSurfaceProvider value={surface}>
      {/* Every value has passed partnerThemeSchema (hex colours, enums). */}
      {css ? <style>{css}</style> : null}
      <div className="embed-shell">
        <Outlet />
        <footer className="embed-credit">
          <a href={siteOrigin} rel="noopener" target="_blank">
            Powered by The Reserve
          </a>
        </footer>
      </div>
    </EmbedSurfaceProvider>
  );
}
