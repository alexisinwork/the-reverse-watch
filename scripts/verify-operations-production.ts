// Credentials and admin cookies stay in memory; report only boolean evidence.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { adminLogin } from "../app/domain/admin-auth.server";
import { loadFunnelSummary } from "../app/domain/funnel-store.server";
import { loadDiscoveryFunnelSummary } from "../app/domain/discovery-funnel-store.server";

const base = "https://thereserve.watch";
const token = process.env.OPERATIONS_TOKEN;
assert.ok(token && token.length >= 32);
const privatePath = `${base}/internal/operations/health`;
const anonymous = await fetch(privatePath);
assert.equal(anonymous.status, 401);
const origin = await fetch(privatePath, {
  headers: { Authorization: `Bearer ${token}`, Origin: base },
});
assert.equal(origin.status, 401);
const authorized = await fetch(privatePath, {
  headers: { Authorization: `Bearer ${token}` },
});
assert.equal(authorized.status, 200);
assert.equal(authorized.headers.get("cache-control"), "no-store");
const readiness: unknown = await authorized.json();
assert.ok(!JSON.stringify(readiness).includes(token));
const since = new Date(Date.now() - 86400000).toISOString();
const until = new Date().toISOString();
const funnel = await loadFunnelSummary(since, until);
const discovery = await loadDiscoveryFunnelSummary(since, until);
assert.ok(funnel && discovery);
const denied: Record<string, number> = {};
for (const name of ["quiz_funnel_summary_v1", "discovery_funnel_summary_v1"]) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_since: since, p_until: until }),
    },
  );
  assert.ok(
    response.status === 401 ||
      response.status === 403 ||
      response.status === 404,
  );
  denied[name] = response.status;
}
const cookie = await adminLogin(process.env.ADMIN_PASSWORD ?? "");
assert.ok(cookie);
const admin = await fetch(`${base}/admin/analytics`, {
  headers: { cookie: cookie.split(";")[0]! },
  redirect: "manual",
  signal: AbortSignal.timeout(25000),
});
assert.equal(admin.status, 200);
const html = await admin.text();
assert.ok(
  html.includes("Country") &&
    html.includes("Did people like their results?") &&
    html.includes("Yes, liked") &&
    html.includes("No, not a fit"),
);
const report = {
  at: new Date().toISOString(),
  anonymousPrivateHealth: anonymous.status,
  browserOriginRejected: origin.status,
  authorizedPrivateHealth: authorized.status,
  readiness,
  serviceAggregateReads: true,
  publicAggregateReadsDenied: denied,
  adminAnalytics: admin.status,
  countryAndFeedbackVisible: true,
};
await writeFile(
  "docs/reports/operations-production.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report));
