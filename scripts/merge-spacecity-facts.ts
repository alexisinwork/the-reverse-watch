// Accept only unambiguous factual fields from the owner-approved source.
// Marketplace prices and conflicting variants remain source assertions.
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 5,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
const claim = z.object({
  source_record_id: z.string(),
  watch_id: z.string().uuid(),
  payload: z
    .object({
      brand: z.string(),
      reference: z.string(),
      sourcePage: z.string().url(),
      observed: z
        .object({
          sizes: z.array(z.string()).optional(),
          movements: z.array(z.string()).optional(),
          case_materials: z.array(z.string()).optional(),
          bracelet_materials: z.array(z.string()).optional(),
          year_range: z.array(z.number()).optional(),
        })
        .passthrough(),
    })
    .passthrough(),
});
const normalize = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
function unique<T>(values: T[]) {
  const out = [...new Set(values)];
  return out.length === 1 ? out[0]! : null;
}
try {
  const source = await sql<
    { source_record_id: string; watch_id: string; payload: unknown }[]
  >`select source_record_id,watch_id,payload from private.watch_catalogue_intake where source='spacecity' and watch_id is not null`;
  const facts = source
    .map((r) => claim.parse(r))
    .map((r) => {
      const o = r.payload.observed,
        sizes = (o.sizes ?? [])
          .map((v) => /^\s*(\d+(?:\.\d+)?)\s*mm\s*$/i.exec(v))
          .filter((m): m is RegExpExecArray => !!m)
          .map((m) => Number(m[1]))
          .filter((v) => v >= 15 && v <= 70),
        movements = (o.movements ?? []).map((v) => normalize(v));
      const movementValues = movements
        .map((v) =>
          v.includes("automatic")
            ? "automatic"
            : v.includes("manual") || v.includes("handwind")
              ? "manual"
              : v.includes("quartz")
                ? "quartz"
                : v.includes("solar")
                  ? "solar"
                  : null,
        )
        .filter(
          (v): v is "automatic" | "manual" | "quartz" | "solar" => v !== null,
        );
      const materials = unique(
          (o.case_materials ?? []).map((v) => v.trim()).filter(Boolean),
        ),
        bracelet = unique(
          (o.bracelet_materials ?? []).map((v) => v.trim()).filter(Boolean),
        ),
        diameter = unique(sizes),
        movement = unique(movementValues);
      return {
        id: r.watch_id,
        sourceRecordId: r.source_record_id,
        sourcePage: r.payload.sourcePage,
        brand: r.payload.brand,
        reference: r.payload.reference,
        diameter,
        movement,
        caseMaterial: materials,
        strapMaterial: bracelet,
        fields: [
          ...(diameter !== null ? ["caseDiameterMm"] : []),
          ...(movement !== null ? ["movement"] : []),
          ...(materials !== null ? ["caseMaterial"] : []),
          ...(bracelet !== null ? ["strapMaterial"] : []),
        ],
      };
    });
  let changed = 0;
  for (let n = 0; n < facts.length; n += 100) {
    const batch = facts.slice(n, n + 100);
    const updated = await Promise.all(
      batch.map(
        (r) => sql`update private.watch_catalogue set
      reference_confirmed=true,source_kind=case when reference_confirmed then source_kind else 'catalogue' end,source_url=coalesce(source_url,${r.sourcePage}::text),
      case_diameter_mm=coalesce(case_diameter_mm,${r.diameter}::numeric),movement=coalesce(movement,${r.movement}::text),case_material=coalesce(case_material,${r.caseMaterial}::text),strap_material=coalesce(strap_material,${r.strapMaterial}::text),
      found_in=found_in||jsonb_build_array(jsonb_build_object('source','spacecity','sourceRecordId',${r.sourceRecordId}::text,'url',${r.sourcePage}::text,'license','CC BY 4.0','fields',${sql.json(r.fields)}::jsonb)),updated_at=now()
      where id=${r.id} and not found_in @> jsonb_build_array(jsonb_build_object('sourceRecordId',${r.sourceRecordId}::text)) returning id`,
      ),
    );
    changed += updated.reduce((sum, rows) => sum + rows.length, 0);
  }
  const report = {
    at: new Date().toISOString(),
    spaceCitySourceClaims: source.length,
    exactIdentityClaims: facts.length,
    rowsUpdated: changed,
    fields: {
      diameter: facts.filter((x) => x.diameter !== null).length,
      movement: facts.filter((x) => x.movement !== null).length,
      caseMaterial: facts.filter((x) => x.caseMaterial !== null).length,
      braceletMaterial: facts.filter((x) => x.strapMaterial !== null).length,
    },
    policy:
      "Exact Space City reference identities are marked reference-catalogue verified. Existing non-null facts were preserved. Aggregated historical prices, multi-size groups and model/year claims remain archived evidence only; per-record source and CC BY attribution retained.",
  };
  await writeFile(
    "docs/reports/spacecity-fact-merge.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
