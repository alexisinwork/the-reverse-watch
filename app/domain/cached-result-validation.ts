/** Pure evidence reconciliation for a cached watch. Provider responses must
 * first be schema-validated and their cited pages inspected by the caller. */
import type { FoundWatch } from "./ai-watch-types";
import { safeHttpUrl } from "./source-pages.server";

export type ValidationEvidence = {
  provider: "perplexity" | "muse";
  brand: string;
  referenceCode: string | null;
  person: string | null;
  work: string | null;
  sourceUrl: string;
  /** Short, verbatim source passage proposed by the provider. */
  sourceQuote?: string;
  /** True only when the caller actually inspected the evidence page. */
  sourceVerified: boolean;
  supported: boolean;
};

export type ValidationDecision =
  | { status: "verified"; watch: FoundWatch; evidence: ValidationEvidence[] }
  | { status: "unverified"; reason: string };

const fold = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function host(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

/** A catalogue product reference alone cannot verify a person or film sighting. */
export function validateCachedWatch(
  watch: FoundWatch,
  primary: ValidationEvidence,
  secondary: ValidationEvidence,
  checkedAt: string,
): ValidationDecision {
  if (primary.provider !== "perplexity" || secondary.provider !== "muse")
    return {
      status: "unverified",
      reason: "both independent providers required",
    };
  const reference = fold(watch.referenceCode);
  if (reference.length < 3 || !fold(watch.brand))
    return { status: "unverified", reason: "exact reference required" };
  const evidence = [primary, secondary];
  for (const item of evidence) {
    if (!item.supported || !item.sourceVerified || !safeHttpUrl(item.sourceUrl))
      return { status: "unverified", reason: "source not verified" };
    if (
      (watch.details.person || watch.details.work) &&
      !item.sourceQuote?.trim()
    )
      return { status: "unverified", reason: "source passage required" };
    if (
      fold(item.brand) !== fold(watch.brand) ||
      fold(item.referenceCode) !== reference
    )
      return { status: "unverified", reason: "brand or reference conflict" };
    if (
      watch.details.person &&
      fold(item.person) !== fold(watch.details.person)
    )
      return { status: "unverified", reason: "person attribution conflict" };
    if (watch.details.work && fold(item.work) !== fold(watch.details.work))
      return { status: "unverified", reason: "work attribution conflict" };
  }
  if (host(primary.sourceUrl) === host(secondary.sourceUrl))
    return { status: "unverified", reason: "independent sources required" };
  if (!Number.isFinite(Date.parse(checkedAt)))
    return { status: "unverified", reason: "invalid check date" };
  return {
    status: "verified",
    watch: {
      ...watch,
      details: {
        ...watch.details,
        validationEvidence: evidence.map(
          ({ provider, sourceUrl, sourceQuote }) => ({
            provider,
            sourceUrl,
            checkedAt,
            // The source inspector checks this passage only for sightings.
            ...((watch.details.person || watch.details.work) && sourceQuote
              ? {
                  sourceQuote,
                  person: watch.details.person ?? null,
                  work: watch.details.work ?? null,
                }
              : {}),
          }),
        ),
      },
    },
    evidence,
  };
}
