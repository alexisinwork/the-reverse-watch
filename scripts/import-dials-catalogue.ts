// Import the complete local Dials mirror into the private catalogue.
// The full source model remains archived in watch_catalogue_intake; no Dials
// image URL or marketplace price is exposed as a recommendation fact.
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import postgres from "postgres";
import {
  dialsFacts,
  dialsIdentityKey,
  dialsModelSchema,
  dialsReferenceKey,
  dialsStyles,
  dialsSupplementalDetails,
} from "../app/domain/dials-catalogue-import";

const path = "data/watch-archive/dials/models.jsonl";
const manifestPath = "data/watch-archive/dials/sitemap.json";
const write = process.argv.includes("--write");
const limitAt = process.argv.indexOf("--limit");
const limit = limitAt < 0 ? Infinity : Number(process.argv[limitAt + 1]);
if (!(limit > 0)) throw new Error("--limit must be positive");
const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");

type MirrorRow = {
  id: string;
  sourceUrl: string;
  snapshot: string;
  checkedAt: string;
  model: unknown;
};
type Existing = {
  id: string;
  identity_key: string;
  brand: string;
  model: string;
  reference_code: string | null;
  reference_confirmed: boolean;
  source_kind: string | null;
  source_url: string | null;
  case_diameter_mm: number | null;
  case_thickness_mm: number | null;
  water_resistance_m: number | null;
  movement: string | null;
  crystal: string | null;
  display_caseback: boolean | null;
  case_shape: string | null;
  case_material: string | null;
  strap_material: string | null;
  found_in: unknown;
};
const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
const refKey = (brand: string, ref: string | null) =>
  ref ? `${fold(brand)}|${fold(ref)}` : null;
const modelKey = (brand: string, model: string) =>
  `${fold(brand)}|model:${fold(model)}`;
const boundedNumber = (value: number | null, min: number, max: number) =>
  value !== null && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
const sourceMeta = (
  row: MirrorRow,
  model: ReturnType<typeof dialsModelSchema.parse>,
) => ({
  source: "dials",
  sourceRecordId: row.id,
  url: row.sourceUrl,
  apiUrl: `https://api.dials.co/v1/models/${model.brand.slug}/${model.slug}`,
  terms: "https://docs.dials.co/api/terms",
  checkedAt: row.checkedAt,
  fields: Object.entries(dialsFacts(model))
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key]) => key),
});

async function* mirrorRows() {
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let parsed: MirrorRow;
    try {
      parsed = JSON.parse(line) as MirrorRow;
    } catch {
      continue;
    }
    const model = dialsModelSchema.safeParse(parsed.model);
    if (!model.success || !parsed.sourceUrl || !parsed.id || !parsed.snapshot)
      continue;
    yield { ...parsed, model: model.data };
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
  snapshot: string;
  total: number;
};
const counts = new Map<string, number>();
const exactReferenceCounts = new Map<string, number>();
let sourceRows = 0;
for await (const row of mirrorRows()) {
  const model = dialsModelSchema.parse(row.model);
  const key = dialsReferenceKey(model);
  counts.set(key, (counts.get(key) ?? 0) + 1);
  if (model.referenceNumber) {
    exactReferenceCounts.set(key, (exactReferenceCounts.get(key) ?? 0) + 1);
  }
  sourceRows++;
}
if (limit !== Infinity) sourceRows = Math.min(sourceRows, limit);

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  max_lifetime: 0,
  onnotice: () => undefined,
});
const stats = {
  mirrored: sourceRows,
  exactReferences: 0,
  noReferenceNames: 0,
  duplicateSourceIdentities: 0,
  ambiguousMasterIdentities: 0,
  existingUpdated: 0,
  newIdentities: 0,
  nullFactsFilled: 0,
  strongerCatalogueConflictsResolved: 0,
  primaryFactsPreserved: 0,
  intakeArchived: 0,
  noImageFromDials: 0,
  noPriceFromDials: 0,
};

