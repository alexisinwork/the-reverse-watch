import { z } from "zod";
import type { FoundWatch } from "./ai-watch-types";
import { safeHttpUrl } from "./source-pages.server";
import {
  parseObservedPrice,
  quoteSupportsObservedPrice,
} from "./validated-price";
import {
  normalizeReference,
  pageMentionsReference,
} from "./ai-watch-guardrails";
import { validationCharges } from "./validation-budget.server";
import { quoteSupportsValue } from "./catalogue-enrichment.server";
import {
  clearCatalogueCache,
  rpc,
  type CatalogueClient,
} from "./watch-catalogue.server";

function independentSources(sources: { sourceUrl: string }[]) {
  const hosts = sources.map((source) => {
    const url = safeHttpUrl(source.sourceUrl);
    return url
      ? new URL(url).hostname.toLowerCase().replace(/^www\./, "")
      : null;
  });
  return hosts.length === 2 && hosts.every(Boolean) && hosts[0] !== hosts[1];
}

function quoteHas(quote: string, value: string) {
  const words = (input: string) =>
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return ` ${words(quote)} `.includes(` ${words(value)} `);
}

const evidenceSchema = z.object({
  provider: z.enum(["perplexity", "muse"]),
  sourceUrl: z.string().url(),
  checkedAt: z.string().datetime({ offset: true }),
  citedUrls: z.array(z.string().url()).max(5).optional(),
  sourceQuote: z.string().max(280).optional(),
  person: z.string().max(160).nullable().optional(),
  work: z.string().max(200).nullable().optional(),
});
const factSchema = z.object({
  field: z.enum(["caseDiameterMm", "waterResistanceM", "movementType"]),
  value: z.union([z.string().max(100), z.number().finite()]),
  sources: z
    .array(
      z.object({
        provider: z.enum(["perplexity", "muse"]),
        sourceUrl: z.string().url(),
        citedUrl: z.string().url().optional(),
        quote: z.string().min(1).max(280),
        checkedAt: z.string().datetime({ offset: true }),
      }),
    )
    .length(2),
});
const priceObservationSchema = z.object({
  value: z.string().max(100),
  sources: z
    .array(
      z.object({
        provider: z.enum(["perplexity", "muse"]),
        sourceUrl: z.string().url(),
        citedUrl: z.string().url().optional(),
        quote: z.string().min(1).max(280),
        checkedAt: z.string().datetime({ offset: true }),
        value: z.string().max(100),
      }),
    )
    .length(2),
});
const watchSchema = z
  .object({
    brand: z.string().min(1),
    model: z.string().min(1),
    referenceCode: z.string().min(1),
    sourceUrl: z.string(),
    imageUrl: z.string().nullable(),
    priceNote: z.string().nullable(),
    rationale: z.string(),
    details: z
      .object({
        validationEvidence: z.array(evidenceSchema).length(2),
        validationFacts: z.array(factSchema).max(3).optional(),
        imageEvidence: z
          .object({
            sourceUrl: z.string().url(),
            imageUrl: z.string().url(),
            referenceCode: z.string().min(1),
            checkedAt: z.string().datetime({ offset: true }),
            citedUrl: z.string().url().optional(),
            provider: z.enum(["perplexity", "muse"]).optional(),
          })
          .optional(),
        priceObservation: priceObservationSchema.optional(),
        price: z
          .object({ amount: z.number().positive(), currency: z.string() })
          .nullable()
          .optional(),
        priceConfirmed: z.boolean().optional(),
      })
      .passthrough(),
  })
  .superRefine((watch, context) => {
    const evidenceProviders = new Set(
      watch.details.validationEvidence.map((evidence) => evidence.provider),
    );
    if (
      evidenceProviders.size !== 2 ||
      !independentSources(watch.details.validationEvidence) ||
      !safeHttpUrl(watch.sourceUrl) ||
      !watch.details.validationEvidence.some(
        (evidence) =>
          evidence.provider === "perplexity" &&
          evidence.sourceUrl === watch.sourceUrl,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["details", "validationEvidence"],
        message: "Independent provider evidence and primary source required",
      });
    }
    const image = watch.details.imageEvidence;
    if (
      image &&
      (image.imageUrl !== watch.imageUrl ||
        !safeHttpUrl(image.imageUrl) ||
        !safeHttpUrl(image.sourceUrl) ||
        !normalizeReference(watch.referenceCode) ||
        normalizeReference(image.referenceCode) !==
          normalizeReference(watch.referenceCode) ||
        !watch.details.validationEvidence.some(
          (evidence) =>
            evidence.sourceUrl === image.sourceUrl ||
            (image.provider === evidence.provider &&
              !!image.citedUrl &&
              !!safeHttpUrl(image.citedUrl) &&
              evidence.citedUrls?.includes(image.citedUrl) === true),
        ))
    ) {
      context.addIssue({
        code: "custom",
        path: ["details", "imageEvidence"],
        message: "Invalid image evidence",
      });
    }
    const observation = watch.details.priceObservation;
    if (observation) {
      const price = parseObservedPrice(observation.value);
      const prices = observation.sources.map((source) =>
        parseObservedPrice(source.value),
      );
      const providers = new Set(
        observation.sources.map((source) => source.provider),
      );
      const sourcesMatch = observation.sources.every(
        (source) =>
          safeHttpUrl(source.sourceUrl) &&
          quoteSupportsObservedPrice(source.value, source.quote) &&
          pageMentionsReference(watch.referenceCode, source.quote, "") &&
          watch.details.validationEvidence.some(
            (evidence) =>
              evidence.provider === source.provider &&
              (evidence.sourceUrl === source.sourceUrl ||
                (!!source.citedUrl &&
                  !!safeHttpUrl(source.citedUrl) &&
                  evidence.citedUrls?.includes(source.citedUrl) === true)),
          ),
      );
      if (
        !price ||
        providers.size !== 2 ||
        !independentSources(observation.sources) ||
        !sourcesMatch ||
        observation.sources.find((source) => source.provider === "perplexity")
          ?.value !== observation.value ||
        prices.some((other) => !other) ||
        watch.details.price?.amount !== price.amount ||
        watch.details.price?.currency !== price.currency ||
        watch.details.priceConfirmed !== false
      ) {
        context.addIssue({
          code: "custom",
          path: ["details", "priceObservation"],
          message: "Invalid approximate price evidence",
        });
      }
    }
    const seen = new Set<string>();
    for (const [index, fact] of (
      watch.details.validationFacts ?? []
    ).entries()) {
      const key = fact.field === "movementType" ? "movement" : fact.field;
      const matches = fact.sources.every(
        (source) =>
          !!safeHttpUrl(source.sourceUrl) &&
          pageMentionsReference(watch.referenceCode, source.quote, "") &&
          quoteSupportsValue({
            field: fact.field,
            value: fact.value,
            quote: source.quote,
            sourceUrl: source.sourceUrl,
          }) &&
          watch.details.validationEvidence.some(
            (evidence) =>
              evidence.provider === source.provider &&
              (evidence.sourceUrl === source.sourceUrl ||
                (!!source.citedUrl &&
                  !!safeHttpUrl(source.citedUrl) &&
                  evidence.citedUrls?.includes(source.citedUrl) === true)),
          ),
      );
      const providers = new Set(fact.sources.map((source) => source.provider));
      if (
        seen.has(fact.field) ||
        providers.size !== 2 ||
        !independentSources(fact.sources) ||
        !matches ||
        watch.details[key] !== fact.value
      ) {
        context.addIssue({
          code: "custom",
          path: ["details", "validationFacts", index],
          message: "Invalid field evidence",
        });
      }
      seen.add(fact.field);
    }
    const person = watch.details.person;
    const work = watch.details.work;
    if (typeof person !== "string" && typeof work !== "string") return;
    for (const [
      index,
      evidence,
    ] of watch.details.validationEvidence.entries()) {
      if (
        !evidence.sourceQuote?.trim() ||
        !quoteHas(evidence.sourceQuote, watch.brand) ||
        !pageMentionsReference(watch.referenceCode, evidence.sourceQuote, "") ||
        (typeof person === "string" &&
          !quoteHas(evidence.sourceQuote, person)) ||
        (typeof work === "string" && !quoteHas(evidence.sourceQuote, work)) ||
        (typeof person === "string" && evidence.person !== person) ||
        (typeof work === "string" && evidence.work !== work)
      ) {
        context.addIssue({
          code: "custom",
          path: ["details", "validationEvidence", index],
          message:
            "Sighting evidence must retain its checked passage and subject",
        });
      }
    }
  });
