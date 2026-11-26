// Step 1 of the catalogue repair (owner, 2026-11-26: "готов — скажи как
// сделать и заодно проверим судью. лучше — будем пошагово делать"). Two
// judges found a wrong fact on about half of the quiz and alternatives cards
// the owner rated, nearly all on watches that an AI search had added to the
// catalogue (docs/reports/judge-*-2026-11-26.json). This dry run measures
// how well those facts can be repaired from real pages:
//
// 1. The judge model (Perplexity Agent API, with web search) finds the
//    maker's product page for the watch's exact reference, or an authorised
//    retailer's when the maker has none, and copies the passage that gives
//    each fact: model name, case diameter, movement and water resistance.
// 2. Our server opens the page itself. A value counts only when the page
//    shows the watch's reference and the copied passage, and the passage
//    gives that value; a passage the page does not contain counts for
//    nothing, as in the film-sighting check.
// 3. Each fact is then confirmed (the page shows the stored value),
//    corrected (the page shows another value), filled (the catalogue had
//    none) or unconfirmed.
//
// Nothing is written to the catalogue. The report lists the proposed
// corrections; step 2 applies the confirmed ones after the owner has seen
// the results. Prices keep their own check (scripts/recheck-catalogue-
// prices.ts), so they are not asked for here.
//
//   node --env-file=.env --import tsx scripts/fact-check-catalogue.ts \
//     --model anthropic/claude-opus-5-5 --budget 4 --label pilot [--limit 60]
//
// The watches: those an AI search added (source not a watch database) that
// appear on the owner's rating sheet, so each result can be compared with
// both judges' verdicts. Only watch facts and public addresses are sent.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import {
  normalizeReference,
  pageMentionsReference,
} from "../app/domain/ai-watch-guardrails";
import { pageSentences } from "../app/domain/cached-result-source-check.server";
import { publicFetch, sourceHost } from "../app/domain/source-pages.server";
import type { CatalogueWatch } from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
} from "../app/domain/watch-catalogue.server";
import { fold } from "./eval-sets";

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const model = option("model");
const budgetUsd = Number(option("budget"));
const label = option("label") ?? "pilot";
const limit = Number(option("limit") ?? Number.POSITIVE_INFINITY);
const concurrency = Number(option("concurrency") ?? 4);
if (!model || !/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(model))
  throw new Error("--model takes a Perplexity Agent API id.");
if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 30)
  throw new Error("--budget <usd> is required: above 0 and at most 30.");
