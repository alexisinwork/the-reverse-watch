// A judge that rates watch cards the way the owner rates them on the rating
// page (owner, 2026-11-26: "добавь судью, чтобы он умел грамотно решать сам
// — без моего участия"). It reads each card with the request it answered,
// may check facts with a web search, and answers good / ok / poor / wrong
// (film: real sighting / can't confirm / false link). The model is reached
// through Perplexity's Agent API, which reports each call's cost, and the
// run stops before --budget.
//
// Calibrate first against the owner's ratings, then use it where nobody has
// rated:
//
//   node --env-file=.env --import tsx scripts/judge-cards.ts \
//     --sheet docs/reports/rating-sheet-2026-11-26.json \
//     --ratings docs/reports/owner-ratings-2026-11-26.json \
//     --model anthropic/claude-opus-5-5 --budget 6 --label opus
//
// Options: --tools quiz,archetype,alternatives,film  --limit N
//          --concurrency 1-6 (default 4)  --no-search  --all (also unrated
//          cards when --ratings is given)
//
// Writes docs/reports/judge-<label>-<date>.json: every verdict with its
// reason and cost and, with --ratings, the agreement with the owner on the
// calibration cards and, separately, on the held-out cards (every third
// rated card of each tool, never used to tune the instructions).
//
// Only card facts and public source addresses are sent; no visitor data.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

type Rating = "good" | "ok" | "poor" | "wrong";
type Card = {
  id: string;
  tool: "quiz" | "archetype" | "alternatives" | "film";
  request: { ru: string; en: string };
  section?: string;
  brand: string;
  model: string;
  referenceCode: string | null;
  price?: { amount: number; currency: string } | null;
  priceCondition?: string | null;
  priceConfirmed?: boolean | null;
  caseDiameterMm?: number | null;
  movement?: string | null;
  waterResistanceM?: number | null;
  verified?: boolean;
  verificationNote?: string | null;
  misses?: string[];
  person?: string | null;
  work?: string | null;
  sourceUrl?: string | null;
  referenceSourceUrl?: string | null;
  evidence?: { sourceUrl: string; sourceQuote: string | null }[];
};

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const sheetPath = option("sheet");
const ratingsPath = option("ratings");
const model = option("model");
const budgetUsd = Number(option("budget"));
const label = option("label") ?? "judge";
const concurrency = Number(option("concurrency") ?? 4);
const limit = Number(option("limit") ?? Number.POSITIVE_INFINITY);
const tools = option("tools")?.split(",");
const search = !process.argv.includes("--no-search");
const everyCard = process.argv.includes("--all");
if (!sheetPath || !model)
  throw new Error("--sheet <rating sheet json> and --model <id> are required.");
if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(model))
  throw new Error(
    "--model takes a Perplexity Agent API id such as anthropic/claude-opus-5-5.",
  );
if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 30)
  throw new Error("--budget <usd> is required: above 0 and at most 30.");
