/**
 * /admin/sites — partner websites (owner only, same sign-in as
 * /admin/catalogue): create a site and its keys, list the website
 * addresses allowed to show the widgets, set an optional monthly limit and
 * a theme, switch a site off, and read each site's uses for invoicing.
 * Sites are never deleted.
 */
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/admin-sites";
import { adminLogin, adminLogout, isAdmin } from "../domain/admin-auth.server";
import { pageAddress } from "../domain/page-address";
import {
  parseOriginList,
  PARTNER_FEATURE_LABELS,
  PARTNER_FEATURES,
  PARTNER_FONTS,
  readTheme,
  type PartnerTheme,
} from "../domain/partner-sites";
import {
  issueSecretKey,
  listPartnerSites,
  savePartnerSite,
  type PartnerSiteInput,
  type PartnerSiteWithUsage,
} from "../domain/partner-sites.server";
import type { RateLimitPolicy } from "../domain/rate-limit.server";
import { consumeSharedRateLimit } from "../domain/rate-limit-upstash.server";
import { visitorKey } from "../domain/visitor-key.server";
import { catalogueClient } from "../domain/watch-catalogue.server";
import "../styles/admin.css";

const LOGIN_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 10,
  windowMs: 15 * 60 * 1_000,
};

const NO_INDEX = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

export function headers() {
  return NO_INDEX;
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "Partner sites · The Reserve" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

function siteOrigin(request: Request) {
  return process.env.APP_URL?.trim() || new URL(request.url).origin;
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!(await isAdmin(request))) {
    return data({ authed: false as const }, { headers: NO_INDEX });
  }
  const client = catalogueClient();
  if (!client) {
    return data(
      {
        authed: true as const,
        error: "The database is not configured.",
        sites: [] as PartnerSiteWithUsage[],
        origin: siteOrigin(request),
      },
      { headers: NO_INDEX },
    );
  }
  return data(
    {
      authed: true as const,
      error: null,
      sites: await listPartnerSites(client),
      origin: siteOrigin(request),
    },
    { headers: NO_INDEX },
  );
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readSite(formData: FormData): PartnerSiteInput | string {
  const name = field(formData, "name").slice(0, 120);
  if (!name) return "Give the site a name.";
  const { origins, invalid } = parseOriginList(field(formData, "origins"));
  if (invalid.length > 0) {
    return `Not a website address (https://…): ${invalid.join(", ")}`;
  }
  const quotaText = field(formData, "monthlyQuota");
  const monthlyQuota = quotaText === "" ? null : Number(quotaText);
  if (
    monthlyQuota !== null &&
    (!Number.isSafeInteger(monthlyQuota) || monthlyQuota < 1)
  ) {
    return "The monthly limit must be a whole number, or empty for no limit.";
  }
  const theme: PartnerTheme = readTheme({
    scheme: field(formData, "scheme"),
    accent: field(formData, "accent"),
    background: field(formData, "background"),
    surface: field(formData, "surface"),
    text: field(formData, "text"),
    font: field(formData, "font"),
    radius: field(formData, "radius"),
  });
  const id = field(formData, "id");
  return {
    ...(id ? { id } : {}),
    name,
    allowedOrigins: origins,
    active: id ? formData.get("active") === "yes" : true,
    monthlyQuota,
    theme,
    notes: field(formData, "notes").slice(0, 500) || null,
  };
}

type ActionResult =
  { error: string } | { ok: true; secret?: { siteName: string; key: string } };

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = field(formData, "intent");

  if (intent === "login") {
    if (
      !(
        await consumeSharedRateLimit(
          visitorKey("admin-login", request),
          LOGIN_POLICY,
        )
      ).allowed
    ) {
      return data<ActionResult>(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429, headers: NO_INDEX },
      );
    }
    const cookie = await adminLogin(field(formData, "password"));
    if (!cookie) {
      return data<ActionResult>(
        { error: "Wrong password." },
        { status: 401, headers: NO_INDEX },
      );
    }
    return redirect(pageAddress(request.url), {
      headers: { "Set-Cookie": cookie },
    });
  }
  if (!(await isAdmin(request))) {
    return data<ActionResult>(
      { error: "Sign in first." },
      { status: 401, headers: NO_INDEX },
    );
  }
  if (intent === "logout") {
    const cookie = await adminLogout();
    return redirect(
      "/admin/sites",
      cookie ? { headers: { "Set-Cookie": cookie } } : undefined,
    );
  }

  const client = catalogueClient();
  if (!client) {
    return data<ActionResult>(
      { error: "The database is not configured." },
      { status: 503, headers: NO_INDEX },
    );
  }
  if (intent === "save") {
    const input = readSite(formData);
    if (typeof input === "string") {
      return data<ActionResult>(
        { error: input },
        { status: 400, headers: NO_INDEX },
      );
    }
    const saved = await savePartnerSite(client, input);
    if (!saved) {
      return data<ActionResult>(
        { error: "That site no longer exists." },
        { status: 404, headers: NO_INDEX },
      );
    }
    return data<ActionResult>({ ok: true }, { headers: NO_INDEX });
  }
  if (intent === "secret") {
    const id = field(formData, "id");
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      return data<ActionResult>(
        { error: "Unknown site." },
        { status: 400, headers: NO_INDEX },
      );
    }
    const key = await issueSecretKey(client, id);
    return key
      ? data<ActionResult>(
          {
            ok: true,
            secret: { siteName: field(formData, "name"), key },
          },
          { headers: NO_INDEX },
        )
      : data<ActionResult>(
          { error: "Unknown site." },
          { status: 404, headers: NO_INDEX },
        );
  }
  return data<ActionResult>(
    { error: "Unknown action." },
    { status: 400, headers: NO_INDEX },
  );
}

