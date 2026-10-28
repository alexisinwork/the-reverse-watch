import type { FoundWatch } from "./ai-watch-types";
import {
  validateCachedWatch,
  type ValidationDecision,
  type ValidationEvidence,
} from "./cached-result-validation";
import { inspectCachedResultSource } from "./cached-result-source-check.server";
import { parseObservedPrice } from "./validated-price";

/** Check both cited pages ourselves before reconciling the two assertions.
 * Matching text is necessary evidence, not proof that the page associates the
 * person with that watch; the provider must explicitly assert that relation. */
export async function validateCachedWatchFromSources(
  watch: FoundWatch,
  primary: ValidationEvidence,
  secondary: ValidationEvidence,
  options: { fetchImpl?: typeof fetch; checkedAt?: string } = {},
): Promise<ValidationDecision> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const [first, second] = await Promise.all([
    inspectCachedResultSource(
      watch,
      primary.sourceUrl,
      fetchImpl,
      primary.sourceQuote,
      primary.facts,
    ),
    inspectCachedResultSource(
      watch,
      secondary.sourceUrl,
      fetchImpl,
      secondary.sourceQuote,
      secondary.facts,
    ),
  ]);
  const result = validateCachedWatch(
    watch,
    {
      ...primary,
      sourceVerified: first.status === "matched",
      sourceUrl: first.finalUrl ?? primary.sourceUrl,
    },
    {
      ...secondary,
      sourceVerified: second.status === "matched",
      sourceUrl: second.finalUrl ?? secondary.sourceUrl,
    },
    options.checkedAt ?? new Date().toISOString(),
  );
  if (result.status !== "verified") return result;
  const a = first.checkedFacts ?? [];
  const b = second.checkedFacts ?? [];
  const details = { ...result.watch.details };
  const facts: NonNullable<typeof details.validationFacts> = [];
  for (const field of [
    "caseDiameterMm",
    "waterResistanceM",
    "movementType",
  ] as const) {
    const primaryFacts = a.filter((fact) => fact.field === field);
    const secondaryFacts = b.filter((fact) => fact.field === field);
    if (primaryFacts.length !== 1 || secondaryFacts.length !== 1) continue;
    const firstFact = primaryFacts[0]!;
    const secondFact = secondaryFacts[0]!;
    if (firstFact.value !== secondFact.value) continue;
    let accepted = false;
    if (
      field === "caseDiameterMm" &&
      details.caseDiameterMm == null &&
      typeof firstFact.value === "number" &&
      firstFact.value >= 15 &&
      firstFact.value <= 70
    ) {
      details.caseDiameterMm = firstFact.value;
      accepted = true;
    }
    if (
      field === "waterResistanceM" &&
      details.waterResistanceM == null &&
      typeof firstFact.value === "number" &&
      Number.isInteger(firstFact.value) &&
      firstFact.value >= 0 &&
      firstFact.value <= 12000
    ) {
      details.waterResistanceM = firstFact.value;
      accepted = true;
    }
    if (
      field === "movementType" &&
      details.movement == null &&
      typeof firstFact.value === "string" &&
      [
        "automatic",
        "manual",
        "quartz",
        "solar",
        "spring_drive",
        "hybrid",
      ].includes(firstFact.value)
    ) {
      details.movement = firstFact.value;
      accepted = true;
    }
    if (accepted)
      facts.push({
        field,
        value: firstFact.value,
        sources: [
          {
            provider: "perplexity",
            sourceUrl: result.evidence[0]!.sourceUrl,
            quote: firstFact.quote,
            checkedAt: details.validationEvidence![0]!.checkedAt,
          },
          {
            provider: "muse",
            sourceUrl: result.evidence[1]!.sourceUrl,
            quote: secondFact.quote,
            checkedAt: details.validationEvidence![1]!.checkedAt,
          },
        ],
      });
  }
  if (facts.length) details.validationFacts = facts;
  const primaryPrices = a.filter((fact) => fact.field === "price");
  const secondaryPrices = b.filter((fact) => fact.field === "price");
  let priceNote = result.watch.priceNote;
  if (
    details.price == null &&
    primaryPrices.length === 1 &&
    secondaryPrices.length === 1 &&
    typeof primaryPrices[0]!.value === "string" &&
    typeof secondaryPrices[0]!.value === "string"
  ) {
    const firstPrice = parseObservedPrice(primaryPrices[0]!.value);
    const secondPrice = parseObservedPrice(secondaryPrices[0]!.value);
    if (firstPrice && secondPrice) {
      details.price = firstPrice;
      details.priceConfirmed = false;
      priceNote = `${firstPrice.currency} ${firstPrice.amount}`;
      details.priceObservation = {
        value: primaryPrices[0]!.value,
        sources: [
          {
            provider: "perplexity",
            sourceUrl: result.evidence[0]!.sourceUrl,
            quote: primaryPrices[0]!.quote,
            checkedAt: details.validationEvidence![0]!.checkedAt,
            value: primaryPrices[0]!.value,
          },
          {
            provider: "muse",
            sourceUrl: result.evidence[1]!.sourceUrl,
            quote: secondaryPrices[0]!.quote,
            checkedAt: details.validationEvidence![1]!.checkedAt,
            value: secondaryPrices[0]!.value,
          },
        ],
      };
    }
  }
  return { ...result, watch: { ...result.watch, priceNote, details } };
}
