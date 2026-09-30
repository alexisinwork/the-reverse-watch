import { z } from "zod";

import {
  allowedMovement,
  classifySource,
  fitsDiameter,
  fitsPrice,
  meetsWaterResistance,
  nickelSafe,
  normalizeMovement,
  normalizeReference,
  pageMentionsReference,
} from "./ai-watch-guardrails";
import type { AiSearchOutcome, FoundWatch } from "./ai-watch-types";
import { convert, loadFxTable, type FxTable } from "./fx.server";
import {
  diameterRangeFor,
  findPriceRange,
  type ProfileV4,
} from "./questionnaire-v4";

export type MuseSparkConfig = {
  apiKey: string;
  baseUrl: string;
  /** Used where latency matters most (proposals, ranking). */
  fastModel: string;
};
export type PerplexityConfig = { apiKey: string; model: string };
export type AiWatchFinderConfig = {
  museSpark: MuseSparkConfig | null;
  perplexity: PerplexityConfig | null;
};

export function loadAiWatchFinderConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiWatchFinderConfig {
  const museSparkKey = env.MUSE_SPARK_API_KEY?.trim();
  const perplexityKey = env.PERPLEXITY_API_KEY?.trim();
  return {
    museSpark: museSparkKey
      ? {
          apiKey: museSparkKey,
          baseUrl: (env.MUSE_SPARK_BASE_URL?.trim() || "https://api.meta.ai/v1").replace(
            /\/?$/,
            "/",
          ),
          // Measured: 1.2-contributor answers in 8-9 s where 1.3 takes 15-17 s,
          // almost all of it hidden reasoning before the first token.
          fastModel: env.MUSE_SPARK_FAST_MODEL?.trim() || "muse-spark-1.2-contributor",
        }
      : null,
    perplexity: perplexityKey
      ? {
          apiKey: perplexityKey,
          // sonar measured as fast as sonar-pro at half the cost here.
          model: env.PERPLEXITY_SEARCH_MODEL?.trim() || "sonar",
        }
      : null,
  };
}

export type {
  AiSearchOutcome,
  AiSearchView,
  FoundWatch,
  WatchDetails,
} from "./ai-watch-types";

export type Deps = {
  config: AiWatchFinderConfig;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  loadFx: () => Promise<FxTable | null>;
  now: () => number;
};

export function defaultDeps(overrides: Partial<Deps> = {}): Deps {
  const fetchImpl = overrides.fetchImpl ?? fetch;
  return {
    config: overrides.config ?? loadAiWatchFinderConfig(),
    fetchImpl,
    sleep:
      overrides.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
    loadFx: overrides.loadFx ?? (() => loadFxTable(fetchImpl)),
    now: overrides.now ?? Date.now,
  };
}

// Model output ends up in href and src attributes.
export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Placeholder names models sometimes emit instead of admitting a gap.
const VAGUE = /\b(unknown|unidentified|unspecified|various|n\/a|tbd)\b/i;

function logError(event: string, error: unknown) {
  console.error(
    JSON.stringify({
      event,
      message: error instanceof Error ? error.message : "unknown error",
    }),
  );
}

export function parseModelJson(content: string) {
  return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")) as unknown;
}

// ---------------------------------------------------------------------------
// Upstream calls

const PERPLEXITY_RETRIES = 2;

export async function perplexityPost(path: "chat/completions" | "search", body: unknown, deps: Deps, timeoutMs: number) {
  const config = deps.config.perplexity!;
  for (let attempt = 0; ; attempt += 1) {
    const response = await deps.fetchImpl(`https://api.perplexity.ai/${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 429 && attempt < PERPLEXITY_RETRIES) {
      await response.body?.cancel();
      const retryAfter = Number(response.headers.get("retry-after"));
      await deps.sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter, 5) * 1_000
          : 1_000 * (attempt + 1),
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `Perplexity ${path} returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    }
    return (await response.json()) as unknown;
  }
}

