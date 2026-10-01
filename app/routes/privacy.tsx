/**
 * The privacy policy (owner-approved, 2026-10-01). Keep it true to the
 * code: if what the site collects or who processes it changes, change this
 * page in the same commit.
 */
import { Link } from "react-router";

import "../styles/legal.css";

export const PRIVACY_UPDATED = "1 October 2026";
export const PRIVACY_CONTACT = "alex@thereserve.watch";

export function meta() {
  return [
    { title: "Privacy policy · The Reserve" },
    {
      name: "description",
      content:
        "What The Reserve collects, why, who processes it, and how to have it deleted.",
    },
  ];
}

export default function Privacy() {
  return (
    <main className="legal-page" id="main-content">
      <nav className="legal-nav" aria-label="Site">
        <Link to="/">The Reserve</Link>
      </nav>
      <article>
        <span className="eyebrow">Last updated {PRIVACY_UPDATED}</span>
        <h1>Privacy policy</h1>
        <p>
          The Reserve (thereserve.watch) helps you find watches. We collect as
          little as we can. This page explains what we collect, why, who handles
          it for us, and how to have it removed. Questions:{" "}
          <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
        </p>

        <h2>What we collect and why</h2>
        <ul>
          <li>
            <strong>Your email address, if you subscribe.</strong> Used to send
            The Reserve&apos;s newsletter and to unlock the reference
            diagnostic. It is held by our newsletter provider until you
            unsubscribe. Every newsletter has an unsubscribe link. If you use
            &ldquo;Already subscribed?&rdquo;, we only check your address
            against the subscriber list; we do not store it again.
          </li>
          <li>
            <strong>
              Your email address, if you ask for your shortlist by email.
            </strong>{" "}
            Used once, to send that email through our email provider, which
            keeps a delivery record for a limited time. We do not keep your
            address ourselves: to stop accidental double sends, we hold a
            one-way fingerprint (hash) of it for 15 minutes.
          </li>
          <li>
            <strong>Your quiz answers and searches.</strong> Price range, wrist
            size, where you wear a watch, the film or person you search for, and
            similar. Used to find watches. We store the answers and the results
            (never who asked), so the next person asking the same thing gets an
            instant answer. They are not linked to your email, name or device.
          </li>
          <li>
            <strong>Anonymous usage counts.</strong> For example how many people
            start the quiz. No cookies, no personal data, and no tracking across
            other websites.
          </li>
          <li>
            <strong>Error reports.</strong> If a page breaks, a technical report
            (which page, what went wrong) is sent to our error monitor, without
            personal data.
          </li>
          <li>
            <strong>Your network address, briefly.</strong> To stop abuse (too
            many searches or sign-in attempts), we keep a one-way fingerprint of
            it for at most a few minutes. The address itself is never stored.
          </li>
        </ul>

        <h2>Cookies and storage on your device</h2>
        <ul>
          <li>
            <strong>Diagnostic access cookie</strong>: a signed cookie that
            remembers you unlocked the diagnostic, for up to 180 days. It
            contains no personal data.
          </li>
          <li>
            <strong>Quiz progress</strong>: your unfinished answers are kept in
            your browser for this visit only, so a refresh does not lose them.
          </li>
          <li>No advertising or cross-site tracking cookies are used.</li>
        </ul>

        <h2>Who processes data for us</h2>
        <p>
          We use these kinds of service providers, each only for the purpose
          described:
        </p>
        <ul>
          <li>
            a newsletter platform (subscriber list and newsletter emails);
          </li>
          <li>an email delivery service (the shortlist email);</li>
          <li>website hosting and a database host;</li>
          <li>a rate-limiting service (abuse protection);</li>
          <li>an error-monitoring service;</li>
          <li>
            web search and AI service providers, which receive only search
            constraints (for example a price range or a film title), never your
            email, name, cookies or network address.
          </li>
        </ul>
        <p>
          Some of these providers are based outside the UK and EU. Where they
          are, they process data under standard contractual safeguards.
        </p>

        <h2>Legal basis</h2>
        <p>
          Newsletter and shortlist emails: your consent, which you can withdraw
          at any time. Quiz and search processing: providing the service you
          asked for. Abuse protection and error reports: our legitimate interest
          in keeping the site safe and working.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask to see, correct or delete personal data we hold about you,
          or object to how we use it. Email{" "}
          <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a> and we
          will reply within 30 days. To stop newsletter emails, use the
          unsubscribe link in any of them. You can also complain to your data
          protection authority.
        </p>

        <h2>Children</h2>
        <p>The Reserve is not intended for anyone under 16.</p>

        <h2>Changes</h2>
        <p>
          If this policy changes, we will update this page and the date at the
          top.
        </p>
      </article>
    </main>
  );
}
