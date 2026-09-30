/**
 * The quiz's live search, used above 10k or where the catalogue has gaps
 * (see quiz-search.server.ts). Muse Spark and a live web search propose watches in
 * parallel "angles"; each proposal must pass the hard quiz rules in code and
 * have its reference confirmed on a manufacturer or authorised-retailer page.
 */
import {
  allowedMovement,
  classifySource,
  fitsDiameter,
  fitsPrice,
  meetsWaterResistance,
  nickelSafe,
  normalizeMovement,
  normalizeReference,
} from "./ai-watch-guardrails";
import {
  clean,
  defaultDeps,
  finite,
  logError,
  museJson,
  findPages,
  searchReady,
  webResearchJson,
  VAGUE,
  type Deps,
} from "./ai-providers.server";
import type { AiSearchOutcome, FoundWatch } from "./ai-watch-types";
import { convert, type FxTable } from "./fx.server";
import {
  diameterRangeFor,
  findPriceRange,
  type ProfileV4,
} from "./questionnaire-v4";
import {
  inspectSourcePage,
  safeHttpUrl,
  verifyImageUrl,
} from "./source-pages.server";

// ---------------------------------------------------------------------------
// Anytime collection: every angle runs its whole pipeline independently.

/**
 * Resolves with whatever the angles have produced once all are done, or
 * after softMs if `enough` is already satisfied, or at hardMs regardless.
 */
export function collectUntilDeadline<T>(
  tasks: Promise<T[]>[],
  {
    softMs,
    hardMs,
    enough,
  }: { softMs: number; hardMs: number; enough: (items: T[]) => boolean },
): Promise<T[]> {
  return new Promise((resolve) => {
    const items: T[] = [];
    let pending = tasks.length;
    let settled = false;
    let softPassed = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(softTimer);
      clearTimeout(hardTimer);
      resolve([...items]);
    };
    const check = () => {
      if (pending === 0 || (softPassed && enough(items))) finish();
    };
    const softTimer = setTimeout(() => {
      softPassed = true;
      check();
    }, softMs);
    const hardTimer = setTimeout(finish, hardMs);
    if (tasks.length === 0) finish();
    for (const task of tasks) {
      task
        .then((produced) => {
          items.push(...produced);
        })
        .catch((error: unknown) => logError("ai_search_angle_failed", error))
        .finally(() => {
          pending -= 1;
          check();
        });
    }
  });
}

// ---------------------------------------------------------------------------
// Quiz search

export const QUIZ_MAX_WATCHES = 5;

const MOVEMENT_WORDS: Record<string, string> = {
  automatic: "automatic",
  manual: "hand-wound",
  quartz: "quartz",
  solar: "solar",
  spring_drive: "Spring Drive",
  hybrid: "hybrid",
};

function money(amount: number, currency: string) {
  return `${currency} ${Math.round(amount).toLocaleString("en")}`;
}

/** Plain-text constraints: the only thing about the visitor that leaves. */
export function quizConstraintLines(profile: ProfileV4) {
  const range = findPriceRange(profile.priceRange)!;
  const diameter = diameterRangeFor(profile);
  const optional = [
    profile.maxCaseThicknessMm !== undefined
      ? `Case thickness at most ${profile.maxCaseThicknessMm} mm.`
      : null,
    profile.caseShape !== undefined
      ? `Case shape: ${profile.caseShape}.`
      : null,
    profile.movementConstruction !== undefined
      ? `Calibre: ${profile.movementConstruction === "manufacture" ? "in-house" : "widely produced"}.`
      : null,
    profile.displayCaseback !== undefined
      ? `Case back: ${profile.displayCaseback ? "display (sapphire)" : "solid"}.`
      : null,
    profile.crystal !== undefined ? `Crystal: ${profile.crystal}.` : null,
    profile.microAdjustmentRequired !== undefined
      ? `Clasp micro-adjustment ${profile.microAdjustmentRequired ? "required" : "not wanted"}.`
      : null,
  ].filter((line): line is string => line !== null);
  return [
    range.maximum === null
      ? `New retail price of ${money(range.minimum, profile.budgetCurrency)} or more.`
      : `New retail price between ${money(range.minimum, profile.budgetCurrency)} and ${money(range.maximum, profile.budgetCurrency)}.`,
    `Case diameter ${diameter.minimumMm}-${diameter.maximumMm} mm (wearer's wrist ${profile.wristCm} cm).`,
    profile.minimumWaterResistanceM > 0
      ? `Water resistance of at least ${profile.minimumWaterResistanceM} m.`
      : "No water-resistance requirement.",
    `Movement: ${profile.movementTypes.map((type) => MOVEMENT_WORDS[type] ?? type).join(" or ")}.`,
    `Worn for: ${profile.wearingScenarios.join(", ").replaceAll("_", " ")}.`,
    profile.requiredComplications.length > 0
      ? `Must have: ${profile.requiredComplications.join(", ").replaceAll("_", " ")}.`
      : "No required complications.",
    ...(profile.allergyConstraint === "nickel_contact"
      ? [
          "Nickel allergy: no steel may touch the skin. The case back and the strap or bracelet must be titanium, ceramic, gold, platinum, or a leather, rubber or textile strap.",
        ]
      : []),
    ...optional,
  ];
}

