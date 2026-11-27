// Partner widgets on production, as a partner's page frames them (owner,
// 2026-11-27: "максимальную уверенность во всех виджетах"). A widget opened
// directly in a tab redirects to The Reserve's own page by design, so this
// asks for each tool as a frame does (Sec-Fetch-Dest: iframe) from a
// registered origin, and checks what a visitor gets: every tool answers,
// only the partner's origins may frame it, no subscription or newsletter
// form, the "Powered by The Reserve" credit, and no link that leaves the
// frame except that credit. It also checks embed.js and embed.css.
//
// This is a server-side check of the pages, not a browser run: it proves
// what the server sends, not how a partner's page renders it.
//
//   node --env-file=.env --import tsx scripts/smoke-widgets.ts [--origin https://thereserve.watch]
//
// Uses the first active partner site whose origins are all https (its
// public key is in its pages anyway) and counts a handful of uses against
// its allowance.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

import { databaseTls } from "./database-tls";

const at = process.argv.indexOf("--origin");
const origin =
  (at > 0 ? process.argv[at + 1] : undefined) ?? "https://thereserve.watch";
const url = process.env.DIRECT_DATABASE_URL?.trim();
if (!url) throw new Error("DIRECT_DATABASE_URL is not set.");

const sql = postgres(url, {
  max: 1,
  ssl: databaseTls(),
  connect_timeout: 15,
  onnotice: () => undefined,
});
let site:
  { name: string; publicKey: string; allowedOrigins: string[] } | undefined;
try {
  const rows = await sql<
    { name: string; public_key: string; allowed_origins: string[] }[]
  >`
    select name, public_key, allowed_origins
    from private.partner_sites
    where active and cardinality(allowed_origins) > 0
      and not exists (select 1 from unnest(allowed_origins) o where o !~ '^https://')
    order by created_at limit 1`;
  if (rows[0])
    site = {
      name: rows[0].name,
      publicKey: rows[0].public_key,
      allowedOrigins: rows[0].allowed_origins,
    };
} finally {
  await sql.end();
}
if (!site) throw new Error("No active partner site to test with.");
const partnerOrigin = site.allowedOrigins[0]!;

type Check = { name: string; result: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const check = (name: string, ok: boolean, detail: string) =>
  checks.push({ name, result: ok ? "PASS" : "FAIL", detail });

const framed = (path: string) =>
  fetch(`${origin}/embed/${site.publicKey}/${path}`, {
    redirect: "manual",
    headers: {
      "Sec-Fetch-Dest": "iframe",
      Referer: `${partnerOrigin}/`,
      "User-Agent": "TheReserveWidgetCheck/1.0 (+https://thereserve.watch)",
    },
    signal: AbortSignal.timeout(30_000),
  });
const leaving = (html: string) =>
  [...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"/gi)]
    .map((match) => match[1]!)
    .filter((href) => {
      try {
        return new URL(href).origin !== new URL(origin).origin;
      } catch {
        return true;
      }
    });

for (const tool of ["quiz", "find", "alternatives", "archetype", "stories"]) {
  const started = Date.now();
  const response = await framed(tool);
  const html = await response.text();
  const csp = response.headers.get("content-security-policy") ?? "";
  const ancestors = /frame-ancestors([^;]*)/.exec(csp)?.[1]?.trim() ?? "";
  check(
    `${tool}: answers in a frame`,
    response.status === 200,
    `HTTP ${response.status} in ${Date.now() - started} ms`,
  );
  check(
    `${tool}: only the partner's origins may frame it`,
    ancestors.length > 0 &&
      site.allowedOrigins.every((allowed) => ancestors.includes(allowed)) &&
      !ancestors.includes("*"),
    `frame-ancestors ${ancestors || "(missing)"}`,
  );
  const credit =
    /<footer class="embed-credit"><a href="([^"]*)"/.exec(html)?.[1] ?? "";
  check(
    `${tool}: the Powered by credit links to the public site`,
    /Powered by The Reserve/.test(html) && credit === new URL(origin).origin,
    credit || "(no credit link)",
  );
  // Only what the visitor gets: the markup without its scripts and preload
  // links, which name code files such as beehiiv-signup-*.js that the
  // widget's route modules share with the site's own pages (2026-11-27).
  const markup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, "");
  const signup = [
    ...markup.matchAll(
      /<input\b[^>]*type="email"|<form\b[^>]*(?:beehiiv|subscribe|newsletter)[^>]*>|beehiiv|newsletter/gi,
    ),
  ].map((match) => match[0].slice(0, 60));
  check(
    `${tool}: asks for no subscription or email`,
    signup.length === 0,
    signup.slice(0, 3).join(" | "),
  );
  const outbound = leaving(html);
  check(
    `${tool}: no link leaves the frame but the credit`,
    outbound.length === 0,
    outbound.slice(0, 3).join(" "),
  );
}

