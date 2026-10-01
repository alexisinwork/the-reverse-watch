/**
 * The live web search behind "Find a cheaper alternative", used when the
 * catalogue can't answer: the named watch isn't in it, or fewer than three
 * alternatives match. Every watch found is checked like a catalogue build
 * (reference on the maker's page, price, photo traits) and added to the
 * catalogue as pending, so the next search for it is instant.
 */
import { webResearchJson, type Deps } from "./ai-providers.server";
import {
  budgetWindow,
  isHomageBrand,
  primaryStyle,
  SIZE_TOLERANCE_MM,
  type AlternativesBudget,
} from "./alternatives";
import type { ProgressEvent } from "./ai-watch-types";
import {
  buildCandidateSchema,
  candidateIdentity,
  COMPLICATION_SLUGS,
  proposedUsd,
  readBuildCandidate,
  verifyCandidate,
  type BuildCandidate,
} from "./catalogue-build.server";
import { readDesignTraits } from "./design-traits.server";
import { formatMoney, type FxTable } from "./fx";
import { lookupMarketPrice } from "./market-price.server";
import type { CatalogueWatch } from "./watch-catalogue";
import {
  recordCataloguePrice,
  recordDesignTraits,
  upsertCatalogueWatch,
  type CatalogueClient,
} from "./watch-catalogue.server";

const STYLE_WORDS = "dress, everyday, sport, dive, field, travel";

const FORMAT_RULES = [
  `styles: any of ${STYLE_WORDS}.`,
  `complications: only these slugs: ${COMPLICATION_SLUGS.join(", ")}.`,
  "movementType: automatic, manual, quartz, solar, spring_drive or hybrid.",
  "manufacturerUrl: the maker's own product page for this exact watch, or null. Never invent a URL.",
  "priceAmount and priceCurrency: the current new list price from the maker or an authorised retailer, or null.",
].join(" ");

/** Checks one proposed watch and stores it; returns its catalogue id. */
async function verifyAndStore(
  candidate: BuildCandidate,
  client: CatalogueClient,
  deps: Deps,
  fx: FxTable | null,
  foundIn: Record<string, unknown>,
) {
  const entry = await verifyCandidate(
    candidate,
    candidate.styles,
    foundIn,
    deps,
    fx,
  );
  const id = await upsertCatalogueWatch(client, entry);
  if (entry.priceStatus !== "confirmed") {
    const market = await lookupMarketPrice(
      candidate,
      deps,
      fx,
      proposedUsd({ priceEvidence: entry.priceEvidence ?? {} }, fx),
    ).catch(() => null);
    if (market?.status === "found") {
      await recordCataloguePrice(client, id, {
        kind: "approximate",
        amount: market.amount,
        currency: market.currency,
        evidence: market.evidence,
      });
    }
  }
  if (entry.imageUrl) {
    const traits = await readDesignTraits(entry.imageUrl, deps).catch(
      () => null,
    );
    if (traits) await recordDesignTraits(client, id, traits);
  }
  return id;
}

/**
 * Finds the watch a subscriber named when it isn't in the catalogue, adds
 * it, and returns its id (or null when the web has no clear answer).
 */
export async function identifyWatchLive(
  name: string,
  reference: string | null,
  {
    client,
    deps,
    fx,
    report,
  }: {
    client: CatalogueClient;
    deps: Deps;
    fx: FxTable | null;
    report?: (event: ProgressEvent) => void;
  },
) {
  report?.({
    text: `“${name}” isn't in our catalogue yet: looking it up on the web…`,
  });
  const payload = (await webResearchJson(
    [
      `Identify the wristwatch a person means by “${name}”${reference ? `, reference ${reference}` : ""}.`,
      "Return exactly one candidate: its current (or most recent) production version, with its real reference and facts from the maker's own pages.",
      "When the name covers a family of models, choose its best-known core model (for example the time-and-date steel version), not a complication, limited edition, gem-set or precious-metal variant.",
      "If you cannot tell which watch is meant, return an empty candidates list.",
      FORMAT_RULES,
    ].join(" "),
    buildCandidateSchema,
    deps,
    { contextSize: "medium", maxToolCalls: 4 },
  )) as { candidates?: unknown[] };
  const candidate = readBuildCandidate(payload.candidates?.[0]);
  if (!candidate) return null;
  report?.({
    text: `Found the ${candidate.brand} ${candidate.model}. Checking it on the maker's page…`,
  });
  return verifyAndStore(candidate, client, deps, fx, {
    alternativesTarget: true,
  });
}

