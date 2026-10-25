import { z } from "zod";

export const sourceBrandSchema = z.object({
  brand_slug: z.string(),
  collections: z.array(
    z.object({
      references: z.array(
        z.object({
          slug: z.string(),
          url: z.string(),
          title: z.string().optional(),
          specs: z.record(z.string(), z.string()).default({}),
        }),
      ),
    }),
  ),
});

export function splitReference(raw: string | null) {
  const match = raw?.match(/^(.+?)\s*\(aka:\s*([^()]+)\)\s*$/i);
  return {
    reference: (match?.[1] ?? raw)?.trim() || null,
    aliases:
      match?.[2]
        ?.split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean) ?? [],
  };
}

// Preserve suffixes, punctuation and configuration identifiers for exact matching.
export const identity = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();
const loose = (value: string) => identity(value).replace(/[.\s]/g, "");
export function dimension(raw: string | undefined, unit: "mm" | "m") {
  if (!raw) return null;
  const match = raw
    .trim()
    .match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${unit}$`, "i"));
  return match ? Number(match[1]) : null;
}

export function normalizeBrand(
  input: z.infer<typeof sourceBrandSchema>,
  snapshot: string,
) {
  return input.collections.flatMap((collection, ci) =>
    collection.references.map((watch, ri) => {
      const { reference, aliases } = splitReference(
        watch.specs.Reference ?? null,
      );
      const pointer = `/collections/${ci}/references/${ri}`;
      const fields = {
        brand: watch.specs.Brand?.trim() || null,
        model: watch.specs.Name?.trim() || null,
        collection: watch.specs.Family?.trim() || null,
        caseDiameterMm: dimension(watch.specs.Diameter, "mm"),
        caseThicknessMm: dimension(watch.specs.Height, "mm"),
        waterResistanceM: dimension(watch.specs["W/R"], "m"),
        movementDescription: watch.specs.Movement?.trim() || null,
        caseMaterial: watch.specs.Material?.trim() || null,
        crystal: watch.specs.Glass?.trim() || null,
      };
      return {
        sourceRecordId: `${input.brand_slug}:${watch.slug}:${ci}:${ri}`,
        snapshot,
        sourceFile: `catalog/${input.brand_slug}_full.json`,
        pointer,
        sourcePage: watch.url,
        referenceRaw: watch.specs.Reference ?? null,
        reference,
        aliases,
        ...fields,
        eligibility: "research_only" as const,
        referenceConfirmed: false,
        // Evidence stays source-declared, not manufacturer-verified or independently corroborated.
        evidence: Object.entries(watch.specs).map(([field, value]) => ({
          field,
          value,
          pointer: `${pointer}/specs/${field.replace(/~/g, "~0").replace(/\//g, "~1")}`,
          status: "source_declared" as const,
        })),
      };
    }),
  );
}

export type IntakeWatch = ReturnType<typeof normalizeBrand>[number];
export type ExistingWatch = {
  id: string;
  brand: string;
  referenceCode: string | null;
  caseDiameterMm: number | null;
  caseThicknessMm: number | null;
  waterResistanceM: number | null;
  reviewStatus: string;
};
export function compareIntake(
  records: IntakeWatch[],
  existing: ExistingWatch[],
) {
  const keys = new Map<string, number>();
  for (const row of records) {
    if (row.brand && row.reference) {
      const key = `${identity(row.brand)}|${identity(row.reference)}`;
      keys.set(key, (keys.get(key) ?? 0) + 1);
    }
  }
  return records.map((row) => {
    const brandRows = row.brand
      ? existing.filter((w) => identity(w.brand) === identity(row.brand!))
      : [];
    const exact = row.reference
      ? brandRows.filter(
          (w) =>
            w.referenceCode &&
            identity(w.referenceCode) === identity(row.reference!),
        )
      : [];
    const candidates = exact.length
      ? exact
      : brandRows.filter(
          (w) =>
            w.referenceCode &&
            ((row.reference &&
              loose(w.referenceCode) === loose(row.reference)) ||
              row.aliases.some(
                (alias) => loose(alias) === loose(w.referenceCode!),
              )),
        );
    const conflicts = exact.flatMap((w) =>
      (
        ["caseDiameterMm", "caseThicknessMm", "waterResistanceM"] as const
      ).flatMap((field) =>
        row[field] !== null &&
        w[field] !== null &&
        Math.abs(row[field] - w[field]) > 0.01
          ? [
              {
                existingId: w.id,
                field,
                incoming: row[field],
                existing: w[field],
              },
            ]
          : [],
      ),
    );
    const duplicateSourceIdentity = !!(
      row.brand &&
      row.reference &&
      (keys.get(`${identity(row.brand)}|${identity(row.reference)}`) ?? 0) > 1
    );
    const status =
      !row.reference || !row.brand
        ? "missing_identity"
        : conflicts.length
          ? "conflict"
          : duplicateSourceIdentity || exact.length > 1
            ? "ambiguous"
            : exact.length === 1
              ? "exact_candidate"
              : candidates.length
                ? "alias_or_format_candidate"
                : "new_candidate";
    return {
      sourceRecordId: row.sourceRecordId,
      brand: row.brand,
      reference: row.reference,
      status,
      duplicateSourceIdentity,
      existingIds: candidates.map((w) => w.id),
      conflicts,
    };
  });
}
