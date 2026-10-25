// Add only already-verified current catalogue facts to saved results.
// Search membership, ranks, evidence and populated values stay untouched.
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
import { mergeCatalogueFacts } from "../app/domain/catalogue-result-enrichment.server";
import { catalogueClient, rpc } from "../app/domain/watch-catalogue.server";
import { catalogueWatchSchema } from "../app/domain/watch-catalogue";
import type { FoundWatch } from "../app/domain/ai-watch-types";
const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");
const client = catalogueClient();
if (!client) throw new Error("Catalogue read configuration required");
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
const rows = await sql<
  {
    search_id: string;
    rank: number;
    watch_id: string;
    brand: string;
    model: string;
    reference_code: string | null;
    source_url: string;
    image_url: string | null;
    price_note: string | null;
    rationale: string;
    details: unknown;
  }[]
>`
  select r.search_id,r.rank,w.id as watch_id,w.brand,w.model,w.reference_code,w.source_url,w.image_url,r.price_note,r.rationale,r.details
  from private.ai_watch_search_results r join private.ai_watches w on w.id=r.watch_id
  where w.reference_code is not null order by r.search_id,r.rank`;
try {
  const keys = [
    ...new Map(
      rows.flatMap((r) =>
        r.reference_code
          ? [
              [
                `${r.brand.toLowerCase()}|${r.reference_code.toLowerCase()}`,
                { brand: r.brand, referenceCode: r.reference_code },
              ],
            ]
          : [],
      ),
    ).values(),
  ];
  const catalogue: z.infer<typeof catalogueWatchSchema>[] = [];
  for (let n = 0; n < keys.length; n += 100)
    catalogue.push(
      ...z
        .array(catalogueWatchSchema)
        .parse(
          await rpc(
            client,
            "watch_catalogue_lookup_v1",
            { p_keys: keys.slice(n, n + 100) },
            15000,
          ),
        ),
    );
  let changed = 0;
  for (const row of rows) {
    const watch: FoundWatch = {
      brand: row.brand,
      model: row.model,
      referenceCode: row.reference_code,
      sourceUrl: row.source_url,
      imageUrl: row.image_url,
      priceNote: row.price_note,
      rationale: row.rationale,
      details: z.record(z.string(), z.unknown()).parse(row.details),
    };
    const merged = mergeCatalogueFacts([watch], catalogue)[0]!;
    if (JSON.stringify(merged) === JSON.stringify(watch)) continue;
    const result =
      await sql`update private.ai_watch_search_results set price_note=${merged.priceNote},details=${sql.json(merged.details)} where search_id=${row.search_id} and rank=${row.rank}`;
    await sql`update private.ai_watches set image_url=coalesce(image_url,${merged.imageUrl}) where id=${row.watch_id}`;
    if (Number(result.count) > 0) {
      changed++;
    }
  }
  const report = {
    at: new Date().toISOString(),
    cachedWatchEntries: rows.length,
    distinctCachedIdentities: keys.length,
    catalogueEntriesMatched: catalogue.length,
    rowsRefreshed: changed,
    policy:
      "Only fields from unique, reference-confirmed local catalogue matches were added; existing facts, prices when not newly confirmed, source/rationale, ranks, search membership and attribution were preserved.",
  };
  await writeFile(
    "docs/reports/cache-catalogue-refresh.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
