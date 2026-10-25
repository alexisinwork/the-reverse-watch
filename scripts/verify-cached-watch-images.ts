// Check cached result image URLs by response headers only. Never save image
// bytes, and never remove an image for a temporary/network-blocked response.
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { publicFetch, safeHttpUrl } from "../app/domain/source-pages.server";

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");
const write = process.argv.includes("--write");
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
type ImageRow = { image_url: string; rows: number };
const urls = await sql<ImageRow[]>`
  select image_url,count(*)::int as rows from private.ai_watches
  where image_url is not null group by image_url order by image_url`;
const results: {
  host: string;
  outcome: "valid" | "missing" | "unavailable" | "not_image" | "invalid_url";
  rows: number;
}[] = [];
const outcomeByUrl = new Map<string, string>();
let cursor = 0;
async function check(row: ImageRow) {
  const safe = safeHttpUrl(row.image_url);
  if (!safe) {
    outcomeByUrl.set(row.image_url, "invalid_url");
    results.push({ host: "invalid", outcome: "invalid_url", rows: row.rows });
    return;
  }
  const host = new URL(safe).hostname.toLowerCase();
  let response: Response | null = null;
  try {
    const head = await publicFetch(
      safe,
      {
        method: "HEAD",
        headers: { "user-agent": "TheReserve-cache-image-check/1.0" },
        signal: AbortSignal.timeout(8000),
      },
      fetch,
    );
    response = head?.response ?? null;
    if (response?.status === 405 || response?.status === 501) {
      await response.body?.cancel();
      const get = await publicFetch(
        safe,
        {
          method: "GET",
          headers: {
            range: "bytes=0-0",
            "user-agent": "TheReserve-cache-image-check/1.0",
          },
          signal: AbortSignal.timeout(8000),
        },
        fetch,
      );
      response = get?.response ?? null;
    }
    if (!response) {
      outcomeByUrl.set(row.image_url, "unavailable");
      results.push({ host, outcome: "unavailable", rows: row.rows });
      return;
    }
    const type = response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    const outcome =
      response.status === 404 || response.status === 410
        ? "missing"
        : response.ok && type && !type.startsWith("image/")
          ? "not_image"
          : response.ok && type?.startsWith("image/")
            ? "valid"
            : "unavailable";
    await response.body?.cancel();
    outcomeByUrl.set(row.image_url, outcome);
    results.push({ host, outcome, rows: row.rows });
  } catch {
    await response?.body?.cancel().catch(() => undefined);
    outcomeByUrl.set(row.image_url, "unavailable");
    results.push({ host, outcome: "unavailable", rows: row.rows });
  }
}
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= urls.length) return;
    await check(urls[index]!);
  }
}
try {
  await Promise.all(Array.from({ length: 6 }, () => worker()));
  const definiteMissing = urls.filter((row) =>
    ["missing", "not_image"].includes(outcomeByUrl.get(row.image_url) ?? ""),
  );
  let clearedRows = 0;
  if (write) {
    for (const row of definiteMissing) {
      const result =
        await sql`update private.ai_watches set image_url=null where image_url=${row.image_url}`;
      clearedRows += Number(result.count);
    }
  }
  const totals = Object.fromEntries(
    ["valid", "missing", "not_image", "unavailable", "invalid_url"].map(
      (outcome) => [
        outcome,
        results.filter((row) => row.outcome === outcome).length,
      ],
    ),
  );
  const byHost: Record<
    string,
    { urls: number; rows: number; outcomes: Record<string, number> }
  > = {};
  for (const result of results) {
    const host = (byHost[result.host] ??= { urls: 0, rows: 0, outcomes: {} });
    host.urls++;
    host.rows += result.rows;
    host.outcomes[result.outcome] = (host.outcomes[result.outcome] ?? 0) + 1;
  }
  const report = {
    at: new Date().toISOString(),
    uniqueCachedImageUrls: urls.length,
    cachedRowsUsingThoseUrls: urls.reduce((sum, row) => sum + row.rows, 0),
    totals,
    mode: write ? "write" : "dry-run",
    definitivelyMissingUrls: definiteMissing.length,
    clearedRows,
    byHost,
    policy:
      "Header-only image checks; no image files or Dials CDN URLs are copied. Only definite 404/410 or non-image responses are cleared. Network blocks and temporary errors stay unchanged.",
  };
  await writeFile(
    "docs/reports/cached-image-check.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
