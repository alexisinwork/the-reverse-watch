import type { Route } from "./+types/home";
import { useCallback, useState } from "react";
import { data, useLoaderData } from "react-router";
import { z } from "zod";

import {
  BeehiivSignup,
  type NewsletterActionResult,
} from "../components/beehiiv-signup";
import { GaugeMark } from "../components/gauge-mark";
import { visitorKey } from "../domain/visitor-key.server";
import {
  BeehiivSubscriptionNotActiveError,
  isActiveBeehiivSubscriber,
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "../domain/beehiiv.server";
import type { RateLimitPolicy } from "../domain/rate-limit.server";
import { consumeSharedRateLimit } from "../domain/rate-limit-upstash.server";
import {
  hasDiagnosticAccess,
  issueDiagnosticAccessCookie,
  parseDiagnosticAccessConfiguration,
} from "../domain/diagnostic-access.server";
import { parseDiscoveryStorySlug } from "../domain/discovery-context.server";
import "../styles/home.css";

const newsletterEmailSchema = z.string().trim().email().max(320);

const LOOKUP_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 10,
  windowMs: 15 * 60 * 1_000,
};

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
  const intent = formData.get("intent");
  if (intent !== "newsletter" && intent !== "returning") {
    return data<NewsletterActionResult>(
      { ok: false, message: "The subscription request is incomplete." },
      { status: 400, headers: responseHeaders },
    );
  }
  // A returning subscriber agreed when they first subscribed.
  if (intent === "newsletter" && formData.get("newsletterConsent") !== "yes") {
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

  const unlocked = async (message: string) => {
    const headers = new Headers(responseHeaders);
    headers.set(
      "Set-Cookie",
      await issueDiagnosticAccessCookie(accessConfiguration),
    );
    return data<NewsletterActionResult>({ ok: true, message }, { headers });
  };

  if (intent === "returning") {
    // Limits how fast one visitor can test addresses against the list.
    if (
      !(
        await consumeSharedRateLimit(
          visitorKey("subscriber-lookup", request),
          LOOKUP_POLICY,
        )
      ).allowed
    ) {
      return data<NewsletterActionResult>(
        { ok: false, message: "Too many attempts. Try again in 15 minutes." },
        { status: 429, headers: responseHeaders },
      );
    }
    try {
      if (await isActiveBeehiivSubscriber(email.data, configuration)) {
        return await unlocked(
          "Welcome back. The reference diagnostic is unlocked.",
        );
      }
      return data<NewsletterActionResult>(
        {
          ok: false,
          message:
            "We could not find an active subscription for that address. Subscribe below to unlock the diagnostic.",
        },
        { status: 404, headers: responseHeaders },
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "landing_beehiiv_lookup_error",
          message: error instanceof Error ? error.message : "unknown error",
        }),
      );
      return data<NewsletterActionResult>(
        {
          ok: false,
          message: "We could not check your subscription. Please try again.",
        },
        { status: 502, headers: responseHeaders },
      );
    }
  }

  try {
    // Someone already on the list is let straight in: no second sign-up and
    // no second welcome email. If the check fails, subscribing still works.
    const alreadySubscribed = await isActiveBeehiivSubscriber(
      email.data,
      configuration,
    ).catch(() => false);
    if (alreadySubscribed) {
      return await unlocked(
        "You are already subscribed. The reference diagnostic is unlocked.",
      );
    }
    await subscribeToBeehiiv(email.data, configuration);
    return await unlocked(
      "Subscribed. The reference diagnostic is now unlocked.",
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
          <a className="landing-action" href="/watches/find">
            <span className="landing-action__kicker">Film · TV · People</span>
            <strong>Find the watch from the screen</strong>
            <span className="landing-action__description">
              Search any movie, series, actor, character or celebrity and see
              the watches they wore, and where.
            </span>
            <span className="landing-action__footer">Search now →</span>
          </a>
          <a className="landing-action" href="/watches/archetype">
            <span className="landing-action__kicker">
              Four questions · No sign-up
            </span>
            <strong>Find your watch archetype</strong>
            <span className="landing-action__description">
              Four quick questions reveal the kind of collector you are, with
              ten watches that suit you at your price.
            </span>
            <span className="landing-action__footer">Take the quiz →</span>
          </a>
          <a
            className={`landing-action landing-action--diagnostic${
              diagnosticAccess ? " landing-action--unlocked" : ""
            }`}
            href={diagnosticAccess ? diagnosticHref : "#newsletter-signup"}
            onClick={(event) => {
              if (diagnosticAccess) return;
              // Locked: take the visitor straight to the email field.
              event.preventDefault();
              const input = document.getElementById("newsletter-email");
              input?.focus({ preventScroll: true });
              if (typeof input?.scrollIntoView === "function") {
                input.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          >
            <span className="landing-action__kicker">
              {diagnosticAccess
                ? "Subscriber access · Unlocked"
                : "Subscriber access"}
            </span>
            <strong>Start the reference diagnostic</strong>
            <span className="landing-action__description">
              Six quick answers (price range, wrist, where you wear it), then
              watches confirmed on their makers&apos; own pages.
            </span>
            <span className="landing-action__footer">
              {diagnosticAccess
                ? "Begin the diagnostic →"
                : "Subscribe below to unlock ↓"}
            </span>
          </a>
        </nav>
        <p className="landing-secondary">
          Or browse the{" "}
          <a href="/watches">reviewed archive of film and TV watches</a>.
        </p>
        <BeehiivSignup onSubscribed={unlockDiagnostic} />
      </main>

      <footer className="site-footer">
        <span>thereserve.watch</span>
        <span>Archival Documentary</span>
      </footer>
    </div>
  );
}
