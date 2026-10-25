// Counts which locally stored models can satisfy the quiz's baseline facts.
// This is an audit only: it neither changes review states nor prices.
import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const sources = await sql`
    select coalesce(import_source,'native') as source,
      count(*)::int as models,
      count(*) filter(where reference_confirmed and reference_code is not null)::int as exact_references,
      count(*) filter(where image_url is not null)::int as with_photo_url,
      count(*) filter(where price_amount is not null and price_status <> 'unconfirmed')::int as with_usable_price,
      count(*) filter(where case_diameter_mm is not null)::int as with_diameter,
      count(*) filter(where movement is not null)::int as with_movement,
      count(*) filter(where cardinality(styles)>0)::int as with_style_tags,
      count(*) filter(where review_status <> 'rejected'
        and reference_confirmed and reference_code is not null
        and price_amount is not null and price_status <> 'unconfirmed'
        and case_diameter_mm is not null and movement is not null
        and cardinality(styles)>0)::int as baseline_quiz_eligible,
      count(*) filter(where review_status <> 'rejected'
        and reference_confirmed and reference_code is not null
        and price_amount is not null and price_status <> 'unconfirmed'
        and case_diameter_mm is not null and movement is not null
        and cardinality(styles)>0 and image_url is null)::int as eligible_without_photo
    from private.watch_catalogue
    group by import_source order by source`;
  const dials = await sql`
    select count(*) filter(where source_details ? 'dials')::int as dials_supplemented,
      count(*) filter(where source_details ? 'dials' and reference_confirmed)::int as exact_dials_references,
      count(*) filter(where source_details ? 'dials' and price_amount is not null
        and price_status <> 'unconfirmed' and case_diameter_mm is not null
        and movement is not null and cardinality(styles)>0 and review_status <> 'rejected')::int as dials_supplemented_quiz_eligible,
      count(*) filter(where source_details ? 'dials' and image_url is null)::int as dials_supplemented_without_photo
    from private.watch_catalogue`;
  const cache = await sql`
    select count(*)::int as result_rows,
      count(*) filter(where w.reference_code is not null)::int as with_reference,
      count(*) filter(where w.image_url is not null)::int as with_photo_url,
      count(*) filter(where r.details->'sourceDetails'->>'Power reserve (hours)' is not null)::int as already_has_supplemental_spec
    from private.ai_watch_search_results r
    join private.ai_watches w on w.id=r.watch_id`;
  const inventory = await sql<
    {
      brand: string;
      model: string;
      reference_code: string | null;
      reference_confirmed: boolean;
      source: string;
      has_photo: boolean;
      has_usable_price: boolean;
      has_diameter: boolean;
      has_movement: boolean;
      has_style: boolean;
      has_water_resistance: boolean;
      has_case_material: boolean;
      has_crystal: boolean;
    }[]
  >`
    select brand,model,reference_code,reference_confirmed,
      coalesce(import_source,'native') as source,
      image_url is not null as has_photo,
      price_amount is not null and price_status <> 'unconfirmed' as has_usable_price,
      case_diameter_mm is not null as has_diameter,
      movement is not null as has_movement,
      cardinality(styles)>0 as has_style,
      water_resistance_m is not null as has_water_resistance,
      case_material is not null as has_case_material,
      crystal is not null as has_crystal
    from private.watch_catalogue where review_status <> 'rejected'
    order by brand,model`;
  const missingCounts: Record<string, number> = {};
  const queue = inventory
    .map((row) => {
      const hasReference = row.reference_confirmed && !!row.reference_code;
      const missing = [
        ["reference", hasReference],
        ["photo", row.has_photo],
        ["usable_price", row.has_usable_price],
        ["diameter", row.has_diameter],
        ["movement", row.has_movement],
        ["style", row.has_style],
        ["water_resistance", row.has_water_resistance],
        ["case_material", row.has_case_material],
        ["crystal", row.has_crystal],
      ].flatMap(([name, present]) => {
        if (present) return [];
        missingCounts[String(name)] = (missingCounts[String(name)] ?? 0) + 1;
        return [String(name)];
      });
      const coreFitMissing =
        !row.has_diameter || !row.has_movement || !row.has_style;
      const nextAction = !hasReference
        ? "confirm_reference"
        : coreFitMissing
          ? "complete_core_fit_facts"
          : !row.has_usable_price
            ? "verify_current_price"
            : !row.has_photo
              ? "optional_photo"
              : "fill_optional_specifications";
      const priority =
        nextAction === "confirm_reference"
          ? 1
          : nextAction === "complete_core_fit_facts"
            ? 2
            : nextAction === "verify_current_price"
              ? 3
              : nextAction === "optional_photo"
                ? 4
                : 5;
      return {
        brand: row.brand,
        model: row.model,
        reference: row.reference_code,
        source: row.source,
        nextAction,
        priority,
        missing,
      };
    })
    .filter((row) => row.missing.length)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.brand.localeCompare(b.brand) ||
        a.model.localeCompare(b.model),
    );
  const report = {
    at: new Date().toISOString(),
    sources,
    dialsSupplement: dials[0],
    cachedResults: cache[0],
    missingFieldCounts: missingCounts,
    missingRecordCount: queue.length,
    quizEligibility:
      "Reference, usable price, diameter, movement and at least one explicit style tag; photos are optional and missing facts remain null.",
    note: "A model count is not a recommendable count. Unknown prices prevent any active budget fit. The baseline counts watches that can satisfy common hard filters; water resistance, wrist, currency conversion and specific style constraints are checked per profile.",
  };
  await writeFile(
    "docs/reports/local-source-recommendability.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await mkdir("data/watch-archive", { recursive: true });
  await writeFile(
    "data/watch-archive/catalogue-enrichment-queue.json",
    `${JSON.stringify({ at: report.at, records: queue }, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
