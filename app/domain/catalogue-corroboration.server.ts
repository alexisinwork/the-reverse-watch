import { z } from "zod";
import type { CatalogueWatch } from "./watch-catalogue";

const fold = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
const modelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  referenceNumber: z.string().nullable(),
  brand: z.object({ name: z.string(), slug: z.string() }),
});
const listSchema = z.object({ data: z.array(modelSchema) });
const detailSchema = modelSchema.extend({
  diameter: z.number().nullable().optional(),
  thickness: z.number().nullable().optional(),
  waterResistance: z.number().nullable().optional(),
  shape: z.string().nullable().optional(),
  glass: z.string().nullable().optional(),
  back: z.string().nullable().optional(),
  caseMaterials: z.array(z.string()).optional(),
  caliber: z
    .object({ movement: z.string().nullable().optional() })
    .nullable()
    .optional(),
  series: z.object({ slug: z.string() }).nullable().optional(),
});

/** Dials is a secondary cross-check, not an independent manufacturer certificate.
 * Never use its image CDN (no hotlink permission); never import listing prices. */
export async function checkDialsReference(
  watch: { brand: string; referenceCode: string | null },
  fetchImpl: typeof fetch = fetch,
) {
  if (!watch.referenceCode) return { status: "missing_reference" as const };
  const query = new URL("https://api.dials.co/v1/models");
  query.searchParams.set("q", watch.referenceCode);
  query.searchParams.set("pageSize", "100");
  const response = await fetchImpl(query, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    return { status: "unavailable" as const, httpStatus: response.status };
  const matches = listSchema
    .parse(await response.json())
    .data.filter(
      (row) =>
        fold(row.brand.name) === fold(watch.brand) &&
        row.referenceNumber &&
        fold(row.referenceNumber) === fold(watch.referenceCode!),
    );
  if (matches.length !== 1)
    return {
      status: matches.length ? ("ambiguous" as const) : ("not_found" as const),
    };
  const model = matches[0]!;
  const url = `https://api.dials.co/v1/models/${encodeURIComponent(model.brand.slug)}/${encodeURIComponent(model.slug)}`;
  const detailResponse = await fetchImpl(url, {
    signal: AbortSignal.timeout(12000),
  });
  if (!detailResponse.ok)
    return {
      status: "unavailable" as const,
      httpStatus: detailResponse.status,
    };
  const detail = detailSchema.parse(await detailResponse.json());
  if (
    fold(detail.brand.name) !== fold(watch.brand) ||
    fold(detail.referenceNumber ?? "") !== fold(watch.referenceCode)
  )
    return { status: "identity_mismatch" as const };
  return {
    status: "matched" as const,
    source: "dials" as const,
    sourceUrl: `https://dials.co/watches/${encodeURIComponent(model.brand.slug)}/${encodeURIComponent(detail.series?.slug ?? "")}/${encodeURIComponent(model.slug)}`,
    apiUrl: url,
    checkedAt: new Date().toISOString(),
    facts: {
      caseDiameterMm: detail.diameter ?? null,
      caseThicknessMm: detail.thickness ?? null,
      waterResistanceM: detail.waterResistance ?? null,
      movement: detail.caliber?.movement?.toLowerCase() ?? null,
    },
    identity: { brand: detail.brand.name, reference: detail.referenceNumber },
    rights: "Attribution and model-page link required; no image hotlinking",
    primaryVerified: false,
  };
}

export function compareCatalogueFacts(
  current: Pick<
    CatalogueWatch,
    "caseDiameterMm" | "caseThicknessMm" | "waterResistanceM" | "movement"
  >,
  asserted: Partial<
    Record<
      "caseDiameterMm" | "caseThicknessMm" | "waterResistanceM" | "movement",
      number | string | null
    >
  >,
) {
  const agreements: string[] = [],
    conflicts: {
      field: string;
      cached: number | string;
      asserted: number | string;
    }[] = [],
    unknown: string[] = [];
  for (const field of [
    "caseDiameterMm",
    "caseThicknessMm",
    "waterResistanceM",
    "movement",
  ] as const) {
    const a = current[field],
      b = asserted[field];
    if (a === null || b === null || b === undefined) {
      unknown.push(field);
      continue;
    }
    const agrees =
      typeof a === "number" && typeof b === "number"
        ? Math.abs(a - b) <= 0.01
        : String(a).toLowerCase() === String(b).toLowerCase();
    if (agrees) agreements.push(field);
    else conflicts.push({ field, cached: a, asserted: b });
  }
  return {
    agreements,
    conflicts,
    unknown,
    status: conflicts.length
      ? "conflict"
      : agreements.length
        ? "corroborated_partial"
        : "insufficient_evidence",
  };
}