function Login() {
  const navigation = useNavigation();
  const result = useActionData<typeof action>();
  return (
    <main className="admin-shell admin-shell--narrow">
      <h1>Partner sites</h1>
      {result && "error" in result ? (
        <p className="warn" role="alert">
          {result.error}
        </p>
      ) : null}
      <Form className="admin-login" method="post">
        <input name="intent" type="hidden" value="login" />
        <label>
          <span>Password</span>
          <input
            autoComplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
        <button
          className="button button--primary"
          disabled={navigation.state !== "idle"}
          type="submit"
        >
          Sign in
        </button>
      </Form>
    </main>
  );
}

function SiteFields({ site }: { site?: PartnerSiteWithUsage }) {
  const theme = site?.theme ?? {};
  return (
    <>
      {site ? <input name="id" type="hidden" value={site.id} /> : null}
      <div className="admin-edit__grid">
        <label>
          <span>Name (partner or shop)</span>
          <input defaultValue={site?.name ?? ""} name="name" required />
        </label>
        <label>
          <span>Monthly limit (uses; empty = no limit)</span>
          <input
            defaultValue={site?.monthlyQuota ?? ""}
            inputMode="numeric"
            name="monthlyQuota"
          />
        </label>
      </div>
      <label>
        <span>
          Website addresses allowed to show the widgets (one per line, e.g.
          https://shop.example.com)
        </span>
        <textarea
          defaultValue={site?.allowedOrigins.join("\n") ?? ""}
          name="origins"
          rows={3}
        />
      </label>
      <fieldset className="admin-edit__styles">
        <legend>
          Theme (optional; the partner can also set it on the tag)
        </legend>
        <div className="admin-edit__grid">
          <label>
            <span>Look</span>
            <select defaultValue={theme.scheme ?? ""} name="scheme">
              <option value="">Dark (The Reserve)</option>
              <option value="light">Light</option>
            </select>
          </label>
          <label>
            <span>Accent colour (#hex)</span>
            <input defaultValue={theme.accent ?? ""} name="accent" />
          </label>
          <label>
            <span>Background (#hex)</span>
            <input defaultValue={theme.background ?? ""} name="background" />
          </label>
          <label>
            <span>Cards (#hex)</span>
            <input defaultValue={theme.surface ?? ""} name="surface" />
          </label>
          <label>
            <span>Text (#hex)</span>
            <input defaultValue={theme.text ?? ""} name="text" />
          </label>
          <label>
            <span>Font</span>
            <select defaultValue={theme.font ?? ""} name="font">
              <option value="">The Reserve&apos;s</option>
              {PARTNER_FONTS.filter((font) => font !== "default").map(
                (font) => (
                  <option key={font} value={font}>
                    {font === "system" ? "The visitor's system font" : "Serif"}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            <span>Corner rounding (px, 0–32)</span>
            <input
              defaultValue={theme.radius ?? ""}
              inputMode="numeric"
              name="radius"
            />
          </label>
        </div>
      </fieldset>
      <label>
        <span>Notes (plan, price, contact person — for you only)</span>
        <input defaultValue={site?.notes ?? ""} name="notes" />
      </label>
      {site ? (
        <label className="admin-edit__check">
          <input
            defaultChecked={site.active}
            name="active"
            type="checkbox"
            value="yes"
          />
          <span>Active (untick to switch the site off)</span>
        </label>
      ) : null}
    </>
  );
}

function usageTable(site: PartnerSiteWithUsage) {
  const months = [...new Set(site.usage.map((row) => row.month))].sort((a, b) =>
    b.localeCompare(a),
  );
  return months.map((month) => {
    const rows = site.usage.filter((row) => row.month === month);
    const total = rows.reduce((sum, row) => sum + row.uses, 0);
    return {
      month: month.slice(0, 7),
      total,
      byFeature: PARTNER_FEATURES.map((feature) => ({
        feature,
        uses: rows.find((row) => row.feature === feature)?.uses ?? 0,
      })).filter((entry) => entry.uses > 0),
    };
  });
}

function SiteCard({
  site,
  origin,
}: {
  site: PartnerSiteWithUsage;
  origin: string;
}) {
  const usage = usageTable(site);
  const snippet = `<div data-reserve="all" data-key="${site.publicKey}"></div>\n<script src="${origin}/embed.js" async></script>`;
  return (
    <article
      className={`admin-row partner-card ${site.active ? "admin-row--approved" : "partner-card--inactive"}`}
    >
      <div className="admin-row__body">
        <h2>{site.name}</h2>
        <p className="admin-row__meta">
          <span className={site.active ? "ok" : "warn"}>
            {site.active ? "active" : "switched off"}
          </span>
          <span>
            {site.monthlyQuota === null
              ? "no monthly limit"
              : `limit ${site.monthlyQuota.toLocaleString("en")} uses / month`}
          </span>
          <span>{site.hasSecret ? "secret key issued" : "no secret key"}</span>
        </p>
        <p className="admin-row__facts">
          Public key: <code>{site.publicKey}</code>
        </p>
        <p className="admin-row__facts">
          Websites:{" "}
          {site.allowedOrigins.length > 0 ? (
            site.allowedOrigins.join(", ")
          ) : (
            <span className="warn">none yet — the widgets won&apos;t show</span>
          )}
        </p>
        {usage.length > 0 ? (
          usage.map((month) => (
            <p className="admin-row__facts" key={month.month}>
              <strong>{month.month}</strong>: {month.total} uses (
              {month.byFeature
                .map(
                  (entry) =>
                    `${PARTNER_FEATURE_LABELS[entry.feature]} ${entry.uses}`,
                )
                .join(", ")}
              )
            </p>
          ))
        ) : (
          <p className="admin-row__facts">No uses this month or last.</p>
        )}
        {site.notes ? <p className="admin-row__why">{site.notes}</p> : null}
        <details className="admin-edit">
          <summary>Code to send the partner</summary>
          <h3>All five tools · any website</h3>
          <p className="admin-note">
            Use the full advisor with tabs, or replace <code>all</code> with a
            single feature. Each tab keeps its own answers and results.
          </p>
          <textarea
            aria-label={`All tools embed for ${site.name}`}
            readOnly
            rows={3}
            value={snippet}
          />
          <h3>WordPress</h3>
          <p className="admin-note">
            Install the plugin, save this public key in Settings → The Reserve,
            and add a Shortcode block:
          </p>
          <textarea
            aria-label={`WordPress shortcode for ${site.name}`}
            readOnly
            rows={1}
            value={'[the_reserve feature="all"]'}
          />
          <p className="admin-note">
            <a href={`${origin}/downloads/the-reserve-wordpress.zip`}>
              Download the WordPress plugin
            </a>{" "}
            · <a href={`${origin}/partners#wordpress`}>WordPress steps</a>
          </p>
          <h3>Shopify and website builders</h3>
          <p className="admin-note">
            Paste the all-tools embed above into Shopify Custom Liquid, a
            Squarespace Code block, Webflow Code Embed or Framer Embed. Wix
            needs enough embed height and its exact frame origin registered.{" "}
            <a href={`${origin}/partners#builders`}>
              Builder installation steps
            </a>{" "}
            ·{" "}
            <a href={`${origin}/downloads/the-reserve-shopify-section.liquid`}>
              Shopify theme section
            </a>
          </p>
          <p className="admin-note">
            Native demo:{" "}
            <a href={`${origin}/downloads/the-reserve-native-demo.zip`}>
              download HTML, CSS and JavaScript
            </a>
            . For a Vite website, use this public configuration and restart its
            development server after changing it. Register each local website
            address with its port in the site settings.
          </p>
          <textarea
            readOnly
            rows={2}
            aria-label={`Vite configuration for ${site.name}`}
            value={`VITE_RESERVE_ORIGIN=${origin}\nVITE_RESERVE_PUBLIC_KEY=${site.publicKey}`}
          />
          <p className="admin-note">
            Paste where the widget should appear. data-reserve can be all, quiz,
            archetype, find, alternatives or stories. Full guide:{" "}
            <a href={`${origin}/partners`} rel="noreferrer" target="_blank">
              {origin}/partners
            </a>
            .
          </p>
          <textarea
            aria-label={`Embed code for ${site.name}`}
            readOnly
            rows={3}
            value={snippet}
          />
        </details>
        <details className="admin-edit">
          <summary>Edit</summary>
          <Form method="post">
            <input name="intent" type="hidden" value="save" />
            <SiteFields site={site} />
            <button className="button button--primary" type="submit">
              Save
            </button>
          </Form>
        </details>
        <details className="admin-edit">
          <summary>Server API access</summary>
          <p className="admin-note">
            A secret key is only needed for server-to-server API calls. Website
            widgets use the public key above.
          </p>
          <Form className="admin-actions" method="post">
            <input name="intent" type="hidden" value="secret" />
            <input name="id" type="hidden" value={site.id} />
            <input name="name" type="hidden" value={site.name} />
            <button className="button button--quiet" type="submit">
              {site.hasSecret
                ? "Replace secret key (the old one stops working)"
                : "Create secret key (for the partner's server)"}
            </button>
          </Form>
        </details>
      </div>
    </article>
  );
}

export default function AdminSites() {
  const loaderData = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  if (!loaderData.authed) return <Login />;
  const { sites, error, origin } = loaderData;
  const activeSites = sites.filter((site) => site.active);
  const inactiveSites = sites.filter((site) => !site.active);
  return (
    <main className="admin-shell admin-sites">
      <header className="admin-header">
        <div>
          <Link to="/">The Reserve</Link>
          <h1>Partner sites</h1>
          <nav aria-label="Admin navigation">
            <Link to="/admin/catalogue">Catalogue review</Link>
            <Link to="/admin/analytics">Analytics</Link>
            <Link to="/admin/evaluation">Visitor numbers</Link>
            <Link to="/partners">Partner guide</Link>
          </nav>
        </div>
        <Form method="post">
          <button
            className="button button--quiet"
            name="intent"
            type="submit"
            value="logout"
          >
            Sign out
          </button>
        </Form>
      </header>
      {error ? <p className="warn">{error}</p> : null}
      {result && "error" in result ? (
        <p className="warn" role="alert">
          {result.error}
        </p>
      ) : null}
      {result && "secret" in result && result.secret ? (
        <div className="admin-note" role="status">
          <p>
            Secret key for <strong>{result.secret.siteName}</strong>. Copy it
            now: it is not stored and will not be shown again. It is for the
            partner&apos;s server only, never a web page.
          </p>
          <textarea readOnly rows={1} value={result.secret.key} />
        </div>
      ) : null}
      <p className="admin-note">
        Every feature is included for every site. Widgets never show the
        newsletter sign-up or ask for an email address. Uses are counted per
        month for invoicing; a monthly limit is optional.
      </p>
      <details className="admin-edit partner-create" open={sites.length === 0}>
        <summary>Add a partner site</summary>
        <ol className="admin-note">
          <li>
            Agree monthly usage and collect every exact published/staging
            website origin.
          </li>
          <li>
            Fill in the site, limit and optional colours below; create its
            public key.
          </li>
          <li>
            Open “Code to send the partner” on its card and send the matching
            platform steps. Never share your admin password.
          </li>
          <li>
            The partner installs and publishes the widget, tests all five tabs
            on desktop/mobile, and sends you the page URL.
          </li>
          <li>
            Confirm counters here and record URL/date/outcome. Secret keys are
            only for a developer's server.
          </li>
        </ol>
        <p className="admin-note">
          <a href={`${origin}/partners`}>Partner's step-by-step guide</a>
        </p>
        <Form method="post">
          <input name="intent" type="hidden" value="save" />
          <SiteFields />
          <button className="button button--primary" type="submit">
            Create site and public key
          </button>
        </Form>
      </details>
      <section className="partner-list" aria-labelledby="active-partners">
        <div className="partner-section-heading">
          <h2 id="active-partners">Active sites</h2>
          <span>
            {activeSites.length} {activeSites.length === 1 ? "site" : "sites"}
          </span>
        </div>
        {activeSites.length === 0 ? (
          <p className="admin-note">
            No active partner sites. Add a site above to get started.
          </p>
        ) : null}
        {activeSites.map((site) => (
          <SiteCard key={site.id} origin={origin} site={site} />
        ))}
      </section>
      {inactiveSites.length > 0 ? (
        <details className="partner-inactive">
          <summary>
            Switched-off sites <span>{inactiveSites.length}</span>
          </summary>
          <p className="admin-note">
            These sites cannot use widgets or the API. Expand a site's settings
            to reactivate it.
          </p>
          {inactiveSites.map((site) => (
            <SiteCard key={site.id} origin={origin} site={site} />
          ))}
        </details>
      ) : null}
    </main>
  );
}
