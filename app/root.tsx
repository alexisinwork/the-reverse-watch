import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import * as Sentry from "@sentry/react-router";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";

import type { Route } from "./+types/root";
import { YouTubeCallout } from "./components/youtube-callout";
import { requestMiddleware } from "./middleware.server";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/components.css";

export const middleware: Route.MiddlewareFunction[] = [requestMiddleware];

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&display=swap",
  },
];

export function redactAnalyticsUrl(event: BeforeSendEvent) {
  try {
    const url = new URL(event.url);
    return { ...event, url: `${url.origin}${url.pathname}` };
  } catch {
    return null;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#08090b" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <Analytics beforeSend={redactAnalyticsUrl} />
      </body>
    </html>
  );
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <Outlet />
      {/* On every visitor page; the admin pages are for the owner only, and
          partner widgets carry only the partner's chosen feature. */}
      {pathname.startsWith("/admin") ||
      pathname.startsWith("/embed/") ? null : (
        <YouTubeCallout />
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = 500;
  let heading = "Archive unavailable";
  let detail = "The requested record could not be opened.";

  if (isRouteErrorResponse(error)) {
    status = error.status;
    heading = error.status === 404 ? "Record not found" : heading;
    detail =
      error.status === 404
        ? "The page may have been moved or was never entered into the archive."
        : error.statusText || detail;
  } else if (error instanceof Error) {
    Sentry.captureException(error);
    if (import.meta.env.DEV) {
      detail = error.message;
    }
  }

  return (
    <main className="error-page">
      {/* React 19 moves this into <head>: error pages need a tab title too. */}
      <title>{`${heading} · The Reserve`}</title>
      <div className="error-panel">
        <span className="eyebrow">Error {status}</span>
        <h1>{heading}</h1>
        <p>{detail}</p>
        <a className="text-link" href="/">
          Return to The Reserve
        </a>
      </div>
    </main>
  );
}
