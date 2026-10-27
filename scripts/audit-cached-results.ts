// Exhaustive, no-network audit of saved answer cards. This deliberately
// distinguishes a structural/local-catalogue check from external fact checks.
import { writeFile } from "node:fs/promises";

import postgres from "postgres";
import { z } from "zod";

import { catalogueWatchSchema } from "../app/domain/watch-catalogue";
import { catalogueClient, rpc } from "../app/domain/watch-catalogue.server";

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
const fold = (value: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
type CachedRow = {
  search_id: string;
  kind: string;
  rank: number;
  brand: string;
  model: string;
  reference_code: string | null;
  details: unknown;
};

try {
  const rows = await sql<CachedRow[]>`
    select r.search_id,s.kind,r.rank,w.brand,w.model,w.reference_code,r.details
    from private.ai_watch_searches s
    join private.ai_watch_search_results r on r.search_id=s.id
    join private.ai_watches w on w.id=r.watch_id
    order by s.kind,r.search_id,r.rank`;
  const keys = [
    ...new Map(
      rows.flatMap((row) =>
        row.reference_code
          ? [
              [
                `${fold(row.brand)}|${fold(row.reference_code)}`,
                { brand: row.brand, referenceCode: row.reference_code },
              ],
            ]
          : [],
      ),
    ).values(),
  ];
  const catalogue: z.infer<typeof catalogueWatchSchema>[] = [];
  for (let start = 0; start < keys.length; start += 100) {
    catalogue.push(
      ...z
        .array(catalogueWatchSchema)
        .parse(
          await rpc(
            client,
            "watch_catalogue_lookup_v1",
            { p_keys: keys.slice(start, start + 100) },
            30_000,
          ),
        ),
    );
  }
  const localMatchCount = new Map<string, number>();
  for (const watch of catalogue) {
    const key = `${fold(watch.brand)}|${fold(watch.referenceCode)}`;
    if (watch.referenceConfirmed && watch.reviewStatus !== "rejected") {
      localMatchCount.set(key, (localMatchCount.get(key) ?? 0) + 1);
    }
  }
  const perKind: Record<string, number> = {};
  const displayDuplicates: { searchId: string; identities: string[] }[] = [];
  const unresolvedMediaClaims: { brand: string; reference: string | null }[] =
    [];
  let noReference = 0;
  let uniquelyLocallyMatched = 0;
  let locallyAmbiguousOrMissing = 0;
  const searches = new Map<string, CachedRow[]>();
  for (const row of rows) {
    const group = searches.get(row.search_id) ?? [];
    group.push(row);
    searches.set(row.search_id, group);
  }
  for (const group of searches.values()) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of group) {
      perKind[row.kind] = (perKind[row.kind] ?? 0) + 1;
      const identity = row.reference_code
        ? `${fold(row.brand)}|${fold(row.reference_code)}`
        : `${fold(row.brand)}|${fold(row.model)}`;
      if (seen.has(identity)) duplicates.add(identity);
      seen.add(identity);
      if (!row.reference_code) noReference++;
      else if (
        localMatchCount.get(
          `${fold(row.brand)}|${fold(row.reference_code)}`,
        ) === 1
      )
        uniquelyLocallyMatched++;
      else locallyAmbiguousOrMissing++;
      const details = z.record(z.string(), z.unknown()).safeParse(row.details);
      if (details.success && (details.data.person || details.data.work)) {
        unresolvedMediaClaims.push({
          brand: row.brand,
          reference: row.reference_code,
        });
      }
    }
    if (duplicates.size)
      displayDuplicates.push({
        searchId: group[0]!.search_id,
        identities: [...duplicates],
      });
  }
  const report = {
    at: new Date().toISOString(),
    savedCards: rows.length,
    savedSearches: new Set(rows.map((row) => row.search_id)).size,
    cardsByKind: perKind,
    distinctReferencedIdentities: keys.length,
    cardsWithoutReference: noReference,
    cardsWithOneApprovedLocalReferenceMatch: uniquelyLocallyMatched,
    cardsWithMissingOrAmbiguousLocalReferenceMatch: locallyAmbiguousOrMissing,
    searchesWithDisplayDuplicates: displayDuplicates.length,
    displayDuplicates,
    mediaClaimCardsNeedingSourceAudit: unresolvedMediaClaims.length,
    policy:
      "This is a structural/local-catalogue audit only. It does not certify actor/film attribution, current price, photo rights, or source-page claims. Those require separately retained source evidence.",
  };
  await writeFile(
    "docs/reports/cached-results-local-audit.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
