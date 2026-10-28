import type { FoundWatch } from "./ai-watch-types";
import { normalizeReference } from "./ai-watch-guardrails";
import {
  ProviderCostError,
  type ProviderAssertion,
} from "./validation-provider-response.server";
import type {
  ValidationBrief,
  ValidationRun,
  ValidationServices,
} from "./validate-cached-search.server";

export type FilmDiscoverySubject = {
  query: string;
  kind: "movie" | "series" | "actor" | "character" | "celebrity";
};

/** Reserve the complete card budget before discovery. The candidate comes from
 * Perplexity; Muse checks that same candidate before any publication. */
export async function validateNewFilmSearch(
  cacheKey: string,
  subject: FilmDiscoverySubject,
  services: ValidationServices & {
    discoverFilm: (subject: FilmDiscoverySubject) => Promise<ProviderAssertion>;
  },
): Promise<ValidationRun> {
  const reservation = await services.reserve(cacheKey, 1);
  if (reservation.state !== "reserved")
    return { status: "unavailable", reason: reservation.state };
  const attempt = reservation.attemptId;
  const finishFailure = async (
    cost: number | null,
    reason: string,
  ): Promise<ValidationRun> => {
    if (cost !== null && cost > 0.025) {
      await services.reportOverrun(attempt, [cost]).catch(() => false);
      return {
        status: "unavailable",
        reason: "provider cost exceeded reservation",
      };
    }
    const settled = await services.settle(attempt, [cost]).catch(() => false);
    return {
      status: "unavailable",
      reason: settled ? reason : "settlement failed",
    };
  };
  let primary: ProviderAssertion;
  try {
    primary = await services.discoverFilm(subject);
  } catch (error) {
    return finishFailure(
      error instanceof ProviderCostError ? error.costUsd : null,
      "discovery failed",
    );
  }
  const initialCost = primary.costUsd;
  if (!Number.isFinite(initialCost) || initialCost < 0)
    return finishFailure(null, "unknown provider cost");
  if (initialCost > 0.025)
    return finishFailure(initialCost, "provider cost exceeded reservation");
  const evidence = primary.evidence;
  const reference = normalizeReference(evidence.referenceCode);
  const isWork = subject.kind === "movie" || subject.kind === "series";
  const fold = (value: string | null) =>
    (value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  if (
    !evidence.supported ||
    !reference ||
    reference.length < 3 ||
    ["unknown", "none", "null", "unavailable", "notavailable"].includes(
      reference,
    ) ||
    fold(isWork ? evidence.work : evidence.person) !== fold(subject.query)
  )
    return finishFailure(initialCost, "no confirmed candidates");
  const draft: FoundWatch = {
    brand: evidence.brand,
    model: evidence.referenceCode!,
    referenceCode: evidence.referenceCode,
    sourceUrl: evidence.sourceUrl,
    imageUrl: null,
    priceNote: null,
    rationale: "",
    details: {
      person: isWork ? null : subject.query,
      work: isWork ? subject.query : null,
    },
  };
  let candidate: FoundWatch;
  try {
    candidate = (await services.hydrate([draft]))[0] ?? draft;
  } catch {
    return finishFailure(initialCost, "catalogue lookup failed");
  }
  const brief: ValidationBrief = {
    brand: candidate.brand,
    model: candidate.model,
    referenceCode: candidate.referenceCode,
    person: candidate.details.person ?? null,
    work: candidate.details.work ?? null,
    missingFields: [
      ...(candidate.details.caseDiameterMm == null
        ? ["caseDiameterMm" as const]
        : []),
      ...(candidate.details.waterResistanceM == null
        ? ["waterResistanceM" as const]
        : []),
      ...(candidate.details.movement == null ? ["movementType" as const] : []),
      ...(candidate.details.price == null ? ["price" as const] : []),
    ],
  };
  let secondary: ProviderAssertion;
  try {
    secondary = await services.secondary(brief);
  } catch (error) {
    const cost = error instanceof ProviderCostError ? error.costUsd : null;
    return finishFailure(
      cost === null ? null : initialCost + cost,
      "verification failed",
    );
  }
  const cost = initialCost + secondary.costUsd;
  if (!Number.isFinite(cost) || secondary.costUsd < 0)
    return finishFailure(null, "unknown provider cost");
  if (cost > 0.025)
    return finishFailure(cost, "provider cost exceeded reservation");
  if (normalizeReference(secondary.evidence.referenceCode) !== reference)
    return finishFailure(cost, "no confirmed candidates");
  const decision = await services
    .inspect(candidate, primary, secondary)
    .catch(() => null);
  if (!decision || decision.status !== "verified")
    return finishFailure(cost, "no confirmed candidates");
  const watches = await (services.hydrateVerified ?? services.hydrate)([
    decision.watch,
  ]).catch(() => [decision.watch]);
  if (watches.length !== 1)
    return finishFailure(cost, "catalogue lookup failed");
  const published = await services.publish(attempt, watches, [cost]);
  if (!published)
    return { status: "unavailable", reason: "publication failed" };
  return { status: "verified", watches, rejected: 0 };
}