if (!/^[a-z0-9-]{1,40}$/.test(label))
  throw new Error("--label takes lowercase letters, digits and dashes.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6)
  throw new Error("--concurrency takes 1-6.");
const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
if (!apiKey) throw new Error("PERPLEXITY_API_KEY is required.");

// ---------------------------------------------------------------------------
// The watches and what the judges said about them

type Verdict = { card: string; rating: string | null; wrongFacts?: string[] };
const verdictsOf = (name: string) =>
  new Map(
    (
      JSON.parse(
        readFileSync(`docs/reports/judge-${name}-2026-11-26.json`, "utf8"),
      ) as { verdicts: Verdict[] }
    ).verdicts.map((verdict) => [verdict.card, verdict]),
  );
const opus = verdictsOf("opus");
const hydrogen = verdictsOf("hydrogen");
const negative = (rating: string | null | undefined) =>
  rating === "poor" || rating === "wrong";

const sheet = JSON.parse(
  readFileSync("docs/reports/rating-sheet-2026-11-26.json", "utf8"),
) as {
  cards: {
    id: string;
    tool: string;
    brand: string;
    referenceCode: string | null;
  }[];
};
const client = catalogueClient();
if (!client) throw new Error("SUPABASE_URL and the service key are required.");
const catalogue = await listCatalogue(client);
const recordKey = (brand: string, reference: string | null) =>
  `${fold(brand)}|${normalizeReference(reference) ?? ""}`;
const byKey = new Map<string, CatalogueWatch>();
for (const watch of catalogue)
  if (watch.referenceCode)
    byKey.set(recordKey(watch.brand, watch.referenceCode), watch);

const selected = new Map<
  string,
  { watch: CatalogueWatch; cards: string[]; judgedFacts: Set<string> | null }
>();
for (const card of sheet.cards) {
  if (card.tool !== "quiz" && card.tool !== "alternatives") continue;
  const watch = byKey.get(recordKey(card.brand, card.referenceCode));
  if (!watch || watch.sourceKind === "catalogue") continue;
  const entry = selected.get(watch.id) ?? {
    watch,
    cards: [],
    judgedFacts: null,
  };
  entry.cards.push(card.id);
  const first = opus.get(card.id);
  const second = hydrogen.get(card.id);
  if (first?.rating && second?.rating) {
    entry.judgedFacts ??= new Set();
    if (negative(first.rating) && negative(second.rating))
      for (const fact of first.wrongFacts ?? [])
        if ((second.wrongFacts ?? []).includes(fact))
          entry.judgedFacts.add(fact);
  }
  selected.set(watch.id, entry);
}
const watches = [...selected.values()].slice(0, limit);

// ---------------------------------------------------------------------------
// 1. The model finds the page and copies the passages

const fieldSchema = <T extends z.ZodTypeAny>(value: T) =>
  z
    .object({
      value: value.nullable(),
      passage: z.string().max(400).nullable(),
    })
    .nullable()
    .catch(null);
const answerSchema = z.object({
  pageUrl: z.string().nullable(),
  referenceExists: z.boolean().nullable().catch(null),
  referenceOnPage: z.string().max(80).nullable().catch(null),
  model: fieldSchema(z.string().max(160)),
  caseDiameterMm: fieldSchema(z.number()),
  movement: fieldSchema(
    z.enum([
      "automatic",
      "manual",
      "quartz",
      "solar",
      "spring drive",
      "kinetic",
    ]),
  ),
  waterResistanceM: fieldSchema(z.number()),
  note: z.string().max(500).catch(""),
});
type Answer = z.infer<typeof answerSchema>;

const INSTRUCTIONS = [
  "You check the facts of one watch in The Reserve's catalogue, a watch recommendation site, against the maker's own product page for the watch's exact reference. Use an authorised retailer's product page only when the maker has none. Never use marketplaces, auction or grey-market sites, forums or databases.",
  "Find that page with a web search. For each fact, give the value the page states and copy, word for word, the short passage of the page that states it: the line of the specification table or the sentence. A passage must be text that appears on the page. If the page does not state a fact, give null for its value and passage. Never guess a value.",
  "If no maker or authorised page exists for this exact reference, or the page for it shows a different watch, say so: referenceExists false, or referenceOnPage with the reference as the page writes it.",
  'Reply with JSON only: {"pageUrl": string or null, "referenceExists": true, false or null, "referenceOnPage": string or null, "model": {"value": string, "passage": string} or null, "caseDiameterMm": {"value": number, "passage": string} or null, "movement": {"value": "automatic" | "manual" | "quartz" | "solar" | "spring drive" | "kinetic", "passage": string} or null, "waterResistanceM": {"value": number in metres, "passage": string} or null, "note": "one sentence"}.',
].join("\n\n");

let spent = 0;
let stopReason: string | null = null;
const CALL_CEILING_USD = 0.15;

async function ask(watch: CatalogueWatch) {
  const response = await fetch("https://api.perplexity.ai/v1/agent", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: INSTRUCTIONS,
      input: JSON.stringify({
        brand: watch.brand,
        model: watch.model,
        reference: watch.referenceCode,
        stored: {
          caseDiameterMm: watch.caseDiameterMm,
          movement: watch.movement,
          waterResistanceM: watch.waterResistanceM,
        },
        storedSourcePage: watch.sourceUrl,
      }),
      max_steps: 4,
      max_output_tokens: 2500,
      tools: [
        {
          type: "web_search",
          max_results: 4,
          max_tokens: 4000,
          max_tokens_per_page: 1500,
        },
      ],
    }),
    signal: AbortSignal.timeout(150_000),
  });
  const json = (await response.json().catch(() => null)) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    usage?: { cost?: { total_cost?: number } };
  } | null;
  const cost = Number(json?.usage?.cost?.total_cost ?? 0);
  spent += Number.isFinite(cost) ? cost : CALL_CEILING_USD;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = (json?.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((block) => block.type === "output_text")
    .map((block) => block.text ?? "")
    .join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return {
    answer: answerSchema.parse(JSON.parse(text.slice(start, end + 1))),
    costUsd: Number(cost.toFixed(5)),
  };
}