/**
 * What decides whether two quiz submissions share a stored result: the
 * range, the wrist's diameter band rather than the exact wrist, and every
 * other answer, order-insensitive.
 */
export function quizCacheInput(profile: ProfileV4) {
  const sorted = (values: readonly string[]) => [...values].sort();
  return {
    budgetCurrency: profile.budgetCurrency,
    priceRange: profile.priceRange,
    caseDiameter: diameterRangeFor(profile),
    wearingScenarios: sorted(profile.wearingScenarios),
    minimumWaterResistanceM: profile.minimumWaterResistanceM,
    movementTypes: sorted(profile.movementTypes),
    requiredComplications: sorted(profile.requiredComplications),
    allergyConstraint: profile.allergyConstraint,
    maxCaseThicknessMm: profile.maxCaseThicknessMm,
    caseShape: profile.caseShape,
    movementConstruction: profile.movementConstruction,
    displayCaseback: profile.displayCaseback,
    crystal: profile.crystal,
    microAdjustmentRequired: profile.microAdjustmentRequired,
  };
}

type QuizCandidate = {
  brand: string;
  model: string;
  referenceCode: string | null;
  price: { amount: number; currency: string } | null;
  waterResistanceM: number | null;
  caseDiameterMm: number | null;
  movement: string | null;
  materials: {
    case: string | null;
    caseback: string | null;
    strap: string | null;
  };
  sourceHint: string | null;
  note: string | null;
};

function readQuizCandidate(raw: unknown): QuizCandidate | null {
  const item = raw as Record<string, unknown>;
  const brand = clean(item.brand);
  const model = clean(item.model);
  if (!brand || !model || VAGUE.test(`${brand} ${model}`)) return null;
  const amount = finite(item.priceAmount);
  const currency = clean(item.priceCurrency)?.toUpperCase().slice(0, 3) ?? null;
  return {
    brand,
    model,
    referenceCode: clean(item.referenceCode),
    price: amount !== null && currency ? { amount, currency } : null,
    waterResistanceM: finite(item.waterResistanceM),
    caseDiameterMm: finite(item.caseDiameterMm),
    movement: normalizeMovement(clean(item.movementType)),
    materials: {
      case: clean(item.caseMaterial),
      caseback: clean(item.casebackMaterial),
      strap: clean(item.strapMaterial),
    },
    sourceHint: safeHttpUrl(clean(item.manufacturerUrl)),
    note: clean(item.why),
  };
}

const CANDIDATE_FIELDS =
  '{"candidates":[{"brand","model","referenceCode","priceAmount","priceCurrency","waterResistanceM","caseDiameterMm","movementType","caseMaterial","casebackMaterial","strapMaterial","why"}]}';

const QUIZ_PROPOSE_SYSTEM = [
  "You are the senior watch buyer of The Reserve.",
  "You receive anonymous search constraints and propose specific current-production wristwatch references that meet every one of them.",
  "Treat every constraint as hard. Leave out any watch that breaks one; do not explain a violation away.",
  "Give the exact manufacturer reference number of one specific configuration, its current official new retail price (priceAmount with the ISO priceCurrency; use the requested currency where the brand publishes it), water resistance in metres, case diameter in mm, movement type, and the case, case-back and strap or bracelet materials of that configuration.",
  "Use null for any fact you are not sure of rather than guessing.",
  "For each watch add one sentence (why) on why it suits the stated uses, in plain English.",
  "Prefer variety across brands and designs.",
  `Respond only with JSON: ${CANDIDATE_FIELDS}.`,
].join(" ");

const QUIZ_ANGLES = [
  "Focus on established Swiss brands.",
  "Focus on German, Japanese, British and American brands.",
  "Focus on independent and smaller specialist brands.",
];

