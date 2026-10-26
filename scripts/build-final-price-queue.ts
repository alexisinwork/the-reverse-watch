// Builds the last bounded enrichment queue without changing the catalogue.
// Each row already passes the active reference/source/diameter/movement/style
// predicates, but has no usable price. A later low-cost Muse pass may attach
// an approximate price and image URL to only these exact references.
import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");
const archive = "data/watch-archive/final-price-queue";

type Candidate = {
  id: string;
  brand: string;
  model: string;
  reference: string;
  sourceUrl: string;
  missingPhoto: boolean;
};

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const rows = await sql<Candidate[]>`
    select id::text,brand,model,reference_code as reference,source_url as "sourceUrl",image_url is null as "missingPhoto"
    from private.watch_catalogue
    where review_status <> 'rejected'
      and source_url is not null
      and reference_code is not null
      and reference_confirmed
      and case_diameter_mm is not null
      and movement is not null
      and cardinality(styles) > 0
      and (price_amount is null or price_status='unconfirmed')
    order by brand,model,reference_code`;
  const unique = new Map<string, Candidate>();
  for (const row of rows) {
    const key = `${row.brand.toLowerCase()}|${row.reference.toLowerCase()}`;
    const current = unique.get(key);
    if (!current || (current.missingPhoto && !row.missingPhoto))
      unique.set(key, row);
  }
  const candidates = [...unique.values()];
  await mkdir(archive, { recursive: true });
  await writeFile(
    `${archive}/candidates.jsonl`,
    candidates.map((row) => JSON.stringify(row)).join("\n") + "\n",
  );
  const budget = {
    // Meta bills web grounding at $0.0025/query. The cap includes room for
    // concise structured model output and retries on a small failure sample.
    webSearchUsd: Number((candidates.length * 0.0025).toFixed(2)),
    recommendedOnePassCapUsd: Number(
      Math.max(25, candidates.length * 0.0055).toFixed(2),
    ),
  };
  await writeFile(
    `${archive}/summary.json`,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        rawQualifiedUnpricedRows: rows.length,
        exactReferenceCandidates: candidates.length,
        alsoNeedPhoto: candidates.filter((row) => row.missingPhoto).length,
        budget,
        policy:
          "One low-cost Muse request per exact reference, seeking only an approximate current price and a public product image URL. No visitor data is sent. Results stay approximate and retain the source URL.",
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify(
      {
        rawQualifiedUnpricedRows: rows.length,
        exactReferenceCandidates: candidates.length,
        alsoNeedPhoto: candidates.filter((row) => row.missingPhoto).length,
        budget,
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
