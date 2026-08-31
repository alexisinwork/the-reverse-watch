import type { Route } from "./+types/home";
import { data } from "react-router";
import { z } from "zod";

import {
  BeehiivSignup,
  type NewsletterActionResult,
} from "../components/beehiiv-signup";
import { GaugeMark } from "../components/gauge-mark";
import {
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "../domain/beehiiv.server";
import "../styles/home.css";

const newsletterEmailSchema = z.string().trim().email().max(320);

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "The Reserve · Documentary & Horological Forensics" },
    {
      name: "description",
      content:
        "How watch companies live, die, and get resurrected. And who actually owns the name on the dial.",
    },
  ];
}

export function headers({
  actionHeaders,
}: Route.HeadersArgs): ReturnType<Route.HeadersFunction> {
  if (actionHeaders.has("Cache-Control")) return actionHeaders;

  return {
    "Cache-Control":
      "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const responseHeaders = { "Cache-Control": "no-store" };
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return data<NewsletterActionResult>(
      { ok: false, message: "The subscription request was rejected." },
      { status: 403, headers: responseHeaders },
    );
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "newsletter") {
    return data<NewsletterActionResult>(
      { ok: false, message: "The subscription request is incomplete." },
      { status: 400, headers: responseHeaders },
    );
  }
  if (formData.get("newsletterConsent") !== "yes") {
    return data<NewsletterActionResult>(
      { ok: false, message: "Please confirm the email opt-in." },
      { status: 400, headers: responseHeaders },
    );
  }

  const email = newsletterEmailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    return data<NewsletterActionResult>(
      { ok: false, message: "Enter a valid email address." },
      { status: 400, headers: responseHeaders },
    );
  }

  const configuration = parseBeehiivConfiguration();
  if (!configuration.configured) {
    return data<NewsletterActionResult>(
      {
        ok: false,
        message: "Subscriptions are temporarily unavailable. Please try again.",
      },
      { status: 503, headers: responseHeaders },
    );
  }

  try {
    await subscribeToBeehiiv(email.data, configuration);
    return data<NewsletterActionResult>(
      { ok: true, message: "Subscribed. Welcome to The Reserve." },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "landing_beehiiv_subscription_error",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
    return data<NewsletterActionResult>(
      {
        ok: false,
        message: "The subscription could not be completed. Please try again.",
      },
      { status: 502, headers: responseHeaders },
    );
  }
}

export default function Home() {
  return (
    <div className="site-shell">
      <main className="landing" id="main-content">
        <div className="mark-container">
          <GaugeMark />
        </div>
        <h1>The Reserve</h1>
        <p className="manifesto">
          The brand tells you a story about heritage. We investigate the
          filings, the balance sheets, and who actually owns the name on the
          dial.
        </p>
        <BeehiivSignup />
        <nav className="landing-links" aria-label="Explore The Reserve">
          <a className="diagnostic-link" href="/watches">
            Explore watches of celebrity &amp; cinema
          </a>
          <a className="diagnostic-link" href="/quiz">
            Start the reference diagnostic
          </a>
        </nav>
      </main>

      <footer className="site-footer">
        <span>thereserve.watch</span>
        <span>Archival Documentary</span>
      </footer>
    </div>
  );
}
