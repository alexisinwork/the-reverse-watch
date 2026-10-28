import type { FoundWatch } from "./ai-watch-types";
import { normalizeReference } from "./ai-watch-guardrails";
import { uniqueWatchResults } from "./watch-result-dedup";
import {
  ProviderCostError,
  type ProviderAssertion,
} from "./validation-provider-response.server";
import type {
  ValidationBrief,
  ValidationRun,
  ValidationServices,
} from "./validate-cached-search.server";
import type { ValidationEvidence } from "./cached-result-validation";
import { filmDiscoverySubjectSchema } from "./validation-provider-request.server";

export type FilmDiscoverySubject = {
  query: string;
  kind: "movie" | "series" | "actor" | "character" | "celebrity";
};
export type FilmDiscovery = { evidence: ValidationEvidence[]; costUsd: number };
const count = 8;
const limit = 0.025;
const fold = (value: string | null) =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** One primary discovery call and at most one independent Muse call per card.
 * The full discovery charge is conservatively assigned to the first slot. */
export async function validateNewFilmSearch(
  cacheKey: string,
  subject: FilmDiscoverySubject,
  services: ValidationServices & {
    discoverFilm: (subject: FilmDiscoverySubject) => Promise<FilmDiscovery>;
  },
): Promise<ValidationRun> {
  if (!filmDiscoverySubjectSchema.safeParse(subject).success)
    return { status: "unavailable", reason: "invalid subject" };
  const reservation = await services.reserve(cacheKey, count);
  if (reservation.state !== "reserved")
    return { status: "unavailable", reason: reservation.state };
  const attempt = reservation.attemptId;
  const costs: (number | null)[] = Array.from({ length: count }, () => 0);
  const finishFailure = async (reason: string): Promise<ValidationRun> => {
    if (costs.some((cost) => cost !== null && cost > limit)) {
      await services.reportOverrun(attempt, costs).catch(() => false);
      return {
        status: "unavailable",
        reason: "provider cost exceeded reservation",
      };
    }
    const settled = await services.settle(attempt, costs).catch(() => false);
    return {
      status: "unavailable",
      reason: settled ? reason : "settlement failed",
    };
  };
  let discovery: FilmDiscovery;
  try {
    discovery = await services.discoverFilm(subject);
  } catch (error) {
    costs[0] =
      error instanceof ProviderCostError &&
      error.costUsd !== null &&
      Number.isFinite(error.costUsd) &&
      error.costUsd >= 0
        ? error.costUsd
        : null;
    return finishFailure("discovery failed");
  }
  if (!Number.isFinite(discovery.costUsd) || discovery.costUsd < 0) {
    costs[0] = null;
    return finishFailure("unknown provider cost");
  }
  costs[0] = discovery.costUsd;
  if (discovery.costUsd >= limit)
    return finishFailure("discovery exhausted card budget");
  const isWork = subject.kind === "movie" || subject.kind === "series";
  const seen = new Set<string>();
  const candidates = discovery.evidence.slice(0, count).flatMap((evidence) => {
    const reference = normalizeReference(evidence.referenceCode);
    const key = `${fold(evidence.brand)}|${reference}`;
    if (
      evidence.provider !== "perplexity" ||
      !evidence.supported ||
      !reference ||
      reference.length < 3 ||
      ["unknown", "none", "null", "unavailable", "notavailable"].includes(
        reference,
      ) ||
      !fold(evidence.brand) ||
      fold(isWork ? evidence.work : evidence.person) !== fold(subject.query) ||
      seen.has(key)
    )
      return [];
    seen.add(key);
    const watch: FoundWatch = {
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
    return [{ watch, evidence }];
  });
  if (!candidates.length) return finishFailure("no confirmed candidates");
  let hydrated: FoundWatch[];
  try {
    hydrated = await services.hydrate(candidates.map(({ watch }) => watch));
  } catch {
    return finishFailure("catalogue lookup failed");
  }
  if (hydrated.length !== candidates.length)
    return finishFailure("catalogue lookup failed");
  const results = await Promise.all(
    candidates.map(async ({ watch, evidence }, index) => {
      const candidate = hydrated[index]!;
      if (
        fold(candidate.brand) !== fold(watch.brand) ||
        normalizeReference(candidate.referenceCode) !==
          normalizeReference(watch.referenceCode)
      )
        return null;
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
          ...(candidate.details.movement == null
            ? ["movementType" as const]
            : []),
          ...(candidate.details.price == null ? ["price" as const] : []),
        ],
      };
      let secondary: ProviderAssertion;
      try {
        secondary = await services.secondary(brief);
      } catch (error) {
        const cost = error instanceof ProviderCostError ? error.costUsd : null;
        costs[index] =
          cost !== null && Number.isFinite(cost) && cost >= 0
            ? costs[index]! + cost
            : null;
        return null;
      }
      if (!Number.isFinite(secondary.costUsd) || secondary.costUsd < 0) {
        costs[index] = null;
        return null;
      }
      costs[index] = costs[index]! + secondary.costUsd;
      if (
        costs[index] > limit ||
        normalizeReference(secondary.evidence.referenceCode) !==
          normalizeReference(candidate.referenceCode)
      )
        return null;
      const decision = await services
        .inspect(candidate, { evidence, costUsd: discovery.costUsd }, secondary)
        .catch(() => null);
      return decision?.status === "verified" ? decision.watch : null;
    }),
  );
  if (costs.some((cost) => cost !== null && cost > limit))
    return finishFailure("provider cost exceeded reservation");
  const checked = results.filter(
    (watch): watch is FoundWatch => watch !== null,
  );
  const accepted = uniqueWatchResults(
    checked.length
      ? await (services.hydrateVerified ?? services.hydrate)(checked).catch(
          () => checked,
        )
      : [],
  );
  if (!accepted.length) return finishFailure("no confirmed candidates");
  const published = await services.publish(attempt, accepted, costs);
  if (!published)
    return { status: "unavailable", reason: "publication failed" };
  return {
    status: "verified",
    watches: accepted,
    rejected: candidates.length - accepted.length,
  };
}