if (!/^[a-z0-9-]{1,40}$/.test(label))
  throw new Error("--label takes lowercase letters, digits and dashes.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6)
  throw new Error("--concurrency takes 1-6.");
const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
if (!apiKey) throw new Error("PERPLEXITY_API_KEY is required.");

const sheet = JSON.parse(readFileSync(sheetPath, "utf8")) as {
  id: string;
  cards: Card[];
};
const owner = ratingsPath
  ? new Map(
      (
        JSON.parse(readFileSync(ratingsPath, "utf8")) as {
          ratings: { card: string; rating: Rating }[];
        }
      ).ratings.map((entry) => [entry.card, entry.rating]),
    )
  : null;

// Every third rated card of each tool is held out: never looked at while
// the instructions were written, so its agreement is the honest one.
const heldOut = new Set<string>();
if (owner)
  for (const tool of ["quiz", "archetype", "alternatives", "film"]) {
    const rated = sheet.cards
      .filter((card) => card.tool === tool && owner.has(card.id))
      .map((card) => card.id)
      .sort();
    rated.forEach((id, index) => {
      if (index % 3 === 2) heldOut.add(id);
    });
  }

const cards = sheet.cards
  .filter((card) => !tools || tools.includes(card.tool))
  .filter((card) => !owner || everyCard || owner.has(card.id))
  .slice(0, limit);

const ADVICE_SCALE = `Rate the card with one word:
- "good": a strong pick; a watch specialist would gladly recommend it for this request.
- "ok": acceptable; it fits the request, but there are clearly better choices.
- "poor": it fits on paper but is a bad recommendation (for example a fashion or mall brand, a generic design, poor value, or a style that does not suit the request or the watch it should replace).
- "wrong": a fact on the card is wrong (price, case size, movement, water resistance, model or reference).`;
const FILM_SCALE = `Rate the card with one word:
- "good": a real sighting; reliable sources show this watch worn by this person or in this film or series.
- "ok": cannot confirm; you found no reliable source either way.
- "wrong": the link to the film or person is false, or the item is not a wristwatch.`;

const instructions = (card: Card) =>
  [
    "You review the answers of The Reserve, a watch recommendation site for enthusiasts. Each card is one watch the site showed for a visitor's request.",
    card.tool === "film" ? FILM_SCALE : ADVICE_SCALE,
    card.tool === "film"
      ? "Judge whether the sighting is real. The card's own source passages are evidence, not proof; check them against reliable sources (film-watch databases such as IMWDb, specialist articles, auction lots)."
      : "Hard rules (budget, case size, movement, water resistance) were already checked by code: rate whether this is a good recommendation and whether its facts are right. A price marked pre-owned is a pre-owned dealers' price; a price marked approximate is not a confirmed retail price. Judge the price against the request's budget and the watch's real market.",
    search
      ? "Use a web search only to check a fact you doubt. Never invent facts."
      : "Answer from your own knowledge. Never invent facts.",
    'Reply with JSON only: {"rating": "good" | "ok" | "poor" | "wrong", "reason": "one or two sentences", "wrongFacts": ["price" | "size" | "movement" | "water" | "model" | "reference" | "sighting"]}. List wrongFacts only for "wrong".',
  ].join("\n\n");

const describe = (card: Card) =>
  JSON.stringify({
    tool: card.tool,
    request: card.request.en,
    watch: {
      brand: card.brand,
      model: card.model,
      reference: card.referenceCode,
      price: card.price
        ? `${card.price.currency} ${Math.round(card.price.amount)} (${card.priceCondition === "pre-owned" ? "pre-owned dealers" : card.priceConfirmed ? "confirmed retail" : "approximate"})`
        : "unknown",
      caseDiameterMm: card.caseDiameterMm ?? "unknown",
      movement: card.movement ?? "unknown",
      waterResistanceM: card.waterResistanceM ?? "unknown",
      ...(card.tool === "film"
        ? {
            seen: [card.person, card.work].filter(Boolean).join(" · "),
            confirmedBySite: Boolean(card.verified),
            sourcePassages: (card.evidence ?? [])
              .filter((item) => item.sourceQuote)
              .map((item) => `${item.sourceQuote} (${item.sourceUrl})`)
              .slice(0, 2),
          }
        : {
            section:
              card.section === "alsoWorth" ? "also worth a look" : "main",
            differsFromRequest: card.misses ?? [],
          }),
      source: card.sourceUrl ?? null,
    },
  });

const verdictSchema = z.object({
  rating: z.enum(["good", "ok", "poor", "wrong"]),
  reason: z.string().max(600),
  wrongFacts: z.array(z.string()).max(7).default([]),
});

let spent = 0;
let stopReason: string | null = null;
/** A call can cost at most about this much (search context plus answer). */
const CALL_CEILING_USD = 0.12;

async function judge(card: Card) {
  const body = {
    model,
    instructions: instructions(card),
    input: describe(card),
    max_steps: search ? 3 : 1,
    max_output_tokens: 2500,
    ...(search
      ? {
          tools: [
            {
              type: "web_search",
              max_results: 4,
              max_tokens: 2500,
              max_tokens_per_page: 600,
            },
          ],
        }
      : {}),
  };
  const response = await fetch("https://api.perplexity.ai/v1/agent", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await response.json().catch(() => null)) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    usage?: { cost?: { total_cost?: number } };
    error?: unknown;
  } | null;
  const cost = Number(json?.usage?.cost?.total_cost ?? 0);
  spent += Number.isFinite(cost) ? cost : CALL_CEILING_USD;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = (json?.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((block) => block.type === "output_text")
    .map((block) => block.text ?? "")
    .join("")
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const verdict = verdictSchema.parse(JSON.parse(text.slice(start, end + 1)));
  // The film scale has no "poor".
  if (card.tool === "film" && verdict.rating === "poor") verdict.rating = "ok";
  return { ...verdict, costUsd: Number(cost.toFixed(5)) };
}

const verdicts: {
  card: string;
  tool: Card["tool"];
  owner: Rating | null;
  heldOut: boolean;
  rating: Rating | null;
  reason: string;
  wrongFacts: string[];
  costUsd: number;
  error?: string;
}[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < cards.length) {
      const card = cards[next++]!;
      const ownerRating = owner?.get(card.id) ?? null;
      if (stopReason || spent + concurrency * CALL_CEILING_USD > budgetUsd) {
        stopReason ??= `the next calls could pass $${budgetUsd} (spent $${spent.toFixed(4)})`;
        continue;
      }
      try {
        const verdict = await judge(card);
        verdicts.push({
          card: card.id,
          tool: card.tool,
          owner: ownerRating,
          heldOut: heldOut.has(card.id),
          rating: verdict.rating,
          reason: verdict.reason,
          wrongFacts: verdict.wrongFacts,
          costUsd: verdict.costUsd,
        });
        console.log(
          `${card.id} ${verdict.rating}${ownerRating ? ` (owner ${ownerRating})` : ""} $${verdict.costUsd} ${verdict.reason.slice(0, 90)}`,
        );
      } catch (error) {
        verdicts.push({
          card: card.id,
          tool: card.tool,
          owner: ownerRating,
          heldOut: heldOut.has(card.id),
          rating: null,
          reason: "",
          wrongFacts: [],
          costUsd: 0,
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : String(error),
        });
      }
    }
  }),
);
verdicts.sort((a, b) => a.card.localeCompare(b.card));