const sonarCandidateSchema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...Object.fromEntries(
            ["brand", "model"].map((key) => [key, { type: "string" }]),
          ),
          ...Object.fromEntries(
            [
              "referenceCode",
              "priceCurrency",
              "movementType",
              "caseMaterial",
              "casebackMaterial",
              "strapMaterial",
              "manufacturerUrl",
              "why",
            ].map((key) => [key, { type: ["string", "null"] }]),
          ),
          ...Object.fromEntries(
            ["priceAmount", "waterResistanceM", "caseDiameterMm"].map((key) => [
              key,
              { type: ["number", "null"] },
            ]),
          ),
        },
        required: ["brand", "model"],
      },
    },
  },
  required: ["candidates"],
};

type ScoredCandidate = QuizCandidate & { priceInBudget: number | null };

/** Every hard rule the candidate breaks; empty means eligible. */
export function quizRuleFailures(
  candidate: ScoredCandidate,
  profile: ProfileV4,
) {
  const range = findPriceRange(profile.priceRange)!;
  const failures: string[] = [];
  if (normalizeReference(candidate.referenceCode) === null)
    failures.push("reference");
  if (!fitsPrice(range, candidate.priceInBudget)) failures.push("price");
  if (
    !meetsWaterResistance(
      profile.minimumWaterResistanceM,
      candidate.waterResistanceM,
    )
  ) {
    failures.push("water_resistance");
  }
  if (!fitsDiameter(diameterRangeFor(profile), candidate.caseDiameterMm)) {
    failures.push("diameter");
  }
  if (!allowedMovement(profile.movementTypes, candidate.movement))
    failures.push("movement");
  if (
    profile.allergyConstraint === "nickel_contact" &&
    !nickelSafe(candidate.materials)
  ) {
    failures.push("nickel");
  }
  return failures;
}

