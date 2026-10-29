// One clearly tagged synthetic page view with guarded cleanup of its own ID.
// Never sends mail, records votes or removes real visitor/partner history.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
const fixtureFile = ".scratch/interaction-delivery-probe.json";
const base = process.argv.includes("--local")
  ? "http://localhost:5173"
  : "https://thereserve.watch";
await mkdir(".scratch", { recursive: true });
let fixture: { eventId: string; sessionId: string };
try {
  fixture = z
    .object({ eventId: z.uuid(), sessionId: z.uuid() })
    .parse(JSON.parse(await readFile(fixtureFile, "utf8")) as unknown);
} catch {
  fixture = { eventId: randomUUID(), sessionId: randomUUID() };
  await writeFile(fixtureFile, JSON.stringify(fixture), { flag: "wx" });
}
const body = JSON.stringify({
  ...fixture,
  name: "page_view",
  feature: "site",
  page: "/health",
  control: "Internal delivery verification",
  source: "internal-verification",
  campaign: "analytics-delivery-check",
});
const statuses: number[] = [];
const rejected = await fetch(`${base}/analytics/interactions`, {
  method: "POST",
  headers: {
    Origin: "https://unregistered.example",
    "Content-Type": "application/json",
  },
  body,
  signal: AbortSignal.timeout(15000),
});
assert.equal(rejected.status, 403);
for (let i = 0; i < 2; i++) {
  const response = await fetch(`${base}/analytics/interactions`, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  statuses.push(response.status);
  assert.equal(response.status, 204);
}
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  connect_timeout: 10,
});
try {
  const [row] = await sql<
    { n: number; tagged: boolean }[]
  >`select count(*)::int n,bool_and(traffic_source='internal-verification' and campaign='analytics-delivery-check' and event_name='page_view' and helpful is null) tagged from public.partner_interaction_events where event_id=${fixture.eventId}::uuid`;
  assert.equal(row!.n, 1);
  assert.equal(row!.tagged, true);
  // Explicitly owned synthetic fixture only; all guards must match.
  const cleaned = await sql`delete from public.partner_interaction_events
    where event_id=${fixture.eventId}::uuid and session_id=${fixture.sessionId}::uuid
      and traffic_source='internal-verification' and campaign='analytics-delivery-check'
      and event_name='page_view' and page_path='/health' and helpful is null returning id`;
  assert.equal(cleaned.length, 1);
  const report = {
    at: new Date().toISOString(),
    statuses,
    unregisteredOrigin: rejected.status,
    storedEvents: row!.n,
    taggedSyntheticPageView: row!.tagged,
    feedbackVotesAdded: 0,
    duplicateCounted: false,
    syntheticFixtureRemoved: true,
  };
  await writeFile(
    process.argv.includes("--local")
      ? ".scratch/interaction-delivery-local.json"
      : "docs/reports/interaction-delivery-production.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