async function sonarJson(prompt: string, schema: Record<string, unknown>, deps: Deps) {
  const body = (await perplexityPost(
    "chat/completions",
    {
      model: deps.config.perplexity!.model,
      max_tokens: 2_000,
      web_search_options: { search_context_size: "low" },
      response_format: { type: "json_schema", json_schema: { schema } },
      messages: [{ role: "user", content: prompt }],
    },
    deps,
    20_000,
  )) as { choices?: { message?: { content?: unknown } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Perplexity returned no content.");
  return parseModelJson(content);
}

export type SearchHit = { url: string; title: string; snippet: string };

/** Perplexity Search API: raw ranked results, up to 5 queries per request. */
export async function searchWeb(queries: string[], deps: Deps): Promise<SearchHit[]> {
  if (queries.length === 0) return [];
  const body = (await perplexityPost(
    "search",
    { query: queries.slice(0, 5), max_results: 20, max_tokens_per_page: 256 },
    deps,
    8_000,
  )) as { results?: unknown };
  const results = Array.isArray(body.results) ? body.results.flat() : [];
  return results.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const url = safeHttpUrl(clean(item.url));
    return url ? [{ url, title: clean(item.title) ?? "", snippet: clean(item.snippet) ?? "" }] : [];
  });
}

export async function museJson(
  system: string,
  user: string,
  cacheKey: string,
  deps: Deps,
  timeoutMs: number,
): Promise<unknown> {
  const config = deps.config.museSpark!;
  const response = await deps.fetchImpl(new URL("chat/completions", config.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.fastModel,
      // "none" is rejected by the API; "minimal" is the fastest allowed.
      reasoning_effort: "minimal",
      // The system prompt comes first and never changes, so Muse Spark's
      // automatic prefix cache serves it at a fraction of the input price.
      prompt_cache_key: cacheKey,
      max_tokens: 4_000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Muse Spark returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Muse Spark returned no content.");
  return parseModelJson(content);
}

// ---------------------------------------------------------------------------
// Source pages: reference check and product photo

const PAGE_BYTES = 1_500_000;

export async function inspectSourcePage(
  url: string,
  reference: string | null,
  fetchImpl: typeof fetch,
): Promise<{ reachable: boolean; referenceFound: boolean; imageUrl: string | null }> {
  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { reachable: false, referenceFound: pageMentionsReference(reference, "", url), imageUrl: null };
    }
    const html = (await response.text()).slice(0, PAGE_BYTES);
    const meta =
      html.match(
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i,
      );
    let imageUrl: string | null = null;
    if (meta?.[1]) {
      try {
        imageUrl = safeHttpUrl(new URL(meta[1].replace(/&amp;/g, "&"), response.url || url).toString());
      } catch {
        imageUrl = null;
      }
    }
    return {
      reachable: true,
      referenceFound: pageMentionsReference(reference, html, response.url || url),
      imageUrl,
    };
  } catch {
    return { reachable: false, referenceFound: pageMentionsReference(reference, "", url), imageUrl: null };
  }
}

/**
 * The URL is kept (never the file) only if the host serves an image. A
 * one-byte ranged GET, not HEAD: some CDNs (Akamai for Longines) leave a
 * HEAD from Node's fetch hanging while answering a ranged GET instantly.
 */
export async function verifyImageUrl(
  url: string | null,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetchImpl(url, {
      headers: { range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(3_000),
    });
    await response.body?.cancel();
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    return response.ok && type.startsWith("image/") ? url : null;
  } catch {
    return null;
  }
}

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
    profile.caseShape !== undefined ? `Case shape: ${profile.caseShape}.` : null,
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
  materials: { case: string | null; caseback: string | null; strap: string | null };
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
export function quizRuleFailures(candidate: ScoredCandidate, profile: ProfileV4) {
  const range = findPriceRange(profile.priceRange)!;
  const failures: string[] = [];
  if (normalizeReference(candidate.referenceCode) === null) failures.push("reference");
  if (!fitsPrice(range, candidate.priceInBudget)) failures.push("price");
  if (!meetsWaterResistance(profile.minimumWaterResistanceM, candidate.waterResistanceM)) {
    failures.push("water_resistance");
  }
  if (!fitsDiameter(diameterRangeFor(profile), candidate.caseDiameterMm)) {
    failures.push("diameter");
  }
  if (!allowedMovement(profile.movementTypes, candidate.movement)) failures.push("movement");
  if (profile.allergyConstraint === "nickel_contact" && !nickelSafe(candidate.materials)) {
    failures.push("nickel");
  }
  return failures;
}