try {
  const catalogue = await sql<Existing[]>`
    select id,identity_key,brand,model,reference_code,reference_confirmed,
      source_kind,source_url,case_diameter_mm,case_thickness_mm,
      water_resistance_m,movement,crystal,display_caseback,case_shape,case_material,
      strap_material,found_in
    from private.watch_catalogue`;
  const byRef = new Map<string, Existing[]>();
  const byModel = new Map<string, Existing[]>();
  for (const row of catalogue) {
    const rk = refKey(row.brand, row.reference_code);
    if (rk) byRef.set(rk, [...(byRef.get(rk) ?? []), row]);
    const mk = modelKey(row.brand, row.model);
    byModel.set(mk, [...(byModel.get(mk) ?? []), row]);
  }

  let chunk: ReturnType<typeof prepareRow>[] = [];
  function prepareRow(row: MirrorRow) {
    const model = dialsModelSchema.parse(row.model);
    const key = dialsReferenceKey(model);
    const count = counts.get(key) ?? 0;
    const reference = model.referenceNumber?.trim() || null;
    const lookup = reference
      ? (byRef.get(key) ?? [])
      : (byModel.get(key) ?? []);
    return { row, model, key, count, reference, lookup };
  }
  async function flush(batch: typeof chunk) {
    if (!batch.length) return;
    const creates: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];
    const archives: Record<string, unknown>[] = [];
    const identityByRecord = new Map<string, string>();
    for (const item of batch) {
      const { row, model, count, reference, lookup } = item;
      const rawFacts = dialsFacts(model);
      const dials = {
        ...rawFacts,
        caseDiameterMm: boundedNumber(rawFacts.caseDiameterMm, 15, 70),
        caseThicknessMm: boundedNumber(rawFacts.caseThicknessMm, 2, 40),
        waterResistanceM: boundedNumber(rawFacts.waterResistanceM, 0, 20000),
      };
      const meta = sourceMeta(row, model);
      const duplicate = count !== 1 || lookup.length > 1;
      if (count > 1) stats.duplicateSourceIdentities++;
      if (lookup.length > 1) stats.ambiguousMasterIdentities++;
      const existing = lookup.length === 1 ? lookup[0]! : null;
      const identityKey = dialsIdentityKey(model);
      identityByRecord.set(row.id, identityKey);
      if (reference) stats.exactReferences++;
      else stats.noReferenceNames++;

      const conflicts: Record<string, { prior: unknown; dials: unknown }>[] =
        [];
      let nullFactsFilled = 0;
      let conflictsResolved = 0;
      let primaryFactsPreserved = 0;
      if (existing && !duplicate) {
        const useDialsTitle =
          existing.source_kind === "catalogue" || existing.source_kind === null;
        if (existing.model !== model.name) {
          conflicts.push({
            model: { prior: existing.model, dials: model.name },
          });
          if (useDialsTitle) conflictsResolved++;
          else primaryFactsPreserved++;
        }
        const fieldPairs = [
          ["case_diameter_mm", existing.case_diameter_mm, dials.caseDiameterMm],
          [
            "case_thickness_mm",
            existing.case_thickness_mm,
            dials.caseThicknessMm,
          ],
          [
            "water_resistance_m",
            existing.water_resistance_m,
            dials.waterResistanceM,
          ],
          ["movement", existing.movement, dials.movement],
          ["crystal", existing.crystal, dials.crystal],
          [
            "display_caseback",
            existing.display_caseback,
            dials.displayCaseback,
          ],
          ["case_shape", existing.case_shape, dials.caseShape],
          ["case_material", existing.case_material, dials.caseMaterial],
          ["strap_material", existing.strap_material, dials.strapMaterial],
        ] as const;
        for (const [field, prior, next] of fieldPairs) {
          if (next === null || next === undefined) continue;
          if (prior === null) nullFactsFilled++;
          else if (String(prior).toLowerCase() !== String(next).toLowerCase()) {
            conflicts.push({ [field]: { prior, dials: next } });
            if (
              existing.source_kind === "catalogue" ||
              existing.source_kind === null
            )
              conflictsResolved++;
            else primaryFactsPreserved++;
          }
        }
        updates.push({
          id: existing.id,
          sourceRecordId: row.id,
          sourceUrl: row.sourceUrl,
          sourceKind: existing.source_kind,
          sourceMeta: meta,
          referenceConfirmed: Boolean(reference),
          model: model.name,
          styles: dialsStyles(model),
          caseDiameterMm: dials.caseDiameterMm,
          caseThicknessMm: dials.caseThicknessMm,
          waterResistanceM: dials.waterResistanceM,
          movement: dials.movement,
          crystal: dials.crystal,
          displayCaseback: dials.displayCaseback,
          caseShape: dials.caseShape,
          caseMaterial: dials.caseMaterial,
          strapMaterial: dials.strapMaterial,
          complications: dials.complications,
          sourceDetails: dialsSupplementalDetails(model),
          allowDialsPrecedence:
            existing.source_kind === "catalogue" ||
            existing.source_kind === null,
        });
      } else if (!existing && !duplicate) {
        creates.push({
          identity_key: identityKey,
          brand: model.brand.name.slice(0, 160),
          model: model.name.slice(0, 200),
          reference_code: reference?.slice(0, 120) ?? null,
          reference_confirmed: Boolean(reference),
          styles: dialsStyles(model),
          case_diameter_mm: boundedNumber(dials.caseDiameterMm, 15, 70),
          case_thickness_mm: boundedNumber(dials.caseThicknessMm, 2, 40),
          water_resistance_m: boundedNumber(dials.waterResistanceM, 0, 20000),
          movement: dials.movement,
          crystal: dials.crystal,
          display_caseback: dials.displayCaseback,
          case_shape: dials.caseShape,
          complications: dials.complications,
          source_details: { dials: dialsSupplementalDetails(model) },
          case_material: dials.caseMaterial,
          strap_material: dials.strapMaterial,
          price_status: "unconfirmed",
          price_evidence: {},
          source_url: row.sourceUrl,
          source_kind: reference ? "catalogue" : null,
          image_url: null,
          rationale:
            "Reference specification from the Dials catalogue; no price or image has been imported.",
          found_in: [meta],
          review_status: "pending",
          import_source: "dials",
        });
        stats.newIdentities++;
        stats.noImageFromDials++;
        stats.noPriceFromDials++;
      }
      stats.nullFactsFilled += nullFactsFilled;
      stats.strongerCatalogueConflictsResolved += conflictsResolved;
      stats.primaryFactsPreserved += primaryFactsPreserved;
      archives.push({
        source: "dials",
        snapshot: row.snapshot,
        source_record_id: row.id,
        watch_id: existing && !duplicate ? existing.id : null,
        payload: row.model,
        state: duplicate ? "blocked_identity" : "enriched",
        priority: 20,
        enrichment: {
          sourceUrl: row.sourceUrl,
          licenseAndTerms: "https://docs.dials.co/api/terms",
          conflicts,
          fieldsFilled: nullFactsFilled,
          dialsPrecedenceConflicts: conflictsResolved,
          preservedPrimaryConflicts: primaryFactsPreserved,
          excludedImages: true,
          excludedMarketPrices: true,
        },
      });
      if (existing && !duplicate) stats.existingUpdated++;
    }

    if (write && creates.length) {
      for (let start = 0; start < creates.length; start += 200) {
        const block = creates.slice(start, start + 200);
        await sql`insert into private.watch_catalogue ${sql(block)} on conflict(identity_key) do nothing`;
        const keys = block.map((row) => String(row.identity_key));
        const inserted = await sql<{ id: string; identity_key: string }[]>`
          select id, identity_key from private.watch_catalogue
          where identity_key = any(${sql.array(keys)})`;
        const ids = new Map(inserted.map((row) => [row.identity_key, row.id]));
        for (const archive of archives) {
          if (archive.watch_id || archive.state !== "enriched") continue;
          const identityKey = identityByRecord.get(
            String(archive.source_record_id),
          );
          if (identityKey) archive.watch_id = ids.get(identityKey) ?? null;
        }
      }
    }
    if (write && updates.length) {
      const json = updates.map((item) => ({
        id: item.id,
        source_record_id: item.sourceRecordId,
        source_url: item.sourceUrl,
        source_kind: item.sourceKind,
        source_meta: item.sourceMeta,
        reference_confirmed: item.referenceConfirmed,
        model: item.model,
        styles: item.styles,
        case_diameter_mm: item.caseDiameterMm,
        case_thickness_mm: item.caseThicknessMm,
        water_resistance_m: item.waterResistanceM,
        movement: item.movement,
        crystal: item.crystal,
        display_caseback: item.displayCaseback,
        case_shape: item.caseShape,
        case_material: item.caseMaterial,
        strap_material: item.strapMaterial,
        complications: item.complications,
        source_details: item.sourceDetails,
        allow_dials_precedence: item.allowDialsPrecedence,
      }));
      await sql`
        with x as (
          select * from jsonb_to_recordset(${sql.json(json as postgres.JSONValue)}) as t(
            id uuid, source_record_id text, source_url text, source_kind text,
            source_meta jsonb, reference_confirmed boolean, model text, styles text[], case_diameter_mm numeric,
            case_thickness_mm numeric, water_resistance_m integer, movement text,
            crystal text, display_caseback boolean, case_shape text,
            case_material text, strap_material text, complications text[],
            source_details jsonb, allow_dials_precedence boolean
          )
        )
        update private.watch_catalogue w set
          reference_confirmed = w.reference_confirmed or x.reference_confirmed,
          model = case when x.allow_dials_precedence then x.model else w.model end,
          case_diameter_mm = case when x.case_diameter_mm is null then w.case_diameter_mm
            when w.case_diameter_mm is null or x.allow_dials_precedence then x.case_diameter_mm else w.case_diameter_mm end,
          case_thickness_mm = case when x.case_thickness_mm is null then w.case_thickness_mm
            when w.case_thickness_mm is null or x.allow_dials_precedence then x.case_thickness_mm else w.case_thickness_mm end,
          water_resistance_m = case when x.water_resistance_m is null then w.water_resistance_m
            when w.water_resistance_m is null or x.allow_dials_precedence then x.water_resistance_m else w.water_resistance_m end,
          movement = case when x.movement is null then w.movement
            when w.movement is null or x.allow_dials_precedence then x.movement else w.movement end,
          crystal = case when x.crystal is null then w.crystal
            when w.crystal is null or x.allow_dials_precedence then x.crystal else w.crystal end,
          display_caseback = case when x.display_caseback is null then w.display_caseback
            when w.display_caseback is null or x.allow_dials_precedence then x.display_caseback else w.display_caseback end,
          case_shape = case when x.case_shape is null then w.case_shape
            when w.case_shape is null or x.allow_dials_precedence then x.case_shape else w.case_shape end,
          case_material = case when x.case_material is null then w.case_material
            when w.case_material is null or x.allow_dials_precedence then x.case_material else w.case_material end,
          strap_material = case when x.strap_material is null then w.strap_material
            when w.strap_material is null or x.allow_dials_precedence then x.strap_material else w.strap_material end,
          styles = array(select distinct unnest(w.styles || x.styles)),
          source_kind = case when w.source_kind is null then 'catalogue' else w.source_kind end,
          source_url = case when w.source_kind in ('manufacturer','retailer') then w.source_url else x.source_url end,
          complications = array(select distinct unnest(w.complications || x.complications)),
          source_details = jsonb_set(w.source_details, '{dials}', x.source_details, true),
          found_in = case when exists (
            select 1 from jsonb_array_elements(w.found_in) evidence
            where evidence->>'source'='dials' and evidence->>'sourceRecordId'=x.source_record_id
          ) then w.found_in else w.found_in || jsonb_build_array(x.source_meta) end,
          updated_at = now()
        from x where w.id=x.id`;
    }
    if (write && archives.length) {
      for (let start = 0; start < archives.length; start += 250) {
        const block = archives.slice(start, start + 250);
        await sql`insert into private.watch_catalogue_intake ${sql(block)}
          on conflict(source,snapshot,source_record_id) do update set
            watch_id=excluded.watch_id, payload=excluded.payload, state=excluded.state,
            enrichment=excluded.enrichment, updated_at=now()`;
      }
      stats.intakeArchived += archives.length;
    }
  }

  let processed = 0;
  for await (const row of mirrorRows()) {
    if (processed >= limit) break;
    chunk.push(prepareRow(row));
    processed++;
    if (chunk.length === 250) {
      await flush(chunk);
      chunk = [];
      if (write)
        console.log(
          JSON.stringify({
            ...stats,
            processed: Math.min(stats.intakeArchived, sourceRows),
          }),
        );
    }
  }
  if (chunk.length) await flush(chunk);

  const after = write
    ? await sql`
      select count(*)::int as total,
        count(*) filter(where import_source='dials')::int as dials_rows,
        count(*) filter(where import_source='dials' and reference_confirmed)::int as dials_reference_confirmed,
        count(*) filter(where import_source='dials' and image_url is not null)::int as dials_with_image,
        count(*) filter(where import_source='dials' and price_amount is not null and price_status <> 'unconfirmed')::int as dials_priced,
        count(*) filter(where source_details ? 'dials')::int as dials_specification_rows,
        count(*) filter(where source_details ? 'dials' and reference_confirmed)::int as dials_reference_rows,
        count(*) filter(where source_details ? 'dials' and reference_confirmed and price_amount is not null and price_status <> 'unconfirmed' and case_diameter_mm is not null and movement is not null and cardinality(styles)>0)::int as dials_base_quiz_eligible,
        count(*) filter(where source_details ? 'dials' and (price_amount is null or price_status='unconfirmed'))::int as dials_missing_usable_price
      from private.watch_catalogue`
    : [];
  const report = {
    at: new Date().toISOString(),
    mode: write ? "write" : "dry_run",
    snapshot: manifest.snapshot,
    declaredModels: manifest.total,
    mirroredValidModels: sourceRows,
    uniqueExactReferences: [...exactReferenceCounts.values()].filter(
      (count) => count === 1,
    ).length,
    ambiguousSourceIdentities: [...counts.values()].filter((count) => count > 1)
      .length,
    ...stats,
    databaseAfterImport: after[0] ?? null,
    policy:
      "Exact source identity only. Dials reference data may resolve catalogue-level conflicts, but manufacturer/authorised-retailer facts are preserved. Full source JSON and conflicts remain in private intake. No Dials photos or seller prices are imported; missing prices remain ineligible for budget-filtered recommendations.",
  };
  await writeFile(
    "docs/reports/dials-catalogue-import.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