// ---------------------------------------------------------------------------
// 2. Our server opens the page and checks every passage

const PAGE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
  accept: "text/html,application/xhtml+xml",
};
const plain = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Page =
  | { state: "opened"; url: string; text: string }
  | { state: "blocked" | "missing" | "failed"; url: string; status?: number };

async function openPage(url: string): Promise<Page> {
  try {
    const fetched = await publicFetch(
      url,
      { headers: PAGE_HEADERS, signal: AbortSignal.timeout(15_000) },
      fetch,
    );
    if (!fetched) return { state: "failed", url };
    const { response, finalUrl } = fetched;
    if (!response.ok) {
      await response.body?.cancel();
      return {
        state: [401, 403, 429].includes(response.status)
          ? "blocked"
          : "missing",
        url: finalUrl,
        status: response.status,
      };
    }
    const html = (await response.text()).slice(0, 2_000_000);
    return {
      state: "opened",
      url: finalUrl,
      text: pageSentences(html).join(" \n "),
    };
  } catch {
    return { state: "failed", url };
  }
}

const number = (value: number) =>
  new RegExp(
    `(?<![0-9.])${String(value).replace(".", "\\.")}(?:\\.0+)?(?![0-9])`,
  );
const MOVEMENT_WORDS: Record<string, RegExp> = {
  automatic: /automatic|self.?winding|automatique|automatik|selbstaufzug/,
  manual: /hand.?wound|hand.?winding|manual|handaufzug|remontage manuel/,
  quartz: /quartz|quarz/,
  solar: /solar|eco.?drive|light.?powered/,
  "spring drive": /spring drive/,
  kinetic: /kinetic/,
};
const movementClass = (value: string | null) => {
  if (!value) return null;
  const text = value.toLowerCase();
  if (/spring drive/.test(text)) return "spring drive";
  if (/solar|eco.?drive/.test(text)) return "solar";
  if (/kinetic/.test(text)) return "kinetic";
  if (/quartz/.test(text)) return "quartz";
  if (/manual|hand/.test(text)) return "manual";
  if (/automatic|self/.test(text)) return "automatic";
  return text;
};

/** The passage is on the page and gives the value. */
function shows(page: string, passage: string | null, gives: RegExp | null) {
  if (!passage || !gives) return false;
  const quoted = plain(passage);
  return quoted.length >= 3 && page.includes(quoted) && gives.test(quoted);
}

type FieldResult = {
  status: "confirmed" | "corrected" | "filled" | "unconfirmed";
  stored: string | number | null;
  page?: string | number | null;
  passage?: string | null;
};

function checkNumber(
  stored: number | null,
  field: { value: number | null; passage: string | null } | null,
  page: string,
  unit: "mm" | "m",
  tolerance: number,
): FieldResult {
  const value = field?.value ?? null;
  if (value === null || !Number.isFinite(value))
    return { status: "unconfirmed", stored };
  // A case's length, thickness or lug width is not its diameter (the pilot
  // took Frederique Constant's "Case Length 40 mm" for one).
  if (
    unit === "mm" &&
    /length|lug|thick|height|strap|bracelet|band/.test(
      plain(field?.passage ?? ""),
    )
  )
    return { status: "unconfirmed", stored };
  // Water resistance may be written in bar or atmospheres (10 bar = 100 m).
  const gives =
    unit === "mm"
      ? new RegExp(`${number(value).source}\\s*mm`)
      : new RegExp(
          `${number(value).source}\\s*(m|meter|metre)|${number(value / 10).source}\\s*(bar|atm)`,
        );
  if (!shows(page, field?.passage ?? null, gives))
    return { status: "unconfirmed", stored };
  if (stored === null)
    return { status: "filled", stored, page: value, passage: field!.passage };
  return Math.abs(stored - value) <= tolerance
    ? { status: "confirmed", stored, page: value, passage: field!.passage }
    : { status: "corrected", stored, page: value, passage: field!.passage };
}