// A finished result inside a widget: the site's own result screens announce
// the paid Exclusive Watch Selection, a partner's widget never does. (One
// archetype result counts one use against the site's allowance.)
const result = await framed(
  "archetype?socialSignal=anti_luxury&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=considered_entry",
);
const resultHtml = await result.text();
check(
  "archetype result in a frame: no Exclusive Watch Selection panel",
  result.status === 200 &&
    /Field Rationalist/.test(resultHtml) &&
    !/exclusive-panel|Exclusive Watch Selection/.test(resultHtml),
  `HTTP ${result.status}`,
);
check(
  "archetype result in a frame: no link leaves the frame but the credit",
  leaving(resultHtml).length === 0,
  leaving(resultHtml).slice(0, 3).join(" "),
);

// Opened in a tab, a widget sends the visitor to The Reserve's own page.
const tab = await fetch(`${origin}/embed/${site.publicKey}/quiz`, {
  redirect: "manual",
  headers: { "Sec-Fetch-Dest": "document" },
});
check(
  "opened in a tab: redirects to the site's own page",
  tab.status >= 300 && tab.status < 400,
  `HTTP ${tab.status} → ${tab.headers.get("location") ?? ""}`,
);

// An unknown key gets nothing.
const unknown = await fetch(`${origin}/embed/pk_live_${"0".repeat(24)}/quiz`, {
  redirect: "manual",
  headers: { "Sec-Fetch-Dest": "iframe" },
});
check("unknown key: refused", unknown.status === 404, `HTTP ${unknown.status}`);

for (const asset of ["embed.js", "embed.css"]) {
  const response = await fetch(`${origin}/${asset}`);
  const body = await response.text();
  check(
    `${asset}: served`,
    response.ok && body.length > 500,
    `HTTP ${response.status}, ${body.length} bytes, cache ${response.headers.get("cache-control") ?? "-"}`,
  );
}
// Sentry's build step appends a debug-id snippet to every served script;
// everything before it must be the committed file.
const withoutSentry = (body: string) =>
  body
    .replace(/\r\n/g, "\n")
    .replace(
      /!function\(\)\{try\{var e="undefined"!=typeof window[\s\S]*_sentryDebugIds[\s\S]*$/,
      "",
    )
    .trim();
for (const asset of ["embed.js", "embed.css"]) {
  const local = readFileSync(`public/${asset}`, "utf8");
  const live = await (await fetch(`${origin}/${asset}`)).text();
  check(
    `${asset}: production serves the committed file`,
    withoutSentry(live) === withoutSentry(local),
    `${live.length} bytes served, ${local.length} committed (Sentry's debug id ignored)`,
  );
}

// The site's own address in what partners copy: the snippets on /partners
// and the API description must name the public https site, never a local
// one. /partners mentions http://localhost:3000 on purpose, as the address a
// partner adds to test on their own machine.
const localAddresses = (body: string) =>
  [...body.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/g)]
    .map((match) => match[0])
    .filter((address) => address !== "http://localhost:3000");
for (const path of ["/partners", "/api/v1/openapi.json"]) {
  const body = await (await fetch(`${origin}${path}`)).text();
  const found = localAddresses(body);
  check(
    `${path}: names no local address`,
    found.length === 0,
    [...new Set(found)].join(" "),
  );
}
const openapi = (await (
  await fetch(`${origin}/api/v1/openapi.json`)
).json()) as { servers?: { url?: string }[] };
check(
  "/api/v1/openapi.json: the server is the public site",
  openapi.servers?.[0]?.url?.startsWith(new URL(origin).origin) === true,
  openapi.servers?.[0]?.url ?? "(no servers)",
);

const report = {
  at: new Date().toISOString(),
  origin,
  site: site.name,
  partnerOrigin,
  passed: checks.filter((item) => item.result === "PASS").length,
  failed: checks.filter((item) => item.result === "FAIL").length,
  checks,
};
const output = resolve(
  `docs/reports/widgets-smoke-${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
for (const item of checks)
  console.log(
    `${item.result} ${item.name}${item.detail ? ` — ${item.detail}` : ""}`,
  );
console.log(`${report.passed} PASS, ${report.failed} FAIL → ${output}`);
process.exit(report.failed ? 1 : 0);
