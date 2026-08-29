import { z } from "zod";

export const KNOWLEDGE_BASE_SCHEMA_VERSION = 1 as const;

export const KNOWLEDGE_PRICE_TIERS = [
  "under_300",
  "300_500",
  "500_1k",
  "1k_2k",
  "2k_5k",
  "5k_10k",
  "10k_15k",
  "15k_plus",
] as const;

export const KNOWLEDGE_MARKET_MOMENTA = [
  "evergreen",
  "macro_trend",
  "insider_hype",
  "speculative_bubble",
  "contrarian",
] as const;

export const KNOWLEDGE_PRODUCTION_STATUSES = [
  "active",
  "vintage_only",
  "nos_stock",
  "waitlist",
  "revived",
] as const;

export const KNOWLEDGE_CONFIDENCE_LEVELS = [
  "observed",
  "estimated_class",
  "missing",
] as const;

export const knowledgeVectorTagsSchema = z
  .object({
    brand: z.string().min(1),
    ownership_type: z.string().min(1),
    lineage_continuity: z.string().min(1),
    movement_origin: z.string().min(1),
    price_tiers: z.array(z.enum(KNOWLEDGE_PRICE_TIERS)),
    target_wrist_circumference: z.array(z.string().min(1)),
    aesthetic_dna: z.array(
      z.enum([
        "structural_tool",
        "mid_century",
        "integrated_geometry",
        "extravagant_creative",
        "high_art",
      ]),
    ),
    social_signals: z.array(
      z.enum([
        "discreet_competence",
        "quiet_continuity",
        "unapologetic_success",
        "anti_luxury",
      ]),
    ),
    maintenance_profile: z.enum(["zero_maintenance", "workhorse", "in_house"]),
    market_momentum: z.array(z.enum(KNOWLEDGE_MARKET_MOMENTA)),
    hype_risk: z.enum(["low", "medium", "high"]),
    liquidity: z.enum(["low", "medium", "high"]),
    buyer_layers: z.array(z.number().int().min(1).max(5)),
    archetypes: z.array(z.string().min(1)),
    data_confidence: z
      .object({
        dimensions: z.enum(KNOWLEDGE_CONFIDENCE_LEVELS),
        market_data: z.enum(KNOWLEDGE_CONFIDENCE_LEVELS),
        service_data: z.enum(KNOWLEDGE_CONFIDENCE_LEVELS),
        notes: z.string(),
      })
      .strict(),
  })
  .strict();

export const knowledgeDossierSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    brand: z.string().min(1),
    brandRank: z.number().int().min(1),
    sourceFile: z.string().endsWith(".md"),
    sourceSnapshotDate: z.iso.date(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sectionCount: z.literal(7),
    questionnaireCoverage: z.enum(["Q1-Q9", "Q1-Q16"]),
    referenceFamilyCount: z.number().int().nonnegative(),
    sourceUrls: z.array(z.url()),
    tags: knowledgeVectorTagsSchema,
    intakeState: z.literal("owner_reviewed_input"),
    recommendationEligibility: z.literal("research_only"),
  })
  .strict();

export const knowledgeReferenceFamilySchema = z
  .object({
    brand: z.string().min(1),
    brandRank: z.number().int().min(1),
    model: z.string().min(1),
    diameterRaw: z.string(),
    thicknessRaw: z.string(),
    lugToLugRaw: z.string(),
    caliberRaw: z.string(),
    priceTier: z.enum(KNOWLEDGE_PRICE_TIERS),
    marketMomentum: z.enum(KNOWLEDGE_MARKET_MOMENTA),
    dataConfidenceRaw: z.string().min(1),
    productionStatus: z.enum(KNOWLEDGE_PRODUCTION_STATUSES),
    sourceFile: z.string().endsWith(".md"),
    variantSplitRequired: z.boolean(),
    recommendationEligibility: z.literal("research_only"),
  })
  .strict();

export const knowledgeBaseIntakeSchema = z
  .object({
    schemaVersion: z.literal(KNOWLEDGE_BASE_SCHEMA_VERSION),
    sourceSnapshotDate: z.iso.date(),
    generatedAt: z.iso.datetime(),
    recommendationEligibility: z.literal("research_only"),
    dossiers: z.array(knowledgeDossierSchema),
    referenceFamilies: z.array(knowledgeReferenceFamilySchema),
  })
  .strict()
  .superRefine((intake, context) => {
    const slugs = new Set<string>();
    const ranks = new Set<number>();
    const files = new Set<string>();

    intake.dossiers.forEach((dossier, index) => {
      for (const [value, set, path] of [
        [dossier.slug, slugs, "slug"],
        [dossier.brandRank, ranks, "brandRank"],
        [dossier.sourceFile, files, "sourceFile"],
      ] as const) {
        if (set.has(value as never)) {
          context.addIssue({
            code: "custom",
            path: ["dossiers", index, path],
            message: `Duplicate dossier ${path}: ${String(value)}.`,
          });
        }
        (set as Set<unknown>).add(value);
      }
    });
  });

export type KnowledgeBaseIntake = z.infer<typeof knowledgeBaseIntakeSchema>;
export type KnowledgeDossier = z.infer<typeof knowledgeDossierSchema>;
export type KnowledgeReferenceFamily = z.infer<
  typeof knowledgeReferenceFamilySchema
>;

export function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (quoted) throw new Error("CSV ended inside a quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function extractSourceUrls(markdown: string): string[] {
  const matches = markdown.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;:]$/, "")))].sort();
}

export function requiresVariantSplit(fields: {
  model: string;
  diameterRaw: string;
  thicknessRaw: string;
  lugToLugRaw: string;
}) {
  const combined = Object.values(fields).join(" ");
  return (
    /\s\/\s|\d\/\d|\bразн|\bvarious\b/i.test(combined) ||
    /\d(?:[.,]\d+)?\s*[–-]\s*\d/.test(combined)
  );
}