function factsRationale(candidate: QuizCandidate) {
  const parts = [
    candidate.caseDiameterMm !== null ? `${candidate.caseDiameterMm} mm` : null,
    candidate.movement ? MOVEMENT_WORDS[candidate.movement] ?? candidate.movement : null,
    candidate.waterResistanceM !== null ? `${candidate.waterResistanceM} m water resistance` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(", ")}.` : "Meets every stated constraint.";
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
          ? convert(candidate.price.amount, candidate.price.currency, profile.budgetCurrency, table)
          : candidate.price?.currency === profile.budgetCurrency
            ? candidate.price.amount
            : null,
    }))
    .filter((candidate) => {
      const failures = quizRuleFailures(candidate, profile);
      for (const failure of failures) counts[failure] = (counts[failure] ?? 0) + 1;
      return failures.length === 0;
    });
  if (eligible.length === 0) return [];

  const hits = await searchWeb(
    eligible.map((candidate) => `${candidate.brand} ${candidate.referenceCode}`),
    deps,
  );

  const verified = await Promise.all(
    eligible.map(async (candidate, order): Promise<VerifiedQuizWatch | null> => {
      const reference = normalizeReference(candidate.referenceCode)!;
      const urls = [
        candidate.sourceHint,
        ...hits
          .filter((hit) =>
            `${hit.url} ${hit.title} ${hit.snippet}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(reference),
          )
          .map((hit) => hit.url),
      ].filter(
        (url, index, all): url is string =>
          url !== null && all.indexOf(url) === index && classifySource(url, candidate.brand) !== null,
      );
      for (const url of urls.slice(0, 2)) {
        const page = await inspectSourcePage(url, candidate.referenceCode, deps.fetchImpl);
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
            priceNote: candidate.price ? money(candidate.price.amount, candidate.price.currency) : null,
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
    }),
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
      const key = `${item.watch.brand}|${normalizeReference(item.watch.referenceCode)}`.toLowerCase();
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
  timing: { softMs: number; hardMs: number } = { softMs: 12_000, hardMs: 28_000 },
): Promise<AiSearchOutcome> {
  const deps = defaultDeps(overrides);
  if (!deps.config.museSpark || !deps.config.perplexity) {
    logError("ai_watch_search_unavailable", new Error("Muse Spark or Perplexity is not configured."));
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
        return Array.isArray(payload.candidates) ? (payload.candidates as unknown[]) : [];
      },
      profile,
      fx,
      counts,
      deps,
    ),
  );
  // A live Perplexity angle catches recent releases the model may not know.
  const liveAngle = runQuizAngle(
    QUIZ_ANGLES.length,
    async () => {
      const payload = (await sonarJson(
        [
          "List up to 6 current-production wristwatches that meet EVERY constraint below, favouring recent releases.",
          constraints,
          "For each give the exact reference number, current new retail price with ISO currency, water resistance in metres, case diameter in mm, movement type, case, case-back and strap materials, the official manufacturer product page URL, and one sentence on why it fits. Use null for anything you cannot confirm.",
        ].join("\n"),
        sonarCandidateSchema,
        deps,
      )) as { candidates?: unknown };
      return Array.isArray(payload.candidates) ? (payload.candidates as unknown[]) : [];
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
    JSON.stringify({ event: "ai_quiz_guardrails", verified: verified.length, shown: watches.length, rejectedBy: counts }),
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

// ---------------------------------------------------------------------------
// Film, series, actor, character, and public-figure search

const filmCandidateSchema = {
  type: "object",
  properties: {
    sightings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          brand: { type: "string" },
          model: { type: "string" },
          referenceCode: { type: ["string", "null"] },
          person: { type: ["string", "null"] },
          work: { type: ["string", "null"] },
          year: { type: ["number", "null"] },
          context: { type: "string" },
          evidenceUrl: { type: ["string", "null"] },
          manufacturerUrl: { type: ["string", "null"] },
        },
        required: ["brand", "model", "context"],
      },
    },
  },
  required: ["sightings"],
};

