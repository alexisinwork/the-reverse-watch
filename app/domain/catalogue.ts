import { z } from "zod";

import type { ACCURACY_TOLERANCES } from "./questionnaire";
import {
  ACQUISITION_CHANNELS,
  AESTHETIC_DNA,
  CONDITIONS,
  CURRENCIES,
  DEPLOYMENT_ENVIRONMENTS,
  EMOTIONAL_OBJECTIVES,
  OWNERSHIP_FRICTION_LEVELS,
  SOCIAL_SIGNALS,
} from "./questionnaire";

const nullablePositiveNumber = z.number().positive().nullable();
const nullableNonNegativeNumber = z.number().nonnegative().nullable();

export const catalogueSourceSchema = z
  .object({
    id: z.string().min(1),
    url: z.url(),
    title: z.string().min(1),
    publisher: z.string().min(1),
    sourceType: z.enum([
      "manufacturer_product",
      "manufacturer_manual",
      "manufacturer_data_sheet",
      "central_bank",
      "secondary_editorial",
    ]),
    retrievedAt: z.iso.datetime(),
  })
  .strict();

export const seedReferenceVariantSchema = z
  .object({
    id: z.string().min(1),
    brand: z
      .object({
        slug: z.string().min(1),
        name: z.string().min(1),
        serviceCountries: z.array(z.string().length(2)).nullable(),
      })
      .strict(),
    collection: z.string().min(1),
    model: z.string().min(1),
    referenceCode: z.string().min(1),
    variantName: z.string().min(1),
    productUrl: z.url(),
    price: z
      .object({
        amountMinor: z.number().int().nonnegative(),
        currency: z.enum(CURRENCIES),
        marketCountry: z.string().length(2),
        observedAt: z.iso.datetime(),
        staleAfter: z.iso.datetime(),
        availability: z.enum([
          "in_stock",
          "short_wait",
          "waitlist_or_allocation",
          "unavailable",
          "unknown",
        ]),
        availabilityObservedAt: z.iso.datetime().nullable(),
        availabilityStaleAfter: z.iso.datetime().nullable(),
        channels: z.array(z.enum(ACQUISITION_CHANNELS)).min(1),
        conditions: z.array(z.enum(CONDITIONS)).min(1),
      })
      .strict(),
    materials: z
      .object({
        case: z.string().min(1).nullable(),
        caseback: z.string().min(1).nullable(),
        bracelet: z.string().min(1).nullable(),
        strap: z.string().min(1).nullable(),
      })
      .strict(),
    productionStatus: z.enum(["announced", "current", "discontinued"]),
    geometry: z
      .object({
        caseDiameterMm: nullablePositiveNumber,
        caseWidthMm: nullablePositiveNumber.default(null),
        caseLengthMm: nullablePositiveNumber.default(null),
        caseThicknessMm: nullablePositiveNumber,
        lugToLugMm: nullablePositiveNumber,
        lugWidthMm: nullablePositiveNumber,
        weightFullG: nullablePositiveNumber,
        lugCurvature: z.enum(["flat", "moderate", "steep"]).nullable(),
        integratedBracelet: z.boolean().nullable(),
      })
      .strict()
      .superRefine((geometry, context) => {
        const rectangularDimensions = [
          geometry.caseWidthMm,
          geometry.caseLengthMm,
        ];
        const rectangularParts = rectangularDimensions.filter(
          (dimension) => dimension !== null,
        ).length;
        if (rectangularParts === 1) {
          context.addIssue({
            code: "custom",
            message:
              "Case width and length must be supplied together for non-round geometry.",
          });
        }
        if (geometry.caseDiameterMm === null && rectangularParts !== 2) {
          context.addIssue({
            code: "custom",
            message:
              "Geometry needs either a case diameter or a complete width/length pair.",
          });
        }
      }),
    movement: z
      .object({
        type: z.enum([
          "automatic",
          "manual",
          "quartz",
          "solar",
          "spring_drive",
          "hybrid",
        ]),
        caliber: z.string().min(1).nullable(),
        powerReserveHours: nullablePositiveNumber,
        accuracyLowerSeconds: z.number().nullable(),
        accuracyUpperSeconds: z.number().nullable(),
        accuracyPeriodDays: nullablePositiveNumber,
      })
      .strict()
      .superRefine((movement, context) => {
        const accuracyParts = [
          movement.accuracyLowerSeconds,
          movement.accuracyUpperSeconds,
          movement.accuracyPeriodDays,
        ];
        const supplied = accuracyParts.filter((part) => part !== null).length;
        if (supplied !== 0 && supplied !== accuracyParts.length) {
          context.addIssue({
            code: "custom",
            message: "Accuracy bounds and period must be supplied together.",
          });
        }
        if (
          movement.accuracyLowerSeconds !== null &&
          movement.accuracyUpperSeconds !== null &&
          movement.accuracyUpperSeconds < movement.accuracyLowerSeconds
        ) {
          context.addIssue({
            code: "custom",
            message: "Accuracy upper bound cannot be below the lower bound.",
          });
        }
      }),
    operation: z
      .object({
        waterResistanceM: nullableNonNegativeNumber,
        crownType: z.enum(["screw_down", "push_pull"]).nullable(),
        crownPosition: z.enum(["3", "4", "9_destro", "other"]).nullable(),
        crystal: z.enum(["sapphire", "mineral", "acrylic", "other"]).nullable(),
        lumeGrade: z.enum(["none", "weak", "moderate", "strong"]).nullable(),
        attachmentType: z
          .enum(["spring_bar", "quick_release", "proprietary", "integrated"])
          .nullable(),
        shockResistant: z.boolean().nullable(),
        nickelContactRisk: z
          .enum(["none_known", "possible", "confirmed"])
          .nullable(),
      })
      .strict(),
    complications: z.array(
      z.enum([
        "gmt",
        "chronograph",
        "moonphase",
        "power_reserve",
        "alarm",
        "world_time",
        "perpetual_calendar",
      ]),
    ),
    dateStatus: z.enum(["present", "absent"]),
    eligibleEnvironments: z.array(z.enum(DEPLOYMENT_ENVIRONMENTS)).min(1),
    ownershipFrictionLevels: z.array(z.enum(OWNERSHIP_FRICTION_LEVELS)).min(1),
    traits: z
      .object({
        primaryArchetype: z.string().min(1),
        socialSignals: z.array(z.enum(SOCIAL_SIGNALS)),
        aestheticDna: z.array(z.enum(AESTHETIC_DNA)),
        emotionalObjectives: z.array(z.enum(EMOTIONAL_OBJECTIVES)),
      })
      .strict(),
    market: z
      .object({
        speculativeBubble: z.boolean().nullable(),
        hypeRisk: z.enum(["low", "medium", "high"]).nullable(),
        secondaryRatioLow: z.number().nonnegative().nullable(),
        secondaryRatioHigh: z.number().nonnegative().nullable(),
      })
      .strict(),
    evidence: z
      .array(
        z
          .object({
            sourceId: z.string().min(1),
            fields: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const seedCatalogueSchema = z
  .object({
    catalogueVersion: z.number().int().positive(),
    sources: z.array(catalogueSourceSchema).min(1),
    fx: z
      .object({
        baseCurrency: z.literal("EUR"),
        observedAt: z.iso.datetime(),
        staleAfter: z.iso.datetime(),
        sourceId: z.string().min(1),
        rates: z.object({
          EUR: z.literal(1),
          USD: z.number().positive(),
          GBP: z.number().positive(),
          CHF: z.number().positive(),
          PLN: z.number().positive(),
        }),
      })
      .strict(),
    variants: z.array(seedReferenceVariantSchema).min(1),
  })
  .strict()
  .superRefine((catalogue, context) => {
    const sourceIds = new Set(catalogue.sources.map((source) => source.id));
    if (sourceIds.size !== catalogue.sources.length) {
      context.addIssue({
        code: "custom",
        message: "Source IDs must be unique.",
      });
    }
    if (!sourceIds.has(catalogue.fx.sourceId)) {
      context.addIssue({
        code: "custom",
        path: ["fx", "sourceId"],
        message: "FX source must exist in the source registry.",
      });
    }

    const variantIds = new Set<string>();
    catalogue.variants.forEach((variant, variantIndex) => {
      if (variantIds.has(variant.id)) {
        context.addIssue({
          code: "custom",
          path: ["variants", variantIndex, "id"],
          message: "Reference-variant IDs must be unique.",
        });
      }
      variantIds.add(variant.id);
      for (const evidence of variant.evidence) {
        if (!sourceIds.has(evidence.sourceId)) {
          context.addIssue({
            code: "custom",
            path: ["variants", variantIndex, "evidence"],
            message: `Unknown evidence source: ${evidence.sourceId}`,
          });
        }
      }
    });
  });

export type SeedCatalogue = z.infer<typeof seedCatalogueSchema>;
export type SeedReferenceVariant = z.infer<typeof seedReferenceVariantSchema>;
export type EvidenceField =
  | "identity"
  | "price"
  | "availability"
  | "materials"
  | "productionStatus"
  | "caseDiameterMm"
  | "caseWidthMm"
  | "caseLengthMm"
  | "caseThicknessMm"
  | "lugToLugMm"
  | "lugWidthMm"
  | "lugCurvature"
  | "weightFullG"
  | "movement"
  | "accuracy"
  | "waterResistanceM"
  | "crownType"
  | "crownPosition"
  | "crystal"
  | "lumeGrade"
  | "attachmentType"
  | "shockResistant"
  | "nickelContactRisk"
  | "complications"
  | "dateStatus"
  | "eligibleEnvironments"
  | "ownershipFrictionLevels"
  | "serviceCountries"
  | "traits"
  | "market";

export function evidenceFields(variant: SeedReferenceVariant) {
  return new Set(variant.evidence.flatMap((entry) => entry.fields));
}

export function hasVerifiedField(
  variant: SeedReferenceVariant,
  field: EvidenceField,
) {
  return evidenceFields(variant).has(field);
}

export function verifiedCaseWearingSpanMm(variant: SeedReferenceVariant) {
  if (
    variant.geometry.lugToLugMm !== null &&
    hasVerifiedField(variant, "lugToLugMm")
  ) {
    return variant.geometry.lugToLugMm;
  }
  if (
    variant.geometry.caseLengthMm !== null &&
    hasVerifiedField(variant, "caseLengthMm")
  ) {
    return variant.geometry.caseLengthMm;
  }
  return null;
}

export function sourceIdsForField(
  variant: SeedReferenceVariant,
  field: EvidenceField,
) {
  return variant.evidence
    .filter((entry) => entry.fields.includes(field))
    .map((entry) => entry.sourceId);
}

export function convertMinorCurrency(
  amountMinor: number,
  from: (typeof CURRENCIES)[number],
  to: (typeof CURRENCIES)[number],
  fx: SeedCatalogue["fx"],
) {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("A monetary amount must be non-negative minor units.");
  }
  const amountInEuro = amountMinor / fx.rates[from];
  return Math.round(amountInEuro * fx.rates[to]);
}

export function supportedAccuracyTolerances(
  movement: SeedReferenceVariant["movement"],
) {
  const supported: (typeof ACCURACY_TOLERANCES)[number][] = ["no_requirement"];
  if (
    movement.accuracyLowerSeconds === null ||
    movement.accuracyUpperSeconds === null ||
    movement.accuracyPeriodDays === null
  ) {
    return supported;
  }

  const lowerPerDay =
    movement.accuracyLowerSeconds / movement.accuracyPeriodDays;
  const upperPerDay =
    movement.accuracyUpperSeconds / movement.accuracyPeriodDays;
  const absolutePerDay = Math.max(Math.abs(lowerPerDay), Math.abs(upperPerDay));
  if (absolutePerDay <= 1) supported.unshift("seconds_per_month");
  if (lowerPerDay >= -5 && upperPerDay <= 5) {
    supported.push("within_5_seconds_per_day");
  }
  if (lowerPerDay >= -15 && upperPerDay <= 15) {
    supported.push("within_15_seconds_per_day");
  }
  return [...new Set(supported)];
}
