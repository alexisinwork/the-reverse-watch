/**
 * /partners — how a partner puts The Reserve on their own website: one
 * script tag, the WordPress plugin, Shopify, other site builders, React,
 * and the JSON API. Keys are issued by the owner on /admin/sites.
 */
import { useLoaderData } from "react-router";

import type { Route } from "./+types/partners";
import { SurfaceLink } from "../components/surface";
import {
  PARTNER_FEATURE_LABELS,
  PARTNER_FEATURES,
} from "../domain/partner-sites";
import { PRIVACY_CONTACT } from "./privacy";
import "../styles/legal.css";

export function loader({ request }: Route.LoaderArgs) {
  return {
    origin: process.env.APP_URL?.trim() || new URL(request.url).origin,
  };
}

export function meta() {
  return [
    { title: "Add The Reserve to your website · The Reserve" },
    {
      name: "description",
      content:
        "Put The Reserve's watch finder, archetype quiz, film watch search and cheaper-alternative search on your own website with one line of code.",
    },
  ];
}

const FEATURE_NOTES: Record<(typeof PARTNER_FEATURES)[number], string> = {
  quiz: "Six questions (price, wrist, where it's worn, movement, details, functions), then a shortlist of watches confirmed on their makers' pages.",
  archetype:
    "A four-question watch personality quiz with ten matching watches. Instant, no AI wait.",
  find: "Search any film, series, actor, character or public figure and see the watches they wore, with sources.",
  alternatives:
    "Name a watch and a budget; get watches that look and work like it, new or pre-owned.",
  stories: "Reviewed stories of watches from cinema and public life.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="partner-code">
      <code>{children}</code>
    </pre>
  );
}

