// Proves on the real catalogue that the cheaper-alternative finder's name
// lookups after migration 0118 give exactly what they gave before:
//
// 1. the database's fold and reference key equal the code's for every pool
//    row (so the database can only find more rows, never fewer);
// 2. resolving a typed name from the name candidates gives the same answer
//    as resolving it from the whole 25,000-row name index;
// 3. watch_catalogue_named_v2 returns exactly what named_v1 returns.
//
// Names come from the owner's test set, a fixed sample of pool rows typed in
// several ways (whole, shortened, one word wrong, capitals, no accents, with
// and without the reference), rows outside the pool, and odd inputs.
// Read-only: no writes, no paid provider calls. The full run (80 sampled
// pool rows, 794 typed names) takes about 20 minutes, mostly resolving each
// name against all 25,000 rows the old way; --sample 20 takes about 7.
//
//   node --env-file=.env --import tsx scripts/check-name-lookup-equivalence.ts [--sample 20]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";
import { z } from "zod";

import {
  foldName,
  nameCandidateQuery,
  resolveNamedWatch,
} from "../app/domain/alternatives.server";
import {
  catalogueWatchSchema,
  type CatalogueWatch,
  type NameFacts,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  loadNameCandidates,
  loadNameIndexCached,
} from "../app/domain/watch-catalogue.server";

const client = catalogueClient();
const url = process.env.DIRECT_DATABASE_URL?.trim();
if (!client || !url) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DIRECT_DATABASE_URL are required.",
  );
}
const sql = postgres(url, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});

const differences: string[] = [];
const differ = (message: string) => {
  differences.push(message);
  console.error(`DIFFERENCE: ${message}`);
};
const runs = (value: string) => (value.match(/[a-z0-9]+/g) ?? []).join(" ");
const percentile = (values: number[], share: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0
  );
};
const timed = async <T>(work: () => Promise<T>) => {
  const startedAt = performance.now();
  const value = await work();
  return { value, ms: Math.round(performance.now() - startedAt) };
};

// The old per-instance read, kept as the reference.
const indexRead = await timed(() => loadNameIndexCached(client));
const index = indexRead.value;
console.log(`Name index: ${index.length} rows in ${indexRead.ms} ms`);

// 1. Fold and reference key on every pool row, computed by the database.
const poolRows = await sql.begin(
  "read only",
  (tx) => tx<
    {
      id: string;
      text: string;
      fold: string;
      reference: string | null;
      key: string | null;
    }[]
  >`
  select w.id,
         w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '') as text,
         private.watch_name_fold(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) as fold,
         w.reference_code as reference,
         private.watch_reference_key(w.reference_code) as key
  from private.watch_catalogue w
  where w.review_status <> 'rejected'
    and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'))`,
);
let foldDifferences = 0;
for (const row of poolRows) {
  if (runs(row.fold) !== runs(foldName(row.text))) {
    foldDifferences += 1;
    if (foldDifferences <= 5) differ(`fold of ${row.id}: ${row.text}`);
  }
  const codeKey =
    row.reference?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? null;
  if (row.key !== codeKey) {
    foldDifferences += 1;
    if (foldDifferences <= 5)
      differ(`reference key of ${row.id}: ${row.reference}`);
  }
}
if (poolRows.length !== index.length) {
  differ(`pool has ${poolRows.length} rows, name index ${index.length}`);
}

