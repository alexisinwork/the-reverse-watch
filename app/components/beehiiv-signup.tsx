import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

export type NewsletterActionResult =
  { ok: true; message: string } | { ok: false; message: string };

export function BeehiivSignup({ onSubscribed }: { onSubscribed?: () => void }) {
  const fetcher = useFetcher<NewsletterActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (!fetcher.data?.ok) return;
    formRef.current?.reset();
    onSubscribed?.();
  }, [fetcher.data, onSubscribed]);

  return (
    <section
      className="signup"
      id="newsletter-signup"
      aria-labelledby="signup-heading"
    >
      <span className="signup-kicker">Independent watch intelligence</span>
      <h2 id="signup-heading">Enter the archive</h2>
      <p className="signup-description">
        Receive new investigations and field notes from The Reserve, and unlock
        the full reference diagnostic.
      </p>
      <fetcher.Form className="signup-form" method="post" ref={formRef}>
        <input name="intent" type="hidden" value="newsletter" />
        <div className="signup-fields">
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            autoComplete="email"
            id="newsletter-email"
            inputMode="email"
            maxLength={320}
            name="email"
            placeholder="Email address"
            required
            type="email"
          />
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Subscribing…" : "Subscribe"}
          </button>
        </div>
        <label className="signup-consent">
          <input
            name="newsletterConsent"
            required
            type="checkbox"
            value="yes"
          />
          <span>
            I agree to receive The Reserve by email and can unsubscribe at any
            time.
          </span>
        </label>
      </fetcher.Form>
      {fetcher.data ? (
        <p
          className={fetcher.data.ok ? "signup-status" : "signup-error"}
          role={fetcher.data.ok ? "status" : "alert"}
        >
          {fetcher.data.message}
        </p>
      ) : null}
    </section>
  );
}