export default function Partners() {
  const { origin } = useLoaderData<typeof loader>();
  const tag = `<div data-reserve="quiz"></div>
<script src="${origin}/embed.js" data-key="pk_live_YOUR_KEY" async></script>`;
  return (
    <main className="legal-page partner-page" id="main-content">
      <nav className="legal-nav" aria-label="Site">
        <SurfaceLink to="/">The Reserve</SurfaceLink>
      </nav>
      <article>
        <span className="eyebrow">For partners</span>
        <h1>Add The Reserve to your website</h1>
        <p>
          Give your visitors The Reserve&apos;s watch finder on your own pages:
          your shop, magazine or blog. One line of code, no developer needed,
          and it matches your colours. Every feature is included in your plan.
          Your visitors never have to subscribe or give an email address.
        </p>
        <p>
          To get your key, email{" "}
          <a href={`mailto:${PRIVACY_CONTACT}?subject=Partner%20key`}>
            {PRIVACY_CONTACT}
          </a>{" "}
          with your website&apos;s address. You will receive a public key (
          <code>pk_live_…</code>) for your pages and, if you want the API, a
          secret key (<code>sk_live_…</code>) for your server.
        </p>

        <h2>Get started in 3 steps</h2>
        <ol>
          <li>
            <strong>Ask for your key.</strong> Email{" "}
            <a href={`mailto:${PRIVACY_CONTACT}?subject=Partner%20key`}>
              {PRIVACY_CONTACT}
            </a>{" "}
            with every address your site is reached at (for example{" "}
            <code>https://myshop.com</code> and{" "}
            <code>https://www.myshop.com</code>). The widgets only appear on
            those addresses.
          </li>
          <li>
            <strong>Add the widget.</strong> Paste the two lines below where it
            should appear (or use the WordPress or Shopify steps further down),
            replacing <code>pk_live_YOUR_KEY</code> with your key.
          </li>
          <li>
            <strong>Publish and check.</strong> Open the page on your live site.
            The widget loads within a second or two. If it doesn&apos;t, see
            &ldquo;If the widget doesn&apos;t appear&rdquo; at the bottom.
          </li>
        </ol>

        <h2>What you can add</h2>
        <ul>
          {PARTNER_FEATURES.map((feature) => (
            <li key={feature}>
              <strong>{PARTNER_FEATURE_LABELS[feature]}</strong> (
              <code>{feature}</code>): {FEATURE_NOTES[feature]}
            </li>
          ))}
        </ul>

        <h2>Any website: paste two lines</h2>
        <p>
          Put this where the widget should appear. Change <code>quiz</code> to
          any feature above. The widget grows to fit its content.
        </p>
        <Code>{tag}</Code>
        <p>
          Several widgets on one page need the script only once:{" "}
          <code>&lt;div data-reserve=&quot;find&quot;&gt;&lt;/div&gt;</code>{" "}
          anywhere else on the page is enough.
        </p>

        <h2>WordPress</h2>
        <ol>
          <li>
            Download the plugin:{" "}
            <a href="/downloads/the-reserve-wordpress.zip">
              the-reserve-wordpress.zip
            </a>
            .
          </li>
          <li>
            In WordPress: <em>Plugins → Add New → Upload Plugin</em>, choose the
            file, then <em>Activate</em>.
          </li>
          <li>
            <em>Settings → The Reserve</em>: paste your public key and, if you
            like, your colours.
          </li>
          <li>
            Add the shortcode to any page or post, or use the &ldquo;The
            Reserve&rdquo; block in the editor:
          </li>
        </ol>
        <Code>{`[the_reserve feature="quiz"]
[the_reserve feature="find" scheme="light" accent="#0a7cff"]`}</Code>

        <h2>Shopify</h2>
        <ol>
          <li>
            <em>Online Store → Themes → Customize</em>, open the page you want.
          </li>
          <li>
            <em>Add section → Custom Liquid</em> (or the &ldquo;Custom
            liquid&rdquo; block inside a section).
          </li>
          <li>Paste the two lines above and save.</li>
        </ol>

        <h2>Wix, Squarespace, Webflow and others</h2>
        <ul>
          <li>
            <strong>Wix:</strong> <em>Add → Embed code → Embed HTML</em>, choose
            &ldquo;Code&rdquo;, paste the two lines. Set the box tall enough
            (about 900 px); Wix boxes don&apos;t resize themselves.
          </li>
          <li>
            <strong>Squarespace:</strong> add a <em>Code</em> block and paste
            the two lines.
          </li>
          <li>
            <strong>Webflow:</strong> add an <em>Embed</em> element and paste
            the two lines.
          </li>
          <li>
            <strong>Google Tag Manager:</strong> a Custom HTML tag with the
            script line, then add{" "}
            <code>&lt;div data-reserve=&quot;quiz&quot;&gt;&lt;/div&gt;</code>{" "}
            to the page.
          </li>
        </ul>

        <h2>Your colours</h2>
        <p>
          Add any of these to the script tag (all widgets) or to one widget:
        </p>
        <Code>{`<div data-reserve="quiz"
     data-scheme="light"       ← "light" or "dark" (default)
     data-accent="#0a7cff"     ← buttons and links
     data-bg="#ffffff"         ← background
     data-surface="#f5f5f7"    ← cards
     data-text="#111111"       ← text
     data-font="system"        ← "system" or "serif"
     data-radius="8"></div>    ← corner rounding, 0–32 px`}</Code>
        <p>
          Start a search for the visitor with <code>data-params</code>, e.g.{" "}
          <code>
            data-reserve=&quot;find&quot;
            data-params=&quot;type=actor&amp;q=Daniel+Craig&quot;
          </code>
          .
        </p>

        <h2>React, Next.js and other apps</h2>
        <p>Load the script once, then render a widget anywhere:</p>
        <Code>{`import { useEffect, useRef } from "react";

export function ReserveWidget({ feature, publicKey, ...theme }) {
  const ref = useRef(null);
  useEffect(() => {
    const show = () => window.TheReserve.mount(ref.current, { feature, key: publicKey });
    if (window.TheReserve) return show();
    const script = document.createElement("script");
    script.src = "${origin}/embed.js";
    script.onload = show;
    document.head.append(script);
  }, [feature, publicKey]);
  const data = Object.fromEntries(
    Object.entries(theme).map(([name, value]) => ["data-" + name, value]),
  );
  return <div ref={ref} {...data} />;
}

<ReserveWidget feature="quiz" publicKey="pk_live_YOUR_KEY" scheme="light" />`}</Code>
        <p>
          Or use the element{" "}
          <code>
            &lt;the-reserve-widget feature=&quot;quiz&quot;
            key=&quot;pk_live_…&quot;&gt;
          </code>{" "}
          once the script is on the page, or call{" "}
          <code>window.TheReserve.scan()</code> after adding a{" "}
          <code>data-reserve</code> element.
        </p>
        <p>
          Widgets announce what happens as browser events on their element:{" "}
          <code>reserve:ready</code>, <code>reserve:results</code> (with the
          number of watches), <code>reserve:navigate</code>,{" "}
          <code>reserve:resize</code>. Use them for your own analytics.
        </p>

        <h2>API: build your own design</h2>
        <p>
          The same searches as JSON. The full description is at{" "}
          <a href="/api/v1/openapi.json">/api/v1/openapi.json</a> (OpenAPI 3.1).
          From your server, use your secret key:
        </p>
        <Code>{`curl "${origin}/api/v1/find?type=actor&q=Daniel%20Craig" \\
  -H "Authorization: Bearer sk_live_YOUR_SECRET_KEY"

curl -X POST "${origin}/api/v1/quiz" \\
  -H "Authorization: Bearer sk_live_YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"version":4,"budgetCurrency":"USD","priceRange":"2000_3000",
       "wristCm":17,"wearingScenarios":["everyday"],
       "minimumWaterResistanceM":50,"movementTypes":["automatic"],
       "requiredComplications":[],"allergyConstraint":"none"}'`}</Code>
        <p>
          From your website&apos;s pages, use the public key; it works only from
          your registered addresses. Add <code>Accept: text/event-stream</code>{" "}
          to see each search step live.
        </p>
        <Code>{`const response = await fetch(
  "${origin}/api/v1/find?type=movie&q=Heat&key=pk_live_YOUR_KEY",
);
const { result } = await response.json();
// result.status: "found" (result.watches), "no_match" or "unavailable"`}</Code>

        <h2>Privacy and labels</h2>
        <ul>
          <li>
            Only search answers are used. The widgets never ask for an email
            address, show no newsletter sign-up and set no cookies. Never send
            names, emails or other personal data to the API.
          </li>
          <li>
            Keep the labels the results carry: &ldquo;Not yet reviewed&rdquo;
            and &ldquo;Manufacturer reference not confirmed&rdquo;. Prices are
            approximate; visitors should check them with the seller.
          </li>
          <li>
            The small &ldquo;Powered by The Reserve&rdquo; line stays on the
            widgets.
          </li>
        </ul>

        <h2>If the widget doesn&apos;t appear</h2>
        <ul>
          <li>
            <strong>Blank space or &ldquo;refused to connect&rdquo;:</strong>{" "}
            the page&apos;s address isn&apos;t registered for your key. Send us
            the exact address shown in your browser (with or without{" "}
            <code>www</code>).
          </li>
          <li>
            <strong>Nothing at all:</strong> check the key is pasted in full (
            <code>pk_live_</code> plus 24 letters and digits) and that the{" "}
            <code>&lt;script&gt;</code> line is on the page. Your browser&apos;s
            console shows a message starting with &ldquo;[The Reserve]&rdquo;
            when something is missing.
          </li>
          <li>
            <strong>Testing on your computer:</strong> ask us to add{" "}
            <code>http://localhost:3000</code> (or your port) to your key.
          </li>
          <li>
            <strong>
              &ldquo;Used all of its searches for this month&rdquo;:
            </strong>{" "}
            your plan&apos;s monthly limit is reached; contact us to raise it.
          </li>
        </ul>

        <h2>Questions</h2>
        <p>
          <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>. Your
          monthly use is counted per feature and appears on your invoice.
        </p>
      </article>
    </main>
  );
}