// 2. Typed names.
const set = JSON.parse(
  readFileSync("data/alternatives/owner-test-set-2026-10-01.json", "utf8"),
) as { cases: { original: string }[] };
/** A small deterministic random generator, so the sample is the same on
 * every run with the same catalogue. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const next = random(20261125);
const sampleFlag = process.argv.indexOf("--sample");
const sampleSize =
  sampleFlag >= 0 ? Number(process.argv[sampleFlag + 1] ?? "") : 80;
if (!Number.isInteger(sampleSize) || sampleSize < 1) {
  throw new Error("--sample takes a whole number of pool rows, such as 20.");
}
// The first rows of the full run's sample, so a smaller run is a subset.
const sample = Array.from(
  { length: 80 },
  () => index[Math.floor(next() * index.length)]!,
).slice(0, sampleSize);
const outside = await sql.begin(
  "read only",
  (tx) => tx<{ brand: string; model: string; reference: string | null }[]>`
  select brand, model, reference_code as reference
  from private.watch_catalogue
  where review_status <> 'rejected'
    and import_source is not null
    and (price_amount is null or price_status = 'unconfirmed')
  order by md5(id::text) limit ${Math.ceil(sampleSize / 2)}`,
);

const typings: { name: string; reference: string | null; group: string }[] = [];
const add = (group: string, name: string, reference: string | null = null) =>
  typings.push({ group, name, reference });
for (const { original } of set.cases) {
  const words = original.split(" ");
  add("owner set", original);
  add("owner set", words.slice(0, 2).join(" "));
  if (words.length >= 3)
    add("owner set", [...words.slice(0, -1), "Zzz"].join(" "));
  const resolved = resolveNamedWatch(index, original, null);
  if (resolved.status === "found" && resolved.watch.referenceCode) {
    add("owner set", original, resolved.watch.referenceCode);
  }
}
for (const row of sample) {
  const words = `${row.brand} ${row.model}`.split(" ");
  add("pool sample", words.join(" "));
  add("pool sample", row.model);
  add("pool sample", words.slice(0, 2).join(" "));
  add("pool sample", words.join(" ").toUpperCase());
  add("pool sample", words.join(" ").normalize("NFD").replace(/[̀-ͯ]/g, ""));
  if (words.length >= 3)
    add("pool sample", [...words.slice(0, -1), "Zzz"].join(" "));
  if (row.referenceCode) {
    add("pool sample", words.join(" "), row.referenceCode);
    add(
      "pool sample",
      "x",
      row.referenceCode.toLowerCase().replace(/[^a-z0-9]/g, " "),
    );
  }
}
for (const row of outside) {
  add("outside pool", `${row.brand} ${row.model}`);
  if (row.reference)
    add("outside pool", `${row.brand} ${row.model}`, row.reference);
}
for (const name of [
  "ab",
  "the watch",
  "%_\\",
  "Rolex",
  "Omega",
  "Seiko 5",
  "GS",
  "Black Bay 51",
  "Patek Philippe Nautilus",
  "Tudor Black Bay Fifty Eight",
  "Glashutte Senator",
  "Glashütte Senator",
  "  Rolex   Submariner  ",
]) {
  add("odd inputs", name);
}

const namedSchema = z.array(catalogueWatchSchema);
const describe = (
  result: ReturnType<typeof resolveNamedWatch<NameFacts | CatalogueWatch>>,
) =>
  result.status === "found"
    ? `found ${result.watch.id}`
    : result.status === "ambiguous"
      ? `ambiguous ${result.options.map((option) => option.id).join(",")}`
      : "not_found";

const times = {
  namedV1: [] as number[],
  namedV2: [] as number[],
  candidates: [] as number[],
};
const candidateRows: number[] = [];
const outcomes = { found: 0, ambiguous: 0, not_found: 0 };
const compareOne = async ({
  name,
  reference,
  group,
}: (typeof typings)[number]) => {
  // Both versions through the same direct connection, with time to finish:
  // under load named_v1 can exceed the API's 8-second statement limit.
  const named = (version: 1 | 2) =>
    timed(() =>
      sql.begin("read only", async (tx) => {
        await tx`set local statement_timeout = '120s'`;
        const [row] =
          version === 1
            ? await tx`select public.watch_catalogue_named_v1(${name}, ${reference}) as value`
            : await tx`select public.watch_catalogue_named_v2(${name}, ${reference}) as value`;
        return row!.value as unknown;
      }),
    );
  const v1 = await named(1);
  const v2 = await named(2);
  const candidates = await timed(() =>
    loadNameCandidates(client, nameCandidateQuery(name, reference)),
  );
  times.namedV1.push(v1.ms);
  times.namedV2.push(v2.ms);
  times.candidates.push(candidates.ms);
  candidateRows.push(candidates.value.length);
  if (JSON.stringify(v1.value) !== JSON.stringify(v2.value)) {
    differ(
      `[${group}] named_v2 differs from named_v1 for "${name}" / ${reference}`,
    );
  }
  // Exactly what startAlternativesSearch did before and does now.
  const compose = (base: readonly NameFacts[], named: CatalogueWatch[]) => {
    const known = new Set(base.map((row) => row.id));
    return [...base, ...named.filter((row) => !known.has(row.id))];
  };
  const before = resolveNamedWatch(
    compose(index, namedSchema.parse(v1.value)),
    name,
    reference,
  );
  const after = resolveNamedWatch(
    compose(candidates.value, namedSchema.parse(v2.value)),
    name,
    reference,
  );
  if (describe(before) !== describe(after)) {
    differ(
      `[${group}] "${name}" / ${reference}: ${describe(before)} became ${describe(after)}`,
    );
  }
  outcomes[before.status] += 1;
};
// One at a time: named_v1 by name scans the whole table.
for (const typing of typings) {
  await compareOne(typing);
}
await sql.end();

const summary = (values: number[]) => ({
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  max: Math.max(...values),
});
const report = {
  at: new Date().toISOString(),
  sampledPoolRows: sampleSize,
  poolRowsChecked: poolRows.length,
  foldAndReferenceKeyDifferences: foldDifferences,
  nameIndex: { rows: index.length, readMs: indexRead.ms },
  typings: typings.length,
  byGroup: Object.fromEntries(
    [...new Set(typings.map((typing) => typing.group))].map((group) => [
      group,
      typings.filter((typing) => typing.group === group).length,
    ]),
  ),
  outcomes,
  ms: {
    namedV1: summary(times.namedV1),
    namedV2: summary(times.namedV2),
    candidates: summary(times.candidates),
  },
  candidateRows: summary(candidateRows),
  differences,
  result: differences.length === 0 ? "PASS" : "FAIL",
};
// A smaller run never overwrites the full run's report.
const output = resolve(
  `docs/reports/name-lookup-equivalence-${sampleSize === 80 ? "" : `sample${sampleSize}-`}${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ ...report, differences: differences.length }, null, 2),
);
console.log(`Wrote ${output}`);
if (differences.length) {
  process.exit(1);
}