// Agreement with the owner: the same word, the same side (good/ok against
// poor/wrong), Cohen's kappa, and how many of the owner's poor or wrong
// cards the judge also called poor or wrong.
const positive = (rating: Rating) => rating === "good" || rating === "ok";
function agreement(rows: typeof verdicts) {
  const pairs = rows.filter(
    (row): row is typeof row & { owner: Rating; rating: Rating } =>
      row.owner !== null && row.rating !== null,
  );
  if (!pairs.length) return null;
  const exact = pairs.filter((row) => row.owner === row.rating).length;
  const side = pairs.filter(
    (row) => positive(row.owner) === positive(row.rating),
  ).length;
  const labels: Rating[] = ["good", "ok", "poor", "wrong"];
  const share = (who: "owner" | "rating", value: Rating) =>
    pairs.filter((row) => row[who] === value).length / pairs.length;
  const chance = labels.reduce(
    (sum, value) => sum + share("owner", value) * share("rating", value),
    0,
  );
  const observed = exact / pairs.length;
  const negatives = pairs.filter((row) => !positive(row.owner));
  return {
    cards: pairs.length,
    sameRating: Number(observed.toFixed(3)),
    sameSide: Number((side / pairs.length).toFixed(3)),
    kappa:
      chance < 1
        ? Number(((observed - chance) / (1 - chance)).toFixed(3))
        : null,
    ownerPoorOrWrong: negatives.length,
    judgeAlsoPoorOrWrong: negatives.filter((row) => !positive(row.rating))
      .length,
    judgePoorOrWrongWhereOwnerPositive: pairs.filter(
      (row) => positive(row.owner) && !positive(row.rating),
    ).length,
  };
}
const byTool = (rows: typeof verdicts) =>
  Object.fromEntries(
    ["quiz", "archetype", "alternatives", "film"].flatMap((tool) => {
      const result = agreement(rows.filter((row) => row.tool === tool));
      return result ? [[tool, result]] : [];
    }),
  );
const tally = Object.fromEntries(
  ["quiz", "archetype", "alternatives", "film"].map((tool) => {
    const rows = verdicts.filter((row) => row.tool === tool && row.rating);
    const counts: Record<string, number> = {};
    for (const row of rows)
      counts[row.rating!] = (counts[row.rating!] ?? 0) + 1;
    return [tool, { judged: rows.length, ratings: counts }];
  }),
);

const date = new Date().toISOString().slice(0, 10);
const report = {
  at: new Date().toISOString(),
  sheet: sheet.id,
  model,
  webSearch: search,
  budgetUsd,
  spendUsd: Number(spent.toFixed(4)),
  stopReason,
  judged: verdicts.filter((row) => row.rating).length,
  errors: verdicts.filter((row) => row.error).length,
  tally,
  ...(owner
    ? {
        agreement: {
          calibration: agreement(verdicts.filter((row) => !row.heldOut)),
          heldOut: agreement(verdicts.filter((row) => row.heldOut)),
          heldOutByTool: byTool(verdicts.filter((row) => row.heldOut)),
          allByTool: byTool(verdicts),
        },
      }
    : {}),
  verdicts,
};
const output = resolve(`docs/reports/judge-${label}-${date}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, verdicts: undefined }, null, 2));
console.log(`Wrote ${output}`);
process.exit(0);