type FilmCandidate = {
  brand: string;
  model: string;
  referenceCode: string | null;
  person: string | null;
  work: string | null;
  year: number | null;
  context: string;
  evidenceUrl: string;
  manufacturerUrl: string | null;
};

// Forums and social posts are not documentation.
const WEAK_EVIDENCE_HOSTS = /(^|\.)(reddit\.com|quora\.com|pinterest\.[a-z.]+|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com)$/;

function readFilmCandidates(payload: unknown): FilmCandidate[] {
  const sightings = (payload as { sightings?: unknown })?.sightings;
  if (!Array.isArray(sightings)) return [];
  return sightings.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const brand = clean(item.brand);
    const model = clean(item.model);
    const evidenceUrl = safeHttpUrl(clean(item.evidenceUrl));
    // A sighting without a named watch and a documenting page is never shown.
    if (!brand || !model || !evidenceUrl || VAGUE.test(`${brand} ${model}`)) return [];
    if (WEAK_EVIDENCE_HOSTS.test(new URL(evidenceUrl).hostname)) return [];
    const year = finite(item.year);
    return [
      {
        brand,
        model,
        referenceCode: clean(item.referenceCode),
        person: clean(item.person),
        work: clean(item.work),
        year: year !== null && year > 1850 && year < 2100 ? Math.round(year) : null,
        context: clean(item.context) ?? "",
        evidenceUrl,
        manufacturerUrl: safeHttpUrl(clean(item.manufacturerUrl)),
      },
    ];
  });
}