function checkMovement(
  stored: string | null,
  field: Answer["movement"],
  page: string,
): FieldResult {
  const value = field?.value ?? null;
  if (!value || !shows(page, field?.passage ?? null, MOVEMENT_WORDS[value]!))
    return { status: "unconfirmed", stored };
  const storedClass = movementClass(stored);
  if (!storedClass)
    return { status: "filled", stored, page: value, passage: field!.passage };
  return storedClass === value
    ? { status: "confirmed", stored, page: value, passage: field!.passage }
    : { status: "corrected", stored, page: value, passage: field!.passage };
}

// The stored model name is confirmed when the page shows its distinctive
// words; corrected when the page names the watch and shows fewer than half
// of them.
const GENERIC = new Set(
  "automatic quartz manual watch mm stainless steel black white blue green dial bracelet strap rubber leather men mens women chronograph diver dive date".split(
    " ",
  ),
);
function checkModel(
  stored: string,
  brand: string,
  field: Answer["model"],
  page: string,
): FieldResult {
  const brandWords = new Set(plain(brand).split(" "));
  const words = plain(stored)
    .split(" ")
    .filter(
      (word) =>
        word.length > 1 &&
        !GENERIC.has(word) &&
        !brandWords.has(word) &&
        !/^\d+(\.\d+)?(mm|m)?$/.test(word),
    );
  if (!words.length) return { status: "unconfirmed", stored };
  const found = words.filter((word) =>
    new RegExp(`(?<![a-z0-9])${word.replace(".", "\\.")}(?![a-z0-9])`).test(
      page,
    ),
  ).length;
  if (found === words.length)
    return { status: "confirmed", stored, page: field?.value ?? null };
  const named =
    field?.value && field.passage && page.includes(plain(field.passage));
  return named && found < words.length / 2
    ? {
        status: "corrected",
        stored,
        page: field.value,
        passage: field.passage,
      }
    : { status: "unconfirmed", stored };
}

// ---------------------------------------------------------------------------
// 3. Run, compare with the judges, report

