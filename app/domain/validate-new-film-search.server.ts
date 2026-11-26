import type { FoundWatch } from "./ai-watch-types";
import { isWristwatch, normalizeReference } from "./ai-watch-guardrails";
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
import {
  roleAttribution,
  sameBrand,
  samePerson,
  sameWork,
} from "./attribution-names";
import { filmDiscoverySubjectSchema } from "./validation-provider-request.server";
import { safeHttpUrl, sourceHost } from "./source-pages.server";
import { FILM_DISCOVERY_VERSION } from "./film-subject";

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

/** A wearer name the first source gave, when it is only a plain name. */
function wearerHint(value: string | null) {
  const name = value?.trim() ?? "";
  return name.length > 0 &&
    name.length <= 160 &&
    !/(?:https?:\/\/|\bwww\.|@|\b(?:\d{1,3}\.){3}\d{1,3}\b)/i.test(name)
    ? name
    : null;
}

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
  const isWork = subject.kind === "movie" || subject.kind === "series";
  return validateDiscoveredSearch(cacheKey, {
    ...services,
    discover: () => services.discoverFilm(subject),
    // "John Wick (Keanu Reeves)" is John Wick; "Casino Royale (2006)" is
    // Casino Royale. A film's card is stored under the title searched; an
    // actor's or a character's card keeps the role and the film when the
    // provider names both (roleAttribution), else the name searched.
    accepts: (evidence) =>
      isWork
        ? sameWork(evidence.work, subject.query)
        : samePerson(evidence.person, subject.query),
    attributionFor: (evidence) =>
      isWork
        ? { person: null, work: subject.query }
        : roleAttribution(subject.query, evidence.person, evidence.work),
    draftVersion: FILM_DISCOVERY_VERSION,
  });
}

/** Shared reservation, independent checking and atomic publication for a new
 * search. The caller binds only typed search constraints, never visitor data. */
export async function validateDiscoveredSearch(
  cacheKey: string,
  services: ValidationServices & {
    discover: () => Promise<FilmDiscovery>;
    accepts: (evidence: ValidationEvidence) => boolean;
    attribution?: { person?: string; work?: string };
    /** The person and work each found card states, when they depend on
     * what its source said; overrides `attribution`. */
    attributionFor?: (evidence: ValidationEvidence) => {
      person: string | null;
      work: string | null;
    };
    /** Stamped on saved draft cards (FILM_DISCOVERY_VERSION for films). */
    draftVersion?: number;
  },
): Promise<ValidationRun> {
  const cardAttribution = (evidence: ValidationEvidence) => {
    const named = services.attributionFor?.(evidence) ?? services.attribution;
    return { person: named?.person ?? null, work: named?.work ?? null };
  };
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
    discovery = await services.discover();
  } catch (error) {
    costs[0] =
      error instanceof ProviderCostError &&
      error.costUsd !== null &&
      Number.isFinite(error.costUsd) &&
      error.costUsd >= 0
        ? error.costUsd
        : null;
    console.info(
      JSON.stringify({
        event: "watch_discovery_failed",
        reason:
          error instanceof ProviderCostError
            ? error.message
            : "Provider request failed",
        costUsd: costs[0],
      }),
    );
    return finishFailure("discovery failed");
  }
  if (!Number.isFinite(discovery.costUsd) || discovery.costUsd < 0) {
    costs[0] = null;
    return finishFailure("unknown provider cost");
  }
  costs[0] = discovery.costUsd;
  if (discovery.costUsd >= limit)
    return finishFailure("discovery exhausted card budget");
  if (services.captureCandidates) {
    const draft = discovery.evidence.slice(0, 20).flatMap((evidence) => {
      if (
        evidence.provider !== "perplexity" ||
        !isWristwatch({
          brand: evidence.brand,
          model: evidence.model ?? null,
        }) ||
        !services.accepts(evidence) ||
        !safeHttpUrl(evidence.sourceUrl) ||
        !fold(evidence.brand)
      )
        return [];
      const reference = normalizeReference(evidence.referenceCode);
      const knownReference =
        reference &&
        !["unknown", "none", "null", "unavailable", "notavailable"].includes(
          reference,
        );
      const model =
        evidence.model?.trim() ||
        (knownReference ? evidence.referenceCode : null);
      if (!model) return [];
      return [
        {
          brand: evidence.brand,
          model,
          referenceCode: knownReference ? evidence.referenceCode : null,
          sourceUrl: evidence.sourceUrl,
          imageUrl: null,
          priceNote: null,
          rationale:
            "Possible match from cited research; not independently confirmed.",
          details: cardAttribution(evidence),
        } satisfies FoundWatch,
      ];
    });
    if (draft.length) {
      const unique = uniqueWatchResults(draft).slice(0, 10);
      const hydratedDraft = await services.hydrate(unique).catch(() => unique);
      // The discovery that wrote the draft, so a later one can supersede it.
      const version = services.draftVersion;
      await services
        .captureCandidates(
          version
            ? hydratedDraft.map((watch) => ({
                ...watch,
                details: { ...watch.details, discoveryVersion: version },
              }))
            : hydratedDraft,
        )
        .catch(() => undefined);
    }
  }
  const seen = new Set<string>();
  const candidates = discovery.evidence
    .slice(0, 20)
    .flatMap((evidence) => {
      const reference = normalizeReference(evidence.referenceCode);
      const key = `${fold(evidence.brand)}|${reference}`;
      if (
        evidence.provider !== "perplexity" ||
        !isWristwatch({
          brand: evidence.brand,
          model: evidence.model ?? null,
        }) ||
        !evidence.supported ||
        !reference ||
        reference.length < 3 ||
        ["unknown", "none", "null", "unavailable", "notavailable"].includes(
          reference,
        ) ||
        !fold(evidence.brand) ||
        !services.accepts(evidence) ||
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
        details: cardAttribution(evidence),
      };
      return [{ watch, evidence }];
    })
    .slice(0, count);
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
        !sameBrand(candidate.brand, watch.brand) ||
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
        // Sightings only: the second check is told where the first source
        // was read and, for a film card, whom it names as the wearer.
        ...(candidate.details.person || candidate.details.work
          ? {
              avoidHost: sourceHost(evidence.sourceUrl),
              wearerHint: candidate.details.person
                ? null
                : wearerHint(evidence.person),
            }
          : {}),
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