/** How the target looks, in words the web search can use. */
function describeTarget(target: CatalogueWatch) {
  const traits = target.designTraits;
  return [
    `${target.brand} ${target.model}${target.referenceCode ? ` (${target.referenceCode})` : ""}`,
    target.caseDiameterMm ? `${target.caseDiameterMm} mm` : null,
    target.waterResistanceM ? `${target.waterResistanceM} m` : null,
    target.movement,
    target.complications.length > 0
      ? target.complications.join(", ").replaceAll("_", " ")
      : "time only",
    traits?.dialColour ? `${traits.dialColour} dial` : null,
    traits?.handStyle ? `${traits.handStyle.replaceAll("_", " ")} hands` : null,
    traits?.bezel ? `${traits.bezel} bezel` : null,
    traits?.strap ? traits.strap.replaceAll("_", " ") : null,
    traits?.era ? traits.era.replaceAll("_", " ") : null,
    `role: ${primaryStyle(target)}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Searches the web for alternatives the catalogue lacks and adds them.
 * Returns how many new watches were stored.
 */
export async function findAlternativesLive(
  target: CatalogueWatch,
  budget: AlternativesBudget,
  allowQuartz: boolean,
  known: ReadonlySet<string>,
  {
    client,
    deps,
    fx,
    report,
  }: {
    client: CatalogueClient;
    deps: Deps;
    fx: FxTable | null;
    report?: (event: ProgressEvent) => void;
  },
) {
  const window = budgetWindow(budget);
  const priceText =
    window.maximum === null
      ? `from ${formatMoney(window.minimum, window.currency)}`
      : `${formatMoney(window.minimum, window.currency)} to ${formatMoney(window.maximum, window.currency)}`;
  report?.({
    text: `Searching the web for more watches like the ${target.brand} ${target.model} at ${priceText}…`,
  });
  const payload = (await webResearchJson(
    [
      `Suggest up to 8 current-production wristwatches that look and work like the ${describeTarget(target)}, priced ${priceText} new.`,
      `Same role and functions, case within ${SIZE_TOLERANCE_MM} mm of it, ${allowQuartz ? "any movement" : "mechanical movements only (automatic or hand-wound)"}.`,
      "Real watches from established makers only: no homages (watches that copy another brand's design), no replicas.",
      `The same brand is fine only for a model that looks very similar.`,
      FORMAT_RULES,
    ].join(" "),
    buildCandidateSchema,
    deps,
    { contextSize: "medium", maxToolCalls: 6 },
  )) as { candidates?: unknown[] };
  const candidates = (payload.candidates ?? [])
    .map(readBuildCandidate)
    .filter(
      (candidate): candidate is BuildCandidate =>
        candidate !== null &&
        !isHomageBrand(candidate.brand) &&
        !known.has(candidateIdentity(candidate)),
    )
    .slice(0, 6);
  if (candidates.length === 0) return 0;
  report?.({
    text: `Checking ${candidates.length} suggestions on their makers' pages…`,
  });
  const stored = await Promise.allSettled(
    candidates.map((candidate) =>
      verifyAndStore(candidate, client, deps, fx, {
        alternativesFor: target.identityKey,
      }),
    ),
  );
  return stored.filter((result) => result.status === "fulfilled").length;
}
