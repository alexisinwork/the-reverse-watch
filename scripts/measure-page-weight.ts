// Measures how much JavaScript a visitor downloads before a page can react:
// every script and module preload in the page's HTML, as sent over the
// network (compressed) and as the browser runs it (uncompressed). Scripts
// that load later on their own (Sentry once the page is idle, Vercel's
// analytics script) are not in the page's HTML and do not count towards the
// budget. Writes docs/reports/page-weight-<label>.json.
//
//   node --import tsx scripts/measure-page-weight.ts --label after-sentry
//   node --import tsx scripts/measure-page-weight.ts --base http://localhost:3000 --label local
//
// Budget (docs/ENGINEERING_STANDARDS.md, "Page weight"): 150 KB of
// compressed JavaScript for the first load of each public page measured.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BUDGET_BYTES = 150 * 1024;
const PAGES = ["/", "/watches/archetype", "/quiz", "/watches/find"];

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const base = argument("--base") ?? "https://thereserve.watch";
const label = argument("--label") ?? "check";
if (!/^[a-z0-9-]+$/.test(label)) {
  throw new Error("--label takes lower-case letters, digits and dashes.");
}

/** Compressed bytes on the wire and uncompressed bytes the browser runs. */
async function weigh(url: string) {
  const response = await fetch(url, {
    headers: { "accept-encoding": "br, gzip" },
  });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}.`);
  }
  const body = new Uint8Array(await response.arrayBuffer());
  const encoding = response.headers.get("content-encoding");
  const length = Number(response.headers.get("content-length") ?? "");
  // fetch decompresses the body; content-length is the size on the wire
  // when the server sends one, otherwise compress locally to estimate it.
  const wire =
    encoding && Number.isFinite(length) && length > 0
      ? length
      : await compressedSize(body);
  return { url, wire, raw: body.byteLength, encoding: encoding ?? "none" };
}

async function compressedSize(body: Uint8Array) {
  const { brotliCompressSync } = await import("node:zlib");
  return brotliCompressSync(body).byteLength;
}

function scriptsIn(html: string, pageUrl: string) {
  const found = new Set<string>();
  for (const match of html.matchAll(
    /<script\b[^>]*\bsrc="([^"]+)"[^>]*>|<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"[^>]*>/g,
  )) {
    const source = match[1] ?? match[2];
    if (source) found.add(new URL(source, pageUrl).href);
  }
  // React Router also imports the entry and route modules from an inline
  // script; their paths appear as quoted asset URLs.
  for (const match of html.matchAll(/["'](\/assets\/[^"']+\.js)["']/g)) {
    found.add(new URL(match[1]!, pageUrl).href);
  }
  return [...found];
}

const pages = [];
for (const path of PAGES) {
  const pageUrl = new URL(path, base).href;
  const response = await fetch(pageUrl);
  const html = await response.text();
  const scripts = await Promise.all(scriptsIn(html, pageUrl).map(weigh));
  const firstLoad = scripts.filter(
    (script) => !script.url.includes("/_vercel/"),
  );
  const wire = firstLoad.reduce((sum, script) => sum + script.wire, 0);
  const raw = firstLoad.reduce((sum, script) => sum + script.raw, 0);
  pages.push({
    path,
    status: response.status,
    scripts: firstLoad.length,
    wireKB: Math.round(wire / 102.4) / 10,
    rawKB: Math.round(raw / 102.4) / 10,
    largest: [...firstLoad]
      .sort((a, b) => b.wire - a.wire)
      .slice(0, 3)
      .map((script) => ({
        file: new URL(script.url).pathname,
        wireKB: Math.round(script.wire / 102.4) / 10,
      })),
    withinBudget: wire <= BUDGET_BYTES,
  });
}

const report = {
  at: new Date().toISOString(),
  base,
  label,
  budgetKB: BUDGET_BYTES / 1024,
  pages,
  result: pages.every((page) => page.status === 200 && page.withinBudget)
    ? "PASS"
    : "FAIL",
};
const output = resolve(`docs/reports/page-weight-${label}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${output}`);
if (report.result !== "PASS") process.exit(1);
