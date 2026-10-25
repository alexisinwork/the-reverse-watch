import { data, Form, Link, useLoaderData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-analytics";
import { adminLogin, adminLogout, isAdmin } from "../domain/admin-auth.server";
import { catalogueClient, rpc } from "../domain/watch-catalogue.server";
import { listPartnerSites } from "../domain/partner-sites.server";
import { PARTNER_FEATURE_LABELS } from "../domain/partner-sites";
import "../styles/admin.css";
const noIndex = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};
const summarySchema = z.object({
  totals: z.object({
    events: z.number(),
    sessions: z.number(),
    pageViews: z.number(),
    clicks: z.number(),
    completions: z.number(),
    liked: z.number(),
    disliked: z.number(),
  }),
  byFeature: z.array(
    z.object({
      feature: z.string(),
      events: z.number(),
      sessions: z.number(),
      completions: z.number(),
      liked: z.number(),
      disliked: z.number(),
    }),
  ),
  bySite: z.array(
    z.object({ site: z.string(), events: z.number(), sessions: z.number() }),
  ),
  bySource: z.array(z.object({ source: z.string(), sessions: z.number() })),
  byCampaign: z.array(
    z.object({
      campaign: z.string(),
      source: z.string(),
      sessions: z.number(),
    }),
  ),
  byControl: z.array(
    z.object({ control: z.string(), feature: z.string(), clicks: z.number() }),
  ),
  journeys: z.array(
    z.object({
      session: z.string(),
      site: z.string(),
      started: z.string(),
      lastSeen: z.string(),
      eventCount: z.number(),
      events: z.array(
        z.object({
          at: z.string(),
          name: z.string(),
          feature: z.string(),
          page: z.string(),
          control: z.string().nullable(),
          target: z.string().nullable(),
          helpful: z.boolean().nullable(),
        }),
      ),
    }),
  ),
});
export async function loader({ request }: Route.LoaderArgs) {
  if (!(await isAdmin(request)))
    return data({ authed: false as const }, { headers: noIndex });
  const client = catalogueClient();
  if (!client)
    return data(
      {
        authed: true as const,
        summary: null,
        sites: [],
        error: "Database is not configured.",
      },
      { headers: noIndex },
    );
  const url = new URL(request.url),
    days = [7, 30, 90].includes(Number(url.searchParams.get("days")))
      ? Number(url.searchParams.get("days"))
      : 30,
    site = url.searchParams.get("site"),
    siteId = z.string().uuid().safeParse(site).success ? site : null,
    until = new Date(),
    since = new Date(until.getTime() - days * 86400000);
  const [raw, sites] = await Promise.all([
    rpc(
      client,
      "partner_interaction_analytics_v1",
      {
        p_since: since.toISOString(),
        p_until: until.toISOString(),
        p_site_id: siteId,
      },
      15000,
    ),
    listPartnerSites(client),
  ]);
  return data(
    {
      authed: true as const,
      summary: summarySchema.parse(raw),
      sites,
      days,
      siteId,
      error: null,
    },
    { headers: noIndex },
  );
}
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData(),
    intentValue = form.get("intent"),
    passwordValue = form.get("password"),
    intent = typeof intentValue === "string" ? intentValue : "",
    password = typeof passwordValue === "string" ? passwordValue : "";
  if (intent === "login") {
    const cookie = await adminLogin(password);
    return cookie
      ? data({ ok: true }, { headers: { ...noIndex, "Set-Cookie": cookie } })
      : data(
          { error: "Password did not match." },
          { status: 401, headers: noIndex },
        );
  }
  if (intent === "logout") {
    const cookie = await adminLogout();
    return data(
      { ok: true },
      { headers: cookie ? { ...noIndex, "Set-Cookie": cookie } : noIndex },
    );
  }
  return data({ error: "Unknown action." }, { status: 400, headers: noIndex });
}
function Login() {
  const navigation = useNavigation();
  return (
    <main className="admin-shell admin-shell--narrow">
      <h1>Analytics</h1>
      <Form className="admin-login" method="post">
        <input type="hidden" name="intent" value="login" />
        <label>
          <span>Admin password</span>
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
        >
          Sign in
        </button>
      </Form>
    </main>
  );
}
export function meta() {
  return [
    { title: "Usage analytics · The Reserve" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
export default function AdminAnalytics() {
  const result = useLoaderData<typeof loader>();
  if (!result.authed) return <Login />;
  const summary = result.summary;
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Link to="/">The Reserve</Link>
          <h1>Usage analytics</h1>
          <nav aria-label="Admin navigation">
            <Link to="/admin/catalogue">Catalogue</Link>
            <Link to="/admin/sites">Partner sites</Link>
            <Link to="/admin/evaluation">Quiz evaluation</Link>
          </nav>
        </div>
        <Form method="post">
          <button className="button button--quiet" name="intent" value="logout">
            Sign out
          </button>
        </Form>
      </header>
      <p className="admin-note">
        Anonymous page and button journeys for one browser tab session. No
        names, emails, quiz answer values, IPs, or full URLs are stored. A
        reload starts a new anonymous session.
      </p>
      {result.error ? <p className="warn">{result.error}</p> : null}
      {summary ? (
        <>
          <Form className="admin-edit__grid" method="get">
            <label>
              <span>Period</span>
              <select name="days" defaultValue={result.days}>
                {[7, 30, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Website</span>
              <select name="site" defaultValue={result.siteId ?? "all"}>
                <option value="all">All websites</option>
                {result.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.active ? "" : " (off)"}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button--primary">Apply</button>
          </Form>
          <section className="admin-summary" aria-label="Analytics totals">
            {[
              ["Sessions", summary.totals.sessions],
              ["Page views", summary.totals.pageViews],
              ["Button clicks", summary.totals.clicks],
              ["Services completed", summary.totals.completions],
              ["Liked results", summary.totals.liked],
              ["Disliked results", summary.totals.disliked],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <section className="admin-analytics-grid">
            <article className="admin-panel">
              <h2>By service</h2>
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Sessions</th>
                    <th>Completed</th>
                    <th>Liked / No</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byFeature.map((x) => (
                    <tr key={x.feature}>
                      <td>
                        {PARTNER_FEATURE_LABELS[
                          x.feature as keyof typeof PARTNER_FEATURE_LABELS
                        ] ?? x.feature}
                      </td>
                      <td>{x.sessions}</td>
                      <td>{x.completions}</td>
                      <td>
                        {x.liked} / {x.disliked}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
            <article className="admin-panel">
              <h2>By website</h2>
              <table>
                <thead>
                  <tr>
                    <th>Website</th>
                    <th>Sessions</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySite.map((x) => (
                    <tr key={x.site}>
                      <td>{x.site}</td>
                      <td>{x.sessions}</td>
                      <td>{x.events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
            <article className="admin-panel">
              <h2>Traffic sources</h2>
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySource.map((x) => (
                    <tr key={x.source}>
                      <td>{x.source}</td>
                      <td>{x.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
            <article className="admin-panel">
              <h2>Campaigns</h2>
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Source</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCampaign.map((x, i) => (
                    <tr key={`${x.campaign}-${x.source}-${i}`}>
                      <td>{x.campaign}</td>
                      <td>{x.source}</td>
                      <td>{x.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
            <article className="admin-panel">
              <h2>Most clicked</h2>
              <table>
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Service</th>
                    <th>Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byControl.map((x, i) => (
                    <tr key={`${x.control}-${x.feature}-${i}`}>
                      <td>{x.control}</td>
                      <td>{x.feature}</td>
                      <td>{x.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </section>
          <section className="admin-panel">
            <h2>Recent anonymous journeys</h2>
            {summary.journeys.length ? (
              <div className="admin-journeys">
                {summary.journeys.map((j) => (
                  <details key={j.session}>
                    <summary>
                      <code>…{j.session.slice(-8)}</code> · {j.site} ·{" "}
                      {j.eventCount} actions ·{" "}
                      {new Date(j.lastSeen).toLocaleString()}
                    </summary>
                    <ol>
                      {j.events.map((e, i) => (
                        <li key={`${e.at}-${i}`}>
                          <time>{new Date(e.at).toLocaleTimeString()}</time> ·{" "}
                          {e.name} · {e.feature} · {e.control ?? e.page}
                          {e.target ? ` → ${e.target}` : ""}
                          {e.helpful === null
                            ? ""
                            : e.helpful
                              ? " · liked"
                              : " · did not like"}
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            ) : (
              <p>No recorded activity in this period.</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