function dedupeSightings(items: FilmCandidate[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.brand}|${item.referenceCode ?? item.model}|${item.person ?? ""}`
      .toLowerCase()
      .replace(/[^a-z0-9|]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const FILM_MAX_WATCHES = 8;

/** Lowercased, whitespace-collapsed subject: the film search cache input. */
export function normalizeFilmQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

function filmPrompts(subject: string) {
  const intro = `The subject may be a film, TV series, actor, fictional character, or public figure: "${subject}".`;
  const ask =
    "For each watch give the brand, model, exact reference number if documented, who wore it (person), the film or series title (work) if any, the year, one sentence of context (scene or occasion), a URL of a page that documents the sighting (evidenceUrl), and the official manufacturer product page URL if one exists (manufacturerUrl). Use null for anything you cannot confirm. Never invent a sighting.";
  return [
    `${intro} Which specific wristwatches are worn on screen in it, or by this person or character on screen? ${ask}`,
    `${intro} Which specific wristwatches has this person worn in public, owned, or promoted as a brand ambassador? If the subject is a film or series, which watches are tied to it through official partnerships or its cast? ${ask}`,
    `${intro} Which watch sightings connected to it are documented by watch-identification sites and publications (for example watchesinmovies.info, Hodinkee, Esquire, GQ)? ${ask}`,
  ];
}

const FILM_RANK_SYSTEM = [
  "You are the film and culture editor of The Reserve.",
  "You receive a search subject (a film, series, actor, character, or public figure) and a JSON list of documented watch sightings gathered from web searches.",
  "Merge duplicates of the same watch and moment, drop sightings the evidence does not support, and rank the rest by how notable and well documented they are.",
  "For each kept sighting write one sentence of context naming who wore it, where, and when, using only the facts provided.",
  'Respond only with JSON: {"order":[{"index","note"}],"summary"}.',
].join(" ");

const rankSchema = z.object({
  order: z.array(z.object({ index: z.number().int().nonnegative(), note: z.string() })),
  summary: z.string(),
});

async function firstImage(urls: (string | null)[], reference: string | null, deps: Deps) {
  for (const url of urls) {
    if (!url) continue;
    const page = await inspectSourcePage(url, reference, deps.fetchImpl);
    const image = await verifyImageUrl(page.imageUrl, deps.fetchImpl);
    if (image) return image;
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function searchFilmWatches(
  query: string,
  overrides: Partial<Deps> = {},
): Promise<AiSearchOutcome> {
  const deps = defaultDeps(overrides);
  if (!deps.config.museSpark || !deps.config.perplexity) {
    logError("ai_watch_search_unavailable", new Error("Muse Spark or Perplexity is not configured."));
    return { status: "unavailable" };
  }
  const subject = query.trim().replace(/\s+/g, " ").slice(0, 160);

  // Stage 1: three live angles at once.
  const settled = await Promise.allSettled(
    filmPrompts(subject).map((prompt) => sonarJson(prompt, filmCandidateSchema, deps)),
  );
  if (settled.every((result) => result.status === "rejected")) {
    throw new Error("Every film search angle failed.");
  }
  const candidates = dedupeSightings(
    settled.flatMap((result) =>
      result.status === "fulfilled" ? readFilmCandidates(result.value) : [],
    ),
  ).slice(0, 16);
  if (candidates.length === 0) {
    return { status: "no_match", summary: `No documented watch sightings were found for "${subject}".` };
  }

  // Stage 2: Muse Spark merges and ranks while photos are fetched; the photo
  // stage has its own budget so one slow site cannot hold the answer back.
  const pageImages = new Map<string, Promise<string | null>>();
  const imageFor = (candidate: FilmCandidate) => {
    const key = `${candidate.manufacturerUrl}|${candidate.evidenceUrl}`;
    if (!pageImages.has(key)) {
      pageImages.set(
        key,
        firstImage([candidate.manufacturerUrl, candidate.evidenceUrl], candidate.referenceCode, deps),
      );
    }
    return pageImages.get(key)!;
  };
  const [ranking, images] = await Promise.all([
    museJson(
      FILM_RANK_SYSTEM,
      [
        `Subject: ${subject}`,
        "",
        "Sightings:",
        JSON.stringify(
          candidates.map((candidate, index) => ({
            index,
            brand: candidate.brand,
            model: candidate.model,
            reference: candidate.referenceCode,
            person: candidate.person,
            work: candidate.work,
            year: candidate.year,
            context: candidate.context,
            evidence: candidate.evidenceUrl,
          })),
        ),
      ].join("\n"),
      "reserve-film-rank-v1",
      deps,
      15_000,
    )
      .then((payload) => rankSchema.parse(payload))
      .catch((error: unknown) => {
        logError("ai_rank_failed", error);
        return null;
      }),
    withTimeout(
      Promise.all(candidates.map(imageFor)),
      8_000,
      candidates.map(() => null),
    ),
  ]);

  const order = ranking
    ? ranking.order.filter((entry) => entry.index < candidates.length)
    : candidates.map((candidate, index) => ({ index, note: candidate.context }));
  const used = new Set<number>();
  const watches: FoundWatch[] = [];
  for (const entry of order) {
    if (used.has(entry.index)) continue;
    used.add(entry.index);
    const candidate = candidates[entry.index]!;
    watches.push({
      brand: candidate.brand,
      model: candidate.model,
      referenceCode: candidate.referenceCode,
      sourceUrl: candidate.evidenceUrl,
      imageUrl: images[entry.index] ?? null,
      priceNote: null,
      rationale: entry.note.trim() || candidate.context,
      details: {
        person: candidate.person,
        work: candidate.work,
        year: candidate.year,
        context: candidate.context,
        evidenceUrl: candidate.evidenceUrl,
      },
    });
    if (watches.length === FILM_MAX_WATCHES) break;
  }
  if (watches.length === 0) {
    return { status: "no_match", summary: `No documented watch sightings were found for "${subject}".` };
  }
  return {
    status: "found",
    watches,
    summary: ranking?.summary?.trim() || `${watches.length} documented watch sightings.`,
  };
}

// ---------------------------------------------------------------------------

export const AI_SEARCH_TIMEOUT_MS = 35_000;

/** Never throws: failures and timeouts are logged and become "unavailable". */
export async function runSafely(
  search: () => Promise<AiSearchOutcome>,
  timeoutMs = AI_SEARCH_TIMEOUT_MS,
): Promise<AiSearchOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      search(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI watch search exceeded ${timeoutMs} ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    logError("ai_watch_search_error", error);
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
