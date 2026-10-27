// Removes one demonstrably misattributed sighting from one cached film/person
// result. The underlying catalogue watch and any other search result remain.
// Usage: node --env-file=.env --import tsx scripts/remove-cached-film-sighting.ts "Daniel Craig" "231.10.30.20.06.001" "7 documented watch sightings."
import postgres from "postgres";

import { aiSearchCacheKey } from "../app/domain/ai-watch-store.server";

const [query, referenceCode, summary] = process.argv.slice(2);
if (!query || !referenceCode || !summary) {
  throw new Error("Expected query, reference code and replacement summary.");
}
const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const cacheKey = aiSearchCacheKey("film", {
    query: query.toLowerCase().trim(),
    kind: "actor",
  });
  const rows = await sql<{ search_id: string; rank: number; model: string }[]>`
    select r.search_id,r.rank,w.model
    from private.ai_watch_searches s
    join private.ai_watch_search_results r on r.search_id=s.id
    join private.ai_watches w on w.id=r.watch_id
    where s.cache_key=${cacheKey} and w.reference_code=${referenceCode}`;
  if (rows.length !== 1) {
    throw new Error(`Expected one cached sighting, found ${rows.length}.`);
  }
  const row = rows[0]!;
  await sql`delete from private.ai_watch_search_results where search_id=${row.search_id} and rank=${row.rank}`;
  await sql`update private.ai_watch_searches set summary=${summary} where id=${row.search_id}`;
  console.log(
    JSON.stringify({ removed: 1, query, referenceCode, model: row.model }),
  );
} finally {
  await sql.end();
}
