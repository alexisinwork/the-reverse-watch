import type { Route } from "./+types/home";
import { useCallback, useState } from "react";
import { data, useLoaderData } from "react-router";
import { z } from "zod";

import {
  BeehiivSignup,
  type NewsletterActionResult,
} from "../components/beehiiv-signup";
import { GaugeMark } from "../components/gauge-mark";
import {
  BeehiivSubscriptionNotActiveError,
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "../domain/beehiiv.server";
import {
  hasDiagnosticAccess,
  issueDiagnosticAccessCookie,
  parseDiagnosticAccessConfiguration,
} from "../domain/diagnostic-access.server";
import { parseDiscoveryStorySlug } from "../domain/discovery-context.server";
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
    "Cache-Control": "private, no-store",
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  const storyContext = parseDiscoveryStorySlug(
    new URL(request.url).searchParams.get("story"),
  );
  return {
    diagnosticAccess: await hasDiagnosticAccess(request),
    discoveryStorySlug:
      storyContext.status === "valid" ? storyContext.slug : null,
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
    console.error(
      JSON.stringify({
        event: "landing_subscription_configuration_error",
        component: "beehiiv",
        reason: configuration.reason,
      }),
    );
    return data<NewsletterActionResult>(
      {
        ok: false,
        message: "Subscriptions are temporarily unavailable. Please try again.",
      },
      { status: 503, headers: responseHeaders },
    );
  }

  const accessConfiguration = parseDiagnosticAccessConfiguration();
  if (!accessConfiguration.configured) {
    console.error(
      JSON.stringify({
        event: "landing_subscription_configuration_error",
        component: "diagnostic_access",
        reason: accessConfiguration.reason,
      }),
    );
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
    const headers = new Headers(responseHeaders);
    headers.set(
      "Set-Cookie",
      await issueDiagnosticAccessCookie(accessConfiguration),
    );
    return data<NewsletterActionResult>(
      {
        ok: true,
        message: "Subscribed. The reference diagnostic is now unlocked.",
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof BeehiivSubscriptionNotActiveError) {
      console.error(
        JSON.stringify({
          event: "landing_beehiiv_subscription_rejected",
          providerStatus: error.providerStatus,
        }),
      );
      return data<NewsletterActionResult>(
        {
          ok: false,
          message:
            "This email address could not be activated. Check it and try again.",
        },
        { status: 422, headers: responseHeaders },
      );
    }
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
  const loaderData = useLoaderData<typeof loader>();
  const [diagnosticAccess, setDiagnosticAccess] = useState(
    loaderData?.diagnosticAccess ?? false,
  );
  const diagnosticHref = loaderData?.discoveryStorySlug
    ? `/quiz?story=${encodeURIComponent(loaderData.discoveryStorySlug)}`
    : "/quiz";
  const unlockDiagnostic = useCallback(() => setDiagnosticAccess(true), []);

  return (
    <div className="site-shell">
      <main className="landing" id="main-content">
        <div className="brand-lockup">
          <GaugeMark />
          <h1>The Reserve</h1>
        </div>
        <p className="manifesto">
          The brand tells you a story about heritage. We investigate the
          filings, the balance sheets, and who actually owns the name on the
          dial.
        </p>
        <nav className="landing-links" aria-label="Explore The Reserve">
          <a className="landing-action" href="/watches">
            <span className="landing-action__kicker">Evidence archive</span>
            <strong>Explore watches</strong>
            <span className="landing-action__description">
              Examine sourced watch sightings from cinema, television, and
              public life—with uncertainty left visible.
            </span>
            <span className="landing-action__footer">Open the archive →</span>
          </a>
          <a
            className={`landing-action landing-action--diagnostic${
              diagnosticAccess ? " landing-action--unlocked" : ""
            }`}
            href={diagnosticAccess ? diagnosticHref : "#newsletter-signup"}
          >
            <span className="landing-action__kicker">
              {diagnosticAccess
                ? "Subscriber access · Unlocked"
                : "Subscriber access"}
            </span>
            <strong>Start the reference diagnostic</strong>
            <span className="landing-action__description">
              Build an evidence-led shortlist from your real budget, wrist,
              operating needs, and personal signal.
            </span>
            <span className="landing-action__footer">
              {diagnosticAccess
                ? "Begin the diagnostic →"
                : "Subscribe below to unlock ↓"}
            </span>
          </a>
        </nav>
        <BeehiivSignup onSubscribed={unlockDiagnostic} />
      </main>

      <footer className="site-footer">
        <span>thereserve.watch</span>
        <span>Archival Documentary</span>
      </footer>
    </div>
  );
}
