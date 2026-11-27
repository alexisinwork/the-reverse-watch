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
  byCountry: z.array(
    z.object({ country: z.string().length(2), sessions: z.number() }),
  ),
  byControl: z.array(
    z.object({ control: z.string(), feature: z.string(), clicks: z.number() }),
  ),
  journeys: z.array(
    z.object({
      session: z.string(),
      site: z.string(),
      country: z.string().nullable(),
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
/** Each tab session once, under how its visit began (migration 0126). */
const attributionSchema = z.object({
  rows: z.array(
    z.object({
      source: z.string(),
      medium: z.string().nullable(),
      campaign: z.string().nullable(),
      sessions: z.number(),
      quizStarts: z.number(),
      quizCompletions: z.number(),
      toolCompletions: z.number(),
      subscriptions: z.number(),
    }),
  ),
  byLanding: z.array(
    z.object({
      landing: z.string(),
      sessions: z.number(),
      subscriptions: z.number(),
    }),
  ),
});
export type AttributionRow = z.infer<typeof attributionSchema>["rows"][number];
type Counts = Omit<AttributionRow, "source" | "medium" | "campaign">;
const COUNT_KEYS = [
  "sessions",
  "quizStarts",
  "quizCompletions",
  "toolCompletions",
  "subscriptions",
] as const satisfies readonly (keyof Counts)[];

/** Part of a whole as "12.5%"; a dash when the whole is zero. */
export function share(part: number, whole: number) {
  if (!whole) return "–";
  const percent = (part / whole) * 100;
  return `${percent >= 10 || percent === 0 ? Math.round(percent) : percent.toFixed(1)}%`;
}

function summed(rows: AttributionRow[]): Counts {
  const counts = {} as Counts;
  for (const key of COUNT_KEYS)
    counts[key] = rows.reduce((total, row) => total + row[key], 0);
  return counts;
}

/**
 * The rows the owner reads: platforms and campaigns by sessions, then
 * "direct" on its own line (an address typed by hand, for example after
 * the ad read in an episode), present even when it has no sessions yet.
 */
export function attributionTable(rows: AttributionRow[]) {
  const others = rows.filter((row) => row.source !== "direct");
  const direct: AttributionRow = {
    source: "direct",
    medium: null,
    campaign: null,
    ...summed(rows.filter((row) => row.source === "direct")),
  };
  return { others, direct, totals: summed([...others, direct]) };
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!(await isAdmin(request)))
    return data({ authed: false as const }, { headers: noIndex });
  const client = catalogueClient();
  if (!client)
    return data(
      {
        authed: true as const,
        summary: null,
        attribution: null,
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
  const period = {
    p_since: since.toISOString(),
    p_until: until.toISOString(),
    p_site_id: siteId,
  };
  const [raw, rawAttribution, sites] = await Promise.all([
    rpc(client, "partner_interaction_analytics_v1", period, 15000),
    rpc(client, "partner_interaction_attribution_v1", period, 15000),
    listPartnerSites(client),
  ]);
  return data(
    {
      authed: true as const,
      summary: summarySchema.parse(raw),
      attribution: attributionSchema.parse(rawAttribution),
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
function CountCells({ counts }: { counts: Counts }) {
  return (
    <>
      <td>{counts.sessions}</td>
      <td>{counts.quizStarts}</td>
      <td>{counts.quizCompletions}</td>
      <td>{counts.toolCompletions}</td>
      <td>{counts.subscriptions}</td>
      <td>{share(counts.subscriptions, counts.sessions)}</td>
    </>
  );
}

/** Where visitors and subscribers come from: source, then campaign. */
export function Attribution({
  rows,
  byLanding,
}: z.infer<typeof attributionSchema>) {
  const table = attributionTable(rows);
  return (
    <section className="admin-panel" aria-labelledby="attribution-heading">
      <h2 id="attribution-heading">Where visitors and subscribers come from</h2>
      <p>
        Each tab session counts once, under how its visit began: a short
        link&apos;s tags (<code>/e/1</code> is youtube, video, ep1;{" "}
        <code>/ys/1</code> youtube, shorts, ep1; <code>/yt</code>,{" "}
        <code>/ig</code> and <code>/tt</code> their platform, social, bio),
        otherwise the referring site (Instagram, TikTok and YouTube by platform,
        other sites by name). A quiz start or a sign-up later in the same tab
        stays with that source. Quiz means the diagnostic and the archetype
        quiz; any tool also counts film search and cheaper alternatives.
        Sessions from before 27 November 2026 count under their first
        page&apos;s own source and have no medium.
      </p>
      <div>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Medium</th>
              <th>Campaign</th>
              <th>Sessions</th>
              <th>Quiz started</th>
              <th>Quiz finished</th>
              <th>Any tool finished</th>
              <th>Subscribed</th>
              <th>Subscribed / sessions</th>
            </tr>
          </thead>
          <tbody>
            {table.others.map((row) => (
              <tr
                key={`${row.source}|${row.medium ?? ""}|${row.campaign ?? ""}`}
              >
                <td>{row.source}</td>
                <td>{row.medium ?? "–"}</td>
                <td>{row.campaign ?? "–"}</td>
                <CountCells counts={row} />
              </tr>
            ))}
            {!table.others.length ? (
              <tr>
                <td colSpan={9}>No visits from a platform or website yet.</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">direct</th>
              <td colSpan={2}>
                Typed address or no referrer, e.g. after an episode&apos;s ad
              </td>
              <CountCells counts={table.direct} />
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3} scope="row">
                All sessions
              </th>
              <CountCells counts={table.totals} />
            </tr>
          </tfoot>
        </table>
      </div>
      {byLanding.length ? (
        <>
          <h3>Entry pages</h3>
          <table>
            <thead>
              <tr>
                <th>First page of the visit</th>
                <th>Sessions</th>
                <th>Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {byLanding.map((row) => (
                <tr key={row.landing}>
                  <td>
                    <code>{row.landing}</code>
                  </td>
                  <td>{row.sessions}</td>
                  <td>{row.subscriptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
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
        Anonymous page and button journeys for one browser tab session. A
        session lasts until the tab is closed (reloads and plain links stay in
        it) and keeps how its visit began. The hosting country code is included
        when available. No names, emails, quiz answer values, IPs, precise
        locations, or full URLs are stored.
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
          {result.attribution ? (
            <Attribution
              rows={result.attribution.rows}
              byLanding={result.attribution.byLanding}
            />
          ) : null}
          <section className="admin-analytics-grid">
            <article className="admin-panel">
              <h2>By service</h2>
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Sessions</th>
                    <th>Completed</th>
                    <th>Yes · liked</th>
                    <th>No · not a fit</th>
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
                      <td>{x.liked}</td>
                      <td>{x.disliked}</td>
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
              <h2>Countries</h2>
              <table>
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCountry.map((x) => (
                    <tr key={x.country}>
                      <td>
                        {new Intl.DisplayNames(["en"], { type: "region" }).of(
                          x.country,
                        ) ?? x.country}
                        <span className="admin-note"> ({x.country})</span>
                      </td>
                      <td>{x.sessions}</td>
                    </tr>
                  ))}
                  {!summary.byCountry.length ? (
                    <tr>
                      <td colSpan={2}>No country data for this period.</td>
                    </tr>
                  ) : null}
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
            <h2>Did people like their results?</h2>
            <p>
              “Yes” and “No” answer “Did we find watches you like?” on the
              results screen. Counts are grouped by service and respect the
              filters above.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Yes, liked</th>
                  <th>No, not a fit</th>
                  <th>Feedback received</th>
                </tr>
              </thead>
              <tbody>
                {summary.byFeature.map((x) => {
                  const total = x.liked + x.disliked;
                  return (
                    <tr key={`feedback-${x.feature}`}>
                      <td>
                        {PARTNER_FEATURE_LABELS[
                          x.feature as keyof typeof PARTNER_FEATURE_LABELS
                        ] ?? x.feature}
                      </td>
                      <td>{x.liked}</td>
                      <td>{x.disliked}</td>
                      <td>
                        {total
                          ? `${Math.round((x.liked / total) * 100)}% yes (${total} responses)`
                          : "No responses yet"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <section className="admin-panel">
            <h2>Recent anonymous journeys</h2>
            {summary.journeys.length ? (
              <div className="admin-journeys">
                {summary.journeys.map((j) => (
                  <details key={j.session}>
                    <summary>
                      <code>…{j.session.slice(-8)}</code> · {j.site}
                      {j.country ? ` · ${j.country}` : ""} · {j.eventCount}{" "}
                      actions · {new Date(j.lastSeen).toLocaleString()}
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
