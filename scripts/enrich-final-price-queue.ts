// Owner-authorized final low-cost Muse-only enrichment. One web-grounded
// request per exact reference may add an approximate price and a public image
// URL. It has a hard local reservation ceiling and never falls back to another
// provider or sends visitor data.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { z } from "zod";
import {
  defaultDeps,
  museWebResearch,
  parseModelJson,
} from "../app/domain/ai-providers.server";
import { safeHttpUrl } from "../app/domain/source-pages.server";

const archive = "data/watch-archive/final-price-queue";
const candidatesPath = path.join(archive, "candidates.jsonl");
const progressPath = path.join(archive, "muse-progress.json");
const resultsPath = path.join(archive, "muse-results.jsonl");
const budgetUsd = 63.79;
const reservationUsd = 0.0055;
const concurrency = 4;

const candidateSchema = z.object({
  id: z.string().uuid(),
  brand: z.string().min(1),
  model: z.string().min(1),
  reference: z.string().min(1),
  sourceUrl: z.string().url(),
  missingPhoto: z.boolean(),
});
const resultSchema = z.object({
  approximatePrice: z.number().positive().nullable(),
  currency: z.enum(["USD", "EUR", "GBP", "CHF"]).nullable(),
  priceSourceUrl: z.string().url().nullable(),
  imageUrl: z.string().url().nullable(),
});
const progressSchema = z.object({
  budgetUsd: z.number().positive(),
  reservedUsd: z.number().nonnegative(),
  requests: z.number().int().nonnegative(),
  actualToolCalls: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  priced: z.number().int().nonnegative(),
  photographed: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  stopped: z.string().nullable(),
  updatedAt: z.string(),
});
type Progress = z.infer<typeof progressSchema>;
type Candidate = z.infer<typeof candidateSchema>;

if (!existsSync(candidatesPath))
  throw new Error("Run build-final-price-queue.ts first.");
mkdirSync(archive, { recursive: true });
const candidates = readFileSync(candidatesPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => candidateSchema.parse(JSON.parse(line)));
const progress: Progress = existsSync(progressPath)
  ? progressSchema.parse(JSON.parse(readFileSync(progressPath, "utf8")))
  : {
      budgetUsd,
      reservedUsd: 0,
      requests: 0,
      actualToolCalls: 0,
      completed: 0,
      priced: 0,
      photographed: 0,
      errors: 0,
      stopped: null,
      updatedAt: new Date().toISOString(),
    };
if (progress.budgetUsd !== budgetUsd)
  throw new Error(
    "Final price queue budget does not match its recorded ceiling.",
  );
if (progress.stopped === "budget_limit") process.exit(0);

const done = new Set<string>();
if (existsSync(resultsPath))
  for (const line of readFileSync(resultsPath, "utf8").split("\n")) {
    if (!line) continue;
    try {
      const value = JSON.parse(line) as { id?: unknown };
      if (typeof value.id === "string") done.add(value.id);
    } catch {
      // A torn final journal row must not reset the budget or repeat a request.
    }
  }
const pending = candidates.filter((candidate) => !done.has(candidate.id));

function save() {
  progress.updatedAt = new Date().toISOString();
  writeFileSync(progressPath, `${JSON.stringify(progress)}\n`);
}
function reserve() {
  if (progress.reservedUsd + reservationUsd > budgetUsd) {
    progress.stopped = "budget_limit";
    save();
    return false;
  }
  progress.reservedUsd += reservationUsd;
  progress.requests++;
  save();
  return true;
}

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(databaseUrl, {
  max: concurrency,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
const deps = defaultDeps();
if (!deps.config.museSpark) throw new Error("MUSE_SPARK_API_KEY required");
deps.config.webSearch = "muse";
deps.config.perplexity = null;

const prompt = (candidate: Candidate) =>
  [
    `Find one approximate current market price and one public product-image URL for this exact watch: ${candidate.brand} ${candidate.model}, reference ${candidate.reference}.`,
    "Use one live web search. Do not estimate. Return null for any field not explicitly shown by a source.",
    "The price may be authorised retail or secondary-market; this is an approximate visitor price, not a confirmed retail price.",
    "Return JSON only: approximatePrice (number|null), currency (USD|EUR|GBP|CHF|null), priceSourceUrl (https URL|null), imageUrl (direct public https image URL|null).",
  ].join("\n");

async function processCandidate(candidate: Candidate) {
  if (!reserve()) return;
  try {
    const research = await museWebResearch(prompt(candidate), deps, {
      maxToolCalls: 1,
      timeoutMs: 35_000,
      schema: {
        type: "object",
        properties: {
          approximatePrice: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          priceSourceUrl: { type: ["string", "null"] },
          imageUrl: { type: ["string", "null"] },
        },
        required: [
          "approximatePrice",
          "currency",
          "priceSourceUrl",
          "imageUrl",
        ],
      },
    });
    progress.actualToolCalls += research.toolCalls;
    const parsed = resultSchema.parse(parseModelJson(research.text));
    const priceUrl = parsed.priceSourceUrl
      ? safeHttpUrl(parsed.priceSourceUrl)
      : null;
    const imageUrl = parsed.imageUrl ? safeHttpUrl(parsed.imageUrl) : null;
    const hasPrice =
      parsed.approximatePrice !== null &&
      parsed.currency !== null &&
      priceUrl !== null;
    await sql`update private.watch_catalogue set
      price_amount=case when price_status='unconfirmed' and ${hasPrice} then ${parsed.approximatePrice}::numeric else price_amount end,
      price_currency=case when price_status='unconfirmed' and ${hasPrice} then ${parsed.currency}::text else price_currency end,
      price_status=case when price_status='unconfirmed' and ${hasPrice} then 'approximate' else price_status end,
      price_checked_at=case when price_status='unconfirmed' and ${hasPrice} then now() else price_checked_at end,
      price_evidence=case when price_status='unconfirmed' and ${hasPrice} then jsonb_build_object('method','muse_single_lookup','sourceUrl',${priceUrl}::text,'notice','Approximate price; may change. Check before purchase.') else price_evidence end,
      image_url=coalesce(image_url,${imageUrl}::text),updated_at=now()
      where lower(brand)=lower(${candidate.brand}) and lower(reference_code)=lower(${candidate.reference}) and review_status <> 'rejected'`;
    if (hasPrice) progress.priced++;
    if (imageUrl) progress.photographed++;
    appendFileSync(
      resultsPath,
      `${JSON.stringify({ id: candidate.id, reference: candidate.reference, status: "ok", priced: hasPrice, photographed: !!imageUrl, toolCalls: research.toolCalls })}\n`,
    );
  } catch (error) {
    progress.errors++;
    appendFileSync(
      resultsPath,
      `${JSON.stringify({ id: candidate.id, reference: candidate.reference, status: "error", error: error instanceof Error ? error.name : "unknown" })}\n`,
    );
  } finally {
    progress.completed++;
    save();
  }
}

try {
  for (
    let index = 0;
    index < pending.length && !progress.stopped;
    index += concurrency
  ) {
    await Promise.all(
      pending.slice(index, index + concurrency).map(processCandidate),
    );
  }
} finally {
  if (!progress.stopped && progress.completed >= candidates.length)
    progress.stopped = "complete";
  save();
  await sql.end();
}