const snapshotSchema = z
  .object({
    validationStatus: z.literal("valid"),
    summary: z.string().min(1),
    watches: z.array(watchSchema).min(1).max(8),
    validatedAt: z.string(),
    policyVersion: z.literal("source-v1"),
  })
  .nullable();

export async function loadValidatedSnapshot(
  client: CatalogueClient,
  cacheKey: string,
) {
  if (!/^[0-9a-f]{64}$/.test(cacheKey)) throw new Error("Invalid cache key");
  const snapshot = snapshotSchema.parse(
    await rpc(client, "ai_watch_validated_cache_get_v2", {
      p_cache_key: cacheKey,
    }),
  );
  if (!snapshot) return null;
  if (
    snapshot.watches.some(
      (watch) =>
        !safeHttpUrl(watch.sourceUrl) ||
        watch.details.validationEvidence.some(
          (evidence) =>
            !safeHttpUrl(evidence.sourceUrl) ||
            evidence.citedUrls?.some((url) => !safeHttpUrl(url)),
        ) ||
        watch.details.validationFacts?.some((fact) =>
          fact.sources.some((source) => !safeHttpUrl(source.sourceUrl)),
        ),
    )
  )
    throw new Error("Invalid source URL in validated snapshot");
  return {
    ...snapshot,
    watches: snapshot.watches.map((watch) => ({
      ...watch,
      imageUrl: safeHttpUrl(watch.imageUrl),
    })),
  };
}

/** Publish validated evidence and settle the reservation in one DB transaction. */
export async function publishValidatedSnapshot(
  client: CatalogueClient,
  attemptId: string,
  watches: FoundWatch[],
  costs: readonly (number | null)[],
) {
  z.string().uuid().parse(attemptId);
  const parsed = z.array(watchSchema).min(1).max(8).parse(watches);
  const summary = `${parsed.length} ${parsed.length === 1 ? "watch" : "watches"} with checked sources.`;
  const published = z.boolean().parse(
    await rpc(client, "ai_watch_validated_cache_publish_v7", {
      p_attempt_id: attemptId,
      p_summary: summary,
      p_watches: parsed,
      p_costs_usd: validationCharges(costs),
    }),
  );
  if (published) clearCatalogueCache();
  return published;
}