function factsRationale(candidate: QuizCandidate) {
  const parts = [
    candidate.caseDiameterMm !== null ? `${candidate.caseDiameterMm} mm` : null,
    candidate.movement
      ? (MOVEMENT_WORDS[candidate.movement] ?? candidate.movement)
      : null,
    candidate.waterResistanceM !== null
      ? `${candidate.waterResistanceM} m water resistance`
      : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `${parts.join(", ")}.`
    : "Meets every stated constraint.";
}

type VerifiedQuizWatch = { angle: number; order: number; watch: FoundWatch };

/**
 * One angle's whole pipeline: propose, apply the hard rules, ground each
 * survivor on a manufacturer or authorised-retailer page that shows the
 * exact reference, and read its product photo. Angles never wait for one
 * another.
 */
async function runQuizAngle(
  angle: number,
  propose: () => Promise<unknown[]>,
  profile: ProfileV4,
  fx: Promise<FxTable | null>,
  counts: Record<string, number>,
  deps: Deps,
): Promise<VerifiedQuizWatch[]> {
  const [proposals, table] = await Promise.all([propose(), fx]);
  const eligible = proposals
    .map(readQuizCandidate)
    .filter((candidate): candidate is QuizCandidate => candidate !== null)
    .map((candidate) => ({
      ...candidate,
      priceInBudget:
        candidate.price && table
          ? convert(
              candidate.price.amount,
              candidate.price.currency,
              profile.budgetCurrency,
              table,
            )
          : candidate.price?.currency === profile.budgetCurrency
            ? candidate.price.amount
            : null,
    }))
    .filter((candidate) => {
      const failures = quizRuleFailures(candidate, profile);
      for (const failure of failures)
        counts[failure] = (counts[failure] ?? 0) + 1;
      return failures.length === 0;
    });
  if (eligible.length === 0) return [];

  const hits = await findPages(
    eligible.map(
      (candidate) => `${candidate.brand} ${candidate.referenceCode}`,
    ),
    deps,
  );

  const verified = await Promise.all(
    eligible.map(
      async (candidate, order): Promise<VerifiedQuizWatch | null> => {
        const reference = normalizeReference(candidate.referenceCode)!;
        const urls = [
          candidate.sourceHint,
          ...hits
            .filter((hit) =>
              `${hit.url} ${hit.title} ${hit.snippet}`
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
                .includes(reference),
            )
            .map((hit) => hit.url),
        ].filter(
          (url, index, all): url is string =>
            url !== null &&
            all.indexOf(url) === index &&
            classifySource(url, candidate.brand) !== null,
        );
        for (const url of urls.slice(0, 2)) {
          const page = await inspectSourcePage(
            url,
            candidate.referenceCode,
            deps.fetchImpl,
          );
          if (!page.referenceFound) continue;
          return {
            angle,
            order,
            watch: {
              brand: candidate.brand,
              model: candidate.model,
              referenceCode: candidate.referenceCode,
              sourceUrl: url,
              imageUrl: await verifyImageUrl(page.imageUrl, deps.fetchImpl),
              priceNote: candidate.price
                ? money(candidate.price.amount, candidate.price.currency)
                : null,
              rationale: candidate.note ?? factsRationale(candidate),
              details: {
                price: candidate.price,
                waterResistanceM: candidate.waterResistanceM,
                caseDiameterMm: candidate.caseDiameterMm,
                movement: candidate.movement,
                materials: candidate.materials,
                sourceKind: classifySource(url, candidate.brand)!,
                referenceVerified: true,
              },
            },
          };
        }
        counts.unverified_source = (counts.unverified_source ?? 0) + 1;
        return null;
      },
    ),
  );
  return verified.filter((item): item is VerifiedQuizWatch => item !== null);
}

/** Round-robin across angles, so the shortlist mixes brands and styles. */
function interleave(items: VerifiedQuizWatch[], limit: number) {
  const byAngle = new Map<number, VerifiedQuizWatch[]>();
  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    byAngle.set(item.angle, [...(byAngle.get(item.angle) ?? []), item]);
  }
  const angles = [...byAngle.keys()].sort((a, b) => a - b);
  const result: FoundWatch[] = [];
  const seen = new Set<string>();
  for (let round = 0; result.length < limit; round += 1) {
    let added = false;
    for (const angle of angles) {
      const item = byAngle.get(angle)![round];
      if (!item) continue;
      added = true;
      const key =
        `${item.watch.brand}|${normalizeReference(item.watch.referenceCode)}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item.watch);
      if (result.length === limit) break;
    }
    if (!added) break;
  }
  return result;
}

export async function searchQuizWatches(
  profile: ProfileV4,
  overrides: Partial<Deps> = {},
  timing: { softMs: number; hardMs: number } = {
    softMs: 12_000,
    hardMs: 28_000,
  },
): Promise<AiSearchOutcome> {
  const deps = defaultDeps(overrides);
  if (!searchReady(deps.config)) {
    logError(
      "ai_watch_search_unavailable",
      new Error("Muse Spark or Perplexity is not configured."),
    );
    return { status: "unavailable" };
  }
  const lines = quizConstraintLines(profile);
  const constraints = lines.map((line) => `- ${line}`).join("\n");
  const fx = deps.loadFx();
  const counts: Record<string, number> = {};

  const museAngles = QUIZ_ANGLES.map((angleText, index) =>
    runQuizAngle(
      index,
      async () => {
        const payload = (await museJson(
          QUIZ_PROPOSE_SYSTEM,
          `Propose 5 candidates. ${angleText}\nConstraints:\n${constraints}`,
          "reserve-quiz-propose-v1",
          deps,
          timing.hardMs,
        )) as { candidates?: unknown };
        return Array.isArray(payload.candidates)
          ? (payload.candidates as unknown[])
          : [];
      },
      profile,
      fx,
      counts,
      deps,
    ),
  );
  // A live web-search angle catches recent releases the model may not know.
  const liveAngle = runQuizAngle(
    QUIZ_ANGLES.length,
    async () => {
      const payload = (await webResearchJson(
        [
          "List up to 6 current-production wristwatches that meet EVERY constraint below, favouring recent releases.",
          constraints,
          "For each give the exact reference number, current new retail price with ISO currency, water resistance in metres, case diameter in mm, movement type, case, case-back and strap materials, the official manufacturer product page URL, and one sentence on why it fits. Use null for anything you cannot confirm.",
        ].join("\n"),
        sonarCandidateSchema,
        deps,
      )) as { candidates?: unknown };
      return Array.isArray(payload.candidates)
        ? (payload.candidates as unknown[])
        : [];
    },
    profile,
    fx,
    counts,
    deps,
  );

  const verified = await collectUntilDeadline([...museAngles, liveAngle], {
    softMs: timing.softMs,
    hardMs: timing.hardMs,
    enough: (items) => items.length >= 3,
  });
  const watches = interleave(verified, QUIZ_MAX_WATCHES);
  console.info(
    JSON.stringify({
      event: "ai_quiz_guardrails",
      verified: verified.length,
      shown: watches.length,
      rejectedBy: counts,
    }),
  );

  if (watches.length === 0) {
    return {
      status: "no_match",
      summary:
        "No watch could be confirmed to meet every requirement with its reference on the manufacturer's or an authorised retailer's own page.",
    };
  }
  return {
    status: "found",
    watches,
    summary: `${watches.length} ${watches.length === 1 ? "watch meets" : "watches meet"} every requirement, each confirmed on the manufacturer's or an authorised retailer's page.`,
  };
}
