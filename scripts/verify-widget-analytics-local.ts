/** Real production-bundle frames on the registered local partner origin.
 * Only the blank host HTML is a fixture; no tool, analytics or DB response is mocked.
 * Never submits a search, records a feedback vote or retains synthetic events. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { chromium, expect } from "@playwright/test";
import postgres from "postgres";
import { z } from "zod";
import { catalogueClient } from "../app/domain/watch-catalogue.server";
import { listPartnerSites } from "../app/domain/partner-sites.server";
import { validationBudgetStatus } from "../app/domain/validation-budget.server";

const client = catalogueClient();
assert.ok(client, "Local catalogue configuration required");
const partner = (await listPartnerSites(client)).find(
  (site) => site.name === "Portfolio local integration",
);
assert.ok(partner?.active);
assert.ok(partner.allowedOrigins.includes("http://127.0.0.1:8080"));
const before = await validationBudgetStatus(client);
const production = process.argv.includes("--production");
const base = production ? "https://thereserve.watch" : "http://localhost:4173";
const host = "http://127.0.0.1:8080/";
const campaign = "widget-session-check";
const source = "internal-verification";
const features = ["quiz", "archetype", "find", "alternatives", "stories"];
// The portfolio dev server uses localhost/IPv6. Its separately registered IPv4
// origin hosts this disposable page without changing the portfolio's source.
const hostServer = createServer((_request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html><head><meta charset="utf-8"><title>Local analytics check</title></head><body>
    <div data-reserve="all" data-params="utm_source=${source}&amp;utm_campaign=${campaign}"></div>
    <script src="${base}/embed.js" data-key="${partner.publicKey}"></script></body></html>`);
});
await new Promise<void>((resolve, reject) => {
  hostServer.once("error", reject);
  hostServer.listen(8080, "127.0.0.1", resolve);
});
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  connect_timeout: 10,
});
// Optional process-local routing for a diagnosed local Vercel edge issue.
// This never changes DNS settings, Host/SNI or TLS certificate verification.
const probeAddress = process.env.RESERVE_PROBE_ADDRESS;
if (probeAddress)
  assert.ok(isIP(probeAddress), "Expected diagnostic IP address");
const browser = await chromium.launch({
  args:
    production && probeAddress
      ? [`--host-resolver-rules=MAP thereserve.watch ${probeAddress}`]
      : [],
});
let session: string | undefined;
type Event = {
  event_id: string;
  event_name: string;
  feature: string;
  control: string | null;
  helpful: boolean | null;
};
async function ownEvents(): Promise<Event[]> {
  assert.ok(session);
  return sql<Event[]>`select event_id,event_name,feature,control,helpful
    from public.partner_interaction_events
    where session_id=${session}::uuid and partner_site_id=${partner!.id}::uuid
      and campaign=${campaign} and traffic_source=${source}`;
}
let checks: Record<string, unknown> | undefined;
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) =>
    console.error(
      "Widget browser error:",
      error.message.replace(/pk_live_[A-Za-z0-9]{24}/g, "[public-key]"),
    ),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error(
        "Widget console error:",
        message.text().replace(/pk_live_[A-Za-z0-9]{24}/g, "[public-key]"),
      );
  });
  const navigation = await page.goto(host);
  assert.equal(navigation?.status(), 200);
  assert.equal(await page.title(), "Local analytics check");
  const advisor = page.locator('[data-reserve="all"]');
  const buttons = advisor.locator(".reserve-advisor__tools button");
  await expect(buttons).toHaveCount(5);
  for (let i = 0; i < features.length; i++) {
    if (i) await buttons.nth(i).click();
    await expect(advisor.getByRole("status")).toHaveText(
      "Watch advisor ready.",
      { timeout: 45000 },
    );
    const iframe = advisor.locator(`[data-reserve="${features[i]}"] iframe`);
    const src = await iframe.getAttribute("src");
    assert.ok(src);
    const shared = z
      .uuid()
      .parse(new URL(src).searchParams.get("_reserve_session"));
    session ??= shared;
    assert.equal(
      shared,
      session,
      "All frames must share the parent-page nonce",
    );
    await expect(
      advisor
        .frameLocator(`[data-reserve="${features[i]}"] iframe`)
        .getByText("Powered by The Reserve", { exact: true }),
    ).toBeVisible();
  }
  // Returning to the existing frame must preserve the same journey.
  await buttons.first().click();
  await expect
    .poll(
      async () => {
        const rows = await ownEvents();
        const views = new Set(
          rows
            .filter((row) => row.event_name === "page_view")
            .map((row) => row.feature),
        );
        const clicks = new Set(
          rows
            .filter((row) => row.control === "advisor_tab")
            .map((row) => row.feature),
        );
        return { views: views.size, clicks: clicks.size };
      },
      { timeout: 20000, intervals: [300, 700, 1500] },
    )
    .toEqual({ views: 5, clicks: 5 });
  const rows = await ownEvents();
  assert.ok(rows.length >= 10 && rows.length <= 30);
  assert.ok(rows.every((row) => row.helpful === null));
  assert.equal(new Set(rows.map((row) => row.event_id)).size, rows.length);
  const after = await validationBudgetStatus(client);
  assert.equal(after.spentUsd, before.spentUsd);
  assert.equal(after.reservedUsd, before.reservedUsd);
  assert.equal(after.attempts, before.attempts);
  checks = {
    at: new Date().toISOString(),
    runtime: production
      ? "Chromium, real production Reserve frames; fixture host HTML only"
      : "Chromium, real built Reserve frames; fixture host HTML only",
    sourceOrigin: "http://127.0.0.1:8080",
    reserveOrigin: base,
    features: 5,
    sharedAnonymousSessions: 1,
    featuresWithPageViews: 5,
    featuresWithAdvisorTabClicks: 5,
    duplicateEventIds: 0,
    feedbackVotesAdded: 0,
    paidAttemptsAdded: 0,
    paidCostAddedUsd: 0,
    syntheticEvents: rows.length,
  };
} finally {
  await browser.close();
  hostServer.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    hostServer.close((error) => (error ? reject(error) : resolve())),
  );
  if (session) {
    const owned = await ownEvents();
    assert.ok(
      owned.length <= 30,
      "Unexpected fixture count: retain for inspection",
    );
    for (const event of owned) {
      assert.ok(event.event_id && event.helpful === null);
      // Own exact event IDs only, with session/site/markers and no feedback votes.
      const removed: { id: number }[] = await sql<
        { id: number }[]
      >`delete from public.partner_interaction_events
        where event_id=${event.event_id}::uuid and session_id=${session}::uuid
          and partner_site_id=${partner.id}::uuid and campaign=${campaign}
          and traffic_source=${source} and helpful is null
          and event_name in ('page_view','click') returning id`;
      assert.equal(removed.length, 1);
    }
    assert.equal((await ownEvents()).length, 0);
  }
  await sql.end();
}
assert.ok(checks);
const report = { ...checks, syntheticFixtureRemoved: true };
await writeFile(
  production
    ? "docs/reports/widget-analytics-production.json"
    : "docs/reports/widget-analytics-local.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report));
