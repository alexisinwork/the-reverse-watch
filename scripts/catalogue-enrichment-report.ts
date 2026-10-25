import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
import {
  catalogueClient,
  listCatalogue,
  rpc,
} from "../app/domain/watch-catalogue.server";
import { enrichResultWatches } from "../app/domain/catalogue-result-enrichment.server";
import { archetypeCatalogueWatches } from "../app/domain/archetype-catalogue.server";
import { catalogueRuleFailures } from "../app/domain/watch-catalogue";
import {
  profileV4Schema,
  PRICE_RANGES,
  QUESTIONNAIRE_V4_VERSION,
} from "../app/domain/questionnaire-v4";
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  if (process.argv.includes("--prioritize")) {
    const picks = z
      .object({
        lists: z.record(
          z.string(),
          z.record(z.string(), z.array(z.object({ id: z.string() }))),
        ),
      })
      .parse(
        JSON.parse(await readFile("app/data/archetype-picks.json", "utf8")),
      );
    const ids = [
      ...new Set(
        Object.values(picks.lists).flatMap((bands) =>
          Object.values(bands).flatMap((rows) => rows.map((row) => row.id)),
        ),
      ),
    ];
    await sql`update private.watch_catalogue_intake i set priority =
      case when w.id=any(array(select jsonb_array_elements_text(${sql.json(ids)}))::uuid[]) then 200 else 0 end +
      case when w.import_source is null then 100 else 0 end +
      case when w.image_url is null then 30 else 0 end +
      case when w.case_diameter_mm is null or w.water_resistance_m is null or w.movement is null then 20 else 0 end
      from private.watch_catalogue w where i.watch_id=w.id and i.state='pending'`;
  }
  if (process.argv.includes("--prioritize-new")) {
    // Exercise a small recent mass-market sample before the first pass is
    // exhausted only rechecking previously known references.
    await sql`update private.watch_catalogue_intake set priority=400 where (source,snapshot,source_record_id) in (
      select i.source,i.snapshot,i.source_record_id from private.watch_catalogue_intake i join private.watch_catalogue w on w.id=i.watch_id
      where i.state='pending' and w.import_source is not null and w.brand in ('Tissot','Seiko','Casio')
        and exists(select 1 from jsonb_array_elements(i.payload->'evidence') e where e->>'field'='Produced' and e->>'value' ~ '^202[0-6]')
      order by w.brand,w.reference_code limit 12
    )`;
  }
  const totals =
    await sql`select count(*)::int as total,count(*) filter(where import_source is not null)::int as imported,
    count(*) filter(where import_source is not null and reference_confirmed)::int as imported_reference_confirmed,
    count(*) filter(where import_source is not null and image_url is not null)::int as imported_with_image,
    count(*) filter(where import_source is not null and price_status='confirmed')::int as imported_priced from private.watch_catalogue`;
  const importedExamples = await sql<
    { id: string }[]
  >`select id,brand,reference_code,reference_confirmed,case_diameter_mm,case_thickness_mm,water_resistance_m,movement,styles,image_url,price_status
    from private.watch_catalogue where import_source is not null and reference_confirmed order by updated_at desc limit 5`;
  const states =
    await sql`select state,count(*)::int as count from private.watch_catalogue_intake group by state order by state`;
  const archived =
    await sql`select count(*)::int as records,count(*) filter(where jsonb_typeof(payload)='object')::int as object_payloads from private.watch_catalogue_intake`;
  const recent = await sql<
    {
      id: string;
      brand: string;
      model: string;
      reference_code: string;
      image_url: string | null;
      state: string;
    }[]
  >`
    select w.id,w.brand,w.model,w.reference_code,w.image_url,i.state from private.watch_catalogue_intake i join private.watch_catalogue w on w.id=i.watch_id
    where i.state='enriched' order by i.updated_at desc limit 5`;
  const retry =
    await sql`select last_error,count(*)::int as count from private.watch_catalogue_intake where state='retry' group by last_error`;
  const client = catalogueClient();
  if (!client) throw new Error("Catalogue read configuration required");
  const searchable = await listCatalogue(client);
  const quizEligibility = importedExamples.map((example) => {
    const watch = searchable.find((w) => w.id === example.id);
    if (!watch || watch.priceAmount === null)
      return { id: example.id, searchable: false };
    const range = PRICE_RANGES.find(
      (range) =>
        watch.priceAmount! >= range.minimum &&
        (range.maximum === null || watch.priceAmount! < range.maximum),
    );
    if (!range) return { id: example.id, searchable: false };
    const profile = profileV4Schema.parse({
      version: QUESTIONNAIRE_V4_VERSION,
      budgetCurrency: watch.priceCurrency,
      priceRange: range.id,
      wristCm: 18,
      caseDiameterMinMm: 20,
      caseDiameterMaxMm: 60,
      wearingScenarios: ["office", "sport_chic", "diving", "hiking"],
      minimumWaterResistanceM: 0,
      movementTypes: [watch.movement ?? "automatic"],
      requiredComplications: [],
      allergyConstraint: "none",
    });
    return {
      id: example.id,
      reference: watch.referenceCode,
      searchable: true,
      relaxedQuizRuleFailures: catalogueRuleFailures(watch, profile, null),
    };
  });
  const archetype = await archetypeCatalogueWatches(
    "field_rationalist",
    "first_good_watch",
  );
  const status = await rpc(client, "watch_catalogue_intake_status_v1", {});
  const access =
    await sql`select relrowsecurity as intake_rls from pg_class where oid='private.watch_catalogue_intake'::regclass`;
  const grants =
    await sql`select has_function_privilege('anon','public.watch_catalogue_lookup_v1(jsonb)','EXECUTE') as anon_lookup,
    has_function_privilege('authenticated','public.watch_catalogue_lookup_v1(jsonb)','EXECUTE') as authenticated_lookup,
    has_function_privilege('anon','public.watch_catalogue_intake_status_v1()','EXECUTE') as anon_status`;
  const propagation = await enrichResultWatches(
    recent.map((w) => ({
      brand: w.brand,
      model: w.model,
      referenceCode: w.reference_code,
      imageUrl: null,
      sourceUrl: "",
      priceNote: null,
      rationale: "verification",
      details: {},
    })),
    client,
  );
  const evidence = {
    at: new Date().toISOString(),
    totals,
    importedExamples,
    states,
    archived,
    retry,
    status,
    access,
    grants,
    recommendationRows: searchable.length,
    quizEligibility,
    liveArchetypeReferences: archetype.map(
      (w) => `${w.brand} ${w.referenceCode ?? w.model}`,
    ),
    exactLookupPropagation: recent.map((w, index) => ({
      reference: `${w.brand} ${w.reference_code}`,
      matched: propagation[index]?.details.catalogueId === w.id,
      imageMatches: propagation[index]?.imageUrl === w.image_url,
    })),
    scope:
      "No film attribution or archetype membership inferred from reference data. Read-time hydration is shared by app/widgets/API. No cache-wide rewrite.",
  };
  await writeFile(
    "docs/reports/catalogue-enrichment-status.json",
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await sql.end();
}