type Result = {
  id: string;
  brand: string;
  model: string;
  reference: string | null;
  sourceKind: string | null;
  cards: string[];
  judgesFlagged: string[] | null;
  pageUrl: string | null;
  pageHost: string | null;
  page: Page["state"] | "none";
  referenceOnPage: boolean;
  referenceExists: boolean | null;
  pageReference: string | null;
  fields: Record<string, FieldResult>;
  note: string;
  costUsd: number;
  error?: string;
};
const results: Result[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < watches.length) {
      const { watch, cards, judgedFacts } = watches[next++]!;
      const base = {
        id: watch.id,
        brand: watch.brand,
        model: watch.model,
        reference: watch.referenceCode,
        sourceKind: watch.sourceKind,
        cards,
        judgesFlagged: judgedFacts ? [...judgedFacts].sort() : null,
      };
      if (stopReason || spent + concurrency * CALL_CEILING_USD > budgetUsd) {
        stopReason ??= `the next calls could pass $${budgetUsd} (spent $${spent.toFixed(4)})`;
        continue;
      }
      try {
        const { answer, costUsd } = await ask(watch);
        const opened = answer.pageUrl ? await openPage(answer.pageUrl) : null;
        const text = opened?.state === "opened" ? plain(opened.text) : "";
        const url = opened?.url ?? answer.pageUrl;
        const fields: Record<string, FieldResult> = {
          model: checkModel(watch.model, watch.brand, answer.model, text),
          caseDiameterMm: checkNumber(
            watch.caseDiameterMm,
            answer.caseDiameterMm,
            text,
            "mm",
            0.25,
          ),
          movement: checkMovement(watch.movement, answer.movement, text),
          waterResistanceM: checkNumber(
            watch.waterResistanceM,
            answer.waterResistanceM,
            text,
            "m",
            0,
          ),
        };
        // The page's text must give the reference: a URL that carries it
        // proves nothing (AI output invents such URLs; the pilot found
        // eight of nine stored pages for invented references gone).
        const referenceOnPage =
          opened?.state === "opened" &&
          pageMentionsReference(watch.referenceCode, opened.text, "");
        // On a page that does not show this reference, nothing is confirmed.
        if (!referenceOnPage)
          for (const key of Object.keys(fields))
            fields[key] = {
              status: "unconfirmed",
              stored: fields[key]!.stored,
            };
        results.push({
          ...base,
          pageUrl: url ?? null,
          pageHost: sourceHost(url ?? null),
          page: opened?.state ?? "none",
          referenceOnPage,
          referenceExists: answer.referenceExists,
          pageReference: answer.referenceOnPage,
          fields,
          note: answer.note,
          costUsd,
        });
        const summary = Object.entries(fields)
          .filter(([, field]) => field.status !== "unconfirmed")
          .map(([key, field]) => `${key}:${field.status}`)
          .join(" ");
        console.log(
          `${watch.brand} ${watch.referenceCode} page=${opened?.state ?? "none"} ref=${referenceOnPage} ${summary || "nothing confirmed"} $${costUsd}`,
        );
      } catch (error) {
        results.push({
          ...base,
          pageUrl: null,
          pageHost: null,
          page: "none",
          referenceOnPage: false,
          referenceExists: null,
          pageReference: null,
          fields: {},
          note: "",
          costUsd: 0,
          error: (error as Error).message.slice(0, 200),
        });
      }
    }
  }),
);

const FIELDS = ["model", "caseDiameterMm", "movement", "waterResistanceM"];
const fieldTally = Object.fromEntries(
  FIELDS.map((key) => {
    const counts: Record<string, number> = {};
    for (const result of results) {
      const status = result.fields[key]?.status;
      if (status) counts[status] = (counts[status] ?? 0) + 1;
    }
    return [key, counts];
  }),
);
const JUDGE_FIELD: Record<string, string> = {
  model: "model",
  caseDiameterMm: "size",
  movement: "movement",
  waterResistanceM: "water",
};
const corrected = (result: Result) =>
  FIELDS.filter((key) => result.fields[key]?.status === "corrected");
const flagged = results.filter((result) => result.judgesFlagged?.length);
const clean = results.filter(
  (result) => result.judgesFlagged && !result.judgesFlagged.length,
);
const report = {
  at: new Date().toISOString(),
  model,
  budgetUsd,
  spendUsd: Number(spent.toFixed(4)),
  stopReason,
  watches: results.length,
  errors: results.filter((result) => result.error).length,
  pages: Object.fromEntries(
    ["opened", "blocked", "missing", "failed", "none"].map((state) => [
      state,
      results.filter((result) => result.page === state).length,
    ]),
  ),
  referenceShownOnPage: results.filter((result) => result.referenceOnPage)
    .length,
  referenceReportedMissing: results.filter(
    (result) => result.referenceExists === false,
  ).length,
  fields: fieldTally,
  watchesWithACorrection: results.filter((result) => corrected(result).length)
    .length,
  againstTheJudges: {
    flaggedByBoth: flagged.length,
    flaggedAndCorrectedInANamedFact: flagged.filter((result) =>
      corrected(result).some((key) =>
        result.judgesFlagged!.includes(JUDGE_FIELD[key]!),
      ),
    ).length,
    notFlagged: clean.length,
    notFlaggedButCorrected: clean.filter((result) => corrected(result).length)
      .length,
  },
  results,
};
const output = resolve(
  `docs/reports/fact-check-${label}-${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
console.log(`Wrote ${output}`);
process.exit(0);
