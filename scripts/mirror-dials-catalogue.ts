// Mirror public full specifications into a local, resumable JSONL archive.
// Sitemap identities are only the index; each stored row is fetched from the
// public full-spec endpoint. No prices or image files are copied separately.
import { appendFileSync, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
const dir = "data/watch-archive/dials",
  out = `${dir}/models.jsonl`,
  errors = `${dir}/errors.jsonl`;
await mkdir(dir, { recursive: true });
const requestedLimit = process.argv.indexOf("--limit"),
  limit =
    requestedLimit < 0 ? Infinity : Number(process.argv[requestedLimit + 1]);
if (!(limit > 0)) throw new Error("--limit must be positive");
const sitemapSchema = z.object({
  data: z.array(
    z.object({
      brandSlug: z.string(),
      seriesSlug: z.string(),
      slug: z.string(),
      updatedAt: z.string(),
    }),
  ),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
const safeSlug = /^[a-z0-9-]+$/;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let nextStart = Date.now(),
  completed = 0,
  failed = 0;
async function request(url: string) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const slot = nextStart;
    nextStart = Math.max(Date.now(), nextStart) + 125;
    await wait(Math.max(0, slot - Date.now()));
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (response.status === 429) {
        const retry = Number(response.headers.get("retry-after"));
        const reset = Number(response.headers.get("ratelimit-reset"));
        await wait((retry || reset || 5) * 1000);
        continue;
      }
      if (response.status >= 500) {
        await wait(Math.min(30000, 1000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return (await response.json()) as unknown;
    } catch (error) {
      if (attempt === 6) throw error;
      await wait(Math.min(30000, 500 * 2 ** attempt));
    }
  }
  throw new Error("Retry limit reached");
}
const first = sitemapSchema.parse(
  await request("https://api.dials.co/v1/sitemap/models?page=1&pageSize=10000"),
);
const mapFile = `${dir}/sitemap.json`;
const sitemap = first.data;
for (let page = 2; page <= first.totalPages; page++) {
  const result = sitemapSchema.parse(
    await request(
      `https://api.dials.co/v1/sitemap/models?page=${page}&pageSize=10000`,
    ),
  );
  sitemap.push(...result.data);
}
const snapshot = createHash("sha256")
  .update(JSON.stringify(sitemap))
  .digest("hex");
await writeFile(
  mapFile,
  JSON.stringify(
    {
      source: "https://docs.dials.co/api/reference/sitemap",
      retrievedAt: new Date().toISOString(),
      snapshot,
      total: first.total,
      records: sitemap,
    },
    null,
    2,
  ),
);
const done = new Set<string>();
if (existsSync(out))
  for (const line of (await readFile(out, "utf8")).split("\n")) {
    if (!line) continue;
    try {
      const row = JSON.parse(line) as { id?: string };
      if (row.id) done.add(row.id);
    } catch {}
  }
const modelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    referenceNumber: z.string().nullable().optional(),
    slug: z.string(),
    updatedAt: z.string().optional(),
    brand: z.object({ name: z.string(), slug: z.string() }),
    series: z
      .object({ name: z.string(), slug: z.string() })
      .nullable()
      .optional(),
  })
  .passthrough();
const queue = sitemap
  .filter(
    (x) =>
      safeSlug.test(x.brandSlug) &&
      safeSlug.test(x.seriesSlug) &&
      safeSlug.test(x.slug) &&
      !done.has(`${x.brandSlug}/${x.slug}`),
  )
  .slice(0, limit);
console.log(
  JSON.stringify({
    snapshot,
    totalSitemap: sitemap.length,
    alreadyMirrored: done.size,
    queued: queue.length,
    rateLimitPerMinute: 480,
  }),
);
for (let n = 0; n < queue.length; n += 8) {
  const batch = queue.slice(n, n + 8);
  await Promise.all(
    batch.map(async (item) => {
      const apiUrl = `https://api.dials.co/v1/models/${item.brandSlug}/${item.slug}`;
      try {
        const model = modelSchema.parse(await request(apiUrl));
        if (model.brand.slug !== item.brandSlug || model.slug !== item.slug)
          throw new Error("identity_mismatch");
        const row = {
          id: `${item.brandSlug}/${item.slug}`,
          source: "Dials",
          sourceUrl: `https://dials.co/watches/${item.brandSlug}/${item.seriesSlug}/${item.slug}`,
          apiUrl,
          licenseAndTerms: "https://docs.dials.co/api/terms",
          checkedAt: new Date().toISOString(),
          snapshot,
          sitemapUpdatedAt: item.updatedAt,
          model,
        };
        appendFileSync(out, `${JSON.stringify(row)}\n`);
        completed++;
      } catch (error) {
        failed++;
        appendFileSync(
          errors,
          `${JSON.stringify({ at: new Date().toISOString(), id: `${item.brandSlug}/${item.slug}`, url: apiUrl, error: error instanceof Error ? error.message : "unknown" })}\n`,
        );
      }
    }),
  );
  if (completed > 0 && completed % 1000 < 8)
    console.log(
      JSON.stringify({
        completed: done.size + completed,
        failed,
        remaining: queue.length - n - batch.length,
      }),
    );
}
console.log(
  JSON.stringify({
    finishedAt: new Date().toISOString(),
    newRecords: completed,
    failed,
    alreadyMirrored: done.size,
    totalRecords: done.size + completed,
    snapshot,
  }),
);
