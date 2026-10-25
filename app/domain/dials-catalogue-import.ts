import { z } from "zod";

import { catalogueIdentityKey } from "./watch-catalogue";

const stringList = z.array(z.string()).optional().default([]);
const complicationList = z
  .array(
    z.union([
      z.string(),
      z.object({ name: z.string().optional() }).passthrough(),
    ]),
  )
  .optional()
  .default([]);
const complicationNames = (values: Array<string | { name?: string }>) =>
  values
    .map((value) => (typeof value === "string" ? value : (value.name ?? "")))
    .filter(Boolean);
export const dialsModelSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    referenceNumber: z.string().nullable().optional(),
    slug: z.string(),
    brand: z.object({ name: z.string().min(1), slug: z.string() }),
    series: z
      .object({ name: z.string(), slug: z.string() })
      .nullable()
      .optional(),
    diameter: z.number().nullable().optional(),
    thickness: z.number().nullable().optional(),
    waterResistance: z.number().nullable().optional(),
    shape: z.string().nullable().optional(),
    lugWidth: z.number().nullable().optional(),
    releaseYear: z.number().nullable().optional(),
    discontinuationYear: z.number().nullable().optional(),
    limitedAmount: z.number().nullable().optional(),
    caseMaterials: stringList,
    bezel: z.string().nullable().optional(),
    bezelMaterials: stringList,
    bezelColors: stringList,
    coating: z.string().nullable().optional(),
    dialNickname: z.string().nullable().optional(),
    dialFinish: z.string().nullable().optional(),
    dialColors: stringList,
    dialMaterials: stringList,
    indexes: z.string().nullable().optional(),
    hands: z.string().nullable().optional(),
    bandNickname: z.string().nullable().optional(),
    bandColors: stringList,
    glass: z.string().nullable().optional(),
    back: z.string().nullable().optional(),
    bandMaterials: stringList,
    bandClasp: z.string().nullable().optional(),
    bandWidth: z.number().nullable().optional(),
    caliber: z
      .object({
        name: z.string().nullable().optional(),
        reference: z.string().nullable().optional(),
        movement: z.string().nullable().optional(),
        numberOfJewels: z.number().nullable().optional(),
        powerReserve: z.number().nullable().optional(),
        frequency: z.number().nullable().optional(),
        complications: complicationList,
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export type DialsModel = z.infer<typeof dialsModelSchema>;

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

export function dialsIdentityKey(model: DialsModel) {
  return catalogueIdentityKey(
    model.brand.name,
    model.name,
    model.referenceNumber ?? null,
  );
}

export function dialsReferenceKey(model: DialsModel) {
  return model.referenceNumber
    ? `${fold(model.brand.name)}|${fold(model.referenceNumber)}`
    : `${fold(model.brand.name)}|model:${fold(model.name)}`;
}

export function dialsMovement(value: string | null | undefined) {
  const normalized = fold(value ?? "");
  if (/automatic|selfwinding|perpetual/.test(normalized)) return "automatic";
  if (/handwound|manual|handwind/.test(normalized)) return "manual";
  if (/hybrid|meca.?quartz|mecha.?quartz/.test(normalized)) return "hybrid";
  if (/quartz/.test(normalized)) return "quartz";
  if (/solar|solarpowered|eco.?drive|kinetic/.test(normalized)) return "solar";
  if (/springdrive/.test(normalized)) return "spring_drive";
  return null;
}

/** Assigns only strong literal style cues; all imported rows remain pending. */
export function dialsStyles(model: DialsModel) {
  const text = fold(
    [model.name, model.series?.name, model.description]
      .filter((part): part is string => typeof part === "string")
      .join(" "),
  );
  const complications = complicationNames(
    model.caliber?.complications ?? [],
  ).map(fold);
  const styles = new Set<string>();
  if (
    /diver|diving|dive|submariner/.test(text) &&
    (model.waterResistance ?? 0) >= 100
  )
    styles.add("dive");
  if (/gmt|worldtime|worldtimer|dualtime|timezone/.test(text))
    styles.add("travel");
  if (
    /chronograph|racing|motorsport|tachymeter|regatta/.test(text) ||
    complications.includes("chronograph")
  )
    styles.add("sport");
  if (/fieldwatch|militarywatch/.test(text)) styles.add("field");
  if (/dresswatch|formal|classique|elegance/.test(text)) styles.add("dress");
  return ["dress", "everyday", "sport", "dive", "field", "travel"].filter(
    (style) => styles.has(style),
  );
}

function uniqueJoin(values: string[] | undefined) {
  const unique = [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
  return unique.length ? unique.join("; ") : null;
}

export function dialsFacts(model: DialsModel) {
  return {
    caseDiameterMm: model.diameter ?? null,
    caseThicknessMm: model.thickness ?? null,
    waterResistanceM: model.waterResistance ?? null,
    movement: dialsMovement(model.caliber?.movement),
    caseMaterial: uniqueJoin(model.caseMaterials),
    strapMaterial: uniqueJoin(model.bandMaterials),
    caseShape: model.shape ?? null,
    crystal: model.glass ?? null,
    displayCaseback: model.back
      ? /open|exhibition|sapphire/i.test(model.back)
      : null,
    complications: complicationNames(model.caliber?.complications ?? []),
  };
}

/** Human-readable structured details; image URLs and long descriptions stay out. */
export function dialsSupplementalDetails(model: DialsModel) {
  const details: Record<string, string | number> = {};
  const add = (label: string, value: unknown) => {
    if (typeof value === "string" && value.trim())
      details[label] = value.trim();
    else if (typeof value === "number" && Number.isFinite(value))
      details[label] = value;
    else if (Array.isArray(value)) {
      const items = value.filter(
        (item): item is string => typeof item === "string" && !!item.trim(),
      );
      if (items.length) details[label] = [...new Set(items)].join(", ");
    }
  };
  add("Series", model.series?.name);
  add("Introduced", model.releaseYear);
  add("Discontinued", model.discontinuationYear);
  add("Limited production", model.limitedAmount);
  add("Case diameter (mm)", model.diameter);
  add("Case thickness (mm)", model.thickness);
  add("Lug width (mm)", model.lugWidth);
  add("Case shape", model.shape);
  add("Case materials", model.caseMaterials);
  add("Case coating", model.coating);
  add("Bezel", model.bezel);
  add("Bezel materials", model.bezelMaterials);
  add("Bezel colors", model.bezelColors);
  add("Crystal", model.glass);
  add("Caseback", model.back);
  add("Dial", model.dialNickname);
  add("Dial finish", model.dialFinish);
  add("Dial colors", model.dialColors);
  add("Dial materials", model.dialMaterials);
  add("Indexes", model.indexes);
  add("Hands", model.hands);
  add("Bracelet", model.bandNickname);
  add("Bracelet materials", model.bandMaterials);
  add("Bracelet colors", model.bandColors);
  add("Bracelet clasp", model.bandClasp);
  add("Bracelet width (mm)", model.bandWidth);
  add("Calibre", model.caliber?.name);
  add("Calibre reference", model.caliber?.reference);
  add("Movement", model.caliber?.movement);
  add("Jewels", model.caliber?.numberOfJewels);
  add("Power reserve (hours)", model.caliber?.powerReserve);
  add("Frequency (vibrations/hour)", model.caliber?.frequency);
  add("Complications", complicationNames(model.caliber?.complications ?? []));
  return details;
}
