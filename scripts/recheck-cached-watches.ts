// Incremental checks of identities used in saved answers. Never replaces an
// answer or infers film attribution from a watch specification database.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { z } from "zod";
import {
  checkDialsReference,
  compareCatalogueFacts,
} from "../app/domain/catalogue-corroboration.server";
import { catalogueWatchSchema } from "../app/domain/watch-catalogue";
const at = process.argv.indexOf("--limit"),
  limit = at >= 0 ? Number(process.argv[at + 1]) : 25;
if (!Number.isInteger(limit) || limit < 1 || limit > 5000)
  throw new Error("Invalid limit");
if (!process.env.DIRECT_DATABASE_URL)
  throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(process.env.DIRECT_DATABASE_URL, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
const dir = "data/watch-archive/cache-corroboration";
await mkdir(dir, { recursive: true });
try {
  const watches = await sql<
    { id: string; brand: string; reference_code: string; data: unknown }[]
  >`select w.id,w.brand,w.reference_code,private.watch_catalogue_json(w) as data from private.watch_catalogue w
    where w.reference_code is not null and w.review_status<>'rejected' and exists(select 1 from private.ai_watches a join private.ai_watch_search_results r on r.watch_id=a.id
      where lower(regexp_replace(a.brand,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(w.brand,'[^a-zA-Z0-9]','','g')) and lower(regexp_replace(a.reference_code,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(w.reference_code,'[^a-zA-Z0-9]','','g')))
    order by w.brand,w.reference_code`;
  const totals: Record<string, number> = {};
  let processed = 0,
    retained = 0;
  for (const watch of watches) {
    const file = `${dir}/${watch.id}.json`;
    if (existsSync(file)) {
      const previous = z
        .object({ status: z.string() })
        .parse(JSON.parse(await readFile(file, "utf8")));
      totals[previous.status] = (totals[previous.status] ?? 0) + 1;
      continue;
    }
    if (processed >= limit) continue;
    const result = await checkDialsReference({
      brand: watch.brand,
      referenceCode: watch.reference_code,
    }).catch(() => ({ status: "unavailable" as const }));
    const comparison =
      result.status === "matched"
        ? compareCatalogueFacts(
            catalogueWatchSchema.parse(watch.data),
            result.facts,
          )
        : null;
    const status = comparison?.status ?? result.status;
    const entry = {
      watchId: watch.id,
      brand: watch.brand,
      reference: watch.reference_code,
      status,
      checkedAt: new Date().toISOString(),
      comparison,
      source: result,
      cacheAction: "retained_unchanged",
      scope:
        "Reference specifications only; no certification of film/person attribution, ranking, image rights or current retail price.",
    };
    await writeFile(file, JSON.stringify(entry, null, 2));
    processed++;
    retained++;
    totals[status] = (totals[status] ?? 0) + 1;
    console.log(
      JSON.stringify({
        reference: `${watch.brand} ${watch.reference_code}`,
        status,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const report = {
    at: new Date().toISOString(),
    cachedIdentitiesInMaster: watches.length,
    processedThisRun: processed,
    retainedUnchangedThisRun: retained,
    totals,
    policy:
      "No cache writes or purge. Agreement is partial corroboration only. Conflicts/missing evidence stay in review reports; no automatic good-to-go stamp.",
  };
  await writeFile(
    "docs/reports/cache-corroboration.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
